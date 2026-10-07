import { ALL_FUSION_SOURCES, composeSource } from './fusion'
import { FUSION_DOCS, FUSION_MEDIA } from './fusionDocs'
import { noise } from './lines'

/**
 * Data Fusion — pipelines.
 *
 * SYNTHETIC, like everything in this directory. Gated on `VITE_DEMO_MODE`.
 * See `DEMO-MODE.md` §8.10.
 *
 * ── A pipeline is a source, a target and a schedule ───────────────────────
 * Its source is an id into the registry, never a name typed twice — the design
 * writes `src:"Rockwell FT Historian"` as a string, so a pipeline can name a
 * connection the platform does not have and nothing notices. Here the name is
 * resolved, and `verify:mocks` asserts every pipeline's source exists.
 *
 * ── A pipeline cannot be running off a source that has stopped ────────────
 * That is the rule this screen exists to make visible, and it is derived rather
 * than authored: the design marks one pipeline Failed and leaves another Active
 * while the connection behind it is Disconnected. Here status falls out of the
 * source's own state, so the two screens cannot disagree — pausing is the only
 * thing a person sets.
 *
 * ── What it moves is counted, not typed ───────────────────────────────────
 * A pipeline carrying documents into the retrieval index moves as many records
 * as there are documents. One reading a historian moves as many as that
 * historian carries tags. The design writes "2,838" beside a connection that
 * says 2,838 somewhere else, which is the same number in two places waiting to
 * drift.
 */

/** How often a pipeline runs, and how long that is in minutes. */
export const SCHEDULES = {
  realtime: 1,
  halfHourly: 30,
  hourly: 60,
  onUpload: null,
  daily: 24 * 60,
  weekly: 7 * 24 * 60,
}

/**
 * Where a pipeline delivers.
 *
 * Every one of these is somewhere in this product, and the screen links to it —
 * which is the test of whether a target is real. The design's list includes
 * "3D Model Store" and "Quality Events"; both exist here as the media registry
 * and the vision sources, so both are kept and pointed at the right screen.
 */
export const TARGETS = {
  knowledgeGraph: '/app/data-fusion/graph',
  assetRegistry: '/app/assets',
  workOrders: '/app/work-orders',
  qualityEvents: '/app/data-fusion/vision',
  anomalyEngine: '/app/anomalies',
  copilotRetrieval: '/app/copilot',
  mediaStore: '/app/data-fusion/media',
}

/**
 * The six the plant runs.
 *
 * `records` is a rule, not a number: `tags` means "whatever the source carries",
 * `documents` and `media` mean the registry lengths. Only `perMinute` is a rate
 * the pipeline itself sets, because a vision feed's throughput is a property of
 * the inspection program rather than of anything counted elsewhere.
 *
 * `paused` is the one authored piece of status. Everything else is derived.
 */
const PIPELINES = [
  {
    id: 'pipe_ot_graph',
    name: 'OT Live → Knowledge Graph',
    sourceId: 'src_ftlive_fdy',
    target: 'knowledgeGraph',
    schedule: 'realtime',
    records: 'tags',
  },
  {
    id: 'pipe_sap_wo',
    name: 'SAP PM → Work Orders',
    sourceId: 'conn_cmms',
    target: 'workOrders',
    schedule: 'halfHourly',
    records: 'tags',
  },
  {
    id: 'pipe_docs_index',
    name: 'Documents → Retrieval Index',
    sourceId: 'src_s3_docs',
    target: 'copilotRetrieval',
    schedule: 'onUpload',
    records: 'documents',
  },
  {
    id: 'pipe_pid_context',
    name: 'P&ID Contextualisation',
    sourceId: 'src_s3_docs',
    target: 'knowledgeGraph',
    schedule: 'daily',
    records: 'documents',
    /* The one failing on its own merits rather than because its source is down.
       OCR confidence below the threshold is a pipeline problem, and the
       Contextualisation queue is where its output would have gone — which is why
       there are unplaced documents sitting in it. */
    error: 'ocrConfidence',
  },
  {
    id: 'pipe_vision_quality',
    name: 'Vision → Quality Events',
    sourceId: 'src_isra_fdy',
    target: 'qualityEvents',
    schedule: 'realtime',
    records: 'perMinute',
    perMinute: 1200,
  },
  {
    id: 'pipe_cad_media',
    name: 'CAD → 3D Model Store',
    sourceId: 'src_s3_docs',
    target: 'mediaStore',
    schedule: 'weekly',
    records: 'media',
    paused: true,
  },
  {
    id: 'pipe_abb_graph',
    name: 'Weißenthurm OT → Knowledge Graph',
    sourceId: 'src_800xa_wtm',
    target: 'knowledgeGraph',
    schedule: 'realtime',
    records: 'tags',
  },
]

/** Runtime overrides — pausing, resuming and running. Resets on reload. */
const STATE = new Map()

/**
 * How many records a run moves.
 *
 * Read from whatever the pipeline says it carries, so it cannot disagree with
 * the collection it is moving. A stopped pipeline moves nothing, which is the
 * only case where the answer is zero rather than a count.
 */
function recordsFor(pipeline, source, status) {
  if (status !== 'active') return 0
  if (pipeline.records === 'documents') return FUSION_DOCS.length
  if (pipeline.records === 'media') return FUSION_MEDIA.length
  if (pipeline.records === 'perMinute') return pipeline.perMinute
  return source?.tags ?? 0
}

/**
 * The status, in the order the reasons override one another.
 *
 * A person's pause beats everything — it is the one thing they set, and a paused
 * pipeline should stay paused even if its source recovers. After that the
 * SOURCE decides: a pipeline reading a disconnected historian is stalled whether
 * or not anybody has noticed, and that is the rule the design gets wrong by
 * leaving one Active beside a Disconnected connection. Only then does the
 * pipeline's own error apply.
 */
export function statusOf(pipeline, source) {
  const override = STATE.get(pipeline.id)
  if (override?.paused ?? pipeline.paused) return 'paused'
  if (source && source.status !== 'connected' && source.status !== 'syncing') return 'stalled'
  if (override?.cleared !== true && pipeline.error) return 'failed'
  return 'active'
}

/** Wire shape. */
export function composePipeline(pipeline, now = Date.now()) {
  const source =
    ALL_FUSION_SOURCES()
      .map((entry) => composeSource(entry))
      .find((entry) => entry.id === pipeline.sourceId) ?? null

  const status = statusOf(pipeline, source)
  const override = STATE.get(pipeline.id)
  const everyMinutes = SCHEDULES[pipeline.schedule]

  /* When it last ran. Derived from the schedule rather than authored, so
     "Every 30m · 2 hours ago" cannot happen unless something is actually wrong —
     and when it is wrong, that is the point. A paused or stalled pipeline last
     ran a while back; a healthy one ran within its own interval. */
  const minutesAgo =
    override?.ranAt != null
      ? Math.max(0, Math.round((now - override.ranAt) / 60_000))
      : status === 'active'
        ? Math.round((everyMinutes ?? 360) * (0.15 + noise(pipeline.id, 2) * 0.5))
        : Math.round((everyMinutes ?? 1440) * (3 + noise(pipeline.id, 3) * 4))

  return {
    id: pipeline.id,
    name: pipeline.name,
    sourceId: pipeline.sourceId,
    sourceName: source?.name ?? null,
    sourceStatus: source?.status ?? null,
    target: pipeline.target,
    targetHref: TARGETS[pipeline.target],
    schedule: pipeline.schedule,
    everyMinutes,
    status,
    // A pipeline can be stalled without being broken itself. Naming which of the
    // two it is decides whether somebody fixes the pipeline or the connection.
    error: status === 'failed' ? pipeline.error : null,
    stalledBy: status === 'stalled' ? (source?.name ?? null) : null,
    records: recordsFor(pipeline, source, status),
    recordsUnit: pipeline.records === 'perMinute' ? 'perMinute' : 'total',
    lastRunAt: new Date(now - minutesAgo * 60_000).toISOString(),
    lastRunMinutesAgo: minutesAgo,
    /* Overdue is arithmetic against its own schedule, so a daily job that last
       ran three days ago says so without anybody authoring "late". */
    overdue: everyMinutes != null && minutesAgo > everyMinutes * 2,
  }
}

/**
 * Every pipeline whose source still exists.
 *
 * The filter is not defensive tidying: Settings → Integrations can delete a
 * source, and a pipeline reading a connection that is no longer registered is
 * not a stalled pipeline — there is nothing for it to read and nothing to
 * resume. Without this it would come back Active, because `statusOf` skips the
 * source rule when there is no source to check.
 */
export const allPipelines = () =>
  PIPELINES.map((pipeline) => composePipeline(pipeline)).filter((row) => row.sourceName != null)

/** What a source is feeding. Read before deleting it, so the confirmation can say. */
export const pipelinesForSource = (sourceId) =>
  PIPELINES.filter((pipeline) => pipeline.sourceId === sourceId).length

/**
 * Run one now, or pause and resume it.
 *
 * Running clears a pipeline's OWN error — that is what re-running means. It does
 * not clear a stall: the source is still down, and a screen that let somebody
 * make a red row green while the connection behind it was disconnected would be
 * teaching them to ignore it.
 */
export function actOnPipeline(id, action, now = Date.now()) {
  const pipeline = PIPELINES.find((entry) => entry.id === id)
  if (!pipeline) return null

  const current = STATE.get(id) ?? {}
  if (action === 'pause') STATE.set(id, { ...current, paused: true })
  if (action === 'resume') STATE.set(id, { ...current, paused: false })
  if (action === 'run') STATE.set(id, { ...current, paused: false, cleared: true, ranAt: now })

  return composePipeline(pipeline, now)
}

/** The header line. Counted off the composed list, never authored. */
export function pipelineStats(rows) {
  return {
    total: rows.length,
    active: rows.filter((row) => row.status === 'active').length,
    failed: rows.filter((row) => row.status === 'failed').length,
    stalled: rows.filter((row) => row.status === 'stalled').length,
    paused: rows.filter((row) => row.status === 'paused').length,
  }
}
