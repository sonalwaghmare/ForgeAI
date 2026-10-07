import { config } from '@/services/config'
import { ANOMALY_DEMO_FACETS } from './fixtures/anomalyFacets'
import { ORG, currentSites, PEOPLE, CURRENT_USER } from './fixtures/enterprise'
import { HIERARCHY_NODES, TIERS, buildScopes, buildTree } from './fixtures/hierarchy'
import { ALERTS, ANALYSIS, SAFETY_GATES } from './fixtures/alerts'
import {
  ALL_FUSION_SOURCES,
  FUSION_CATEGORIES,
  attentionItems,
  composeSource,
  graphCounts,
  ingestByHour,
  ingestStats,
  sourceStats,
  streamingTags,
} from './fixtures/fusion'
import {
  SOURCE_SCHEDULES,
  activityFor,
  catalogueFor,
  configFor,
  createSource,
  enterpriseObjectsFor,
  probeConnector,
  profileFor,
  saveConfig,
  scopeOptionsFor,
  scopesAssets,
  testSource,
  wizardFieldsFor,
} from './fixtures/fusionProfiles'
import {
  mappingFor,
  roiFor,
  setWritebackRule,
  writebackFor,
} from './fixtures/fusionMapping'
import { contextQueue, contextStats, decideAndApply, tagsOfSource } from './fixtures/fusionContext'
import {
  createPerson,
  directory,
  directoryStats,
  importHistory,
  importPeople,
  setPersonStatus,
} from './fixtures/directory'
import { allTeams, teamStats } from './fixtures/teams'
import { auditLog, auditStats } from './fixtures/audit'
import { saveSecurity, securitySettings } from './fixtures/security'
import { integrationsPayload, pauseSource, removeFusionSource } from './fixtures/integrations'
import { exportAll, orgSettings, resetAllSettings, saveOrgSettings } from './fixtures/org'
import { moduleMap, planPayload, setModuleEnabled, usage } from './fixtures/plan'
import { billingPayload, setBillingContact } from './fixtures/billing'
import { ALL_NAV_ITEMS } from '@/shell/navigation'
import {
  createKey,
  deleteWebhook,
  developerAccess,
  openApiSpec,
  postmanCollection,
  revokeKey,
  rotateKey,
  saveWebhook,
  testWebhook,
} from './fixtures/apiAccess'
import {
  PERMISSION_CATALOGUE,
  allRoles,
  deleteRole,
  roleStats,
  saveRole,
} from './fixtures/roles'
import { graphEntities, graphTotals, layout, neighbourhoodOf } from './fixtures/fusionGraph'
import { actOnPipeline, allPipelines, pipelineStats } from './fixtures/fusionPipelines'
import {
  DOC_TYPES,
  FUSION_DOCS,
  FUSION_MEDIA,
  MEDIA_TYPES,
  addFusionDoc,
  addFusionMedia,
  assetsReachedBy,
  composeDoc,
  linkTargets,
  composeMedia,
  knowledgeStats,
} from './fixtures/fusionDocs'
import {
  TOPLINE,
  SITE_HEALTH,
  HANDOVER,
  WO_NEXT,
  WO_STATES,
  CONNECTORS,
  addWorkOrder,
  allWorkOrders,
  isOpenOrder,
  removeWorkOrder,
  shiftForHour,
  updateWorkOrder,
} from './fixtures/operations'
import {
  OEE_ATTRIBUTION,
  OEE_BAND,
  OEE_PERIODS,
  OEE_PERIOD_DATA,
  OEE_TARGET,
  trendFor,
} from './fixtures/oee'
import {
  ASSET_COMPONENTS,
  ASSET_OPS,
  LINE_NOTE,
  LINE_OPS,
  LINE_THROUGHPUT,
  assetAlertHistory,
  assetAudit,
  assetBom,
  assetBriefing,
  addAssetDocument,
  assetDocuments,
  assetInsights,
  assetMaintenance,
  assetOeeWindows,
  assetPareto,
  assetPerformance,
  assetSignals,
  assetStatusHistory,
  assetTimeline,
  assetWorkOrders,
} from './fixtures/lines'
import {
  SIGNAL_CHANNELS,
  channelsInScope,
  scopeTree,
  stampsFor,
  stateOf,
  traceFor,
  windowSpec,
} from './fixtures/signals'
import { addChart, allCharts, chartChannels, chartName, composeChart } from './fixtures/charts'
import {
  CREW,
  SHIFT_RANGES,
  SHIFT_TYPES,
  assignShift,
  crewPerformance,
  defaultShiftRange,
  draftHandoverFor,
  shiftStats,
  shiftSynopsis,
  shiftsForWeek,
} from './fixtures/shifts'
import {
  addLogEntry,
  logEntries,
  logbookAssets,
  plantAssets,
  searchEntries,
} from './fixtures/logbook'
import {
  addRule,
  allRules,
  composeChannels,
  composeEscalation,
  composeRule,
  notificationStats,
  ruleKinds,
  setRuleEnabled,
  addEscalationLevel,
  composePreferences,
  configureChannel,
  removeRule,
  setPreference,
  testChannel,
  updateRule,
} from './fixtures/notifications'
import {
  REPORT_KINDS,
  REPORT_PERIODS,
  allReports,
  composeReport,
  generateReport,
  reportStats,
} from './fixtures/reports'
import { reportLibrary } from './fixtures/reportLibrary'
import { enterpriseStats, executiveBrief, siteRollups } from './fixtures/executive'
import {
  COPILOT_MODES,
  COPILOT_THREAD,
  answerFor,
  copilotGrounding,
  promptsFor,
} from './fixtures/copilot'
import { BRIEFINGS, BRIEFING_SUGGESTIONS } from './fixtures/briefing'
import {
  HANDOVERS,
  datedHandovers,
  HANDOVER_REPORT,
  HANDOVER_STATS,
  HOME_CONTEXT,
  MY_ASSETS,
  SELF,
  SHIFT_KPIS,
  TASKS,
  TASK_ASSETS,
  assignablePeople,
  WATCHED_ASSETS,
} from './fixtures/home'

/**
 * An axios adapter backed by fixtures.
 *
 * This is deliberately an adapter rather than a mocked service module. It sits
 * at the transport layer, so request/response interceptors, header injection,
 * timeouts, cancellation and ApiError normalisation all execute exactly as they
 * will against the real API. The consequence: turning on the real backend is
 * `VITE_API_MODE=live` and nothing else.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Resolve `detectedMinutesAgo` to a real instant, so the demo never goes stale. */
const withTimes = (alert) => ({
  ...alert,
  detectedAt: new Date(Date.now() - alert.detectedMinutesAgo * 60_000).toISOString(),
})

const ok = (data, cfg) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: { 'content-type': 'application/json', 'x-request-id': cfg.headers?.['X-Request-Id'] ?? 'mock' },
  config: cfg,
  request: { mock: true },
})

const fail = (status, code, cfg) => {
  const error = new Error(code)
  error.config = cfg
  error.response = {
    data: { code, detail: `Mock transport returned ${status}` },
    status,
    statusText: code,
    headers: {},
    config: cfg,
  }
  return error
}

/* ── Lines & Assets · DEMO ────────────────────────────────────────────────
   Composed rather than stored. The plant's shape comes from `HIERARCHY_NODES`,
   the operational facts from `lines.js`, and every alert count from `ALERTS` —
   so the line list, Settings → Sites & Hierarchy and the anomaly list are three
   views of one set of records and cannot drift apart.

   These helpers are used by BOTH the lines routes and `/oee/lines`, which is why
   the OEE table and this module report the same state for the same line. */

const liveAlerts = () => ALERTS.filter((alert) => alert.status !== 'resolved')

/** Severity order, for "which of these is the one to act on". */
const RANK = { critical: 0, high: 1, medium: 2, low: 3 }

/** Severity tally plus the worst one, for a badge. */
function alertSummary(alerts) {
  const count = (severity) => alerts.filter((a) => a.severity === severity).length
  const critical = count('critical')
  const high = count('high')
  const medium = count('medium')
  const low = count('low')
  return {
    total: alerts.length,
    critical,
    high,
    medium,
    low,
    // Not `alerts[0].severity` — the array is in fixture order, not severity
    // order, and a line whose first alert happens to be low would wear a grey
    // badge while carrying a critical.
    worst: critical ? 'critical' : high ? 'high' : medium ? 'medium' : low ? 'low' : null,
  }
}

/** One asset node, joined with its operational record and its open alerts. */
function composeAsset(node) {
  const ops = ASSET_OPS[node.id] ?? {}
  const alerts = liveAlerts().filter((alert) => alert.assetId === node.id)
  return {
    id: node.id,
    name: node.name,
    code: node.code,
    lineId: node.parentId,
    ...ops,
    // Resolved here rather than in the client, same as the line's operator.
    // `PEOPLE` is keyed by role, so `Object.values` — see composeLine.
    ownerName: Object.values(PEOPLE).find((person) => person.id === ops.ownerId)?.name ?? null,
    // An instant, not "2m". A relative label computed at fixture-authoring time
    // is a lie by the second page view; the client formats the instant.
    lastSeenAt:
      ops.lastSeenMinutes == null
        ? null
        : new Date(Date.now() - ops.lastSeenMinutes * 60_000).toISOString(),
    alerts: alertSummary(alerts),
  }
}

/** Every asset under a site, with its line's name attached for the list view. */
function assetsForSite(siteId) {
  const lines = lineNodesForSite(siteId)
  return lines.flatMap((line) =>
    assetsOnLine(line.id).map((asset) => ({ ...asset, lineName: line.name })),
  )
}

/** The asset nodes on a line, in hierarchy order — which IS the flow order. */
const assetsOnLine = (lineId) =>
  HIERARCHY_NODES.filter((node) => node.tier === 'asset' && node.parentId === lineId).map(composeAsset)

function composeLine(node, { withAssets = false } = {}) {
  const ops = LINE_OPS[node.id] ?? {}
  const assets = assetsOnLine(node.id)
  const alerts = liveAlerts().filter((alert) => alert.lineId === node.id)
  return {
    id: node.id,
    name: node.name,
    code: node.code,
    siteId: node.parentId,
    ...ops,
    // Resolved server-side, as a real endpoint would: the client should not have
    // to hold a directory just to print who is running the line.
    //
    // `PEOPLE` is keyed by ROLE, not a list — `Object.values` and not `.find`.
    // Getting that wrong threw a TypeError inside the handler, which axios sees
    // as an error with no response and reports as "cannot reach the platform",
    // so a one-word mistake in a fixture join looked like the backend was down.
    operatorName:
      Object.values(PEOPLE).find((person) => person.id === ops.operatorId)?.name ?? null,
    assetCount: assets.length,
    alerts: alertSummary(alerts),
    ...(withAssets ? { assets } : {}),
  }
}

const lineNodesForSite = (siteId) =>
  HIERARCHY_NODES.filter((node) => node.tier === 'line' && (!siteId || node.parentId === siteId))

/* ── Work Orders · DEMO ───────────────────────────────────────────────────
   One order, joined with the plant, the directory and its anomaly.

   Nothing on the wire is denormalised in the fixture: the order stores an
   `assetId` and a `dueInDays`, and the asset's name, its line, the assignee's
   name and the due instant are resolved here — the same arrangement as
   `composeAsset`. The consequence is that a work order cannot name a machine
   the hierarchy does not have, which is exactly what the prototype's free-text
   asset field allows. */
function composeWorkOrder(order) {
  const node = HIERARCHY_NODES.find((entry) => entry.id === order.assetId)
  const line = node ? HIERARCHY_NODES.find((entry) => entry.id === node.parentId) : null
  const alert = order.alertId ? ALERTS.find((entry) => entry.id === order.alertId) : null

  /* Parts that are not on the shelf. Counted off the order's own parts list
     rather than authored as a flag, so an order cannot claim to be waiting for
     a part it does not need — this is what the board's On Hold column has to be
     able to explain. */
  const shortfall = (order.parts ?? []).filter((part) => part.onHand < part.qty)

  return {
    ...order,
    // The stored value is the key or the literal; the client resolves it
    // through `t(..., { defaultValue })`. `titleText` is the searchable form.
    titleText: order.title,
    assetName: node?.name ?? null,
    assetCode: node?.code ?? null,
    lineId: line?.id ?? null,
    lineName: line?.name ?? null,
    assigneeName:
      Object.values(PEOPLE).find((person) => person.id === order.assigneeId)?.name ?? null,
    // An instant, not "in 3 days" — a relative label computed here is wrong by
    // the second render. Same rule as `lastSeenAt`.
    dueAt: new Date(Date.now() + order.dueInDays * 86_400_000).toISOString(),
    overdue: order.state !== 'completed' && order.dueInDays < 0,
    open: isOpenOrder(order),
    nextState: WO_NEXT[order.state] ?? null,
    canHold: order.state === 'inProgress',
    blockedByParts: shortfall.map((part) => ({ ...part, short: part.qty - part.onHand })),
    alert: alert
      ? {
          id: alert.id,
          severity: alert.severity,
          sensor: alert.sensor,
          status: alert.status,
        }
      : null,
  }
}

/* ── Sensor Explorer · DEMO ───────────────────────────────────────────────
   One channel, with its state and its trace resolved for the requested window.

   The trace is generated per request rather than stored, which is what lets the
   timeframe pills mean something: 1H and 30D are different samples of the same
   instrument, not the same 60 numbers relabelled. `stamps` come back with it so
   the axis is computed from now rather than authored into a fixture that goes
   stale — the prototype's chart is labelled "May 20 → Jun 6" under every pill. */
function composeChannel(channel, spec) {
  // `shape` is the generator's parameters and stays server-side: it is how the
  // trace is made, not something the client has any business holding.
  const rest = { ...channel }
  delete rest.shape
  return {
    ...rest,
    state: stateOf(channel),
    window: spec.key,
    values: traceFor(channel, spec),
    stamps: stampsFor(spec),
  }
}

/* ── Route table ─────────────────────────────────────────────────────── */

const routes = [
  /* DEMO. Two facets the anomaly list will eventually carry itself. Its own path
     rather than one under `/v1/anomalies`, which is a LIVE prefix — see the note
     in `endpoints.js`. */
  {
    method: 'get',
    match: /^\/v1\/anomaly-facets$/,
    handler: () => ANOMALY_DEMO_FACETS,
  },
  {
    method: 'get',
    match: /^\/v1\/org$/,
    // Computed per request, not at module load: a site added in Settings must
    // show up in the scope selector without a reload.
    handler: () => ({ ...ORG, sites: currentSites() }),
  },
  /* The map the navigation rail gates on, now served from `plan.js` rather than
     written out here. Settings → Modules & Plan reads and writes the same
     object, which is what makes a toggle on that page remove an item from the
     rail: there is nothing else for the rail to consult. The usage figures went
     the same way — they were four authored numbers, and `sensorTags: 2560`
     would now sit beside a source registry that can count its own. */
  {
    method: 'get',
    match: /^\/v1\/org\/entitlements$/,
    handler: () => ({ plan: ORG.plan, modules: moduleMap(), usage: usage() }),
  },
  /* DEMO. The page itself: the same modules with what each is doing, and the
     plan they sit inside. */
  {
    method: 'get',
    match: /^\/v1\/org\/plan$/,
    handler: () => planPayload(),
  },
  {
    method: 'patch',
    match: /^\/v1\/org\/modules\/([\w-]+)$/,
    handler: (cfg, [id]) => setModuleEnabled(id, JSON.parse(cfg.data ?? '{}').enabled),
  },
  {
    method: 'get',
    match: /^\/v1\/org\/billing$/,
    handler: () => billingPayload(),
  },
  /* The only write on the billing page. An address is a contact detail; a card
     number is a credential, and this product does not simulate one. */
  {
    method: 'patch',
    match: /^\/v1\/org\/billing\/contact$/,
    handler: (cfg) => setBillingContact(JSON.parse(cfg.data ?? '{}').email),
  },
  /* ── Authentication is NOT here ──────────────────────────────────────
     Sign-in and refresh talk to the real API. There is deliberately no fixture
     for either: a second, more forgiving implementation of authentication is
     precisely the thing that ends up accepting a credential the real service
     would reject. The transport routes those two paths to the network — see
     LIVE_PATHS in services/http.js. */

  /* ── Hierarchy: read and write ──────────────────────────────────────
     The node list is module state, so edits made in Settings persist for the
     session. That is what makes the CRUD honest to work against: adding a
     sub-region really does change the scope selector and the site list. */
  {
    method: 'get',
    match: /^\/v1\/hierarchy$/,
    handler: () => buildTree(HIERARCHY_NODES),
  },
  {
    method: 'get',
    match: /^\/v1\/hierarchy\/scopes$/,
    handler: () => ({ items: buildScopes(HIERARCHY_NODES) }),
  },
  {
    method: 'get',
    match: /^\/v1\/hierarchy\/nodes$/,
    handler: () => ({ items: HIERARCHY_NODES, tiers: TIERS }),
  },
  /* The fixture hierarchy is READ-ONLY.

     Its write routes were removed when Settings → Sites & Hierarchy moved onto
     the live API. Leaving them would have left a second, more forgiving
     implementation of hierarchy writes behind an endpoint nothing calls — the
     same trap the auth layer refuses on purpose. What remains below feeds the
     demo: /org, the site health cards and the public page's site list. */

  {
    method: 'get',
    match: /^\/v1\/hierarchy\/sites\/([^/]+)$/,
    handler: (_cfg, [siteId]) => {
      const site = currentSites().find((s) => s.id === siteId)
      if (!site) return null
      return { ...site, health: SITE_HEALTH.find((h) => h.siteId === siteId) }
    },
  },

  {
    method: 'get',
    match: /^\/v1\/alerts$/,
    handler: (cfg) => {
      const p = cfg.params ?? {}
      let items = ALERTS.map(withTimes)

      if (p.status && p.status !== 'all') items = items.filter((a) => a.status === p.status)
      if (p.severity && p.severity !== 'all') items = items.filter((a) => a.severity === p.severity)
      if (p.siteId) items = items.filter((a) => a.siteId === p.siteId)
      if (p.unassigned) items = items.filter((a) => a.assigneeId === null)
      if (p.q) {
        const q = String(p.q).toLowerCase()
        items = items.filter((a) =>
          [a.id, a.assetId, a.assetName, a.sensor, a.component]
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      }

      const rank = { critical: 0, high: 1, medium: 2, low: 3 }
      if (p.sort === 'detected') {
        items.sort((a, b) => a.detectedMinutesAgo - b.detectedMinutesAgo)
      } else {
        items.sort(
          (a, b) => rank[a.severity] - rank[b.severity] || a.detectedMinutesAgo - b.detectedMinutesAgo,
        )
      }

      const page = Number(p.page ?? 1)
      const pageSize = Number(p.pageSize ?? 25)
      const total = items.length

      return {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total,
        page,
        pageSize,
      }
    },
  },
  {
    method: 'get',
    match: /^\/v1\/alerts\/counts$/,
    handler: (cfg) => {
      const p = cfg.params ?? {}
      const scoped = p.siteId ? ALERTS.filter((a) => a.siteId === p.siteId) : ALERTS
      const live = scoped.filter((a) => a.status !== 'resolved')
      return {
        all: live.length,
        critical: live.filter((a) => a.severity === 'critical').length,
        high: live.filter((a) => a.severity === 'high').length,
        medium: live.filter((a) => a.severity === 'medium').length,
        low: live.filter((a) => a.severity === 'low').length,
        open: live.filter((a) => a.status === 'open').length,
        ack: live.filter((a) => a.status === 'ack').length,
        escalated: live.filter((a) => a.status === 'escalated').length,
        unassigned: live.filter((a) => a.assigneeId === null).length,
        resolved: scoped.filter((a) => a.status === 'resolved').length,
      }
    },
  },
  {
    method: 'get',
    match: /^\/v1\/alerts\/([^/]+)\/analysis$/,
    handler: (_cfg, [alertId]) => ANALYSIS[alertId] ?? null,
  },
  {
    method: 'get',
    match: /^\/v1\/alerts\/([^/]+)$/,
    handler: (_cfg, [alertId]) => {
      const alert = ALERTS.find((a) => a.id === alertId)
      if (!alert) return null
      return {
        ...withTimes(alert),
        gates: SAFETY_GATES.filter((g) => g.assetId === alert.assetId),
        analysis: ANALYSIS[alertId] ?? null,
      }
    },
  },
  {
    method: 'post',
    match: /^\/v1\/alerts\/([^/]+)\/acknowledge$/,
    handler: (_cfg, [alertId]) => {
      const alert = ALERTS.find((a) => a.id === alertId)
      if (!alert) return null
      // Fixtures are module state, so this persists for the session. Good
      // enough to make optimistic updates and invalidation behave honestly.
      alert.status = 'ack'
      alert.assigneeId ??= CURRENT_USER.id
      return withTimes(alert)
    },
  },

  {
    method: 'get',
    match: /^\/v1\/kpis\/topline$/,
    // refreshedAt comes from the server, not from the view. A component that
    // computes "1 minute ago" from Date.now() during render is impure and its
    // output shifts on any unrelated re-render.
    handler: () => ({
      ...TOPLINE,
      sites: SITE_HEALTH,
      refreshedAt: new Date(Date.now() - 60_000).toISOString(),
    }),
  },
  {
    method: 'get',
    match: /^\/v1\/shifts\/current$/,
    handler: () => {
      const now = new Date()
      const shift = shiftForHour(now.getHours())
      return {
        shift: shift.id,
        startHour: shift.startHour,
        endHour: shift.endHour,
        lead: CURRENT_USER,
        crewCount: 11,
      }
    },
  },
  {
    method: 'get',
    match: /^\/v1\/shifts\/handover$/,
    handler: () => ({
      ...HANDOVER,
      carriedAlerts: HANDOVER.carried
        .map((id) => ALERTS.find((a) => a.id === id))
        .filter(Boolean)
        .map(withTimes),
      /* What the outgoing lead physically observed — read from the LOGBOOK
         rather than authored onto the handover. It used to be two notes typed
         into `HANDOVER.logbook`, which is the same observation held in two
         places: the Logbook screen and the handover would each have their own
         version of what happened at 02:14, and only one of them could be
         right. */
      logbook: logEntries()
        .slice(0, 3)
        .map((entry) => ({ at: entry.at, assetId: entry.assetId, note: entry.text })),
      people: PEOPLE,
    }),
  },
  /* ── Work Orders · DEMO ─────────────────────────────────────────────
     The board and the table are one collection seen two ways, so the counts on
     the column headers and the rows in the table are the same records.

     Composed rather than stored: the asset name comes from `HIERARCHY_NODES`,
     the assignee from `PEOPLE`, the due date from `dueInDays`, and the parts
     shortfall from the parts list. The prototype denormalises all four onto the
     order, so an order can name an asset the plant does not have — its form
     takes the asset as free text. */
  {
    method: 'get',
    match: /^\/v1\/work-orders$/,
    handler: (cfg) => {
      const p = cfg.params ?? {}
      const all = allWorkOrders().map(composeWorkOrder)
      let items = all

      if (p.state && p.state !== 'all') items = items.filter((order) => order.state === p.state)
      if (p.priority && p.priority !== 'all')
        items = items.filter((order) => order.priority === p.priority)
      if (p.assigneeId && p.assigneeId !== 'all')
        items = items.filter((order) => order.assigneeId === p.assigneeId)
      if (p.source && p.source !== 'all')
        items = items.filter((order) => order.authoredBy === p.source)
      if (p.q) {
        const q = String(p.q).toLowerCase()
        items = items.filter((order) =>
          [order.id, order.titleText, order.assetName, order.assetCode, order.assigneeName]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      }

      /* Urgent first, then by how overdue. A maintenance backlog sorted
         alphabetically is a list; sorted by what is late is a queue. */
      const RANK_PRIORITY = { urgent: 0, high: 1, medium: 2, low: 3 }
      items = [...items].sort(
        (a, b) => RANK_PRIORITY[a.priority] - RANK_PRIORITY[b.priority] || a.dueInDays - b.dueInDays,
      )

      const page = Number(p.page ?? 1)
      const pageSize = Number(p.pageSize ?? 25)

      return {
        // The board wants every card in every column, so it asks for the whole
        // filtered set; the table pages. Same split as the floor map.
        items: p.paged === false || p.paged === 'false'
          ? items
          : items.slice((page - 1) * pageSize, page * pageSize),
        total: items.length,
        page,
        pageSize,
        /* Column counts, over the FILTERED set — unlike the asset facets, which
           count the whole site. A board column header reports how many cards are
           in the column you are looking at, and a filter that left the numbers
           alone would be describing a board nobody is being shown. */
        columns: Object.fromEntries(
          WO_STATES.map((state) => [state, items.filter((order) => order.state === state).length]),
        ),
        /* The two figures the design's subtitle carries, and only those. The
           board had four in a KPI strip it does not have; `overdue` and
           `urgent` came off with it rather than staying on the payload as
           counts nothing renders. */
        stats: {
          open: all.filter((order) => order.state !== 'completed').length,
          ai: all.filter((order) => order.authoredBy === 'ai').length,
        },
        options: {
          assignees: [...new Map(all.map((o) => [o.assigneeId, o.assigneeName])).entries()]
            .filter(([id]) => id)
            .map(([id, name]) => ({ id, name })),
          /* Every asset a work order can be raised against — the plant, not a
             free-text box. The prototype's form takes the asset as a string, so
             "Comressor C-12" is a work order against nothing. */
          assets: HIERARCHY_NODES.filter((node) => node.tier === 'asset').map((node) => ({
            id: node.id,
            name: node.name,
            code: node.code,
          })),
        },
      }
    },
  },
  {
    method: 'post',
    match: /^\/v1\/work-orders$/,
    handler: (cfg) => composeWorkOrder(addWorkOrder(cfg.data ? JSON.parse(cfg.data) : {})),
  },
  {
    method: 'get',
    match: /^\/v1\/work-orders\/([^/]+)$/,
    handler: (_cfg, [id]) => {
      const order = allWorkOrders().find((entry) => entry.id === id)
      return order ? composeWorkOrder(order) : null
    },
  },
  {
    method: 'patch',
    match: /^\/v1\/work-orders\/([^/]+)$/,
    /* PATCH and not PUT: advancing a state and editing a title are different
       acts on different fields, and a full replace would need the form to send
       back everything it did not touch. */
    handler: (cfg, [id]) => {
      const patch = cfg.data ? JSON.parse(cfg.data) : {}
      /* A state change is validated against the machine rather than accepted as
         given. The prototype's form has Status as a free select, so a draft can
         be marked Completed without ever being approved — on a screen whose
         subject is an approval workflow. */
      if (patch.state !== undefined) {
        const order = allWorkOrders().find((entry) => entry.id === id)
        if (!order) return null
        const legal = [WO_NEXT[order.state], order.state === 'inProgress' ? 'onHold' : null].filter(
          Boolean,
        )
        if (!legal.includes(patch.state)) throw fail(422, 'validation', cfg)
      }
      const updated = updateWorkOrder(id, patch)
      return updated ? composeWorkOrder(updated) : null
    },
  },
  {
    method: 'delete',
    match: /^\/v1\/work-orders\/([^/]+)$/,
    handler: (_cfg, [id]) => (removeWorkOrder(id) ? { id, deleted: true } : null),
  },
  {
    method: 'get',
    match: /^\/v1\/data-fusion\/connectors$/,
    handler: () => ({
      items: CONNECTORS.map((connector) => ({
        ...connector,
        lastSyncAt: new Date(Date.now() - connector.lastSyncMinutesAgo * 60_000).toISOString(),
      })),
    }),
  },

  /* ── Data Fusion · the other source families · DEMO ──────────────────
     Filtered, searched and sorted here rather than in the page, for the reason
     §2.1 gives: when a real endpoint lands it will do this work, and a client
     that already did it would have to have it taken back out.

     Sorted by what needs attention first, then by name. A source list ordered
     alphabetically is a catalogue; ordered by what has stopped working it is a
     morning's work queue, which is what somebody opens this screen to find. */
  {
    method: 'get',
    match: /^\/v1\/data-fusion\/sources$/,
    handler: (cfg) => {
      const p = cfg.params ?? {}
      const all = ALL_FUSION_SOURCES()
        .filter((source) => !p.category || source.category === p.category)
        .map((source) => composeSource(source))

      let items = all
      if (p.status && p.status !== 'all') items = items.filter((row) => row.status === p.status)
      /* An enterprise system has no site, so filtering by one excludes it. That
         is correct rather than a gap: SAP is not at Findlay, and answering
         "sources at Findlay" with it would be a wrong answer, not a generous one. */
      if (p.siteId && p.siteId !== 'all') items = items.filter((row) => row.siteId === p.siteId)
      if (p.q) {
        const q = String(p.q).toLowerCase()
        items = items.filter((row) =>
          [row.name, row.protocol, row.endpoint ?? '', row.siteName ?? '']
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      }

      const RANK = { disconnected: 0, degraded: 1, notConfigured: 2, syncing: 3, connected: 4 }
      items = [...items].sort(
        (a, b) => RANK[a.status] - RANK[b.status] || a.name.localeCompare(b.name),
      )

      return {
        items,
        // Counted over the whole family, not the filtered slice. A header that
        // said "2 sources" because a filter was on would be reporting the filter.
        stats: sourceStats(all),
        options: {
          sites: [
            ...new Map(
              all.filter((row) => row.siteId).map((row) => [row.siteId, row.siteName]),
            ),
          ].map(([value, label]) => ({ value, label })),
        },
      }
    },
  },

  /* ── People · the account directory · DEMO ───────────────────────────
     Filtered and sorted here rather than in the page, like every other
     collection: when a real endpoint lands it will do this work, and a client
     that already did it would have to have it taken back out.

     Sorted by what needs attention first — a locked account above a dormant one,
     both above a working one — then by name. An account list in name order is a
     phone book; in this order it is an access review, which is what somebody
     opens this screen to do. */
  {
    method: 'get',
    match: /^\/v1\/users$/,
    handler: (cfg) => {
      const p = cfg.params ?? {}
      const all = directory()

      let items = all
      if (p.status && p.status !== 'all') items = items.filter((row) => row.status === p.status)
      if (p.facet === 'mfaOn') items = items.filter((row) => row.mfa)
      if (p.facet === 'mfaOff') items = items.filter((row) => !row.mfa)
      if (p.facet === 'neverSignedIn') items = items.filter((row) => row.lastActiveAt === null)
      if (p.role && p.role !== 'all') items = items.filter((row) => row.role === p.role)
      if (p.siteId && p.siteId !== 'all') items = items.filter((row) => row.siteIds.includes(p.siteId))
      if (p.q) {
        const q = String(p.q).toLowerCase()
        items = items.filter((row) => `${row.name} ${row.email}`.toLowerCase().includes(q))
      }

      const RANK = { locked: 0, inactive: 1, active: 2 }
      items = [...items].sort(
        (a, b) =>
          RANK[a.status] - RANK[b.status] ||
          Number(a.mfa) - Number(b.mfa) ||
          a.name.localeCompare(b.name),
      )

      return {
        items,
        // Counted over everybody, not the filtered slice. A tile that reported
        // the filter would be a tile that changed when you clicked it.
        stats: directoryStats(all),
        options: {
          roles: [...new Set(all.map((row) => row.role))].sort(),
          sites: [
            ...new Map(
              all.flatMap((row) => row.siteIds.map((id, index) => [id, row.siteNames[index]])),
            ),
          ].map(([value, label]) => ({ value, label })),
        },
      }
    },
  },
  {
    method: 'post',
    match: /^\/v1\/users$/,
    handler: (cfg) => createPerson(JSON.parse(cfg.data ?? '{}')),
  },
  {
    method: 'post',
    match: /^\/v1\/users\/import$/,
    handler: (cfg) => importPeople(JSON.parse(cfg.data ?? '{}')),
  },
  {
    method: 'get',
    match: /^\/v1\/users\/imports$/,
    handler: () => ({ items: importHistory() }),
  },
  {
    method: 'patch',
    match: /^\/v1\/users\/([^/]+)$/,
    handler: (cfg, [id]) => setPersonStatus(id, JSON.parse(cfg.data ?? '{}').status),
  },

  /* ── Developer access · DEMO ─────────────────────────────────────────
     The specification is generated from `endpoints.js` on every read, so it
     describes the paths this client actually calls rather than a second list
     somebody has to remember to update. */
  {
    method: 'get',
    match: /^\/v1\/developer$/,
    handler: () => developerAccess(),
  },
  {
    method: 'get',
    match: /^\/v1\/developer\/spec$/,
    handler: () => openApiSpec(),
  },
  {
    method: 'get',
    match: /^\/v1\/developer\/postman$/,
    handler: () => postmanCollection(),
  },
  {
    /* The ONE response that carries a key's value. */
    method: 'post',
    match: /^\/v1\/developer\/keys$/,
    handler: (cfg) => createKey(JSON.parse(cfg.data ?? '{}')),
  },
  {
    method: 'post',
    match: /^\/v1\/developer\/keys\/([\w-]+)\/rotate$/,
    handler: (_cfg, [id]) => rotateKey(id),
  },
  {
    method: 'delete',
    match: /^\/v1\/developer\/keys\/([\w-]+)$/,
    handler: (_cfg, [id]) => revokeKey(id),
  },
  {
    method: 'post',
    match: /^\/v1\/developer\/webhooks$/,
    handler: (cfg) => saveWebhook(JSON.parse(cfg.data ?? '{}')),
  },
  {
    method: 'post',
    match: /^\/v1\/developer\/webhooks\/([\w-]+)\/test$/,
    handler: (_cfg, [id]) => testWebhook(id),
  },
  {
    method: 'put',
    match: /^\/v1\/developer\/webhooks\/([\w-]+)$/,
    handler: (cfg, [id]) => saveWebhook({ ...JSON.parse(cfg.data ?? '{}'), id }),
  },
  {
    method: 'delete',
    match: /^\/v1\/developer\/webhooks\/([\w-]+)$/,
    handler: (_cfg, [id]) => deleteWebhook(id),
  },

  /* ── Organisation settings · DEMO ────────────────────────────────────
     The landing-page options are computed here rather than in the fixture,
     because they come from the navigation rail — which `mocks/` has no business
     importing, and which the page must not author either. The languages are the
     one option the client owns, so the page supplies them from the i18n build
     rather than the transport claiming to know what strings shipped. */
  {
    method: 'get',
    match: /^\/v1\/org\/settings$/,
    handler: () =>
      orgSettings(ALL_NAV_ITEMS.filter((item) => item.built || config.demoMode)),
  },
  {
    method: 'patch',
    match: /^\/v1\/org\/settings$/,
    handler: (cfg) => saveOrgSettings(JSON.parse(cfg.data ?? '{}')),
  },
  {
    method: 'post',
    match: /^\/v1\/org\/reset$/,
    handler: () => resetAllSettings(),
  },
  {
    method: 'get',
    match: /^\/v1\/org\/export$/,
    handler: () => exportAll(),
  },

  /* ── Integrations · DEMO ─────────────────────────────────────────────
     A read over the source registry and the channel list, and two writes that
     go straight into the registry — a pause here is the same pause Data Fusion
     shows, and a delete here takes the pipelines that read the source with it.
     Neither is stored in this page's own state, because this page has none. */
  {
    method: 'get',
    match: /^\/v1\/integrations$/,
    handler: () => integrationsPayload(),
  },
  {
    method: 'post',
    match: /^\/v1\/integrations\/sources\/([\w-]+)\/pause$/,
    handler: (cfg, [id]) => pauseSource(id, JSON.parse(cfg.data ?? '{}').paused !== false),
  },
  {
    method: 'delete',
    match: /^\/v1\/integrations\/sources\/([\w-]+)$/,
    handler: (_cfg, [id]) => removeFusionSource(id),
  },

  /* ── Security · DEMO ─────────────────────────────────────────────────
     The user agent is read from the request rather than in the page, so the one
     session this product can honestly report describes the browser that asked
     for it. */
  {
    method: 'get',
    match: /^\/v1\/security$/,
    handler: (cfg) =>
      securitySettings(cfg.headers?.['x-user-agent'] ?? globalThis.navigator?.userAgent ?? ''),
  },
  {
    method: 'patch',
    match: /^\/v1\/security$/,
    handler: (cfg) => saveSecurity(JSON.parse(cfg.data ?? '{}')),
  },

  /* ── Audit log · DEMO ────────────────────────────────────────────────
     Read-only. Filtered and sorted here like every other collection; newest
     first, because an audit log read from the bottom is a file, not a screen. */
  {
    method: 'get',
    match: /^\/v1\/audit$/,
    handler: (cfg) => {
      const p = cfg.params ?? {}
      const all = auditLog()

      let items = all
      if (p.severity && p.severity !== 'all') {
        items = items.filter((row) => row.severity === p.severity)
      }
      if (p.kind && p.kind !== 'all') items = items.filter((row) => row.resourceKind === p.kind)
      if (p.actorId && p.actorId !== 'all') items = items.filter((row) => row.actorId === p.actorId)
      if (p.since) {
        const cutoff = Date.now() - Number(p.since) * 86_400_000
        items = items.filter((row) => Date.parse(row.at) >= cutoff)
      }
      if (p.q) {
        const q = String(p.q).toLowerCase()
        items = items.filter((row) =>
          `${row.actorName ?? ''} ${row.action} ${row.resource}`.toLowerCase().includes(q),
        )
      }

      return {
        items,
        stats: auditStats(all),
        options: {
          kinds: [...new Set(all.map((row) => row.resourceKind))].sort(),
          actors: [
            ...new Map(all.filter((row) => row.actorId).map((row) => [row.actorId, row.actorName])),
          ].map(([value, label]) => ({ value, label })),
        },
      }
    },
  },

  /* ── Roles · DEMO ────────────────────────────────────────────────────
     The catalogue rides along with the list. It is the same payload on every
     read and the grid cannot be drawn without it, so a second request would be
     a second loading state for something that never changes. */
  {
    method: 'get',
    match: /^\/v1\/roles$/,
    handler: () => {
      const items = allRoles()
      return { items, stats: roleStats(items), catalogue: PERMISSION_CATALOGUE }
    },
  },
  {
    method: 'post',
    match: /^\/v1\/roles$/,
    handler: (cfg) => saveRole(JSON.parse(cfg.data ?? '{}')),
  },
  {
    method: 'put',
    match: /^\/v1\/roles\/([^/]+)$/,
    handler: (cfg, [id]) => saveRole({ ...JSON.parse(cfg.data ?? '{}'), id }),
  },
  {
    method: 'delete',
    match: /^\/v1\/roles\/([^/]+)$/,
    handler: (_cfg, [id]) => deleteRole(id),
  },

  /* ── Teams · DEMO ────────────────────────────────────────────────────
     Filtered and sorted here, like every other collection. Dormant first: a
     group nobody in it can sign in to is the row worth seeing. */
  {
    method: 'get',
    match: /^\/v1\/teams$/,
    handler: (cfg) => {
      const p = cfg.params ?? {}
      const all = allTeams()

      let items = all
      if (p.status && p.status !== 'all') items = items.filter((row) => row.status === p.status)
      if (p.type && p.type !== 'all') items = items.filter((row) => row.type === p.type)
      if (p.q) {
        const q = String(p.q).toLowerCase()
        items = items.filter((row) => row.name.toLowerCase().includes(q))
      }

      items = [...items].sort(
        (a, b) =>
          Number(a.status === 'active') - Number(b.status === 'active') ||
          a.name.localeCompare(b.name),
      )

      return {
        items,
        stats: teamStats(all),
        options: { types: [...new Set(all.map((row) => row.type))].sort() },
      }
    },
  },

  /* ── Data Fusion · the connect wizard · DEMO ─────────────────────────
     Everything the four steps need, in one read. The wizard is a single flow and
     fetching the catalogue, then the field set, then the scope options as the
     reader advances would put three loading states inside one dialog — and the
     later two are the smaller payloads. */
  {
    method: 'get',
    match: /^\/v1\/data-fusion\/connector-catalogue$/,
    handler: (cfg) => {
      const category = cfg.params?.category
      if (!category || !profileFor(category)) return null
      return {
        category,
        unit: FUSION_CATEGORIES.find((entry) => entry.id === category)?.unit ?? 'tags',
        connectors: catalogueFor(category),
        fields: wizardFieldsFor(category),
        /* Empty for an enterprise system, which is how the wizard knows not to
           ask SAP which production line it is on. */
        scopes: scopeOptionsFor(category),
        scopesAssets: scopesAssets(category),
        /* Only meaningful for the two families that read no machines. Sent
           regardless so the wizard's summary tile reads one field whichever
           branch it is on. */
        enterpriseObjects: enterpriseObjectsFor(category),
        schedules: SOURCE_SCHEDULES,
      }
    },
  },
  {
    method: 'post',
    match: /^\/v1\/data-fusion\/connector-probe$/,
    handler: (cfg) => {
      const { category, endpoint } = JSON.parse(cfg.data ?? '{}')
      return probeConnector(category, endpoint)
    },
  },
  {
    method: 'post',
    match: /^\/v1\/data-fusion\/sources$/,
    handler: (cfg) => createSource(JSON.parse(cfg.data ?? '{}')),
  },

  /* ── Data Fusion · one connection · DEMO ─────────────────────────────
     The drawer's read. Everything on it is either the composed row the table
     already shows, or derived beside it here: the contract, the config schema
     with its values resolved against the registry, and the activity log the
     source's own clock implies.

     The contract comes from `CONNECTORS` when the source is one of the three
     anchors and from the family profile otherwise — the same seam as the row
     itself. An anchor states what IT provides; everything else can only speak
     for its family. */
  {
    method: 'get',
    match: /^\/v1\/data-fusion\/sources\/([^/]+)$/,
    handler: (_cfg, [id]) => {
      const source = ALL_FUSION_SOURCES().find((entry) => entry.id === id)
      if (!source) return null
      const row = composeSource(source)
      const profile = profileFor(source.category)
      const settings = configFor(row)
      const valueOf = (field) => settings.find((entry) => entry.id === field)?.value ?? null

      const mapping = mappingFor(row)
      /* The other half of the same population. The mapping table shows what is
         bound; this is what is still waiting on the Contextualisation queue, and
         the two add up to every tag the source publishes because they are taken
         from one function rather than counted twice. */
      const published = tagsOfSource(row).length

      return {
        ...row,
        unit: FUSION_CATEGORIES.find((entry) => entry.id === source.category)?.unit ?? 'tags',
        contract: {
          /* `provides` on an anchor is the list the public source-contract
             section prints. Two lists would let this drawer say the historian
             supplies maintenance records while the landing page says it does
             not. */
          fromAnchor: Boolean(row.provides),
          provides: row.provides ?? profile?.provides ?? [],
          doesNotProvide: row.doesNotProvide ?? profile?.doesNotProvide ?? [],
        },
        config: settings,
        mapping: mapping
          ? { ...mapping, bound: mapping.rows.length, unbound: published - mapping.rows.length }
          : null,
        /* Read from this connection's own configuration rather than authored a
           second time: write-back follows the Sync direction select, and which
           recipe is running follows the Inspection program select. Change either
           on the Connection tab and the tab beside it changes. */
        writeback: writebackFor(row, valueOf('syncDirection')),
        roi: roiFor(row, valueOf('inspectionProgram')),
        activity: activityFor(source),
      }
    },
  },
  {
    method: 'patch',
    match: /^\/v1\/data-fusion\/sources\/([^/]+)\/writeback$/,
    handler: (cfg, [id]) => {
      const { ruleId, enabled } = JSON.parse(cfg.data ?? '{}')
      return setWritebackRule(id, ruleId, Boolean(enabled)) ? { id, ruleId, enabled } : null
    },
  },
  {
    method: 'patch',
    match: /^\/v1\/data-fusion\/sources\/([^/]+)$/,
    handler: (cfg, [id]) => saveConfig(id, JSON.parse(cfg.data ?? '{}').values ?? {}),
  },
  {
    method: 'post',
    match: /^\/v1\/data-fusion\/sources\/([^/]+)\/test$/,
    handler: (_cfg, [id]) => testSource(id),
  },

  /* ── Data Fusion · overview · DEMO ───────────────────────────────────
     The module's landing screen. Every figure it returns is counted here from a
     collection that exists elsewhere in `fixtures/` — sources, the hierarchy,
     the signal catalogue, documents, media. Nothing on it is authored, which is
     why it was built after the eight screens it summarises rather than before
     them. */
  {
    method: 'get',
    match: /^\/v1\/data-fusion\/overview$/,
    handler: () => {
      const sources = ALL_FUSION_SOURCES().map((source) => composeSource(source))
      const docs = FUSION_DOCS.map((doc) => composeDoc(doc))
      const media = FUSION_MEDIA.map(composeMedia)
      const graph = graphCounts({
        nodes: HIERARCHY_NODES,
        channels: SIGNAL_CHANNELS,
        sources,
        docs,
        media,
      })

      return {
        sources: sourceStats(sources),
        knowledge: knowledgeStats(),
        graph,
        /* Per family, so the reader can see WHERE the trouble is rather than
           only that there is some. `share` is what the design draws as a
           progress bar; it is the proportion connected, which is the only
           reading of that bar that is not decorative. */
        families: FUSION_CATEGORIES.map((category) => {
          const rows = sources.filter((source) => source.category === category.id)
          const stats = sourceStats(rows)
          return {
            id: category.id,
            section: category.section,
            unit: category.unit,
            ...stats,
            share: stats.total ? Math.round((stats.connected / stats.total) * 100) : 0,
          }
        }),
        attention: attentionItems({ sources, docs }),
        ingest: ingestByHour(sources),
        ingestStats: ingestStats(sources, ingestByHour(sources)),
        streamingTags: streamingTags(sources),
      }
    },
  },

  /* ── Data Fusion · documents · DEMO ──────────────────────────────────
     The same twelve records Asset Detail's Documents tab resolves against, so
     the two screens cannot disagree about a revision or an owner. */
  {
    method: 'get',
    match: /^\/v1\/data-fusion\/documents$/,
    handler: (cfg) => {
      const p = cfg.params ?? {}
      const all = FUSION_DOCS.map((doc) => composeDoc(doc))

      let items = all
      if (p.type && p.type !== 'all') items = items.filter((doc) => doc.type === p.type)
      if (p.scope && p.scope !== 'all') items = items.filter((doc) => doc.scope === p.scope)
      if (p.verified && p.verified !== 'all')
        items = items.filter((doc) => doc.verified === (p.verified === 'yes'))
      /* `none` is a real answer, not the absence of a filter: an unlinked
         document is the thing Contextualisation exists to fix, and somebody
         auditing the library wants exactly that list. */
      if (p.linked && p.linked !== 'all')
        items =
          p.linked === 'none'
            ? items.filter((doc) => doc.links.length === 0)
            : items.filter((doc) => doc.links.some((link) => link.kind === p.linked))
      if (p.q) {
        const q = String(p.q).toLowerCase()
        items = items.filter((doc) =>
          [doc.id, doc.name, doc.owner, ...doc.tags].join(' ').toLowerCase().includes(q),
        )
      }

      // Newest revision first. A document register is read to find the current
      // one, and the current one is the one that changed most recently.
      items = [...items].sort((a, b) => b.date.localeCompare(a.date))

      return {
        items,
        total: all.length,
        stats: {
          total: all.length,
          unverified: all.filter((doc) => !doc.verified).length,
          unlinked: all.filter((doc) => doc.links.length === 0).length,
        },
        // Only types that actually have documents. A chip that filters to
        // nothing is a chip that wastes a click.
        types: DOC_TYPES.map((type) => ({
          id: type.id,
          tone: type.tone,
          icon: type.icon,
          count: all.filter((doc) => doc.type === type.id).length,
        })).filter((type) => type.count > 0),
        /* All eight, for the upload wizard. The chip strip above filters to the
           ones in use, because a chip that shows nothing wastes a click; a form
           that cannot file the FIRST document of a type is a different and worse
           problem. */
        allTypes: DOC_TYPES.map((type) => ({ id: type.id, tone: type.tone, icon: type.icon })),
        /* What a link can point at. Served rather than imported so the picker
           cannot offer a machine the estate does not have, and so it grows on
           its own when somebody adds a line. */
        targets: linkTargets(),
      }
    },
  },
  {
    method: 'post',
    match: /^\/v1\/data-fusion\/documents$/,
    handler: (cfg) => composeDoc(addFusionDoc(cfg.data ? JSON.parse(cfg.data) : {})),
  },
  {
    method: 'get',
    match: /^\/v1\/data-fusion\/documents\/([^/]+)$/,
    handler: (_cfg, [id]) => {
      const record = FUSION_DOCS.find((doc) => doc.id === id)
      if (!record) return null
      const doc = composeDoc(record)

      /* Where it is used, counted rather than claimed. The prototype's Usage tab
         says "Cited in 14 investigations" and "Referenced by #ALR-1024" with
         nothing behind either. Three of its four rows are derivable from records
         this app already holds; the fourth — Copilot citations — is not, so it
         is not shown. */
      const reached = assetsReachedBy(id)
      const reachedIds = new Set(reached.map((asset) => asset.id))

      return {
        ...doc,
        reaches: reached,
        usage: {
          assets: reached.length,
          openAlerts: ALERTS.filter(
            (alert) => reachedIds.has(alert.assetId) && alert.status !== 'resolved',
          ).length,
          workOrders: allWorkOrders().filter(
            (order) => reachedIds.has(order.assetId) && isOpenOrder(order),
          ).length,
          graphEdges: doc.links.length,
        },
      }
    },
  },
  {
    method: 'patch',
    match: /^\/v1\/data-fusion\/documents\/([^/]+)$/,
    handler: (cfg, [id]) => {
      const record = FUSION_DOCS.find((doc) => doc.id === id)
      if (!record) return null
      /* Verification is the only editable field, and it is one-way. The
         prototype's drawer offers nine text inputs and a Save button; a revision
         number and an owner come from the system of record that filed the
         document, and letting somebody retype them here would make this screen
         a second source of truth for facts it does not own. Signing off that
         you have checked one is a judgement this reader really does make. */
      const body = cfg.data ? JSON.parse(cfg.data) : {}
      if (body.verified === true) record.verified = true
      return composeDoc(record)
    },
  },

  /* ── Data Fusion · media · DEMO ──────────────────────────────────────
     Photographs, CAD, thermal captures and inspection video. The same registry
     Asset Detail counts for its media figure. */
  {
    method: 'get',
    match: /^\/v1\/data-fusion\/media$/,
    handler: (cfg) => {
      const p = cfg.params ?? {}
      const all = FUSION_MEDIA.map(composeMedia)

      let items = all
      if (p.type && p.type !== 'all') items = items.filter((item) => item.type === p.type)
      if (p.q) {
        const q = String(p.q).toLowerCase()
        items = items.filter((item) =>
          [item.id, item.name, item.owner, ...item.tags].join(' ').toLowerCase().includes(q),
        )
      }
      items = [...items].sort((a, b) => b.date.localeCompare(a.date))

      return {
        items,
        total: all.length,
        stats: {
          total: all.length,
          sizeKb: all.reduce((sum, item) => sum + (item.sizeKb ?? 0), 0),
        },
        /* All four, always — unlike the document chip strip, which hides types
           nothing is filed under. Four is short enough that a zero is
           information ("nobody has uploaded a thermal capture") rather than
           clutter. */
        types: MEDIA_TYPES.map((type) => ({
          id: type.id,
          tone: type.tone,
          icon: type.icon,
          count: all.filter((item) => item.type === type.id).length,
        })),
        targets: linkTargets(),
      }
    },
  },
  {
    method: 'post',
    match: /^\/v1\/data-fusion\/media$/,
    handler: (cfg) => composeMedia(addFusionMedia(cfg.data ? JSON.parse(cfg.data) : {})),
  },

  /* ── Data Fusion · contextualisation · DEMO ──────────────────────────
     The queue of objects that arrived without a home, and the decisions taken
     on them. Accepting a document or media suggestion writes a real link into
     the registry the Documents screen and Asset Detail read. */
  {
    method: 'get',
    match: /^\/v1\/data-fusion\/context$/,
    handler: (cfg) => {
      const p = cfg.params ?? {}
      const all = contextQueue()

      let items = all
      if (p.kind && p.kind !== 'all') items = items.filter((item) => item.kind === p.kind)
      if (p.status && p.status !== 'all') items = items.filter((item) => item.status === p.status)
      if (p.q) {
        const q = String(p.q).toLowerCase()
        items = items.filter((item) =>
          [item.label, item.sourceName, item.suggestion?.name ?? '']
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      }

      return {
        items,
        stats: contextStats(all),
        kinds: ['tag', 'document', 'media'].map((kind) => ({
          id: kind,
          count: all.filter((item) => item.kind === kind).length,
        })),
      }
    },
  },
  {
    method: 'post',
    match: /^\/v1\/data-fusion\/context\/([^/]+)\/decision$/,
    handler: (cfg, [id]) => {
      const body = cfg.data ? JSON.parse(cfg.data) : {}
      /* Only the two answers a reviewer can give, plus undo. Anything else is a
         client bug rather than a state to store. */
      if (!['accepted', 'rejected', 'pending'].includes(body.decision)) return null
      return decideAndApply(decodeURIComponent(id), body.decision)
    },
  },

  /* ── Data Fusion · knowledge graph · DEMO ────────────────────────────
     One machine's neighbourhood rather than the whole estate. Every edge is a
     fact another collection already asserts — the hierarchy, the signal
     catalogue, the document resolver, what each source declares it reads, the
     work-order board, the anomaly list. */
  {
    method: 'get',
    match: /^\/v1\/data-fusion\/graph$/,
    handler: () => ({ totals: graphTotals(), entities: graphEntities() }),
  },
  {
    method: 'get',
    match: /^\/v1\/data-fusion\/graph\/([^/]+)$/,
    handler: (_cfg, [id]) => {
      const hood = neighbourhoodOf(id)
      if (!hood.focus) return null
      // Positioned server-side so the picture is the same on every render and
      // every reader's screen, and so a real graph service can own it later.
      return { ...hood, nodes: layout(hood.nodes) }
    },
  },

  /* ── Data Fusion · pipelines · DEMO ──────────────────────────────────
     A pipeline's source is an id into the registry, so its status can be derived
     from that source's own state — the rule the screen exists to make visible. */
  {
    method: 'get',
    match: /^\/v1\/data-fusion\/pipelines$/,
    handler: (cfg) => {
      const p = cfg.params ?? {}
      const all = allPipelines()

      let items = all
      if (p.status && p.status !== 'all') items = items.filter((row) => row.status === p.status)
      if (p.q) {
        const q = String(p.q).toLowerCase()
        items = items.filter((row) =>
          [row.name, row.sourceName ?? ''].join(' ').toLowerCase().includes(q),
        )
      }

      /* What has stopped, first. Same argument as the source tables: a list in
         configured order is a catalogue, in failure order it is a morning's
         work. */
      const RANK = { failed: 0, stalled: 1, paused: 2, active: 3 }
      items = [...items].sort(
        (a, b) => RANK[a.status] - RANK[b.status] || a.name.localeCompare(b.name),
      )

      return { items, stats: pipelineStats(all) }
    },
  },
  {
    method: 'post',
    match: /^\/v1\/data-fusion\/pipelines\/([^/]+)\/actions$/,
    handler: (cfg, [id]) => {
      const body = cfg.data ? JSON.parse(cfg.data) : {}
      if (!['run', 'pause', 'resume'].includes(body.action)) return null
      return actOnPipeline(id, body.action)
    },
  },

  {
    method: 'get',
    match: /^\/v1\/copilot\/messages$/,
    handler: () => COPILOT_THREAD,
  },

  /* ── AI Copilot · DEMO ──────────────────────────────────────────────
     The screen's opening state. The four agent modes and their prompt chips —
     a mode swaps the chips and nothing else, which is all it does in the design
     too, and claiming more would be a claim this layer cannot back. */
  {
    method: 'get',
    match: /^\/v1\/copilot\/prompts$/,
    handler: () => ({
      modes: COPILOT_MODES.map((mode) => ({ id: mode, prompts: promptsFor(mode) })),
      grounding: copilotGrounding(),
    }),
  },

  {
    method: 'post',
    match: /^\/v1\/copilot\/messages$/,
    /* Ask a question. A LOOKUP against the prepared answers, and otherwise an
       honest miss — there is no model behind a fixture, and a confident wrong
       answer about a plant is worse than saying so.

       Every figure in a prepared answer is read from the alert list, the OEE
       module and the work-order board at request time, so an answer cannot
       contradict the screen it sends you to. */
    handler: (cfg) => {
      const body = cfg.data ? JSON.parse(cfg.data) : {}
      const question = String(body.question ?? '').trim()
      if (!question) throw fail(422, 'validation', cfg)
      return answerFor(question, body.mode)
    },
  },
  /* ── Lines & Assets · DEMO ──────────────────────────────────────────
     `/production-lines`, NOT `/lines`: the latter is the real API's hierarchy
     line collection and sits in LIVE_PATHS, so a route registered there would
     never be reached. Two different resources that happen to share a noun.

     Literal paths before parameterised ones, as everywhere in this table. */
  {
    method: 'get',
    match: /^\/v1\/production-lines$/,
    handler: (cfg) => {
      const siteId = cfg.params?.siteId ?? HOME_CONTEXT.siteId
      const site = HIERARCHY_NODES.find((node) => node.id === siteId)
      // Assets ride along with the list: the row expands into them in place, and
      // a request per line on expand would be six requests to render one screen
      // whose whole content is already known.
      const items = lineNodesForSite(siteId).map((node) => composeLine(node, { withAssets: true }))
      return {
        items,
        total: items.length,
        siteId,
        siteName: site?.name ?? null,
        // Summed here rather than in the component so the header strip and the
        // rows are counting the same thing.
        sensorCount: items.reduce(
          (sum, line) => sum + line.assets.reduce((n, a) => n + (a.sensorCount ?? 0), 0),
          0,
        ),
      }
    },
  },
  {
    method: 'get',
    match: /^\/v1\/production-lines\/([^/]+)$/,
    handler: (_cfg, [lineId]) => {
      const node = HIERARCHY_NODES.find((n) => n.tier === 'line' && n.id === lineId)
      if (!node) return null
      const site = HIERARCHY_NODES.find((n) => n.id === node.parentId)
      return {
        ...composeLine(node, { withAssets: true }),
        siteName: site?.name ?? null,
        throughput: LINE_THROUGHPUT[lineId] ?? [],
        note: LINE_NOTE[lineId] ?? null,
        /* Whole alert records, not a count: the tabbed panel shows the sensor,
           the reading, the detector confidence and the anomaly type, and those
           are the same fields the anomaly screen reads. */
        openAlerts: liveAlerts()
          .filter((alert) => alert.lineId === lineId)
          .map(withTimes),
      }
    },
  },
  {
    method: 'get',
    match: /^\/v1\/assets$/,
    /* Filtered, sorted and paginated SERVER-SIDE, like `/alerts`, even though
       the whole set is eighteen rows and the client could do it in one pass.
       The point is the seam: when this becomes a real endpoint over a plant with
       four thousand assets, the screen's params object already carries what the
       query needs and nothing above this line changes.

       The option sets ride along with the collection rather than having routes
       of their own — the drawer needs types, owners and tags to render, and
       three more round trips to populate three selects is a slower screen for no
       gain. Same arrangement as `/tasks`. */
    handler: (cfg) => {
      const p = cfg.params ?? {}
      const siteId = p.siteId ?? HOME_CONTEXT.siteId
      const all = assetsForSite(siteId)
      let items = all

      if (p.lineId && p.lineId !== 'all') items = items.filter((a) => a.lineId === p.lineId)
      if (p.type && p.type !== 'all') items = items.filter((a) => a.type === p.type)
      if (p.criticality && p.criticality !== 'all')
        items = items.filter((a) => a.criticality === p.criticality)
      if (p.stream && p.stream !== 'all')
        items = items.filter((a) => (p.stream === 'online' ? a.online : !a.online))
      if (p.owner && p.owner !== 'all') items = items.filter((a) => a.ownerId === p.owner)
      if (p.tag && p.tag !== 'all') items = items.filter((a) => a.tags?.includes(p.tag))

      // The quick chips, which are shorthands over the same fields rather than a
      // second filtering axis.
      if (p.quick === 'critical') items = items.filter((a) => a.alerts.critical > 0)
      else if (p.quick === 'alerts') items = items.filter((a) => a.alerts.total > 0)
      else if (p.quick === 'offline') items = items.filter((a) => !a.online)

      if (p.q) {
        const q = String(p.q).toLowerCase()
        items = items.filter((a) =>
          [a.name, a.code, a.type, a.lineName].join(' ').toLowerCase().includes(q),
        )
      }

      const rank = { critical: 0, high: 1, medium: 2, low: 3, [null]: 4 }
      const sorters = {
        name: (a, b) => a.name.localeCompare(b.name),
        health: (a, b) => (a.health ?? 0) - (b.health ?? 0),
        alerts: (a, b) => rank[a.alerts.worst] - rank[b.alerts.worst] || b.alerts.total - a.alerts.total,
        line: (a, b) => a.lineName.localeCompare(b.lineName) || a.name.localeCompare(b.name),
      }
      items = [...items].sort(sorters[p.sort] ?? sorters.name)

      const page = Number(p.page ?? 1)
      const pageSize = Number(p.pageSize ?? 25)

      return {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total: items.length,
        page,
        pageSize,
        siteId,
        /* Counted over EVERY asset at the site, not over the filtered set. A
           chip that reports how many rows are left after it was applied cannot
           be read as "how many are there", which is the question a facet count
           answers. */
        facets: {
          all: all.length,
          critical: all.filter((a) => a.alerts.critical > 0).length,
          alerts: all.filter((a) => a.alerts.total > 0).length,
          offline: all.filter((a) => !a.online).length,
        },
        options: {
          types: [...new Set(all.map((a) => a.type))].sort(),
          criticalities: [...new Set(all.map((a) => a.criticality))],
          owners: [...new Map(all.map((a) => [a.ownerId, a.ownerName])).entries()]
            .filter(([id]) => id)
            .map(([id, name]) => ({ id, name })),
          tags: [...new Set(all.flatMap((a) => a.tags ?? []))].sort(),
          /* Floor and building ride along because the floor map groups by them.
             They are properties of the line, so they come from the line rather
             than being re-derived in the component from a lookup that would then
             be a second place the plant is described. */
          lines: lineNodesForSite(siteId).map((line) => ({
            id: line.id,
            name: line.name,
            floor: LINE_OPS[line.id]?.floor ?? 1,
            building: LINE_OPS[line.id]?.building ?? null,
            count: all.filter((a) => a.lineId === line.id).length,
          })),
        },
        /* The stat bar's five cards, computed over the whole site for the same
           reason. Work orders come from their own fixture so the number agrees
           with the Work Orders module when it lands. */
        stats: {
          total: all.length,
          online: all.filter((a) => a.online).length,
          offline: all.filter((a) => !a.online).length,
          avgHealth: all.length
            ? Math.round(all.reduce((sum, a) => sum + (a.health ?? 0), 0) / all.length)
            : 0,
          good: all.filter((a) => (a.health ?? 0) >= 80).length,
          watch: all.filter((a) => (a.health ?? 0) >= 50 && (a.health ?? 0) < 80).length,
          poor: all.filter((a) => (a.health ?? 0) < 50).length,
          alerts: all.reduce((sum, a) => sum + a.alerts.total, 0),
          alertsCritical: all.filter((a) => a.alerts.critical > 0).length,
          alertsHigh: all.filter((a) => a.alerts.high > 0).length,
          workOrders: allWorkOrders().filter(isOpenOrder).length,
          workOrdersUrgent: allWorkOrders().filter(
            (order) => isOpenOrder(order) && order.priority === 'urgent',
          ).length,
        },
      }
    },
  },
  {
    method: 'post',
    match: /^\/v1\/assets\/import$/,
    /* Actually creates them. The rows land in `HIERARCHY_NODES` and `ASSET_OPS`,
       so an imported asset shows up in the table, on its line, in the floor map
       and in the line's asset count — which is the only way a reader can tell
       the wizard did anything.

       Module state, like every other write in this file, so it survives a
       navigation and resets on reload. */
    handler: (cfg) => {
      const body = cfg.data ? JSON.parse(cfg.data) : {}
      const rows = body.rows ?? []
      const skipDuplicates = body.duplicates === 'skip'
      const siteId = body.siteId ?? HOME_CONTEXT.siteId
      const lines = lineNodesForSite(siteId)

      let created = 0
      let updated = 0
      let skipped = 0

      for (const row of rows) {
        const line = lines.find((entry) => entry.name === row.line)
        if (!line) {
          skipped += 1
          continue
        }
        const existing = HIERARCHY_NODES.find((node) => node.tier === 'asset' && node.id === row.code)
        if (existing && skipDuplicates) {
          skipped += 1
          continue
        }

        const ops = {
          type: row.type,
          vendor: row.vendor ?? '—',
          model: row.model ?? '—',
          installed: row.installed ?? '—',
          runHours: 0,
          sensorCount: row.sensors.length,
          criticality: row.criticality,
          // The owner arrives as a name; the record holds an id. Unmatched names
          // are left unresolved rather than invented — an import cannot conjure
          // a person into the directory.
          ownerId:
            Object.values(PEOPLE).find((person) => person.name === row.owner)?.id ?? null,
          online: true,
          health: 100,
          throughput: null,
          oee: null,
          nextPMHours: 2000,
          lastSeenMinutes: 0,
          tags: ['imported'],
          sensors: row.sensors,
        }

        if (existing) {
          existing.name = row.name
          ASSET_OPS[row.code] = { ...ASSET_OPS[row.code], ...ops }
          updated += 1
        } else {
          HIERARCHY_NODES.push({
            id: row.code,
            tier: 'asset',
            parentId: line.id,
            name: row.name,
            code: row.code,
          })
          ASSET_OPS[row.code] = ops
          created += 1
        }
      }

      return { created, updated, skipped, total: rows.length }
    },
  },
  {
    method: 'post',
    match: /^\/v1\/assets\/([^/]+)\/documents$/,
    // Appends to the session's store, so the register the modal closed over
    // actually gains a row. See `UPLOADED` in fixtures/lines.js.
    handler: (cfg, [assetId]) => {
      const body = cfg.data ? JSON.parse(cfg.data) : {}
      return addAssetDocument(assetId, body)
    },
  },
  {
    method: 'get',
    match: /^\/v1\/assets\/([^/]+)$/,
    handler: (_cfg, [assetId]) => {
      const node = HIERARCHY_NODES.find((n) => n.tier === 'asset' && n.id === assetId)
      if (!node) return null
      const line = HIERARCHY_NODES.find((n) => n.id === node.parentId)
      const site = line ? HIERARCHY_NODES.find((n) => n.id === line.parentId) : null
      return {
        ...composeAsset(node),
        lineName: line?.name ?? null,
        siteId: site?.id ?? null,
        siteName: site?.name ?? null,
        /* The full chain from the account down, for the tree and the relations
           card. Walked from `HIERARCHY_NODES` rather than assembled in the
           client: the client holds one asset, not the tree above it, and a
           screen that reconstructs a path from three denormalised fields is a
           screen that shows the wrong one the day a line moves site. */
        path: (() => {
          const chain = []
          let current = node
          while (current) {
            chain.unshift({ id: current.id, name: current.name, tier: current.tier, code: current.code })
            current = HIERARCHY_NODES.find((entry) => entry.id === current.parentId)
          }
          return chain
        })(),
        lineUnit: LINE_OPS[line?.id]?.unit ?? null,
        lineTarget: LINE_OPS[line?.id]?.target ?? null,
        /* Only two machines are modelled to component depth, and an empty array
           is the honest answer for the rest rather than an invented tree. The
           screen renders that state deliberately. */
        components: ASSET_COMPONENTS[assetId] ?? [],
        /* This asset's own open alerts, PLUS any alert a sensor on it points at.
           The Washer's coolant-flow instrument reads the supply that failed on
           Compressor C-12, so the record explaining its zero belongs to another
           asset. Without this the card would show a dead instrument and no
           reason for it — and the screen would be quietly less informative than
           the fixture behind it.

           The `alerts` summary above is NOT widened the same way: the count is
           how many anomalies are open on this machine, and borrowing another
           asset's would overstate it. */
        openAlerts: (() => {
          const own = liveAlerts().filter((alert) => alert.assetId === assetId)
          const referenced = (ASSET_COMPONENTS[assetId] ?? [])
            .flatMap((component) => component.sensors)
            .map((sensor) => sensor.alertId)
            .filter(Boolean)
          const extra = liveAlerts().filter(
            (alert) => referenced.includes(alert.id) && !own.includes(alert),
          )
          return [...own, ...extra].map(withTimes)
        })(),
        ...(() => {
          /* The AI Synopsis view. Everything here is composed from the record
             above rather than authored per asset — the prototype writes one
             briefing and shows it on all thirty machines, so every one of them
             claims a drive-end bearing at 13.7× baseline. See `lines.js`. */
          const own = liveAlerts()
            .filter((alert) => alert.assetId === assetId)
            .sort(
              (a, b) =>
                RANK[a.severity] - RANK[b.severity] || a.detectedMinutesAgo - b.detectedMinutesAgo,
            )
          const ops = ASSET_OPS[assetId] ?? {}
          const componentOfWorst = own[0]?.component
          const performance = assetPerformance(assetId, ops)
          return {
            briefing: assetBriefing({ id: assetId, name: node.name, ...ops }, own, componentOfWorst),
            performance: performance.kpis,
            // Keyed by window: the card's chips switch between them without a
            // refetch, because they are five views of one shift.
            oeeTrend: assetOeeWindows(assetId, ops),
            /* The Detailed view's Overview. Same rule as the briefing: composed
               from this asset's own record, so no two machines show one
               screen's worth of borrowed numbers. */
            statusHistory: assetStatusHistory(assetId, ops),
            // The SITE's unit system, not a default: Weißenthurm's press reads
            // mm/s and its own alert says so.
            signals: assetSignals(assetId, ops, site?.unitSystem),
            pareto: assetPareto(assetId, ops),
            /* One set of events feeds the Overview's heatmap AND the Alert
               History tab's table, tiles and splits. The prototype authors all
               four separately and they disagree — 18 in the table, 178 in the
               heatmap, 4 rows on screen. */
            alertHistory: assetAlertHistory(assetId, ops, own),
            workOrders: assetWorkOrders(
              assetId,
              ops,
              allWorkOrders().filter((order) => order.assetId === assetId && isOpenOrder(order)),
            ),
            documents: assetDocuments(assetId),
            maintenance: assetMaintenance(assetId, ops),
            bom: assetBom(assetId, ops),
            insights: assetInsights(assetId, ops, own),
            audit: assetAudit(
              assetId,
              ops,
              own,
              allWorkOrders().filter((order) => order.assetId === assetId && isOpenOrder(order)),
            ),
            timeline: assetTimeline(
              assetId,
              ops,
              own,
              allWorkOrders().filter((order) => order.assetId === assetId && isOpenOrder(order)),
            ),
            /* At a glance. Work orders and sensor counts are read off the same
               fixtures the other screens read, so this strip cannot claim three
               open work orders while the Work Orders module shows one. */
            atAGlance: {
              openAlerts: own.length,
              workOrders: allWorkOrders().filter(
                (order) => order.assetId === assetId && isOpenOrder(order),
              ).length,
              sensorsOnline: ops.online ? (ops.sensorCount ?? 0) : 0,
              sensorCount: ops.sensorCount ?? 0,
              nextPMHours: ops.nextPMHours ?? null,
              runHours: ops.runHours ?? null,
            },
          }
        })(),
      }
    },
  },

  /* ── Sensor Explorer · DEMO ─────────────────────────────────────────
     The scope tree, counted off the channel catalogue. Literal path, declared
     before the parameterised `/signals/:id` below it — same ordering rule as
     `/handovers/latest`.

     It answers the whole tree every time and is deliberately NOT narrowed by the
     current scope: the selector has to keep showing the plant you could move to,
     with the counts you would get if you did. */
  {
    method: 'get',
    match: /^\/v1\/signals\/scopes$/,
    handler: () => ({ items: scopeTree(), total: SIGNAL_CHANNELS.length }),
  },
  {
    method: 'get',
    match: /^\/v1\/signals$/,
    /* Scoped, filtered, searched and sorted SERVER-SIDE. Fifty channels would fit
       in one client-side pass; four thousand would not, and the params object the
       screen already sends is the one a real query needs. Same seam as `/assets`.

       Not paginated, and that is a decision rather than an omission: the grid is
       a wall of traces somebody scans for the shape that is wrong, and a wall
       showing rows 26–50 of a plant answers a different question. The count in
       the header says how many are drawn. */
    handler: (cfg) => {
      const p = cfg.params ?? {}
      const spec = windowSpec(p)

      const scoped = channelsInScope(p.scope)
      let items = scoped

      if (p.state && p.state !== 'all') items = items.filter((c) => stateOf(c) === p.state)
      if (p.kind && p.kind !== 'all') items = items.filter((c) => c.kind === p.kind)
      if (p.assetId && p.assetId !== 'all') items = items.filter((c) => c.assetId === p.assetId)
      if (p.lineId && p.lineId !== 'all') items = items.filter((c) => c.lineId === p.lineId)
      if (p.stream && p.stream !== 'all')
        items = items.filter((c) => (p.stream === 'online' ? c.online : !c.online))

      if (p.q) {
        const q = String(p.q).toLowerCase()
        items = items.filter((c) =>
          [c.name, c.key, c.tag, c.assetName, c.assetCode, c.lineName].join(' ').toLowerCase().includes(q),
        )
      }

      /* Worst first by default, because the reason to open this screen is to find
         the instrument that is wrong. `plant` is the hierarchy's own order, for
         when the question is "walk me down the line" instead. */
      const RANK_STATE = { violation: 0, warning: 1, ok: 2 }
      const sorters = {
        severity: (a, b) =>
          RANK_STATE[stateOf(a)] - RANK_STATE[stateOf(b)] ||
          a.assetName.localeCompare(b.assetName) ||
          a.name.localeCompare(b.name),
        plant: () => 0,
        name: (a, b) => a.name.localeCompare(b.name) || a.assetName.localeCompare(b.assetName),
        asset: (a, b) => a.assetName.localeCompare(b.assetName) || a.name.localeCompare(b.name),
      }
      items = [...items].sort(sorters[p.sort] ?? sorters.severity)

      return {
        items: items.map((channel) => composeChannel(channel, spec)),
        total: items.length,
        window: spec.key,
        // Echoed back so the header can name the span in force without
        // re-deriving it from two controls that might disagree.
        span: { hours: spec.hours, points: spec.points, from: spec.from ?? null, to: spec.to ?? null },
        /* Counted over the SCOPE, not over the filtered set — a chip that reports
           what is left after it was applied cannot answer "how many are there".
           Same rule as the asset facets. */
        facets: {
          all: scoped.length,
          violation: scoped.filter((c) => stateOf(c) === 'violation').length,
          warning: scoped.filter((c) => stateOf(c) === 'warning').length,
          ok: scoped.filter((c) => stateOf(c) === 'ok').length,
          /* Sent even though nothing at Meridian is offline today, and the
             drawer prints the zero. An option that silently matches nothing is a
             dead control; a labelled zero is an answer. */
          online: scoped.filter((c) => c.online).length,
          offline: scoped.filter((c) => !c.online).length,
        },
        options: {
          kinds: [...new Set(scoped.map((c) => c.kind).filter(Boolean))].sort(),
          assets: [...new Map(scoped.map((c) => [c.assetId, c.assetName])).entries()].map(
            ([id, name]) => ({ id, name }),
          ),
          /* Qualified by site whenever the scope spans more than one, because
             Findlay and Pune both have a line called "Line 1" and a select
             offering it twice is a select nobody can use. */
          lines: (() => {
            const spansSites = new Set(scoped.map((c) => c.siteId)).size > 1
            return [...new Map(scoped.map((c) => [c.lineId, c])).entries()]
              .filter(([id]) => id)
              .map(([id, c]) => ({
                id,
                name: spansSites ? `${c.siteName} · ${c.lineName}` : c.lineName,
              }))
          })(),
        },
        /* The one connector in `CONNECTORS` that declares `signals` among what it
           provides. Sent rather than assumed, so the drawer states where these
           readings come from instead of offering a source filter with three
           options that match nothing. */
        source: (() => {
          const connector = CONNECTORS.find((entry) => entry.provides.includes('signals'))
          return connector
            ? {
                id: connector.id,
                family: connector.family,
                protocol: connector.protocol,
                state: connector.state,
                // An instant, not "14m". A relative label computed here is a lie
                // by the second render; the client formats it. Same rule as
                // `lastSeenAt` on an asset.
                lastSyncAt: new Date(Date.now() - connector.lastSyncMinutesAgo * 60_000).toISOString(),
              }
            : null
        })(),
      }
    },
  },
  {
    method: 'get',
    match: /^\/v1\/signals\/([^/]+)$/,
    handler: (cfg, [signalId]) => {
      const channel = SIGNAL_CHANNELS.find((entry) => entry.id === decodeURIComponent(signalId))
      if (!channel) return null
      return {
        ...composeChannel(channel, windowSpec(cfg.params ?? {})),
        // The alert record itself, not just its id: the card links to it and
        // names its reading, and a second round trip to print one sentence is a
        // slower screen for nothing.
        alert: channel.alertId
          ? withTimes(ALERTS.find((entry) => entry.id === channel.alertId))
          : null,
      }
    },
  },

  /* ── Shifts · DEMO ──────────────────────────────────────────────────
     The week's roster. Filtered server-side, and the rollup, the crew list and
     the AI synopsis are all counted off the FILTERED set — because "Just me"
     has to change the figures, which is the only reason a personal view is
     worth having. The prototype computes its KPI strip from the scoped set and
     its crew list from the unscoped one, so the two disagree the moment the
     toggle moves.

     Composed rather than stored — see `fixtures/shifts.js`. */
  {
    method: 'get',
    match: /^\/v1\/shifts$/,
    handler: (cfg) => {
      const p = cfg.params ?? {}
      /* No `days` means "pick for me" — see `defaultShiftRange`. The answer
         travels back on the payload so the range control can light the chip that
         is actually in force rather than assuming seven. */
      const days = Number(p.days) || defaultShiftRange()
      const all = shiftsForWeek(Date.now(), days)

      /* "Just me" first, and NOT falling back to everyone when the reader has no
         shifts. The prototype does exactly that — `(scope === "me" && byMe.length)
         ? byMe : SHIFTS` — so a toggle reading "Just me" silently lists the whole
         crew's week. An empty personal week is an answer. */
      const scoped = p.mine ? all.filter((row) => row.operatorId === p.mine) : all

      let items = scoped
      if (p.type && p.type !== 'all') items = items.filter((row) => row.type === p.type)
      if (p.status && p.status !== 'all') items = items.filter((row) => row.status === p.status)
      if (p.operatorId && p.operatorId !== 'all')
        items = items.filter((row) => row.operatorId === p.operatorId)

      /* Newest first — a roster is read from the shift that just ended
         backwards, not from a week ago forwards. */
      const ordered = [...items].sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))

      const page = Number(p.page ?? 1)
      const pageSize = Number(p.pageSize ?? 10)

      /* Each row carries the anomaly records it names, not only their ids: the
         detail panel lists them, and a request per selected shift to print three
         lines is a spinner over data this response already has. */
      const withAlerts = (row) => ({
        ...row,
        anomalies: row.anomalyIds
          .map((id) => ALERTS.find((alert) => alert.id === id))
          .filter(Boolean)
          .map((alert) => ({
            id: alert.id,
            severity: alert.severity,
            sensor: alert.sensor,
            assetId: alert.assetId,
            assetName: alert.assetName,
            status: alert.status,
          })),
        workOrders: row.workOrderIds
          .map((id) => allWorkOrders().find((order) => order.id === id))
          .filter(Boolean)
          .map((order) => ({ id: order.id, title: order.title, state: order.state })),
      })

      return {
        items: ordered.slice((page - 1) * pageSize, page * pageSize).map(withAlerts),
        total: ordered.length,
        page,
        pageSize,
        // Over the scope, not the narrowed set: the strip answers "what did this
        // week look like", which a type filter does not change.
        stats: shiftStats(scoped),
        synopsis: shiftSynopsis(scoped, shiftStats(scoped)),
        /* The handover the running shift is about to file. Composed rather than
           borrowed: a shift that has not ended has no record, and the design's
           modal fills a template with the shift's numbers, which is why every
           shift in it carries "monitor C-12 coolant trend" whatever happened. */
        draftHandover: (() => {
          const running = scoped.find((row) => row.status === 'active')
          if (!running) return null
          const composed = withAlerts(running)
          return draftHandoverFor(running, composed.anomalies, composed.workOrders)
        })(),
        // Manager view only in the client, but always computed — the handler has
        // no business knowing which role is reading it.
        crew: crewPerformance(scoped),
        days,
        options: {
          types: SHIFT_TYPES,
          operators: CREW.map((person) => ({ id: person.id, name: person.name })),
          ranges: SHIFT_RANGES,
        },
      }
    },
  },

  {
    method: 'post',
    match: /^\/v1\/shifts$/,
    /* Assigning a scheduled shift. The design's Schedule button does nothing;
       this writes, and the roster, the crew table and the KPI strip all move.

       Rejects a shift that has already run with a 422 rather than accepting it
       quietly: reassigning yesterday's night shift is rewriting who was there,
       which is not an edit anybody should be able to make from a dialog. */
    handler: (cfg) => {
      const body = cfg.data ? JSON.parse(cfg.data) : {}
      const result = assignShift(body)
      if (result.error === 'notFound') return null
      if (result.error) throw fail(422, 'validation', cfg)
      return result.shift
    },
  },

  /* ── Notifications · DEMO ───────────────────────────────────────────
     The alert-rule configuration. Rules, the channels they deliver through and
     the escalation ladder come back together because the useful facts are the
     JOINS: a live rule pointing at an unconfigured channel, an open anomaly no
     enabled rule covers. Split across three requests, neither is computable
     without holding all three anyway.

     Composed — see `fixtures/notifications.js`. A rule's threshold is read from
     `SIGNAL_SPEC`, so it is the same edge the Sensor Explorer draws and the same
     one `ALR-4471` trips at. */
  {
    method: 'get',
    match: /^\/v1\/notifications$/,
    handler: () => ({
      rules: allRules().map((rule) => composeRule(rule)),
      channels: composeChannels(),
      escalation: composeEscalation(),
      stats: notificationStats(),
      /* What a new rule may watch: the kinds the plant actually instruments. A
         rule on a sensor nothing reports can never fire. */
      kinds: ruleKinds(),
      /* Personal delivery settings, on the same payload as the org's routing.
         Two subjects, one screen, and the card says which is which — a digest
         is mine and a rule is everybody's. */
      preferences: composePreferences(),
    }),
  },
  {
    method: 'patch',
    match: /^\/v1\/notifications\/preferences\/([\w-]+)$/,
    handler: (cfg, [id]) => setPreference(id, JSON.parse(cfg.data ?? '{}').on),
  },
  {
    method: 'put',
    match: /^\/v1\/notifications\/rules\/([\w-]+)$/,
    handler: (cfg, [id]) => updateRule(id, JSON.parse(cfg.data ?? '{}')),
  },
  {
    method: 'delete',
    match: /^\/v1\/notifications\/rules\/([\w-]+)$/,
    handler: (_cfg, [id]) => removeRule(id),
  },
  {
    method: 'patch',
    match: /^\/v1\/notifications\/channels\/([\w-]+)$/,
    handler: (cfg, [id]) => configureChannel(id, JSON.parse(cfg.data ?? '{}').target),
  },
  {
    method: 'post',
    match: /^\/v1\/notifications\/channels\/([\w-]+)\/test$/,
    handler: (_cfg, [id]) => testChannel(id),
  },
  {
    method: 'post',
    match: /^\/v1\/notifications\/escalation$/,
    handler: (cfg) => addEscalationLevel(JSON.parse(cfg.data ?? '{}')),
  },

  {
    method: 'post',
    match: /^\/v1\/notifications\/rules$/,
    handler: (cfg) => {
      const body = cfg.data ? JSON.parse(cfg.data) : {}
      const result = addRule(body)
      if (result.error) throw fail(422, 'validation', cfg)
      return result.rule
    },
  },

  {
    /* The toggle, and ONLY the toggle. Everything else about a rule is an edit
       and an edit is the dialog — a PATCH that accepted a new threshold would
       be a way to put a limit on this screen that the detector does not use. */
    method: 'patch',
    match: /^\/v1\/notifications\/rules\/([\w-]+)$/,
    handler: (cfg, [id]) => {
      const body = cfg.data ? JSON.parse(cfg.data) : {}
      if (typeof body.enabled !== 'boolean') throw fail(422, 'validation', cfg)
      const result = setRuleEnabled(id, body.enabled)
      if (result.error === 'notFound') return null
      return result.rule
    },
  },

  /* ── Executive Dashboard · DEMO ─────────────────────────────────────
     Composed — see `fixtures/executive.js`. The alert counts are read off the
     alert list rather than the authored `SITE_HEALTH` numbers, so this screen
     and the anomaly list cannot disagree about one plant. */
  {
    method: 'get',
    match: /^\/v1\/executive$/,
    handler: () => {
      const sites = siteRollups()
      const stats = enterpriseStats(sites)
      return { sites, stats, brief: executiveBrief(sites, stats) }
    },
  },

  /* ── Analytics & Reports · DEMO ─────────────────────────────────────
     The shelf. `generating` is not a stored flag — a report started less than
     forty-five seconds ago is still building, and the same request answers
     `ready` once that has passed. So the client polls while anything is running
     and the badge changes under the reader, which is what the design's static
     "Generating" pretends to be. */
  {
    method: 'get',
    match: /^\/v1\/reports$/,
    handler: () => {
      const items = allReports()
        .map((report) => composeReport(report))
        .sort((a, b) => {
          // Generating first — it is the only row anybody is waiting on — then
          // newest finished.
          if (a.status !== b.status) return a.status === 'generating' ? -1 : 1
          return Date.parse(b.generatedAt ?? 0) - Date.parse(a.generatedAt ?? 0)
        })
      return {
        items,
        total: items.length,
        stats: reportStats(items),
        options: { kinds: REPORT_KINDS, periods: REPORT_PERIODS, sites: currentSites() },
      }
    },
  },

  /* The catalogue. Static for the life of the session — thirty-four templates,
     their categories, the sections a build assembles from, and the delivery
     schedule. Cached hard on the client: it is a specification, not state. */
  {
    method: 'get',
    match: /^\/v1\/reports\/library$/,
    handler: () => reportLibrary(),
  },

  {
    method: 'post',
    match: /^\/v1\/reports$/,
    /* Generate New. The design's button does nothing; this creates a row that
       genuinely is not ready, with a percentage that moves. Attributed to the
       demo persona for the same reason a logbook entry is — the client does not
       get to name the author. */
    handler: (cfg) => {
      const body = cfg.data ? JSON.parse(cfg.data) : {}
      const result = generateReport(body, 'manager')
      if (result.error) throw fail(422, 'validation', cfg)
      return result.report
    },
  },

  /* ── Logbook · DEMO ─────────────────────────────────────────────────
     The operator log. Composed rather than stored — see `fixtures/logbook.js`:
     the author and the shift come from the roster, the machine from the
     hierarchy, and the "AI Analyzed" badge from whether an investigation
     actually cited the note.

     Filtered server-side, all of it, and the rollup and the machine list are
     counted off the FILTERED rows — narrowing to one machine has to move the
     figures above the feed or they are decoration. */
  {
    method: 'get',
    match: /^\/v1\/logbook$/,
    handler: (cfg) => {
      const p = cfg.params ?? {}
      const now = Date.now()
      const all = logEntries(now)

      let items = all
      if (p.assetId && p.assetId !== 'all')
        items = items.filter((row) => row.assetId === p.assetId)
      if (p.shiftId) items = items.filter((row) => row.shiftId === p.shiftId)
      if (p.cited === 'true') items = items.filter((row) => row.cited)

      /* Search last, so the expansion chip reports what it matched inside the
         filtered set rather than across the whole log. */
      const { rows, expanded } = searchEntries(items, p.q)

      return {
        items: rows,
        total: rows.length,
        /* Over the whole log, not the filtered set: this is the "of 12" in
           "showing 3 of 12", and counting it off the narrowed rows would make
           it say "3 of 3". */
        grandTotal: all.length,
        expanded,
        /* The machine filter's options, off the UNFILTERED log — a list that
           shrank to the one machine already selected could never be changed. */
        assets: logbookAssets(all),
        /* The composer's options: every machine on the plant, which is a
           different list from the one above. Filtering by a machine nobody has
           written about is pointless; writing about one is the ordinary case. */
        plant: plantAssets(),
        /* Who the server will attribute a new entry to. Sent with the list so
           the composer's byline is the name that will actually go on the
           record, rather than the client guessing and being wrong. */
        author: (() => {
          const person = CREW.find((entry) => entry.id === SELF) ?? null
          return person
            ? { id: person.id, name: person.name, initials: person.initials, role: person.role }
            : null
        })(),
        /* The shift running now, so the composer can say which one the entry
           will be filed against — derived from the clock, like everything else
           about a shift. */
        shift: (() => {
          const running = shiftsForWeek(now, 7).find((row) => row.status === 'active')
          return running ? { id: running.id, type: running.type } : null
        })(),
      }
    },
  },

  {
    method: 'post',
    match: /^\/v1\/logbook$/,
    /* Writing an entry. The design's composer discards everything it collects —
       Submit closes the card and fires a toast — so its equipment select and
       tags field are decoration on a form that saves nothing.

       The AUTHOR is stamped here and is not read from the body. A real service
       takes it from the token; this one has no token, so it stamps the demo
       persona. Either way the client does not get to choose whose name goes on
       a record, which is the same rule that forces `authoredBy: 'human'` on a
       work order raised through a form. */
    handler: (cfg) => {
      const body = cfg.data ? JSON.parse(cfg.data) : {}
      const result = addLogEntry(body, SELF)
      if (result.error) throw fail(422, 'validation', cfg)
      return result.entry
    },
  },

  /* ── Timeseries Workstation · DEMO ──────────────────────────────────
     The catalogue. Each card's sensor count is `chartChannels().length` and NOT
     an authored number beside it — the prototype writes `s: 12` on a chart with
     no series at all and `s: 4` beside a four-series array, so one of its eight
     cards is lying and there is no way to tell which from reading it. */
  {
    method: 'get',
    match: /^\/v1\/charts$/,
    handler: () => ({
      items: allCharts().map((chart) => {
        const members = chartChannels(chart)
        return {
          id: chart.id,
          // Composed where nobody named it — the same helper the Workstation's
          // own header uses, so a card and the screen it opens agree.
          name: chartName(chart, members),
          named: Boolean(chart.name),
          created: Boolean(chart.created),
          sensorCount: members.length,
          author: PEOPLE[chart.authorRole]?.name ?? null,
          savedAt: new Date(Date.now() - chart.ageDays * 86_400_000).toISOString(),
          assetCount: new Set(members.map((channel) => channel.assetId)).size,
          // The worst state among the chart's own channels, so a card can say
          // which saved view is worth opening first.
          worst: members.some((channel) => stateOf(channel) === 'violation')
            ? 'violation'
            : members.some((channel) => stateOf(channel) === 'warning')
              ? 'warning'
              : 'ok',
        }
      }),
    }),
  },
  {
    method: 'post',
    match: /^\/v1\/charts$/,
    // Actually creates it. The chart appears in the catalogue and opens in the
    // Workstation; the prototype's New Chart dialog closes and forgets.
    handler: (cfg) => addChart(cfg.data ? JSON.parse(cfg.data) : {}),
  },
  {
    method: 'get',
    match: /^\/v1\/charts\/([^/]+)$/,
    handler: (cfg, [chartId]) => {
      const params = cfg.params ?? {}
      /* `adhoc` is a chart nobody saved — the Workstation opened from a channel
         card, or from a selection. Composed exactly like a stored one so the
         screen cannot tell the difference, which is what lets Save be a POST
         rather than a second code path. */
      if (chartId === 'adhoc') {
        const signalIds = String(params.signals ?? '')
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean)
        if (signalIds.length === 0) return null
        return composeChart(
          { id: 'adhoc', name: null, signalIds, authorRole: 'manager', ageDays: 0, created: true },
          params,
        )
      }
      const chart = allCharts().find((entry) => entry.id === chartId)
      if (!chart) return null
      /* `?signals=` overrides the stored membership, which is what makes Add
         Series and Remove Series work on a saved chart without writing to it:
         the URL carries the reader's version and the record is untouched until
         they save it as a new chart. */
      const signals = String(params.signals ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
      return composeChart(signals.length ? { ...chart, signalIds: signals } : chart, params)
    },
  },

  /* ── OEE & Production Performance · DEMO ────────────────────────────
     `?period=day|week|month`, from the header chips. The day window's headline
     OEE is read off `TOPLINE` rather than out of the OEE fixture, so the top
     bar, the home KPI strip and this screen cannot report three different
     numbers for the same shift.

     The waterfall is COMPUTED here from availability, performance and quality
     rather than authored beside them. The prototype writes both and they
     disagree; deriving one from the other means the five rows always land on the
     headline figure, whatever anyone edits in the fixture. */
  {
    method: 'get',
    match: /^\/v1\/oee\/summary$/,
    handler: (cfg) => {
      const period = OEE_PERIODS.includes(cfg.params?.period) ? cfg.params.period : 'day'
      const spec = OEE_PERIOD_DATA[period]

      const availability = spec.availability
      const performance = spec.performance
      const quality = spec.quality
      const oee = spec.oee ?? { value: TOPLINE.oee.value, deltaPts: TOPLINE.oee.deltaPts }

      // The cascade. Each stage takes its cut of what the stage before it left,
      // which is what makes the three losses sum to exactly 100 − OEE.
      const afterAvailability = availability.value
      const afterPerformance = afterAvailability * (performance.value / 100)
      const afterQuality = afterPerformance * (quality.value / 100)
      const round = (n) => Math.round(n * 10) / 10

      /* Rounding to one decimal breaks the sum. The day window's exact losses
         are 15.03, 10.03 and 0.75, which display as 15.0, 10.0 and 0.7 — and a
         reader adding the printed column gets 74.3 against a headline of 74.2.
         A waterfall you cannot add up is worse than no waterfall.

         So the residue goes onto the LARGEST loss, where a tenth of a point is
         invisible. Putting it on the smallest would move quality loss by 14% of
         itself to tidy up a rounding error in a different row. */
      const exact = [
        100 - afterAvailability,
        afterAvailability - afterPerformance,
        afterPerformance - afterQuality,
      ]
      const losses = exact.map(round)
      const residue = round(round(100 - afterQuality) - losses.reduce((a, b) => a + b, 0))
      const largest = exact.indexOf(Math.max(...exact))
      losses[largest] = round(losses[largest] + residue)

      return {
        period,
        band: OEE_BAND,
        target: OEE_TARGET,
        kpis: [
          /* Every card carries the tone of its own trace, OEE included, so the
             strip and the chart under it are one legend. The prototype leaves
             the OEE card untoned, which works there because its chart draws a
             single line and there is nothing to key the card to; ours draws
             four, and the headline being the only colourless one of the set read
             as an oversight rather than as a distinction. */
          { key: 'oee', icon: 'gauge', tone: 'forge', ...oee },
          { key: 'availability', icon: 'bolt', tone: 'ack', ...availability },
          { key: 'performance', icon: 'chart', tone: 'green', ...performance },
          { key: 'quality', icon: 'shield', tone: 'violet', ...quality },
        ],
        trend: trendFor(period, oee.value),
        /* `span` is what the bar draws — the width of the drop on a 0–100 scale
           — and `value` is what the row prints. They differ for the first and
           last rows, which are levels rather than losses. */
        waterfall: [
          { key: 'planned', tone: null, value: 100, span: 100 },
          { key: 'unplannedDowntime', tone: 'red', value: -losses[0], span: losses[0] },
          { key: 'speedLoss', tone: 'amber', value: -losses[1], span: losses[1] },
          { key: 'qualityLoss', tone: 'violet', value: -losses[2], span: losses[2] },
          // The headline figure itself, not a second calculation of it, so the
          // last row of the waterfall and the first KPI card are one number.
          { key: 'actual', tone: 'green', value: oee.value, span: oee.value },
        ],
        attribution: OEE_ATTRIBUTION[period],
      }
    },
  },
  {
    method: 'get',
    match: /^\/v1\/oee\/lines$/,
    /* Composed from the SAME source as `/v1/lines`, not from a list of its own.
       The first version of this route had its own four rows and they were wrong
       in a way nobody would have caught quickly: it put Ends Line 1 under
       Findlay, when the hierarchy has that line at Weißenthurm. Deriving both
       tables from `HIERARCHY_NODES` makes that class of mistake unrepresentable
       rather than merely fixed. */
    handler: (cfg) => {
      const siteId = cfg.params?.siteId ?? HOME_CONTEXT.siteId
      const items = lineNodesForSite(siteId)
        .map((node) => composeLine(node))
        .map((line) => ({
          id: line.id,
          name: line.name,
          status: line.state,
          oee: line.oee,
          topLoss: line.topLoss,
          target: OEE_TARGET,
          // An idle line has no OEE, so it has no gap either. Zero would read as
          // "on target", which is the opposite of what an unscheduled line means.
          gap: line.oee == null ? null : line.oee - OEE_TARGET,
        }))
      return { items, total: items.length }
    },
  },

  /* ── Home dashboard · DEMO ──────────────────────────────────────────
     Only reached when the screens behind `VITE_DEMO_MODE` are rendered; nothing
     requests these otherwise. Writes mutate the fixture arrays in place, the
     same way `/alerts/{id}/acknowledge` does, so a task ticked off or a handover
     published survives a navigation. */
  {
    method: 'get',
    match: /^\/v1\/home\/context$/,
    handler: () => ({ ...HOME_CONTEXT, asOf: new Date().toISOString() }),
  },
  {
    method: 'get',
    match: /^\/v1\/home\/kpis$/,
    handler: () => {
      // Two tiles are DERIVED from the alert fixture rather than authored, so the
      // strip and the list it links to can never contradict each other.
      const live = ALERTS.filter((a) => a.status !== 'resolved')
      const critical = live.filter((a) => a.severity === 'critical').length
      return {
        items: SHIFT_KPIS.map((kpi) => {
          if (kpi.key === 'anomaliesActive') return { ...kpi, value: live.length, critical }
          if (kpi.key === 'criticalAlerts') return { ...kpi, value: critical }
          return kpi
        }),
      }
    },
  },
  {
    method: 'get',
    match: /^\/v1\/home\/watched-assets$/,
    handler: () => ({ items: WATCHED_ASSETS }),
  },
  {
    method: 'get',
    match: /^\/v1\/home\/my-assets$/,
    handler: () => ({ items: MY_ASSETS }),
  },

  /* ── Tasks · DEMO ───────────────────────────────────────────────────── */
  {
    method: 'get',
    match: /^\/v1\/tasks$/,
    // People and assets ride along with the list so the create form has its
    // option sets without a second round trip for two arrays of six. `self` is
    // who "assigned to me" means — an id, so the filter never has to match on a
    // display name.
    /* `assignablePeople()` and not `TASK_PEOPLE`: the picker must not offer an
       account somebody has just locked, and the difference between the two is the
       whole reason they are separate. */
    handler: () => ({ items: TASKS, people: assignablePeople(), assets: TASK_ASSETS, self: SELF }),
  },
  {
    method: 'post',
    match: /^\/v1\/tasks$/,
    handler: (cfg) => {
      const body = cfg.data ? JSON.parse(cfg.data) : {}
      // Highest existing serial + 1, so ids stay ordered however many are added.
      const next = TASKS.reduce((max, task) => Math.max(max, Number(task.id.slice(4)) || 0), 2000) + 1
      const created = { ...body, id: `TSK-${next}` }
      TASKS.unshift(created)
      return created
    },
  },
  {
    method: 'put',
    match: /^\/v1\/tasks\/([^/]+)$/,
    handler: (cfg, [taskId]) => {
      const index = TASKS.findIndex((task) => task.id === taskId)
      if (index === -1) return null
      const body = cfg.data ? JSON.parse(cfg.data) : {}
      TASKS[index] = { ...TASKS[index], ...body, id: taskId }
      return TASKS[index]
    },
  },

  /* ── Handovers · DEMO ───────────────────────────────────────────────── */
  {
    method: 'get',
    match: /^\/v1\/handovers\/latest$/,
    // The most recent PUBLISHED record, not the newest row: the newest is a
    // draft, and a home card summarising a draft would be showing the reader
    // their own unfinished work as if the last shift had handed it over.
    handler: () => {
      const dated = datedHandovers()
      const latest = dated.find((h) => h.status !== 'draft') ?? dated[0]
      return { ...latest, report: { ...HANDOVER_REPORT, handoverId: latest.id } }
    },
  },
  {
    method: 'get',
    match: /^\/v1\/handovers$/,
    // Each row carries the report. There is one authored report and every row
    // opens it — the prototype does the same, and writing seven full reports to
    // disguise that would be six fabrications for no gain. Attaching it here
    // rather than making the table fetch a detail per row keeps the archive
    // one request; a real endpoint would return a summary and the modal would
    // fetch `handovers/{id}`.
    handler: () => ({
      items: datedHandovers().map((h) => ({ ...h, report: { ...HANDOVER_REPORT, handoverId: h.id } })),
      stats: HANDOVER_STATS,
    }),
  },
  {
    method: 'get',
    match: /^\/v1\/handovers\/([^/]+)$/,
    handler: (_cfg, [handoverId]) => {
      const handover = datedHandovers().find((h) => h.id === handoverId)
      if (!handover) return null
      return { ...handover, report: { ...HANDOVER_REPORT, handoverId } }
    },
  },
  {
    method: 'post',
    match: /^\/v1\/handovers$/,
    handler: (cfg) => {
      const body = cfg.data ? JSON.parse(cfg.data) : {}
      const draft = HANDOVERS.find((h) => h.status === 'draft')
      if (!draft) return null
      // Publishing turns the standing draft into a published record rather than
      // adding an eighth row: a shift hands over once.
      draft.status = body.status === 'draft' ? 'draft' : 'published'
      if (body.outgoing) draft.outgoing = body.outgoing
      if (body.incoming) draft.incoming = body.incoming
      if (body.summary) HANDOVER_REPORT.summary = body.summary
      return { ...draft, report: { ...HANDOVER_REPORT, handoverId: draft.id } }
    },
  },
  {
    method: 'post',
    match: /^\/v1\/handovers\/([^/]+)\/acknowledge$/,
    handler: (_cfg, [handoverId]) => {
      const handover = datedHandovers().find((h) => h.id === handoverId)
      if (!handover) return null
      handover.status = 'acknowledged'
      return { ...handover, report: { ...HANDOVER_REPORT, handoverId } }
    },
  },

  {
    method: 'get',
    match: /^\/v1\/briefing$/,
    handler: (cfg) => {
      const role = cfg.params?.role ?? CURRENT_USER.role
      const briefing = BRIEFINGS[role]
      if (!briefing) return null
      return {
        ...briefing,
        suggestions: BRIEFING_SUGGESTIONS[role] ?? [],
        // Stamped, because a generated brief nobody can date is a brief nobody
        // can tell is stale.
        generatedAt: new Date().toISOString(),
      }
    },
  },
]

/* ── Adapter ─────────────────────────────────────────────────────────── */

export async function mockAdapter(cfg) {
  // Strip the configured base so route patterns stay clean.
  const base = (cfg.baseURL ?? '').replace(/\/$/, '')
  let path = cfg.url ?? ''
  if (base && path.startsWith(base)) path = path.slice(base.length)
  path = path.split('?')[0]

  const method = (cfg.method ?? 'get').toLowerCase()

  await sleep(config.mockLatencyMs)

  // Cancellation must behave the same as it does over the wire.
  if (cfg.signal?.aborted) {
    const error = new Error('canceled')
    error.code = 'ERR_CANCELED'
    throw error
  }

  if (config.mockErrorRate > 0 && Math.random() < config.mockErrorRate) {
    throw fail(503, 'server', cfg)
  }

  for (const route of routes) {
    if (route.method !== method) continue
    const m = route.match.exec(path)
    if (!m) continue
    /* A throw from a handler is a BUG IN THIS FILE, not a transport failure —
       but axios cannot tell the difference: an error with no `response` is
       normalised as a network fault, so the screen says "cannot reach the
       platform" and the next hour goes into the wrong question. It happened
       once, over `PEOPLE.find` on an object.

       Turning it into a 500 keeps the request-shaped contract intact while the
       console carries the real stack. */
    let result
    try {
      result = route.handler(cfg, m.slice(1))
    } catch (error) {
      /* A `fail()` already carries a response, which means the handler MEANT it
         — a 422 for a state transition the workflow does not allow is a real
         answer, not a crash. Rethrowing it intact is what lets a handler reject
         something without the screen being told the backend is down. Anything
         else is a bug in this file and becomes a 500 with the stack logged. */
      if (error?.response) throw error
      console.error(`[mock] ${method.toUpperCase()} ${path} — handler threw`, error)
      throw fail(500, 'server', cfg)
    }
    if (result === null || result === undefined) throw fail(404, 'notFound', cfg)
    return ok(result, cfg)
  }

  throw fail(
    404,
    'notFound',
    cfg,
  )
}
