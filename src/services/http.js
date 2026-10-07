import axios from 'axios'
import { toApiError, ERROR_CODES } from './apiError'
import { endpoints } from './endpoints'
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  handleUnauthorized,
  setAccessToken,
  setRefreshToken,
} from './authToken'
import { mockAdapter } from '@/mocks/mockAdapter'
import { config } from './config'

/**
 * The one HTTP client. Screens never import axios; they call service functions
 * that call this instance.
 *
 * ── Hybrid transport ────────────────────────────────────────────────────
 * Authentication is live and nothing else is, so the adapter chooses per
 * request: auth paths go to the network, everything else is answered from
 * fixtures.
 *
 * It is one instance rather than two on purpose. Interceptors, header injection,
 * envelope unwrapping, ApiError normalisation, the refresh queue and timeouts
 * are then provably identical across both halves — so as each real endpoint
 * lands, moving it over is one entry in LIVE_PATHS and nothing else.
 */

/**
 * Paths the real API serves today. Everything else falls through to fixtures.
 *
 * Prefix-matched, so `/v1/asset-classes/{id}` is covered by its collection.
 */
const LIVE_PATHS = [
  endpoints.auth.login,
  endpoints.auth.refresh,
  endpoints.assetClasses.list,
  endpoints.hierarchy.tree,
  endpoints.hierarchy.regions,
  endpoints.hierarchy.subRegions,
  endpoints.hierarchy.plants,
  endpoints.hierarchy.lines,
  endpoints.hierarchy.machines,
  /* Data Fusion. One prefix, which now covers the whole resource — the wizard
     creates a connection, reads the connector catalogue and probes an endpoint,
     and the collection, detail, update and delete routes under it are all real
     endpoints with no fixture behind them either. So anything that reaches for
     `/v1/connections/…` should go to the network; there is nothing else for it
     to talk to. */
  endpoints.dataFusion.connections,
  /* Sensors. The whole resource — `POST`, `GET` (collection and detail), `PUT`
     and `DELETE` — plus the two master-data collections mounted under it,
     `/waveform-types` and `/value-units`. One prefix covers all of them, since
     `isLivePath` matches on the start of the path. There is no mock route under
     this prefix on purpose: a fixture here would claim to have stored a sensor
     that no broker will ever be told to read. */
  endpoints.sensors.list,
  /* Anomalies. List, detail and PATCH are served. Deliberately NOT
     `endpoints.alerts.list` — that prefix stays on fixtures, because the two are
     different resources and the demo surfaces still read it. See endpoints.js. */
  endpoints.anomalies.list,
  /* Copilot. `sessions` and `sessions/{id}/turns` are proxied to the AI engine
     and real. `turns` streams SSE and never goes through axios at all — see
     features/copilot/stream.js — so it is listed for the reader rather than for
     the adapter. `copilot.messages` stays on fixtures: it feeds the public
     page's scripted conversation, which is a different thing entirely. */
  endpoints.copilot.sessions,
  endpoints.copilot.turns,
  /* Conversation history for one incident. Its own prefix because no existing one
     covers `/copilot/anomalies/{id}/turns` — `copilot.turns` is a different path
     and `startsWith` will not reach it. Left out, the adapter answers a real
     endpoint from fixtures, which presents as history that never changes. */
  endpoints.copilot.anomalies,
]

const isLivePath = (url = '') => LIVE_PATHS.some((path) => url.startsWith(path))

/**
 * Whether to talk to the real server at all.
 *
 * This reads VITE_AUTH_MODE rather than a flag of its own because auth and the
 * live endpoints are the same FastAPI process — "is the backend running" is one
 * question, not two. Setting it to `mock` therefore takes every live path back
 * to the fixture layer, which is also the only way to open the app with no
 * server at all.
 */
const backendReachable = () => config.authMode === 'live'

/** Resolved once. Asking axios for its own default avoids guessing xhr vs fetch. */
const networkAdapter = axios.getAdapter(axios.defaults.adapter)

function hybridAdapter(cfg) {
  if (config.mode === 'live') return networkAdapter(cfg)
  if (backendReachable() && isLivePath(cfg.url)) return networkAdapter(cfg)
  return mockAdapter(cfg)
}

export const http = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: config.requestTimeoutMs,
  // Same-origin through the dev proxy, so cookies travel regardless. Enabled in
  // live mode for the day the API is served from another origin with CORS.
  withCredentials: config.mode === 'live',
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  adapter: hybridAdapter,
})

/** Correlation id per request, so a support ticket can name one call. */
let seq = 0
const requestId = () => `web-${Date.now().toString(36)}-${(++seq).toString(36)}`

/* ── Request ─────────────────────────────────────────────────────────── */
http.interceptors.request.use((cfg) => {
  const token = getAccessToken()
  if (token) cfg.headers.Authorization = `Bearer ${token}`

  cfg.headers['X-Request-Id'] = requestId()

  // UI language, negotiated by the server for any server-rendered copy.
  cfg.headers['Accept-Language'] = document?.documentElement?.lang || 'en'

  // AI output language is a first-class parameter from day one so it is never
  // retrofitted. It travels separately from Accept-Language on purpose: what
  // the model writes in is an org/user setting, not the reader's browser.
  if (cfg.meta?.ai) {
    cfg.headers['X-Forge-AI-Locale'] = config.aiOutputLocale
  }

  return cfg
})

/* ── Response envelope ───────────────────────────────────────────────── */

/**
 * The API wraps every success in `{message, response_code, status, data}`.
 * Callers want the payload, so it is unwrapped once here instead of in each of
 * them — otherwise every feature reimplements the same `.data.data`.
 *
 * Shape-detected rather than path-detected, so mock responses (already
 * unwrapped) pass through untouched. All four keys must be present: a payload
 * that merely happens to carry a `data` property is not an envelope.
 */
export function unwrapEnvelope(body) {
  const looksLikeEnvelope =
    body !== null &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    'data' in body &&
    'status' in body &&
    'message' in body &&
    typeof body.response_code === 'number'

  return looksLikeEnvelope ? body.data : body
}

/* ── Refresh ─────────────────────────────────────────────────────────── */

/**
 * Exchange the refresh token for a new pair.
 *
 * The API returns a NEW refresh token alongside the access token without
 * invalidating the old one, so both are stored. Keeping the original would work
 * today but would break the moment the server starts rotating for real.
 *
 * `_skipAuthRefresh` marks this call so a 401 from refresh cannot recurse back
 * into here.
 */
let inFlightRefresh = null

export function refreshSession() {
  // Concurrent 401s must share one refresh, or they stampede — and with a
  // rotating token, the losers of that race would spend one already spent.
  inFlightRefresh ??= (async () => {
    const refreshToken = getRefreshToken()
    // Nothing to refresh with. Thrown rather than returned so a caller's catch is
    // the single place that handles "the session is gone".
    if (!refreshToken) throw new Error('no-refresh-token')

    const response = await http.post(
      endpoints.auth.refresh,
      { refresh_token: refreshToken },
      { _skipAuthRefresh: true },
    )
    // Already unwrapped by the response interceptor.
    const session = response.data

    if (!session?.access_token) throw new Error('refresh-returned-no-token')

    setAccessToken(session.access_token)
    if (session.refresh_token) setRefreshToken(session.refresh_token)
    return session
  })().finally(() => {
    inFlightRefresh = null
  })

  return inFlightRefresh
}

/* ── Response ────────────────────────────────────────────────────────── */
http.interceptors.response.use(
  (response) => {
    response.data = unwrapEnvelope(response.data)
    return response
  },
  async (error) => {
    const apiError = toApiError(error)
    const original = error.config

    /**
     * A 401 from login is an ANSWER — the credential was wrong — not an expired
     * session. Refreshing on it would turn a failed sign-in into a token refresh
     * and silently re-POST the credential. The sign-in screen handles it.
     *
     * A 401 from refresh means the refresh token is spent or expired: nothing is
     * left to try, so it falls to the terminal branch below.
     */
    const isLoginAttempt = original?.url === endpoints.auth.login
    const isRefreshAttempt = original?.url === endpoints.auth.refresh || original?._skipAuthRefresh

    if (apiError.code === ERROR_CODES.UNAUTHORIZED && !isLoginAttempt && !isRefreshAttempt) {
      // One attempt only. Retrying against a dead session is just a slower route
      // to the same redirect.
      if (original && !original._retried) {
        original._retried = true
        try {
          await refreshSession()
          // Reissued with the new token: the request interceptor reads the cookie
          // again on the way back out.
          return http(original)
        } catch {
          // The refresh itself failed, so the session is genuinely over.
          handleUnauthorized()
        }
      } else {
        handleUnauthorized()
      }
    }

    // A refresh that 401s ends the session. The branch above deliberately skips
    // it, so the handoff happens exactly once, here.
    if (apiError.code === ERROR_CODES.UNAUTHORIZED && isRefreshAttempt) {
      clearSession()
      handleUnauthorized()
    }

    if (import.meta.env.DEV) {
      // Method and path only. Never the body — it can carry a credential.
      console.warn(
        `[api] ${apiError.code}`,
        `${original?.method?.toUpperCase() ?? '?'} ${original?.url ?? '?'}`,
        apiError.requestId ?? '',
      )
    }

    return Promise.reject(apiError)
  },
)

/** Unwrap to the payload. Every service function goes through this. */
export async function request(cfg) {
  const response = await http(cfg)
  return response.data
}

export const get = (url, cfg) => request({ ...cfg, method: 'get', url })
export const post = (url, data, cfg) => request({ ...cfg, method: 'post', url, data })
export const patch = (url, data, cfg) => request({ ...cfg, method: 'patch', url, data })
// PUT rather than PATCH is not a style choice: the API has no partial-patch
// semantics anywhere, so every update sends the whole updatable record.
export const put = (url, data, cfg) => request({ ...cfg, method: 'put', url, data })
export const del = (url, cfg) => request({ ...cfg, method: 'delete', url })
