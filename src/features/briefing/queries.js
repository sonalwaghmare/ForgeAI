import { useQuery } from '@tanstack/react-query'
import { get } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'

/**
 * The role-adaptive briefing. `meta.ai` tags the request so the interceptor
 * attaches the AI output locale — this is generated prose, and the language it
 * is written in is an org setting rather than the reader's browser.
 */
export function useBriefing(role) {
  return useQuery({
    queryKey: queryKeys.briefing(role),
    queryFn: ({ signal }) => get(endpoints.briefing.current, { params: { role }, signal, meta: { ai: true } }),
    enabled: Boolean(role),
    // A briefing is a point-in-time read of the shift. It should not silently
    // regenerate under someone mid-sentence.
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}
