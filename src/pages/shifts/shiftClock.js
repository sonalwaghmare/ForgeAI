import { formatDateTime, formatTime } from '@/lib/format'

/**
 * Printing a roster shift's clock.
 *
 * ── The bug this exists to stop ───────────────────────────────────────────
 * The roster's windows are BUILT in the runtime's local zone — `setHours(6,…)`
 * in `fixtures/shifts.js` — and then serialised with `toISOString()`. The org's
 * configured time zone (Settings → General) is applied at RENDER by
 * `orgTimeOptions()`. Two zones in one pipeline, and every surface in the module
 * inherited the mismatch:
 *
 *   generated  local 06:00 on 2026-08-23  →  2026-08-23T00:30:00Z
 *   rendered   in America/New_York        →  "20:30 – 04:30", "22 Aug 2026"
 *
 * A morning shift printed as 20:30–04:30, dated the day before the one in its
 * own id. Reproduced exactly against the screenshot.
 *
 * The row's `date` made it worse in a second way: `"2026-08-23"` handed to
 * `new Date()` is parsed as UTC midnight, so any zone behind UTC renders it as
 * the 22nd whatever the window says. That is §2.7's "a time in an ISO string is
 * UTC" trap on a value that is not a time at all — it is a calendar date.
 *
 * ── The rule ──────────────────────────────────────────────────────────────
 * A shift is printed in the zone its plant is in. `formatTime` says exactly that
 * in its own comment, and the shifts pages simply never passed one. Today that
 * zone IS the runtime's, because the roster is generated against the local clock
 * and `status` — active, completed, scheduled — is decided against it too. So
 * the whole record is internally consistent in one zone, and this module names
 * it rather than letting the org default silently reinterpret it.
 *
 * When a real endpoint serves true instants for a plant in another zone, the
 * fix is to swap `ROSTER_ZONE` for the site's — one constant, and the id, the
 * window, the date and the status all move together.
 */
const ROSTER_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

/** `startsAt` / `endsAt` — an instant, printed in the roster's zone. */
export const formatShiftTime = (value) => formatTime(value, ROSTER_ZONE)

/**
 * `date` — a CALENDAR date, not an instant.
 *
 * Rebuilt from its parts so it is midnight in the roster's zone rather than
 * midnight UTC, which is what stopped `2026-08-23` from rendering as the 22nd.
 */
export function formatShiftDate(value, options) {
  if (!value) return '—'
  const [year, month, day] = String(value).split('-').map(Number)
  if (!year || !month || !day) return formatDateTime(value, { ...options, timeZone: ROSTER_ZONE })
  return formatDateTime(new Date(year, month - 1, day), { ...options, timeZone: ROSTER_ZONE })
}
