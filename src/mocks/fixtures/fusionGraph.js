import { HIERARCHY_NODES } from './hierarchy'
import { SIGNAL_CHANNELS } from './signals'
import { ALERTS } from './alerts'
import { allWorkOrders, isOpenOrder } from './operations'
import { ALL_FUSION_SOURCES, composeSource } from './fusion'
import { FUSION_MEDIA, composeMedia, resolveDocsForAsset } from './fusionDocs'

/**
 * Data Fusion — the knowledge graph.
 *
 * SYNTHETIC, like everything in this directory. Gated on `VITE_DEMO_MODE`.
 * See `DEMO-MODE.md` §8.10.
 *
 * ── One machine's neighbourhood, not the whole estate ─────────────────────
 * The graph has about a hundred and ten entities. Drawn at once they are a
 * hairball: a picture that proves a graph exists and answers no question about
 * it. What somebody opens this screen to ask is "what does the platform actually
 * know about this machine", and that is a subgraph one screen can hold.
 *
 * The design's own graph is nine nodes for exactly this reason — it just gets
 * there by hardcoding nine, where these are read off the estate.
 *
 * ── Every edge is a fact something else already asserts ───────────────────
 * The line comes from the hierarchy, the sensors from the signal catalogue, the
 * documents from the inheritance resolver, the sources from what each declares
 * it reads, the work orders and anomalies from their own collections. Nothing
 * here authors a relationship, which is what makes the counts on Data Overview
 * countable in the first place.
 */

const nodeById = new Map(HIERARCHY_NODES.map((node) => [node.id, node]))

/** The entity kinds a node can be, and the hue each takes on the canvas. */
export const GRAPH_KINDS = {
  asset: { tone: 'dismissed', icon: 'factory' },
  line: { tone: 'ack', icon: 'gauge' },
  site: { tone: 'green', icon: 'map' },
  sensor: { tone: 'forge', icon: 'wave' },
  document: { tone: 'violet', icon: 'doc' },
  media: { tone: 'watch', icon: 'eye' },
  source: { tone: 'amber', icon: 'plug' },
  workOrder: { tone: 'amber', icon: 'wrench' },
  // `bolt` because that is the glyph the nav rail gives Anomalies; a graph that
  // used a different one for the same concept would be a second vocabulary.
  anomaly: { tone: 'red', icon: 'bolt' },
}

/**
 * The machines worth opening.
 *
 * Every asset in the estate, ordered by how much the platform knows about it —
 * the richest neighbourhood first. A picker that opened on a machine with two
 * edges would make the screen look empty when it is not.
 */
export function graphEntities() {
  return HIERARCHY_NODES.filter((node) => node.tier === 'asset')
    .map((node) => ({
      id: node.id,
      name: node.name,
      code: node.code,
      kind: 'asset',
      degree: neighbourhoodOf(node.id).edges.length,
    }))
    .sort((a, b) => b.degree - a.degree || a.name.localeCompare(b.name))
}

/**
 * Everything one asset is connected to, and how.
 *
 * Capped per kind. A bodymaker with eleven documents would push its sensors off
 * the canvas, and the eleventh document is not what anybody came to see — the
 * count beside the group says how many there are, and the Documents screen lists
 * them. Four is what fits on a ring without labels overlapping.
 */
export function neighbourhoodOf(assetId) {
  const asset = nodeById.get(assetId)
  if (!asset || asset.tier !== 'asset') return { focus: null, nodes: [], edges: [], groups: [] }

  const line = nodeById.get(asset.parentId) ?? null
  const site = line ? (nodeById.get(line.parentId) ?? null) : null

  const sensors = SIGNAL_CHANNELS.filter((channel) => channel.assetId === assetId)
  const documents = resolveDocsForAsset(assetId)
  const media = FUSION_MEDIA.map(composeMedia).filter((item) =>
    item.links.some((link) => link.id === assetId),
  )
  const sources = ALL_FUSION_SOURCES()
    .map((source) => composeSource(source))
    .filter((source) => source.assetIds.includes(assetId))
  const orders = allWorkOrders().filter(
    (order) => order.assetId === assetId && isOpenOrder(order),
  )
  const anomalies = ALERTS.filter(
    (alert) => alert.assetId === assetId && alert.status !== 'resolved',
  )

  /* Each group is a kind, a relationship verb, and what it holds. The verb is
     the edge label and it belongs here rather than on the node, because the same
     document is "documented by" from a machine and "documents" from itself. */
  const groups = [
    { kind: 'site', rel: 'locatedAt', all: site ? [entity('site', site.id, site.name)] : [] },
    { kind: 'line', rel: 'partOf', all: line ? [entity('line', line.id, line.name)] : [] },
    {
      kind: 'sensor',
      rel: 'measuredBy',
      all: sensors.map((channel) => entity('sensor', channel.id, channel.name)),
    },
    {
      kind: 'anomaly',
      rel: 'anomalyOn',
      all: anomalies.map((alert) => entity('anomaly', alert.id, alert.id)),
    },
    {
      kind: 'workOrder',
      rel: 'maintainedBy',
      all: orders.map((order) => entity('workOrder', order.id, order.id)),
    },
    {
      kind: 'document',
      rel: 'documentedBy',
      all: documents.map((doc) => entity('document', doc.id, doc.name)),
    },
    {
      kind: 'media',
      rel: 'picturedBy',
      all: media.map((item) => entity('media', item.id, item.name)),
    },
    {
      kind: 'source',
      rel: 'ingestedFrom',
      all: sources.map((source) => entity('source', source.id, source.name)),
    },
  ].filter((group) => group.all.length > 0)

  const PER_KIND = 4
  const shown = groups.flatMap((group) =>
    group.all.slice(0, PER_KIND).map((node) => ({ ...node, rel: group.rel })),
  )

  return {
    focus: entity('asset', asset.id, asset.name, asset.code),
    nodes: shown,
    edges: shown.map((node) => ({ from: asset.id, to: node.id, rel: node.rel })),
    /* What was left out, per kind. Stated rather than silently dropped — a graph
       that quietly shows four of eleven documents is a graph nobody should
       trust. */
    groups: groups.map((group) => ({
      kind: group.kind,
      rel: group.rel,
      total: group.all.length,
      shown: Math.min(PER_KIND, group.all.length),
    })),
  }
}

const entity = (kind, id, name, code = null) => ({
  id,
  kind,
  name,
  code,
  tone: GRAPH_KINDS[kind].tone,
  icon: GRAPH_KINDS[kind].icon,
})

/**
 * Where each node sits, in a 0–100 unit square.
 *
 * Deterministic, and computed rather than hardcoded — the design's nine nodes
 * carry literal `x`/`y`, which cannot survive an estate that changes. A ring is
 * the right shape because every edge here has the same origin: the focus is what
 * the picture is about, and radial makes that true visually as well as
 * structurally.
 *
 * Nodes are laid out grouped by kind and in group order, so sensors sit together
 * and documents sit together. Two radii, alternating, so labels on adjacent
 * nodes do not collide.
 */
export function layout(nodes) {
  const count = nodes.length || 1
  return nodes.map((node, index) => {
    /* Start at the top and go clockwise. The half-step offset keeps the first
       node off the vertical, where its label would sit on top of the focus. */
    const angle = ((index + 0.5) / count) * Math.PI * 2 - Math.PI / 2
    const radius = index % 2 === 0 ? 38 : 30
    return {
      ...node,
      x: Math.round((50 + Math.cos(angle) * radius) * 10) / 10,
      y: Math.round((50 + Math.sin(angle) * radius * 0.86) * 10) / 10,
    }
  })
}

/** The whole-graph figures, for the header. Counted, never stored. */
export function graphTotals() {
  const sources = ALL_FUSION_SOURCES().map((source) => composeSource(source))
  return {
    assets: HIERARCHY_NODES.filter((node) => node.tier === 'asset').length,
    sensors: SIGNAL_CHANNELS.length,
    sources: sources.length,
    // Every relationship the neighbourhood builder could ever draw, summed over
    // every asset. The same edges, counted from the same rules.
    relationships: HIERARCHY_NODES.filter((node) => node.tier === 'asset').reduce(
      (sum, node) =>
        sum +
        neighbourhoodOf(node.id).groups.reduce((inner, group) => inner + group.total, 0),
      0,
    ),
  }
}
