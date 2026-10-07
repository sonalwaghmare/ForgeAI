import { del, get, patch, post } from '@/services/http'
import { endpoints } from '@/services/endpoints'

/**
 * Work Orders.
 *
 * DEMO. See `DEMO-MODE.md` §8.7.
 *
 * ── This is the seam ──────────────────────────────────────────────────────
 * The enums below are exported from here and imported by the fixture, never the
 * other way round — a page that reached into `mocks/` would bundle the demo
 * layer into production. `features/operations/api.js` also reads this endpoint
 * for the public page's summary; the two coexist and share a cache entry.
 */

/**
 * The board's columns, in order.
 *
 * `onHold` sits between `inProgress` and `completed` on the board because that
 * is where work lands when it stalls, but nothing ADVANCES into it — see
 * `nextState` on the record, which the server computes.
 */
export const WO_STATES = [
  'draft',
  'pendingApproval',
  'approved',
  'inProgress',
  'onHold',
  'completed',
]

export const WO_PRIORITIES = ['urgent', 'high', 'medium', 'low']

/** Who raised it. Not a field a person may set — see `createWorkOrder`. */
export const WO_SOURCES = ['ai', 'human']

/** The two views. Both are the same collection; only the layout differs. */
export const WO_VIEWS = ['board', 'table']

/**
 * Wire → app.
 *
 * `title` is either an i18n key (the two orders Forge AI drafted, which are
 * product copy and identical on every demo) or free text somebody typed. The
 * renderer resolves it with `defaultValue`, so neither is wrong. `titleText` is
 * the raw string, which is what search matches on.
 */
const toOrder = (row) => ({
  id: row.id,
  title: row.title,
  titleText: row.titleText ?? row.title,
  state: row.state,
  priority: row.priority,
  authoredBy: row.authoredBy,
  assigneeId: row.assigneeId ?? null,
  assigneeName: row.assigneeName ?? null,
  assetId: row.assetId,
  assetName: row.assetName,
  assetCode: row.assetCode,
  lineId: row.lineId,
  lineName: row.lineName,
  siteId: row.siteId,
  dueAt: row.dueAt,
  dueInDays: row.dueInDays,
  overdue: Boolean(row.overdue),
  open: Boolean(row.open),
  estimateHours: row.estimateHours,
  windowStart: row.windowStart,
  parts: row.parts ?? [],
  gates: row.gates ?? [],
  blockedByParts: row.blockedByParts ?? [],
  writeBack: row.writeBack ?? null,
  alert: row.alert ?? null,
  alertId: row.alertId ?? null,
  // Resolved server-side against the state machine, so the board and the detail
  // panel cannot offer different moves for one order.
  nextState: row.nextState ?? null,
  canHold: Boolean(row.canHold),
  created: Boolean(row.created),
})

/**
 * The collection.
 *
 * `paged: false` is what the board asks for — a kanban showing cards 26 to 50
 * of a backlog is not a kanban, the same reason the floor map is unpaginated.
 * The table pages.
 *
 * @param {{
 *   state?: string, priority?: string, assigneeId?: string, source?: string,
 *   q?: string, page?: number, pageSize?: number, paged?: boolean,
 * }} params
 */
export async function fetchWorkOrders(params, signal) {
  const data = await get(endpoints.workOrders.list, { signal, params })
  return {
    items: (data?.items ?? []).map(toOrder),
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    pageSize: data?.pageSize ?? 25,
    columns: data?.columns ?? {},
    stats: data?.stats ?? { open: 0, ai: 0 },
    options: data?.options ?? { assignees: [], assets: [] },
  }
}

/** One order. */
export async function fetchWorkOrder(id, signal) {
  return toOrder(await get(endpoints.workOrders.detail(id), { signal }))
}

/**
 * Raise one.
 *
 * `authoredBy` is deliberately NOT in the payload. The prototype's form has
 * Source as a select with AI in it, so a person can mark their own order
 * AI-generated — but provenance is recorded, not chosen, and the AI badge on
 * this board means Forge AI drafted the order. The server sets it to `human`.
 *
 * Neither is `state`: a new order starts as a draft and moves through the
 * workflow. The prototype's form lets you create one directly as Completed.
 */
export async function createWorkOrder({
  title,
  assetId,
  priority,
  assigneeId,
  dueInDays,
  estimateHours,
  alertId,
}) {
  return toOrder(
    await post(endpoints.workOrders.create, {
      title,
      assetId,
      priority,
      assigneeId: assigneeId || null,
      dueInDays,
      estimateHours,
      alertId: alertId || null,
    }),
  )
}

/**
 * Edit the fields a form owns. Not the state — see `advanceWorkOrder`.
 *
 * PATCH rather than PUT: the two acts touch different fields and a full replace
 * would make the board's Move button send a whole order back to change one word.
 */
export async function updateWorkOrder({ id, ...fields }) {
  return toOrder(await patch(endpoints.workOrders.detail(id), fields))
}

/**
 * Move an order along the workflow.
 *
 * The server validates the transition and answers 422 for one the workflow does
 * not allow, so a draft cannot be marked complete without being approved. That
 * check lives there and not here because a client-side guard is a courtesy and
 * a server-side one is the rule.
 */
export async function advanceWorkOrder({ id, state }) {
  return toOrder(await patch(endpoints.workOrders.detail(id), { state }))
}

/** Remove one. */
export async function deleteWorkOrder(id) {
  await del(endpoints.workOrders.detail(id))
  return { id, deleted: true }
}
