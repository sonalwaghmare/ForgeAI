import { SIGNAL_CHANNELS } from './signals'
import { HIERARCHY_NODES } from './hierarchy'
import { TARGETS } from './fusionPipelines'

/**
 * Data Fusion — what a source is bound to.
 *
 * SYNTHETIC, like everything in this directory. Gated on `VITE_DEMO_MODE`.
 * See `DEMO-MODE.md` §8.10, pass 2b.
 *
 * ── Binding is not the same act as placing ────────────────────────────────
 * Contextualisation places an object in the estate: this tag belongs to that
 * machine. Binding routes it: this tag drives that Forge sensor's chart, its
 * thresholds and its anomaly detection. The two screens were kept apart in pass 6
 * for a reason that matters here — `CONNECTORS` declares exactly one connector
 * that provides signals, and Sensor Explorer's filter drawer states that as fact.
 *
 * So a source binds Forge sensors **if and only if its OWN contract declares
 * signals**, which is one source. The family profile is not enough and must not
 * be: OT as a family plainly provides signals, and every OT gateway here says so
 * on its Data Contract tab — what is scarce is being the connector this platform
 * routes into the sensor catalogue, and only the three anchors carry a contract
 * of their own to declare it with. Reading the family claim instead would have
 * let five gateways bind the same bodymaker's instruments.
 *
 * ── The bound rows and the Contextualisation queue are one population ─────
 * A source publishes tags. The ones bound to a Forge sensor are in this table;
 * the rest are in the queue on the Contextualisation screen. `tagsOfSource`
 * returns both halves and the queue filters out the bound ones, so the identity
 * holds by construction rather than by two lists being kept in step. The design
 * has neither: its mapping table is five hand-written rows naming machines that
 * do not exist in this estate.
 *
 * ── A row that cannot be opened was never a binding ───────────────────────
 * Every row carries an `href` into the screen that owns the thing it names — the
 * same test the knowledge graph applies to an edge. A binding to a Forge object
 * this deployment does not have is not rendered as a row with nowhere to go: it
 * is reported separately, as capability the connector offers and this product
 * does not consume.
 */

/* ── Cells ────────────────────────────────────────────────────────────────
   A cell is a literal, a data kind out of the shared vocabulary, or a delivery
   target. Three constructors rather than pre-translated strings, because the
   fixture has no business holding English. */
const text = (value) => ({ text: value ?? null })
const kind = (key) => ({ kindKey: key })
const target = (key) => ({ targetKey: key })

const nodeById = new Map(HIERARCHY_NODES.map((node) => [node.id, node]))

/* ── OT ───────────────────────────────────────────────────────────────── */

/**
 * The channels this source drives.
 *
 * Empty unless the source's contract says it provides signals. Two OT sources
 * read the same bodymaker; letting both claim its channels would put the same
 * instrument on two mapping tables and quietly make Sensor Explorer's "one source
 * provides signals" wrong.
 */
export function boundChannelsOf(source) {
  /* `provides` is present only on a source that declares its own contract — the
     three anchors, read from `CONNECTORS`. Everything else answers `null` here
     and falls back to the family profile for the Data Contract tab only. */
  if (!(source.provides ?? []).includes('signals')) return []
  const assets = new Set(source.assetIds ?? [])
  return SIGNAL_CHANNELS.filter((channel) => assets.has(channel.assetId) && channel.tag)
}

function otMapping(source) {
  return {
    columns: [
      { id: 'sourceTag', mono: true },
      { id: 'signal' },
      { id: 'unit' },
      { id: 'sensor', mono: true },
      { id: 'asset', mono: true },
    ],
    rows: boundChannelsOf(source).map((channel) => ({
      id: channel.id,
      /* The asset, not the sensor list. Sensor Explorer has no route that opens
         one named channel, and a link that lands on an unfiltered catalogue of
         every instrument in the plant is a link that has not answered the
         question the reader clicked with. */
      href: `/app/assets/${channel.assetId}`,
      cells: [
        text(channel.tag),
        text(channel.name),
        text(channel.unit),
        text(channel.key),
        text(channel.assetCode),
      ],
    })),
  }
}

/* ── Vision ───────────────────────────────────────────────────────────── */

/** `ISRA VISION · Can Inspect` → `ISRA`. The prefix a station id would carry. */
const stationPrefix = (name) =>
  name
    .split(/[\s·]+/)[0]
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7)

/**
 * One row per camera, bound to the asset it watches.
 *
 * The camera count is the source's own figure — the same number the table prints
 * in its Cameras column — and the stations are generated from it rather than
 * authored beside it, so a source cannot report eight cameras and list four.
 * Where a source watches several machines the cameras are dealt round them.
 */
function visionMapping(source) {
  const assets = source.assetIds ?? []
  const prefix = stationPrefix(source.name)

  return {
    columns: [{ id: 'camera', mono: true }, { id: 'asset', mono: true }, { id: 'line' }],
    rows: Array.from({ length: assets.length ? (source.tags ?? 0) : 0 }, (_, index) => {
      const assetId = assets[index % assets.length]
      const asset = nodeById.get(assetId)
      const line = asset ? nodeById.get(asset.parentId) : null
      return {
        id: `${source.id}:${index}`,
        href: `/app/assets/${assetId}`,
        cells: [
          text(`${prefix}-${String(index + 1).padStart(2, '0')}`),
          text(asset?.code ?? assetId),
          text(line?.name ?? null),
        ],
      }
    }),
  }
}

/* ── Business systems and stores ──────────────────────────────────────────
   These two families map ENTITIES rather than instruments, and which entities a
   system exposes is a property of the system rather than of anything counted
   elsewhere in this repository — so they are authored, keyed by source id so a
   row cannot end up under the wrong connection.

   What is not authored is where a row goes. `target` is a key into the pipelines
   module's own delivery map, which is the list of places in this product a
   pipeline can put something; a mapping row and a pipeline therefore cannot
   disagree about where work orders live. A row whose target is absent from that
   map does not render — it is reported as unconsumed. */

const ENTITY_ROWS = {
  conn_cmms: [
    ['EQUI', 'equipmentMaster', 'assetRegistry'],
    ['IFLOT', 'functionalLocations', 'assetRegistry'],
    ['AUFK / AFVC', 'workOrders', 'workOrders'],
    ['QMEL', 'notifications', 'anomalyEngine'],
    ['MPLA', 'maintenancePlans', null],
  ],
  conn_mes: [
    ['WIP_ORDERS', 'productionCounts', 'workOrders'],
    ['DOWNTIME_LOG', 'downtimeReasons', 'anomalyEngine'],
  ],
  src_s4hana: [
    ['MARA', 'materialMaster', null],
    ['MARD', 'partsInventory', null],
  ],
  src_influx: [
    ['ot_raw.vibration', 'measurements', 'knowledgeGraph'],
    ['ot_raw.temperature', 'measurements', 'knowledgeGraph'],
  ],
  src_pg_registry: [
    ['public.asset_registry', 'relationalTables', 'assetRegistry'],
    ['public.line_master', 'relationalTables', 'assetRegistry'],
  ],
  src_s3_docs: [
    ['s3://meridian-plant-docs/manuals/', 'objectPrefixes', 'copilotRetrieval'],
    ['s3://meridian-plant-docs/drawings/', 'objectPrefixes', 'copilotRetrieval'],
    ['s3://meridian-plant-docs/media/', 'objectPrefixes', 'mediaStore'],
  ],
}

function entityMapping(source) {
  const declared = ENTITY_ROWS[source.id] ?? []

  return {
    columns: [{ id: 'entity', mono: true }, { id: 'provides' }, { id: 'target' }],
    rows: declared
      .filter(([, , to]) => to && TARGETS[to])
      .map(([entity, provides, to]) => ({
        id: `${source.id}:${entity}`,
        href: TARGETS[to],
        cells: [text(entity), kind(provides), target(to)],
      })),
    /* Said out loud rather than filtered away. A connector that offers six entity
       types to a product that consumes four is a fact worth knowing before
       somebody spends a morning wondering where the spare parts went. */
    unconsumed: declared.filter(([, , to]) => !to || !TARGETS[to]).map(([, provides]) => provides),
  }
}

/* ── The one entry point ──────────────────────────────────────────────── */

const BY_CATEGORY = { ot: otMapping, vision: visionMapping, biz: entityMapping, db: entityMapping }

/**
 * What this connection is bound to, and what it is not.
 *
 * `blocked` is a reason rather than an empty table: a source nobody has given an
 * endpoint has nothing to bind, and a source in an OT family that does not
 * provide signals is not misconfigured — it is a gateway whose tags are waiting
 * on the Contextualisation queue. Those are different sentences and they send a
 * reader to different places.
 */
export function mappingFor(source) {
  const build = BY_CATEGORY[source.category]
  if (!build) return null

  if (source.status === 'notConfigured') {
    return { columns: [], rows: [], unconsumed: [], blocked: 'notConfigured' }
  }

  const { columns, rows, unconsumed = [] } = build(source)
  return {
    columns,
    rows,
    unconsumed,
    blocked:
      rows.length || unconsumed.length
        ? null
        : source.category === 'ot'
          ? 'notRoutedForSignals'
          : 'nothingBound',
  }
}

/* ── Write-back rules · business systems ──────────────────────────────────
   What Forge pushes INTO the system of record. Only offered where the connection
   is configured to write: a toggle that cannot take effect is a control that
   teaches a reader the screen is decorative.

   `object` is what Forge would create. Every one exists in this product, which is
   the same test the mapping rows pass. */

const WRITEBACK_RULES = [
  { id: 'createWorkOrder', object: 'workOrders', enabled: true },
  { id: 'updateWorkOrderStatus', object: 'workOrders', enabled: true },
  { id: 'postConfirmation', object: 'workOrders', enabled: false },
  { id: 'createNotification', object: 'anomalyEngine', enabled: true },
  { id: 'closeWorkOrder', object: 'workOrders', enabled: false },
  { id: 'reserveSpares', object: null, enabled: false },
]

/** id → { [ruleId]: boolean }. Session state, like the config overrides. */
const WRITEBACK_STATE = new Map()

export function writebackFor(source, direction) {
  if (source.category !== 'biz') return null
  return {
    /* Read from the connection's OWN config, not authored twice. Turning Sync
       direction to read-only on the Connection tab disables every rule here,
       which is what read-only means. */
    enabled: direction === 'biDirectional',
    /* A rule with nowhere to write is not offered as a toggle. `reserveSpares`
       would create a component reservation, and this product has no spare-part
       record to reserve — a switch that cannot do anything is worse than a
       sentence saying the connector could if there were somewhere to put it. */
    rules: WRITEBACK_RULES.filter((rule) => rule.object && TARGETS[rule.object]).map((rule) => ({
      id: rule.id,
      object: rule.object,
      href: TARGETS[rule.object],
      enabled: WRITEBACK_STATE.get(source.id)?.[rule.id] ?? rule.enabled,
    })),
    unavailable: WRITEBACK_RULES.filter((rule) => !rule.object || !TARGETS[rule.object]).length,
  }
}

export function setWritebackRule(id, ruleId, enabled) {
  if (!WRITEBACK_RULES.some((rule) => rule.id === ruleId)) return false
  WRITEBACK_STATE.set(id, { ...(WRITEBACK_STATE.get(id) ?? {}), [ruleId]: enabled })
  return true
}

/* ── ROI and recipes · vision ─────────────────────────────────────────────
   The regions are a picture of a camera frame, so they are authored coordinates
   and nothing pretends otherwise. Which recipe is RUNNING is not authored: it is
   the inspection program the Connection tab has selected, so changing that select
   changes this tab. The prototype marks one recipe active and one standby with no
   relationship to anything. */

const RECIPES = [
  { id: 'CAN-SEAM-QC-v4', threshold: 0.9 },
  { id: 'CAN-LABEL-v2', threshold: 0.8 },
  { id: 'CAN-DENT-DETECT-v3', threshold: 0.85 },
]

const REGIONS = [
  { id: 'seam', x: 18, y: 22, w: 30, h: 34 },
  { id: 'rim', x: 56, y: 30, w: 26, h: 28 },
  { id: 'body', x: 30, y: 62, w: 38, h: 24 },
]

export function roiFor(source, program) {
  if (source.category !== 'vision') return null
  return {
    regions: REGIONS,
    recipes: RECIPES.map((recipe) => ({ ...recipe, active: recipe.id === program })),
  }
}

/** For the checks and for a reload-free demo reset. */
export function resetFusionMapping() {
  WRITEBACK_STATE.clear()
}
