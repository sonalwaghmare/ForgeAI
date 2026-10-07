import { get, post, put } from '@/services/http'
import { endpoints } from '@/services/endpoints'

/**
 * Tasks — the shift's own work list.
 *
 * DEMO. Fixture-backed today; see `src/mocks/fixtures/home.js`.
 *
 * A task is not a work order. A work order is a maintenance record that lives in
 * the CMMS and gets written back to SAP; a task is what one person has to get
 * done this shift, and several of them are *about* a work order without being
 * one. Keeping them apart is why this is its own resource rather than a filter
 * on `/work-orders`.
 */

/** The four statuses, in lifecycle order. Written out because the UI offers them
    as a closed set and a typo here would render an unlabelled row. */
export const TASK_STATUSES = ['open', 'inProgress', 'done']

/** Severity ladder, matching the anomaly one so a Critical badge means Critical
    wherever it appears. */
export const TASK_PRIORITIES = ['critical', 'high', 'medium', 'low']

/**
 * The list, plus the option sets a create form needs.
 *
 * People and assets ride along with the collection rather than having endpoints
 * of their own. They are six rows each and are only ever read to fill two
 * selects — two extra round trips to populate a dropdown is a slower form for no
 * gain. If either grows into a real directory it gets its own path.
 */
export async function fetchTasks(signal) {
  const body = await get(endpoints.tasks.list, { signal })
  return {
    items: body?.items ?? [],
    people: body?.people ?? [],
    assets: body?.assets ?? [],
    // Who "assigned to me" means, as an id. The server decides this, not the
    // client: the signed-in account and the demo persona are not the same thing.
    self: body?.self ?? null,
  }
}

export const createTask = (task) => post(endpoints.tasks.list, task)

/**
 * Full replace, not a patch.
 *
 * Matches every other update in this codebase and the API's own convention: it
 * has no partial-patch semantics anywhere except anomalies, so a task edit sends
 * the whole updatable record.
 */
export const updateTask = (taskId, task) => put(endpoints.tasks.detail(taskId), task)
