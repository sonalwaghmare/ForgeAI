import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { get, post } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'

/**
 * Data Fusion — Contextualisation.
 *
 * DEMO. See `DEMO-MODE.md` §8.10.
 *
 * ── This places an object; it does not route a signal ─────────────────────
 * Accepting a match says "this tag belongs to that machine" and adds a graph
 * edge. Binding a tag to a Forge sensor so its readings drive charts and
 * thresholds is the mapping table, in the connection drawer. The two are kept
 * apart because `CONNECTORS` declares exactly one connector that provides
 * signals and Sensor Explorer states that as fact — a screen that let somebody
 * route a second source into the sensor catalogue would quietly make that claim
 * false.
 */

/** What can be waiting for a home. */
export const CONTEXT_KINDS = ['tag', 'document', 'media']

/** The three states a queue item can be in. */
export const CONTEXT_STATUSES = ['pending', 'accepted', 'rejected']

export const useFusionContext = (params) =>
  useQuery({
    queryKey: queryKeys.fusionContext(params),
    queryFn: ({ signal }) => get(endpoints.dataFusion.context, { signal, params }),
    enabled: config.demoMode,
    placeholderData: (previous) => previous,
  })

/**
 * Accept, reject, or put one back.
 *
 * Sweeps `['fusion']` and `['assets']`: accepting a document suggestion writes a
 * real link, so the Documents register, the Overview's counts and that machine's
 * own Documents tab all change on one click.
 */
export function useContextDecision() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision }) =>
      post(endpoints.dataFusion.contextDecision(id), { decision }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fusion'] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
  })
}
