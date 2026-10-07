/**
 * Topline figures, the shift handover, and drafted work.
 *
 * SYNTHETIC. Every number here is authored, not measured. The handover object
 * is the spine of the public page: a real Forge AI surface, structured the way
 * a plant actually hands a shift over — outgoing summary in SQDCP order, the
 * alerts being carried, the actions still pending, and an acknowledgement by
 * the incoming lead.
 */

/** Shift windows, per PRODUCT.md's operating context. */
export const SHIFTS = [
  { id: 'morning', startHour: 6, endHour: 14 },
  { id: 'afternoon', startHour: 14, endHour: 22 },
  { id: 'night', startHour: 22, endHour: 6 },
]

/** Which shift a given local hour falls in. */
export function shiftForHour(hour) {
  if (hour >= 6 && hour < 14) return SHIFTS[0]
  if (hour >= 14 && hour < 22) return SHIFTS[1]
  return SHIFTS[2]
}

export const previousShift = (id) => {
  const order = ['morning', 'afternoon', 'night']
  return order[(order.indexOf(id) + 2) % 3]
}

export const TOPLINE = {
  scope: 'org_meridian',
  /**
   * `trend` is the eight-point sparkline the prototype draws beside the OEE
   * figure in the top bar. Authored like every other number here.
   *
   * It lives on the metric rather than in the component because a sparkline is
   * data: the day a real endpoint serves a rolling window, this field is what it
   * fills, and nothing about the bar changes.
   */
  oee: { value: 74.2, unit: '%', deltaPts: 1.4, trend: [72.6, 73.1, 71.9, 73.4, 74.8, 73.9, 74.6, 74.2] },
  mtbf: { value: 268, unit: 'h', deltaPts: 12 },
  mttr: { value: 4.1, unit: 'h', deltaPts: -0.3 },
  anomalies24h: { value: 22, deltaPts: -5 },
  openCritical: { value: 3 },
  sensorsMonitored: { value: 2560 },
  /** Cumulative hours of unplanned stoppage the platform's lead time avoided. */
  downtimeHoursAvoided: { value: 214, window: 'ytd' },
  earliestWarningHours: { value: 4.5 },
  daysWithoutIncident: { value: 142 },
}

export const SITE_HEALTH = [
  { siteId: 'site_findlay', oee: 71.8, health: 62, openAlerts: 8, criticalAlerts: 3, state: 'watch' },
  { siteId: 'site_weissenthurm', oee: 79.4, health: 84, openAlerts: 2, criticalAlerts: 0, state: 'running' },
  { siteId: 'site_pune', oee: 72.1, health: 77, openAlerts: 2, criticalAlerts: 0, state: 'running' },
]

/**
 * The shift handover. `outgoing` wrote the summary; `carried` names the alert
 * ids being handed across the boundary; `actions` are open items with an owner.
 * `acknowledgedAt: null` is the state the public page renders — the handover is
 * waiting to be taken.
 */
export const HANDOVER = {
  id: 'HND-2291',
  siteId: 'site_findlay',
  outgoing: { shift: 'afternoon', leadId: 'usr_rel_1', leadName: 'Ines Brandt', role: 'reliabilityEngineer' },
  incoming: { shift: 'night', leadId: 'usr_mgr_1', leadName: 'Dana Okafor', role: 'plantManager' },
  acknowledgedAt: null,

  /** Tier-1 huddle order: Safety, Quality, Delivery, Cost, People. */
  summary: [
    { key: 'safety', state: 'ok', note: 'noIncidents', figure: { value: 142, unit: 'd' } },
    { key: 'quality', state: 'watch', note: 'washerConductivityDrift', figure: { value: 98.6, unit: '%' } },
    { key: 'delivery', state: 'ok', note: 'lineOneHeldAtRate', figure: { value: 1840, unit: 'cpm' } },
    { key: 'cost', state: 'watch', note: 'bearingReplacementScheduled', figure: null },
    { key: 'people', state: 'ok', note: 'fullCrewNextShift', figure: { value: 11, unit: null } },
  ],

  carried: ['ALR-4471', 'ALR-4470', 'ALR-4465'],

  actions: [
    {
      id: 'ACT-881',
      kind: 'workOrder',
      refId: 'WO-7734',
      state: 'draftedByAi',
      alertId: 'ALR-4471',
      ownerId: 'usr_mgr_1',
      gate: 'loto',
    },
    {
      id: 'ACT-882',
      kind: 'inspection',
      refId: 'PM-Q-204',
      state: 'scheduled',
      alertId: 'ALR-4470',
      ownerId: 'usr_rel_1',
      gate: null,
    },
    {
      id: 'ACT-883',
      kind: 'permit',
      refId: 'PRM-1190',
      state: 'awaitingSignoff',
      alertId: 'ALR-4465',
      ownerId: 'usr_mgr_1',
      gate: 'hotWorkPermit',
    },
  ],

  /* What the outgoing lead physically observed used to be two notes typed here.
     It now comes from `fixtures/logbook.js`, which is the record those notes
     were a copy of — the agent treats a logbook entry as evidence because it
     captures what sensors cannot, and evidence held in two places is evidence
     that can disagree with itself. The `/v1/shifts/handover` handler reads the
     most recent entries off the log. */
}

/* ── Work orders ──────────────────────────────────────────────────────────
   Forge AI drafts; a human edits and commits into the CMMS.

   ── The lifecycle ──────────────────────────────────────────────────────
   Six states, which is the design's board. The two seeded orders predate the
   Work Orders module and carried `draft` and `released`; `released` is the same
   thing this now calls `approved` — signed off, not yet started — and it is
   renamed rather than kept alongside, because two words for one state is how a
   board ends up with a column nothing ever lands in.

   `onHold` is off the main line: it is reachable from `inProgress` and returns
   there, which is why it is not in `WO_NEXT` as anybody's successor.

   ── Why the titles of the first two are keys ───────────────────────────
   Those two are product copy — the AI drafted them and they are the same words
   on every demo — so they live in `app.json` under `workOrders.titles.*`.
   Anything a person types afterwards is DATA and is stored verbatim. Renderers
   look the stored value up under `workOrders.titles.*` with the raw string as
   the defaultValue, so a key resolves and free text passes straight through.

   Written out in prose rather than as a code sample on purpose: `verify:i18n`
   scans for translation calls and finds them inside comments too, so an example
   call here is reported as a missing key. */

/** The board's columns, in order. A work order is always in exactly one. */
export const WO_STATES = [
  'draft',
  'pendingApproval',
  'approved',
  'inProgress',
  'onHold',
  'completed',
]

/**
 * Where a work order goes next.
 *
 * `onHold` returns to `inProgress` rather than advancing, and nothing advances
 * INTO it — pausing is a decision, not a stage, so it is its own action on the
 * detail panel instead of a step somebody could walk into by clicking Move
 * twice.
 */
export const WO_NEXT = {
  draft: 'pendingApproval',
  pendingApproval: 'approved',
  approved: 'inProgress',
  inProgress: 'completed',
  onHold: 'inProgress',
  completed: null,
}

export const WO_PRIORITIES = ['urgent', 'high', 'medium', 'low']

/**
 * Whether a work order still needs somebody.
 *
 * Exported and used everywhere rather than written out as `state !== 'closed'`
 * at each call site, which is what the asset screens did. That test was true of
 * every order in the fixture — no order was ever `closed` — so the counts were
 * right by accident. Adding completed orders to the board would have quietly
 * inflated every "open work orders" figure in Lines & Assets.
 */
export const isOpenOrder = (order) => order.state !== 'completed'

export const WORK_ORDERS = [
  {
    id: 'WO-7734',
    alertId: 'ALR-4471',
    assetId: 'FDY-BM-03',
    siteId: 'site_findlay',
    title: 'replaceDischargeBearing',
    priority: 'urgent',
    state: 'draft',
    authoredBy: 'ai',
    // An AI draft has nobody on it yet — that is the decision the draft is
    // waiting for, and putting a name on it would make the board's "Draft"
    // column look worked.
    assigneeId: null,
    dueInDays: 0,
    estimateHours: 3.5,
    windowStart: 'nextPlannedStop',
    parts: [
      { sku: 'BRG-6312-C3', qty: 1, onHand: 2 },
      { sku: 'SEAL-3120', qty: 2, onHand: 6 },
    ],
    gates: ['loto', 'guardInterlock'],
    writeBack: { system: 'cmms', transaction: 'orderCreate', status: 'pending' },
  },
  {
    id: 'WO-7731',
    alertId: 'ALR-4470',
    assetId: 'FDY-CMP-12',
    siteId: 'site_findlay',
    title: 'inspectCoolantFlowSwitch',
    priority: 'high',
    state: 'approved',
    authoredBy: 'human',
    assigneeId: 'usr_rel_1',
    dueInDays: 1,
    estimateHours: 1.0,
    windowStart: 'immediate',
    parts: [],
    gates: ['loto'],
    writeBack: { system: 'cmms', transaction: 'orderCreate', status: 'confirmed' },
  },

  /* ── The rest of the board ──────────────────────────────────────────────
     Eight more, so the six columns hold something and the module is worth
     opening. Every one of them names an asset that exists in `HIERARCHY_NODES`,
     and the four that reference an anomaly name a real open alert — the asset's
     own Work Orders tab and the anomaly list are the same records seen from two
     directions.

     `dueInDays` and not a date, for the reason `detectedMinutesAgo` is minutes:
     a date typed here is last month's date by the next demo. The handler
     resolves it to an instant. Negative means overdue, which the board needs at
     least one of to be honest about what a maintenance backlog looks like. */
  {
    id: 'WO-7736',
    alertId: 'ALR-4465',
    assetId: 'FDY-OVN-01',
    siteId: 'site_findlay',
    title: 'Recalibrate Zone 3 burner thermocouple',
    priority: 'urgent',
    state: 'inProgress',
    authoredBy: 'ai',
    assigneeId: 'usr_rel_1',
    dueInDays: 0,
    estimateHours: 2.5,
    windowStart: 'immediate',
    parts: [{ sku: 'TC-K-450', qty: 1, onHand: 3 }],
    gates: ['hotWorkPermit', 'loto'],
    writeBack: { system: 'cmms', transaction: 'orderCreate', status: 'confirmed' },
  },
  {
    id: 'WO-7735',
    alertId: 'ALR-4460',
    assetId: 'FDY-WSH-01',
    siteId: 'site_findlay',
    title: 'Drain and recharge wash tank — conductivity out of band',
    priority: 'high',
    state: 'pendingApproval',
    authoredBy: 'ai',
    assigneeId: 'usr_ops_1',
    dueInDays: 2,
    estimateHours: 4.0,
    windowStart: 'nextPlannedStop',
    parts: [{ sku: 'FLT-9040', qty: 2, onHand: 0 }],
    gates: ['loto', 'confinedSpace'],
    writeBack: { system: 'cmms', transaction: 'orderCreate', status: 'pending' },
  },
  {
    id: 'WO-7733',
    alertId: 'ALR-4463',
    assetId: 'FDY-DEC-02',
    siteId: 'site_findlay',
    title: 'Replace ink pump relief valve',
    priority: 'high',
    state: 'onHold',
    // On hold because a part is not on the shelf — the reason is a fact the
    // parts list already carries, so the detail panel derives it rather than
    // being told.
    authoredBy: 'human',
    assigneeId: 'usr_ops_1',
    dueInDays: -2,
    estimateHours: 1.5,
    windowStart: 'nextPlannedStop',
    parts: [{ sku: 'VLV-RP-22', qty: 1, onHand: 0 }],
    gates: ['loto'],
    writeBack: { system: 'cmms', transaction: 'orderCreate', status: 'pending' },
  },
  {
    id: 'WO-7732',
    alertId: null,
    assetId: 'FDY-TRM-01',
    siteId: 'site_findlay',
    title: 'Quarterly preventive maintenance',
    priority: 'medium',
    state: 'approved',
    authoredBy: 'human',
    assigneeId: 'usr_ops_1',
    dueInDays: 6,
    estimateHours: 3.0,
    windowStart: 'nextPlannedStop',
    parts: [],
    gates: ['loto'],
    writeBack: { system: 'cmms', transaction: 'orderCreate', status: 'confirmed' },
  },
  {
    id: 'WO-7730',
    alertId: null,
    assetId: 'FDY-PAL-02',
    siteId: 'site_findlay',
    title: 'Re-tension gripper drive belt',
    priority: 'low',
    state: 'draft',
    authoredBy: 'human',
    assigneeId: null,
    dueInDays: 9,
    estimateHours: 0.5,
    windowStart: 'nextPlannedStop',
    parts: [],
    gates: [],
    writeBack: { system: 'cmms', transaction: 'orderCreate', status: 'pending' },
  },
  {
    id: 'WO-7729',
    alertId: null,
    assetId: 'FDY-CHL-02',
    siteId: 'site_findlay',
    title: 'Top up refrigerant and leak-test the circuit',
    priority: 'medium',
    state: 'inProgress',
    authoredBy: 'human',
    assigneeId: 'usr_rel_1',
    dueInDays: 1,
    estimateHours: 2.0,
    windowStart: 'immediate',
    parts: [{ sku: 'REF-410A', qty: 4, onHand: 12 }],
    gates: ['loto'],
    writeBack: { system: 'cmms', transaction: 'orderCreate', status: 'confirmed' },
  },
  {
    id: 'WO-7726',
    alertId: null,
    assetId: 'FDY-BM-07',
    siteId: 'site_findlay',
    title: 'Replace drive-end bearing',
    priority: 'high',
    state: 'completed',
    authoredBy: 'ai',
    assigneeId: 'usr_rel_1',
    dueInDays: -5,
    estimateHours: 3.5,
    windowStart: 'nextPlannedStop',
    parts: [{ sku: 'BRG-6312-C3', qty: 1, onHand: 2 }],
    gates: ['loto', 'guardInterlock'],
    writeBack: { system: 'cmms', transaction: 'orderClose', status: 'confirmed' },
  },
  {
    id: 'WO-7724',
    alertId: null,
    assetId: 'FDY-CUP-01',
    siteId: 'site_findlay',
    title: 'Inspect cup draw tooling for wear',
    priority: 'low',
    state: 'completed',
    authoredBy: 'human',
    assigneeId: 'usr_ops_1',
    dueInDays: -9,
    estimateHours: 1.0,
    windowStart: 'nextPlannedStop',
    parts: [],
    gates: ['loto'],
    writeBack: { system: 'cmms', transaction: 'orderClose', status: 'confirmed' },
  },
]

/* Orders created through the New WO dialog. Module scope, so they survive the
   session and appear on the board exactly as the seeded ones do. Same
   arrangement as the uploaded documents register and the created charts. */
const CREATED_ORDERS = []

/** Every work order, newest first. */
export const allWorkOrders = () => [...CREATED_ORDERS, ...WORK_ORDERS]

/**
 * Create one.
 *
 * The id is the next number above the highest that exists, NOT the prototype's
 * `"WO-" + (4400 + Math.floor(Math.random() * 580))`, which can collide with a
 * seeded order and gives a different answer every time it runs.
 *
 * `authoredBy` is forced to `human`. The prototype's form offers Source as a
 * select with AI in it, so anybody can mark their own order AI-generated —
 * which is a provenance claim, and provenance is recorded, not chosen. The AI
 * badge on this board means Forge AI drafted the order.
 */
export function addWorkOrder(input) {
  const highest = allWorkOrders().reduce((max, order) => {
    const number = Number(String(order.id).replace(/\D/g, ''))
    return Number.isFinite(number) ? Math.max(max, number) : max
  }, 0)
  const order = {
    id: `WO-${highest + 1}`,
    alertId: input.alertId ?? null,
    assetId: input.assetId,
    siteId: input.siteId ?? 'site_findlay',
    title: (input.title ?? '').trim(),
    priority: WO_PRIORITIES.includes(input.priority) ? input.priority : 'medium',
    state: 'draft',
    authoredBy: 'human',
    assigneeId: input.assigneeId || null,
    dueInDays: Number.isFinite(Number(input.dueInDays)) ? Number(input.dueInDays) : 7,
    estimateHours: Number(input.estimateHours) || 1,
    windowStart: 'nextPlannedStop',
    parts: [],
    gates: [],
    writeBack: { system: 'cmms', transaction: 'orderCreate', status: 'pending' },
    created: true,
  }
  CREATED_ORDERS.unshift(order)
  return order
}

/** Edit one in place. Only the fields a form may set. */
export function updateWorkOrder(id, patch) {
  const order = allWorkOrders().find((entry) => entry.id === id)
  if (!order) return null
  for (const key of ['title', 'priority', 'assigneeId', 'dueInDays', 'estimateHours', 'state']) {
    if (patch[key] !== undefined) order[key] = patch[key]
  }
  if (patch.title !== undefined) order.title = String(patch.title).trim()
  return order
}

/** Remove one. Returns whether there was anything to remove. */
export function removeWorkOrder(id) {
  for (const list of [CREATED_ORDERS, WORK_ORDERS]) {
    const index = list.findIndex((entry) => entry.id === id)
    if (index >= 0) {
      list.splice(index, 1)
      return true
    }
  }
  return false
}

/**
 * Connectors declare what they provide AND what they do not. The explicit
 * negative is the differentiating part — an historian is not a maintenance
 * record, and the platform says so rather than letting a user assume.
 */
export const CONNECTORS = [
  {
    id: 'conn_historian',
    family: 'otHistorian',
    protocol: 'OPC-UA',
    state: 'connected',
    provides: ['signals', 'assetTags', 'alarmEvents'],
    doesNotProvide: ['maintenanceRecords', 'workOrders', 'partsInventory'],
    tags: 2560,
    lastSyncMinutesAgo: 1,
  },
  {
    id: 'conn_cmms',
    family: 'cmms',
    protocol: 'REST',
    state: 'connected',
    provides: ['workOrders', 'equipmentMaster', 'partsInventory', 'notifications'],
    doesNotProvide: ['timeSeries', 'sensorTags'],
    tags: null,
    lastSyncMinutesAgo: 14,
  },
  {
    id: 'conn_mes',
    family: 'mes',
    protocol: 'Modbus TCP',
    state: 'degraded',
    provides: ['productionCounts', 'downtimeReasons', 'productChangeovers'],
    doesNotProvide: ['vibration', 'maintenanceRecords'],
    tags: 310,
    lastSyncMinutesAgo: 46,
  },
]
