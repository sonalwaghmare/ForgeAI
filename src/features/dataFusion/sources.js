import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { get, patch, post } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'

/**
 * Data Fusion — the four demo source families.
 *
 * DEMO. See `DEMO-MODE.md` §8.10.
 *
 * ── Separate from `api.js` and `queries.js`, which are LIVE ───────────────
 * Those two serve `/v1/connections`, the real IoT & Sensors resource, and they
 * are not touched by any of this. Keeping the demo reads in their own file is
 * what makes that visible at the import line: a page that imports from here is
 * reading fixtures, and one that imports from `queries.js` is on the network.
 *
 * ── The four categories are not one list with a filter ────────────────────
 * They are four screens with four cache entries. An OT historian and an S3
 * bucket share a table layout and nothing else — different contracts, different
 * config schemas, different mapping semantics, different wizards — and the
 * moment any of those lands, one shared query would have to be split anyway.
 */

/** The section ids that have a source table behind them, in rail order. */
export const FUSION_SOURCE_SECTIONS = ['ot', 'vision', 'business', 'stores']

/**
 * The five statuses, in ladder order.
 *
 * Exported from here and imported by the fixture, never the other way round —
 * a page that reached into `mocks/` would bundle the demo layer into the
 * production build. Same seam as `WO_STATES`.
 */
export const FUSION_STATUSES = [
  'connected',
  'syncing',
  'degraded',
  /* Somebody stopped it, from Settings → Integrations. On the ladder between a
     fault and an unfilled catalogue entry because it is neither: nothing is
     wrong with a paused source, and something HAS been set up. */
  'paused',
  'disconnected',
  'notConfigured',
]

/**
 * One family.
 *
 * Filtering is server-side, so the filters are in the key: the transport already
 * narrows the list and a page that re-filtered the answer would be doing the
 * work twice and disagreeing with `stats`.
 */
/**
 * The module's landing screen, in one request.
 *
 * Not five queries. Every figure on it is counted across the same collections
 * in one pass, and separate requests would let the Documents card and the Graph
 * card be fetched at different moments and disagree about the same records.
 */
export const useFusionOverview = () =>
  useQuery({
    queryKey: queryKeys.fusionOverview,
    queryFn: ({ signal }) => get(endpoints.dataFusion.overview, { signal }),
    enabled: config.demoMode,
  })

export const useFusionSources = (category, params) =>
  useQuery({
    queryKey: queryKeys.fusionSources(category, params),
    queryFn: ({ signal }) =>
      get(endpoints.dataFusion.sources, { signal, params: { category, ...params } }),
    enabled: config.demoMode && Boolean(category),
    /**
     * Held ONLY while the family is the same.
     *
     * A filter landing should narrow the table under the reader rather than
     * blanking it and rebuilding — the reason the work-order board keeps its
     * cards while a chip is applied. But a plain `(previous) => previous` also
     * fires when the CATEGORY changes, and then it holds the wrong family's
     * rows: clicking from OT & Historians to ERP / MES / CMMS showed six
     * historians under the ERP heading until the next response landed, and the
     * skeleton this screen already has never appeared at all.
     *
     * Comparing the previous query's own key is what tells the two apart —
     * `queryKey[2]` is the category, from `queryKeys.fusionSources`.
     */
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey?.[2] === category ? previous : undefined,
  })

/**
 * Everything the connect wizard needs, in one read.
 *
 * One request rather than three as the reader advances: the wizard is a single
 * flow, and a loading state appearing inside a dialog on the way to step 2 is the
 * kind of stutter that reads as a fault. The catalogue is also the largest of the
 * three payloads, so fetching it alone buys nothing.
 */
export const useConnectorCatalogue = (category) =>
  useQuery({
    queryKey: queryKeys.fusionCatalogue(category),
    queryFn: ({ signal }) =>
      get(endpoints.dataFusion.connectorCatalogue, { signal, params: { category } }),
    enabled: config.demoMode && Boolean(category),
    staleTime: 10 * 60_000,
  })

/**
 * Reach the endpoint before there is a source to reach it with.
 *
 * A probe of a CONNECTOR, not of a source — at step 3 nothing has been created,
 * so there is no id to test. `useTestSource` is the other one, and they are
 * separate because the questions differ: this one asks whether an address
 * answers, that one asks what state an existing connection is in.
 */
export function useProbeConnector() {
  return useMutation({
    mutationFn: (body) => post(endpoints.dataFusion.connectorProbe, body),
  })
}

/**
 * Create it.
 *
 * Invalidates the whole `fusion` tree: a new source changes its family's table,
 * the overview's counts and attention list, the knowledge graph's totals, and —
 * once it publishes tags — the Contextualisation queue. Narrowing this would
 * leave four screens that had not heard about a connection somebody just made.
 */
export function useCreateSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body) => post(endpoints.dataFusion.sources, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fusion'] }),
  })
}

/**
 * One source, with everything the table has no room for.
 *
 * No `placeholderData`, for the reason `useGraphNode` has none: this is a picture
 * of one specific connection, and holding the previous one would put the ABB
 * gateway's TLS error under a heading naming the Siemens PLC.
 */
export const useFusionSource = (id) =>
  useQuery({
    queryKey: queryKeys.fusionSource(id),
    queryFn: ({ signal }) => get(endpoints.dataFusion.source(id), { signal }),
    enabled: config.demoMode && Boolean(id),
  })

/**
 * Save the connection form.
 *
 * Invalidates the whole `fusion` tree rather than just this source, because the
 * endpoint is one of the fields: changing it changes the status derived from it,
 * which changes the family's counts, the overview's attention list and whether a
 * pipeline reading this source is stalled. Narrowing the invalidation would leave
 * four screens describing a connection that no longer exists.
 */
export function useSaveSourceConfig(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values) => patch(endpoints.dataFusion.source(id), { values }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fusion'] }),
  })
}

/**
 * Turn one write-back rule on or off.
 *
 * Invalidates only this source: a rule decides what Forge pushes INTO the system
 * of record, which changes nothing any other screen in this product reads.
 */
export function useWritebackRule(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ruleId, enabled }) =>
      patch(endpoints.dataFusion.sourceWriteback(id), { ruleId, enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.fusionSource(id) }),
  })
}

/** Test the connection. Answers with what is true, which is sometimes a failure. */
export function useTestSource(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => post(endpoints.dataFusion.sourceTest(id)),
    // The test is itself an entry in the activity log, so the drawer has to re-read.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.fusionSource(id) }),
  })
}
