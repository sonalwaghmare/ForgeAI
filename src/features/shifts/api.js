import { get, post } from '@/services/http'
import { endpoints } from '@/services/endpoints'

/**
 * Shifts — the week's roster.
 *
 * DEMO. See `DEMO-MODE.md` §8.5.
 *
 * ── Not `features/operations` ─────────────────────────────────────────────
 * That one holds `useCurrentShift` and `useHandover`, which feed the top bar and
 * the public page and predate this module. They read different paths and stay
 * where they are. Nothing here duplicates them.
 *
 * ── This file is the seam ─────────────────────────────────────────────────
 * The enums come from here; the fixture imports its window definitions from
 * `operations.js`, never from a page.
 */

/** The three tabs. Search params, not `useState` — see the page. */
export const SHIFT_TABS = ['synopsis', 'current', 'history']

/** Shift windows, in the order a day runs. */
export const SHIFT_TYPES = ['morning', 'afternoon', 'night']

/** Where a shift is relative to now. Derived server-side from the clock. */
export const SHIFT_STATUSES = ['active', 'completed', 'scheduled']

/** The crew scope toggle. */
export const SHIFT_SCOPES = ['all', 'mine']

/**
 * How far back the roster reaches, in days but always whole weeks. The roster
 * is aligned to the calendar week — Monday to Sunday, as the design has it — so
 * a span that was not a multiple of seven would put Monday in a different place
 * on every screen and make the weekday axis meaningless.
 *
 * A span over a fortnight is rescaled to the MONTH's published OEE rather than
 * the week's — see the fixture. So the chart still agrees with the OEE module
 * whichever range is picked, which is the whole property.
 */
export const SHIFT_RANGES = [7, 14, 28]

const toShift = (row) => ({
  id: row.id,
  date: row.date,
  type: row.type,
  startsAt: row.startsAt,
  endsAt: row.endsAt,
  hours: row.hours,
  status: row.status,
  operatorId: row.operatorId,
  operatorName: row.operatorName,
  operatorInitials: row.operatorInitials,
  operatorRole: row.operatorRole,
  oee: row.oee,
  availability: row.availability,
  downtimeMinutes: row.downtimeMinutes,
  anomalies: row.anomalies ?? [],
  workOrders: row.workOrders ?? [],
  // The handover that closed this shift, where the archive holds one. Matched
  // server-side, so the roster and the archive are two views of one record.
  handoverId: row.handoverId ?? null,
  handoverStatus: row.handoverStatus ?? null,
})

/**
 * The roster, with its rollup, its crew table and the AI synopsis.
 *
 * One request. The briefing's figures are counted off the same rows the table
 * lists, and splitting them across two endpoints would be two chances for them
 * to disagree — which is exactly what goes wrong in the design.
 *
 * @param {{
 *   mine?: string, type?: string, status?: string, operatorId?: string,
 *   days?: number, page?: number, pageSize?: number,
 * }} params
 */
export async function fetchShifts(params, signal) {
  const data = await get(endpoints.shifts.list, { signal, params })
  return {
    items: (data?.items ?? []).map(toShift),
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    pageSize: data?.pageSize ?? 10,
    stats: data?.stats ?? null,
    synopsis: data?.synopsis ?? null,
    crew: data?.crew ?? [],
    /* The report the running shift would file, composed from that shift. Null
       when nothing is running. See `draftHandoverFor`. */
    draftHandover: data?.draftHandover ?? null,
    days: data?.days ?? 7,
    options: data?.options ?? { types: SHIFT_TYPES, operators: [], ranges: SHIFT_RANGES },
  }
}

/**
 * Assign a scheduled shift to somebody.
 *
 * A POST to the collection, because on a derived roster this is the only thing
 * about a shift that is genuinely undecided — see `ScheduleShiftDialog`. The
 * server answers 422 for a shift that has already run.
 */
export const assignShift = ({ date, type, operatorId }) =>
  post(endpoints.shifts.list, { date, type, operatorId })
