import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'
import {
  advanceWorkOrder,
  createWorkOrder,
  deleteWorkOrder,
  fetchWorkOrder,
  fetchWorkOrders,
  updateWorkOrder,
} from './api'

/**
 * Work Orders reads and writes.
 *
 * Gated at the hook, as everywhere behind the demo flag.
 *
 * ── Every write sweeps four modules, not one ──────────────────────────────
 * A work order is not only on this board. Lines & Assets counts open orders in
 * its five-card stat bar, on every asset row and inside the asset's own Work
 * Orders tab; the public page reads the collection for its summary. Completing
 * an order therefore has to invalidate `['assets']` as well as
 * `['work-orders']`, or the machine keeps claiming work that is finished — which
 * is exactly the kind of quiet disagreement `isOpenOrder` was introduced to
 * stop.
 */
const DEMO = { enabled: config.demoMode }

/**
 * The collection.
 *
 * `placeholderData` keeps the board on screen while a filter lands. Six columns
 * of cards blanking together and reappearing is a page that jumps under the
 * reader on every chip.
 */
export const useWorkOrderBoard = (params) =>
  useQuery({
    queryKey: queryKeys.workOrders(params),
    queryFn: ({ signal }) => fetchWorkOrders(params, signal),
    placeholderData: (previous) => previous,
    ...DEMO,
  })

export const useWorkOrder = (id) =>
  useQuery({
    queryKey: queryKeys.workOrder(id),
    queryFn: ({ signal }) => fetchWorkOrder(id, signal),
    enabled: DEMO.enabled && Boolean(id),
  })

/** Everything a work-order write has to invalidate. */
function useSweep() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['work-orders'] })
    // Lines & Assets counts open orders in three places. See the note above.
    queryClient.invalidateQueries({ queryKey: ['assets'] })
  }
}

export const useCreateWorkOrder = () => {
  const sweep = useSweep()
  return useMutation({ mutationFn: createWorkOrder, onSuccess: sweep })
}

export const useUpdateWorkOrder = () => {
  const sweep = useSweep()
  return useMutation({ mutationFn: updateWorkOrder, onSuccess: sweep })
}

export const useAdvanceWorkOrder = () => {
  const sweep = useSweep()
  return useMutation({ mutationFn: advanceWorkOrder, onSuccess: sweep })
}

export const useDeleteWorkOrder = () => {
  const sweep = useSweep()
  return useMutation({ mutationFn: deleteWorkOrder, onSuccess: sweep })
}
