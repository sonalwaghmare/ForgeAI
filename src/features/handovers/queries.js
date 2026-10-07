import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'
import { acknowledgeHandover, fetchHandovers, fetchLatestHandover, publishHandover } from './api'

export const useHandovers = () =>
  useQuery({
    queryKey: queryKeys.handovers,
    queryFn: ({ signal }) => fetchHandovers(signal),
    enabled: config.demoMode,
  })

export const useLatestHandover = () =>
  useQuery({
    queryKey: queryKeys.handoverLatest,
    queryFn: ({ signal }) => fetchLatestHandover(signal),
    enabled: config.demoMode,
  })

/**
 * Publishing and acknowledging both sweep the whole `['handovers']` root, and
 * `handoverLatest` sits under it deliberately.
 *
 * The home card and the history table are two views of one archive. Publishing
 * changes which record is "the last one", so refetching the table without the
 * card would leave the two disagreeing on screen at the same moment — the exact
 * failure a shift handover cannot afford.
 */
export function useHandoverMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (handover) => publishHandover(handover),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.handovers }),
  })
}

export function useAcknowledgeHandover() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (handoverId) => acknowledgeHandover(handoverId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.handovers }),
  })
}
