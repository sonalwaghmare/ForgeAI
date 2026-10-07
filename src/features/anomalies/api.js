import { get, patch, post } from '@/services/http'
import { endpoints } from '@/services/endpoints'

/**
 * Anomalies — the real detection records.
 *
 * ── What the API actually carries, and nothing more ────────────────────────
 * This is the whole of a list row:
 *
 *   id, severity, status, serial_number, title, created_at, hierarchy{plant,line,machine}
 *
 * That is worth stating plainly because the design prototype for this screen
 * shows a great deal more — a reading against a threshold, a fusion score, an
 * assignee, a work order, a due date, per-sensor trend charts. None of it has a
 * field here. `features/alerts/api.js` describes those because it reads
 * FIXTURES; this reads the server. Nothing in this module may synthesise a
 * value the endpoint did not send.
 *
 * The detail read (`AnomalyOut`) adds five timestamps and no new dimensions:
 * `detected_at`, `window_start`, `window_end`, `last_detected_at`, `updated_at`.
 *
 * ── Counts arrive with the list, not from a counts endpoint ────────────────
 * `GET /anomalies` embeds `counts.status` and `counts.severity`. Their scope is
 * NOT the scope of the rows beside them, and that asymmetry is deliberate
 * server-side: the counts respect only the `created_from`/`created_to` range,
 * while status/severity/plant/line/machine narrow the rows alone. So the facet
 * tiles describe the whole date-scoped set and keep their numbers when you
 * filter — which is what makes them usable as filters. Anything on screen that
 * implies otherwise would be lying.
 */

/**
 * `sort_by` accepts exactly these three, and `sort_dir` exactly two.
 *
 * Mirrors `Literal["created_at", "severity", "status"]` and
 * `Literal["asc", "desc"]` in the router signature. Written out because they are
 * a closed contract the endpoint rejects deviation from with a 422 — the same
 * reason `VALUE_TYPES` is written out in the sensors module. Everything that
 * varies by DATA (which statuses exist, which severities, how many of each) is
 * read from the response instead; see `toCounts`.
 */
/**
 * `AnomalyStatus`, in the order the backend declares it — which is also the
 * lifecycle order, and what Postgres sorts an enum column by.
 *
 * Written out for the same reason `SORT_FIELDS` is: it is a request contract the
 * endpoint rejects deviation from, not data it reports.
 *
 * **This is the wire enum and it is deliberately still complete.** The product no
 * longer offers `escalated` or `resolved` (see `RETIRED_STATUSES`), but the server
 * still declares them, still returns them in `counts.status`, and still holds rows
 * in them — so anything that RENDERS a status must keep handling all five. Trimming
 * this list would not remove those rows; it would only make them render as an
 * unlabelled hole.
 */
export const ANOMALY_STATUSES = ['open', 'acknowledged', 'escalated', 'resolved', 'dismissed']

/**
 * The lifecycle the product actually offers, and the two states it withdrew.
 *
 * ── What changed, and what did not ────────────────────────────────────────
 * An anomaly is now `open` on arrival and moves in exactly two ways: a person
 * dismisses it, or somebody approves its analysis and it becomes `acknowledged`.
 * `escalated` and `resolved` are no longer reachable from this UI — they were two
 * more items in a five-item menu and neither had an owner, a rule or a consequence
 * attached to it.
 *
 * The backend is unchanged. `PATCH /anomalies/{id}` still accepts all five, the enum
 * still has five members, and `counts.status` still reports on all of them. So these
 * two are **withdrawn from the interface, not deleted from the system** — which is
 * why the list hides their facet tiles but still renders a row that is in one of
 * them, correctly labelled. A row the product can no longer produce is still a row
 * somebody has to be able to read.
 */
export const OFFERED_STATUSES = ['open', 'acknowledged', 'dismissed']
export const RETIRED_STATUSES = ['escalated', 'resolved']

/**
 * The statuses the facet row always shows, in lifecycle order.
 *
 * ── Why a list exists at all, when `counts.status` is read as data ────────
 * Because the server omits what it has none of. `counts.status` is a `GROUP BY`,
 * not a walk of the enum, so a status with no rows is not a zero — it is an absent
 * key, and a tile built only from what arrived disappears the moment the queue it
 * describes empties. Escalated went missing exactly that way: nothing was
 * escalated, so there was no tile, so there was no way to see that nothing was
 * escalated. An empty queue is a fact worth stating; a missing tile is not.
 *
 * `resolved` is not here on purpose — it is withdrawn from this interface, and
 * zero-filling it would put it back.
 *
 * This does NOT replace reading the response. `statusFacets` unions the two, so a
 * sixth status the backend adds tomorrow still appears on its own without a
 * release here — which was the whole reason the counts were read as data, and is
 * the property a hardcoded tile list would have thrown away.
 */
export const COUNTED_STATUSES = ['open', 'acknowledged', 'escalated', 'dismissed']

/**
 * `counts.status` → the tiles to draw.
 *
 * The known lifecycle first, zero-filled and in its own order, then anything else
 * the server reported that this client has never heard of. Nothing is dropped
 * except what the caller drops: `resolved` arrives here and the page removes it,
 * so the one place that decides what is withdrawn stays the one place.
 *
 * @param {Array<{key: string, count: number}>} counts as `toCounts` produces them
 */
export function statusFacets(counts = []) {
  const reported = new Map(counts.map((entry) => [entry.key, entry.count]))

  return [
    ...COUNTED_STATUSES.map((key) => ({ key, count: reported.get(key) ?? 0 })),
    ...counts.filter((entry) => !COUNTED_STATUSES.includes(entry.key)),
  ]
}

export const SORT_FIELDS = ['created_at', 'severity', 'status']
export const SORT_DIRECTIONS = ['asc', 'desc']

export const DEFAULT_SORT_FIELD = 'created_at'
export const DEFAULT_SORT_DIRECTION = 'desc'

/** `page_size: int = Query(default=50, ge=1, le=200)`. A 422 above the ceiling. */
export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 200

/**
 * Naive UTC → an instant the browser can localise.
 *
 * Every timestamp this API returns is `DateTime(timezone=False)` written by
 * `models/base.utcnow()`, so `"2026-08-11T10:21:06.649161"` is UTC with the
 * designator omitted. `new Date()` reads a bare string like that as LOCAL time,
 * which silently shifts every value by the reader's offset — five and a half
 * hours in IST, and in the wrong direction: a detection from this morning would
 * read as this afternoon, and `formatRelative` would call it "in 5 hours".
 *
 * So the designator is restored before parsing. Guarded rather than
 * unconditional, because the day the backend starts sending offsets this must
 * not append a second one and produce an Invalid Date.
 */
export function toInstant(value) {
  if (typeof value !== 'string' || value === '') return null
  // A trailing Z, or ±HH:MM after the time portion — not the date's own hyphens.
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`
}

/**
 * Wire → app.
 *
 * `hierarchy` is carried through as the server's own shape rather than being
 * flattened here: the server resolves the names for whichever level the anomaly
 * attached to and leaves the deeper ones null, so `{plant, line, machine}` with
 * holes in it IS the record. Which level is populated is the fact the screen
 * renders — see `hierarchyTrail`.
 *
 * `severity` and `status` are passed through untranslated and unmapped. There is
 * no client-side vocabulary to convert them into: `common:status.acknowledged`
 * is keyed on the wire value, so a status the backend adds tomorrow reaches the
 * screen without a release here.
 */
const toAnomaly = (row) => ({
  id: row.id,
  severity: row.severity,
  status: row.status,
  serialNumber: row.serial_number,
  title: row.title,
  createdAt: toInstant(row.created_at),
  hierarchy: {
    plant: row.hierarchy?.plant ?? null,
    line: row.hierarchy?.line ?? null,
    machine: row.hierarchy?.machine ?? null,
  },
  /**
   * How far the root-cause analysis has got, on the LIST item.
   *
   * Server-derived rather than stored: `rca_status=rca.status if rca else
   * AnomalyRcaStatus.pending`. So `pending` means no RCA row exists at all — the
   * same state `GET .../rca` expresses as a 404 — and the list can show it
   * without a second request per row.
   *
   * Defaulted here anyway. The field is required on `AnomalyListItem`, but a
   * cached response from before it shipped would leave the card with `undefined`
   * and no badge, which reads as a rendering bug rather than as stale data.
   */
  rcaStatus: row.rca_status ?? 'pending',
})

/**
 * The detail read. Same record, five more timestamps — and one field LESS.
 *
 * ── `AnomalyOut` does not carry `rca_status`. `AnomalyListItem` does ───────
 * The two schemas share `AnomalyBase`, and `rca_status` was added to the LIST item
 * only. So `GET /anomalies/{id}` and `PATCH /anomalies/{id}` never report it, and
 * `rcaStatus` on anything this function returns is the `?? 'pending'` fallback in
 * `toAnomaly` rather than a fact.
 *
 * Nothing here can fix that, and nothing should pretend to. What it means for
 * callers: **on a detail screen, read the RCA status from `GET .../rca`, never from
 * the anomaly record.** `AnomalyDetailPage` does, and says so at the point of use.
 * Written up in BACKEND-GAPS.md.
 */
const toAnomalyDetail = (row) => ({
  ...toAnomaly(row),
  detectedAt: toInstant(row.detected_at),
  windowStart: toInstant(row.window_start),
  windowEnd: toInstant(row.window_end),
  lastDetectedAt: toInstant(row.last_detected_at),
  updatedAt: toInstant(row.updated_at),
})

/**
 * The facet counts, read as DATA rather than against a known list of keys.
 *
 * `Object.entries` over what the server sent, in the order it sent it. That is
 * the whole point: `AnomalyStatus` has five members today and the design this
 * screen is built from wants a sixth (`snoozed`), so a hardcoded tile list would
 * be wrong the day it lands — silently, by omitting a tile whose count was
 * never zero. Iterating the response means the new facet appears on its own.
 *
 * Insertion order survives `JSON.parse`, and the server builds both dicts by
 * walking its enum, so this order IS the backend's declared order. Nothing here
 * re-sorts it — a severity ranking invented client-side would be exactly the
 * kind of hardcoding this module exists to avoid.
 *
 * @returns {Array<{key: string, count: number}>}
 */
const toCounts = (group) =>
  Object.entries(group ?? {}).map(([key, count]) => ({ key, count: Number(count) || 0 }))

/**
 * One page of anomalies, with the facet counts that came with it.
 *
 * Every parameter is omitted when unset rather than sent as null: FastAPI's
 * `Query(default=None)` treats an absent key as "no filter", and an explicit
 * empty string would be parsed against the enum and rejected with a 422.
 *
 * @param {{
 *   status?: string, severity?: string, rcaStatus?: string,
 *   plantId?: string, lineId?: string, machineId?: string,
 *   createdFrom?: string, createdTo?: string,
 *   sortBy?: string, sortDir?: string, page?: number, pageSize?: number,
 * }} filters
 */
export async function fetchAnomalies(filters, signal) {
  const data = await get(endpoints.anomalies.list, {
    signal,
    params: toParams(filters),
  })

  return {
    items: (data?.items ?? []).map(toAnomaly),
    // Echoed back rather than assumed from what was asked for, so a clamped or
    // defaulted page moves the footer instead of being contradicted by it.
    page: data?.page ?? filters.page,
    pageSize: data?.page_size ?? filters.pageSize,
    total: data?.total ?? 0,
    totalPages: data?.total_pages ?? 0,
    statusCounts: toCounts(data?.counts?.status),
    severityCounts: toCounts(data?.counts?.severity),
  }
}

/**
 * App filters → the query string the endpoint declares.
 *
 * snake_case on the wire, and empty values dropped entirely. Written out one key
 * at a time rather than looped over a mapping, because a silent typo in a
 * camelCase key would be ignored by FastAPI: the server would answer the
 * unfiltered page 1 and the screen would show the wrong rows under the right
 * chips. Same hazard `features/sensors/api.js` documents for `page_size`.
 */
function toParams({
  status,
  severity,
  rcaStatus,
  plantId,
  lineId,
  machineId,
  createdFrom,
  createdTo,
  sortBy,
  sortDir,
  page,
  pageSize,
}) {
  const params = {
    sort_by: sortBy || DEFAULT_SORT_FIELD,
    sort_dir: sortDir || DEFAULT_SORT_DIRECTION,
    page: page || 1,
    page_size: pageSize || DEFAULT_PAGE_SIZE,
  }
  if (status) params.status = status
  if (severity) params.severity = severity
  if (rcaStatus) params.rca_status = rcaStatus
  if (plantId) params.plant_id = plantId
  if (lineId) params.line_id = lineId
  if (machineId) params.machine_id = machineId
  if (createdFrom) params.created_from = createdFrom
  if (createdTo) params.created_to = createdTo
  return params
}

/** One anomaly. */
export async function fetchAnomaly(id, signal) {
  return toAnomalyDetail(await get(endpoints.anomalies.detail(id), { signal }))
}

/**
 * Update. The only PATCH in this API, and genuinely partial.
 *
 * `AnomalyUpdate` declares `title`, `severity` and `status` all as
 * `X | None = None`, so an omitted key means "leave it" — unlike every PUT in
 * this codebase, where an omitted key means "clear it". A status change
 * therefore sends `{status}` alone and cannot disturb the title.
 *
 * Undefined fields are stripped for that reason. Sending `{title: undefined}`
 * would serialise to `{}` here, but sending `{title: null}` would reach Pydantic
 * as an explicit null — which validates, and which the router would then have to
 * decide about. Not sending the key is unambiguous.
 *
 * @param {{id: string, title?: string, severity?: string, status?: string}} input
 */
export async function updateAnomaly({ id, title, severity, status }) {
  const body = {}
  if (title !== undefined) body.title = title.trim()
  if (severity !== undefined) body.severity = severity
  if (status !== undefined) body.status = status

  return toAnomalyDetail(await patch(endpoints.anomalies.detail(id), body))
}

/**
 * Where one anomaly lives in the app.
 *
 * Here rather than in the page, so the card, the list and any future deep link
 * all build it from one place — the same reason `pages/dataFusion/sections.js`
 * holds its path builders. A route written twice is a route that gets renamed
 * once.
 */
export const anomalyPath = (id) => `/app/anomalies/${id}`

/**
 * DEMO. Facets the endpoint does not report, as the counts row wants them.
 *
 * Returned in the same `{key, count}` shape `toCounts` produces from
 * `counts.status`, so the tile row renders both from one code path and neither
 * knows which of the two it is holding. That is the seam: when the API starts
 * counting these, this function reads them off the list response instead and the
 * screen does not change.
 *
 * `snoozed` is a STATUS the enum does not have yet; `unassigned` is not a status
 * at all — it is the absence of an owner on a record that has no owner field. They
 * travel together only because both are missing, which is why neither is in
 * `ANOMALY_STATUSES` and neither may be sent as a filter.
 */
export async function fetchAnomalyDemoFacets(signal) {
  const data = await get(endpoints.anomalies.demoFacets, { signal })
  return (data?.facets ?? []).map((row) => ({ key: row.key, count: Number(row.count) || 0 }))
}

/* ══ ROOT-CAUSE ANALYSIS ═══════════════════════════════════════════════ */

/**
 * `AnomalyRcaStatus`, in the order the backend declares it — which is also the
 * lifecycle order.
 *
 *   pending   — never asked for (the request endpoint creates rows as `queued`,
 *                so a `pending` ROW is seed or fixture data, and `pending` is also
 *                what the list endpoint reports when no row exists at all)
 *   queued    — requested; `content` is still `{}` and nothing has generated it
 *   draft     — content exists, not yet approved
 *   approved  — content exists and has been signed off
 *   failed    — the request or the run itself failed; `last_error` says why
 *
 * Only `draft` and `approved` may be set through `PATCH .../rca`; a validator
 * rejects the others, because `queued` and `failed` are owned by the request
 * endpoint and the engine respectively.
 *
 * `failed` was missing from this list while rows were already landing in it — the
 * enum gained it with the RCA seam hardening. Anything that RENDERS a status has to
 * handle it, or a failed analysis shows as an unlabelled hole rather than as the
 * one state a user most needs to see.
 *
 * ── Filtering on these ────────────────────────────────────────────────────
 * `GET /anomalies?rca_status=` accepts every member. `pending` is the one worth
 * reading twice: the server derives the list item's `rca_status` as `rca.status if
 * rca else pending`, and the filter matches a missing row to suit — so asking for
 * `pending` asks for every anomaly nobody has investigated.
 */
export const RCA_STATUSES = ['pending', 'queued', 'draft', 'approved', 'failed']
export const RCA_SETTABLE_STATUSES = ['draft', 'approved']

const toRca = (row) => ({
  id: row.id,
  anomalyId: row.anomaly_id,
  // An opaque JSONB blob. No schema exists for it server-side, so nothing here
  // may assume a key — see `hasRcaContent`.
  content: row.content ?? {},
  status: row.status,
  createdAt: toInstant(row.created_at),
  updatedAt: toInstant(row.updated_at),
})

/**
 * One anomaly's RCA, or `null` when none has been requested.
 *
 * ── A 404 here is DATA, not a failure ─────────────────────────────────────
 * `AnomalyRca` rows are created by `POST .../rca/request` and by nothing else,
 * so an anomaly nobody has investigated has no row and this endpoint answers
 * `NotFoundError("RCA")` at 404. That is the overwhelmingly common case — every
 * anomaly starts there.
 *
 * Swallowed here rather than at the call site so there is exactly one place that
 * knows it. Letting it reach the query would put an error panel on the detail
 * screen of every new anomaly, and letting each screen special-case the status
 * code would mean the next screen forgets to.
 *
 * Only 404 is swallowed. A 500, a timeout or a 401 still throw, because those
 * genuinely are failures and the screen must say so.
 */
export async function fetchAnomalyRca(anomalyId, signal) {
  try {
    return toRca(await get(endpoints.anomalies.rca(anomalyId), { signal }))
  } catch (error) {
    if (error?.status === 404) return null
    throw error
  }
}

/**
 * Ask for an analysis. 202, and the row comes back in `queued`.
 *
 * Idempotent server-side — a second call returns the existing row with a
 * different message rather than failing — so the button does not need to guard
 * against a double press to stay correct.
 *
 * The body names who is asking. The server requires it and defaults nothing, so an
 * analysis requested from a screen and one requested through the copilot stay
 * distinguishable afterwards — a default would have quietly made every row look
 * like a screen.
 *
 * Worth knowing when reading the UI this drives: **nothing generates the content
 * yet.** The endpoint carries a standing note that the real trigger, and whatever
 * flips `queued` to `draft`, is still to be wired. So the honest post-request
 * state is "queued", and the screen says that rather than implying an analysis is
 * on its way in a minute.
 */
export async function requestAnomalyRca(anomalyId, requestedVia = 'ui') {
  return toRca(await post(endpoints.anomalies.rcaRequest(anomalyId), { requested_via: requestedVia }))
}

/**
 * What this app renders as structured RCA fields — `what_happened`,
 * `fault_domain`, `ranked_causes`, `ruled_out`, `data_gaps`.
 *
 * There is no list of them here any more, and that is the point of this note.
 *
 * ── There was one, and it drove an "Additional fields" card ────────────────
 * `content` is a bare JSONB column with no server-side schema, so anything the
 * model emits beyond those five keys was unknown to this client. It used to be
 * collected by `unknownRcaFields()` and dumped as JSON at the foot of the
 * analysis, on the reasoning that a value saved but invisible cannot be told
 * apart from one that was lost.
 *
 * That was the wrong trade. The generator is still being built and nothing
 * constrains the column, so the card's size is set by however much unmapped data
 * the API happens to return — which turns an occasional footnote into a wall of
 * JSON under a human-readable analysis. A reviewer reading a root cause is not
 * the person who needs to see the raw payload.
 *
 * ── Nothing is lost by removing it ─────────────────────────────────────────
 * That was the real worry, and it was already handled somewhere better.
 * `PATCH .../rca` replaces `content` **wholesale** — there is no merge
 * server-side — so an editor sending only the fields it renders would delete
 * every other key permanently on the first save. The editor spreads
 * `...rca.content` before its own five keys, which preserves the remainder
 * whether or not anything displays it. The card was never what kept the data;
 * the spread is. See `save()` in `AnomalyDetailPage`.
 *
 * The three keys the generator retired — `hypothesis`, a flat
 * `evidence_citations` array and a `confidence` float — are carried through the
 * same way. They are no longer shown, which is now true of every unmapped key
 * rather than a special case.
 */

/**
 * Likelihood values a ranked cause is expected to carry.
 *
 * Not an enum the server declares — nothing constrains this field — so an
 * unrecognised value is preserved and offered rather than coerced. See
 * `LikelihoodField`.
 */
export const LIKELIHOODS = ['high', 'medium', 'low']

/**
 * Update the analysis: its content, its status, or both.
 *
 * ── Genuinely partial, unlike the rest of this API ────────────────────────
 * `AnomalyRcaUpdate` declares `content: dict | None` and `status: ... | None`, so
 * an omitted key means "leave it". Approving therefore sends `{status}` alone and
 * cannot disturb a draft's text, and saving an edit sends `{content}` alone and
 * cannot flip the status out from under the reviewer.
 *
 * ── `status` is validated to two values ──────────────────────────────────
 * A field validator rejects anything but `draft` and `approved`: `pending` and
 * `queued` belong to the request endpoint and cannot be set here. Sending one
 * would come back 422 naming the field.
 *
 * @param {{anomalyId: string, content?: object, status?: 'draft'|'approved'}} input
 */
export async function updateAnomalyRca({ anomalyId, content, status }) {
  const body = {}
  if (content !== undefined) body.content = content
  if (status !== undefined) body.status = status

  return toRca(await patch(endpoints.anomalies.rca(anomalyId), body))
}

/**
 * Whether an RCA row actually carries an analysis.
 *
 * `status` alone cannot answer this: a `queued` row exists with `content: {}`,
 * and `content` is a schemaless JSONB column, so the only honest test is whether
 * there are any keys in it. Checked rather than assumed because the difference
 * decides between rendering an analysis and rendering "queued" — and an empty
 * object rendered as an analysis is a blank panel with a heading over it.
 */
export function hasRcaContent(rca) {
  return Boolean(rca?.content && Object.keys(rca.content).length > 0)
}

/**
 * Whether an analysis has been asked for at all.
 *
 * Two shapes mean the same thing and both have to be handled: no row (the endpoint
 * 404s, `fetchAnomalyRca` returns `null`) and a row sitting at `pending`. The
 * request endpoint only ever creates rows as `queued`, so a `pending` row is one
 * nobody has started — seeded or fixture data — and it is NOT work in progress.
 */
export function awaitsRcaRequest(rca) {
  return !rca || rca.status === 'pending'
}

/**
 * Requested, and still running. The one state the radar belongs to.
 *
 * `queued` is the whole test, plus the content guard for the case where generation
 * has landed but nothing has moved the status off `queued` yet — content on screen
 * beats a spinner over it. `pending` deliberately does not qualify: a screen that
 * shows a sweeping radar over a row nobody has requested is claiming the server is
 * working when it has not been asked to.
 */
export function isRcaRunning(rca) {
  return rca?.status === 'queued' && !hasRcaContent(rca)
}

/**
 * The hierarchy, as the segments to draw.
 *
 * Nulls dropped, order preserved: an anomaly raised at the plant yields one
 * segment, one raised at a machine yields three. The deepest present segment is
 * the level it attached to, which is why the caller renders the last one at full
 * strength and the rest dim — the same treatment the sensors table gives a
 * parent trail.
 *
 * Returns an empty array rather than a placeholder when every level is null. The
 * screen states that as an absence; it must not invent "Unknown".
 *
 * @returns {string[]}
 */
export function hierarchyTrail(hierarchy) {
  return [hierarchy?.plant, hierarchy?.line, hierarchy?.machine].filter(Boolean)
}
