/**
 * The OEE module's derived model.
 *
 * DEMO. See `DEMO-MODE.md` §8.2.
 *
 * ── Why this file exists at all ───────────────────────────────────────────
 * The design's OEE screen makes about ninety numeric claims across five tabs,
 * and in the prototype almost every one of them is typed in beside the others.
 * The result is a screen that contradicts itself in at least six places: a
 * headline of 74.2% over factors that multiply to 80.2%; a waterfall that lands
 * on 79; 41,250 units produced in 1,320 planned minutes beside a nameplate rate
 * of 2,200 cans a minute, which is fifty times the output it prints; 14 stops in
 * a 22-hour day beside an MTBF of 83 hours; six big losses whose minutes bear no
 * relation to the availability figure above them; a defect pie totalling 100 PPM
 * on a quality figure of 96.4%, which is 36,000 PPM.
 *
 * So nothing here is typed twice. **Four numbers are authored — the three
 * factors and the OEE they multiply to — and they arrive from the API through
 * `useOeeSummary`.** Everything else on the five tabs is computed off them here,
 * by the ordinary ISO 22400 / TPM definitions, so the screen cannot be caught
 * out by anyone in the room who adds a column up.
 *
 * What IS authored below is structure, not measurement: how many stops a window
 * had, how the downtime splits between root causes, how the defects split
 * between modes, which crew works which shift. Each of those is a mix, and each
 * one is then *scaled onto* a computed total rather than stated as a quantity.
 * Change availability in the fixture and the Pareto's minutes move with it.
 *
 * Every panel built on this ends with the demo notice, same as
 * `anomalies.analysis.demoNotice`.
 *
 * ── No `t()` in here ──────────────────────────────────────────────────────
 * This module returns keys and numbers. The screens translate. A helper that
 * both computes and translates is a helper that has to be handed a `t` to be
 * tested, and — per DEMO-MODE §2.3 — a plain `.js` file with no
 * `useTranslation()` in it silently defaults to the wrong namespace.
 */

/* ══ Authored structure ════════════════════════════════════════════════ */

/**
 * Planned production minutes per window — 22 hours a day, seven days, which is
 * what a can plant with two four-hour maintenance windows a week actually runs.
 *
 * The quarter is 90 days and the year 360, so a reader dividing the year by four
 * gets the quarter. The prototype's year is 240 days and its quarter 90, which
 * do not.
 */
const PLANNED_MIN = { day: 1320, week: 9240, month: 39600, quarter: 118800, year: 475200 }

/** Minutes in the calendar window, for TEEP. Utilisation is planned ÷ calendar. */
const CALENDAR_MIN = { day: 1440, week: 10080, month: 43200, quarter: 129600, year: 518400 }

/**
 * Nameplate line rate, cans per minute, across the site's running lines.
 *
 * One constant, and it is the only thing standing between the factors and the
 * unit counts: total produced is `rate × run time × performance`, which is the
 * definition of performance rather than a second opinion about it.
 */
const NAMEPLATE_RATE = 2200

/**
 * Stop events per window.
 *
 * Authored, because a count of events is not derivable from a percentage — but
 * MTTR and MTBF then follow from it and from the computed downtime, rather than
 * being three independent claims. At 85% availability a 22-hour day loses 3.3
 * hours, so seven stops means a mean stop near half an hour, which is what the
 * numbers say. The prototype's 14 stops beside an 83-hour MTBF cannot both be
 * true of the same day.
 */
const STOPS = { day: 7, week: 41, month: 176, quarter: 512, year: 2040 }

/**
 * The Six Big Losses, as a split WITHIN each of the three loss buckets.
 *
 * TPM's six are three pairs: two availability losses, two performance losses,
 * two quality losses. Each pair is scaled onto the minutes its bucket actually
 * lost, so the six always sum to exactly the gap between planned time and
 * effective time — which is the same gap the waterfall draws.
 */
const SIX_LOSSES = [
  { key: 'unplannedStops', bucket: 'availability', tone: 'red', share: 0.69 },
  { key: 'setup', bucket: 'availability', tone: 'amber', share: 0.31 },
  { key: 'minorStops', bucket: 'performance', tone: 'amber', share: 0.62 },
  { key: 'reducedSpeed', bucket: 'performance', tone: 'watch', share: 0.38 },
  { key: 'processDefects', bucket: 'quality', tone: 'ack', share: 0.7 },
  { key: 'startupRejects', bucket: 'quality', tone: 'violet', share: 0.3 },
]

/**
 * Downtime root causes, as a share of the availability loss.
 *
 * Meridian's machines, with their real tags, and every one of them is a fault
 * some other screen already knows about: `ALR-4471` is the Bodymaker 3 drive-end
 * bearing, `ALR-4470` is the Compressor C-12 coolant flow that stops the Washer,
 * and `WO-7731` is released against the compressor. The prototype's Pareto names
 * a heat exchanger and a seamer that exist on no line in this universe.
 */
const DOWNTIME_CAUSES = [
  { key: 'bearingTrip', asset: 'FDY-BM-03', tone: 'red', share: 0.31 },
  { key: 'coolantFlow', asset: 'FDY-CMP-12', tone: 'red', share: 0.22 },
  { key: 'changeover', asset: 'WTM-PRS-04', tone: 'amber', share: 0.16 },
  { key: 'jamClears', asset: 'FDY-PAL-02', tone: 'amber', share: 0.11 },
  { key: 'inkRegistration', asset: 'FDY-DEC-02', tone: 'watch', share: 0.09 },
  { key: 'ovenTrip', asset: 'FDY-OVN-01', tone: 'watch', share: 0.07 },
  { key: 'falseTrip', asset: null, tone: null, share: 0.04 },
]

/** Defect modes, as a share of the units quality actually rejected. */
const DEFECT_MODES = [
  { key: 'domeDistortion', tone: 'red', share: 0.34 },
  { key: 'seamThickness', tone: 'amber', share: 0.26 },
  { key: 'printRegistration', tone: 'watch', share: 0.18 },
  { key: 'neckOutOfSpec', tone: 'ack', share: 0.12 },
  { key: 'other', tone: null, share: 0.1 },
]

/**
 * The three shifts, as an offset in OEE points from the window's figure.
 *
 * The offsets sum to zero, so the three shifts average to the plant number
 * rather than to something else — the correction the Shifts module already
 * makes, and for the same reason. Availability and quality are offset too and
 * performance is then SOLVED for, so each shift's own three factors multiply to
 * its own OEE. The prototype states all four per shift and none of them agree.
 *
 * Crews are Meridian's people (§4). Names are data and are not translated.
 */
const SHIFTS = [
  { key: 'morning', offset: 7.0, aOffset: 5.0, qOffset: 0.3, crew: 'Dana Okafor · Karan Patel' },
  { key: 'afternoon', offset: -0.4, aOffset: 0.0, qOffset: 0.0, crew: 'Maya Reddy' },
  { key: 'night', offset: -6.6, aOffset: -5.0, qOffset: -0.3, crew: 'Ines Brandt · Arjun Mehta' },
]

/**
 * Where each line loses, as exponents on the shortfall.
 *
 * A line's factors are the plant's, moved by the line's own ratio to the plant
 * OEE and split across the three by these weights. Because the weights sum to
 * 1, `A × P × Q` for the line lands on the line's own OEE before rounding — an
 * identity, not a coincidence. So a line can be shown its own availability
 * without a second table of authored factors that will drift from the first.
 */
const LINE_LOSS_MIX = {
  line_fdy_1: { a: 0.55, p: 0.35, q: 0.1 },
  line_fdy_2: { a: 0.3, p: 0.6, q: 0.1 },
  line_fdy_util: { a: 0.85, p: 0.12, q: 0.03 },
  line_wtm_1: { a: 0.6, p: 0.35, q: 0.05 },
  line_pnq_1: { a: 0.45, p: 0.45, q: 0.1 },
}
const DEFAULT_LOSS_MIX = { a: 0.5, p: 0.35, q: 0.15 }

/** Per-line movement against the prior window, in OEE points. */
const LINE_DELTA = {
  line_fdy_1: 1.5,
  line_fdy_2: -0.9,
  line_fdy_util: -4.2,
  line_wtm_1: 0.6,
  line_pnq_1: 1.1,
}

/**
 * World-class benchmarks, per the Nakajima/TPM convention the design cites.
 *
 * Stated as the convention states them. The screen prints the plant's distance
 * from each rather than a bar with no scale on it.
 */
export const BENCHMARKS = [
  { key: 'oee', target: 85 },
  { key: 'availability', target: 90 },
  { key: 'performance', target: 95 },
  { key: 'quality', target: 99.9 },
  { key: 'teep', target: 75 },
]

/**
 * Tone by distance from target — the ladder this module reads every percentage
 * against, in one place.
 *
 * Not `toneForHealth`: that ladder is ≥80 green / 50–79 amber, which is a
 * machine-condition scale. An OEE of 80% is a good plant and an OEE of 74% is a
 * normal one; scoring them on a health ramp would paint the whole screen amber
 * and say nothing.
 */
export function toneForOee(value, target = 85) {
  if (value == null) return null
  if (value >= target) return 'green'
  if (value >= target - 10) return 'amber'
  return 'red'
}

/** The three OEE bands the filter bar offers, as a predicate on a percentage. */
export const OEE_BANDS = {
  world: (value) => value >= 85,
  target: (value) => value >= 75 && value < 85,
  risk: (value) => value < 75,
}

/* ══ Arithmetic that has to close ══════════════════════════════════════ */

const round1 = (value) => Math.round(value * 10) / 10

/**
 * Distribute a total across weighted parts so the parts sum to the total
 * EXACTLY, with the rounding residue landing on the largest part.
 *
 * The residue has to go somewhere, and the largest part is where a unit of it is
 * invisible. Pushing it onto the smallest would move a 4% share by a noticeable
 * fraction of itself to tidy up a rounding error belonging to a different row —
 * the same call the mock handler already makes for the waterfall.
 */
function apportion(total, shares) {
  const parts = shares.map((share) => Math.round(total * share))
  const largest = shares.indexOf(Math.max(...shares))
  parts[largest] += total - parts.reduce((sum, part) => sum + part, 0)
  return parts
}

/** The four figures the API returns, as a plain object. */
function factorsFrom(kpis) {
  const read = (key) => kpis.find((kpi) => kpi.key === key) ?? { value: 0, deltaPts: 0 }
  return {
    oee: read('oee'),
    availability: read('availability'),
    performance: read('performance'),
    quality: read('quality'),
  }
}

/**
 * Everything the five tabs draw, from the four figures the API returns.
 *
 * @param {object} args
 * @param {object|null} args.summary  `useOeeSummary` payload.
 * @param {Array} args.lines          `useOeeLines` items.
 * @param {string} args.period
 * @param {Date} args.now             Injected, never read off the clock in here,
 *   so the heatmap's seven days are testable and the axis cannot be right on
 *   only one day of the week.
 */
export function buildOeeModel({ summary, lines = [], period, now = new Date() }) {
  if (!summary) return null

  const factor = factorsFrom(summary.kpis ?? [])
  const oee = factor.oee.value
  const a = factor.availability.value
  const p = factor.performance.value
  const q = factor.quality.value
  const target = summary.target ?? 85

  /* ── Time accounting ──────────────────────────────────────────────── */
  const plannedMin = PLANNED_MIN[period] ?? PLANNED_MIN.day
  const calendarMin = CALENDAR_MIN[period] ?? CALENDAR_MIN.day
  const runMin = Math.round(plannedMin * (a / 100))
  const downMin = plannedMin - runMin

  /* Performance and quality losses expressed as the minutes of GOOD OUTPUT they
     cost, which is what makes the six losses commensurable with downtime. This
     is the standard cascade: each stage takes its cut of what the one before it
     left, so the three sum to `plannedMin − plannedMin × OEE`. */
  const perfLossMin = Math.round(runMin * (1 - p / 100))
  const qualLossMin = Math.round(runMin * (p / 100) * (1 - q / 100))
  const lossMin = { availability: downMin, performance: perfLossMin, quality: qualLossMin }
  const totalLossMin = downMin + perfLossMin + qualLossMin

  /* ── Output ───────────────────────────────────────────────────────── */
  const totalUnits = Math.round(NAMEPLATE_RATE * runMin * (p / 100))
  const goodUnits = Math.round(totalUnits * (q / 100))
  const defectUnits = totalUnits - goodUnits
  const scrapUnits = Math.round(defectUnits * 0.72)
  const reworkUnits = defectUnits - scrapUnits
  const defectPpm = totalUnits ? Math.round((defectUnits / totalUnits) * 1_000_000) : 0

  /* ── Reliability ──────────────────────────────────────────────────── */
  const stops = STOPS[period] ?? STOPS.day
  const mttrMin = stops ? downMin / stops : null
  const mtbfHours = stops ? runMin / stops / 60 : null

  /* TEEP is OEE derated by how much of the calendar the plant is scheduled for.
     Derived rather than authored, so it cannot say the plant runs more hours
     than it planned. */
  const teep = round1(oee * (plannedMin / calendarMin))

  const prior = {
    oee: round1(oee - (factor.oee.deltaPts ?? 0)),
    availability: round1(a - (factor.availability.deltaPts ?? 0)),
    performance: round1(p - (factor.performance.deltaPts ?? 0)),
    quality: round1(q - (factor.quality.deltaPts ?? 0)),
  }
  prior.teep = round1(prior.oee * (plannedMin / calendarMin))

  const gapPts = round1(target - oee)
  /* What the gap is worth, in cans. Not "units × gap" — that treats OEE points
     as units, which they are not. Good output at target divided by good output
     now, less what was actually made. */
  const forgoneUnits = oee > 0 ? Math.max(0, Math.round(goodUnits * (target / oee - 1))) : 0

  /* ── Six Big Losses ───────────────────────────────────────────────── */
  const byBucket = { availability: [], performance: [], quality: [] }
  SIX_LOSSES.forEach((loss) => byBucket[loss.bucket].push(loss))
  const sixLosses = []
  Object.entries(byBucket).forEach(([bucket, group]) => {
    const minutes = apportion(
      lossMin[bucket],
      group.map((entry) => entry.share),
    )
    group.forEach((entry, index) =>
      sixLosses.push({
        ...entry,
        minutes: minutes[index],
        pctOfLoss: totalLossMin ? (minutes[index] / totalLossMin) * 100 : 0,
      }),
    )
  })
  sixLosses.sort((left, right) => right.minutes - left.minutes)

  /* ── Downtime Pareto ──────────────────────────────────────────────── */
  const causeMinutes = apportion(
    downMin,
    DOWNTIME_CAUSES.map((cause) => cause.share),
  )
  let cumulative = 0
  const pareto = DOWNTIME_CAUSES.map((cause, index) => {
    cumulative += causeMinutes[index]
    return {
      ...cause,
      minutes: causeMinutes[index],
      cumulativePct: downMin ? (cumulative / downMin) * 100 : 0,
    }
  })
  const vitalFewPct = downMin
    ? (pareto.slice(0, 3).reduce((sum, row) => sum + row.minutes, 0) / downMin) * 100
    : 0

  /* ── Defect mix ───────────────────────────────────────────────────── */
  const defectCounts = apportion(
    defectUnits,
    DEFECT_MODES.map((mode) => mode.share),
  )
  const defects = DEFECT_MODES.map((mode, index) => ({
    ...mode,
    units: defectCounts[index],
    pct: defectUnits ? (defectCounts[index] / defectUnits) * 100 : 0,
  }))

  /* ── Shifts ───────────────────────────────────────────────────────── */
  const shiftStopWeights = SHIFTS.map((shift) => Math.max(0.01, 100 - (a + shift.aOffset)))
  const shiftStops = apportion(stops, normalise(shiftStopWeights))
  const shifts = SHIFTS.map((shift, index) => {
    const shiftOee = round1(oee + shift.offset)
    const shiftA = clamp(round1(a + shift.aOffset), 1, 100)
    const shiftQ = clamp(round1(q + shift.qOffset), 1, 100)
    // Solved, not stated: A × P × Q must be this shift's own OEE.
    const shiftP = clamp(round1((shiftOee / (shiftA * shiftQ)) * 10_000), 1, 100)
    return {
      key: shift.key,
      crew: shift.crew,
      oee: shiftOee,
      availability: shiftA,
      performance: shiftP,
      quality: shiftQ,
      priorOee: round1(shiftOee - (factor.oee.deltaPts ?? 0)),
      stops: shiftStops[index],
    }
  })

  /* ── Lines ────────────────────────────────────────────────────────── */
  const running = lines.filter((line) => line.oee != null)
  const lineUnits = running.length
    ? apportion(
        goodUnits,
        normalise(running.map((line) => line.oee)),
      )
    : []
  const lineStops = running.length
    ? apportion(
        stops,
        normalise(running.map((line) => Math.max(0.01, 100 - line.oee))),
      )
    : []

  const lineRows = lines.map((line) => {
    if (line.oee == null) {
      return { ...line, availability: null, performance: null, quality: null, units: null, stops: null, deltaPts: null }
    }
    const index = running.indexOf(line)
    const mix = LINE_LOSS_MIX[line.id] ?? DEFAULT_LOSS_MIX
    const ratio = oee > 0 ? line.oee / oee : 1
    return {
      ...line,
      availability: clamp(round1(a * ratio ** mix.a), 1, 100),
      performance: clamp(round1(p * ratio ** mix.p), 1, 100),
      quality: clamp(round1(q * ratio ** mix.q), 1, 100),
      units: lineUnits[index] ?? null,
      stops: lineStops[index] ?? null,
      deltaPts: LINE_DELTA[line.id] ?? 0,
    }
  })

  const ranked = [...lineRows]
    .filter((line) => line.oee != null)
    .sort((left, right) => right.oee - left.oee)
  const bestLine = ranked[0] ?? null
  const worstLine = ranked[ranked.length - 1] ?? null
  const worstShift = [...shifts].sort((left, right) => left.oee - right.oee)[0]
  const bestShift = [...shifts].sort((left, right) => right.oee - left.oee)[0]

  return {
    period,
    target,
    band: summary.band ?? null,
    attribution: summary.attribution ?? null,
    waterfall: summary.waterfall ?? [],
    trend: summary.trend ?? [],
    factors: { oee, availability: a, performance: p, quality: q, teep },
    deltas: {
      oee: factor.oee.deltaPts ?? 0,
      availability: factor.availability.deltaPts ?? 0,
      performance: factor.performance.deltaPts ?? 0,
      quality: factor.quality.deltaPts ?? 0,
      teep: round1(teep - prior.teep),
    },
    prior,
    gapPts,
    forgoneUnits,
    improving: (factor.oee.deltaPts ?? 0) >= 0,
    time: { plannedMin, runMin, downMin, setupMin: sixLosses.find((l) => l.key === 'setup')?.minutes ?? 0 },
    output: { totalUnits, goodUnits, defectUnits, scrapUnits, reworkUnits, defectPpm },
    rate: {
      nameplate: NAMEPLATE_RATE,
      actual: Math.round(NAMEPLATE_RATE * (p / 100)),
      loss: NAMEPLATE_RATE - Math.round(NAMEPLATE_RATE * (p / 100)),
      attainment: p,
    },
    reliability: { stops, mttrMin, mtbfHours },
    lossMin,
    totalLossMin,
    sixLosses,
    pareto,
    vitalFewPct,
    defects,
    shifts,
    lines: lineRows,
    bestLine,
    worstLine,
    bestShift,
    worstShift,
    heatmap: buildHeatmap({ oee, now }),
    diagnosis: buildDiagnosis({ gapPts, worstLine, worstShift, bestShift, pareto, sixLosses, reliability: { stops, mttrMin, mtbfHours } }),
    wins: buildWins({ bestLine, quality: q, priorQuality: prior.quality, output: { totalUnits, scrapUnits } }),
    actions: buildActions(gapPts),
  }
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value))

/** Weights → shares summing to 1. */
function normalise(weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  return total ? weights.map((weight) => weight / total) : weights.map(() => 0)
}

/* ══ The heatmap ═══════════════════════════════════════════════════════ */

/**
 * Hour × day OEE over the seven COMPLETE days ending yesterday.
 *
 * Three things the prototype gets wrong and this does not. Its days are the
 * hardcoded strings Mon–Sun, which is the right axis one week in seven; here
 * they come from the date, so the row labels are the days that actually ran. Its
 * cells are `Math.random()`, so the map redraws under the reader and two people
 * looking at the same demo see different plants. And its mean is whatever it
 * happens to be, floating free of the headline the same card sits under — here
 * the grid is rescaled so its mean IS the window's OEE, which is the only thing
 * that makes "where did the points go" a question the map can answer.
 *
 * Today is excluded because a part-run day drawn beside seven whole ones reads
 * as a collapse rather than as an afternoon.
 */
function buildHeatmap({ oee, now }) {
  const shape = []
  for (let day = 0; day < 7; day += 1) {
    const row = []
    for (let hour = 0; hour < 24; hour += 1) {
      /* Shape, not noise: a night-shift trough, a mid-morning peak, and a
         deterministic wobble so no two cells are identical. Seeded off the
         coordinates, so the same square is the same value on every render. */
      const diurnal = Math.sin(((hour - 4) / 24) * Math.PI * 2) * 5.5
      const night = hour >= 22 || hour < 6 ? -6.5 : 0
      const weekday = Math.sin((day / 7) * Math.PI * 2) * 2.2
      const wobble = Math.sin((day * 24 + hour + 1) * 12.9898) * 3.4
      row.push(diurnal + night + weekday + wobble)
    }
    shape.push(row)
  }

  const flat = shape.flat()
  const mean = flat.reduce((sum, value) => sum + value, 0) / flat.length
  const end = new Date(now)
  end.setHours(0, 0, 0, 0)

  return shape.map((row, day) => {
    const date = new Date(end)
    date.setDate(date.getDate() - (7 - day))
    return {
      /* A calendar day, not an instant. Serialising local midnight through
         `toISOString()` moves it into the previous day west of Greenwich and
         the axis then reads a day early — the same UTC trap DEMO-MODE §2.7
         records for the logbook. The key is the local Y-M-D and the component
         builds a local Date back out of it. */
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      cells: row.map((value, hour) => ({
        hour,
        // Rescaled about the grid mean, so the whole map averages to `oee`.
        value: round1(clamp(oee + (value - mean), 5, 99)),
      })),
    }
  })
}

/* ══ The AI synopsis ═══════════════════════════════════════════════════ */

/**
 * The three diagnosis cards, and the points they claim.
 *
 * Their points are SHARES OF THE GAP and sum to it exactly. The prototype writes
 * −3.4, −2.1 and −1.6 under a gap of 8.2 and leaves 1.1 points unaccounted for
 * with no note saying so — a diagnosis that does not add up to the thing it is
 * diagnosing invites exactly one question, and has no answer to it.
 */
function buildDiagnosis({ gapPts, worstLine, worstShift, bestShift, pareto, sixLosses, reliability }) {
  const shares = [0.46, 0.29, 0.25]
  const points = apportion(Math.round(gapPts * 10), shares).map((tenths) => tenths / 10)
  const setup = sixLosses.find((loss) => loss.key === 'setup')

  return [
    {
      key: 'unplannedStops',
      tone: 'red',
      pts: points[0],
      lineName: worstLine?.name ?? null,
      cause: pareto[0],
      stops: reliability.stops,
      mttrMin: reliability.mttrMin,
      mtbfHours: reliability.mtbfHours,
      evidence: ['alr4471', 'paretoRank1', 'availability'],
      fix: 'bearing',
    },
    {
      key: 'nightShift',
      tone: 'amber',
      pts: points[1],
      shiftKey: worstShift.key,
      deltaPts: round1(bestShift.oee - worstShift.oee),
      minutes: sixLosses.find((loss) => loss.key === 'minorStops')?.minutes ?? 0,
      evidence: ['shiftCompare', 'heatmapNight', 'minorStops'],
      fix: 'sop',
    },
    {
      key: 'changeover',
      tone: 'watch',
      pts: points[2],
      minutes: setup?.minutes ?? 0,
      standardMin: Math.round((setup?.minutes ?? 0) * 0.62),
      evidence: ['setupLoss', 'paretoRank3'],
      fix: 'smed',
    },
  ]
}

/** The two things that are genuinely improving, with the figures behind them. */
function buildWins({ bestLine, quality, priorQuality, output }) {
  return [
    {
      key: 'bestLine',
      lineName: bestLine?.name ?? null,
      oee: bestLine?.oee ?? null,
      availability: bestLine?.availability ?? null,
      stops: bestLine?.stops ?? null,
      deltaPts: bestLine?.deltaPts ?? 0,
    },
    {
      key: 'quality',
      quality,
      deltaPts: round1(quality - priorQuality),
      scrapPct: output.totalUnits ? (output.scrapUnits / output.totalUnits) * 100 : 0,
    },
  ]
}

/**
 * The prioritised action plan.
 *
 * Same rule as the diagnosis: the five gains are shares of the gap and sum to
 * it, so the card's "potential" figure IS the shortfall rather than a number
 * chosen to look encouraging. Each one goes to the module where the work
 * actually happens — none of these is a dead button.
 */
function buildActions(gapPts) {
  const spec = [
    { key: 'bearing', tone: 'red', to: '/app/work-orders', owner: 'Karan Patel', share: 0.38 },
    { key: 'sop', tone: 'amber', to: '/app/shifts', owner: 'Maya Reddy', share: 0.26 },
    { key: 'smed', tone: 'watch', to: '/app/assets', owner: 'Ines Brandt', share: 0.19 },
    { key: 'walkdown', tone: 'watch', to: '/app/sensors', owner: 'Karan Patel', share: 0.1 },
    { key: 'alarmFloor', tone: null, to: '/app/anomalies', owner: 'Dana Okafor', share: 0.07 },
  ]
  const gains = apportion(
    Math.round(gapPts * 10),
    spec.map((entry) => entry.share),
  ).map((tenths) => tenths / 10)
  return spec.map((entry, index) => ({ ...entry, gainPts: gains[index] }))
}
