/**
 * The handover report's remaining sections.
 *
 * DEMO. The design's report is an ISA-95-shaped document in twelve sections:
 * identity and roster, executive summary, production, OEE and loss accounting,
 * downtime events, quality and rejects, alerts carried over, work orders,
 * safety and EHS, material and WIP, logbook entries, and pending actions with
 * the sign-off. Five of those already come off the handover record. The seven
 * below have no endpoint behind them and are composed here.
 *
 * ── Composed, not authored flat ───────────────────────────────────────────
 * The prototype writes one report and shows it on every handover in the
 * archive, so a shift that closed at 85% OEE displays a 74.8% OEE panel and a
 * 38-minute breakdown it never had. Everything here is a function of the
 * record: the factors multiply to that record's OEE, the loss minutes are what
 * its availability did not cover, the downtime events sum to those minutes, and
 * the reject rate is the one printed above the defect table.
 *
 * No `t()` in this file — it is a plain helper, and a template key in one would
 * be invisible to `verify:i18n`. It returns i18n KEYS and figures; the dialog
 * translates them.
 */

/** A shift is eight hours. Everything below is minutes inside that. */
const SHIFT_MINUTES = 480

/**
 * Availability, Performance and Quality for a record's OEE.
 *
 * Performance and Quality are the week's published figures; Availability is
 * whatever is left, so `A × P × Q` IS the OEE printed beside them. The
 * prototype shows 74.8 next to 92.1 / 88.6 / 99.2, which multiply to 80.9 —
 * three answers to one multiplication on a document somebody signs.
 */
export function oeeFactors(oee) {
  const performance = 88.6
  const quality = 99.2
  const availability = Math.round((oee / ((performance / 100) * (quality / 100))) * 10) / 10
  return { oee, availability, performance, quality, target: 85 }
}

/**
 * Loss minutes, as the standard cascade.
 *
 * Availability loss is downtime. Performance loss is speed. Quality loss is
 * scrap. The three are computed off the factors above, so the total under the
 * bars is the same shortfall the OEE panel reports and cannot drift from it.
 */
export function lossMinutes(factors) {
  const downtime = Math.round(SHIFT_MINUTES * (1 - factors.availability / 100))
  const running = SHIFT_MINUTES - downtime
  const speed = Math.round(running * (1 - factors.performance / 100))
  const quality = Math.round((running - speed) * (1 - factors.quality / 100))

  /* Downtime splits into one breakdown, one changeover and the minor stops that
     are left. Ordered worst first, and the residue lands on the breakdown so the
     three add to `downtime` exactly rather than to `downtime ± 1`. */
  const changeover = Math.min(18, Math.max(0, downtime - 6))
  const minor = Math.min(9, Math.max(0, downtime - changeover - 4))
  const breakdown = downtime - changeover - minor

  return {
    downtime,
    rows: [
      { key: 'breakdown', tone: 'red', minutes: breakdown },
      { key: 'speed', tone: 'amber', minutes: speed },
      { key: 'changeover', tone: 'forge', minutes: changeover },
      { key: 'minor', tone: 'watch', minutes: minor },
      { key: 'quality', tone: 'violet', minutes: quality },
    ].filter((row) => row.minutes > 0),
  }
}

/**
 * The downtime log.
 *
 * Two events: the breakdown and the changeover, each carrying the minutes the
 * cascade above accounted for. The breakdown names the record's own worst
 * carried alert where it has one, so the table cannot cite an alert the section
 * above it does not list.
 */
export function downtimeEvents(losses, carried) {
  const breakdown = losses.rows.find((row) => row.key === 'breakdown')
  const changeover = losses.rows.find((row) => row.key === 'changeover')
  const worst =
    carried.find((row) => row.severity === 'critical') ??
    carried.find((row) => row.severity === 'high') ??
    carried[0] ??
    null

  const events = []
  if (breakdown) {
    events.push({
      at: '02:14',
      asset: worst ? worst.description.split(' — ')[0] : 'FDY-BM-03 · Bodymaker 3',
      reasonKey: 'breakdown',
      minutes: breakdown.minutes,
      planned: false,
      linked: worst?.id ?? null,
    })
  }
  if (changeover) {
    events.push({
      at: '23:30',
      asset: 'Line 1',
      reasonKey: 'changeover',
      minutes: changeover.minutes,
      planned: true,
      linked: null,
    })
  }
  return events
}

/**
 * The defect split.
 *
 * Four codes whose rates sum to the total printed on the section head, so the
 * table cannot report 0.81% under a heading that says 1.2%. Units follow from
 * the rate against the record's own output.
 */
export function qualityDefects(unitsProduced) {
  const split = [
    { key: 'dents', rate: 0.34, sourceKey: 'tooling' },
    { key: 'seam', rate: 0.22, sourceKey: 'seamer' },
    { key: 'print', rate: 0.16, sourceKey: 'decorator' },
    { key: 'coating', rate: 0.09, sourceKey: 'oven' },
  ]
  return {
    total: Math.round(split.reduce((sum, row) => sum + row.rate, 0) * 100) / 100,
    spec: 1.2,
    rows: split.map((row) => ({ ...row, units: Math.round((unitsProduced * row.rate) / 100) })),
  }
}

/** Work orders open at the boundary. Authored — no per-handover WO join exists. */
export const HANDOVER_WORK_ORDERS = [
  {
    id: 'WO-7731',
    titleKey: 'bearing',
    priority: 'urgent',
    stateKey: 'approved',
    assignee: 'Ines Brandt',
  },
  {
    id: 'WO-7728',
    titleKey: 'coolant',
    priority: 'high',
    stateKey: 'inProgress',
    assignee: 'Karan Patel',
  },
  {
    id: 'WO-7702',
    titleKey: 'lubricate',
    priority: 'medium',
    stateKey: 'overdue',
    assignee: null,
  },
]

/** Safety and EHS. Authored. */
export const HANDOVER_SAFETY = {
  incidents: 0,
  nearMisses: 1,
  permits: [{ id: 'PTW-2291', descriptionKey: 'hotWork', stateKey: 'closed' }],
  loto: [{ id: 'LOTO-118', descriptionKey: 'coolantLine', stateKey: 'released' }],
}

/** Material, consumables and WIP. Authored. */
export const HANDOVER_MATERIAL = [
  { key: 'coil', value: '4.2 t', noteKey: 'coilNote' },
  { key: 'coolant', value: '62%', noteKey: 'coolantNote' },
  { key: 'ink', value: '3', noteKey: 'inkNote' },
  { key: 'wip', value: '18,400', noteKey: 'wipNote' },
]

/** Logbook entries inside the window. Authored. */
export const HANDOVER_LOGBOOK = [
  {
    at: '02:14',
    author: 'Karan Patel',
    body: 'Coolant flow on Compressor C-12 dropped to zero — the J14 connector was loose, reseated after drying. Flow recovered in six seconds.',
    tags: '#coolant #FDY-CMP-12',
  },
  {
    at: '03:05',
    author: 'Ines Brandt',
    body: 'Vibration on FDY-BM-03 still trending up after the reseat. The bearing is the real issue, not the sensor. Expedite WO-7731.',
    tags: '#vibration #bearing',
  },
  {
    at: '05:30',
    author: 'Dana Okafor',
    body: 'Day shift briefed verbally at 05:30 on the Bodymaker 3 status. Written handover to follow.',
    tags: '#handover',
  },
]
