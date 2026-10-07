import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import { createNode, deleteNode, fetchHierarchyNodes, fetchNode, updateNode } from './api'

/**
 * The editable asset hierarchy, live.
 *
 * Reads the flat node list rather than a nested tree: the tree is a derived
 * value and deriving it client-side keeps every mutation a single-node write
 * instead of a recursive patch.
 */

export function useHierarchyNodes() {
  return useQuery({
    queryKey: queryKeys.hierarchyNodes,
    queryFn: ({ signal }) => fetchHierarchyNodes(signal),
    staleTime: 60_000,
  })
}

/**
 * One node, with the fields the tree endpoint does not serve.
 *
 * `/asset-hierarchy` carries id, name and short code. An edit form needs
 * `is_active` and `asset_class_id` as well, and every update here is a full
 * replace — so a form prefilled from the tree alone would switch the record off
 * and unassign its class on save. This reads the record being overwritten.
 *
 * `staleTime: 0, gcTime: 0` for the reason `useConnection` gives: an edit form is
 * the one place a stale prefill becomes a wrong write.
 */
export function useHierarchyNode(target) {
  return useQuery({
    queryKey: queryKeys.hierarchyNode(target?.tier, target?.id),
    queryFn: ({ signal }) => fetchNode(target, signal),
    enabled: Boolean(target?.tier && target?.id),
    staleTime: 0,
    gcTime: 0,
  })
}

/**
 * Anything that changes the hierarchy refetches all of it.
 *
 * Broad on purpose, and cheap: the six requests go out together, and a renamed
 * site still showing its old name in the top bar reads as a bug to everyone who
 * sees it. The server assigns the id and is the only thing that knows whether a
 * write landed, so nothing here guesses at the result.
 */
function useHierarchyMutation(mutationFn) {
  const client = useQueryClient()
  return useMutation({
    mutationFn,
    retry: false,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.hierarchyNodes }),
  })
}

export const useCreateNode = () => useHierarchyMutation(createNode)
export const useUpdateNode = () => useHierarchyMutation(updateNode)
export const useDeleteNode = () => useHierarchyMutation(deleteNode)
