import { HIERARCHY_NODES } from './hierarchy'
import { CONNECTORS } from './operations'
import { audit } from './audit'
import { noise } from './lines'

/**
 * Data Fusion — the source registry.
 *
 * SYNTHETIC, like everything in this directory. Gated on `VITE_DEMO_MODE`.
 * See `DEMO-MODE.md` §8.10.
 *
 * ── This file does not start a second list of connected systems ───────────
 * `CONNECTORS` in `operations.js` already declares three: the OT historian, the
 * CMMS and the MES. The public page prints their contracts, and the Sensor
 * Explorer's filter drawer states as fact that exactly one of them provides
 * signals — which is why that drawer offers no source filter. A parallel array
 * here would let Data Fusion say the historian is degraded while the public page
 * says it is connected, and nothing would catch it.
 *
 * So those three are ANCHORS. Their protocol, tag count, last sync and state all
 * come from `CONNECTORS`; this file adds only what a connection table needs and
 * that file has no business carrying — an endpoint, a category, the assets it
 * reads. Everything else in the registry is a source the design shows and the
 * product does not have yet.
 *
 * ── Status is derived from the clock, not authored ────────────────────────
 * The prototype writes `s: "Connected", sync: "30 sec ago"` as two independent
 * strings, so a row can claim it is healthy and last spoke two days ago. Here a
 * source declares when it last synced and what its SLA is, and the status falls
 * out of the comparison. A source cannot be connected and stale at once, and
 * `verify:mocks` asserts the three anchors come out with the state
 * `operations.js` authored for them.
 *
 * ── A source's site is derived from the assets it reads ───────────────────
 * Also not authored. A gateway that reads three Findlay machines is at Findlay
 * by definition, and stating both invites them to disagree. Enterprise systems
 * declare no assets and are scoped `all`.
 */

/* ── Categories ───────────────────────────────────────────────────────────
   Four of the design's five. `iot` is deliberately absent: that section is built
   against the real `/v1/connections` API and reads nothing from here.

   `unit` is the noun the category counts, taken from the ingest profiles — a
   historian counts tags, an ERP counts records, a TSDB counts series and a
   vision system counts cameras. One column header for all four would have to say
   "items", which is the word you reach for when you have stopped thinking about
   what is in the column. */
export const FUSION_CATEGORIES = [
  { id: 'ot', section: 'ot', unit: 'tags', signals: true },
  { id: 'vision', section: 'vision', unit: 'cameras', signals: false },
  { id: 'biz', section: 'business', unit: 'records', signals: false },
  { id: 'db', section: 'stores', unit: 'series', signals: false },
]

/**
 * Which business system a `biz` source is.
 *
 * The Settings → Integrations page groups CMMS apart from ERP, and this registry
 * had one category covering both plus the MES. It is a real distinction — a work
 * order system and a materials ledger are not the same integration — and it is
 * authored in exactly one place: here for the sources this file owns, and read
 * off `CONNECTORS.family` for the anchors, which already declare it.
 */
export const BUSINESS_SYSTEMS = ['cmms', 'erp', 'mes']

export const categoryOf = (sectionId) =>
  FUSION_CATEGORIES.find((category) => category.section === sectionId) ?? null

/* ── The three anchors ────────────────────────────────────────────────────
   What `CONNECTORS` cannot carry, keyed by its ids. The fields it DOES carry are
   read from it below and never repeated here — that is the whole point of the
   arrangement. */
const ANCHOR_DETAIL = {
  conn_historian: {
    name: 'OSIsoft PI Historian',
    category: 'ot',
    endpoint: 'pi.fdy.meridian.internal:443',
    slaMinutes: 5,
    latencyMs: 800,
    assets: ['FDY-BM-03', 'FDY-CMP-12', 'FDY-WSH-01', 'FDY-DEC-02', 'FDY-BM-07'],
  },
  conn_cmms: {
    name: 'SAP Plant Maintenance',
    category: 'biz',
    endpoint: 'sap-pm.meridian.corp/sap/opu/odata',
    slaMinutes: 30,
    latencyMs: null,
    assets: [],
  },
  conn_mes: {
    name: 'Oracle MES',
    category: 'biz',
    endpoint: 'mes.meridian.corp/api/v2',
    slaMinutes: 15,
    latencyMs: null,
    assets: ['FDY-BM-03', 'FDY-BM-07'],
  },
}

/**
 * The sources this file authors — everything that is not an anchor.
 *
 * `error` is a reason, not a status: the status is derived, and a source that
 * carries a reason is disconnected because of it. The design's "Not Configured"
 * is not a flag: it is a source with no endpoint — a catalogue entry somebody
 * added and never filled in. Carrying a `configured: false` bit BESIDE the empty
 * endpoint is how a source ends up unconfigured with an endpoint in it, which is
 * exactly what happened the first time the drawer let somebody type one.
 */
const AUTHORED = [
  /* ── OT · SCADA / PLC / Historian ───────────────────────────────────── */
  {
    id: 'src_s7_fdy',
    name: 'Siemens SIMATIC S7-1500',
    category: 'ot',
    protocol: 'OPC-UA',
    endpoint: 'opc.tcp://10.4.2.11:4840',
    assets: ['FDY-BM-03', 'FDY-TRM-01', 'FDY-NCK-01'],
    tags: 1240,
    lastSyncMinutesAgo: 1,
    slaMinutes: 5,
    latencyMs: 200,
  },
  {
    id: 'src_ftlive_fdy',
    name: 'Rockwell FactoryTalk Historian',
    category: 'ot',
    protocol: 'ODBC',
    endpoint: 'ft-hist01.fdy.meridian.internal',
    assets: ['FDY-CUP-01', 'FDY-CUP-02', 'FDY-PAL-01', 'FDY-PAL-02'],
    tags: 2838,
    lastSyncMinutesAgo: 2,
    slaMinutes: 10,
    latencyMs: 1100,
  },
  {
    id: 'src_melsoft_fdy',
    name: 'Mitsubishi MELSOFT · Seamer',
    category: 'ot',
    protocol: 'Modbus TCP',
    endpoint: '10.4.3.18:502',
    assets: ['FDY-OVN-01'],
    tags: 340,
    lastSyncMinutesAgo: 0,
    slaMinutes: 10,
    latencyMs: null,
    syncing: true,
  },
  {
    id: 'src_800xa_wtm',
    name: 'ABB System 800xA',
    category: 'ot',
    protocol: 'OPC-UA',
    endpoint: 'opc.tcp://10.7.1.5:4840',
    assets: ['WTM-PRS-04', 'WTM-CVR-02'],
    tags: 0,
    lastSyncMinutesAgo: 2 * 24 * 60,
    slaMinutes: 15,
    latencyMs: null,
    error: 'tlsHandshake',
  },
  {
    id: 'src_experion_pnq',
    name: 'Honeywell Experion DCS',
    category: 'ot',
    protocol: 'OPC-DA',
    endpoint: '10.9.4.30',
    assets: ['PNQ-BM-02', 'PNQ-NCK-01'],
    tags: 890,
    lastSyncMinutesAgo: 3,
    slaMinutes: 10,
    latencyMs: 1400,
  },

  /* ── Vision & quality ───────────────────────────────────────────────── */
  {
    id: 'src_isra_fdy',
    name: 'ISRA VISION · Can Inspect',
    category: 'vision',
    protocol: 'gRPC',
    endpoint: 'isra.fdy.meridian.internal',
    assets: ['FDY-DEC-02'],
    tags: 4,
    lastSyncMinutesAgo: 0,
    slaMinutes: 5,
    latencyMs: 200,
  },
  {
    id: 'src_thermal_fdy',
    name: 'Thermal Camera Array',
    category: 'vision',
    protocol: 'RTSP',
    endpoint: 'rtsp://10.4.5.20:554',
    assets: ['FDY-CMP-12', 'FDY-CHL-02'],
    tags: 8,
    lastSyncMinutesAgo: 0,
    slaMinutes: 5,
    latencyMs: 400,
  },
  {
    id: 'src_cognex_pnq',
    name: 'Cognex In-Sight · Label',
    category: 'vision',
    protocol: 'REST',
    endpoint: 'cognex.pnq.meridian.internal',
    assets: ['PNQ-NCK-01'],
    tags: 2,
    lastSyncMinutesAgo: 0,
    slaMinutes: 5,
    latencyMs: null,
    syncing: true,
  },

  /* ── Business systems ───────────────────────────────────────────────── */
  {
    id: 'src_s4hana',
    name: 'SAP S/4HANA · Materials',
    category: 'biz',
    system: 'erp',
    protocol: 'OData',
    endpoint: 's4.meridian.corp/sap/opu/odata',
    assets: [],
    tags: 8400,
    lastSyncMinutesAgo: 62,
    slaMinutes: 120,
    latencyMs: null,
  },
  {
    id: 'src_maximo',
    name: 'IBM Maximo',
    category: 'biz',
    system: 'cmms',
    protocol: 'REST',
    endpoint: null,
    assets: [],
    tags: 0,
    lastSyncMinutesAgo: null,
    slaMinutes: null,
    latencyMs: null,
  },

  /* ── Databases & cloud storage ──────────────────────────────────────── */
  {
    id: 'src_influx',
    name: 'InfluxDB · Time Series',
    category: 'db',
    protocol: 'Influx v2',
    endpoint: 'influx.meridian.internal:8086',
    assets: [],
    tags: 28_000_000,
    lastSyncMinutesAgo: 0,
    slaMinutes: 5,
    latencyMs: 50,
  },
  {
    id: 'src_pg_registry',
    name: 'PostgreSQL · Asset Registry',
    category: 'db',
    protocol: 'JDBC',
    endpoint: 'pg.meridian.internal:5432',
    assets: [],
    tags: 1240,
    lastSyncMinutesAgo: 11,
    slaMinutes: 60,
    latencyMs: null,
  },
  {
    id: 'src_s3_docs',
    name: 'AWS S3 · Document Backup',
    category: 'db',
    protocol: 'S3',
    endpoint: 's3://meridian-plant-docs',
    assets: [],
    tags: 840,
    lastSyncMinutesAgo: 3 * 60,
    slaMinutes: 24 * 60,
    latencyMs: null,
  },
]

/** The three anchors, rebuilt from `CONNECTORS` on every read. */
function anchoredSources() {
  return CONNECTORS.map((connector) => {
    const detail = ANCHOR_DETAIL[connector.id]
    if (!detail) return null
    return {
      ...detail,
      id: connector.id,
      protocol: connector.protocol,
      /* Read, not repeated. `family` is what the public page already calls this
         connector, so the Integrations grouping and that page cannot disagree
         about whether SAP PM is a CMMS. */
      system: BUSINESS_SYSTEMS.includes(connector.family) ? connector.family : null,
      tags: connector.tags ?? 0,
      lastSyncMinutesAgo: connector.lastSyncMinutesAgo,
      /* Carried through so the connection drawer can print the same contract the
         public page does, rather than a second copy of it. */
      provides: connector.provides,
      doesNotProvide: connector.doesNotProvide,
      anchoredTo: connector.family,
    }
  }).filter(Boolean)
}

export const ALL_FUSION_SOURCES = () => [...anchoredSources(), ...AUTHORED]

/**
 * Change one field on one source, wherever that source really lives.
 *
 * The connection drawer edits the endpoint, and the endpoint has to end up in the
 * registry rather than in the drawer's own state — otherwise the table behind the
 * drawer keeps printing the old one, and the status derived from it keeps
 * describing a connection nobody has any more.
 *
 * Which object to write is not the same for the two halves of the registry:
 * `AUTHORED` entries are the record, while an anchor's row is rebuilt from
 * `CONNECTORS` on every read and only its `ANCHOR_DETAIL` half survives. Callers
 * should not have to know that, which is why this is the only way in.
 *
 * Restricted to the fields the registry owns. Nothing else has any business being
 * written from a form — the tag count belongs to the source and the status is
 * derived, and a setter that let either be typed would put back exactly the
 * disagreement this module was arranged to prevent.
 */
const WRITABLE_FIELDS = new Set(['endpoint'])

export function setSourceField(id, field, value) {
  if (!WRITABLE_FIELDS.has(field)) return false
  const target = ANCHOR_DETAIL[id] ?? AUTHORED.find((source) => source.id === id)
  if (!target) return false
  target[field] = value
  return true
}

/* ── Ingest, stopped by a person ──────────────────────────────────────────
   Session state rather than a field on the record, for the reason the pipeline
   overrides give: a pause is something somebody did, not something the plant is,
   and a reload should bring the estate back as it stands. */
const PAUSED = new Set()

/**
 * Stop or restart a source's ingest.
 *
 * This is the one thing the pipeline monitor can do that changes the plant, and
 * it changes it everywhere: the source's family table says Paused, its pipelines
 * go to Stalled — a pipeline cannot be running off a connection that has
 * stopped — and the ingest chart loses its share, because a paused source is not
 * delivering. That spread is the point. A pause that only greyed out one row
 * would be a button that changes a screen rather than a system.
 */
export function pauseSource(id, paused) {
  const source = ALL_FUSION_SOURCES().find((entry) => entry.id === id)
  if (!source) return null
  /* Nothing to stop. Refusing beats silently marking an empty catalogue entry
     paused, which would then read Paused for ever with no ingest to resume. */
  if (!source.endpoint) return { id, ok: false, reason: 'notConfigured' }

  if (paused) PAUSED.add(id)
  else PAUSED.delete(id)
  audit(paused ? 'SOURCE_PAUSED' : 'SOURCE_RESUMED', { resource: `source:${id}` })
  return { id, ok: true, paused }
}

export const isPaused = (id) => PAUSED.has(id)

/** For Reset all settings, and for the checks. */
export const resetSourcePauses = () => PAUSED.clear()

/**
 * Remove a source from the registry.
 *
 * The three anchors refuse. Their rows are rebuilt from `CONNECTORS` on every
 * read — the public page prints the same three contracts — so "deleting" one
 * here would remove nothing and the row would be back on the next render. Saying
 * why beats a button that appears to work.
 *
 * Everything else goes, and what read it goes with it: `allPipelines` drops a
 * pipeline whose source no longer exists, because a pipeline reading a
 * connection that is not there is not a pipeline. The caller is told how many,
 * so the confirmation can say it before rather than after.
 */
export function removeFusionSource(id) {
  if (ANCHOR_DETAIL[id]) return { id, ok: false, reason: 'anchored' }
  const index = AUTHORED.findIndex((source) => source.id === id)
  if (index < 0) return { id, ok: false, reason: 'notFound' }

  const [removed] = AUTHORED.splice(index, 1)
  PAUSED.delete(id)
  audit('SOURCE_DELETED', { resource: `source:${id}`, detail: { name: removed.name } })
  return { id, ok: true, name: removed.name }
}

/**
 * Add a source the connect wizard just configured.
 *
 * It goes into the same array the authored ones live in, which is what makes it
 * real: it appears in its family's table, it counts in the overview, it opens in
 * the drawer, and the Contextualisation queue picks up the tags it publishes. A
 * separate "pending" list would have been a second registry, and the screens that
 * read this one would all have had to learn about it.
 *
 * What it does NOT get is a last-sync time. A connection created a moment ago has
 * never synced, so it comes back Disconnected · never synced — the rung pass 2a
 * added. The prototype's wizard ends with a row that says Connected, which is
 * false of every connection anybody has ever made.
 *
 * @param {object} payload
 * @param {string[]} payload.assets Whatever the scope step resolved to. Empty for
 *   an enterprise system, and the source's site derives from it as usual.
 */
export function addFusionSource(payload) {
  const record = {
    id: `src_new_${AUTHORED.filter((source) => source.added).length + 1}`,
    name: payload.name,
    category: payload.category,
    protocol: payload.protocol,
    endpoint: payload.endpoint || null,
    assets: payload.assets ?? [],
    tags: payload.objects ?? 0,
    lastSyncMinutesAgo: null,
    slaMinutes: payload.slaMinutes ?? null,
    latencyMs: null,
    added: true,
  }
  AUTHORED.push(record)
  return record
}

/* ── Derivations ──────────────────────────────────────────────────────── */

const SITE_OF_ASSET = new Map()
for (const node of HIERARCHY_NODES) {
  if (node.tier !== 'asset') continue
  const line = HIERARCHY_NODES.find((entry) => entry.id === node.parentId)
  if (line) SITE_OF_ASSET.set(node.id, line.parentId)
}

/**
 * Where a source sits.
 *
 * `null` means enterprise-wide, which is a different statement from "unknown" —
 * SAP does not belong to a plant, and printing Findlay beside it would be wrong
 * rather than merely unhelpful.
 */
export function siteOf(source) {
  const sites = new Set((source.assets ?? []).map((id) => SITE_OF_ASSET.get(id)).filter(Boolean))
  return sites.size === 1 ? [...sites][0] : null
}

/**
 * The status, in the order the reasons override one another.
 *
 * Nothing filled in beats an error, which beats a sync in flight, which beats
 * the clock. The last case is the one worth having: a source is degraded because
 * it has missed its own SLA, not because somebody typed "degraded".
 */
export function statusOf(source) {
  if (!source.endpoint) return 'notConfigured'
  /* A person's decision beats the clock, the same order `fusionPipelines` uses.
     A source somebody stopped is not degraded and not disconnected — nothing is
     wrong with it, it is off — and grading it on an SLA it was told not to meet
     would put it in a queue of faults to chase. */
  if (PAUSED.has(source.id)) return 'paused'
  if (source.error) return 'disconnected'
  /* Configured and has never delivered anything. Not the same as unconfigured —
     somebody has done the work and it is not working — and emphatically not
     Connected, which is what an unguarded clock comparison against `null`
     produced: the moment the drawer let a reader give Maximo an endpoint, a
     source that had never spoken once claimed to be healthy. */
  if (source.lastSyncMinutesAgo == null) return 'disconnected'
  if (source.syncing) return 'syncing'
  if (source.lastSyncMinutesAgo > source.slaMinutes) return 'degraded'
  return 'connected'
}

/** How far past its SLA a source is, in minutes. Zero when it is inside it. */
export function overdueBy(source) {
  if (source.lastSyncMinutesAgo == null || source.slaMinutes == null) return 0
  return Math.max(0, source.lastSyncMinutesAgo - source.slaMinutes)
}

/** Wire shape. One place, so the table and the drawer cannot describe a source differently. */
export function composeSource(source, now = Date.now()) {
  const siteId = siteOf(source)
  const site = siteId ? HIERARCHY_NODES.find((node) => node.id === siteId) : null

  return {
    id: source.id,
    name: source.name,
    category: source.category,
    /* Null for everything that is not a business system, and never guessed. */
    system: source.system ?? null,
    protocol: source.protocol,
    endpoint: source.endpoint,
    status: statusOf(source),
    paused: PAUSED.has(source.id),
    /* The reason, and never a blank beside a red pill. A source that has been
       given an endpoint and has not synced yet has a reason too, and it is a
       different one from a handshake that failed. */
    error:
      source.error ??
      (source.endpoint && source.lastSyncMinutesAgo == null ? 'neverSynced' : null),
    tags: source.tags,
    latencyMs: source.latencyMs ?? null,
    slaMinutes: source.slaMinutes ?? null,
    overdueMinutes: overdueBy(source),
    recordsPerMinute: recordsPerMinute(source),
    lastSyncAt:
      source.lastSyncMinutesAgo == null
        ? null
        : new Date(now - source.lastSyncMinutesAgo * 60_000).toISOString(),
    siteId,
    siteName: site?.name ?? null,
    assetIds: source.assets ?? [],
    assetCount: (source.assets ?? []).length,
    /* Only the anchors carry a contract, because only they have one that another
       screen already prints. The rest say nothing rather than inventing one. */
    provides: source.provides ?? null,
    doesNotProvide: source.doesNotProvide ?? null,
    anchored: Boolean(source.anchoredTo),
  }
}

/** Per-category counts for the header line. Derived from the same compose the rows use. */
export function sourceStats(rows) {
  return {
    total: rows.length,
    connected: rows.filter((row) => row.status === 'connected').length,
    attention: rows.filter((row) => row.status === 'degraded' || row.status === 'disconnected')
      .length,
    tags: rows.reduce((sum, row) => sum + (row.tags ?? 0), 0),
  }
}

/* ══ DATA OVERVIEW ═══════════════════════════════════════════════════════
   The module's landing screen, and the last thing in it that should ever be
   authored. Every figure below is a count of a collection that exists
   somewhere else in this directory — which is why it was built after the source
   tables and the document registry rather than before them. A KPI card is the
   easiest place in a product to put a number nobody can trace, and this is the
   arrangement that makes tracing it the only option. */

/**
 * The knowledge graph, counted.
 *
 * Not a stored figure and not an estimate: an entity is a record this platform
 * actually holds, and a relationship is an edge it can actually walk. The
 * prototype prints `graphEntities: 12847`, which is a number with nothing behind
 * it — there is no way to click into it and no way for it to be wrong.
 *
 * @param {object} parts Every collection that contributes a node.
 */
export function graphCounts({ nodes, channels, sources, docs, media }) {
  const entities = {
    // The estate itself: enterprise, regions, sub-regions, sites, lines, assets.
    hierarchy: nodes.length,
    signals: channels.length,
    sources: sources.length,
    documents: docs.length,
    media: media.length,
  }

  const relationships = {
    // Every node but the root has exactly one parent, so the edge count is the
    // node count less one. Derived rather than counted so it cannot drift.
    hierarchy: Math.max(0, nodes.length - 1),
    // A channel hangs off the asset it measures.
    signals: channels.length,
    // A source reads a set of assets; each pairing is an edge.
    ingestion: sources.reduce((sum, source) => sum + source.assetIds.length, 0),
    // A document or a photograph can name several things at once.
    knowledge: [...docs, ...media].reduce((sum, record) => sum + record.links.length, 0),
  }

  const total = (counts) => Object.values(counts).reduce((sum, count) => sum + count, 0)

  return {
    entities,
    relationships,
    entityTotal: total(entities),
    relationshipTotal: total(relationships),
  }
}

/**
 * What arrived over the last 24 hours, by hour.
 *
 * Composed from the sources themselves: only a source that is actually
 * delivering contributes, its share is proportional to what it carries, and the
 * shape over the day is the plant's own — the night shift moves less material,
 * so less telemetry is produced. `noise` keys off the hour so the series is the
 * same on every render and every reader's screen.
 *
 * A source that is disconnected contributes nothing, which is the point: the
 * chart dips when something breaks rather than being a decorative wave that
 * looks identical whatever the table above it says.
 *
 * @returns {{hour: number, value: number}[]} Oldest first, 24 points.
 */
export function ingestByHour(rows, now = Date.now()) {
  const perHour = streamingTags(rows) * SAMPLES_PER_TAG_HOUR
  const startHour = new Date(now).getHours()

  return Array.from({ length: 24 }, (_, index) => {
    const hour = (startHour - 23 + index + 24) % 24
    /* Three shifts. Days runs hardest, nights lightest — the same 06:00 / 14:00 /
       22:00 pattern the Shifts module rosters against, so the two screens tell
       one story about when this plant is busy. */
    const shiftFactor = hour >= 6 && hour < 14 ? 1 : hour >= 14 && hour < 22 ? 0.92 : 0.71
    const jitter = 0.9 + noise('ingest', hour) * 0.2
    return { hour, value: Math.round(perHour * shiftFactor * jitter) }
  })
}

/**
 * Which families actually stream, and how much they carry.
 *
 * Only the live-signal families count. A relational table of 1,240 asset records
 * is not "streaming", and InfluxDB's 28 million stored series are history rather
 * than arrivals — summing all four families put 28M in a card labelled "Tags
 * streaming", which is a category error dressed as a big number.
 */
export const STREAMING_CATEGORIES = ['ot', 'vision']

export const isStreaming = (source) => STREAMING_CATEGORIES.includes(source.category)

/**
 * How much a source is delivering right now, in records a minute.
 *
 * Arithmetic on the one assumption this file already makes — `SAMPLES_PER_TAG_HOUR`,
 * a sample per tag every twenty seconds — rather than a second number authored
 * beside the tag count. The design writes `847 tags` and `12,400 records/min` as
 * two independent strings, so a row can carry a tag count and a rate that do not
 * belong to each other.
 *
 * A source that is not delivering delivers nothing. Not a small number, not a
 * dash: zero is the measurement, and a monitor whose throughput column stays
 * populated while the status column reads Disconnected is the column that taught
 * everyone to ignore both.
 */
export function recordsPerMinute(source) {
  if (!isStreaming(source)) return null
  const status = statusOf(source)
  if (status !== 'connected' && status !== 'syncing') return 0
  return Math.round(((source.tags ?? 0) * SAMPLES_PER_TAG_HOUR) / 60)
}

export const streamingTags = (rows) =>
  rows
    .filter((row) => STREAMING_CATEGORIES.includes(row.category))
    .filter((row) => row.status === 'connected' || row.status === 'syncing')
    .reduce((sum, row) => sum + (row.tags ?? 0), 0)

/* One sample every twenty seconds per tag, which is a plausible historian
   publishing interval and the only assumption in the ingest figures. Everything
   else — the peak, the daily total — is arithmetic on top of it. */
const SAMPLES_PER_TAG_HOUR = 180

/** The three figures printed under the ingest chart. All read off the series. */
export function ingestStats(rows, series) {
  const lags = rows.map((row) => row.latencyMs).filter((ms) => ms != null)
  return {
    peakPerHour: Math.max(0, ...series.map((point) => point.value)),
    pointsPerDay: series.reduce((sum, point) => sum + point.value, 0),
    avgLagSeconds: lags.length
      ? Math.round((lags.reduce((sum, ms) => sum + ms, 0) / lags.length / 1000) * 10) / 10
      : null,
  }
}

/**
 * The "Needs your attention" list.
 *
 * Assembled from three collections rather than authored as one: sources that
 * have stopped or fallen behind, documents nobody has verified, and
 * certificates running out. Each entry carries where to go, so the list is a set
 * of links and not a set of warnings.
 *
 * Ordered by how much it matters — a dead historian before a stale one, and both
 * before a document somebody has not signed off.
 */
export function attentionItems({ sources, docs }) {
  const items = [
    ...sources
      .filter((source) => source.status === 'disconnected')
      .map((source) => ({
        id: source.id,
        kind: 'sourceDown',
        rank: 0,
        name: source.name,
        detail: source.error,
        section: sectionOfCategory(source.category),
      })),
    ...sources
      .filter((source) => source.status === 'degraded')
      .map((source) => ({
        id: source.id,
        kind: 'sourceStale',
        rank: 1,
        name: source.name,
        minutes: source.overdueMinutes,
        section: sectionOfCategory(source.category),
      })),
    ...sources
      .filter((source) => source.status === 'notConfigured')
      .map((source) => ({
        id: source.id,
        kind: 'sourceUnconfigured',
        rank: 2,
        name: source.name,
        section: sectionOfCategory(source.category),
      })),
    ...docs
      .filter((doc) => doc.expiresInDays != null && doc.expiresInDays <= 180)
      .map((doc) => ({
        id: doc.id,
        kind: 'docExpiring',
        rank: 3,
        name: doc.name,
        days: doc.expiresInDays,
        section: 'documents',
      })),
    /* Unplaced before unverified, and never both. A document nobody has said
       what it is about is a different job from one nobody has signed off, it
       goes to a different screen, and listing the same record twice under two
       headings is how an attention list stops being read. */
    ...docs
      .filter((doc) => doc.pending && !doc.links.length)
      .map((doc) => ({
        id: doc.id,
        kind: 'docUnplaced',
        rank: 4,
        name: doc.name,
        section: 'context',
      })),
    ...docs
      .filter((doc) => !doc.verified && !doc.pending)
      .map((doc) => ({
        id: doc.id,
        kind: 'docUnverified',
        rank: 5,
        name: doc.name,
        section: 'documents',
      })),
  ]

  return items.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
}

const sectionOfCategory = (category) =>
  FUSION_CATEGORIES.find((entry) => entry.id === category)?.section ?? null
