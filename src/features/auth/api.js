import { post } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { clearSession, getStoredUser, hasSession, setSession } from '@/services/authToken'

/**
 * Sign-in against the real authentication API.
 *
 * The credential travels in the body over the same interceptor chain as
 * everything else — never in a query string, where it would land in browser
 * history, proxy logs and the referrer header.
 *
 * The API is tenant-scoped: the account alias selects the organisation, and an
 * email is unique only within one, so the same address can exist under two
 * accounts and mean two different people. All three fields are required.
 */

/** The wire shape is snake_case, the app is camelCase. Converted at this seam. */
function toSession(payload) {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    // Exactly what the API returns: a name and an email. No role, no id, no
    // permissions — inventing any of them would present a guess as fact.
    user: payload.user ?? null,
  }
}

/**
 * @param {{accountAlias: string, email: string, password: string}} credential
 */
export async function signIn(credential) {
  const payload = await post(endpoints.auth.login, {
    // Trimmed because a copy-pasted alias or email routinely carries whitespace,
    // and rejecting someone over an invisible character is cruel. NOT
    // upper-cased: the API compares the alias exactly, so changing its case
    // would fail every sign-in.
    account_alias: credential.accountAlias.trim(),
    email: credential.email.trim(),
    // The password is never trimmed — a trailing space can be deliberate.
    password: credential.password,
  })

  const session = toSession(payload)
  setSession(session)
  return session
}

/**
 * Sign out.
 *
 * Entirely client-side, because there is nothing to call: the API exposes no
 * logout endpoint, and its refresh tokens are stateless JWTs with no server-side
 * record behind them, so nothing can revoke one. A request would be theatre.
 *
 * The consequence is worth stating plainly: a refresh token captured before
 * sign-out stays valid until it expires. Only the server can change that.
 */
export async function signOut() {
  clearSession()
}

/**
 * The current session, reconstructed from what sign-in persisted.
 *
 * There is no endpoint to ask. With no `GET /me`, the profile stored alongside
 * the tokens is the only available description of who is signed in, so this
 * reads it back rather than fetching it.
 *
 * Returns null when there is no session, which is what the route guard checks.
 * A token being present is not proof that it is valid — only the API can rule on
 * that, and it does so by rejecting the first request that carries one.
 */
export function readSession() {
  if (!hasSession()) return null
  return { user: getStoredUser() }
}
