import { HIERARCHY_NODES } from './hierarchy'
import { SIGNAL_CHANNELS } from './signals'
import { noise } from './lines'
import { ALL_FUSION_SOURCES, composeSource } from './fusion'
import { boundChannelsOf } from './fusionMapping'
import { FUSION_DOCS, FUSION_MEDIA, composeDoc, composeMedia } from './fusionDocs'

/**
 * Data Fusion — Contextualisation.
 *
 * SYNTHETIC, like everything in this directory. Gated on `VITE_DEMO_MODE`.
 * See `DEMO-MODE.md` §8.10.
 *
 * ── What this screen is, and what it is not ───────────────────────────────
 * Contextualisation places an object in the estate: this tag belongs to that
 * machine, this scanned drawing is about that compressor. It adds a graph edge.
 *
 * It does NOT route a signal. Binding a historian tag to a Forge sensor so its
 * time-series drives charts and thresholds is the MAPPING table in the connection
 * drawer, and `fusionMapping.js` owns it. Keeping the two apart is not
 * tidiness: `CONNECTORS` declares exactly one connector that provides signals,
 * Sensor Explorer's filter drawer states that as fact, and a screen that let
 * somebody route a second source into the sensor catalogue would quietly make
 * that claim false. Placing a tag on a machine breaks nothing.
 *
 * ── Confidence is computed by matching names, not authored ────────────────
 * The prototype writes six rows with confidences of 98, 94, 72, 66, 58 and 41.
 * Here a suggestion comes from scoring the object's own name against the codes
 * in the hierarchy, and the score IS the confidence. Which means it can be
 * wrong, and `verify:mocks` checks it against ground truth: every generated tag
 * knows which asset it really came from, the matcher is never shown that field,
 * and the check asserts it recovers it.
 */

/* ── The tag population ───────────────────────────────────────────────────
   A source that reads assets publishes tags named after them. This is the
   naming a real OPC-UA server produces — a namespace, a controller, a compacted
   asset code, a signal — and it is generated rather than authored so that adding
   an asset to a source adds its tags too. */

const SIGNALS = ['VibX', 'VibY', 'BrgTemp', 'MotorCurrent', 'DisPres', 'FlowRate']

/** `FDY-BM-03` → `FDYBM03`. What a controller's tag names actually contain. */
const compact = (assetId) => assetId.replaceAll('-', '')

/**
 * Every tag a source publishes.
 *
 * `assetId` on each row is GROUND TRUTH — where the tag really comes from. The
 * matcher below is never given it; it is what the checks compare against.
 *
 * The orphans are the point of the screen. Every plant has tags nobody named
 * after anything: a building humidity sensor, a spare channel, a legacy
 * controller word. They carry no asset token, so no amount of name matching
 * will place them and a person has to.
 */
export function tagsOfSource(source) {
  /* The half that is already bound to a Forge sensor. Included here rather than
     left out, because this function is what "every tag this source publishes"
     means: the connection drawer's mapping table shows these, the queue below
     filters them out, and the two together are the whole population. Leaving them
     out would make the mapping table and the queue two lists of different things
     that happen to look related. */
  const boundTags = boundChannelsOf(source).map((channel) => ({
    name: channel.tag,
    assetId: channel.assetId,
    sourceId: source.id,
    boundTo: channel.id,
  }))

  const named = (source.assetIds ?? []).flatMap((assetId, index) =>
    SIGNALS.slice(0, 2 + (index % 3)).map((signal) => ({
      name: `ns=2;s=PLC1.${compact(assetId)}.${signal}`,
      assetId,
      sourceId: source.id,
    })),
  )

  /* Two per source that carry no asset code at all. Keyed off the source id so
     the set is the same on every read. */
  const orphans = ORPHAN_TAGS.filter((_, index) => noise(source.id, index) > 0.55).map((name) => ({
    name,
    assetId: null,
    sourceId: source.id,
  }))

  return [...boundTags, ...named, ...orphans]
}

const ORPHAN_TAGS = [
  'ns=2;s=PLC1.BLDG_A.HumidityPct',
  'ns=2;s=PLC1.SPARE_AI_07',
  'ns=2;s=LEGACY.DB44.DBW12',
  'ns=2;s=PLC1.UTIL.HeaderPress',
]

/* ── The matcher ──────────────────────────────────────────────────────────
   Scores a name against the estate. It sees the name and the hierarchy, and
   nothing else — no ground truth, no source, no hints. */

const ASSETS = HIERARCHY_NODES.filter((node) => node.tier === 'asset')
const LINES = HIERARCHY_NODES.filter((node) => node.tier === 'line')
const SITES = HIERARCHY_NODES.filter((node) => node.tier === 'site')

const squash = (text) => text.toUpperCase().replaceAll(/[^A-Z0-9]/g, '')

/**
 * The best guess for what an object is about, and how sure that is.
 *
 * Four bands, in the order they are tried:
 *
 *   - the asset's full code, compacted (`FDYBM03`) — unambiguous, high 90s
 *   - the asset's tail (`BM03`, `CMP12`) — right in this estate, but a second
 *     plant with a BM-03 would break it, so it is not certain
 *   - a line code (`FDYL1`) — the object belongs somewhere on that line
 *   - a site code (`FDY`) — narrowed to a plant and no further
 *
 * A few points of deterministic spread on each band, so a queue of six does not
 * read as four identical numbers. `null` means the matcher has nothing to offer,
 * which is a real answer and the one that most needs a person.
 */
export function suggestFor(name) {
  const text = squash(name)
  const jitter = (key, span) => Math.round(noise(key, 1) * span)

  for (const asset of ASSETS) {
    if (text.includes(squash(asset.code))) {
      return { kind: 'asset', id: asset.id, name: asset.name, confidence: 93 + jitter(name, 6) }
    }
  }
  for (const asset of ASSETS) {
    const tail = squash(asset.code).slice(3)
    if (tail.length >= 4 && text.includes(tail)) {
      return { kind: 'asset', id: asset.id, name: asset.name, confidence: 74 + jitter(name, 12) }
    }
  }
  for (const line of LINES) {
    if (text.includes(squash(line.code))) {
      return { kind: 'line', id: line.id, name: line.name, confidence: 58 + jitter(name, 10) }
    }
  }
  for (const site of SITES) {
    if (text.includes(squash(site.code))) {
      return { kind: 'site', id: site.id, name: site.name, confidence: 40 + jitter(name, 12) }
    }
  }
  return null
}

/* ── Decisions ────────────────────────────────────────────────────────────
   Module state, like the tasks and handovers fixtures. A decision has to survive
   a navigation or the queue is a list that forgets what you told it. Resets on
   reload, which is the right lifetime for a demo. */

/** id → 'accepted' | 'rejected'. Absent means still pending. */
const DECIDED = new Map()

export function decideContext(id, decision) {
  if (decision === 'pending') DECIDED.delete(id)
  else DECIDED.set(id, decision)
  return DECIDED.get(id) ?? 'pending'
}

/**
 * Accepting a document or media suggestion really links it.
 *
 * The registry is the same one the Documents screen and Asset Detail read, so
 * placing a scanned drawing here makes it appear on that machine's Documents tab
 * — which is the whole point of the screen and the only way to tell that the
 * decision did anything.
 */
function applyLink(item) {
  const record =
    item.kind === 'document'
      ? FUSION_DOCS.find((doc) => doc.id === item.id)
      : item.kind === 'media'
        ? FUSION_MEDIA.find((media) => media.id === item.id)
        : null
  if (!record || !item.suggestion) return
  record.links = [{ k: item.suggestion.kind, id: item.suggestion.id }]
  record.pending = false
}

/* ── The queue ────────────────────────────────────────────────────────────
   Three collections, one list. Everything on it is an object that arrived and
   has not been placed. */

/** Everything awaiting placement, with a suggestion where the matcher has one. */
export function contextQueue() {
  const sources = ALL_FUSION_SOURCES().map((source) => composeSource(source))

  /* Only tags from sources that are actually delivering. A disconnected
     historian's tag list is last week's, and asking somebody to place objects
     from a feed that has stopped is asking them to do work twice. */
  const tagItems = sources
    .filter((source) => source.status === 'connected' || source.status === 'syncing')
    .flatMap((source) =>
      tagsOfSource(source).map((tag) => ({
        id: `${source.id}:${tag.name}`,
        kind: 'tag',
        label: tag.name,
        sourceId: source.id,
        sourceName: source.name,
        // Ground truth, for the checks. Never read by `suggestFor`.
        actualAssetId: tag.assetId,
        suggestion: suggestFor(tag.name),
      })),
    )
    /* The tags that are already accounted for do not need placing. A channel in
       the sensor catalogue has been placed by definition — it hangs off an
       asset — so listing it here would be asking for work already done. */
    .filter((item) => !PLACED_TAGS.has(item.label))

  const docItems = FUSION_DOCS.filter((doc) => doc.pending && !doc.links.length).map((doc) => {
    const composed = composeDoc(doc)
    return {
      id: composed.id,
      kind: 'document',
      label: composed.name,
      sourceId: 'src_s3_docs',
      sourceName: 'AWS S3 · Document Backup',
      actualAssetId: null,
      suggestion: suggestFor(composed.name),
    }
  })

  const mediaItems = FUSION_MEDIA.filter((item) => item.pending && !item.links.length).map(
    (item) => {
      const composed = composeMedia(item)
      return {
        id: composed.id,
        kind: 'media',
        label: composed.name,
        sourceId: 'src_s3_docs',
        sourceName: 'AWS S3 · Document Backup',
        actualAssetId: null,
        suggestion: suggestFor(composed.name),
      }
    },
  )

  return [...tagItems, ...docItems, ...mediaItems]
    .map((item) => ({ ...item, status: DECIDED.get(item.id) ?? 'pending' }))
    /* Most confident first. A reviewer clearing a queue wants the obvious ones
       gone in a run of clicks before reaching the ones that need thought — the
       opposite order makes them stop on the hardest item first. Unmatched last,
       because those need a person rather than a confirmation. */
    .sort((a, b) => (b.suggestion?.confidence ?? -1) - (a.suggestion?.confidence ?? -1))
}

/**
 * Tags the sensor catalogue already accounts for.
 *
 * `ASSET_COMPONENTS` carries real OPC tag strings on the two modelled machines,
 * and those channels exist in Sensor Explorer — so they have a home and are not
 * awaiting one.
 */
const PLACED_TAGS = new Set(
  SIGNAL_CHANNELS.map((channel) => channel.tag).filter(Boolean),
)

/** Apply a decision, linking the record when the answer is yes. */
export function decideAndApply(id, decision) {
  const item = contextQueue().find((entry) => entry.id === id)
  if (!item) return null
  decideContext(id, decision)
  if (decision === 'accepted') applyLink(item)
  return { ...item, status: decision }
}

/** The four figures above the table. Every one a count of the queue itself. */
export function contextStats(queue) {
  const scored = queue.filter((item) => item.suggestion)
  return {
    pending: queue.filter((item) => item.status === 'pending').length,
    accepted: queue.filter((item) => item.status === 'accepted').length,
    rejected: queue.filter((item) => item.status === 'rejected').length,
    unmatched: queue.filter((item) => !item.suggestion).length,
    // Over the items that HAVE a suggestion. Averaging a null in as zero would
    // make the figure fall every time the matcher declined to guess, which
    // reads as the matcher getting worse when it is being careful.
    avgConfidence: scored.length
      ? Math.round(scored.reduce((sum, item) => sum + item.suggestion.confidence, 0) / scored.length)
      : null,
  }
}
