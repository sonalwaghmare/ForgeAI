import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import {
  createConnection,
  deleteConnection,
  fetchConnection,
  fetchConnections,
  fetchConnectorTypes,
  testConnection,
  updateConnection,
} from './api'

/**
 * The connector catalogue.
 *
 * Platform master data — read-only, and the same answer for every account until
 * account-specific connector types exist. Cached for an hour: a connector type
 * changing mid-session means the backend was redeployed, and a redeploy is a
 * reload.
 */
export function useConnectorTypes({ enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.connectorTypes,
    queryFn: ({ signal }) => fetchConnectorTypes(signal),
    staleTime: 60 * 60_000,
    enabled,
  })
}

/** Every connection on the account. */
export function useConnections() {
  return useQuery({
    queryKey: queryKeys.connections,
    queryFn: ({ signal }) => fetchConnections(signal),
    staleTime: 30_000,
  })
}

/**
 * One connection, with its masked config and its connector type.
 *
 * A separate request from the list rather than a cache lookup: the list carries
 * neither, so the edit form genuinely cannot be opened from it. `enabled` keeps
 * the request from going out until a row is actually being edited.
 */
export function useConnection(connectionId) {
  return useQuery({
    queryKey: queryKeys.connection(connectionId),
    queryFn: ({ signal }) => fetchConnection(connectionId, signal),
    enabled: Boolean(connectionId),
    // Zero, deliberately. The config on a cached copy may be one the user has
    // since changed, and an edit form is the one place a stale prefill turns into
    // a wrong write — the form sends back everything it was given.
    staleTime: 0,
    gcTime: 0,
  })
}

/**
 * The reachability probe.
 *
 * A mutation rather than a query even though it changes nothing on the server:
 * it is an action someone takes, it must not run on mount, and it must not be
 * retried or refetched. A query would probe the plant network on window focus.
 *
 * `retry: false` for the same reason — a broker that refused a connection
 * refuses it three times, and each attempt costs a five-second timeout.
 */
export function useTestConnection() {
  return useMutation({
    mutationFn: testConnection,
    retry: false,
  })
}

/**
 * Every write refetches the list rather than patching the cache.
 *
 * The server assigns the id, and on create and update it also probes the endpoint
 * before committing — so it is the only thing that knows whether a write actually
 * landed. Reconciling an optimistic guess against that is more failure modes than
 * this screen earns, and the list is small.
 *
 * `retry: false` matters most on create: there is no idempotency key and no
 * uniqueness constraint on the name, so a retried POST that succeeded the first
 * time leaves two connections ingesting the same broker.
 */
function useConnectionMutation(mutationFn) {
  const client = useQueryClient()
  return useMutation({
    mutationFn,
    retry: false,
    onSuccess: (result) => {
      client.invalidateQueries({ queryKey: queryKeys.connections })
      // The detail cache holds a masked config that the update has now replaced.
      if (result?.id) client.removeQueries({ queryKey: queryKeys.connection(result.id) })
    },
  })
}

export const useCreateConnection = () => useConnectionMutation(createConnection)
export const useUpdateConnection = () => useConnectionMutation(updateConnection)
export const useDeleteConnection = () => useConnectionMutation(deleteConnection)
