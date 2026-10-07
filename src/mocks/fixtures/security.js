import { audit } from './audit'
import { directory } from './directory'

/**
 * Security & access.
 *
 * SYNTHETIC. Gated on `VITE_DEMO_MODE`. See `DEMO-MODE.md` §8.18.
 *
 * ── A policy that is only stored is still worth storing honestly ──────────
 * Nothing in this build enforces a minimum password length; there is no login
 * to enforce it at. What this page CAN do is hold the decision, report who it
 * would affect, and write it to the audit log — and it does all three. The
 * design's own audit log has a row reading `settings:security · MFA enforcement
 * enabled`, so the two screens were always meant to be joined; here they
 * actually are.
 *
 * ── Requiring MFA has a number attached to it ─────────────────────────────
 * Three accounts in this directory have no second factor. Turning the
 * requirement on is therefore a statement about three named people, and the
 * screen says so and links to them. A toggle that reported nothing would be the
 * same switch with the interesting part left out.
 *
 * ── There is one session and it is this browser ───────────────────────────
 * The design lists three, with IP addresses and cities. A session is held by the
 * server that issued it; there is no server here, so the only session this
 * product can honestly report is the one running the page. Its device is read
 * from the user agent, which IS knowable client-side, and its address is not —
 * the column stays and reads an em dash, the same call the audit log makes.
 */

/* ── Authentication ───────────────────────────────────────────────────────
   `locked` fields are settings this product does not offer as a choice. HTTPS
   is one: the design draws it as a disabled switch reading "Locked for
   compliance" and that is right, so it is drawn the same way. */

const DEFAULTS = {
  sso: false,
  ssoProvider: 'Okta',
  ssoEntityId: 'urn:forge:saml',
  ssoUrl: '',
  requireMfa: true,
  minimumLength: 12,
  passwordExpiry: 'd90',
  requireUppercase: true,
  requireNumbers: true,
  requireSpecial: true,
  preventReuse: true,
  sessionTimeout: 'h1',
  concurrentSessions: '2',
  ipAllowlist: false,
  ipAllowlistCidrs: '',
  httpsOnly: true,
  rateLimiting: true,
  rateLimit: 1000,
  logApiRequests: true,
}

export const SSO_PROVIDERS = ['Okta', 'Azure AD', 'Google Workspace', 'Custom SAML']
export const PASSWORD_EXPIRY = ['d90', 'd180', 'never']
export const SESSION_TIMEOUTS = ['m15', 'm30', 'h1', 'h4', 'h8']
export const CONCURRENT_SESSIONS = ['1', '2', '5', 'unlimited']

/**
 * The second factors this platform accepts.
 *
 * `weak` rather than a second status: SMS is accepted and is the one an attacker
 * with a phone company can defeat, which is a different statement from "not
 * supported" and the reason the design marks it with a warning rather than a
 * cross.
 */
export const MFA_METHODS = [
  { id: 'totp', accepted: true, weak: false },
  { id: 'sms', accepted: true, weak: true },
  { id: 'fido2', accepted: true, weak: false },
]

/** Session state, like every other demo write. */
const STATE = new Map()

const valueOf = (key) => (STATE.has(key) ? STATE.get(key) : DEFAULTS[key])

/** Fields this screen owns. Anything else in a payload is ignored, not stored. */
const WRITABLE = new Set(Object.keys(DEFAULTS).filter((key) => key !== 'httpsOnly'))

/**
 * What the signed-in browser is.
 *
 * Read from the user agent at request time. Crude on purpose — a full parser
 * would be a dependency for one line of a demo — and it reports what it found
 * rather than guessing when it recognises nothing.
 */
function deviceOf(userAgent = '') {
  const platform =
    /Macintosh/.test(userAgent) ? 'macOS'
    : /Windows/.test(userAgent) ? 'Windows'
    : /iPhone|iPad/.test(userAgent) ? 'iOS'
    : /Android/.test(userAgent) ? 'Android'
    : /Linux/.test(userAgent) ? 'Linux'
    : null
  const browser =
    /Edg\//.test(userAgent) ? 'Edge'
    : /Chrome\//.test(userAgent) ? 'Chrome'
    : /Safari\//.test(userAgent) ? 'Safari'
    : /Firefox\//.test(userAgent) ? 'Firefox'
    : null
  if (!platform && !browser) return null
  return [platform, browser].filter(Boolean).join(' · ')
}

/**
 * The sessions this product can honestly report: one, and it is this page.
 *
 * `self` marks it so the table can say whose it is, and so Revoke on it means
 * signing out rather than a request to a server that would have to exist.
 */
export function sessionsFor(userAgent, now = Date.now()) {
  const me = directory(now).find((person) => person.id === 'usr_mgr_1') ?? null
  if (!me) return []
  return [
    {
      id: 'session_self',
      self: true,
      personId: me.id,
      personName: me.name,
      device: deviceOf(userAgent),
      /* Recorded by the server that received the request. There is none. */
      ip: null,
      location: null,
      lastActiveAt: new Date(now).toISOString(),
    },
  ]
}

/** Everything the page reads, in one payload. */
export function securitySettings(userAgent, now = Date.now()) {
  const people = directory(now)
  const withoutMfa = people.filter((person) => person.status !== 'inactive' && !person.mfa)

  return {
    settings: Object.fromEntries(Object.keys(DEFAULTS).map((key) => [key, valueOf(key)])),
    /* The number that makes the MFA switch mean something. Counted over the
       directory rather than written here, so enrolling somebody moves it. */
    mfa: {
      methods: MFA_METHODS,
      total: people.length,
      enrolled: people.length - withoutMfa.length,
      missing: withoutMfa.length,
      missingNames: withoutMfa.map((person) => person.name),
    },
    sessions: sessionsFor(userAgent, now),
    options: {
      ssoProviders: SSO_PROVIDERS,
      passwordExpiry: PASSWORD_EXPIRY,
      sessionTimeouts: SESSION_TIMEOUTS,
      concurrentSessions: CONCURRENT_SESSIONS,
    },
  }
}

/**
 * Change the policy.
 *
 * Every accepted change is written to the audit log as `SETTINGS_CHANGED` on
 * `settings:security`, which is the row the design's own audit table shows. It
 * is critical severity: turning MFA enforcement off is exactly the entry an
 * access review is opened to find.
 */
export function saveSecurity(values = {}, now = Date.now()) {
  const changed = []

  for (const [key, value] of Object.entries(values)) {
    if (!WRITABLE.has(key)) continue
    if (valueOf(key) === value) continue
    STATE.set(key, value)
    changed.push(key)
  }

  if (changed.length) {
    audit(
      'SETTINGS_CHANGED',
      { resource: 'settings:security', detail: { fields: changed.join(', ') } },
      now,
    )
  }
  return { changed }
}

export function resetSecurity() {
  STATE.clear()
}
