import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'
import { fetchReportLibrary, fetchReports, generateReport } from './api'

/**
 * The shelf.
 *
 * ── It polls, but only while something is running ─────────────────────────
 * `generating` is not a stored flag: the server decides from `startedAt` and
 * the clock, so the only way the badge ever changes is by asking again. The
 * interval is therefore conditional on the answer — five seconds while a
 * report is building, off entirely once none is. A screen that polled a
 * finished shelf forever would be a request every five seconds for the life of
 * the tab, which is the kind of thing nobody notices until a bill arrives.
 */
export const useReports = () =>
  useQuery({
    queryKey: queryKeys.reports,
    queryFn: ({ signal }) => fetchReports(signal),
    enabled: config.demoMode,
    staleTime: 30_000,
    refetchInterval: (query) =>
      query.state.data?.items?.some((report) => report.status === 'generating') ? 5000 : false,
  })

/**
 * Generate one.
 *
 * Invalidates rather than appending: the new report sorts to the top because it
 * is the one still building, and that ordering is the server's to decide.
 */
export const useGenerateReport = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: generateReport,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reports }),
  })
}

/**
 * The catalogue.
 *
 * `staleTime: Infinity` because it genuinely cannot change while the tab is
 * open — nothing on this screen writes a template, a category or a section
 * definition. Refetching a specification on focus would be a request that can
 * only ever return the same bytes.
 */
export const useReportLibrary = () =>
  useQuery({
    queryKey: queryKeys.reportLibrary,
    queryFn: ({ signal }) => fetchReportLibrary(signal),
    enabled: config.demoMode,
    staleTime: Infinity,
  })
