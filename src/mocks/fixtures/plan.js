import { ALERTS } from './alerts'
import { COPILOT_THREAD } from './copilot'
import { ORG, currentSites } from './enterprise'
import { FUSION_DOCS, FUSION_MEDIA } from './fusionDocs'
import { ALL_FUSION_SOURCES, composeSource } from './fusion'
import { HIERARCHY_NODES } from './hierarchy'
import { SIGNAL_CHANNELS } from './signals'
import { WORK_ORDERS } from './operations'
import { allLogEntries } from './logbook'
import { allReports } from './reports'
import { audit } from './audit'
import { directory } from './directory'

/**
 * The plan, the modules it includes, and what has been used against it.
 *
 * SYNTHETIC. Gated on `VITE_DEMO_MODE`. See `DEMO-MODE.md` §8.22.
 *
 * ── There is one module map, and the navigation rail already reads it ─────
 * `/v1/org/entitlements` has gated the rail since long before this page
 * existed. So the cards here ARE that map — not a second, prettier list of
 * capability names beside it. Turning a module off on this screen removes it
 * from the rail on the next render, because there is nothing else for the rail
 * to consult.
 *
 * That costs the design's taxonomy. It shows ten capabilities — Predictive
 * Failure, Root Cause Analysis, Compliance & Safety IOW — which are features
 * inside modules rather than modules, and none of them is a thing this product
 * can switch. A toggle that governs nothing is the defect this whole effort
 * keeps finding, and it would be worse here than anywhere: the control's entire
 * meaning is that it governs something.
 *
 * ── The one module that is off is off because it is not built ─────────────
 * Not because of the plan. The design's two dark cards read "Upgrade required";
 * this one says what is actually true of it, and its toggle is disabled rather
 * than offering to switch on a screen that does not exist.
 *
 * ── Upgrading buys limits, not modules ────────────────────────────────────
 * Every module this product has is included in Professional, so a tier that
 * unlocked modules would have to invent something to withhold. What Enterprise
 * actually changes here is the ceilings — and the estate is already sitting on
 * one of them, three sites against a limit of three, which is a fact the banner
 * can state and a reader can check by counting the sites.
 *
 * ── Two meters are counted; three carry demo figures ──────────────────────
 * Sites and sensors are counted from the estate, and they move when it does.
 * API calls, assistant sessions and storage do not: no request is served, only
 * one thread is persisted, and the document registry weighs tens of megabytes
 * rather than the hundreds of gigabytes a real estate's media would — so all
 * three drew bars with nothing in them and now carry the design's own values.
 *
 * Each is a named constant in one block, each reaches the page with
 * `authored: true` beside it, and where a real count exists it travels too
 * (`counted`, `countedKb`) rather than being discarded. That is what makes them
 * removable in one edit when the counters land.
 */

/* ── Tiers ────────────────────────────────────────────────────────────────
   `null` is unlimited, and is a different statement from a large number: the
   bar for an unlimited meter has nothing to fill. */

export const PLANS = {
  starter: { sites: 1, sensors: 500, apiCalls: 50_000, storageGb: 50, copilotSessions: 100 },
  professional: { sites: 3, sensors: 5000, apiCalls: 200_000, storageGb: 500, copilotSessions: 2000 },
  enterprise: { sites: null, sensors: null, apiCalls: null, storageGb: null, copilotSessions: null },
}

export const PLAN_ORDER = ['starter', 'professional', 'enterprise']

/** The next tier up, or null at the top. What the banner's button offers. */
export const upgradeFrom = (plan) => PLAN_ORDER[PLAN_ORDER.indexOf(plan) + 1] ?? null

/* Authored, because a renewal date and a billing period are terms of a contract
   rather than anything this product can derive. They are the only two facts on
   this page that are asserted. */
const BILLING = { renewsOn: '2026-12-31', period: 'annual' }

/* ── Modules ──────────────────────────────────────────────────────────────
   Session state over the entitlement defaults, like every other demo write.
   Keyed by the same ids the navigation rail uses, because they are the same
   things. */

const DEFAULTS = {
  overview: true,
  anomalies: true,
  oee: true,
  assets: true,
  sensors: true,
  shifts: true,
  logbook: true,
  workOrders: true,
  dataFusion: true,
  copilot: true,
  executive: true,
  analytics: true,
  settings: true,
  /* Built, and in beta. This was `workbook: false` — the one prototype module
     the rebuild had decided not to build — until the canvas landed. It is real
     now, so it is on, keyed to the rail item that opens it, and the rail carries
     the Beta tag that says the interaction is not finished. */
  workboards: true,
}

const STATE = new Map()

const enabledOf = (id) => (STATE.has(id) ? STATE.get(id) : (DEFAULTS[id] ?? false))

/** The map the navigation rail reads. Unchanged in shape from what it always read. */
export const moduleMap = () =>
  Object.fromEntries(Object.keys(DEFAULTS).map((id) => [id, enabledOf(id)]))

/**
 * Modules this product will not switch, and why.
 *
 * `notBuilt` has no screen to reveal. `alwaysOn` is the two that cannot be
 * turned off without stranding the reader: Settings is where they would go to
 * turn it back on, and Overview is where `/app` lands. The design's Platform
 * Admin card says "Always included" and is right about it — this names the same
 * thing for the same reason, and disables the control rather than letting
 * somebody lock themselves out of the page they are standing on.
 */
export const LOCKED = { settings: 'alwaysOn', overview: 'alwaysOn' }

/**
 * What each module is currently doing, counted off the fixture that owns it.
 *
 * The design prints "12,847 tags monitored" and "389 assets registered" as
 * authored strings, so a card can claim a figure the module it describes would
 * disagree with. Every one of these is a length or a sum of something that
 * exists elsewhere in this directory, which is why a card cannot go stale: the
 * only way to change one is to change the thing it counts.
 *
 * `null` where there is nothing honest to count. The card prints an em dash.
 */
function metricFor(id, now) {
  switch (id) {
    case 'anomalies':
      return { key: 'openAnomalies', value: ALERTS.filter((a) => a.status !== 'resolved').length }
    case 'oee':
      return { key: 'lines', value: HIERARCHY_NODES.filter((n) => n.tier === 'line').length }
    case 'assets':
      return { key: 'assets', value: HIERARCHY_NODES.filter((n) => n.tier === 'asset').length }
    case 'sensors':
      return { key: 'channels', value: SIGNAL_CHANNELS.length }
    case 'shifts':
      return { key: 'sites', value: currentSites().length }
    case 'logbook':
      return { key: 'entries', value: allLogEntries().length }
    case 'workOrders':
      return {
        key: 'openWorkOrders',
        value: WORK_ORDERS.filter((order) => order.state !== 'completed').length,
      }
    case 'dataFusion':
      return {
        key: 'connectedSources',
        value: ALL_FUSION_SOURCES()
          .map((source) => composeSource(source, now))
          .filter((source) => source.status === 'connected' || source.status === 'syncing').length,
      }
    case 'copilot':
      /* The threads that exist, which is one. Deliberately not the billing
         meter's demo figure: a card that says what the module is doing right now
         and a meter that reports a period's allowance are different questions,
         and giving both the same number would answer neither. */
      return { key: 'threads', value: COPILOT_THREAD ? 1 : 0 }
    case 'executive':
      return { key: 'sites', value: currentSites().length }
    case 'analytics':
      return { key: 'reports', value: allReports().length }
    case 'settings':
      return { key: 'accounts', value: directory(now).length }
    default:
      return null
  }
}

/** One card. */
function composeModule(id, now) {
  return {
    id,
    enabled: enabledOf(id),
    locked: LOCKED[id] ?? null,
    /* Every module this product has is in every tier — see the header. The
       badge says "included" rather than naming a tier it was never withheld
       from. */
    included: !LOCKED[id] || LOCKED[id] === 'alwaysOn',
    metric: metricFor(id, now),
  }
}

export const allModules = (now = Date.now()) =>
  Object.keys(DEFAULTS).map((id) => composeModule(id, now))

/**
 * Switch one on or off.
 *
 * Refuses the locked three and says which reason applies, so the page can print
 * it rather than the switch silently springing back.
 */
export function setModuleEnabled(id, enabled, now = Date.now()) {
  if (!Object.hasOwn(DEFAULTS, id)) return null
  if (LOCKED[id]) return { id, ok: false, reason: LOCKED[id] }

  STATE.set(id, Boolean(enabled))
  audit(
    'MODULE_CHANGED',
    { resource: `module:${id}`, detail: { enabled: enabled ? 'on' : 'off' } },
    now,
  )
  return { id, ok: true, enabled: Boolean(enabled) }
}

/* ── Usage ────────────────────────────────────────────────────────────────
   `used: null` means nothing measured it, which the bar draws as no reading
   rather than as empty. Empty would be a claim. */

const totalKb = (rows) => rows.reduce((sum, row) => sum + (row.sizeKb ?? 0), 0)

/* ── The three demo figures ───────────────────────────────────────────────
   Named, grouped and constant, so the asserted numbers on this page are
   findable in one place and removable in one edit. Each is the design's own
   value, and each travels to the page with `authored: true` beside it.

   They are here because nothing in this build produces the quantity: no request
   is served, no assistant session is persisted beyond the one thread, and the
   document registry weighs tens of megabytes rather than the hundreds of
   gigabytes a real estate's media would. Delete each the day its counter
   exists. */
const DEMO_API_CALLS = 124_521
const DEMO_COPILOT_SESSIONS = 1_240
const DEMO_STORAGE_KB = 234 * 1024 * 1024

/* No timestamp on the payload. It used to carry one, and it made two reads a
   millisecond apart unequal — which broke the property that matters here: this
   object is served to two pages and they must be able to prove they got the
   same one. */
export function usage() {
  const plan = PLANS[ORG.plan] ?? PLANS.professional
  const sites = currentSites()

  return {
    sites: { used: sites.length, limit: plan.sites, unit: 'count' },
    sensors: {
      /* The estate's own declared sensor count, summed. Not a second figure
         beside the per-site ones the Sites page prints. */
      used: sites.reduce((sum, site) => sum + (site.sensors ?? 0), 0),
      limit: plan.sensors,
      unit: 'count',
    },
    apiCalls: { used: DEMO_API_CALLS, limit: plan.apiCalls, unit: 'count', authored: true },
    copilotSessions: {
      /* One thread exists, which is the counted answer and reads as an empty
         bar. The demo figure stands in for a billing period's worth. */
      used: DEMO_COPILOT_SESSIONS,
      limit: plan.copilotSessions,
      unit: 'count',
      authored: true,
      counted: COPILOT_THREAD ? 1 : 0,
    },
    storage: {
      usedKb: DEMO_STORAGE_KB,
      limitKb: plan.storageGb == null ? null : plan.storageGb * 1024 * 1024,
      unit: 'bytes',
      authored: true,
      /* What the registries actually hold: tens of megabytes, which is what
         thirty-odd documents weigh and which drew a bar with nothing in it.
         Kept beside the demo figure rather than thrown away — it is the number
         this meter goes back to when there is real storage behind it. */
      countedKb: totalKb(FUSION_DOCS) + totalKb(FUSION_MEDIA),
    },
  }
}

/** The banner. */
export function planSummary(now = Date.now()) {
  const modules = allModules(now)
  return {
    tier: ORG.plan,
    upgradeTo: upgradeFrom(ORG.plan),
    renewsOn: BILLING.renewsOn,
    period: BILLING.period,
    activeModules: modules.filter((module) => module.enabled).length,
    totalModules: modules.length,
    usage: usage(),
  }
}

/** Everything the page reads, in one request. */
export const planPayload = (now = Date.now()) => ({
  plan: planSummary(now),
  modules: allModules(now),
})

export function resetPlan() {
  STATE.clear()
}
