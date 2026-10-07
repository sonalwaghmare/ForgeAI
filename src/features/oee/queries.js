import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'
import { fetchOeeLines, fetchOeeSummary } from './api'

/**
 * The OEE screen's two reads.
 *
 * Gated at the hook, not at the JSX — same reason as `features/home/queries.js`.
 * With the flag off the route renders the module placeholder and neither of
 * these fires.
 *
 * Cached hard: both are static fixtures with no clock behind them and nothing
 * mutates them, so a 30-second staleTime would refetch four traces every time
 * the tab regained focus for no change at all. `placeholderData` keeps the
 * previous window on screen while the next one loads, so switching Day → Week
 * moves the numbers instead of blanking the page.
 */
const DEMO = { enabled: config.demoMode, staleTime: 15 * 60_000 }

export const useOeeSummary = (period) =>
  useQuery({
    queryKey: queryKeys.oeeSummary(period),
    queryFn: ({ signal }) => fetchOeeSummary(period, signal),
    placeholderData: (previous) => previous,
    ...DEMO,
  })

export const useOeeLines = () =>
  useQuery({
    queryKey: queryKeys.oeeLines,
    queryFn: ({ signal }) => fetchOeeLines(signal),
    ...DEMO,
  })
