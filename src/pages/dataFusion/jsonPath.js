/**
 * The JSONPath the builder produces, as data rather than as a string.
 *
 * ── Why a segment model and not string concatenation ─────────────────────
 * The builder has to do two things at once: emit an expression, and say what that
 * expression resolves to against a sample payload. Doing the first by appending to
 * a string and the second by parsing that string back guarantees they eventually
 * disagree — and the failure mode is the worst kind, a confident preview of the
 * wrong value. So the selection IS the segment list; the string and the resolved
 * value are both derived from it, and neither can drift from the other.
 *
 * ── The dialect is jsonpath_ng.ext, not "JSONPath" generally ──────────────
 * The server evaluates with `jsonpath_ng.ext` (`app/services/extraction_service.py`),
 * whose filter syntax is `[?(@.field=='value')]` and whose boolean operators are
 * single `&` and `|` — not the `&&`/`||` of other dialects. Everything emitted here
 * is valid in that dialect.
 *
 * ── What this file supports, and what it declines ─────────────────────────
 * Emitted and round-trippable: `.key`, `['key with spaces']`, `[n]`, and a single
 * equality filter `[?(@.field=='v')]` / `[?(@.field==n)]` whose field may itself be
 * dotted (`@.properties.quality`).
 *
 * NOT supported, deliberately: compound filters (`&`/`|`), comparison operators
 * (`>`), wildcards (`[*]`), recursive descent (`$..value`), and slices. Those are
 * all legal for the server and all reachable by typing the expression directly —
 * `parsePath` returns null for them and the builder then says the expression is
 * beyond it rather than silently rewriting it into something else. Declining to
 * parse is the honest outcome; a lossy round-trip would edit a working path into a
 * broken one.
 */

/** A bare `.key` is only legal for an identifier; anything else needs brackets. */
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

const isIdentifier = (key) => IDENTIFIER.test(key)

/** A filter's right-hand side, written the way the dialect wants it. */
function literal(value) {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  // Single quotes, and an embedded quote is escaped rather than left to break the
  // expression. Rare in a metric name, fatal when it happens.
  return `'${String(value).replace(/'/g, "\\'")}'`
}

/**
 * Segments → the expression string.
 *
 * @param {Array<object>} segments
 * @returns {string} Always starts at `$`, so an empty selection renders as `$` —
 *   the whole payload, which is a truthful thing to show rather than a blank.
 */
export function renderPath(segments) {
  let out = '$'
  for (const segment of segments ?? []) {
    if (segment.kind === 'key') {
      out += isIdentifier(segment.key) ? `.${segment.key}` : `['${segment.key}']`
    } else if (segment.kind === 'index') {
      out += `[${segment.index}]`
    } else if (segment.kind === 'filter') {
      out += `[?(@.${segment.field}==${literal(segment.value)})]`
    }
  }
  return out
}

/** Reads a dotted field path inside one array element, for a filter's left side. */
function readField(node, field) {
  return String(field)
    .split('.')
    .reduce((cursor, part) => (cursor == null ? undefined : cursor[part]), node)
}

/**
 * Every value the segments select, in payload order.
 *
 * Returns an array because JSONPath is a query, not an accessor — and the count is
 * the diagnostic the form actually needs. `resolve_extraction_config` server-side
 * takes `matches[0].value if matches else None`, so a path matching three metrics
 * silently reads the first: exactly the mistake `$.metrics[0].value` invites and
 * the reason the builder reports the match count rather than just a value.
 *
 * @returns {Array<*>} Empty when nothing matched.
 */
export function resolvePath(payload, segments) {
  let current = [payload]

  for (const segment of segments ?? []) {
    const next = []

    for (const node of current) {
      if (segment.kind === 'key') {
        if (node && typeof node === 'object' && !Array.isArray(node) && segment.key in node) {
          next.push(node[segment.key])
        }
      } else if (segment.kind === 'index') {
        if (Array.isArray(node) && segment.index >= 0 && segment.index < node.length) {
          next.push(node[segment.index])
        }
      } else if (segment.kind === 'filter') {
        if (Array.isArray(node)) {
          for (const element of node) {
            // Compared as strings on purpose. The value select round-trips its
            // options through `String()`, so a numeric alias can arrive back as
            // "0" and must still match the 0 it came from — and the server's own
            // comparison is jsonpath_ng's, not JavaScript's, so strict identity
            // here would reject filters that do match in production.
            if (String(readField(element, segment.field)) === String(segment.value)) {
              next.push(element)
            }
          }
        }
      }
    }

    current = next
  }

  return current
}

/**
 * Expression string → segments, or null when it is outside the supported subset.
 *
 * Only needed for the raw-edit case: a path typed or pasted by hand, or one loaded
 * from a stored `extraction_config` that a previous version of this form (or a
 * person) produced. Null is a real answer — see the note at the top of this file.
 *
 * @returns {Array<object>|null}
 */
export function parsePath(expression) {
  const text = String(expression ?? '').trim()
  if (!text.startsWith('$')) return null

  let rest = text.slice(1)
  const segments = []

  // Ordered longest-first: the two filter forms must be tried before the plain
  // `[n]`, or `[?(...)]` would fail against the index pattern and abort.
  const matchers = [
    [/^\[\?\(@\.([A-Za-z0-9_$.]+)\s*==\s*'((?:[^'\\]|\\.)*)'\)\]/, (m) => ({
      kind: 'filter',
      field: m[1],
      value: m[2].replace(/\\'/g, "'"),
    })],
    [/^\[\?\(@\.([A-Za-z0-9_$.]+)\s*==\s*(-?\d+(?:\.\d+)?)\)\]/, (m) => ({
      kind: 'filter',
      field: m[1],
      value: Number(m[2]),
    })],
    [/^\[(\d+)\]/, (m) => ({ kind: 'index', index: Number(m[1]) })],
    [/^\['((?:[^'\\]|\\.)*)'\]/, (m) => ({ kind: 'key', key: m[1].replace(/\\'/g, "'") })],
    [/^\.([A-Za-z_$][A-Za-z0-9_$]*)/, (m) => ({ kind: 'key', key: m[1] })],
  ]

  while (rest.length) {
    const hit = matchers.find(([pattern]) => pattern.test(rest))
    // Anything left over is a construct this builder does not model — a wildcard, a
    // recursive descent, a compound filter. Refuse the whole expression rather than
    // return a prefix that would be silently rewritten on the next edit.
    if (!hit) return null

    const [pattern, build] = hit
    const match = rest.match(pattern)
    segments.push(build(match))
    rest = rest.slice(match[0].length)
  }

  return segments
}

/**
 * The keys of an array's object elements that are worth offering as a filter.
 *
 * Scalars only. A nested object is not a useful equality target, and offering
 * `properties` as something to match on `==` would produce an expression that never
 * matches anything.
 *
 * @param {Array<*>} items
 * @returns {string[]} In first-seen order, so the payload's own field order is kept.
 */
export function matchableFields(items) {
  const keys = []
  for (const element of items ?? []) {
    if (!element || typeof element !== 'object' || Array.isArray(element)) continue
    for (const [key, value] of Object.entries(element)) {
      if ((value === null || typeof value !== 'object') && !keys.includes(key)) keys.push(key)
    }
  }
  return keys
}

/**
 * The field the builder should offer first when descending into an array.
 *
 * Preference order is not cosmetic. `$.metrics[0].value` is positional and breaks
 * the moment a publisher reorders its metrics — a silent wrong reading, not an
 * error. A name match is order-independent, so the identifying field is chosen
 * ahead of the index whenever the payload has one.
 */
const PREFERRED_MATCH_FIELDS = ['name', 'id', 'key', 'alias', 'tag']

export function preferredMatchField(items) {
  const available = matchableFields(items)
  return PREFERRED_MATCH_FIELDS.find((key) => available.includes(key)) ?? available[0] ?? null
}

/** The distinct values of one field across an array's elements, for the value select. */
export function fieldValues(items, field) {
  const seen = []
  for (const element of items ?? []) {
    const value = readField(element, field)
    if (value === null || typeof value !== 'object') {
      if (!seen.some((entry) => entry === value)) seen.push(value)
    }
  }
  return seen
}

/**
 * A resolved value, short enough to sit at the end of a row.
 *
 * Strings keep their quotes so `"42.5"` is distinguishable from `42.5` — which is
 * the difference between a value the server can read as a number and one it cannot.
 */
export function formatResolved(value) {
  if (value === undefined) return '—'
  if (value === null) return 'null'
  if (typeof value === 'string') return `"${value}"`
  if (typeof value === 'object') {
    const json = JSON.stringify(value)
    return json.length > 60 ? `${json.slice(0, 57)}…` : json
  }
  return String(value)
}

/** Whether a node can be descended into at all. */
export const isBranch = (value) => value !== null && typeof value === 'object'
