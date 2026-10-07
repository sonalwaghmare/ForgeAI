import { TIERS } from './api'

/**
 * Resolving a sensor's parent out of the flat hierarchy node list.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * `useHierarchyNodes()` returns one flat array covering all five tiers, each node
 * carrying only `{id, tier, parentId, name, code}`. Nothing in the app turned that
 * into "which site does this line belong to" or "Findlay · Line 1 · Bodymaker 3" —
 * `AlertCard` hand-writes its own `line · asset · component` string from
 * denormalised fixture fields, and the hierarchy tree in Settings derives depth
 * from recursion and keeps no ancestry at all.
 *
 * A sensor needs both directions. Going down: the cascading picker needs the lines
 * under a site and the assets under a line. Going up: the table's "Attached to"
 * column receives `machine_id` and nothing else, and a bare machine name is
 * ambiguous across regions — two plants can both have a "Bodymaker 3".
 *
 * ── Vocabulary ───────────────────────────────────────────────────────────
 * Product tiers are `site` / `line` / `asset`; the API calls the same three
 * `plant` / `line` / `machine`, and `Sensor` stores them as `plant_id` / `line_id`
 * / `machine_id`. The mapping is stated once, here, and the wire names are never
 * translated. Same split `features/hierarchy/api.js` documents for `TIER_RESOURCE`.
 */

/** The three tiers a sensor may attach to, outermost first. */
export const SENSOR_PARENT_TIERS = ['site', 'line', 'asset']

/** Product tier → the `Sensor` column that carries it. */
export const PARENT_FIELD = {
  site: 'plant_id',
  line: 'line_id',
  asset: 'machine_id',
}

/** Product tier → the icon used for it everywhere a parent is shown. */
export const PARENT_ICON = {
  site: 'factory',
  line: 'conveyor',
  asset: 'machine',
}

/**
 * Which parent a sensor is actually attached to.
 *
 * The API guarantees exactly one of the three is set (`SensorCreate`'s
 * `exactly_one_parent` validator), but this reads defensively in tier order and
 * returns null rather than throwing: a record that somehow carries none is a row
 * the table still has to draw.
 *
 * @param {{plantId: ?string, lineId: ?string, machineId: ?string}} sensor
 * @returns {{tier: string, id: string}|null}
 */
export function parentOf(sensor) {
  if (sensor?.plantId) return { tier: 'site', id: sensor.plantId }
  if (sensor?.lineId) return { tier: 'line', id: sensor.lineId }
  if (sensor?.machineId) return { tier: 'asset', id: sensor.machineId }
  return null
}

/**
 * The exactly-one-of-three payload fragment.
 *
 * All three keys are always present — two of them null. The server's validator
 * counts non-null values (`sum(p is not None for p in parents) != 1`), so an
 * omitted key and an explicit null are equivalent to it; sending all three keeps
 * the request shape identical between create and update and makes the "exactly
 * one" rule visible in the payload rather than implied by what is missing.
 *
 * @param {?{tier: string, id: string}} parent
 */
export function parentFields(parent) {
  const fields = { plant_id: null, line_id: null, machine_id: null }
  if (parent?.tier && parent?.id) fields[PARENT_FIELD[parent.tier]] = parent.id
  return fields
}

/** Nodes of one tier, sorted the way the reader's locale sorts them. */
function tierNodes(nodes, tier, parentId, language) {
  return (nodes ?? [])
    .filter((node) => node.tier === tier && (parentId == null || node.parentId === parentId))
    .sort((a, b) => a.name.localeCompare(b.name, language))
}

/** Every site on the account. */
export const sitesOf = (nodes, language) => tierNodes(nodes, 'site', null, language)

/** The lines under one site. Empty when `siteId` is falsy — nothing chosen yet. */
export const linesOf = (nodes, siteId, language) =>
  siteId ? tierNodes(nodes, 'line', siteId, language) : []

/** The assets under one line. Empty when `lineId` is falsy. */
export const assetsOf = (nodes, lineId, language) =>
  lineId ? tierNodes(nodes, 'asset', lineId, language) : []

/**
 * A node's ancestry, expressed as the three cascade selections that reach it.
 *
 * This is what lets the edit form prefill: the sensor stores one id at one tier,
 * and the picker needs all three levels populated to render the path that leads
 * there. An asset yields all three, a line yields two, a site yields one.
 *
 * Returns nulls rather than throwing when a link is broken — deletion is soft
 * everywhere in this API and nothing cascades, so a sensor can outlive the line
 * its machine belonged to.
 *
 * @returns {{siteId: ?string, lineId: ?string, assetId: ?string}}
 */
export function cascadeFor(nodes, parent) {
  const empty = { siteId: null, lineId: null, assetId: null }
  if (!parent?.id) return empty

  const byId = new Map((nodes ?? []).map((node) => [node.id, node]))
  const node = byId.get(parent.id)
  if (!node) return empty

  if (node.tier === 'site') return { ...empty, siteId: node.id }

  if (node.tier === 'line') {
    return { ...empty, siteId: byId.get(node.parentId)?.id ?? null, lineId: node.id }
  }

  if (node.tier === 'asset') {
    const line = byId.get(node.parentId)
    return {
      siteId: line ? (byId.get(line.parentId)?.id ?? null) : null,
      lineId: line?.id ?? null,
      assetId: node.id,
    }
  }

  return empty
}

/**
 * A parent rendered as its own name plus the trail above it.
 *
 * Split rather than pre-joined so the caller decides the typography — the sensors
 * table sets the leaf at full strength and the trail dim beneath it, which a single
 * concatenated string cannot express. `pathLabel` is there for the cases that need
 * one line (an `aria-label`, a select option, a dialog title).
 *
 * The separator is `·`, matching the only place the product already renders a path
 * (`AlertCard`'s `line · asset · component`). `›` appears in this codebase only
 * inside comments and is not introduced here.
 *
 * Returns `null` when the id does not resolve, which the caller must draw as an
 * unresolved reference rather than an empty cell — same treatment
 * `IotSensorsPage` gives a connection whose plant has been deleted.
 *
 * @returns {{tier: string, name: string, trail: string[], pathLabel: string}|null}
 */
export function describeParent(nodes, parent) {
  if (!parent?.id) return null

  const byId = new Map((nodes ?? []).map((node) => [node.id, node]))
  const node = byId.get(parent.id)
  if (!node) return null

  // Walk up to the site and stop. Region and sub-region are real tiers but they
  // are not where a sensor lives, and a four-segment trail in a table cell is
  // noise rather than context.
  const trail = []
  let cursor = byId.get(node.parentId)
  while (cursor && TIERS.indexOf(cursor.tier) >= TIERS.indexOf('site')) {
    trail.unshift(cursor.name)
    cursor = byId.get(cursor.parentId)
  }

  return {
    tier: node.tier,
    name: node.name,
    trail,
    pathLabel: [...trail, node.name].join(' · '),
  }
}
