import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { get, patch } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'

/**
 * Settings — Modules & Plan.
 *
 * DEMO. See `DEMO-MODE.md` §8.22.
 */
export const usePlan = () =>
  useQuery({
    queryKey: queryKeys.plan,
    queryFn: ({ signal }) => get(endpoints.org.plan, { signal }),
    enabled: config.demoMode,
  })

/**
 * Switch a module on or off.
 *
 * Invalidates the entitlements as well as this page, and that is the whole
 * point of the arrangement rather than a precaution: the navigation rail gates
 * on `/v1/org/entitlements`, this write changes the map that endpoint serves,
 * and without the invalidation the module would disappear from the page while
 * staying in the rail — which is exactly the disagreement composing off one map
 * was meant to make impossible.
 */
export function useSetModule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }) => patch(endpoints.org.module(id), { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plan })
      queryClient.invalidateQueries({ queryKey: queryKeys.entitlements })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })
}
