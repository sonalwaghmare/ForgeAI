import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { hasSession } from '@/services/authToken'

/**
 * Gate for every private route.
 *
 * ── What this is and is not ─────────────────────────────────────────────
 * This is navigation, not authorisation. It decides which screen to render, and
 * a screen rendering has never granted access to anything: the data behind it
 * arrives over a request carrying a token the API validates. Anyone can edit
 * client state to walk past this guard and will find every request rejected.
 *
 * The real protection is that the API rejects an absent or expired token; this
 * exists so that rejection is not how a signed-out person discovers they are
 * signed out.
 *
 * ── Why a token's presence is enough to proceed ─────────────────────────
 * It checks that a token EXISTS, not that it is valid. Validity cannot be
 * established here: there is no session endpoint to ask, and decoding the JWT to
 * read `exp` would mean trusting a claim the client must not trust — the token is
 * opaque to this app by design.
 *
 * So an expired token renders the shell, its first request 401s, the transport
 * refreshes and retries, and the screen fills. If the refresh also fails, the
 * unauthorized handler redirects here with a reason. That path is the design, not
 * a gap in it.
 */
export function RequireAuth() {
  const location = useLocation()

  if (!hasSession()) {
    return (
      <Navigate
        to="/login"
        replace
        // Where they were headed, so sign-in can finish the journey instead of
        // dumping everyone on the home screen. `replace` keeps the guarded URL
        // out of history, so Back does not bounce between it and the form.
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  return <Outlet />
}
