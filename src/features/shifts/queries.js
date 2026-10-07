import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'
import { assignShift, fetchShifts } from './api'

/**
 * The week's roster.
 *
 * Gated at the hook, as everywhere behind the demo flag.
 *
 * Not cached hard, unlike the plant: one of these rows is the shift currently
 * running, and its status flips when the clock crosses the boundary. Sixty
 * seconds is short enough that a screen left open over a handover shows the new
 * shift, and long enough that scrolling the table does not refetch it.
 *
 * `placeholderData` keeps the rows and the briefing on screen while a filter
 * lands — the synopsis tab is one paragraph and three cards, and blanking all
 * four on a chip is a page that jumps under the reader.
 */
export const useShifts = (params) =>
  useQuery({
    queryKey: queryKeys.shifts(params),
    queryFn: ({ signal }) => fetchShifts(params, signal),
    placeholderData: (previous) => previous,
    enabled: config.demoMode,
    staleTime: 60_000,
  })

/**
 * Reassign a scheduled shift.
 *
 * Sweeps the whole `['shifts']` root rather than one key: the roster is
 * filtered and paged server-side, so the row that changed may be cached under
 * several parameter combinations, and the crew rollup and the KPI strip move
 * with it.
 */
export const useAssignShift = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: assignShift,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shifts'] }),
  })
}
