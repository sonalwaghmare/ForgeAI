import { del, get, post, put } from '@/services/http'
import { flattenHierarchy } from './flatten'
import { endpoints } from '@/services/endpoints'

/**
 * The editable asset hierarchy, against the live API.
 *
 * ── One request for the tree, one more per form ──────────────────────────
 * This read the five collections alongside `/asset-hierarchy` for as long as that
 * endpoint carried only `{id, name}` per node. It now carries `short_code` at
 * every level, which was the only thing the collections were still supplying to
 * the tree, so the list is one call and `flatten.js` reshapes it.
 *
 * The two fields the tree still does not serve are `is_active` and
 * `asset_class_id`, and both are load-bearing: every update here is a
 * full-replace PUT, so a form that never received them would switch the record
 * off and unassign its class on save. They are read per record by `fetchNode`,
 * when a form actually opens — one request against a form, rather than five
 * against a page.
 *
 * ── One shape, two vocabularies ──────────────────────────────────────────
 * The API names its tiers after the backend model: region › subregion › plant ›
 * line › machine. This product calls the same tiers region › sub-region › site ›
 * production line › asset, and every other screen already does. The mapping
 * lives in TIER_RESOURCE below and nowhere else; above this file the app speaks
 * its own vocabulary, and the wire value is never translated.
 */

/** Ordered. `TIERS[n + 1]` is what may be added beneath a `TIERS[n]`. */
export const TIERS = ['enterprise', 'region', 'subRegion', 'site', 'line', 'asset']

export const childTierOf = (tier) => TIERS[TIERS.indexOf(tier) + 1] ?? null

/**
 * The account is the root, and it has no endpoint — not to create, rename or
 * remove. This id is a client-side sentinel, deliberately not shaped like the
 * UUIDs the server mints, so it can never be mistaken for one and sent back.
 */
export const ROOT_ID = '__account__'

/** Product tier → API resource, and the field naming its parent. */
const TIER_RESOURCE = {
  region: { collection: 'regions', detail: 'region', parentField: null },
  subRegion: { collection: 'subRegions', detail: 'subRegion', parentField: 'region_id' },
  site: { collection: 'plants', detail: 'plant', parentField: 'subregion_id' },
  line: { collection: 'lines', detail: 'line', parentField: 'plant_id' },
  asset: { collection: 'machines', detail: 'machine', parentField: 'line_id' },
}

/**
 * Tiers whose record carries an asset class. The server requires the field on
 * every update of these three — it has no default — so a form that omitted it
 * would not fail loudly, it would 422; and a form that sent null would wipe a
 * real assignment on an unrelated rename.
 */
export const TIERS_WITH_ASSET_CLASS = new Set(['site', 'line', 'asset'])

/** Product tier → the asset-class `entity_type` that may be assigned to it. */
export const ENTITY_TYPE_FOR_TIER = { site: 'plant', line: 'line', asset: 'machine' }

/** Longest `name` and `short_code` the columns accept. */
export const NAME_MAX_LENGTH = 150
export const CODE_MAX_LENGTH = 50

/**
 * Wire → app. One node shape for all five tiers, so the tree stays a single
 * recursive component rather than five near-identical ones.
 */
const toNode = (tier, parentField) => (row) => ({
  id: row.id,
  tier,
  parentId: parentField ? row[parentField] : ROOT_ID,
  name: row.name,
  code: row.short_code,
  isActive: row.is_active,
  assetClassId: row.asset_class_id ?? null,
})

/**
 * The whole hierarchy as one flat list, plus the account it belongs to.
 *
 * ── One request, not six ──────────────────────────────────────────────────
 * This used to fetch `/asset-hierarchy` for the account's own name and then all
 * five collections alongside it, purely because the tree did not carry
 * `short_code`. It does now, at every level, so the five collection reads have
 * nothing left to contribute and the nested response is flattened here instead.
 *
 * Flat rather than nested for the same reason the fixture was: the tree shape is
 * derived per screen, and every mutation is a single-node write rather than a
 * recursive patch.
 *
 * ── What the tree does NOT carry ──────────────────────────────────────────
 * `is_active` and `asset_class_id`. Both were coming from the collection reads.
 * `isActive` is therefore `null` — unknown, not false — and consumers must test
 * for `=== false` rather than falsiness, or every node reads as out of service.
 * Anything that needs the real values reads the node itself: see `fetchNode`.
 */
export async function fetchHierarchyNodes(signal) {
  const tree = await get(endpoints.hierarchy.tree, { signal })
  return {
    items: flattenHierarchy(tree, ROOT_ID),
    account: { name: tree?.name ?? '', alias: tree?.alias ?? '' },
  }
}

/**
 * One node, read on its own.
 *
 * The tree endpoint carries `id`, `name` and `short_code` and nothing else, so an
 * edit form built from it would prefill `is_active` and `asset_class_id` as blanks
 * — and every update in this API is a FULL REPLACE, so saving would then switch
 * the record off and unassign its asset class without anyone asking for either.
 *
 * So the editor reads the record it is about to overwrite. One request, opened
 * only when a form opens, against endpoints that already exist for all five tiers.
 */
export async function fetchNode({ tier, id }, signal) {
  const { detail, parentField } = TIER_RESOURCE[tier]
  const row = await get(endpoints.hierarchy[detail](id), { signal })
  return toNode(tier, parentField)(row)
}

/**
 * App → wire.
 *
 * `asset_class_id` is included only for the tiers that have the column, and is
 * sent even when null — the update schemas require the key to be present, and
 * omitting it is a 422 rather than a no-op.
 */
function toBody(tier, { name, code, isActive, assetClassId }) {
  return {
    name: name.trim(),
    short_code: code.trim(),
    is_active: isActive,
    ...(TIERS_WITH_ASSET_CLASS.has(tier) ? { asset_class_id: assetClassId || null } : {}),
  }
}

/** @param {{parentTier: string, parentId: string, values: object}} input */
export async function createNode({ parentTier, parentId, values }) {
  const tier = childTierOf(parentTier)
  const { collection, parentField } = TIER_RESOURCE[tier]
  const row = await post(endpoints.hierarchy[collection], {
    ...(parentField ? { [parentField]: parentId } : {}),
    ...toBody(tier, values),
  })
  return toNode(tier, parentField)(row)
}

/**
 * A full replace, not a patch. The API has no partial-update semantics
 * anywhere, so the caller sends every editable field every time — which is also
 * why the form is populated from the record rather than starting empty.
 */
export async function updateNode({ tier, id, values }) {
  const { detail, parentField } = TIER_RESOURCE[tier]
  const row = await put(endpoints.hierarchy[detail](id), toBody(tier, values))
  return toNode(tier, parentField)(row)
}

/**
 * Soft delete, and it does NOT cascade or refuse.
 *
 * The server marks this one row deleted and stops there. Its children keep
 * `deleted_at` null and — because the collection queries filter the child's own
 * deleted flag but not its parent's — remain listed, now orphaned under a parent
 * that no longer exists. That is why the screen refuses to remove a branch that
 * still has anything in it: the guard is the client's, and it is the only one.
 */
export async function deleteNode({ tier, id }) {
  const { detail } = TIER_RESOURCE[tier]
  await del(endpoints.hierarchy[detail](id))
  return { id, deleted: true }
}
