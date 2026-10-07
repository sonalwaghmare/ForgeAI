import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { get, post } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'

/**
 * Data Fusion — pipelines.
 *
 * DEMO. See `DEMO-MODE.md` §8.10.
 */

/** The four states, in the order the table sorts them. */
export const PIPELINE_STATUSES = ['failed', 'stalled', 'paused', 'active']

export const useFusionPipelines = (params) =>
  useQuery({
    queryKey: queryKeys.fusionPipelines(params),
    queryFn: ({ signal }) => get(endpoints.dataFusion.pipelines, { signal, params }),
    enabled: config.demoMode,
    placeholderData: (previous) => previous,
  })

/**
 * Run one now, pause it, or resume it.
 *
 * A POST to an `actions` sub-resource rather than a PATCH: "run this now" is not
 * a field with a new value, and modelling it as one would mean inventing a field
 * whose only purpose is to be written to.
 */
export function usePipelineAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }) => post(endpoints.dataFusion.pipelineAction(id), { action }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fusion'] }),
  })
}
