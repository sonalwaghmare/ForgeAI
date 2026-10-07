import { del, get, post, put } from '@/services/http'
import { endpoints } from '@/services/endpoints'

/**
 * Asset classes — the account's library of reusable types.
 *
 * A class is a template, not a thing on the plant floor: a machine model, a
 * line configuration, a site blueprint, a sensor type. Plant, Line and Machine
 * each carry a nullable `asset_class_id`, so the hierarchy holds the instances
 * and this holds what they are instances of.
 *
 * This is a LIVE endpoint. Everything here is a real write against a real
 * database, which is why the shape is pinned to the server's contract in one
 * place rather than assumed at four call sites.
 */

/**
 * The wire enum, in the API's own order.
 *
 * These four strings travel over the network and are validated server-side
 * against a Postgres enum. They are never translated, never reordered and never
 * extended from here — a fifth value has to exist in the database first.
 */
export const ENTITY_TYPES = ['plant', 'line', 'machine', 'sensor']

/** Longest name the `name` column accepts. Mirrored on the form so 150 characters fails in the browser rather than at the server. */
export const NAME_MAX_LENGTH = 150

/**
 * Wire → app.
 *
 * The API is snake_case and this codebase is camelCase, so the boundary is
 * here and nothing above it needs to know either fact. `id` is a UUID string
 * and stays opaque — it is never parsed, formatted or displayed.
 *
 * @param {{id: string, name: string, entity_type: string}} row
 */
const toAssetClass = (row) => ({
  id: row.id,
  name: row.name,
  entityType: row.entity_type,
})

/** @returns {Promise<{items: Array<{id: string, name: string, entityType: string}>}>} */
export async function fetchAssetClasses(signal) {
  const data = await get(endpoints.assetClasses.list, { signal })
  return { items: (data?.items ?? []).map(toAssetClass) }
}

/** @param {{name: string, entityType: string}} input */
export async function createAssetClass({ name, entityType }) {
  const row = await post(endpoints.assetClasses.list, {
    name: name.trim(),
    entity_type: entityType,
  })
  return toAssetClass(row)
}

/**
 * Rename only. The server's update schema accepts `name` and nothing else, so
 * `entity_type` is fixed at creation — a class cannot change what tier of thing
 * it describes, and the form says so rather than offering a control that would
 * be silently discarded.
 *
 * @param {{id: string, name: string}} input
 */
export async function renameAssetClass({ id, name }) {
  const row = await put(endpoints.assetClasses.detail(id), { name: name.trim() })
  return toAssetClass(row)
}

/**
 * Soft delete. The row survives with `deleted_at` set and drops out of every
 * listing, so anything already pointing at this class keeps a reference that
 * still resolves — removing a class does not reach into the hierarchy and
 * unassign it.
 */
export async function deleteAssetClass(id) {
  await del(endpoints.assetClasses.detail(id))
  return { id, deleted: true }
}
