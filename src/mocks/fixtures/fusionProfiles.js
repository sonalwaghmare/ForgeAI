import { HIERARCHY_NODES } from './hierarchy'
import {
  ALL_FUSION_SOURCES,
  FUSION_CATEGORIES,
  addFusionSource,
  setSourceField,
  statusOf,
} from './fusion'
import { SCHEDULES } from './fusionPipelines'
import { audit } from './audit'

/**
 * Data Fusion — what each source family actually is.
 *
 * SYNTHETIC, like everything in this directory. Gated on `VITE_DEMO_MODE`.
 * See `DEMO-MODE.md` §8.10.
 *
 * ── One profile per family, and no profile for IoT ────────────────────────
 * The prototype carries five, including `iot`. That section is built against the
 * real `/v1/connections` resource and its connector types come from
 * `/v1/connections/connector-types` — an authored profile here would be a second,
 * fictional description of a family the API already describes, and the first
 * thing to go wrong is the two disagreeing about what MQTT ingests.
 *
 * ── The contract is spoken in the vocabulary the landing page already uses ─
 * `common:dataKinds` is where "Work orders" and "Time series" are named, because
 * the public source-contract section prints them. A family here declares what it
 * provides and what it does not out of that same vocabulary rather than as
 * sentences — so "provides work orders" means one thing in this product, and a
 * reader who has seen the public page recognises the words.
 *
 * The three ANCHORS do not use these lists at all: `CONNECTORS` already states
 * their contract and the landing page prints it. They keep theirs. Only the
 * sources this module invented fall back to the family profile.
 *
 * ── A credential is never a value in this file ────────────────────────────
 * The prototype puts `["Client secret","••••••••••••","text"]` in its schema — a
 * text input, pre-filled, that a browser will happily offer to autofill and a
 * screen-share will happily show. A `secret` field here carries NO value: it
 * reports whether one is set and when, accepts a new one, and stores only the
 * fact that it was replaced. There is nowhere in this repository for the value to
 * be, which is the only arrangement that stays true when somebody copies this
 * fixture as the shape of the real payload.
 */

/* ── Field constructors ───────────────────────────────────────────────────
   An option is either a term from the protocol's own specification —
   `Basic256Sha256`, `SignAndEncrypt`, `verify-full` — or a phrase. The first
   kind is a machine identifier: it is not translated in any product, it is what
   the server expects on the wire, and translating it would be a bug. The second
   kind is prose and takes a key like everything else.

   `spec()` and `phrase()` are what make the difference legible at the schema
   rather than leaving the next reader to guess which strings are safe to
   localise. */
const spec = (...values) => values.map((value) => ({ value }))
const phrase = (...values) => values.map((value) => ({ value, translate: true }))

/** A field whose value is held in the source registry, not in this schema. */
const bound = (id, key, extra = {}) => ({ id, type: 'text', bind: key, mono: true, ...extra })

export const INGEST_PROFILES = {
  ot: {
    provides: ['signals', 'assetTags', 'engineeringUnits', 'qualityCodes', 'alarmEvents'],
    doesNotProvide: ['maintenanceRecords', 'workOrders', 'partsInventory'],
    config: [
      bound('endpointUrl', 'endpoint'),
      { id: 'securityPolicy', type: 'select', value: 'Basic256Sha256',
        options: spec('None', 'Basic128Rsa15', 'Basic256', 'Basic256Sha256', 'Aes256Sha256RsaPss') },
      { id: 'messageSecurityMode', type: 'select', value: 'SignAndEncrypt',
        options: spec('None', 'Sign', 'SignAndEncrypt') },
      { id: 'clientCertificate', type: 'file', value: 'forge-client.der' },
      { id: 'applicationUri', type: 'text', mono: true, value: 'urn:forge:opcua:client' },
      { id: 'namespaceIndex', type: 'text', value: '2' },
      { id: 'rootBrowsePath', type: 'text', mono: true, value: 'Objects/PLC_1/DataBlocksGlobal' },
      { id: 'readMode', type: 'select', value: 'subscribe',
        options: phrase('subscribe', 'polled', 'historical') },
      { id: 'publishingInterval', type: 'select', value: 'ms250',
        options: phrase('ms100', 'ms250', 'ms500', 's1', 's5') },
      { id: 'deadband', type: 'select', value: 'percent05',
        options: phrase('none', 'absolute01', 'percent05', 'percent2') },
      { id: 'timestampSource', type: 'select', value: 'source',
        options: phrase('source', 'server') },
      { id: 'maxMonitoredItems', type: 'text', value: '4000' },
      { id: 'storeQualityCodes', type: 'toggle', value: true },
    ],
  },

  vision: {
    provides: ['inspectionVerdicts', 'defectClasses', 'roiMeasurements', 'frameCaptures', 'thermalFrames'],
    doesNotProvide: ['rawVideo', 'timeSeries', 'maintenanceRecords'],
    config: [
      bound('streamUrl', 'endpoint'),
      { id: 'eventApiEndpoint', type: 'text', mono: true, value: 'https://isra.fdy.meridian.internal/api/v2/events' },
      { id: 'stationId', type: 'text', mono: true, value: 'CAM-L3-01' },
      { id: 'inspectionProgram', type: 'select', value: 'CAN-SEAM-QC-v4',
        options: spec('CAN-SEAM-QC-v4', 'CAN-LABEL-v2', 'CAN-DENT-DETECT-v3') },
      { id: 'frameRate', type: 'select', value: 'fps30',
        options: phrase('fps10', 'fps15', 'fps30', 'fps60') },
      { id: 'triggerMode', type: 'select', value: 'hardware',
        options: phrase('freeRun', 'hardware', 'software') },
      { id: 'confidenceThreshold', type: 'text', value: '0.85' },
      { id: 'roiDefinition', type: 'file', value: 'roi-can-seam.json' },
      { id: 'eventWebhook', type: 'text', mono: true, value: 'https://forge.meridian.internal/hooks/vision' },
      { id: 'storeFrameOnDefect', type: 'toggle', value: true },
      { id: 'imageRetention', type: 'select', value: 'd30', options: phrase('d7', 'd30', 'd90', 'y1') },
      { id: 'thermalRoiStats', type: 'select', value: 'minMaxMean',
        options: phrase('off', 'maxOnly', 'minMaxMean') },
    ],
  },

  biz: {
    provides: [
      'equipmentMaster', 'functionalLocations', 'workOrders', 'notifications',
      'maintenancePlans', 'materialMaster', 'productionCounts', 'downtimeReasons',
    ],
    doesNotProvide: ['timeSeries', 'sensorTags', 'vibration'],
    config: [
      bound('serviceRoot', 'endpoint'),
      { id: 'systemId', type: 'text', value: 'PRD' },
      { id: 'clientCode', type: 'text', value: '100' },
      { id: 'plantCodes', type: 'text', value: '1000, 1200' },
      { id: 'authentication', type: 'select', value: 'oauthClient',
        options: phrase('oauthClient', 'basic', 'x509', 'samlBearer') },
      { id: 'tokenEndpoint', type: 'text', mono: true, value: 'https://sap-pm.meridian.corp/oauth/token' },
      { id: 'clientId', type: 'text', value: 'forge-integration' },
      { id: 'clientSecret', type: 'secret' },
      { id: 'syncDirection', type: 'select', value: 'biDirectional',
        options: phrase('readOnly', 'biDirectional') },
      { id: 'deltaMechanism', type: 'select', value: 'changePointers',
        options: phrase('changePointers', 'timestampField', 'fullReload') },
      { id: 'batchPageSize', type: 'text', value: '500' },
      { id: 'languageKey', type: 'select', value: 'EN', options: spec('EN', 'DE', 'ES', 'FR', 'JA') },
      { id: 'createAssetsFromEquipment', type: 'toggle', value: true },
    ],
  },

  db: {
    provides: ['measurements', 'relationalTables', 'objectPrefixes', 'historicalBackfill'],
    doesNotProvide: ['alarmEvents', 'workOrders', 'qualityCodes'],
    /* No driver field, deliberately. The design offers a Driver select here, but
       the protocol is already on the row above and on the drawer's own header,
       and `/v1/connections` states outright that `connector_type_id` is not
       updatable — a connection cannot change protocol. Offering the choice would
       be offering an edit the real resource refuses. */
    config: [
      bound('hostPort', 'endpoint'),
      { id: 'organisation', type: 'text', value: 'forge-plant' },
      { id: 'bucket', type: 'text', value: 'ot_raw' },
      { id: 'authentication', type: 'select', value: 'apiToken',
        options: phrase('apiToken', 'userPassword', 'iamRole', 'managedIdentity') },
      { id: 'token', type: 'secret' },
      { id: 'readMode', type: 'select', value: 'continuousQuery',
        options: phrase('continuousQuery', 'scheduledQuery', 'prefixScan') },
      { id: 'query', type: 'textarea', mono: true,
        value: 'from(bucket: "ot_raw")\n  |> range(start: -5m)' },
      { id: 'incrementalColumn', type: 'text', mono: true, value: '_time' },
      { id: 'sslMode', type: 'select', value: 'require',
        options: spec('disable', 'prefer', 'require', 'verify-full') },
      { id: 'backfillWindow', type: 'select', value: 'd90',
        options: phrase('none', 'd7', 'd30', 'd90', 'y1') },
    ],
  },
}

export const profileFor = (category) => INGEST_PROFILES[category] ?? null

/* ── Session state ────────────────────────────────────────────────────────
   Module-level, like the context decisions and the pipeline overrides. A change
   has to survive closing the drawer or Save is a button that lies. Resets on
   reload, which is the right lifetime for a demo. */

/** id → { [fieldId]: value }. Only fields the reader actually changed. */
const CONFIG_STATE = new Map()

/** id → events this session, newest last. Saves and tests, nothing invented. */
const EVENTS = new Map()

const eventsOf = (id) => EVENTS.get(id) ?? []

function record(id, event) {
  EVENTS.set(id, [...eventsOf(id), event])
}

/**
 * The config form for one source: the schema, with every value resolved.
 *
 * A bound field reads the registry rather than this file. That is what stops the
 * endpoint existing in two places — the drawer shows the same string the table
 * does, and saving a new one changes the table.
 */
export function configFor(source) {
  const profile = profileFor(source.category)
  if (!profile) return []
  const overrides = CONFIG_STATE.get(source.id) ?? {}

  return profile.config.map((field) => {
    if (field.type === 'secret') {
      const set = Object.hasOwn(overrides, field.id)
      return { ...field, value: null, set, setAt: set ? overrides[field.id] : null }
    }
    const value = field.bind ? (source[field.bind] ?? '') : field.value
    return { ...field, value: Object.hasOwn(overrides, field.id) ? overrides[field.id] : value }
  })
}

/**
 * Apply an edit.
 *
 * A bound field is written back to the registry, not to the override map: the
 * endpoint belongs to the source, and holding a second copy here would let the
 * drawer and the table disagree about it. Everything else is a value only this
 * screen has an opinion about, so it lives in the override map.
 *
 * A secret's VALUE is discarded on arrival. What is kept is the timestamp — the
 * one fact about a credential this product has any business remembering.
 */
export function saveConfig(id, values, now = Date.now()) {
  const source = ALL_FUSION_SOURCES().find((entry) => entry.id === id)
  const profile = source ? profileFor(source.category) : null
  if (!source || !profile) return null

  const overrides = { ...(CONFIG_STATE.get(id) ?? {}) }
  let changed = 0

  for (const field of profile.config) {
    if (!Object.hasOwn(values, field.id)) continue
    const next = values[field.id]

    if (field.type === 'secret') {
      if (!next) continue
      overrides[field.id] = new Date(now).toISOString()
      changed += 1
      continue
    }
    if (field.bind) {
      /* Written back to the registry, never held here. The anchors are rebuilt
         from `CONNECTORS` on every read, so a copy in this file would be
         overwritten on the next request and the drawer would appear to forget
         the edit the moment the table refreshed. */
      const clean = typeof next === 'string' ? next.trim() : next
      if ((source[field.bind] ?? null) === (clean || null)) continue
      setSourceField(source.id, field.bind, clean || null)
      changed += 1
      continue
    }
    const current = Object.hasOwn(overrides, field.id) ? overrides[field.id] : field.value
    if (current === next) continue
    overrides[field.id] = next
    changed += 1
  }

  CONFIG_STATE.set(id, overrides)
  if (changed) {
    record(id, { kind: 'configUpdated', at: new Date(now).toISOString(), changed })
    audit('CONNECTION_CHANGED', { resource: `source:${id}`, detail: { fields: changed } }, now)
    if (profile.config.some((field) => field.type === 'secret' && values[field.id])) {
      audit('CREDENTIAL_ROTATED', { resource: `source:${id}` }, now)
    }
  }
  return { id, changed }
}

/**
 * What happened on this connection, derived from its own clock.
 *
 * The prototype hand-writes five lines beginning "just now · Sync completed",
 * and prints them under a connection its own table marks Disconnected. Here the
 * log is generated from the state: a source that has stopped shows failures since
 * it stopped and the last sync that worked before that, a source that is late
 * shows the gap, and a source nobody configured shows nothing at all — because
 * nothing has happened to it.
 *
 * The only authored entries are the ones the reader caused this session: a save
 * and a test. Which makes this tab the place where an action in the drawer leaves
 * a trace, rather than a list of plausible past events.
 */
export function activityFor(source, now = Date.now()) {
  const status = statusOf(source)
  const sla = source.slaMinutes ?? 60
  const lastSync = source.lastSyncMinutesAgo
  const at = (minutesAgo) => new Date(now - minutesAgo * 60_000).toISOString()
  const unit = FUSION_CATEGORIES.find((entry) => entry.id === source.category)?.unit ?? 'tags'

  const derived = []
  if (status !== 'notConfigured' && lastSync != null) {
    if (status === 'disconnected') {
      /* Retries since it stopped, at its own SLA cadence — capped at three so a
         source that has been down two days does not return six hundred rows
         saying the same thing. */
      for (let attempt = 0; attempt < 3; attempt += 1) {
        derived.push({ kind: 'syncFailed', at: at(attempt * sla), reason: source.error })
      }
      derived.push({ kind: 'syncCompleted', at: at(lastSync), count: source.tags, unit })
    } else if (status === 'syncing') {
      derived.push({ kind: 'syncStarted', at: at(lastSync) })
      for (let back = 1; back <= 3; back += 1) {
        derived.push({ kind: 'syncCompleted', at: at(lastSync + back * sla), count: source.tags, unit })
      }
    } else {
      for (let back = 0; back <= 3; back += 1) {
        derived.push({ kind: 'syncCompleted', at: at(lastSync + back * sla), count: source.tags, unit })
      }
    }
  }

  return [...eventsOf(source.id), ...derived].sort((a, b) => b.at.localeCompare(a.at))
}

/**
 * Test the connection, and answer with what is actually true.
 *
 * Not a spinner that always ends green. A source nobody configured has nothing to
 * test; a source that is disconnected fails with the reason its own row prints.
 * A test that succeeded on the ABB gateway while the table beside it said TLS
 * handshake failed would teach a reader to stop believing one of the two.
 */
export function testSource(id, now = Date.now()) {
  const source = ALL_FUSION_SOURCES().find((entry) => entry.id === id)
  if (!source) return null

  const status = statusOf(source)
  const unit = FUSION_CATEGORIES.find((entry) => entry.id === source.category)?.unit ?? 'tags'
  const result =
    status === 'notConfigured'
      ? { ok: false, reason: 'notConfigured' }
      : status === 'disconnected'
        ? { ok: false, reason: source.error }
        : { ok: true, objects: source.tags ?? 0, unit, latencyMs: source.latencyMs ?? null }

  record(id, { kind: 'connectionTested', at: new Date(now).toISOString(), ok: result.ok })
  return { id, ...result }
}

/** For the checks and for a reload-free demo reset. */
export function resetFusionConfig() {
  CONFIG_STATE.clear()
  EVENTS.clear()
}

/* ══ THE CONNECT WIZARD ══════════════════════════════════════════════════
   Four steps: pick a connector, configure it, test it, scope and schedule it.
   What comes out the far end is a row in the registry — not a toast.

   ── The catalogue decides the protocol, and nothing later can change it ──
   Picking "Rockwell FactoryTalk" is picking ODBC. That is why the drawer offers
   no way to change a protocol afterwards and why Databases & Cloud has no driver
   select: `/v1/connections` states outright that `connector_type_id` is not
   updatable, and the demo families obey the rule the live resource does.

   Vendor product names are proper nouns and stay as they are in every locale,
   which is why this is the one table here that holds strings rather than keys. */

export const CONNECTOR_CATALOGUE = {
  ot: [
    ['Siemens SIMATIC S7', 'OPC-UA'],
    ['Rockwell FactoryTalk', 'ODBC'],
    ['OSIsoft PI', 'PI Web API'],
    ['Honeywell Experion', 'OPC-DA'],
    ['ABB System 800xA', 'OPC-UA'],
    ['AspenTech IP.21', 'SQLplus'],
    ['AVEVA Historian', 'OLEDB'],
    ['Generic OPC-UA server', 'OPC-UA'],
  ],
  vision: [
    ['ISRA VISION', 'gRPC'],
    ['Cognex In-Sight', 'REST'],
    ['Keyence CV-X', 'REST'],
    ['Thermal camera', 'RTSP'],
    ['Generic GigE Vision', 'GenICam'],
  ],
  biz: [
    ['SAP Plant Maintenance', 'OData v2'],
    ['SAP S/4HANA', 'OData v4'],
    ['Oracle MES', 'REST'],
    ['IBM Maximo', 'Maximo REST'],
    ['Infor EAM', 'SOAP'],
    ['Microsoft Dynamics 365', 'OData'],
    ['Generic CMMS', 'REST'],
  ],
  db: [
    ['InfluxDB v2', 'Influx v2'],
    ['TimescaleDB', 'JDBC'],
    ['PostgreSQL', 'JDBC'],
    ['MS SQL Server', 'JDBC'],
    ['Snowflake', 'JDBC'],
    ['AWS S3', 'S3'],
    ['Azure Blob Storage', 'Azure SDK'],
  ],
}

export const catalogueFor = (category) =>
  (CONNECTOR_CATALOGUE[category] ?? []).map(([name, protocol]) => ({ name, protocol }))

/**
 * The fields the wizard asks for.
 *
 * Not all of them. The design shows the first eight of thirteen, which is an
 * arbitrary cut; this is the ones a connection cannot exist without, and the rest
 * take their schema defaults and are editable in the drawer the moment it is
 * created. The wizard says so rather than leaving somebody to discover that five
 * fields they never saw have values.
 */
const ESSENTIAL = {
  ot: ['endpointUrl', 'securityPolicy', 'readMode'],
  vision: ['streamUrl', 'stationId', 'inspectionProgram'],
  biz: ['serviceRoot', 'authentication', 'clientId'],
  db: ['hostPort', 'organisation', 'bucket', 'authentication'],
}

export function wizardFieldsFor(category) {
  const profile = profileFor(category)
  if (!profile) return []
  const wanted = ESSENTIAL[category] ?? []
  return profile.config
    .filter((field) => wanted.includes(field.id))
    .map((field) => ({ ...field, value: field.bind ? '' : field.value }))
}

/**
 * What a test finds when it reaches the far end.
 *
 * A sample of the address space, which is a property of the connector type
 * rather than of anything counted in this repository — a browsable node tree, a
 * set of OData entity sets, a bucket's measurements, a camera list. Four entries,
 * as a sample is.
 *
 * The COUNT is not here, deliberately. How many objects this connection will
 * carry depends on what it is scoped to, and that is the next step — reporting a
 * total before the scope is chosen is what lets the prototype say "847 browsable
 * nodes" and then create a source with a different number on it.
 */
const DISCOVERY = {
  ot: [
    ['Objects/PLC_1/DataBlocksGlobal', 'folder'],
    ['Objects/PLC_1/DB_Process', 'folder'],
    ['Objects/PLC_1/DB_Process/AI', 'analog'],
    ['Objects/PLC_1/DB_Process/DI', 'digital'],
  ],
  vision: [
    ['station/01', 'camera'],
    ['station/02', 'camera'],
    ['programs/', 'folder'],
    ['events/', 'stream'],
  ],
  biz: [
    ['EquipmentSet', 'entitySet'],
    ['FunctionalLocationSet', 'entitySet'],
    ['MaintenanceOrderSet', 'entitySet'],
    ['NotificationSet', 'entitySet'],
  ],
  db: [
    ['ot_raw.vibration', 'measurement'],
    ['ot_raw.temperature', 'measurement'],
    ['public.asset_registry', 'table'],
    ['public.downtime_log', 'table'],
  ],
}

/**
 * Probe an endpoint the wizard has not created yet.
 *
 * Fails on an empty endpoint and on nothing else — there is no far end to be
 * unreachable, and inventing an occasional failure would make the wizard a
 * coin toss rather than a demonstration. The failure that IS real is the one in
 * the drawer, where a source has a state to be in.
 */
export function probeConnector(category, endpoint) {
  if (!endpoint || !String(endpoint).trim()) return { ok: false, reason: 'noEndpoint' }
  return {
    ok: true,
    objects: (DISCOVERY[category] ?? []).map(([name, kind]) => ({ name, kind })),
  }
}

/* ── Scope ────────────────────────────────────────────────────────────────
   What the connection will actually read. For a gateway that is a production
   line, and the assets on it are what the source ends up declaring — so its site
   derives from them the same way every other source's does, rather than being
   picked from a second select that could disagree.

   An enterprise system reads no assets at all, which is why SAP has no plant.
   Offering it a line would be offering a wrong answer. */

const ENTERPRISE_CATEGORIES = ['biz', 'db']

export const scopesAssets = (category) => !ENTERPRISE_CATEGORIES.includes(category)

/** The lines a new gateway could be pointed at, with what each would bring. */
export function scopeOptionsFor(category) {
  if (!scopesAssets(category)) return []
  return HIERARCHY_NODES.filter((node) => node.tier === 'line').map((line) => {
    const site = HIERARCHY_NODES.find((node) => node.id === line.parentId)
    const assets = HIERARCHY_NODES.filter((node) => node.parentId === line.id).map(
      (node) => node.id,
    )
    return {
      id: line.id,
      name: line.name,
      siteName: site?.name ?? null,
      assets,
      objects: assets.length * OBJECTS_PER_ASSET[category],
    }
  })
}

/* What one machine contributes. A historian publishes a few hundred tags per
   machine; a cell has one or two cameras on it. Both are assumptions, and they
   are the only two in the wizard — every other figure it reports is arithmetic
   on top of them and on the estate's own asset count. */
const OBJECTS_PER_ASSET = { ot: 180, vision: 2 }

/** What an enterprise system would carry. Flat, because it reads no machines. */
const ENTERPRISE_OBJECTS = { biz: 4820, db: 14 }

export const enterpriseObjectsFor = (category) => ENTERPRISE_OBJECTS[category] ?? 0

/**
 * The sync schedules a source can be put on, as SLA minutes.
 *
 * Read from the pipelines module's own schedule table rather than restated, so a
 * source and a pipeline cannot mean different things by "hourly". `onUpload` is
 * left out: it is a trigger a pipeline has and a connection does not.
 */
export const SOURCE_SCHEDULES = ['realtime', 'halfHourly', 'hourly', 'daily']

export const slaForSchedule = (key) => SCHEDULES[key] ?? null

/**
 * Create it.
 *
 * The object count follows the scope rather than being carried over from the
 * test, which is what stops a connection reporting one figure while it was
 * discovering and another once it exists.
 */
export function createSource({ category, connector, protocol, name, endpoint, lineId, schedule, values }, now = Date.now()) {
  if (!catalogueFor(category).some((entry) => entry.name === connector)) return null

  const scope = scopeOptionsFor(category).find((option) => option.id === lineId) ?? null
  const record = addFusionSource({
    name: name?.trim() || connector,
    category,
    protocol,
    endpoint,
    assets: scope?.assets ?? [],
    objects: scope ? scope.objects : (ENTERPRISE_OBJECTS[category] ?? 0),
    slaMinutes: slaForSchedule(schedule),
  })

  /* Whatever the wizard collected, through the same path the drawer's Save uses
     — so a field set here and a field set there end up in one place, and the
     drawer opens on the values the wizard was given rather than on defaults. */
  if (values && Object.keys(values).length) saveConfig(record.id, values, now)
  return { id: record.id }
}
