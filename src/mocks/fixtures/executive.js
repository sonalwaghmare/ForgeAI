import { ALERTS } from './alerts'
import { HIERARCHY_NODES } from './hierarchy'
import { OEE_PERIOD_DATA } from './oee'
import { SITE_HEALTH, allWorkOrders, isOpenOrder } from './operations'
import { currentSites } from './enterprise'

/**
 * Executive Dashboard — the multi-site rollup.
 *
 * SYNTHETIC, like everything in this directory. Gated on `VITE_DEMO_MODE`.
 *
 * ── The target is one number, stated once ─────────────────────────────────
 * 85%, and the bars, the gap column and the brief all read it from here. The
 * prototype prints "Target: 85% (dashed)" as a caption under bars drawn against
 * no target at all.
 *
 * ── Counts are counted ────────────────────────────────────────────────────
 * `SITE_HEALTH` authors an OEE and a health score per site, which nothing else
 * in the product computes and which therefore stay authored. Its alert counts
 * do NOT stay authored: those are read off `ALERTS`, so this screen and the
 * anomaly list cannot report a different number of open anomalies for one
 * plant. Same call as every other rollup in this codebase.
 *
 * ── The brief is measured, including the bad news ─────────────────────────
 * Which site is top risk is found rather than asserted — the prototype names
 * Rotterdam whatever its own numbers say. So is which site leads, and by how
 * much, and how far the enterprise average sits from target.
 *
 * ── Downtime exposure is in HOURS ─────────────────────────────────────────
 * The design's brief ends "Enterprise downtime cost $1.2M MTD". Nothing in this
 * product computes money, and a currency figure needs an hourly rate that would
 * be invented here and then quoted in a boardroom as though it were measured.
 * The hours ARE computed — `downtimeRiskHours` is on every alert — so the brief
 * reports those and stops.
 */

/** The enterprise OEE target. One number, read by everything on the screen. */
export const OEE_TARGET = 85

const round = (value, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/**
 * One row per site: where it is, how it is doing, and what is open on it.
 *
 * `coords` come from the hierarchy node — real coordinates for real towns, so
 * the map projects a pin into Ohio rather than to a layout percentage.
 */
export function siteRollups() {
  return currentSites().map((site) => {
    const node = HIERARCHY_NODES.find((entry) => entry.id === site.id)
    const authored = SITE_HEALTH.find((entry) => entry.siteId === site.id) ?? {}

    const alerts = ALERTS.filter(
      (alert) => alert.siteId === site.id && alert.status !== 'resolved',
    )

    /* This site's machines, and the work orders raised against them. Walked
       through the lines rather than matched on an id prefix — a plant that is
       re-parented keeps its assets. */
    const lineIds = HIERARCHY_NODES.filter(
      (entry) => entry.tier === 'line' && entry.parentId === site.id,
    ).map((entry) => entry.id)
    const assetIds = HIERARCHY_NODES.filter(
      (entry) => entry.tier === 'asset' && lineIds.includes(entry.parentId),
    ).map((entry) => entry.id)
    const orders = allWorkOrders().filter((order) => assetIds.includes(order.assetId))

    const oee = authored.oee ?? null
    const critical = alerts.filter((alert) => alert.severity === 'critical').length

    return {
      id: site.id,
      name: site.name,
      city: node?.city ?? null,
      country: node?.country ?? null,
      countryName: node?.countryName ?? null,
      coords: node?.coords ?? null,
      unitSystem: node?.unitSystem ?? 'imperial',
      lines: site.lines,
      assets: site.assets,
      sensors: site.sensors,
      oee,
      /* Distance from target, signed. Derived here so the bar, the column and
         the brief cannot disagree about it. */
      gapPts: oee == null ? null : round(oee - OEE_TARGET),
      health: authored.health ?? null,
      /* Counted, not authored. */
      openAlerts: alerts.length,
      criticalAlerts: critical,
      openWorkOrders: orders.filter(isOpenOrder).length,
      downtimeRiskHours: round(
        alerts.reduce((sum, alert) => sum + (alert.downtimeRiskHours ?? 0), 0),
      ),
      /* The state the pin takes. Severity first: a site carrying a critical
         anomaly is not "watch" because its OEE happens to be respectable. */
      state: critical > 0 ? 'critical' : alerts.length > 0 ? 'watch' : 'running',
    }
  })
}

/**
 * The enterprise rollup.
 *
 * Averaged over the sites that report an OEE, and NOT taken from
 * `OEE_PERIOD_DATA` — that figure is Findlay's line performance and this one is
 * three plants. Two different questions; conflating them is how a board screen
 * comes to contradict the operations screen it links to.
 */
export function enterpriseStats(sites) {
  const reporting = sites.filter((site) => site.oee != null)
  const oee = reporting.length
    ? round(reporting.reduce((sum, site) => sum + site.oee, 0) / reporting.length)
    : null

  return {
    sites: sites.length,
    lines: sites.reduce((sum, site) => sum + site.lines, 0),
    assets: sites.reduce((sum, site) => sum + site.assets, 0),
    oee,
    target: OEE_TARGET,
    gapPts: oee == null ? null : round(oee - OEE_TARGET),
    openAlerts: sites.reduce((sum, site) => sum + site.openAlerts, 0),
    criticalAlerts: sites.reduce((sum, site) => sum + site.criticalAlerts, 0),
    openWorkOrders: sites.reduce((sum, site) => sum + site.openWorkOrders, 0),
    downtimeRiskHours: round(
      sites.reduce((sum, site) => sum + site.downtimeRiskHours, 0),
    ),
    /* The month's published figure, kept beside the enterprise average rather
       than instead of it — the two answer different questions and the screen
       says which is which. */
    plantOee: OEE_PERIOD_DATA.month.oee.value,
  }
}

/**
 * The AI Executive Brief.
 *
 * Every clause is found. The prototype's three bullets name Rotterdam, Detroit
 * and a dollar figure, none of which is checked against its own numbers.
 */
export function executiveBrief(sites, stats) {
  const ranked = [...sites]
    .filter((site) => site.oee != null)
    .sort((a, b) => a.oee - b.oee)

  const worst = ranked[0] ?? null
  const best = ranked[ranked.length - 1] ?? null

  /* Top risk is not simply the lowest OEE. A plant running at 79% with three
     critical anomalies open is the one to look at before a plant at 72% with
     none — which is the judgement a board brief exists to make, and the
     prototype's does not make it. */
  const risk = [...sites].sort(
    (a, b) =>
      b.criticalAlerts - a.criticalAlerts ||
      b.downtimeRiskHours - a.downtimeRiskHours ||
      (a.oee ?? 100) - (b.oee ?? 100),
  )[0]

  return {
    /* Named so the page can compose the sentence through `t()` — the figures
       are data, the wording is furniture. Handing down a finished paragraph is
       how an i18n key leaked into the handover report. */
    risk: risk
      ? {
          siteId: risk.id,
          name: risk.name,
          oee: risk.oee,
          criticalAlerts: risk.criticalAlerts,
          openAlerts: risk.openAlerts,
          downtimeRiskHours: risk.downtimeRiskHours,
        }
      : null,
    best: best ? { siteId: best.id, name: best.name, oee: best.oee } : null,
    worst: worst ? { siteId: worst.id, name: worst.name, oee: worst.oee } : null,
    /* How far the enterprise is from the one target on the screen, and how many
       sites are actually clearing it. */
    belowTarget: sites.filter((site) => site.oee != null && site.oee < OEE_TARGET).length,
    gapPts: stats.gapPts,
    downtimeRiskHours: stats.downtimeRiskHours,
    openAlerts: stats.openAlerts,
    criticalAlerts: stats.criticalAlerts,
  }
}
