import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { del, get, patch, post, put } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'

/**
 * The account directory.
 *
 * DEMO. See `DEMO-MODE.md` §8.14.
 */

/** The three account states, in the order the table sorts them. */
export const PERSON_STATUSES = ['locked', 'inactive', 'active']

/** The tiles above the table, each of which is also a filter. */
export const PERSON_FACETS = [
  'total',
  'active',
  'inactive',
  'locked',
  'mfaOn',
  'mfaOff',
  'neverSignedIn',
]

export const usePeople = (params) =>
  useQuery({
    queryKey: queryKeys.people(params),
    queryFn: ({ signal }) => get(endpoints.people.list, { signal, params }),
    enabled: config.demoMode,
    // A filter should narrow the table under the reader rather than blank it.
    // Safe here in a way it was not on the fusion families: this is one
    // collection with one subject, and the filters only ever narrow it.
    placeholderData: (previous) => previous,
  })

/**
 * Enable, disable or lock an account.
 *
 * Invalidates the whole `people` tree rather than the one row: the tiles above
 * the table are counts over the same collection, and leaving them stale would
 * show six active accounts above a table listing five.
 */
export function useSetPersonStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }) => patch(endpoints.people.detail(id), { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['people'] }),
  })
}

/** The bulk-import history. Empty until somebody runs one. */
export const usePeopleImports = () =>
  useQuery({
    queryKey: queryKeys.peopleImports,
    queryFn: ({ signal }) => get(endpoints.people.imports, { signal }),
    enabled: config.demoMode,
  })

/**
 * Create one account.
 *
 * Invalidates `people` wholesale: a new row changes the tiles above the table
 * and, if their role does plant work, the task assignee picker.
 */
export function useCreatePerson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body) => post(endpoints.people.list, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['people'] }),
  })
}

/** Commit a validated import. Creates or updates, and reports which it did. */
export function useImportPeople() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body) => post(endpoints.people.import, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] })
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    },
  })
}

/** Teams, which are a view of who is in them. */
export const useTeams = (params) =>
  useQuery({
    queryKey: queryKeys.teams(params),
    queryFn: ({ signal }) => get(endpoints.teams.list, { signal, params }),
    enabled: config.demoMode,
    placeholderData: (previous) => previous,
  })

/** The team types, in the order the filter offers them. */
export const TEAM_TYPES = ['engineering', 'operations', 'executive', 'maintenance', 'analytics']

/**
 * Roles, the permission catalogue and the counts, in one read.
 *
 * One request because the grid cannot be drawn without the catalogue and the
 * catalogue never changes — a second query would be a second loading state for
 * a constant.
 */
export const useRoles = () =>
  useQuery({
    queryKey: queryKeys.roles,
    queryFn: ({ signal }) => get(endpoints.roles.list, { signal }),
    enabled: config.demoMode,
  })

/**
 * Create or replace a custom role.
 *
 * Invalidates `people` too: a role's name is printed on every row that holds it,
 * and the create dialog and the bulk import both validate against the list.
 */
export function useSaveRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) =>
      id ? put(endpoints.roles.detail(id), body) : post(endpoints.roles.list, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      queryClient.invalidateQueries({ queryKey: ['people'] })
    },
  })
}

/** Remove a custom role. Refused while anybody holds it. */
export function useDeleteRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => del(endpoints.roles.detail(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  })
}
