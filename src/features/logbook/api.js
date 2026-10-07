import { get, post } from '@/services/http'
import { endpoints } from '@/services/endpoints'

/**
 * Logbook — the operator's written record.
 *
 * DEMO. See `DEMO-MODE.md` §8.6.
 *
 * ── This file is the seam ─────────────────────────────────────────────────
 * The two enums below live here and the page imports them from here, never
 * from `mocks/`. When the endpoint is real this file changes and the screen
 * does not.
 */

/** The two ways the log is read. Routes-in-search-params, not `useState`. */
export const LOGBOOK_VIEWS = ['feed', 'timeline']

/**
 * The shift a note was written on, in the order a day runs. Imported by the
 * timeline for its dot colours; the same three the roster uses.
 */
export const LOGBOOK_SHIFTS = ['morning', 'afternoon', 'night']

const toEntry = (row) => ({
  id: row.id,
  at: row.at,
  date: row.date,
  assetId: row.assetId,
  assetName: row.assetName,
  lineId: row.lineId ?? null,
  lineName: row.lineName ?? null,
  text: row.text,
  tags: row.tags ?? [],
  authorId: row.authorId ?? null,
  authorName: row.authorName ?? null,
  authorInitials: row.authorInitials ?? null,
  authorRole: row.authorRole ?? null,
  shiftId: row.shiftId ?? null,
  shiftType: row.shiftType ?? null,
  /* One fact in two fields, and the server guarantees they agree: `cited` is
     true exactly when `alert` is present. The badge and the chip render off
     the same answer. */
  cited: Boolean(row.cited),
  alert: row.alert ?? null,
  written: Boolean(row.written),
})

/**
 * The log, filtered.
 *
 * @param {{ q?: string, assetId?: string, shiftId?: string, cited?: boolean }} params
 */
export async function fetchLogbook(params, signal) {
  const data = await get(endpoints.logbook.list, { signal, params })
  return {
    items: (data?.items ?? []).map(toEntry),
    total: data?.total ?? 0,
    /* The whole log, so the count can read "3 of 12" rather than "3 of 3". */
    grandTotal: data?.grandTotal ?? 0,
    /* The synonym terms the search actually matched on. Empty for a query that
       found everything it needed literally, and empty for no query at all — so
       the chip appears only when there is something true to say. */
    expanded: data?.expanded ?? [],
    /* Two different lists. `assets` is what the log has entries about, which is
       what the filter offers; `plant` is every machine on the site, which is
       what the composer offers. Conflating them would make a machine
       unwritable until somebody had already written about it. */
    assets: data?.assets ?? [],
    plant: data?.plant ?? [],
    /* Who the server will put on a new entry, and which shift it will file it
       against. Both come down with the list so the composer's byline is the
       truth rather than the client's guess. */
    author: data?.author ?? null,
    shift: data?.shift ?? null,
  }
}

/**
 * Write an entry.
 *
 * The author is NOT sent. A real service reads it from the token and this one
 * stamps the demo persona — either way it is the server's to decide, and a
 * client that could name the author could sign somebody else's observation.
 */
export const createLogEntry = ({ assetId, text, tags }) =>
  post(endpoints.logbook.list, { assetId, text, tags })
