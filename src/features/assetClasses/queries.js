import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import {
  createAssetClass,
  deleteAssetClass,
  fetchAssetClasses,
  renameAssetClass,
} from './api'

/**
 * The asset class library.
 *
 * One query for the whole set. The API can filter by entity type server-side,
 * but the screen shows a count per type beside its filter, and those counts
 * need the unfiltered set anyway — so it reads once and narrows in the client.
 * At the size this list realistically reaches, a round trip per filter click
 * would be slower and no more correct.
 */
/**
 * @param {{enabled?: boolean}} [options] `enabled: false` keeps the request from
 *   going out at all. The hierarchy editor uses it: a region form has no asset
 *   class, so it has no business asking the server for the list.
 */
export function useAssetClasses({ enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.assetClasses,
    queryFn: ({ signal }) => fetchAssetClasses(signal),
    staleTime: 60_000,
    enabled,
  })
}

/**
 * Every write refetches the list rather than patching the cache.
 *
 * This is a real database now, not a fixture: the server assigns the id, and it
 * is the only thing that knows whether a write actually landed. Reconciling an
 * optimistic guess against that is more failure modes than one settings screen
 * earns — the list is small and the refetch is imperceptible.
 */
function useAssetClassMutation(mutationFn) {
  const client = useQueryClient()
  return useMutation({
    mutationFn,
    retry: false,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.assetClasses }),
  })
}

export const useCreateAssetClass = () => useAssetClassMutation(createAssetClass)
export const useRenameAssetClass = () => useAssetClassMutation(renameAssetClass)
export const useDeleteAssetClass = () => useAssetClassMutation(deleteAssetClass)
