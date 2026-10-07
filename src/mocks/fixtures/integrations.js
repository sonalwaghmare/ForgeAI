import {
  ALL_FUSION_SOURCES,
  FUSION_CATEGORIES,
  composeSource,
  isStreaming,
  pauseSource,
  removeFusionSource,
} from './fusion'
import { pipelinesForSource } from './fusionPipelines'
import { composeChannels } from './notifications'

/**
 * Settings — Integrations.
 *
 * SYNTHETIC. Gated on `VITE_DEMO_MODE`. See `DEMO-MODE.md` §8.20.
 *
 * ── This file registers nothing ───────────────────────────────────────────
 * It is a VIEW, and that is the whole design of it. Every card on the page is a
 * row that already exists: a connector card is a Data Fusion source, a
 * notification card is a delivery channel from `notifications.js`, and the
 * pipeline monitor is the same source list with its throughput columns showing.
 * There is no array of integrations here and there must never be one.
 *
 * The reason is the defect this effort has now caught five times. A second list
 * of connected systems lets Settings say the historian is connected while Data
 * Fusion says it is disconnected, and nothing catches it because both are
 * "right". Configuring a source from this page opens Data Fusion's own drawer;
 * pausing one from here stops the pipelines that read it. One registry, two
 * doors into it.
 *
 * ── The groups are the design's four, in its order ────────────────────────
 * OT/Data Sources · CMMS · Notifications · ERP. Two departures, both about what
 * a label CLAIMS rather than where it sits:
 *
 *   - **OT/Data Sources holds every data source this platform reads**, not only
 *     the historians: the vision systems and the databases are in it too. The
 *     page's own subtitle says "OT/IT data sources", and a connector page that
 *     listed nine fewer connectors than the platform has would be the one screen
 *     you cannot use to answer "what are we connected to".
 *   - **The fourth group is labelled ERP & MES.** The registry holds an Oracle
 *     MES, the public page already prints it as an MES, and filing it under a
 *     heading reading ERP would be a mislabel of a card whose own contract says
 *     otherwise. Same position, same chip, honest word.
 */

/** The groups, in the design's order. `ot` is first because the plant is. */
export const INTEGRATION_GROUPS = ['ot', 'cmms', 'notifications', 'erp']

/** Which registry categories land in the OT/Data Sources group. */
const DATA_SOURCE_CATEGORIES = ['ot', 'vision', 'db']

/** Which business systems land in the fourth group. */
const ENTERPRISE_SYSTEMS = ['erp', 'mes']

/**
 * Which group a source belongs to, or null if it belongs to none.
 *
 * Derived from what the source IS. A business system with no `system` on it
 * falls through rather than being filed somewhere plausible — a card under the
 * wrong heading is worse than a card that is missing, because the heading is the
 * only thing telling the reader what kind of integration it is.
 */
export function groupOfSource(source) {
  if (DATA_SOURCE_CATEGORIES.includes(source.category)) return 'ot'
  if (source.system === 'cmms') return 'cmms'
  if (ENTERPRISE_SYSTEMS.includes(source.system)) return 'erp'
  return null
}

/**
 * One card.
 *
 * Both kinds carry the same five facts because the design draws them in the same
 * card: what it is, which group, whether it is working, one line of context, and
 * whether there is anything to test. `kind` is what the page needs to know to
 * open the right editor — Data Fusion's connection drawer or the channel dialog.
 */
function sourceCard(source, group) {
  return {
    kind: 'source',
    id: source.id,
    name: source.name,
    group,
    status: source.status,
    /* The card's right-hand slot: when it last delivered. The design mixes
       recency ("32s ago") and schedule ("every 15 min") in this one position, so
       two cards side by side cannot be compared. One question, asked of every
       card. */
    lastSyncAt: source.lastSyncAt,
    tags: source.tags,
    /* What the count is OF, read from the registry's own category table rather
       than decided on the card. A historian counts tags, a vision system counts
       cameras, and one word for both is the word you reach for when you have
       stopped thinking about what is in the column. */
    unit: FUSION_CATEGORIES.find((entry) => entry.id === source.category)?.unit ?? null,
    /* Nothing to test until there is somewhere to test. The design draws Test
       beside "Not Configured", which is a button that can only fail. */
    testable: Boolean(source.endpoint),
  }
}

function channelCard(channel) {
  return {
    kind: 'channel',
    id: channel.id,
    name: null, // Localised from the channel id: these five are product words.
    group: 'notifications',
    status: channel.state,
    /* An address or a room name — data, so it is not translated. */
    target: channel.target,
    rules: channel.rules,
    liveRules: channel.liveRules,
    testable: channel.state === 'connected',
  }
}

/** Every card, grouped, with the counts the chips need. */
export function integrationGroups(now = Date.now()) {
  const sources = ALL_FUSION_SOURCES().map((source) => composeSource(source, now))

  const cards = [
    ...sources
      .map((source) => {
        const group = groupOfSource(source)
        return group ? sourceCard(source, group) : null
      })
      .filter(Boolean),
    ...composeChannels().map(channelCard),
  ]

  return INTEGRATION_GROUPS.map((id) => ({
    id,
    items: cards.filter((card) => card.group === id),
  })).filter((group) => group.items.length > 0)
}

/**
 * The pipeline monitor.
 *
 * The streaming sources — the ones that deliver continuously — with the four
 * columns a table of ingest is for. `isStreaming` is the registry's own
 * definition, the same one the ingest chart uses to decide what counts as
 * arriving, so this table and that chart cannot disagree about which sources are
 * live.
 *
 * `lagSeconds` is the measured latency and is null when nothing measured it. It
 * prints as an em dash rather than a zero: a source that has never connected has
 * no lag, and zero would be the best possible reading on the worst possible row.
 */
export function pipelineMonitor(now = Date.now()) {
  return ALL_FUSION_SOURCES()
    .filter(isStreaming)
    .map((source) => composeSource(source, now))
    .map((source) => ({
      id: source.id,
      name: source.name,
      tags: source.tags,
      lagSeconds: source.latencyMs == null ? null : Math.round(source.latencyMs / 100) / 10,
      lastSyncAt: source.lastSyncAt,
      recordsPerMinute: source.recordsPerMinute,
      status: source.status,
      paused: source.paused,
      /* An anchor's row is rebuilt from `CONNECTORS` on every read, so Delete
         cannot remove it. The row says so where the action is, rather than
         offering a control that does nothing. */
      removable: !source.anchored,
      pipelines: pipelinesForSource(source.id),
    }))
}

/** The whole page, in one read. Both halves describe the same registry. */
export function integrationsPayload(now = Date.now()) {
  return { groups: integrationGroups(now), monitor: pipelineMonitor(now) }
}

/* Re-exported so the transport has one import for this page's writes, and so
   the fact that they are the REGISTRY's writes stays visible at the call. */
export { pauseSource, removeFusionSource }
