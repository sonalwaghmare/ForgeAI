import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'
import { createLogEntry, fetchLogbook } from './api'

/**
 * The log.
 *
 * Gated at the hook, as everywhere behind the demo flag.
 *
 * `placeholderData` keeps the feed on screen while a search lands. This one
 * matters more than most: the query is applied server-side, so every keystroke
 * that gets past the debounce is a request, and blanking the feed between them
 * would make typing feel like the page is failing.
 *
 * Five minutes stale. A logbook is written by hand a few times a shift — unlike
 * the roster, nothing in it changes because the clock moved.
 */
export const useLogbook = (params) =>
  useQuery({
    queryKey: queryKeys.logbook(params),
    queryFn: ({ signal }) => fetchLogbook(params, signal),
    placeholderData: (previous) => previous,
    enabled: config.demoMode,
    staleTime: 5 * 60_000,
  })

/**
 * Write an entry.
 *
 * Sweeps the whole `['logbook']` root rather than one key: the entry that was
 * just written has to appear under whatever search and machine filter the
 * reader happens to have on, and the counts above the feed move with it.
 */
export const useCreateLogEntry = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createLogEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['logbook'] }),
  })
}
