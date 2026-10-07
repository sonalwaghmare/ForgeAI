import { endpoints, API_VERSION } from '@/services/endpoints'
import { audit } from './audit'
import { PERMISSION_CATALOGUE } from './roles'

/**
 * API keys, webhooks and the published specification.
 *
 * SYNTHETIC. Gated on `VITE_DEMO_MODE`. See `DEMO-MODE.md` §8.19.
 *
 * ── A key's value exists once and is never stored ─────────────────────────
 * Generating one returns the secret in that response and in no other. What is
 * kept is the prefix, the scopes and the timestamps — never the value, never a
 * hash of it in a fixture that would then be printable. The design gets this
 * right ("This key will not be shown again") and it is the one place on the page
 * where getting it wrong would be a real defect rather than a cosmetic one, so
 * `verify:mocks` searches every subsequent response for the value it was given.
 *
 * ── The scopes are this product's modules ─────────────────────────────────
 * `read:anomalies`, `write:workorders`. Built from `PERMISSION_CATALOGUE` — the
 * navigation rail — the same way the roles page builds its permission grid, so a
 * scope cannot name a module nobody can reach. The design writes `read:oee` and
 * `read:assets` freehand, which happen to exist, beside `read:all` which is the
 * only one that does not need checking.
 *
 * ── The events are things that actually happen here ───────────────────────
 * Each one names the module that raises it and `verify:mocks` asserts the module
 * exists. The design lists `prediction.alert` and `incident.critical`; this
 * product has neither concept under those names, and a webhook subscribing to an
 * event nothing emits is a subscription that will never fire and nobody will
 * ever be able to tell.
 */

/* ── Scopes ───────────────────────────────────────────────────────────────
   A module can be read. It can be written if it has anything beyond its gate
   and an export — a screen whose only features are "view" and "export" has
   nothing an integration could change. */

const WRITEABLE = (module) =>
  module.features.some((feature) => feature !== module.gate && feature !== 'export')

export function apiScopes() {
  return [
    { id: 'read:all', module: null },
    ...PERMISSION_CATALOGUE.flatMap((module) => [
      { id: `read:${module.id}`, module: module.id },
      ...(WRITEABLE(module) ? [{ id: `write:${module.id}`, module: module.id }] : []),
    ]),
  ]
}

const SCOPE_IDS = () => new Set(apiScopes().map((scope) => scope.id))

/* ── Events ───────────────────────────────────────────────────────────────
   Every one raised by a module in the rail, named after what it is. */

export const WEBHOOK_EVENTS = [
  { id: 'anomaly.detected', module: 'anomalies' },
  { id: 'anomaly.acknowledged', module: 'anomalies' },
  { id: 'anomaly.resolved', module: 'anomalies' },
  { id: 'workorder.created', module: 'workOrders' },
  { id: 'workorder.closed', module: 'workOrders' },
  { id: 'oee.below_target', module: 'oee' },
  { id: 'shift.handover.published', module: 'shifts' },
  { id: 'document.uploaded', module: 'dataFusion' },
]

const EVENT_IDS = new Set(WEBHOOK_EVENTS.map((event) => event.id))

/* ── Keys ─────────────────────────────────────────────────────────────────
   `lastUsedMinutesAgo` is authored and `null` means never: nothing in this build
   serves an API request, so there is no call to derive a last use from. It is
   the one figure on this page that is a plain assertion, and it is marked as
   one here rather than dressed up as a count. */

const KEYS = [
  {
    id: 'key_prod',
    name: 'Production Integration',
    prefix: 'sk_prod',
    scopes: ['read:all', 'write:workOrders'],
    createdDaysAgo: 214,
    lastUsedMinutesAgo: 5,
    status: 'active',
  },
  {
    id: 'key_ci',
    name: 'CI/CD Pipeline',
    prefix: 'sk_ci',
    scopes: ['read:assets', 'read:anomalies'],
    createdDaysAgo: 168,
    lastUsedMinutesAgo: null,
    status: 'active',
  },
  {
    id: 'key_dash',
    name: 'Dashboard Export',
    prefix: 'sk_dash',
    scopes: ['read:oee', 'read:anomalies'],
    createdDaysAgo: 129,
    lastUsedMinutesAgo: 2 * 24 * 60,
    status: 'active',
  },
]

export const KEY_EXPIRY = ['never', 'd30', 'd90', 'y1']

const EXPIRY_DAYS = { never: null, d30: 30, d90: 90, y1: 365 }

/**
 * A new secret.
 *
 * Real randomness rather than a seeded sequence: this is the one value in the
 * fixture layer that must not be reproducible, because a demo key somebody can
 * predict is a demo of the wrong thing.
 */
function newSecret(prefix) {
  const bytes = new Uint8Array(24)
  globalThis.crypto.getRandomValues(bytes)
  const body = [...bytes]
    .map((byte) => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[byte % 62])
    .join('')
  return `${prefix}_${body}`
}

export function composeKey(key, now = Date.now()) {
  return {
    id: key.id,
    name: key.name,
    /* What the table prints. The value itself is not here and never was. */
    prefix: `${key.prefix}_••••`,
    scopes: key.scopes,
    createdAt: new Date(now - key.createdDaysAgo * 86_400_000).toISOString(),
    lastUsedAt:
      key.lastUsedMinutesAgo == null
        ? null
        : new Date(now - key.lastUsedMinutesAgo * 60_000).toISOString(),
    expiresAt:
      key.expiryDays == null
        ? null
        : new Date(now - key.createdDaysAgo * 86_400_000 + key.expiryDays * 86_400_000).toISOString(),
    status: key.status,
  }
}

export const allKeys = (now = Date.now()) => KEYS.map((key) => composeKey(key, now))

/**
 * Generate one.
 *
 * The secret is returned here and nowhere else. `composeKey` cannot print it
 * because the record never holds it, which is a stronger arrangement than
 * remembering not to send it.
 */
export function createKey({ name, scopes = [], expiry = 'never' }, now = Date.now()) {
  const clean = scopes.filter((scope) => SCOPE_IDS().has(scope))
  if (!name?.trim() || !clean.length) return null

  const prefix = `sk_${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) || 'key'}`
  const record = {
    id: `key_new_${KEYS.length + 1}`,
    name: name.trim(),
    prefix,
    scopes: clean,
    createdDaysAgo: 0,
    lastUsedMinutesAgo: null,
    expiryDays: EXPIRY_DAYS[expiry] ?? null,
    status: 'active',
  }
  KEYS.push(record)
  audit('API_KEY_CREATED', { resource: `apiKey:${record.id}`, detail: { name: record.name } }, now)
  return { ...composeKey(record, now), secret: newSecret(prefix) }
}

/** Replace the value. The old one stops working; the record and its scopes stay. */
export function rotateKey(id, now = Date.now()) {
  const key = KEYS.find((entry) => entry.id === id)
  if (!key || key.status !== 'active') return null
  key.lastUsedMinutesAgo = null
  audit('API_KEY_ROTATED', { resource: `apiKey:${id}`, detail: { name: key.name } }, now)
  return { ...composeKey(key, now), secret: newSecret(key.prefix) }
}

/**
 * Revoke.
 *
 * The row stays and reads Revoked rather than disappearing: which keys existed
 * and when they were withdrawn is exactly what somebody reviewing API access
 * needs, and a table that quietly shrinks cannot answer it.
 */
export function revokeKey(id, now = Date.now()) {
  const key = KEYS.find((entry) => entry.id === id)
  if (!key || key.status === 'revoked') return null
  key.status = 'revoked'
  audit('API_KEY_REVOKED', { resource: `apiKey:${id}`, detail: { name: key.name } }, now)
  return composeKey(key, now)
}

/* ── Webhooks ─────────────────────────────────────────────────────────── */

const WEBHOOKS = [
  {
    id: 'hook_wo',
    name: 'Work Order Sync',
    url: 'https://erp.meridian.corp/webhook/work-orders',
    events: ['workorder.created', 'workorder.closed'],
    lastTriggeredMinutesAgo: 3,
    status: 'active',
  },
  {
    id: 'hook_incident',
    name: 'Incident Notify',
    url: 'https://events.pagerduty.com/v2/enqueue',
    events: ['anomaly.detected'],
    lastTriggeredMinutesAgo: 60,
    status: 'active',
  },
]

export const composeWebhook = (hook, now = Date.now()) => ({
  ...hook,
  lastTriggeredAt:
    hook.lastTriggeredMinutesAgo == null
      ? null
      : new Date(now - hook.lastTriggeredMinutesAgo * 60_000).toISOString(),
})

export const allWebhooks = (now = Date.now()) => WEBHOOKS.map((hook) => composeWebhook(hook, now))

const validUrl = (url) => {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export function saveWebhook({ id, name, url, events = [] }, now = Date.now()) {
  const clean = events.filter((event) => EVENT_IDS.has(event))
  /* HTTPS only. A webhook carries plant data to a third party and there is no
     reason this product should be willing to send it in the clear — the same
     rule the API Security card states and cannot turn off. */
  if (!name?.trim() || !validUrl(url) || !clean.length) return null

  const existing = id ? WEBHOOKS.find((hook) => hook.id === id) : null
  if (existing) {
    Object.assign(existing, { name: name.trim(), url, events: clean })
    audit('WEBHOOK_UPDATED', { resource: `webhook:${existing.id}`, detail: { name: existing.name } }, now)
    return composeWebhook(existing, now)
  }

  const record = {
    id: `hook_new_${WEBHOOKS.length + 1}`,
    name: name.trim(),
    url,
    events: clean,
    lastTriggeredMinutesAgo: null,
    status: 'active',
  }
  WEBHOOKS.push(record)
  audit('WEBHOOK_CREATED', { resource: `webhook:${record.id}`, detail: { name: record.name } }, now)
  return composeWebhook(record, now)
}

export function deleteWebhook(id, now = Date.now()) {
  const index = WEBHOOKS.findIndex((hook) => hook.id === id)
  if (index < 0) return null
  const [removed] = WEBHOOKS.splice(index, 1)
  audit('WEBHOOK_DELETED', { resource: `webhook:${id}`, detail: { name: removed.name } }, now)
  return { id, deleted: true }
}

/**
 * What a test produces.
 *
 * The exact body that would be delivered, and not a delivery. Firing a real
 * request would send plant data to a third-party endpoint from the reader's
 * browser, which is not a thing a settings page should do on a button press —
 * and the design's version reports "Test event sent" without having sent one.
 * Showing the payload is the useful half and the true one: it is what somebody
 * opens Test to find out.
 */
export function testWebhook(id, now = Date.now()) {
  const hook = WEBHOOKS.find((entry) => entry.id === id)
  if (!hook) return null
  const event = hook.events[0]
  return {
    id,
    url: hook.url,
    event,
    payload: {
      event,
      delivered_at: new Date(now).toISOString(),
      webhook_id: hook.id,
      data: { id: 'EXAMPLE-0001', site: 'site_findlay' },
    },
  }
}

/* ── The published specification ──────────────────────────────────────────
   Generated from `endpoints.js`, which is the one place this client is allowed
   to write a URL. So the document describes the paths the product actually
   calls, and a path that is added there appears here without anybody
   maintaining a second list. `verify:mocks` asserts the two agree.

   It is a real OpenAPI 3.0 document and a real Postman collection, not a file
   named like one. What it does NOT carry is request and response schemas: those
   live in the server that has not been written, and inventing them would make
   this the fourth place in the repository claiming to know the contract. */

/* An alphanumeric placeholder, because at least one path builder runs the id
   through `encodeURIComponent` and `{id}` comes back as `%7Bid%7D`. Substituted
   for the OpenAPI spelling after the path is built. */
const PROBE = 'PATHPARAMID'
const PLACEHOLDER = '{id}'

function declaredPaths() {
  const paths = new Set()
  const walk = (value) => {
    if (typeof value === 'string' && value.startsWith(`/${API_VERSION}`)) paths.add(value)
    else if (typeof value === 'function') {
      try {
        const built = value(PROBE)
        if (typeof built === 'string') paths.add(built.replaceAll(PROBE, PLACEHOLDER))
      } catch {
        /* A path builder that needs more than one argument is skipped rather
           than guessed at. */
      }
    } else if (value && typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(endpoints)
  return [...paths].sort()
}

export function openApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Forge AI REST API',
      version: API_VERSION,
      description:
        'Generated from the paths this client declares. Request and response schemas are not included: they belong to the service, and a specification that guessed them would be wrong in a way nobody could see.',
    },
    paths: Object.fromEntries(
      declaredPaths().map((path) => [
        path,
        {
          get: {
            summary: path,
            parameters: path.includes(PLACEHOLDER)
              ? [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }]
              : [],
            responses: { 200: { description: 'OK' } },
          },
        },
      ]),
    ),
  }
}

export function postmanCollection() {
  return {
    info: {
      name: 'Forge AI REST API',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    variable: [{ key: 'baseUrl', value: 'https://api.meridian.example' }],
    item: declaredPaths().map((path) => ({
      name: path,
      request: {
        method: 'GET',
        header: [{ key: 'Authorization', value: 'Bearer {{apiKey}}' }],
        url: { raw: `{{baseUrl}}${path}`, host: ['{{baseUrl}}'], path: path.split('/').filter(Boolean) },
      },
    })),
  }
}

export const developerAccess = (now = Date.now()) => ({
  keys: allKeys(now),
  webhooks: allWebhooks(now),
  events: WEBHOOK_EVENTS,
  scopes: apiScopes(),
  expiry: KEY_EXPIRY,
  spec: { paths: declaredPaths().length, version: API_VERSION },
})
