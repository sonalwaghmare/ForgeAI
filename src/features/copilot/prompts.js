/**
 * The dock's suggested questions, resolved from the screen the reader is on.
 *
 * The dock is one panel that follows the whole app, so its suggestions cannot be
 * a fixed list: what is worth asking about a list of anomalies is not what is
 * worth asking about one of them. Resolving from the path rather than having each
 * screen push a list up into the shell keeps the pairing declared in one place —
 * a route and the questions it makes sense to ask there — and means a screen that
 * says nothing still gets the general set rather than nothing at all.
 *
 * Ids, not sentences. The wording is `dock.prompts.*` in `app.json` like every
 * other string in the panel, and this file has no business holding copy.
 */

/** Nothing is in hand; the useful question is about the population. */
const ANOMALY_LIST = ['listAll']

/** One record is in hand: what happened, what the instruments saw, what the analysis concluded. */
const ANOMALY_DETAIL = ['whatHappened', 'readings', 'summariseRca']

/** Everywhere else the dock can be grounded from — the band, a quote, an asset screen. */
const GENERAL = ['workOrder', 'similar', 'drifting']

/* `/app/anomalies/<id>` and nothing deeper: the detail screen's tabs are its own
   state, not a segment, so an id is the last thing the path can carry. */
const DETAIL = /^\/app\/anomalies\/[^/]+\/?$/
const LIST = /^\/app\/anomalies\/?$/

/**
 * @param {string} pathname the router's current path
 * @returns {string[]} `dock.prompts.*` ids, in the order they are offered
 */
export function dockPromptsFor(pathname) {
  if (DETAIL.test(pathname)) return ANOMALY_DETAIL
  if (LIST.test(pathname)) return ANOMALY_LIST
  return GENERAL
}
