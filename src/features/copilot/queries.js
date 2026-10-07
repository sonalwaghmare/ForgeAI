import { useQuery } from '@tanstack/react-query'
import { get } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'

/** `meta.ai` tags the request so the interceptor attaches the AI output locale. */
export const fetchCopilotThread = (signal) =>
  get(endpoints.copilot.messages, { signal, meta: { ai: true } })

export function useCopilotThread() {
  return useQuery({
    queryKey: queryKeys.copilotThread,
    queryFn: ({ signal }) => fetchCopilotThread(signal),
    staleTime: 10 * 60_000,
  })
}
