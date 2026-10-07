import { get } from '@/services/http'
import { endpoints } from '@/services/endpoints'

export const fetchOrg = (signal) => get(endpoints.org.current, { signal })
export const fetchEntitlements = (signal) => get(endpoints.org.entitlements, { signal })
// No fetchSession: the API serves no session endpoint. The signed-in user comes
// from the login response — see features/auth/mutations.js useSession.
export const fetchHierarchy = (signal) => get(endpoints.demoHierarchy.tree, { signal })
export const fetchScopes = (signal) => get(endpoints.demoHierarchy.scopes, { signal })
export const fetchSite = (siteId, signal) => get(endpoints.demoHierarchy.site(siteId), { signal })
export const fetchTopline = (params, signal) => get(endpoints.kpis.topline, { params, signal })
export const fetchCurrentShift = (signal) => get(endpoints.shifts.current, { signal })
export const fetchHandover = (signal) => get(endpoints.shifts.handover, { signal })
export const fetchWorkOrders = (signal) => get(endpoints.workOrders.list, { signal })
