import { ALERTS, SEVERITIES } from './alerts'
import { HIERARCHY_NODES } from './hierarchy'
import { audit } from './audit'
import { SIGNAL_SPEC } from './lines'
import { SIGNAL_CHANNELS, kindOfAlert } from './signals'
import { TASK_PEOPLE } from './home'

/**
 * Notifications — alert rules, delivery channels, escalation.
 *
 * SYNTHETIC, like everything in this directory. Gated on `VITE_DEMO_MODE`.
 *
 * ── A rule's condition is not authored ────────────────────────────────────
 * The prototype writes `VIB > 40 mm/s` as a string beside a rule named
 * "Critical vibration", on a tag called `VIB-204`. Three problems in one row:
 * the number is typed rather than read from anywhere, so it can drift from the
 * threshold the detector actually uses; the tag is from another demo's plant;
 * and 40 mm/s is not the limit its own alert fixture trips at.
 *
 * Here a rule names a SENSOR KIND, and the condition comes from `SIGNAL_SPEC` —
 * the same band the Sensor Explorer draws and the same edge `ALR-4471` trips at.
 * A rule therefore cannot state a limit the rest of the product disagrees with.
 *
 * ── And it carries both units, deliberately ───────────────────────────────
 * Findlay measures vibration in in/s and Weißenthurm in mm/s, and 0.49 in/s and
 * 12.5 mm/s are the same physical limit. `alerts.js` already refuses to convert
 * between them, calling a single-unit display of the pair a safety defect. A
 * rule spans both sites, so it reports both thresholds rather than picking one
 * and being wrong for half the plant.
 *
 * ── What a rule is FOR is measured ────────────────────────────────────────
 * `watching` is how many live channels the rule covers and `fired` is how many
 * of the open anomalies it produced — both counted off the real fixtures. So
 * the table answers "is this rule doing anything", which is the only question
 * anybody brings to a rules screen. The prototype's four rows have no such
 * relationship to its own alerts.
 */

/* ── Delivery channels ────────────────────────────────────────────────────
   The design shows five, all "connected", all with a Configure link. Five green
   dots is the §3.1 pattern: a state with nothing behind it.

   Two of these are NOT configured, which is the ordinary condition of a plant
   that has wired up email and Teams and not got round to the rest. It also
   makes Configure mean something, and it creates the one genuinely useful thing
   this screen can tell you — see `misroutedTo`. */
export const NOTIFY_CHANNELS = [
  { id: 'email', state: 'connected', target: 'ops@meridian-industrial.example' },
  { id: 'teams', state: 'connected', target: 'Meridian Ops › findlay-alerts' },
  { id: 'sms', state: 'connected', target: '+1 419 ••• 0142' },
  { id: 'slack', state: 'notConfigured', target: null },
  { id: 'pagerduty', state: 'notConfigured', target: null },
]

export const CHANNEL_IDS = NOTIFY_CHANNELS.map((channel) => channel.id)

/**
 * The rules.
 *
 * Authored: which kind is watched, which EDGE of its band trips, how severe
 * that is, where it goes, and whether it is on. Everything else is composed.
 *
 * `edge` is not decoration. A flow rule fires when flow drops BELOW the lower
 * edge — a compressor with no coolant is the whole of `ALR-4470` — and a
 * vibration rule fires when it climbs above the upper one. The prototype writes
 * `FLOW < 2 L/min` and `VIB > 40 mm/s` as free text, which reads correctly and
 * means nothing to the machine.
 */
export const ALERT_RULES = [
  { id: 'RUL-1201', kind: 'vibration', edge: 'above', severity: 'critical', routes: ['teams', 'pagerduty'], enabled: true },
  { id: 'RUL-1202', kind: 'flow', edge: 'below', severity: 'critical', routes: ['teams', 'sms'], enabled: true },
  { id: 'RUL-1203', kind: 'temperature', edge: 'above', severity: 'high', routes: ['email', 'teams'], enabled: true },
  { id: 'RUL-1204', kind: 'pressure', edge: 'above', severity: 'high', routes: ['teams'], enabled: true },
  { id: 'RUL-1205', kind: 'conductivity', edge: 'above', severity: 'medium', routes: ['email'], enabled: true },
  { id: 'RUL-1206', kind: 'acoustic', edge: 'above', severity: 'medium', routes: ['slack'], enabled: false },
  { id: 'RUL-1207', kind: 'current', edge: 'above', severity: 'low', routes: ['email'], enabled: false },
]

/* Rules written through the New Rule dialog. Module scope, so they survive the
   session — the same arrangement as created charts and logbook entries. */
const CREATED = []

/* Enable/disable overrides, keyed by rule id. The toggle is the one thing about
   a rule this screen can change without a form, and it is the thing an operator
   actually reaches for at three in the morning. */
const TOGGLES = new Map()

/* Field edits, keyed by rule id. A rule's KIND is not editable: one that changed
   what it watches is a different rule and its id would be lying. */
const EDITS = new Map()

/* Removed ids. The authored array is not spliced — a reload must bring the
   plant's own rules back, and only what this session did is state. */
const REMOVED = new Set()

export const allRules = () =>
  [...CREATED, ...ALERT_RULES]
    .filter((rule) => !REMOVED.has(rule.id))
    .map((rule) => ({
      ...rule,
      ...(EDITS.get(rule.id) ?? {}),
      ...(TOGGLES.has(rule.id) ? { enabled: TOGGLES.get(rule.id) } : {}),
    }))

/**
 * The escalation ladder.
 *
 * Authored as MINUTES and a ROLE; the person is looked up. The design writes
 * "Shift lead + Teams" and "Plant manager + PagerDuty" as strings, so the ladder
 * names nobody the product knows and cannot be wrong about them either.
 *
 * Level one is zero minutes — immediate — rather than a separate concept, so
 * the four rows are one comparable sequence.
 */
export const ESCALATION = [
  { id: 'esc_1', afterMinutes: 0, personId: 'usr_ops_1', routes: ['teams'] },
  { id: 'esc_2', afterMinutes: 15, personId: 'usr_ops_2', routes: ['teams', 'sms'] },
  { id: 'esc_3', afterMinutes: 30, personId: 'usr_mgr_1', routes: ['teams', 'pagerduty'] },
  { id: 'esc_4', afterMinutes: 60, personId: 'usr_exe_1', routes: ['email'] },
]

/** Which unit systems the plant actually uses, read off the site nodes. */
const unitSystems = () => [
  ...new Set(
    HIERARCHY_NODES.filter((node) => node.tier === 'site').map(
      (node) => node.unitSystem ?? 'imperial',
    ),
  ),
]

/**
 * The thresholds a rule trips at, one per unit system in use.
 *
 * Never converted between them. `alerts.js` states the reason at length: 0.49
 * in/s and 12.5 mm/s describe one physical limit, and showing either in the
 * other's unit without its canonical value is a safety defect. A rule that
 * spans both sites reports both numbers.
 */
export function thresholdsFor(rule) {
  return unitSystems()
    .map((unitSystem) => {
      const spec = SIGNAL_SPEC[unitSystem]?.[rule.kind]
      if (!spec) return null
      const [low, high] = spec.band
      return {
        unitSystem,
        value: rule.edge === 'below' ? low : high,
        unit: spec.unit,
        name: spec.name,
      }
    })
    .filter(Boolean)
}

/**
 * Where a rule would send something it cannot.
 *
 * The one thing a rules screen can tell you that you could not work out by
 * reading it: this rule is on, it will fire, and one of its destinations is not
 * wired up. Composed from the two lists rather than flagged by hand, so it
 * cannot be stale — configure Slack and RUL-1206 stops complaining.
 */
export function misroutedTo(rule) {
  return rule.routes.filter(
    (id) => NOTIFY_CHANNELS.find((channel) => channel.id === id)?.state !== 'connected',
  )
}

/**
 * One rule, resolved.
 *
 * `watching` counts live channels of that kind and `fired` counts the open
 * anomalies it produced — the second read through `kindOfAlert`, which is the
 * same mapping the Sensor Explorer uses to decide which channel an alert
 * belongs to. So a rule and the anomaly list cannot disagree about which rule
 * raised what.
 */
export function composeRule(rule, now = Date.now()) {
  const watching = SIGNAL_CHANNELS.filter((channel) => channel.kind === rule.kind)
  const fired = ALERTS.filter((alert) => kindOfAlert(alert) === rule.kind)
  const latest = fired.reduce(
    (held, alert) => (!held || alert.detectedMinutesAgo < held.detectedMinutesAgo ? alert : held),
    null,
  )
  const misrouted = misroutedTo(rule)

  return {
    id: rule.id,
    kind: rule.kind,
    edge: rule.edge,
    severity: rule.severity,
    enabled: rule.enabled,
    created: Boolean(rule.created),
    routes: rule.routes,
    misrouted,
    /* On and undeliverable. An off rule with a dead route is a tidying job, not
       a problem — nothing is being lost. */
    broken: rule.enabled && misrouted.length > 0,
    thresholds: thresholdsFor(rule),
    watching: watching.length,
    /* How many machines, not only how many tags. Eighteen channels across six
       machines is a different rule from eighteen on one. */
    assets: new Set(watching.map((channel) => channel.assetId)).size,
    fired: fired.length,
    lastFiredAt: latest ? new Date(now - latest.detectedMinutesAgo * 60_000).toISOString() : null,
    lastAlertId: latest?.id ?? null,
  }
}

/** The channels, with what each one is carrying. */
export function composeChannels() {
  const rules = allRules()
  return NOTIFY_CHANNELS.map((channel) => ({
    ...channel,
    /* Rules pointing here, and how many of those are live. A channel nobody
       routes to is a different thing from one carrying four critical rules,
       and Configure is worth more on the second. */
    rules: rules.filter((rule) => rule.routes.includes(channel.id)).length,
    liveRules: rules.filter((rule) => rule.enabled && rule.routes.includes(channel.id)).length,
  }))
}

/** The ladder, with real people on it. */
export function composeEscalation() {
  return ESCALATION.map((level, index) => {
    const person = TASK_PEOPLE.find((entry) => entry.id === level.personId) ?? null
    return {
      id: level.id,
      step: index + 1,
      afterMinutes: level.afterMinutes,
      routes: level.routes,
      personId: person?.id ?? null,
      personName: person?.name ?? null,
      personRole: person?.role ?? null,
      personInitials: person?.initials ?? null,
      misrouted: level.routes.filter(
        (id) => NOTIFY_CHANNELS.find((channel) => channel.id === id)?.state !== 'connected',
      ),
    }
  })
}

/**
 * The rollup.
 *
 * `unrouted` is the figure worth putting a number on: open anomalies that no
 * ENABLED rule covers. It is composed by asking, of every open alert, whether
 * any live rule watches its kind — so turning RUL-1206 off makes the number go
 * up, which is the whole point of showing it beside a table of toggles.
 */
export function notificationStats() {
  const rules = allRules()
  const live = rules.filter((rule) => rule.enabled)
  const open = ALERTS.filter((alert) => alert.status !== 'resolved')

  return {
    rules: rules.length,
    enabled: live.length,
    broken: rules.filter((rule) => rule.enabled && misroutedTo(rule).length > 0).length,
    channelsConnected: NOTIFY_CHANNELS.filter((channel) => channel.state === 'connected').length,
    channels: NOTIFY_CHANNELS.length,
    unrouted: open.filter(
      (alert) => !live.some((rule) => rule.kind === kindOfAlert(alert)),
    ).length,
  }
}

/**
 * Turn a rule on or off.
 *
 * The only mutation the table itself offers. Returns the composed row so the
 * client re-renders the counts that moved with it rather than guessing.
 */
export function setRuleEnabled(id, enabled) {
  const rule = allRules().find((entry) => entry.id === id)
  if (!rule) return { error: 'notFound' }
  TOGGLES.set(id, Boolean(enabled))
  return { rule: composeRule({ ...rule, enabled: Boolean(enabled) }) }
}

/**
 * Write a rule.
 *
 * The kind is a select over the kinds the plant actually instruments — a rule on
 * a sensor nothing reports is a rule that can never fire, which is the same
 * class of mistake as the prototype's free-text asset field on a work order.
 */
export function addRule({ kind, edge, severity, routes }) {
  if (!ruleKinds().some((entry) => entry.kind === kind)) return { error: 'unknownKind' }
  if (!['above', 'below'].includes(edge)) return { error: 'unknownEdge' }
  if (!SEVERITIES.includes(severity)) return { error: 'unknownSeverity' }
  const picked = (routes ?? []).filter((id) => CHANNEL_IDS.includes(id))
  if (!picked.length) return { error: 'noRoute' }

  const rule = {
    id: `RUL-${1300 + CREATED.length}`,
    kind,
    edge,
    severity,
    routes: picked,
    enabled: true,
    created: true,
  }
  CREATED.unshift(rule)
  return { rule: composeRule(rule) }
}

/**
 * Every sensor kind the plant actually has channels for.
 *
 * Counted off `SIGNAL_CHANNELS`, so the New Rule dialog cannot offer a kind
 * nothing reports — and the count beside each one says what a rule on it would
 * be watching before it is written.
 */
export function ruleKinds() {
  const seen = new Map()
  for (const channel of SIGNAL_CHANNELS) {
    const held = seen.get(channel.kind)
    if (held) held.channels += 1
    else seen.set(channel.kind, { kind: channel.kind, name: channel.name, channels: 1 })
  }
  return [...seen.values()]
    .map((entry) => ({
      ...entry,
      /* Both edges, per unit system. The New Rule dialog SHOWS the threshold a
         rule would use rather than asking for it, which is the whole argument
         of this module — so it needs the band before the rule exists. */
      bands: unitSystems()
        .map((unitSystem) => {
          const spec = SIGNAL_SPEC[unitSystem]?.[entry.kind]
          if (!spec) return null
          return { unitSystem, low: spec.band[0], high: spec.band[1], unit: spec.unit }
        })
        .filter(Boolean),
    }))
    .sort((a, b) => b.channels - a.channels)
}

/* ── Per-user delivery preferences ────────────────────────────────────────
   The one card the design's Settings → Notifications page has that this
   product's screen did not: what the signed-in person wants sent to them,
   as opposed to how the org routes an alert.

   Two different subjects on one page, and the page says which is which. A
   digest is a personal setting; a rule is an org one, and somebody reading a
   toggle needs to know whether turning it off affects them or everybody.

   `browserPush` is off and cannot be turned on: nothing here has asked for
   notification permission and a toggle that reported "on" while the browser had
   never been asked would be the only claim on this screen that was false. */
const PREFERENCES = [
  { id: 'dailyDigest', on: true, at: '08:00' },
  { id: 'weeklySummary', on: true, at: null },
  { id: 'soundInApp', on: false, at: null },
  { id: 'browserPush', on: false, at: null, unavailable: true },
]

const PREFERENCE_STATE = new Map()

export const composePreferences = () =>
  PREFERENCES.map((preference) => ({
    ...preference,
    unavailable: Boolean(preference.unavailable),
    on: preference.unavailable ? false : (PREFERENCE_STATE.get(preference.id) ?? preference.on),
  }))

export function setPreference(id, on) {
  const preference = PREFERENCES.find((entry) => entry.id === id)
  if (!preference || preference.unavailable) return null
  PREFERENCE_STATE.set(id, Boolean(on))
  return composePreferences().find((entry) => entry.id === id)
}

/* ── The writes the design's row actions and cards need ───────────────────
   Pause is `setRuleEnabled` above. These are the rest: edit a rule, delete one,
   configure a channel, send a test to it, and add a rung to the ladder. All
   module state, all reversible by reloading. */

export function updateRule(id, { edge, severity, routes }) {
  const rule = [...CREATED, ...ALERT_RULES].find((entry) => entry.id === id)
  if (!rule) return null
  const clean = {
    ...(edge === 'above' || edge === 'below' ? { edge } : {}),
    ...(['critical', 'high', 'medium', 'low'].includes(severity) ? { severity } : {}),
    ...(Array.isArray(routes) && routes.length
      ? { routes: routes.filter((route) => CHANNEL_IDS.includes(route)) }
      : {}),
  }
  if (!Object.keys(clean).length) return null
  EDITS.set(id, { ...(EDITS.get(id) ?? {}), ...clean })
  return composeRule(allRules().find((entry) => entry.id === id))
}

export function removeRule(id) {
  if (!allRules().some((rule) => rule.id === id)) return null
  REMOVED.add(id)
  const created = CREATED.findIndex((rule) => rule.id === id)
  if (created >= 0) CREATED.splice(created, 1)
  audit('RULE_DELETED', { resource: `rule:${id}` })
  return { id, deleted: true }
}

/** Point a channel somewhere. Giving it a target is what connects it. */
export function configureChannel(id, target) {
  const channel = NOTIFY_CHANNELS.find((entry) => entry.id === id)
  if (!channel) return null
  const clean = typeof target === 'string' ? target.trim() : ''
  channel.target = clean || null
  /* Derived, not set beside it: a channel with somewhere to deliver is
     connected, and one without is not. The design lets a card say Connected
     with "Not configured" underneath it. */
  channel.state = clean ? 'connected' : 'notConfigured'
  audit(clean ? 'CHANNEL_CONFIGURED' : 'CHANNEL_DISCONNECTED', { resource: `channel:${id}` })
  return composeChannels().find((entry) => entry.id === id)
}

/** Send a test. Answers with what is true, like the connection test does. */
export function testChannel(id) {
  const channel = NOTIFY_CHANNELS.find((entry) => entry.id === id)
  if (!channel) return null
  return channel.state === 'connected'
    ? { id, ok: true, target: channel.target }
    : { id, ok: false, reason: 'notConfigured' }
}

/** Add a rung. It goes on the end, after the last one, because a ladder is
    ordered by time and inserting in the middle is an edit of two levels. */
export function addEscalationLevel({ personId, afterMinutes, routes }) {
  const person = TASK_PEOPLE.find((entry) => entry.id === personId)
  const minutes = Number(afterMinutes)
  const last = ESCALATION[ESCALATION.length - 1]
  if (!person || !Number.isFinite(minutes) || minutes <= (last?.afterMinutes ?? -1)) return null
  const clean = (routes ?? []).filter((route) => CHANNEL_IDS.includes(route))
  if (!clean.length) return null
  const level = { id: `esc_${ESCALATION.length + 1}`, afterMinutes: minutes, personId, routes: clean }
  ESCALATION.push(level)
  return composeEscalation().find((entry) => entry.id === level.id)
}

/**
 * Put the notification configuration back.
 *
 * Called by Reset all settings on the General page. The channels need a
 * snapshot rather than a clear, because `configureChannel` writes onto the
 * authored objects themselves — the target IS the record — so there is nothing
 * to drop, only something to restore. Everything else is session state and goes.
 */
const CHANNEL_SNAPSHOT = NOTIFY_CHANNELS.map((channel) => ({ ...channel }))
const ESCALATION_LENGTH = ESCALATION.length

export function resetNotifications() {
  CREATED.length = 0
  TOGGLES.clear()
  EDITS.clear()
  REMOVED.clear()
  PREFERENCE_STATE.clear()
  ESCALATION.length = ESCALATION_LENGTH
  NOTIFY_CHANNELS.forEach((channel, index) => Object.assign(channel, CHANNEL_SNAPSHOT[index]))
}
