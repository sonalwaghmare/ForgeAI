/**
 * Tone → class maps.
 *
 * Tailwind resolves classes by scanning source text, so a class built from a
 * template literal (`stripe-${tone}`) is never generated and silently renders
 * nothing. Every dynamic class in this codebase therefore comes from a static
 * map like these, where the class name exists literally in the source.
 *
 * The alternative — `@source inline(...)` safelisting — hides the coupling in
 * the stylesheet. This keeps it where the reader is.
 */

/** The 3px semantic leading edge. Authored logically, so RTL mirrors for free. */
export const STRIPE_CLASS = {
  red: 'stripe-red',
  amber: 'stripe-amber',
  watch: 'stripe-watch',
  green: 'stripe-green',
  violet: 'stripe-violet',
  forge: 'stripe-forge',
  ack: 'stripe-ack',
  dismissed: 'stripe-dismissed',
}

/** Tinted fill at the theme's tint strength. */
export const TINT_CLASS = {
  red: 'tint-red',
  amber: 'tint-amber',
  watch: 'tint-watch',
  green: 'tint-green',
  violet: 'tint-violet',
  forge: 'tint-forge',
  ack: 'tint-ack',
  dismissed: 'tint-dismissed',
}

/** Text set on that hue's own tint — the darker ramp step, never the token. */
export const ON_TINT_CLASS = {
  line: 'text-on-line',
  red: 'text-on-red',
  amber: 'text-on-amber',
  watch: 'text-on-watch',
  green: 'text-on-green',
  violet: 'text-on-violet',
  forge: 'text-on-forge',
  ack: 'text-on-ack',
  dismissed: 'text-on-dismissed',
}

/** Health ladder, unified: ≥80 green · 50–79 amber · <50 red. */
export function toneForHealth(health) {
  if (health == null) return null
  if (health >= 80) return 'green'
  if (health >= 50) return 'amber'
  return 'red'
}

/**
 * The anomaly lifecycle, as a glyph and a hue per status.
 *
 * Here rather than on a page because two surfaces read it and they must never
 * disagree: somebody who filters by the blue tile on the list and then scans for
 * blue pills is using them as one control, and one status wearing two colours is
 * what makes a facet row untrustworthy. The detail screen's status menu is the
 * second reader.
 *
 * An unmapped status — the sixth member this enum is expected to gain — falls back
 * to a generic glyph and no hue rather than crashing or rendering blank.
 *
 * Two of these are worth stating out loud:
 *
 * `open` is Forge Orange, which contradicts this system's rule that Forge Orange is
 * identity and interaction and never a severity — and does not, because Open is not
 * a severity. It is a lifecycle status on a different axis, and the one that means
 * "nobody has picked this up", which is a call to act. The severity ladder still
 * owns red/amber/watch/neutral. It is also the prototype's own choice for this
 * tile.
 *
 * `dismissed` takes Dismissed Blue rather than a green: resolved means the machine
 * was attended to, dismissed means somebody judged the detection not worth acting
 * on, and green on both would say the plant is fine in a case where nobody looked.
 */
export const ANOMALY_STATUS_ICON = {
  open: 'bolt',
  acknowledged: 'check',
  escalated: 'up',
  resolved: 'shield',
  dismissed: 'x',
  /* DEMO facets. Glyphs only — deliberately absent from `ANOMALY_STATUS_TONE`
     below, so a facet the server cannot count renders in neutral ink beside ones
     it can. That is not a styling shortfall: hue in this system means machine
     state, and there is no state here for it to report. */
  snoozed: 'cal',
  unassigned: 'users',
}

export const ANOMALY_STATUS_TONE = {
  open: 'forge',
  acknowledged: 'ack',
  escalated: 'amber',
  resolved: 'green',
  dismissed: 'dismissed',
}

/** Operational state → hue. */
export const STATE_TONE = {
  running: 'green',
  connected: 'green',
  ok: 'green',
  watch: 'amber',
  degraded: 'amber',
  tripped: 'red',
  offline: 'red',
}

/**
 * Work-order priority → tone.
 *
 * Priority is NOT severity: a severity is the platform's reading of a signal, a
 * priority is a human scheduling decision, and they take different words. `low`
 * deliberately earns no colour — a board where every card is tinted has no
 * signal left on it.
 */
export const PRIORITY_TONE = { urgent: 'red', high: 'amber', medium: 'watch', low: null }

/**
 * Shift status → tone.
 *
 * `scheduled` earns none. A shift nobody has worked yet is not a state with a
 * colour — the same call `LINE_STATES` makes about an idle line, and for the
 * same reason: a roster where two thirds of the rows are tinted has no signal
 * in it.
 */
export const SHIFT_STATE_TONE = { active: 'green', completed: null, scheduled: null }

/**
 * Shift window → tone.
 *
 * Not a status: this is which of the three windows a row belongs to, and the
 * three have to read apart at a glance on the roster's dot and on the
 * logbook timeline's. It lives here rather than beside either one because two
 * screens colouring the night shift differently is the kind of drift nobody
 * notices and everybody feels.
 */
export const SHIFT_TYPE_TONE = { morning: 'ack', afternoon: 'amber', night: 'violet' }
