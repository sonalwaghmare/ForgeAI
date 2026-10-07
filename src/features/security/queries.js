import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { get, patch } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'

/**
 * Security & access.
 *
 * DEMO. See `DEMO-MODE.md` §8.18.
 */
export const useSecurity = () =>
  useQuery({
    queryKey: queryKeys.security,
    queryFn: ({ signal }) => get(endpoints.security.settings, { signal }),
    enabled: config.demoMode,
  })

/**
 * Change the policy.
 *
 * Invalidates the audit log as well as itself: every accepted change writes an
 * entry there, and leaving that key stale would mean the change was recorded and
 * the record was not shown.
 */
export function useSaveSecurity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values) => patch(endpoints.security.settings, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.security })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })
}
