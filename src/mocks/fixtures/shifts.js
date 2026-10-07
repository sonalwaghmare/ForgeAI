import { ALERTS } from './alerts'
import { OEE_PERIOD_DATA } from './oee'
import { SHIFTS, allWorkOrders } from './operations'
import { HANDOVER_REPORT, datedHandovers, TASK_PEOPLE } from './home'

/**
 * Shifts — the week's roster, derived.
 *
 * SYNTHETIC, like everything in this directory. Gated on `VITE_DEMO_MODE`.
 *
 * ── Almost nothing here is authored ───────────────────────────────────────
 * A shift is a DATE and a WINDOW. Everything the screen prints about one is
 * computed: who was on it comes from the rota, whether it has finished comes
 * from the clock, its anomalies are the alerts whose detection time falls inside
 * it, its work orders are the orders raised off those alerts, and its OEE is
 * drawn from the same figures the OEE module reports — then rescaled so the
 * week's mean IS the week's published OEE.
 *
 * The prototype computes its shifts too, but from nothing real:
 * `oee = 72 + ((dayIndex * 3 + typeIndex * 5) % 20)` and
 * `anomalies = (di + ti) % 4 === 0 ? …`. The numbers move, so the screen looks
 * alive, and none of them can be reconciled with any other screen in the
 * product — its week averages 81% while its own OEE page says 74.2%.
 *
 * ── The week is this week ─────────────────────────────────────────────────
 * The prototype hardcodes `DAYS = ["Mon 16", … "Sun 22"]` and a subtitle reading
 * "week of Jun 16–22, 2026". Right for one week in every fifty-two.
 */

/* ── The crew ─────────────────────────────────────────────────────────────
   Read from the directory the tasks panel and the handover archive already use,
   so a name on this screen is a person the rest of the app knows. The COO is
   not on a rota. */
const CREW_ROLES = ['usr_ops_1', 'usr_ops_2', 'usr_rel_1', 'usr_tec_1', 'usr_mgr_1']

export const CREW = CREW_ROLES.map((id) => TASK_PEOPLE.find((person) => person.id === id)).filter(
  Boolean,
)

/**
 * The spans the roster offers, in DAYS but always whole weeks — one, two and
 * four. Whole weeks because the roster is aligned to the calendar week and the
 * axis is labelled by weekday; a 30-day span would put Monday in a different
 * place on every screen.
 *
 * More than one exists because three shifts a day makes a week only twenty-one
 * points, which is thin for reading a trend off.
 */
export const SHIFT_RANGES = [7, 14, 28]

export const SHIFT_WEEK_DAYS = 7

export const SHIFT_TYPES = SHIFTS.map((shift) => shift.id)

/**
 * How far back to reach when nobody has asked for a span.
 *
 * A calendar week mid-flight is a chart that is mostly empty — on a Wednesday
 * only nine of its twenty-one shifts have run, and the right-hand half is blank.
 * So the default reaches back over LAST week as well whenever this one is still
 * in progress, and there is always a complete week of real shifts behind the
 * line. Once the week finishes, one week is enough and the default drops back
 * to it.
 *
 * The reader can still pick any span; this only decides what they get before
 * they touch the control.
 */
export function defaultShiftRange(now = Date.now()) {
  const thisWeek = shiftsForWeek(now, SHIFT_WEEK_DAYS)
  const complete = thisWeek.every((row) => row.status === 'completed')
  return complete ? SHIFT_WEEK_DAYS : SHIFT_WEEK_DAYS * 2
}

export const SHIFT_STATUSES = ['active', 'completed', 'scheduled']

/* The site this roster belongs to. The crew is Findlay's and so is the plant it
   runs; an alert from Pune is not this shift's to carry. */
/**
 * The plant this roster is for.
 *
 * Exported because the people directory needs it: a shift happens somewhere, and
 * "which sites does this person cover" cannot be answered without knowing where
 * the shifts they work are. It is not a field on the shift row — this roster is
 * one plant's, and putting a constant on sixty-three rows would invite somebody
 * to vary it without the rest of the module noticing.
 */
export const ROSTER_SITE = 'site_findlay'

const round = (value, digits = 1) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Local midnight n days from a reference day. */
function dayStart(offsetDays, from) {
  const date = new Date(from)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  return date
}

/**
 * The MONDAY of the calendar week containing a date.
 *
 * The roster runs Monday to Sunday, as the design's does — not the seven days
 * ending today. The two coincide exactly once a week, on a Sunday, which is
 * what made the trailing version look right when it was written. Everywhere
 * else it puts Monday in the middle of the chart and leaves the weekday axis
 * meaningless.
 *
 * `getDay()` is Sunday-0, so Sunday has to walk back six days rather than one.
 */
function weekStart(now) {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  const weekday = date.getDay()
  date.setDate(date.getDate() - (weekday === 0 ? 6 : weekday - 1))
  return date
}

/** `yyyy-mm-dd` in local time — not `toISOString`, which shifts by the offset. */
const localDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/**
 * The window a shift occupies, as instants.
 *
 * Night runs 22:00 → 06:00 and therefore ENDS on the following day. Getting that
 * wrong is how a night shift comes to look sixteen hours long, or negative.
 */
function windowFor(day, type) {
  const spec = SHIFTS.find((shift) => shift.id === type)
  const start = new Date(day)
  start.setHours(spec.startHour, 0, 0, 0)
  const end = new Date(start)
  end.setHours(spec.endHour, 0, 0, 0)
  if (spec.endHour <= spec.startHour) end.setDate(end.getDate() + 1)
  return { start, end, hours: (end - start) / 3_600_000 }
}

/**
 * A deterministic 0–1 from a key. Same generator the rest of the fixtures use —
 * never `Math.random()`, which would reshuffle the rota on every render.
 */
function noise(key, index = 0) {
  const seed = [...key].reduce((sum, character) => sum + character.charCodeAt(0), 0)
  const value = Math.sin((seed + index * 37.19) * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

/* ── Assignments ──────────────────────────────────────────────────────────
   The roster is derived, so the one thing a person genuinely decides about a
   shift is WHO WORKS IT. An override lives here, keyed by shift id, and the
   generator consults it. Module scope, so it survives the session — the same
   arrangement as the created charts and the uploaded documents. */
const ASSIGNMENTS = new Map()

/**
 * Reassign a shift that has not run yet.
 *
 * Returns null for a shift that does not exist and throws nothing for one
 * already worked — the ROUTE rejects that, because "you cannot rewrite who was
 * there" is a rule and not a fixture detail.
 */
export function assignShift({ date, type, operatorId }, now = Date.now()) {
  const id = `SH-${date}-${type}`
  /* Resolved over the longest span, so a shift can be assigned from any range
     the screen happens to be showing. */
  const row = shiftsForWeek(now, 30).find((shift) => shift.id === id)
  if (!row) return { error: 'notFound' }
  if (row.status !== 'scheduled') return { error: 'alreadyRun', status: row.status }
  if (!CREW.some((person) => person.id === operatorId)) return { error: 'unknownOperator' }
  ASSIGNMENTS.set(id, operatorId)
  return { shift: shiftsForWeek(now, 30).find((shift) => shift.id === id) }
}

/**
 * The week's shifts.
 *
 * Built for the seven days ending today, so the last row is the shift currently
 * running and the rest of today is still scheduled. `now` is a parameter so the
 * verify script can pin it.
 */
export function shiftsForWeek(now = Date.now(), days = SHIFT_WEEK_DAYS) {
  /* Which published figure the span has to average out to. A fortnight has no
     published OEE of its own, so it takes the week's — the nearest thing the
     product actually reports, and saying so beats inventing a third figure that
     no other screen would agree with. */
  const span = SHIFT_RANGES.includes(days) ? days : SHIFT_WEEK_DAYS
  const week = span > 14 ? OEE_PERIOD_DATA.month : OEE_PERIOD_DATA.week
  const rows = []

  /* Every span ends on the SUNDAY of the current week and reaches back a whole
     number of weeks, so the first row is always a Monday and the weekday axis
     means the same thing at every range. The days after today are `scheduled`,
     which is the truth about them and is what the design shows too. */
  const monday = weekStart(now)
  const firstDay = dayStart(-(span - SHIFT_WEEK_DAYS), monday)

  for (let dayIndex = 0; dayIndex < span; dayIndex += 1) {
    const day = dayStart(dayIndex, firstDay)
    SHIFT_TYPES.forEach((type, typeIndex) => {
      const { start, end, hours } = windowFor(day, type)

      /* Status from the clock, not from the row's position in the array. The
         prototype marks the first two days Completed and one cell Active
         whatever the date is. */
      const status = end.getTime() <= now ? 'completed' : start.getTime() <= now ? 'active' : 'scheduled'

      /* The rota, keyed to the DATE and not to the row's position in the array.
         Both are a fixed rotation, and only one of them is stable: indexing off
         `dayIndex` means the same Tuesday has a different operator depending on
         whether you asked for seven days or thirty, because Tuesday's index
         moves. Who worked a shift is a fact, not a function of how far back the
         reader is looking. `verify:mocks` asserts the two ranges agree.

         Stepping by one across the flat index — three shifts a day, five on the
         crew — still guarantees nobody works two in a row. */
      const slot = Math.floor(day.getTime() / 86_400_000) * SHIFT_TYPES.length + typeIndex
      const rostered = CREW[((slot % CREW.length) + CREW.length) % CREW.length]
      const assignedId = ASSIGNMENTS.get(`SH-${localDate(day)}-${type}`)
      const operator = (assignedId && CREW.find((person) => person.id === assignedId)) || rostered

      /* This shift's anomalies: the alerts whose detection time lands inside its
         window. Not a count — the ids, so the detail panel lists the real
         records rather than the prototype's three hardcoded strings, one of
         which names a heat exchanger from a different demo. */
      const anomalies = ALERTS.filter((alert) => {
        /* Findlay's crew works Findlay's plant. Matching on the time window
           alone put a Pune anomaly on a Findlay shift's handover — true of the
           clock and false of the plant. */
        if (alert.siteId !== ROSTER_SITE) return false
        const at = now - alert.detectedMinutesAgo * 60_000
        return at >= start.getTime() && at < end.getTime()
      })

      /* And its work orders: the ones raised off those anomalies. A work order
         with no alert behind it belongs to no shift, and saying so is better
         than the prototype's `wos = anomalies > 0 ? anomalies : 0`, which is the
         same number twice under two headings. */
      const orders = allWorkOrders().filter(
        (order) => order.alertId && anomalies.some((alert) => alert.id === order.alertId),
      )

      /* OEE. A deterministic spread around the week's published figure, pulled
         down where the shift carried anomalies — which is the relationship the
         whole product asserts, so the screen had better show it. Scheduled
         shifts have no OEE at all: nothing has run yet. */
      const swing = (noise(`${localDate(day)}-${type}`) - 0.5) * 9
      const penalty = anomalies.length * 2.4
      const oee = status === 'scheduled' ? null : round(week.oee.value + swing - penalty)

      rows.push({
        id: `SH-${localDate(day)}-${type}`,
        date: localDate(day),
        type,
        dayIndex,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        hours,
        status,
        operatorId: operator.id,
        operatorName: operator.name,
        operatorInitials: operator.initials,
        operatorRole: operator.role,
        oee,
        anomalyIds: anomalies.map((alert) => alert.id),
        workOrderIds: orders.map((order) => order.id),
      })
    })
  }

  /* ── Rescale, so this screen and the OEE module agree ──────────────────
     The week's shifts must average the week's published OEE. Generating around
     it gets close; nudging every value by the residual makes it exact, and
     `verify:mocks` asserts it. This is the same discipline as the loss waterfall
     landing on the headline — the prototype's version of this screen reports a
     week average its own OEE page contradicts. */
  const run = rows.filter((row) => row.oee != null)
  if (run.length) {
    const mean = run.reduce((sum, row) => sum + row.oee, 0) / run.length
    const correction = week.oee.value - mean
    for (const row of run) row.oee = round(row.oee + correction)
  }

  /* Downtime, derived from the same cascade the OEE module uses: availability is
     what is left of OEE once performance and quality are accounted for, and
     downtime is the hours that availability did not cover. So a shift's minutes
     lost cannot disagree with its own OEE figure. */
  for (const row of rows) {
    if (row.oee == null) {
      row.availability = null
      row.downtimeMinutes = null
      continue
    }
    const availability = row.oee / ((week.performance.value / 100) * (week.quality.value / 100))
    row.availability = round(availability)
    row.downtimeMinutes = Math.max(0, Math.round(((100 - availability) / 100) * row.hours * 60))
  }

  /* The handover that closed each shift, where the archive has one. Matched on
     the date and the outgoing window rather than authored onto the row, so the
     Shifts table and the Handovers archive are two views of one record. */
  const handovers = datedHandovers(now)
  for (const row of rows) {
    /* Only a shift that has ENDED can have handed over. Without the status
       guard a handover dated today attaches to tonight's shift, and the roster
       offers a report for work nobody has done yet. */
    const handover =
      row.status !== 'completed'
        ? null
        : (handovers.find(
            (handover) => handover.date === row.date && handover.from === row.type,
          ) ?? null)
    row.handoverId = handover?.id ?? null
    /* The status too, not just the id. A draft is not a filed report: the panel
       has to offer Edit rather than View, and it cannot tell which from an id. */
    row.handoverStatus = handover?.status ?? null
  }

  return rows
}

/**
 * The week's rollup.
 *
 * Counted off the rows rather than authored beside them, and over whichever set
 * it is handed — so the "Just me" toggle changes the figures, which is the whole
 * reason a personal view exists.
 */
export function shiftStats(rows) {
  const run = rows.filter((row) => row.oee != null)
  return {
    shifts: rows.length,
    completed: rows.filter((row) => row.status === 'completed').length,
    scheduled: rows.filter((row) => row.status === 'scheduled').length,
    averageOee: run.length ? round(run.reduce((sum, row) => sum + row.oee, 0) / run.length) : null,
    anomalies: rows.reduce((sum, row) => sum + row.anomalyIds.length, 0),
    workOrders: rows.reduce((sum, row) => sum + row.workOrderIds.length, 0),
    downtimeMinutes: rows.reduce((sum, row) => sum + (row.downtimeMinutes ?? 0), 0),
  }
}

/**
 * Per-person performance over the week.
 *
 * Counted off the same rows the table lists, so the crew list and the table can
 * never report a different number of shifts for one person.
 */
export function crewPerformance(rows) {
  return CREW.map((person) => {
    const mine = rows.filter((row) => row.operatorId === person.id)
    const stats = shiftStats(mine)
    return {
      id: person.id,
      name: person.name,
      initials: person.initials,
      role: person.role,
      shifts: mine.length,
      averageOee: stats.averageOee,
      anomalies: stats.anomalies,
      downtimeMinutes: stats.downtimeMinutes,
    }
  }).filter((person) => person.shifts > 0)
}

/**
 * The AI synopsis, composed from the week.
 *
 * Every figure in it is one the cards below also show, and the shifts it names
 * are found rather than fixed. The prototype's paragraph is composed too — and
 * then asserts "mostly on the C-12 coolant loop" as a literal, whichever shift
 * turns out to be the roughest and whatever was actually wrong with it.
 */
export function shiftSynopsis(rows, stats) {
  const active = rows.find((row) => row.status === 'active') ?? null
  const completed = rows.filter((row) => row.status === 'completed')

  const worst = completed.reduce(
    (held, row) =>
      !held || row.anomalyIds.length > held.anomalyIds.length ||
      (row.anomalyIds.length === held.anomalyIds.length && row.oee < held.oee)
        ? row
        : held,
    null,
  )

  /* What the rough shift was actually about — the asset carrying the most of its
     anomalies, named from the alert records rather than asserted. */
  const worstAsset = (() => {
    if (!worst?.anomalyIds.length) return null
    const tally = new Map()
    for (const id of worst.anomalyIds) {
      const alert = ALERTS.find((entry) => entry.id === id)
      if (!alert) continue
      tally.set(alert.assetName, (tally.get(alert.assetName) ?? 0) + 1)
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  })()

  return {
    shifts: stats.shifts,
    averageOee: stats.averageOee,
    anomalies: stats.anomalies,
    workOrders: stats.workOrders,
    downtimeMinutes: stats.downtimeMinutes,
    active: active
      ? {
          id: active.id,
          type: active.type,
          operatorName: active.operatorName,
          oee: active.oee,
          anomalies: active.anomalyIds.length,
          downtimeMinutes: active.downtimeMinutes,
        }
      : null,
    worst: worst
      ? {
          id: worst.id,
          type: worst.type,
          date: worst.date,
          oee: worst.oee,
          anomalies: worst.anomalyIds.length,
          asset: worstAsset,
        }
      : null,
    /* The direction of travel, measured rather than asserted. The prototype's
       heading says "OEE has been recovering since Wednesday's dip" above a chart
       that may be doing nothing of the sort. */
    trend: (() => {
      if (completed.length < 4) return null
      const half = Math.floor(completed.length / 2)
      const early = completed.slice(0, half)
      const late = completed.slice(half)
      const mean = (set) => set.reduce((sum, row) => sum + row.oee, 0) / set.length
      const delta = round(mean(late) - mean(early))
      return { deltaPts: delta, direction: delta > 0.4 ? 'up' : delta < -0.4 ? 'down' : 'flat' }
    })(),
  }
}

/**
 * A handover report for the shift that is running now.
 *
 * No such record exists — a shift that has not ended has not handed over — so
 * the design's "End Shift & Handover" modal has nothing to open. Its own answer
 * is to render a template with the selected shift's numbers substituted into a
 * fixed sentence, which is why every shift in it carries over "monitor C-12
 * coolant trend; bearing spares staged for next PM" whatever happened on it.
 *
 * This composes the draft instead. The window, the outgoing and incoming names,
 * the OEE, the carried anomalies and the pending actions all come from the shift
 * itself, so the report describes the shift somebody is about to hand over.
 *
 * `production` is the exception and is honest about it: cans produced and line
 * speed are site-level facts this fixture does not model per shift, so those two
 * rows come from the site's template. Downtime does not — that one the shift
 * knows.
 */
export function draftHandoverFor(shift, alerts, orders) {
  if (!shift) return null

  const order = ['morning', 'afternoon', 'night']
  const next = order[(order.indexOf(shift.type) + 1) % order.length]
  const nextSlot = Math.floor(Date.parse(shift.endsAt) / 86_400_000) * order.length + order.indexOf(next)
  const incoming = CREW[((nextSlot % CREW.length) + CREW.length) % CREW.length]

  const critical = alerts.filter((alert) => alert.severity === 'critical').length
  const high = alerts.filter((alert) => alert.severity === 'high').length

  const hhmm = (iso) => {
    const date = new Date(iso)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  return {
    handover: {
      // Marked as a draft id rather than borrowing a real one, so nothing can
      // mistake this for a filed record.
      id: `HND-DRAFT-${shift.id}`,
      from: shift.type,
      to: next,
      date: shift.date,
      window: `${hhmm(shift.startsAt)} – ${hhmm(shift.endsAt)}`,
      outgoing: shift.operatorName,
      incoming: incoming?.name ?? null,
      status: 'draft',
      oee: shift.oee,
      criticalCarried: critical,
      highCarried: high,
      pending: orders.length,
      draft: true,
    },
    report: {
      siteName: HANDOVER_REPORT.siteName,
      summary: [
        `${shift.operatorName} is handing over the ${shift.type} shift.`,
        shift.oee == null
          ? 'No OEE has been recorded yet.'
          : `Line OEE is running at ${shift.oee}% with ${shift.downtimeMinutes} minutes of downtime logged.`,
        alerts.length
          ? `${alerts.length} ${alerts.length === 1 ? 'anomaly is' : 'anomalies are'} open and carried across the boundary${critical ? `, ${critical} of them critical` : ''}.`
          : 'No anomalies were raised on this shift.',
        orders.length
          ? `${orders.length} work ${orders.length === 1 ? 'order was' : 'orders were'} raised and ${orders.length === 1 ? 'is' : 'are'} still open.`
          : 'No work orders were raised.',
      ].join(' '),
      production: HANDOVER_REPORT.production.map((row) =>
        row.key === 'downtime' && shift.downtimeMinutes != null
          ? { ...row, value: `${shift.downtimeMinutes} min`, note: null }
          : row,
      ),
      // The shift's OWN anomalies, in the shape the report table reads.
      carried: alerts.map((alert) => ({
        id: alert.id,
        severity: alert.severity,
        description: `${alert.sensor} on ${alert.assetName}`,
        state: alert.status,
      })),
      /* Ids and titles, NOT a pre-joined sentence. The two seeded orders store
         their title as an i18n key, and a fixture cannot translate — joining
         here leaked `WO-7734 — replaceDischargeBearing` into the report. The
         page resolves and joins. */
      pending: [],
      pendingOrders: orders.map((entry) => ({ id: entry.id, title: entry.title })),
      aiDraft: [
        shift.oee == null ? 'Shift in progress' : `OEE ${shift.oee}% · ${shift.downtimeMinutes} min downtime`,
        `${critical} critical, ${high} high anomalies carried`,
        `${orders.length} work ${orders.length === 1 ? 'order' : 'orders'} open`,
      ],
    },
  }
}
