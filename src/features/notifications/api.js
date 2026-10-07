import { del, get, patch, post, put } from '@/services/http'
import { endpoints } from '@/services/endpoints'

/**
 * Notifications — alert rules, delivery channels, escalation.
 *
 * DEMO. See `DEMO-MODE.md` §8.8.
 *
 * ── This file is the seam ─────────────────────────────────────────────────
 * The enums live here and the page imports them from here, never from `mocks/`.
 */

/** Which edge of a band trips a rule. Not free text — see the fixture. */
export const RULE_EDGES = ['above', 'below']

/**
 * The severities a rule can raise at.
 *
 * Spelled here rather than imported from the anomaly module: this is the set a
 * RULE may be written at, and it happens to equal the set an anomaly may carry.
 * Labels come from `common:severity.*`, which both use.
 */
export const RULE_SEVERITIES = ['critical', 'high', 'medium', 'low']

/** Delivery channels, in the order the design lists them. */
export const NOTIFY_CHANNEL_IDS = ['email', 'teams', 'sms', 'slack', 'pagerduty']

const toRule = (row) => ({
  id: row.id,
  kind: row.kind,
  edge: row.edge,
  severity: row.severity,
  enabled: Boolean(row.enabled),
  created: Boolean(row.created),
  routes: row.routes ?? [],
  /* Where this rule would send something it cannot. Composed server-side from
     the rule and the channel list together — a client holding only one of the
     two could not work it out. */
  misrouted: row.misrouted ?? [],
  broken: Boolean(row.broken),
  /* One threshold per unit system in use, never converted between them. 0.49
     in/s and 12.5 mm/s are the same limit and the product refuses to render
     either in the other's unit — see `alerts.js`. */
  thresholds: row.thresholds ?? [],
  watching: row.watching ?? 0,
  assets: row.assets ?? 0,
  fired: row.fired ?? 0,
  lastFiredAt: row.lastFiredAt ?? null,
  lastAlertId: row.lastAlertId ?? null,
})

/**
 * The whole configuration, in one request.
 *
 * Three lists rather than three endpoints, because the facts worth showing are
 * the joins between them.
 */
export async function fetchNotifications(signal) {
  const data = await get(endpoints.notifications.list, { signal })
  return {
    rules: (data?.rules ?? []).map(toRule),
    channels: data?.channels ?? [],
    escalation: data?.escalation ?? [],
    stats: data?.stats ?? null,
    kinds: data?.kinds ?? [],
    preferences: data?.preferences ?? [],
  }
}

/** Turn a rule on or off. The only thing the table itself writes. */
export const setRuleEnabled = ({ id, enabled }) =>
  patch(endpoints.notifications.rule(id), { enabled })

/** Write a rule. Answers 422 for a kind the plant does not instrument. */
export const createRule = ({ kind, edge, severity, routes }) =>
  post(endpoints.notifications.rules, { kind, edge, severity, routes })

/**
 * A personal delivery preference.
 *
 * Separate from the rule toggle because it is a different subject: a rule
 * decides who the platform tells, a preference decides what it sends me.
 */
export const setPreference = ({ id, on }) => patch(endpoints.notifications.preference(id), { on })

/** Edit a rule. Its kind is fixed — see the fixture for why. */
export const updateRule = ({ id, ...body }) => put(endpoints.notifications.rule(id), body)

/** Remove a rule. Notifications matching it stop. */
export const removeRule = (id) => del(endpoints.notifications.rule(id))

/** Point a channel somewhere. Giving it a target is what connects it. */
export const configureChannel = ({ id, target }) =>
  patch(endpoints.notifications.channel(id), { target })

/** Send a test. Answers with what is true, including a failure. */
export const testChannel = (id) => post(endpoints.notifications.channelTest(id))

/** Add a rung to the escalation ladder. */
export const addEscalationLevel = (body) => post(endpoints.notifications.escalation, body)
