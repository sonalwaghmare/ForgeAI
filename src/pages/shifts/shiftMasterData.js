/**
 * Shift Master — the pattern store, and the arithmetic over it.
 *
 * DEMO. Hardcoded here rather than in a fixture: nothing on the server models a
 * shift PATTERN yet, and the roster endpoint that does exist returns worked
 * shifts, not the rota that produced them. When the pattern endpoint lands this
 * file becomes `features/shifts/patterns.js` and the page does not change.
 *
 * Everything below is data — site ids, people, line names, pattern names the
 * user types — so none of it goes through `t()`. The furniture around it does.
 *
 * The prototype carries a `col: "#F59E0B"` on every pattern. A hex cannot
 * survive `data-theme` or colour-blind mode, so a pattern carries a TONE id
 * instead and the page resolves it through the static maps in `lib/tone.js`.
 */

/** Tones a pattern may wear. Violet is the night shift here, as `SHIFT_TYPE_TONE` already has it. */
export const PATTERN_TONES = ['amber', 'forge', 'violet', 'green', 'ack', 'watch']

export const SHIFT_SITES = [
  { id: 'site_findlay', label: 'Findlay Plant', timeZone: 'America/New_York' },
  { id: 'site_weissenthurm', label: 'Weißenthurm Works', timeZone: 'Europe/Berlin' },
  { id: 'site_pune', label: 'Pune Plant', timeZone: 'Asia/Kolkata' },
]

export const SITE_TIME_ZONE = Object.fromEntries(
  SHIFT_SITES.map((site) => [site.id, site.timeZone]),
)

/** The icon vocabulary the drawer offers. Every id exists in `IconSprite`. */
export const PATTERN_ICONS = ['sun', 'gauge', 'moon', 'cal', 'gear', 'bolt']

/** Presets. Picking one fills the name, the icon, the tone and both times. */
export const PATTERN_PRESETS = [
  { name: 'Day', icon: 'sun', tone: 'amber', start: '06:00', end: '14:00' },
  { name: 'Evening', icon: 'gauge', tone: 'forge', start: '14:00', end: '22:00' },
  { name: 'Night', icon: 'moon', tone: 'violet', start: '22:00', end: '06:00' },
  { name: 'General', icon: 'cal', tone: 'green', start: '09:00', end: '18:00' },
]

export const GRACE_OPTIONS = [0, 5, 10, 15, 30]

/** Sunday-first, matching `Date#getDay`. */
export const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]

export const SHIFT_LINES = ['All lines', 'Line 1', 'Line 2', 'Ends Line 1', 'Compressed Air']

export const SHIFT_OPERATORS = [
  { id: 'usr_op_1', name: 'Arjun Mehta', role: 'Operator', initials: 'AM' },
  { id: 'usr_mgr_1', name: 'Dana Okafor', role: 'Plant manager', initials: 'DO' },
  { id: 'usr_rel_1', name: 'Ines Brandt', role: 'Reliability engineer', initials: 'IB' },
  { id: 'usr_tech_1', name: 'Karan Patel', role: 'Technician', initials: 'KP' },
  { id: 'usr_lead_1', name: 'Maya Reddy', role: 'Shift lead', initials: 'MR' },
  { id: 'usr_coo_1', name: 'James Whitfield', role: 'COO', initials: 'JW' },
]

export const INITIAL_PATTERNS = [
  {
    id: 'sp-day',
    name: 'Day',
    icon: 'sun',
    tone: 'amber',
    start: '06:00',
    end: '14:00',
    days: [1, 2, 3, 4, 5],
    site: 'site_findlay',
    grace: 15,
    active: true,
  },
  {
    id: 'sp-eve',
    name: 'Evening',
    icon: 'gauge',
    tone: 'forge',
    start: '14:00',
    end: '22:00',
    days: [1, 2, 3, 4, 5],
    site: 'site_findlay',
    grace: 15,
    active: true,
  },
  {
    id: 'sp-night',
    name: 'Night',
    icon: 'moon',
    tone: 'violet',
    start: '22:00',
    end: '06:00',
    days: [1, 2, 3, 4, 5, 6, 0],
    site: 'site_findlay',
    grace: 15,
    active: true,
  },
  {
    id: 'sp-wknd',
    name: 'Weekend',
    icon: 'cal',
    tone: 'green',
    start: '08:00',
    end: '20:00',
    days: [6, 0],
    site: 'site_findlay',
    grace: 30,
    active: true,
  },
  {
    id: 'sp-wtm-a',
    name: 'Frühschicht',
    icon: 'gear',
    tone: 'ack',
    start: '06:00',
    end: '14:00',
    days: [1, 2, 3, 4, 5, 6],
    site: 'site_weissenthurm',
    grace: 10,
    active: true,
  },
  {
    id: 'sp-pnq-a',
    name: 'Shift A',
    icon: 'gear',
    tone: 'watch',
    start: '07:00',
    end: '15:00',
    days: [1, 2, 3, 4, 5, 6],
    site: 'site_pune',
    grace: 10,
    active: false,
  },
]

export const INITIAL_ROSTER = [
  { userId: 'usr_op_1', patternId: 'sp-day', line: 'Line 1' },
  { userId: 'usr_lead_1', patternId: 'sp-day', line: 'All lines' },
  { userId: 'usr_tech_1', patternId: 'sp-eve', line: 'Line 2' },
  { userId: 'usr_mgr_1', patternId: 'sp-night', line: 'All lines' },
  { userId: 'usr_rel_1', patternId: 'sp-wtm-a', line: 'Ends Line 1' },
]

/* ── arithmetic ──────────────────────────────────────────────────────────── */

/** `"22:00"` → 1320. Minutes since midnight. */
export function toMinutes(time) {
  const [hours, minutes] = (time || '00:00').split(':')
  return Number(hours) * 60 + (Number(minutes) || 0)
}

/** A window that ends at or before it starts has run over midnight. */
export function crossesMidnight(start, end) {
  return toMinutes(end) <= toMinutes(start)
}

/** Length of the window in whole hours and minutes, midnight-safe. */
export function patternDuration(start, end) {
  let total = toMinutes(end) - toMinutes(start)
  if (total <= 0) total += 1440
  return { hours: Math.floor(total / 60), minutes: total % 60, total }
}

/** The spans a window occupies on a 0–1440 clock, split where it wraps. */
function spansOf(start, end) {
  const from = toMinutes(start)
  const to = toMinutes(end)
  return crossesMidnight(start, end)
    ? [
        [from, 1440],
        [0, to],
      ]
    : [[from, to]]
}

/**
 * Patterns on the same site that share a day AND overlap in time.
 *
 * Both halves matter: two windows at the same hour on different days do not
 * conflict, and two windows on the same day that do not touch do not either.
 * A pattern never conflicts with itself, and an inactive one conflicts with
 * nothing — turning a pattern off is how you retire it without deleting it.
 */
export function overlappingPatterns(candidate, patterns) {
  const own = spansOf(candidate.start, candidate.end)
  return patterns.filter((other) => {
    if (other.id === candidate.id || !other.active || other.site !== candidate.site) return false
    if (!other.days.some((day) => candidate.days.includes(day))) return false
    const theirs = spansOf(other.start, other.end)
    return own.some(([a0, a1]) => theirs.some(([b0, b1]) => a0 < b1 && b0 < a1))
  })
}

/**
 * Which pattern a login at `when` resolves to on `siteId`.
 *
 * The grace window widens the match at both ends, so two patterns can claim the
 * same minute; the narrowest window wins, because the more specific pattern is
 * the one somebody wrote deliberately. A wrapped window is matched against the
 * PREVIOUS day for its morning half — the day selection refers to the shift's
 * start day, which is what the drawer says it does.
 */
export function resolveCurrentPattern(siteId, patterns, when = new Date()) {
  const day = when.getDay()
  const minutes = when.getHours() * 60 + when.getMinutes()
  const hits = []

  for (const pattern of patterns) {
    if (!pattern.active || (siteId && pattern.site !== siteId)) continue
    const start = toMinutes(pattern.start)
    const end = toMinutes(pattern.end)
    const grace = pattern.grace || 0

    if (!crossesMidnight(pattern.start, pattern.end)) {
      if (pattern.days.includes(day) && minutes >= start - grace && minutes < end + grace) {
        hits.push(pattern)
      }
      continue
    }
    if (pattern.days.includes(day) && minutes >= start - grace) hits.push(pattern)
    else if (pattern.days.includes((day + 6) % 7) && minutes < end + grace) hits.push(pattern)
  }

  if (!hits.length) return null
  hits.sort(
    (a, b) => patternDuration(a.start, a.end).total - patternDuration(b.start, b.end).total,
  )
  return hits[0]
}

/** A new pattern, seeded for the site the reader is looking at. */
export function blankPattern(siteId) {
  return {
    id: null,
    name: '',
    icon: 'sun',
    tone: 'amber',
    start: '',
    end: '',
    days: [1, 2, 3, 4, 5],
    site: siteId === 'all' ? SHIFT_SITES[0].id : siteId,
    grace: 15,
    active: true,
  }
}
