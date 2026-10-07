import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import { readSession, signIn, signOut } from './api'

/**
 * The signed-in session.
 *
 * A query with no network call: `readSession` reads the persisted profile, since
 * the API has no endpoint to ask. It lives in React Query anyway so every
 * consumer re-renders together when sign-in or sign-out writes this key — which
 * a plain module read would not do.
 *
 * staleTime Infinity because nothing external can change it. Only the two
 * mutations below do, and they write the cache directly.
 */
export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: () => readSession(),
    staleTime: Infinity,
    retry: false,
  })
}

export function useSignIn() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: signIn,
    // Never retried. A failed sign-in is a rejected credential, and retrying it
    // burns an attempt against any server-side lockout counter for no reason.
    retry: false,
    onSuccess: (session) => {
      client.setQueryData(queryKeys.session, { user: session.user })
    },
  })
}

export function useSignOut() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: signOut,
    // Everything cached was scoped to the session that just ended. Cleared on
    // settle rather than success because signOut cannot fail — and if it ever
    // could, keeping another tenant's data in the cache would be the worse bug.
    onSettled: () => client.clear(),
  })
}
