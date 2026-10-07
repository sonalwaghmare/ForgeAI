/**
 * Runtime configuration, read once from Vite env.
 *
 * Nothing secret lives here. A browser bundle has no secrets — every VITE_*
 * value is public by construction, so API keys and credentials must never be
 * added to this file or to any .env the client reads.
 */

const env = import.meta.env

/**
 * Transport mode for BUSINESS data — alerts, KPIs, hierarchy, the assistant.
 * 'mock' answers from fixtures; 'live' talks to VITE_API_URL.
 *
 * Authentication is deliberately not covered by this flag. See authMode below.
 */
const mode = env.VITE_API_MODE === 'live' ? 'live' : 'mock'

/**
 * Authentication always talks to the real API, whatever `mode` says.
 *
 * The auth service exists and the rest of the API does not, so the two are
 * split. One axios instance still serves both: the transport chooses per
 * request based on the path (services/http.js), which keeps a single
 * interceptor chain, one error shape and one refresh queue across both halves.
 *
 * VITE_AUTH_MODE=mock exists only to work on the login screen with the backend
 * switched off. There are no auth fixtures behind it — requests simply fail.
 */
const authMode = env.VITE_AUTH_MODE === 'mock' ? 'mock' : 'live'

/**
 * Demo mode — the prototype surfaces, on top of the working product.
 *
 * `VITE_DEMO_MODE=true` turns on every screen and panel that exists in the
 * Claude Design prototype but has no API behind it yet. It is ADDITIVE: nothing
 * that already works is replaced or stubbed out, so a demo session shows the
 * real anomaly list and the real hierarchy alongside the hardcoded screens.
 *
 * Off (the default, and what ships) the app is exactly what it is today —
 * unbuilt modules say so rather than showing authored numbers.
 *
 * Everything the flag reveals reads through the ordinary hook → service →
 * transport path, so the fixture behind it is swapped for a real endpoint by
 * editing one `api.js`, not by unpicking the screen.
 */
const demoMode = env.VITE_DEMO_MODE === 'true'

/**
 * True when this page is being served from a developer's own machine.
 *
 * Decided at RUNTIME rather than at build time, and that is the point: it makes a
 * production build testable locally. `vite preview` serves the real bundle, and a
 * bundle with an absolute API URL compiled into it would call the API directly and
 * be refused — the API allows exactly one origin, the deployed frontend's, and
 * localhost is not it. So the same artifact you are about to hand over reads its
 * own address and behaves correctly in both places.
 *
 * `location` is absent under Node, where `scripts/verify-auth.mjs` imports this.
 * That path sets `VITE_API_URL` to an absolute localhost URL and has no proxy of
 * its own, so falling through to "not localhost" is the correct answer there.
 */
const servedLocally =
  typeof location !== 'undefined' &&
  /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(location.hostname)

/**
 * `VITE_API_URL` → what the browser should actually call.
 *
 * On localhost, the PATH only, so the request stays same-origin and Vite forwards
 * it — `server.proxy` under `npm run dev`, `preview.proxy` under
 * `npm run preview`, both derived from this same value in `vite.config.js`.
 *
 * Anywhere else, the whole URL: there is no proxy in front of a deployed build,
 * and the origin it is served from is the one the API's CORS allows.
 *
 * A value that is already relative is returned as-is rather than thrown over —
 * it is exactly what the localhost case wants, and `new URL` would reject it.
 */
function apiBaseUrl(url) {
  const trimmed = url.replace(/\/+$/, '')
  if (!servedLocally) return trimmed
  try {
    return new URL(trimmed).pathname.replace(/\/+$/, '') || '/api'
  } catch {
    return trimmed
  }
}

export const config = {
  mode,
  authMode,
  demoMode,

  /**
   * Where the API is. Derived from the one variable `.env` carries.
   *
   * ── Relative on localhost, absolute anywhere else ────────────────────────
   * The API's CORS allows exactly one origin, the deployed frontend's, so nothing
   * on localhost can call it directly — the preflight is refused. Served locally
   * the browser therefore uses only the PATH of `VITE_API_URL`, which keeps the
   * request same-origin and lets Vite forward it. Deployed, it uses the whole URL,
   * because there is no proxy in front of a built app.
   *
   * The choice is made from `location.hostname` at runtime, not from the build
   * mode, so `npm run preview` can exercise the real bundle before it ships.
   *
   * Both halves come from the same value, which is why changing the endpoint is
   * one line in `.env` and nothing else.
   */
  apiBaseUrl: apiBaseUrl(env.VITE_API_URL || 'http://localhost:8000/api'),
  requestTimeoutMs: Number(env.VITE_API_TIMEOUT_MS) || 20000,

  /**
   * How long a signed-in session survives, in days. Matched to the API's
   * REFRESH_TOKEN_EXPIRE_DAYS: a refresh cookie outliving the token inside it
   * would present a dead session as a live one and fail on first use.
   */
  sessionMaxAgeDays: Number(env.VITE_SESSION_MAX_AGE_DAYS) || 30,

  /**
   * Language the assistant writes in. Exists from day one and is plumbed
   * through on every AI request so it is never retrofitted. English for now;
   * whether it is ever set to anything else is a later decision.
   */
  aiOutputLocale: env.VITE_AI_OUTPUT_LOCALE || 'en',

  /** Latency the mock adapter simulates, so loading states are real. */
  mockLatencyMs: Number(env.VITE_MOCK_LATENCY_MS ?? 320),

  /** 0–1. Injects transport failures so error states get exercised. */
  mockErrorRate: Number(env.VITE_MOCK_ERROR_RATE ?? 0),

  isDev: env.DEV,
}

export const isMockMode = mode === 'mock'

/**
 * True when the prototype surfaces should render. Read this rather than the env
 * variable, so the one place that decides what "on" means is `config` above.
 */
export const isDemoMode = demoMode

/** True when sign-in hits the real API. The default, and the intended state. */
export const isLiveAuth = authMode === 'live'
