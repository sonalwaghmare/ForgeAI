import { get, post } from '@/services/http'
import { endpoints } from '@/services/endpoints'

/**
 * Shift handovers.
 *
 * DEMO. Fixture-backed today; see `src/mocks/fixtures/home.js`.
 *
 * PRODUCT.md's operating context names the handover as a formal ritual: an
 * outgoing summary, the alerts being carried across the boundary, the actions
 * still pending, and an acknowledgement by the incoming lead. This resource is
 * that ritual, and the four verbs below are the whole of it — read the archive,
 * read the last one, publish a new one, acknowledge one you have been handed.
 */

/** A handover is drafted, then published, then acknowledged by the next lead. */
export const HANDOVER_STATUSES = ['draft', 'published', 'acknowledged']

/** The archive, plus the rollup the history page's stat cards read. */
export async function fetchHandovers(signal) {
  const body = await get(endpoints.handovers.list, { signal })
  return { items: body?.items ?? [], stats: body?.stats ?? null }
}

/**
 * The most recent PUBLISHED handover, with its full report attached.
 *
 * Not the newest row. The newest is usually the shift currently running, which
 * is still a draft — and a home card summarising a draft would be showing
 * somebody their own unfinished note as if the last shift had handed it over.
 */
export const fetchLatestHandover = (signal) => get(endpoints.handovers.latest, { signal })

/** Publish, or save a draft. `status: 'draft'` is the difference. */
export const publishHandover = (handover) => post(endpoints.handovers.list, handover)

/** The incoming lead taking it. This is the act that closes the ritual. */
export const acknowledgeHandover = (handoverId) =>
  post(endpoints.handovers.acknowledge(handoverId))
