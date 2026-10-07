import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import {
  fetchCurrentShift,
  fetchEntitlements,
  fetchHandover,
  fetchHierarchy,
  fetchOrg,
  fetchScopes,
  fetchTopline,
  fetchWorkOrders,
} from './api'

/** Org, entitlements and hierarchy change rarely — cache them hard. */
const STABLE = { staleTime: 15 * 60_000 }

export const useOrg = () =>
  useQuery({ queryKey: queryKeys.org, queryFn: ({ signal }) => fetchOrg(signal), ...STABLE })

export const useEntitlements = () =>
  useQuery({
    queryKey: queryKeys.entitlements,
    queryFn: ({ signal }) => fetchEntitlements(signal),
    ...STABLE,
  })

// useSession lives in features/auth/mutations.js: it reads the persisted login
// response rather than calling an endpoint, because the API has none to call.

export const useHierarchy = () =>
  useQuery({
    queryKey: queryKeys.hierarchy,
    queryFn: ({ signal }) => fetchHierarchy(signal),
    ...STABLE,
  })

export const useScopes = () =>
  useQuery({ queryKey: queryKeys.scopes, queryFn: ({ signal }) => fetchScopes(signal), ...STABLE })

export const useTopline = (params) =>
  useQuery({
    queryKey: queryKeys.topline(params?.siteId),
    queryFn: ({ signal }) => fetchTopline(params, signal),
  })

export const useCurrentShift = () =>
  useQuery({ queryKey: queryKeys.currentShift, queryFn: ({ signal }) => fetchCurrentShift(signal) })

export const useHandover = () =>
  useQuery({ queryKey: queryKeys.handover, queryFn: ({ signal }) => fetchHandover(signal) })

/* The public page's read: the whole collection, unfiltered. `queryKeys.workOrders`
   takes params now that the Work Orders module filters server-side — called with
   none, so this and the module's unfiltered board share one cache entry. */
export const useWorkOrders = () =>
  useQuery({ queryKey: queryKeys.workOrders(), queryFn: ({ signal }) => fetchWorkOrders(signal) })
