import { useQuery } from '@tanstack/react-query'
import { get } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'

/**
 * The audit log.
 *
 * DEMO. See `DEMO-MODE.md` §8.17.
 *
 * Read-only, and there is deliberately no mutation hook beside this one: an
 * audit log a client can write to is not an audit log. Entries are appended by
 * the fixtures that perform the writes they record.
 *
 * `staleTime: 0` — this is the one collection in the product where a stale
 * answer is a wrong answer. Somebody opens it to find out what just happened.
 */
export const useAuditLog = (params) =>
  useQuery({
    queryKey: queryKeys.audit(params),
    queryFn: ({ signal }) => get(endpoints.audit.list, { signal, params }),
    enabled: config.demoMode,
    staleTime: 0,
    placeholderData: (previous) => previous,
  })

/** The three severities, in the order the filter offers them. */
export const AUDIT_SEVERITIES = ['critical', 'warning', 'info']

/** The windows the date filter offers, in days. */
export const AUDIT_WINDOWS = [1, 7, 30]
