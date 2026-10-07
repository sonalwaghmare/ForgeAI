import { QueryClient } from '@tanstack/react-query'
import { ERROR_CODES } from './apiError'

/**
 * Defaults tuned for a plant floor rather than a marketing site.
 *
 * Sensor-derived data goes stale fast, so short staleness plus refetch on focus
 * is correct: an operator returning to the tab must not read a five-minute-old
 * anomaly count. Retries are limited to transport and 5xx faults — retrying a
 * 403 just fails three times slower.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false
        return Boolean(error?.retryable)
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      throwOnError: false,
    },
    mutations: {
      retry: (failureCount, error) => failureCount < 1 && error?.code === ERROR_CODES.NETWORK,
    },
  },
})

/**
 * Query keys in one place. A typo in an inline key array is a cache miss that
 * looks like a loading bug, so nothing constructs keys ad hoc.
 */
export const queryKeys = {
  session: ['session'],
  org: ['org'],
  entitlements: ['org', 'entitlements'],
  assetClasses: ['asset-classes'],
  hierarchy: ['hierarchy'],
  hierarchyNodes: ['hierarchy', 'nodes'],
  // One node's own record, for an edit form. The tree endpoint does not carry
  // `is_active` or `asset_class_id`, and a full-replace PUT built without them
  // would clear both.
  hierarchyNode: (tier, id) => ['hierarchy', 'node', tier, id],
  scopes: ['hierarchy', 'scopes'],
  site: (siteId) => ['hierarchy', 'site', siteId],
  /**
   * Anomalies — the live resource. `['alerts', …]` below is the fixture demo and
   * is a separate root on purpose: resolving an anomaly must not invalidate the
   * home screen's demo cards, and they answer from different endpoints.
   *
   * `params` is in the key because the list is filtered, sorted and paginated
   * server-side, so each combination is its own entry — same shape as `sensors`.
   * The facet counts ride along inside that response rather than having a key of
   * their own; there is no counts endpoint to cache separately.
   */
  anomalies: (params) => ['anomalies', 'list', params ?? {}],
  /**
   * The list prefix, for invalidating every cached page at once.
   *
   * Spelled here rather than inline at the call site so a write can sweep the list
   * WITHOUT also sweeping `['anomalies', 'detail', …]` and `['anomalies', 'rca',
   * …]`. Invalidating the whole `['anomalies']` root does hit those two, and on the
   * detail screen that means re-requesting a record the response just gave us and
   * interrupting an RCA poll for data that did not change.
   */
  anomaliesList: ['anomalies', 'list'],
  /* DEMO facets. Under the anomalies root so a list sweep refreshes them too, and
     its own leaf so nothing that writes an anomaly re-fetches a fixture. */
  anomalyDemoFacets: ['anomalies', 'demo-facets'],
  anomaly: (id) => ['anomalies', 'detail', id],
  // Under the anomaly root but its own leaf: requesting an analysis must not
  // invalidate the record it belongs to, and `useUpdateAnomaly`'s sweep of
  // `['anomalies']` should refetch it, since a resolved anomaly's analysis is
  // worth re-reading.
  anomalyRca: (id) => ['anomalies', 'rca', id],
  /**
   * What the copilot has been asked about one anomaly.
   *
   * Under a `copilot` root rather than the `anomalies` one, though it is keyed by
   * an anomaly id. `useUpdateAnomaly` sweeps `['anomalies']` wholesale, and
   * resolving a record does not change the conversation about it — filing this
   * under that root would refetch a transcript on every status change for nothing.
   */
  copilotAnomalyTurns: (id) => ['copilot', 'turns', 'anomaly', id],
  alerts: (params) => ['alerts', 'list', params ?? {}],
  alertCounts: (params) => ['alerts', 'counts', params ?? {}],
  alert: (id) => ['alerts', 'detail', id],
  alertAnalysis: (id) => ['alerts', 'analysis', id],
  topline: (scope) => ['kpis', 'topline', scope ?? 'org'],
  currentShift: ['shifts', 'current'],
  /* The roster. Keyed by its filters, which are applied server-side — including
     `mine`, because "just me" changes the KPI strip as well as the rows. */
  shifts: (params) => ['shifts', 'list', params ?? {}],
  /**
   * The logbook. Every filter is in the key because every one of them is
   * applied server-side — including the search, which expands the query and
   * answers with the terms it matched on. Two queries that differ only in their
   * text are two different answers, not one answer filtered twice.
   */
  logbook: (params) => ['logbook', 'list', params ?? {}],
  /**
   * Notifications. One key for the whole configuration: the rules table, the
   * channel list and the escalation ladder are three views of it, and toggling
   * a rule moves figures in all three.
   */
  notifications: ['notifications'],
  /**
   * Reports. One key, refetched on an interval while something is generating —
   * see the hook. Nothing here is per-filter, so nothing is in the key.
   */
  reports: ['reports'],
  reportLibrary: ['reports', 'library'],
  /* The enterprise rollup. No params — it is the whole estate by definition,
     and the scope selector does not narrow a board view. */
  executive: ['executive'],
  handover: ['shifts', 'handover'],
  connectorTypes: ['connector-types'],
  connections: ['connections'],
  connection: (id) => ['connections', 'detail', id],
  /**
   * Sensors are keyed under their own root, NOT under `['connections', …]`.
   *
   * Tempting, because a sensor list is always read for one connection — but
   * `useConnectionMutation` invalidates `queryKeys.connections` wholesale on every
   * connection write, and renaming a broker has no business refetching a 10,000-row
   * sensor page. The two resources invalidate on their own events.
   *
   * `params` is part of the key because the list is paginated and filtered
   * server-side, so each page is its own cache entry — same shape as `alerts`.
   */
  sensors: (params) => ['sensors', 'list', params ?? {}],
  sensor: (id) => ['sensors', 'detail', id],
  /**
   * Both are OUTSIDE the `['sensors', …]` root, for the same reason sensors sit
   * outside `['connections', …]` one line up.
   *
   * `useSensorMutation` invalidates `['sensors']` wholesale after every write, and
   * these two are global seeded master data with no create route — onboarding a
   * sensor cannot change the list of waveform shapes or the list of engineering
   * units. Keying them under that root would refetch both on every save, during
   * exactly the run where a sensor is onboarded dozens of times.
   *
   * Their endpoints ARE mounted under `/v1/sensors/…`, which is why this looks
   * inconsistent and is not: a cache key groups things that invalidate together,
   * and a URL groups things a router serves together. They are different
   * questions and here they have different answers.
   */
  waveformTypes: ['waveform-types'],
  valueUnits: ['value-units'],
  // Not the line above. This one is the public page's source-contract section,
  // reading the demo fixtures — unrelated resource, unrelated endpoint.
  connectors: ['data-fusion', 'connectors'],
  copilotThread: ['copilot', 'messages'],
  /* The Copilot screen's opening state — modes, chips, grounding. Its own key
     and not under the thread's: asking a question must not refetch the chips,
     and the dock's thread has nothing to do with either. */
  copilotPrompts: ['copilot', 'prompts'],
  briefing: (role) => ['briefing', role ?? 'default'],

  /**
   * OEE. The summary is keyed by period because the header chips swap the whole
   * payload — chips that refetch the same key would flash the previous window's
   * numbers on every switch. The line table has no period, so it has no
   * parameter and is fetched once.
   */
  oeeSummary: (period) => ['oee', 'summary', period ?? 'day'],
  oeeLines: ['oee', 'lines'],

  /**
   * Lines & Assets. The list is keyed by site because the scope selector
   * changes it; the detail and the asset are keyed by id.
   *
   * The asset key is `['assets', …]` rather than nested under its line: an asset
   * is reachable from four other modules without a line in hand, and a key that
   * required one would mean the same record cached twice.
   */
  productionLines: (siteId) => ['production-lines', 'list', siteId ?? 'default'],
  productionLine: (lineId) => ['production-lines', 'detail', lineId],
  /* `params` is in the key because the collection is filtered, sorted and paged
     server-side, so each combination is its own entry — same shape as `alerts`
     and `sensors`. */
  assets: (params) => ['assets', 'list', params ?? {}],
  asset: (assetId) => ['assets', 'detail', assetId],

  /**
   * Sensor Explorer. The channel list carries every filter AND the window in its
   * key, because the window changes the payload rather than only its label — a
   * shared key would draw a 30-day trace under a 1H pill until the refetch
   * landed.
   *
   * The scope tree is a separate key with no params at all: it describes the
   * whole plant and must not be refetched, or worse re-counted, every time a
   * chip moves.
   */
  signals: (params) => ['signals', 'list', params ?? {}],
  signalScopes: ['signals', 'scopes'],
  signal: (signalId, window) => ['signals', 'detail', signalId, window ?? '24h'],

  /**
   * Charts. The catalogue is one key; a chart carries its whole span and its
   * membership override, because changing either changes every number in the
   * payload — the statistics, the correlations and the insight are all computed
   * over the resolved traces.
   */
  /**
   * Work orders. The list carries its filters, because they are applied
   * server-side; the board and the table are the same key with a different
   * `paged`, so switching view does not refetch what is already cached.
   */
  workOrders: (params) => ['work-orders', 'list', params ?? {}],
  workOrder: (id) => ['work-orders', 'detail', id],

  /**
   * Data Fusion's demo source families, keyed by category. Four screens, four
   * cache entries: switching between OT and Vision should not refetch the one
   * you just left, and they are separate collections rather than one list
   * filtered client-side.
   */
  fusionSources: (category, params) => ['fusion', 'sources', category ?? 'all', params ?? {}],
  fusionSource: (id) => ['fusion', 'source', id],
  fusionCatalogue: (category) => ['fusion', 'catalogue', category ?? 'all'],
  fusionOverview: ['fusion', 'overview'],
  fusionDocs: (params) => ['fusion', 'documents', 'list', params ?? {}],
  fusionDoc: (id) => ['fusion', 'documents', 'detail', id],
  fusionMedia: (params) => ['fusion', 'media', params ?? {}],
  fusionContext: (params) => ['fusion', 'context', params ?? {}],
  fusionGraph: ['fusion', 'graph'],
  fusionGraphNode: (id) => ['fusion', 'graph', 'node', id],
  fusionPipelines: (params) => ['fusion', 'pipelines', params ?? {}],
  people: (params) => ['people', params ?? {}],
  peopleImports: ['people', 'imports'],
  teams: (params) => ['teams', params ?? {}],
  roles: ['roles'],
  audit: (params) => ['audit', params ?? {}],
  security: ['security'],
  developer: ['developer'],
  integrations: ['integrations'],
  orgSettings: ['org', 'settings'],
  plan: ['org', 'plan'],
  billing: ['org', 'billing'],

  charts: ['charts'],
  chart: (params) => ['charts', 'detail', params ?? {}],

  /**
   * Home's demo panels. Four separate keys rather than one `['home']` blob: the
   * carousel and the asset table never change, while the KPI strip follows the
   * alert fixture and the task panel invalidates on every write. One key would
   * refetch all four every time a task was ticked off.
   */
  homeContext: ['home', 'context'],
  homeKpis: ['home', 'kpis'],
  homeWatched: ['home', 'watched-assets'],
  homeAssets: ['home', 'my-assets'],
  tasks: ['tasks'],
  /**
   * Handovers. `latest` is under the same root as the list so publishing sweeps
   * both — the home card and the history table are two views of one archive and
   * must never disagree about what the last handover said.
   */
  handovers: ['handovers'],
  handoverLatest: ['handovers', 'latest'],
}
