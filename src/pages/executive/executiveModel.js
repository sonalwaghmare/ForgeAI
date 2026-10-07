import { formatDateTime, formatNumber } from '@/lib/format'

/**
 * Executive Dashboard — the financial overlay.
 *
 * DEMO. See `DEMO-MODE.md` §8.12.
 *
 * ── Why the money lives here and not in the fixture ───────────────────────
 * `/v1/executive/summary` deliberately carries no currency field: nothing in
 * this product computes money, and a cost that travels through the transport
 * looks measured by the time it reaches a boardroom. `verify:mocks` asserts the
 * payload stays money-free, and that assertion still holds.
 *
 * The design is nonetheless a financial screen, so the money is authored HERE,
 * in the component layer, where a demo notice sits beside it. Two authored
 * numbers do the work — a site's monthly revenue and the cost of an hour of
 * unplanned downtime — and every other figure on the screen is derived from
 * those, from the real rollup, or from both.
 *
 * ── One rate, not three totals ────────────────────────────────────────────
 * The prototype authors a downtime cost per site AND an enterprise total AND a
 * benefit stream, which do not reconcile. Here `downtimeRiskHours` is already
 * real and already per-site, so the cost is `hours × rate` at every level and
 * the three can only agree.
 *
 * ── The periods are real parameters ───────────────────────────────────────
 * The prototype's `EX_DATA` has exactly one key, `mtd`, and `const D =
 * EX_DATA.mtd` — so its MTD/QTD/YTD/R12M pills relabel the caption and change
 * nothing. Here the period is a month count that scales every flow figure and
 * shifts the comparison basis, so each pill produces a different, internally
 * consistent payload.
 */

/**
 * Site state → tone. The pin, the card's leading edge, the badge and the table
 * row all read this one map, so a plant cannot wear two colours on one screen.
 */
export const STATE_TONE = { critical: 'red', watch: 'amber', running: 'green' }

/** The window pills, in order. `months` is what makes each one a real payload. */
export const PERIODS = ['mtd', 'qtd', 'ytd', 'r12']
const PERIOD_MONTHS = { mtd: 1, qtd: 3, ytd: 8, r12: 12 }

/**
 * The cost of one hour of unplanned downtime, in USD.
 *
 * The single authored rate this screen turns on. The design states it in a
 * caption — "approximately $9.3k in lost contribution" — and then authors its
 * costs separately anyway; here the caption and the arithmetic are the same
 * number.
 */
export const DOWNTIME_RATE_PER_HOUR = 9_300

/**
 * The authored per-site commercial overlay, in USD per month.
 *
 * Keyed by the REAL site ids, so a site added to the hierarchy appears on this
 * screen with its operational figures and simply no commercial line, rather
 * than being silently dropped or inheriting another plant's revenue. Meridian's
 * three plants, not the prototype's Chennai / Rotterdam / Detroit — see
 * `DEMO-MODE.md` §3.
 */
const SITE_FINANCE = {
  site_findlay: { revenue: 9_800_000, plan: 10_600_000, marginPct: 24.1, growthPct: 7.6 },
  site_weissenthurm: { revenue: 5_200_000, plan: 5_400_000, marginPct: 21.2, growthPct: 4.1 },
  site_pune: { revenue: 3_400_000, plan: 3_600_000, marginPct: 18.6, growthPct: 9.4 },
}

/** Rates that belong to the estate rather than to a plant. Percentages. */
const ESTATE_RATES = {
  mtd: { otif: 94.2, otifPrev: 91.8, capacityUsed: 82, scrapPct: 0.81, scrapPrevPct: 0.94 },
  qtd: { otif: 93.4, otifPrev: 91.1, capacityUsed: 80, scrapPct: 0.88, scrapPrevPct: 1.03 },
  ytd: { otif: 92.6, otifPrev: 90.4, capacityUsed: 79, scrapPct: 0.96, scrapPrevPct: 1.18 },
  r12: { otif: 92.1, otifPrev: 89.7, capacityUsed: 78, scrapPct: 1.02, scrapPrevPct: 1.31 },
}

/** Units shipped per $1M of revenue. One ratio, so units and revenue agree. */
const UNITS_PER_MILLION = 674_000

/** Reliability, estate-wide. Authored pairs; every DELTA below is derived. */
const RELIABILITY = { mtbf: 312, mtbfPrev: 268, mttr: 3.4, mttrPrev: 4.1 }

/** Where the twelve-month traces get their shape. Rescaled to real endpoints. */
const OEE_SHAPE = [71.2, 72.4, 73.1, 72.8, 74.2, 74.9, 75.6, 76.4, 77.1, 77.8, 78.0, 78.4]
const REVENUE_SHAPE = [15.2, 15.8, 16.1, 15.9, 16.8, 17.1, 17.4, 17.9, 18.0, 18.2, 18.3, 18.4]
const BENEFIT_SHAPE = [0.31, 0.68, 1.12, 1.71, 2.34, 3.02, 3.81, 4.62, 5.48, 6.34, 7.38, 8.42]

/**
 * Short month names for the twelve-month axes, ending on the current month.
 *
 * Computed from the clock, in the reader's locale. The design hardcodes
 * `["Sep","Oct",…,"Aug"]`, which is right for one month in twelve and English
 * in all of them.
 */
export function trailingMonths(now = new Date()) {
  const out = []
  for (let back = 11; back >= 0; back -= 1) {
    const when = new Date(now.getFullYear(), now.getMonth() - back, 1)
    out.push(formatDateTime(when, { month: 'short' }))
  }
  return out
}

const round = (value, digits = 1) => {
  if (value == null || Number.isNaN(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Percentage change from `prev` to `value`, signed. */
const changePct = (value, prev) => (prev ? round(((value - prev) / prev) * 100) : null)

/**
 * Money, compact and in the reader's locale — "$18.4M", "2800万円".
 *
 * `Intl` supplies the suffix, so the abbreviation is translated rather than a
 * hardcoded "M" glued onto a number. The prototype's `money()` is
 * `"$"+v.toFixed(2)+"M"`, which is English, dollars and two decimals wherever
 * it renders.
 */
export function formatMoney(value, currency = 'USD') {
  if (value == null) return '—'
  return formatNumber(value, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: value >= 1_000_000 ? 2 : 1,
  })
}

/** A rescaled trace whose LAST point is the figure printed beside it. */
function traceEndingAt(shape, endValue) {
  if (endValue == null) return shape
  const factor = endValue / shape[shape.length - 1]
  return shape.map((point) => round(point * factor, 2))
}

/**
 * The whole screen's numbers, from the real rollup plus the overlay above.
 *
 * @param {object} args
 * @param {object[]} args.sites   `siteRollups()` — real ids, OEE, health, alerts.
 * @param {object} args.stats     `enterpriseStats()`.
 * @param {string} args.period    One of `PERIODS`.
 * @param {string} args.scopeId   A site id, or `'all'`.
 */
export function buildExecutiveModel({ sites, stats, period, scopeId }) {
  const months = PERIOD_MONTHS[period] ?? 1
  const rates = ESTATE_RATES[period] ?? ESTATE_RATES.mtd

  const inScope = scopeId === 'all' ? sites : sites.filter((site) => site.id === scopeId)

  /* Per-site commercial lines. A site with no overlay entry contributes
     nothing rather than inheriting a neighbour's revenue. */
  const rows = inScope.map((site) => {
    const finance = SITE_FINANCE[site.id] ?? null
    const revenue = finance ? finance.revenue * months : null
    const plan = finance ? finance.plan * months : null
    const downtimeCost = (site.downtimeRiskHours ?? 0) * DOWNTIME_RATE_PER_HOUR * months
    return {
      ...site,
      revenue,
      plan,
      revenuePrev: finance ? revenue / (1 + finance.growthPct / 100) : null,
      marginPct: finance?.marginPct ?? null,
      downtimeCost,
    }
  })

  const commercial = rows.filter((row) => row.revenue != null)
  const revenue = commercial.reduce((sum, row) => sum + row.revenue, 0)
  const revenuePrev = commercial.reduce((sum, row) => sum + row.revenuePrev, 0)
  const plan = commercial.reduce((sum, row) => sum + row.plan, 0)
  const downtimeCost = rows.reduce((sum, row) => sum + row.downtimeCost, 0)

  /* Weighted by revenue, not averaged — three plants of unequal size do not
     each contribute a third of the estate's margin. */
  const marginPct = revenue
    ? round(commercial.reduce((sum, row) => sum + row.revenue * row.marginPct, 0) / revenue)
    : null
  const marginPrevPct = marginPct == null ? null : round(marginPct - 1.4)

  const oee = scopeId === 'all' ? stats.oee : (inScope[0]?.oee ?? null)
  const oeePrev = oee == null ? null : round(oee - 3.5)

  const scrapCost = revenue * (rates.scrapPct / 100)
  const scrapPrevCost = revenuePrev * (rates.scrapPrevPct / 100)
  const energyCost = revenue * 0.051
  const energyPrevCost = revenuePrev * 0.0546
  const maintCost = revenue * 0.039
  const maintPrevCost = revenuePrev * 0.0432
  const downtimePrevCost = downtimeCost / (1 - 0.23)

  const units = (revenue / 1_000_000) * UNITS_PER_MILLION
  const unitsPlan = (plan / 1_000_000) * UNITS_PER_MILLION

  /* Every cost of poor performance, one list. The bars, the total and the
     improvement line below them all read this — the prototype authors the
     total separately and it does not match its own bars. */
  const leakage = [
    { key: 'downtime', value: downtimeCost, prev: downtimePrevCost },
    { key: 'energy', value: energyCost, prev: energyPrevCost },
    { key: 'maintenance', value: maintCost, prev: maintPrevCost },
    { key: 'scrap', value: scrapCost, prev: scrapPrevCost },
  ].map((entry) => ({ ...entry, changePct: changePct(entry.value, entry.prev) }))

  const leakageTotal = leakage.reduce((sum, entry) => sum + entry.value, 0)
  const leakagePrevTotal = leakage.reduce((sum, entry) => sum + entry.prev, 0)

  const downtimeHours = rows.reduce((sum, row) => sum + (row.downtimeRiskHours ?? 0), 0) * months

  return {
    months,
    rows,
    revenue,
    revenuePrev,
    revenueChangePct: changePct(revenue, revenuePrev),
    plan,
    /* Attainment is DERIVED. The prototype prints "93.9% attainment" beside
       $18.4M and $19.6M, which is 93.88% — right by luck, and unmaintainable. */
    attainmentPct: plan ? round((revenue / plan) * 100) : null,
    marginPct,
    marginPrevPct,
    marginDeltaPts: marginPct == null ? null : round(marginPct - marginPrevPct),
    oee,
    oeePrev,
    oeeDeltaPts: oee == null ? null : round(oee - oeePrev),
    target: stats.target,
    units,
    unitsPlan,
    unitsPrev: (revenuePrev / 1_000_000) * UNITS_PER_MILLION,
    otif: rates.otif,
    otifDeltaPts: round(rates.otif - rates.otifPrev),
    capacityUsed: rates.capacityUsed,
    downtimeCost,
    downtimeChangePct: changePct(downtimeCost, downtimePrevCost),
    downtimeHours,
    leakage,
    leakageTotal,
    leakagePrevTotal,
    leakageSaved: leakagePrevTotal - leakageTotal,
    costPerUnit: units ? (revenue * (1 - marginPct / 100)) / units : null,
    costPerUnitPrev: units
      ? (revenuePrev * (1 - marginPrevPct / 100)) / ((revenuePrev / 1_000_000) * UNITS_PER_MILLION)
      : null,
    reliability: {
      ...RELIABILITY,
      mtbfChangePct: changePct(RELIABILITY.mtbf, RELIABILITY.mtbfPrev),
      mttrChangePct: changePct(RELIABILITY.mttr, RELIABILITY.mttrPrev),
      unplannedHours: round(downtimeHours),
      unplannedPrevHours: round(downtimeHours / (1 - 0.43)),
    },
    oeeTrace: traceEndingAt(OEE_SHAPE, oee),
    revenueTrace: traceEndingAt(REVENUE_SHAPE, revenue / 1_000_000),
  }
}

/**
 * Forge AI's own value realisation.
 *
 * Six streams are authored; the benefit, the net, the ROI, the payback month
 * and the cumulative curve are all counted off them. The prototype authors
 * `benefit`, `netBenefit`, `roiPct` and `paybackMonths` as four independent
 * literals beside a `streams` array — they happen to reconcile, which is worse
 * than if they did not, because nothing keeps them reconciling.
 */
export const ROI_INVESTMENT = 1_850_000

/** Hours of unplanned downtime avoided. The one authored input to stream 1. */
const AVOIDED_DOWNTIME_HOURS = 412

export const ROI_STREAMS = [
  {
    key: 'downtime',
    value: AVOIDED_DOWNTIME_HOURS * DOWNTIME_RATE_PER_HOUR,
    confidence: 94,
    basis: { failures: 127, hours: AVOIDED_DOWNTIME_HOURS, rate: DOWNTIME_RATE_PER_HOUR },
  },
  { key: 'quality', value: 1_620_000, confidence: 91, basis: { from: 1.31, to: 0.81 } },
  { key: 'maintenance', value: 1_280_000, confidence: 88, basis: { from: 62, to: 28, hours: 1840 } },
  { key: 'throughput', value: 940_000, confidence: 86, basis: { points: 3.5, units: 812_000 } },
  { key: 'energy', value: 410_000, confidence: 79, basis: { percent: 6.2 } },
  { key: 'labour', value: 330_000, confidence: 83, basis: { hours: 2100 } },
]

/** Before / after pairs. The CHANGE column is derived from each pair. */
const BASELINE = [
  { key: 'oee', before: null, after: null, unit: 'points', invert: false },
  { key: 'unplanned', before: 96, after: 41, unit: 'hours', invert: true },
  { key: 'mtbf', before: 212, after: RELIABILITY.mtbf, unit: 'hours', invert: false },
  { key: 'mttr', before: 5.2, after: RELIABILITY.mttr, unit: 'hours', invert: true },
  { key: 'scrap', before: 1.31, after: 0.81, unit: 'percent', invert: true },
  { key: 'reactive', before: 62, after: 28, unit: 'percent', invert: true },
]

export function buildRoiModel({ model }) {
  const benefit = ROI_STREAMS.reduce((sum, stream) => sum + stream.value, 0)
  const netBenefit = benefit - ROI_INVESTMENT
  const roiPct = round((netBenefit / ROI_INVESTMENT) * 100, 0)

  /* The cumulative curve is the authored SHAPE scaled so its last point is the
     benefit just counted. It therefore cannot end anywhere but on the headline. */
  const last = BENEFIT_SHAPE[BENEFIT_SHAPE.length - 1]
  const cumulative = BENEFIT_SHAPE.map((point) => (point / last) * benefit)

  /* Payback is READ OFF that curve, interpolated inside the month it crosses —
     not authored as "5.1" beside a curve that crosses somewhere else. */
  let paybackMonths = null
  for (let i = 0; i < cumulative.length; i += 1) {
    if (cumulative[i] >= ROI_INVESTMENT) {
      const floor = i === 0 ? 0 : cumulative[i - 1]
      const within = (ROI_INVESTMENT - floor) / (cumulative[i] - floor)
      paybackMonths = round(i + within)
      break
    }
  }

  /* Confidence is the benefit-weighted mean of the streams, so a large stream
     nobody is sure of moves it. The prototype prints a fixed 91%. */
  const confidence = round(
    ROI_STREAMS.reduce((sum, s) => sum + s.value * s.confidence, 0) / benefit,
    0,
  )

  const baseline = BASELINE.map((row) => {
    const before = row.key === 'oee' ? model.oeePrev : row.before
    const after = row.key === 'oee' ? model.oee : row.after
    return {
      ...row,
      before,
      after,
      deltaPts: row.unit === 'points' || row.unit === 'percent' ? round(after - before) : null,
      changePct: changePct(after, before),
      improving: row.invert ? after < before : after > before,
    }
  })

  /* The brief names the largest stream. Found, not typed beside the list. */
  const topStream = [...ROI_STREAMS].sort((a, b) => b.value - a.value)[0]

  return {
    benefit,
    investment: ROI_INVESTMENT,
    netBenefit,
    roiPct,
    paybackMonths,
    confidence,
    cumulative,
    baseline,
    topStream,
    streams: ROI_STREAMS,
  }
}

/**
 * Value at risk and identified upside.
 *
 * Both lists are authored, but the SITE each entry names is found: the design
 * hardcodes Rotterdam as the problem plant regardless of what its own numbers
 * say, which is the correction `executiveBrief()` already makes on the server.
 * `site` is resolved by the caller and interpolated into the label.
 */
export const RISKS = [
  { key: 'siteBelowPlan', impact: 620_000, probability: 'high', horizonDays: 30, owner: 'siteDirector', to: '/app/oee' },
  { key: 'bearing', impact: 280_000, probability: 'critical', horizonHours: 4.5, owner: 'reliability', to: '/app/anomalies' },
  { key: 'singleSource', impact: 450_000, probability: 'medium', horizonDays: 90, owner: 'procurement', to: null },
  { key: 'overduePm', impact: 190_000, probability: 'medium', horizonDays: 14, owner: 'maintenance', to: '/app/work-orders' },
]

export const OPPORTUNITIES = [
  { key: 'changeover', gain: 1_420_000, effort: 'medium', paybackMonths: 4, confidence: 88 },
  { key: 'predictive', gain: 960_000, effort: 'high', paybackMonths: 7, confidence: 81 },
  { key: 'speedLoss', gain: 740_000, effort: 'low', paybackMonths: 2, confidence: 92 },
  { key: 'energy', gain: 380_000, effort: 'low', paybackMonths: 3, confidence: 85 },
]

/** Probability → the tone its badge and its row take. One map, both readers. */
export const PROBABILITY_TONE = { critical: 'red', high: 'amber', medium: 'watch' }
