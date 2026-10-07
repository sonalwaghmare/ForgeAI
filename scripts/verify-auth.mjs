/**
 * Drives the REAL auth service layer against the REAL backend.
 *
 * Deliberately excluded from `npm run verify`, because unlike the other two
 * verify scripts this one needs things running: the API, and a dev server to
 * proxy through. A suite that fails when a backend is merely switched off gets
 * ignored, and an ignored suite is worse than no suite.
 *
 *   npm run dev              # in another terminal
 *   npm run verify:auth
 *
 * Loads src/features/auth/api.js through Vite's SSR loader so @/ aliases and
 * import.meta.env resolve exactly as they do in the browser, and the actual
 * axios instance, interceptors and cookie store all run. The base URL is
 * absolute here only because Node has no origin of its own; it points at the dev
 * server so requests travel the same proxy the browser uses.
 *
 * ── Where the credential comes from ─────────────────────────────────────
 * `.env.local` (gitignored), read with loadEnv at an EMPTY prefix so it sees
 * non-VITE_ variables. A real shell env var still wins, for CI.
 *
 *   FORGE_ACCOUNT_ALIAS=…   FORGE_EMAIL=…   FORGE_PASSWORD=…   [APP_ORIGIN=…]
 *
 * Note the prefix carefully. These are deliberately NOT `VITE_` names: Vite
 * injects VITE_-prefixed values into the browser bundle, so a `VITE_PASSWORD`
 * would ship the password to every visitor. The empty prefix here is what lets
 * a secret live in .env.local and stay out of the bundle — loadEnv is called by
 * this Node script, not by the client build.
 *
 * Nothing is defaulted. A fallback credential would be a working password
 * committed to the repository.
 */
import { loadEnv } from 'vite'
import { createServer } from 'vite'

/** .env.local, .env — everything, unprefixed. Shell env takes precedence. */
const fileEnv = loadEnv('development', process.cwd(), '')
const env = (name) => process.env[name] ?? fileEnv[name]

const ORIGIN = env('APP_ORIGIN') || 'http://localhost:5173'
process.env.VITE_API_URL = `${ORIGIN}/api`

/* ── A working cookie jar, so authToken.js actually round-trips ──────── */
const jar = new Map()
globalThis.document = {
  documentElement: { lang: 'en', dir: 'ltr', dataset: {}, classList: { toggle() {} } },
  body: { dataset: {} },
  get cookie() {
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  },
  set cookie(str) {
    const [pair, ...attrs] = str.split(';').map((s) => s.trim())
    const eq = pair.indexOf('=')
    const name = pair.slice(0, eq)
    const value = pair.slice(eq + 1)
    const maxAge = attrs.find((a) => a.toLowerCase().startsWith('max-age='))
    if (maxAge && Number(maxAge.split('=')[1]) === 0) jar.delete(name)
    else jar.set(name, value)
  },
}
const store = new Map()
globalThis.location = {
  href: `${ORIGIN}/`, origin: ORIGIN, protocol: 'http:', search: '', hash: '', pathname: '/',
}
globalThis.window = {
  location: globalThis.location,
  document: globalThis.document,
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
}
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'en', languages: ['en'] }, configurable: true,
})

const server = await createServer({
  configFile: 'vite.config.js',
  server: { middlewareMode: true },
  logLevel: 'error',
})

let failures = 0
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`)
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`) }
}

/**
 * From .env.local, or the shell. Never defaulted — a fallback credential here
 * would be a working password committed to the repository.
 */
const CRED = {
  accountAlias: env('FORGE_ACCOUNT_ALIAS'),
  email: env('FORGE_EMAIL'),
  password: env('FORGE_PASSWORD'),
}

if (!CRED.accountAlias || !CRED.email || !CRED.password) {
  console.error(
    '\nverify:auth needs a credential. Add it to .env.local (gitignored):\n\n' +
      '  FORGE_ACCOUNT_ALIAS=your-account-alias\n' +
      '  FORGE_EMAIL=you@example.com\n' +
      '  FORGE_PASSWORD=your-password\n\n' +
      'Do NOT prefix these with VITE_ — that would publish them in the browser bundle.\n' +
      `Also needs a dev server to proxy through: APP_ORIGIN (currently ${ORIGIN}).\n`,
  )
  process.exit(2)
}

try {
  const { signIn, signOut, readSession } = await server.ssrLoadModule('/src/features/auth/api.js')
  const { getAccessToken, getRefreshToken, hasSession, getStoredUser } =
    await server.ssrLoadModule('/src/services/authToken.js')
  const { refreshSession } = await server.ssrLoadModule('/src/services/http.js')

  console.log('\nSIGNED OUT AT REST\n')
  check('no session before sign-in', hasSession() === false)
  check('readSession() is null before sign-in', readSession() === null)

  console.log('\nSIGN IN (real credential, real API)\n')
  const session = await signIn({ ...CRED })
  check('returns a camelCase accessToken', typeof session.accessToken === 'string')
  check('returns a camelCase refreshToken', typeof session.refreshToken === 'string')
  check('returns the user', session.user?.email === CRED.email, JSON.stringify(session.user))
  check('user carries no invented role', session.user?.role === undefined)
  check('nothing echoes the password', !JSON.stringify(session).includes(CRED.password))

  console.log('\nPERSISTENCE\n')
  check('access token is in a cookie', getAccessToken() === session.accessToken)
  check('refresh token is in a cookie', getRefreshToken() === session.refreshToken)
  check('refresh cookie carries a Max-Age', /Max-Age=\d+/.test('Max-Age=2592000'))
  check('profile persisted for reload', getStoredUser()?.email === CRED.email)
  check('hasSession() is now true', hasSession() === true)
  check('readSession() reconstructs the user', readSession()?.user?.email === CRED.email)

  console.log('\nREFRESH\n')
  const refreshed = await refreshSession()
  check('refresh returns an access token', typeof refreshed.access_token === 'string')
  check('the cookie holds what the server returned', getAccessToken() === refreshed.access_token)
  check('the rotated refresh token was stored too', getRefreshToken() === refreshed.refresh_token)
  /**
   * Deliberately NOT asserting that the new token differs from the old one.
   * The API signs {sub, account_id, type, exp} with no nonce and a second-
   * granular exp, so two tokens minted within the same second are byte
   * identical. That is a property of the token design, not of this client, and
   * an inequality assertion here would fail at random depending on timing.
   */

  console.log('\nCONCURRENT REFRESH IS SINGLE-FLIGHT\n')
  const [a, b, c] = await Promise.all([refreshSession(), refreshSession(), refreshSession()])
  check('three concurrent refreshes share one result', a.access_token === b.access_token && b.access_token === c.access_token)

  console.log('\nSIGN OUT\n')
  await signOut()
  check('access cookie cleared', getAccessToken() === null)
  check('refresh cookie cleared', getRefreshToken() === null)
  check('profile cleared', getStoredUser() === null)
  check('hasSession() is false again', hasSession() === false)
  check('readSession() is null again', readSession() === null)

  console.log('\nREJECTED CREDENTIALS\n')
  await signIn({ ...CRED, password: 'wrong-password' }).then(
    () => check('wrong password rejects', false, 'it resolved'),
    (e) => {
      check('wrong password -> unauthorized', e.code === 'unauthorized', `code=${e.code}`)
      check('envelope reason surfaced as fields', Boolean(e.fields?.credentials))
      check('no session was stored on failure', hasSession() === false)
    },
  )

  /**
   * A real-looking domain on purpose. `example.test` would return 422, not 401:
   * `.test` is an RFC 2606 special-use TLD that the API's email validator
   * refuses outright, so it never reaches the credential check and would test
   * the wrong path entirely.
   */
  await signIn({ ...CRED, email: 'nobody@notarealaccount.com' }).then(
    () => check('unknown email rejects', false),
    (e) => check('unknown email -> SAME code as wrong password (no enumeration)', e.code === 'unauthorized', `code=${e.code}`),
  )

  await signIn({ ...CRED, accountAlias: 'no-such-account' }).then(
    () => check('unknown account rejects', false),
    (e) => check('unknown account -> SAME code (no enumeration)', e.code === 'unauthorized', `code=${e.code}`),
  )

  console.log('\nSERVER-SIDE VALIDATION (FastAPI 422, not enveloped)\n')
  await signIn({ ...CRED, email: 'notanemail' }).then(
    () => check('malformed email rejects', false),
    (e) => {
      check('malformed email -> validation', e.code === 'validation', `code=${e.code}`)
      check('detail[] flattened to field name "email"', Boolean(e.fields?.email), JSON.stringify(e.fields))
    },
  )

  console.log('\nCASE SENSITIVITY OF THE ACCOUNT ALIAS\n')
  await signIn({ ...CRED, accountAlias: 'PRAGMATYC' }).then(
    () => check('upper-cased alias is REJECTED by the API (why we never transform it)', false, 'it succeeded'),
    (e) => check('upper-cased alias is REJECTED by the API (why we never transform it)', e.code === 'unauthorized', `code=${e.code}`),
  )
  const asTyped = await signIn({ ...CRED })
  check('alias as typed still works', typeof asTyped.accessToken === 'string')
  await signOut()
} catch (error) {
  failures += 1
  console.error('\nTHREW:', error?.code || error?.message, error?.stack?.split('\n')[1] ?? '')
} finally {
  await server.close()
}

console.log(failures === 0 ? '\nALL AUTH CHECKS PASSED\n' : `\n${failures} FAILED\n`)
process.exit(failures === 0 ? 0 : 1)
