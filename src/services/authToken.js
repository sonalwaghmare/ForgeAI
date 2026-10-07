/**
 * Session store: tokens in cookies, profile in localStorage.
 *
 * ── Why cookies, and what it costs ──────────────────────────────────────
 * The intended shape for this app was an access token in memory plus an
 * httpOnly refresh cookie the browser sends on its own, keeping both out of
 * reach of script. The API cannot do that: it returns the refresh token in the
 * JSON response body, so JavaScript necessarily holds it, and no arrangement of
 * client-side code can un-hold it.
 *
 * Given that, cookies are chosen over localStorage for a narrower blast radius:
 * they carry an explicit Max-Age so a stale session expires on its own instead
 * of lingering until something clears it, they are scoped by path, and
 * SameSite=Lax keeps them off cross-site navigations.
 *
 * This IS a deviation from "no session token in script-readable storage", and it
 * is recorded as an accepted risk in SECURITY.md rather than left implicit. The
 * only real mitigation is for the token to stop being readable at all, and that
 * requires the API to set the cookie itself — a server change, not a client one.
 *
 * ── What is stored where ────────────────────────────────────────────────
 *  forge_at      access token   session cookie — gone when the browser closes
 *  forge_rt      refresh token  Max-Age = config.sessionMaxAgeDays
 *  localStorage  name + email of the signed-in user
 *
 * The profile is not a credential and exists only to render a name in the top
 * bar, so it stays out of the cookies: anything in a cookie is uploaded on every
 * request to this origin, and a display name has no business in that budget.
 */

import { config } from './config'

const ACCESS_COOKIE = 'forge_at'
const REFRESH_COOKIE = 'forge_rt'
const PROFILE_KEY = 'forge.user'

let onUnauthorized = null

/* ── Cookie primitives ───────────────────────────────────────────────── */

function readCookie(name) {
  // Escaped because a cookie name is data: one stray regex character would
  // otherwise change what this matches.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function writeCookie(name, value, maxAgeSeconds) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'path=/',
    // Lax, not None: nothing here is embedded cross-site, and None would require
    // Secure while permitting the cookie on cross-site requests for no gain.
    'SameSite=Lax',
  ]
  // HTTPS only. Setting Secure on http://localhost makes the browser silently
  // drop the cookie, which presents as "signing in does nothing".
  if (window.location.protocol === 'https:') parts.push('Secure')
  // Omitted entirely for the access token, making it a session cookie that dies
  // with the browser. A refresh re-establishes the session on the next launch.
  if (maxAgeSeconds != null) parts.push(`Max-Age=${maxAgeSeconds}`)
  document.cookie = parts.join('; ')
}

function deleteCookie(name) {
  const parts = [`${name}=`, 'path=/', 'SameSite=Lax', 'Max-Age=0']
  if (window.location.protocol === 'https:') parts.push('Secure')
  document.cookie = parts.join('; ')
}

/* ── Tokens ──────────────────────────────────────────────────────────── */

export function getAccessToken() {
  return readCookie(ACCESS_COOKIE)
}

export function setAccessToken(token) {
  if (token) writeCookie(ACCESS_COOKIE, token)
  else deleteCookie(ACCESS_COOKIE)
}

export function getRefreshToken() {
  return readCookie(REFRESH_COOKIE)
}

export function setRefreshToken(token) {
  if (token) writeCookie(REFRESH_COOKIE, token, config.sessionMaxAgeDays * 24 * 60 * 60)
  else deleteCookie(REFRESH_COOKIE)
}

/* ── Profile ─────────────────────────────────────────────────────────── */

/**
 * The signed-in user, as the login response described them.
 *
 * Persisted because the API has no endpoint to ask again. Treated strictly as
 * display data: it decides what a label reads, never what anyone may do. Every
 * authorisation question belongs to the API.
 */
export function getStoredUser() {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    // Private browsing, or a value written by some earlier shape of this code.
    return null
  }
}

function setStoredUser(user) {
  try {
    if (user) window.localStorage.setItem(PROFILE_KEY, JSON.stringify(user))
    else window.localStorage.removeItem(PROFILE_KEY)
  } catch {
    /* Private browsing. Signing in still works; the name just will not persist. */
  }
}

/* ── Session lifecycle ───────────────────────────────────────────────── */

/** Persist everything a successful sign-in produced. */
export function setSession({ accessToken, refreshToken, user }) {
  setAccessToken(accessToken)
  setRefreshToken(refreshToken)
  setStoredUser(user)
}

/**
 * Remove every trace of the session.
 *
 * Deliberately tolerant of partial state: a session that lost one cookie but
 * kept another is precisely when this gets called, so it must not depend on
 * finding all three.
 */
export function clearSession() {
  deleteCookie(ACCESS_COOKIE)
  deleteCookie(REFRESH_COOKIE)
  setStoredUser(null)
}

/**
 * Is there anything to work with?
 *
 * A refresh token alone counts as signed in. The access cookie expires with the
 * browser, so on the next launch the refresh token is all that remains — and it
 * is enough to obtain a new access token. Treating that as signed out would
 * eject everyone on every restart.
 *
 * This answers "should the UI attempt this", never "is this person allowed to".
 * The token is not decoded and no claim inside it is trusted; the API decides.
 */
export function hasSession() {
  return Boolean(getAccessToken() || getRefreshToken())
}

/* ── Expiry handoff ──────────────────────────────────────────────────── */

/**
 * Register what happens when the session is definitively gone — the refresh
 * attempt itself failed, so nothing is left to retry with. The router registers
 * a redirect to the sign-in screen here.
 */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

export function handleUnauthorized() {
  clearSession()
  onUnauthorized?.()
}
