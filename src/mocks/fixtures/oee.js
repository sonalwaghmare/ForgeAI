/**
 * OEE & Production Performance.
 *
 * SYNTHETIC. Every figure here is authored, the same as everything else in this
 * directory, and none of it is measured. The screen exists in the Claude Design
 * prototype and has no endpoint behind it yet, so it is served from here and
 * gated on `VITE_DEMO_MODE`.
 *
 * ── One number, one source ────────────────────────────────────────────────
 * The day period's OEE is NOT written here. It is read from `TOPLINE.oee` by the
 * mock handler, because the top bar and the home KPI strip already show that
 * figure and a plant that reports 74.2% in the header and something else on the
 * OEE screen is a demo that loses the room. Same reasoning as the shift KPI
 * strip deriving its anomaly count from the alert fixture.
 *
 * ── The arithmetic closes, which the prototype's does not ─────────────────
 * The prototype shows OEE 74.2% beside Availability 88 / Performance 92 /
 * Quality 99 — which multiply to 80.2%, not 74.2% — and a waterfall of
 * −12 / −8 / −1 that lands on 79, not 74.2 either. Two sets of numbers that
 * contradict each other on a screen whose entire subject is that multiplication.
 *
 * So the factors here are chosen to satisfy OEE = A × P × Q, and the waterfall
 * is DERIVED from them in the handler rather than authored beside them, as the
 * standard cascading loss model:
 *
 *     100                         planned production time
 *      × A  →  85.0   (−15.0)     availability loss — unplanned downtime
 *      × P  →  74.97 (−10.03)     performance loss  — speed loss
 *      × Q  →  74.22  (−0.75)     quality loss      — scrap and rework
 *
 * The shape, the five rows, the labels and the colours are the prototype's
 * exactly. Only the values move, and they move so they add up.
 */

/* ── Series generation ────────────────────────────────────────────────────
   Deterministic, unlike the prototype's `Math.random()`. A chart that redraws
   under the reader on every render is a chart nobody trusts, and it means two
   people looking at the same demo compare different lines. */
function series(count, base, amplitude, { freq = 3, seed = 1, drift = 0 } = {}) {
  const out = []
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1)
    const jitter = Math.sin((i + 1) * seed * 12.9898) * amplitude * 0.35
    const value = base + amplitude * Math.sin(t * Math.PI * freq) + jitter + drift * t
    out.push(Math.round(value * 10) / 10)
  }
  return out
}

/**
 * The windows the header chips switch between, in the prototype's order.
 *
 * `quarter` and `year` were added when the module was rebuilt against the
 * design's full period bar. Every one of them satisfies OEE = A × P × Q to the
 * printed tenth, the same as the original three — that property is what the
 * whole screen rests on and it is checked by hand for each new row here, not
 * assumed.
 */
export const OEE_PERIODS = ['day', 'week', 'month', 'quarter', 'year']

/**
 * Per-period factors and the trend behind them.
 *
 * `oee` is absent from `day` on purpose — the handler fills it from `TOPLINE`.
 * The other two periods have no other surface showing them, so they are stated.
 *
 * `deltaPts` is a movement in OEE points against the previous comparable window
 * (yesterday, last week, last month), never a percentage of a percentage.
 */
export const OEE_PERIOD_DATA = {
  day: {
    points: 40,
    availability: { value: 85.0, deltaPts: 0.5 },
    performance: { value: 88.2, deltaPts: -1.1 },
    quality: { value: 99.0, deltaPts: 0.2 },
  },
  week: {
    points: 28,
    oee: { value: 75.2, deltaPts: 0.8 },
    availability: { value: 86.4, deltaPts: 0.9 },
    performance: { value: 88.0, deltaPts: -0.4 },
    quality: { value: 98.9, deltaPts: 0.1 },
  },
  month: {
    points: 30,
    oee: { value: 72.7, deltaPts: -0.6 },
    availability: { value: 84.1, deltaPts: -0.7 },
    performance: { value: 87.6, deltaPts: 0.2 },
    quality: { value: 98.7, deltaPts: -0.1 },
  },
  quarter: {
    points: 26,
    oee: { value: 73.9, deltaPts: -1.3 },
    availability: { value: 84.8, deltaPts: -0.4 },
    performance: { value: 88.1, deltaPts: 0.3 },
    quality: { value: 98.9, deltaPts: 0.1 },
  },
  year: {
    points: 24,
    oee: { value: 75.6, deltaPts: 1.1 },
    availability: { value: 86.1, deltaPts: 0.8 },
    performance: { value: 88.9, deltaPts: 0.4 },
    quality: { value: 98.8, deltaPts: -0.2 },
  },
}

/**
 * The four traces, one per factor.
 *
 * Each is generated around its own period figure so the line ends near the
 * number printed above it. Separate seeds keep them from moving in lockstep,
 * which is what a single seed with four offsets looks like and is the tell that
 * a chart is decoration.
 */
export function trendFor(period, oeeValue) {
  const spec = OEE_PERIOD_DATA[period]
  const n = spec.points
  return [
    { key: 'oee', tone: 'forge', values: series(n, oeeValue, 3.2, { freq: 3, seed: 1 }) },
    { key: 'availability', tone: 'ack', values: series(n, spec.availability.value, 4.1, { freq: 2, seed: 3 }) },
    { key: 'performance', tone: 'green', values: series(n, spec.performance.value, 2.6, { freq: 4, seed: 7 }) },
    { key: 'quality', tone: 'violet', values: series(n, spec.quality.value, 0.6, { freq: 2, seed: 11 }) },
  ]
}

/**
 * The band the OEE line is read against — the prototype's 70–85.
 *
 * It is a target corridor, not a control limit: below 70 the shift is losing
 * money, above 85 is world class for this plant. Named here rather than in the
 * chart because it is a property of the site's targets, and the day a real
 * endpoint serves them this is the field it fills.
 */
export const OEE_BAND = [70, 85]

/** The plant-wide target every line is measured against. */
export const OEE_TARGET = 85

/**
 * The AI loss attribution, one paragraph per period.
 *
 * Content, not furniture: Forge AI wrote it, an endpoint will serve it, and it
 * changes with the window. It names the line, the asset, the alert that warned
 * first and the work order that closes it — the prototype's exact four moves.
 */
export const OEE_ATTRIBUTION = {
  day: 'Compressed Air lost 2.3 hours to three unplanned stops on Compressor C-12, which is 6.1 of the 15.0 availability points the plant gave up today. Coolant flow at the discharge switch has been drifting for six days and ALR-4470 opened on it before the first stop. WO-7731 is released but unscheduled; taking it on the night stop recovers an estimated 1.8 OEE points tomorrow.',
  week: 'Availability carried the week: 41 unplanned stops across four lines, 22 of them on Compressed Air. Ends Line 1 is the structural loss rather than the dramatic one — changeover time on Shell Press 4 averaged 38 minutes against a 22-minute standard, which is 4.4 OEE points a week with no fault behind it.',
  month: 'The month is flat because two effects cancelled. Performance recovered 0.2 points after the Decorator 2 speed trial, and availability gave back 0.7 on compressor stops that were already trending in week two. Ends Line 1 changeovers are the single largest addressable loss in the period at an estimated 17 OEE points cumulative.',
  quarter: 'The quarter closed 1.3 points below the one before it, and the whole of the movement is availability. Compressor C-12 accounts for 22 of the 41 unplanned stops on the site and has been the constraint in each of the three months. Changeover on Shell Press 4 is the second, and it is the one with no fault behind it: 38 minutes against a 22-minute standard, every changeover, all quarter.',
  year: 'The year is 1.1 points ahead of the last, recovered almost entirely in the second half after the Decorator 2 speed trial and the Line 2 vibration-walkdown cadence went standing. Quality gave back 0.2 points over the same period — scrap on Ends Line 1 rose with the shell-press changeover rate rather than with any process drift.',
}
