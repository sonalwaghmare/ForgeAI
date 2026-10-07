/**
 * Planned figures for a shift that has not run.
 *
 * DEMO. The roster's OEE, anomaly count and work-order count are measurements:
 * the fixture leaves them null on a `scheduled` row because nothing has
 * happened yet, and the History table drew an em dash in all three columns.
 * On the default fortnight that span reaches to Sunday and sorts newest first,
 * so the FIRST page is the three days ahead of today and every cell in those
 * columns is a dash — a table that tells the reader nothing.
 *
 * ── Why this is presentation, not fixture ─────────────────────────────────
 * These numbers deliberately do NOT go through the transport. The week's mean
 * OEE is rescaled server-side so that it IS the published figure, and the
 * synopsis chart, the KPI strip and the crew rollup are all counted off the
 * completed rows. Seeding forecasts into the fixture would drag every one of
 * those off the number the OEE module reports and break the invariant
 * `verify:mocks` asserts. So a projection is drawn where a measurement is
 * missing, and nothing is aggregated from it.
 *
 * ── Deterministic ────────────────────────────────────────────────────────
 * Seeded off the shift's own id, never `Math.random()`. A row that changes its
 * OEE when you page away and back reads as a bug, and it is the one thing a
 * reader will notice about a column of invented numbers.
 */

/* The week's published performance and quality, as the OEE module reports them.
   Availability is derived against these so `A x P x Q` is the projected OEE. */
const PERFORMANCE = 88.6
const QUALITY = 99.2

/** FNV-1a over the key. Same value for the same id, this render and the next. */
function hash(key) {
  let value = 2_166_136_261
  for (let index = 0; index < key.length; index += 1) {
    value ^= key.charCodeAt(index)
    value = Math.imul(value, 16_777_619)
  }
  return value >>> 0
}

/** A stable 0–1 from an id and a field name, so the three streams differ. */
const unit = (id, field) => hash(`${id}:${field}`) / 4_294_967_296

/**
 * The three figures a scheduled shift is projected to land on.
 *
 * Ranges match the rest of the module: OEE 68–92%, which brackets the week's
 * published 74.2 and the 85 target; anomalies 0–4; work orders 0–3 and never
 * more than one past the anomaly count, because a work order generally follows
 * from something going wrong rather than appearing on its own.
 */
export function projectedShift(id, hours = 8) {
  const anomalies = Math.floor(unit(id, 'anomalies') * 5)
  const workOrders = Math.min(
    3,
    Math.min(anomalies + 1, Math.floor(unit(id, 'workOrders') * (anomalies + 2))),
  )
  const oee = Math.round((68 + unit(id, 'oee') * 24) * 10) / 10

  /* Downtime FOLLOWS FROM the OEE, it is not a fourth independent draw.
     Availability is what is left of the OEE once the week's performance and
     quality are accounted for, and downtime is the minutes availability did not
     cover — the same cascade the OEE module and the handover report use. So a
     projected shift cannot print minutes lost that contradict its own projected
     OEE, which is what a second `unit(id, 'downtime')` would have allowed. */
  const availability = oee / ((PERFORMANCE / 100) * (QUALITY / 100))
  return {
    oee,
    anomalies,
    workOrders,
    downtimeMinutes: Math.max(0, Math.round(hours * 60 * (1 - availability / 100))),
  }
}

/**
 * What the OEE / Anomalies / WOs columns show for one row.
 *
 * A shift that has run reports what it measured. A `scheduled` one has measured
 * nothing, so the three columns used to be em dashes — and on the default
 * fortnight, which reaches to Sunday and sorts newest first, the whole of page
 * one is days that have not happened. Three columns of dashes.
 *
 * So a scheduled row carries a PLAN instead of a blank, drawn muted and italic
 * and titled as such, and flagged `projected` so nothing downstream mistakes it
 * for a reading.
 *
 * Lives here rather than beside the table because the crew drill-down lists the
 * same rows in the same three columns: two copies of this rule is how one
 * surface ends up showing a dash where the other shows a number for one shift.
 */
export function shiftFigures(row) {
  if (row.status !== 'scheduled' && row.oee != null) {
    return {
      projected: false,
      oee: row.oee,
      anomalies: row.anomalies.length,
      workOrders: row.workOrders.length,
      downtimeMinutes: row.downtimeMinutes,
    }
  }
  return { projected: true, ...projectedShift(row.id, row.hours) }
}
