import { useQuery } from '@tanstack/react-query'
import { endpoints } from '@/services/endpoints'
import { get } from '@/services/http'
import { queryKeys } from '@/services/queryClient'

/**
 * What the copilot has already been asked about one anomaly.
 *
 * The dock has always recorded which incident a question was about — every turn
 * carries `page_anomaly_id` in its scope — and never read it back, so reopening an
 * anomaly somebody had already investigated showed an empty panel while the
 * questions sat in the database. This is the read half.
 *
 * ── The turns span more than one conversation ─────────────────────────────
 * Each visit to an incident opened its own session, so an anomaly asked about on
 * three days has three. They are returned newest-first alongside the turns, and
 * the newest is the one a follow-up continues: adopting it is what makes "and
 * which sensor was that?" resolvable against what was said last time instead of
 * opening a fourth conversation about the same record.
 *
 * ── Nothing here invents a shape ──────────────────────────────────────────
 * `sources` is stored exactly as the live `sources` event emits it — `{kind,
 * pg_id, label}` — so a replayed citation renders through the same code as a live
 * one. Only `content` is renamed, to the `text` the panel reads.
 */

/**
 * One stored turn as the panel's message list holds it.
 *
 * `replayed` is not cosmetic: it stops `useRevealedText` typing a months-old
 * answer out again on mount. `stages`, `chips` and `error` are live-stream state
 * with no meaning after the fact, and are defaulted rather than omitted so a
 * replayed message and a live one have the same keys.
 *
 * `stages` is empty rather than reconstructed because the stored turn does not
 * carry the tool calls that produced it — and the panel only renders them on a live
 * turn anyway. `sources` is the part of the working that outlives the turn, and
 * that one IS stored.
 */
function toMessage(turn) {
  const base = { id: turn.id, role: turn.role, text: turn.content ?? '', replayed: true }
  if (turn.role === 'user') return base
  return { ...base, stages: [], sources: turn.sources ?? [], chips: [], error: null }
}

export async function fetchAnomalyConversation(anomalyId, signal) {
  const body = await get(endpoints.copilot.anomalyTurns(anomalyId), { signal })
  return {
    messages: (body?.turns ?? []).map(toMessage),
    /* The most recently active conversation about this incident. `sessions` comes
       back ordered, so this is a pick rather than a search. */
    sessionId: body?.sessions?.[0]?.id ?? null,
  }
}

/**
 * Read once per anomaly and cached.
 *
 * The dock is keyed by anomaly, so switching incidents remounts the conversation
 * and asks again — through the cache on a revisit rather than the network, which
 * is the whole reason this is a query and not a bare effect.
 *
 * `staleTime: Infinity` because the only thing that adds to this transcript is the
 * dock itself, and the live turn is already in the panel's own state. Refetching
 * would replace a conversation in progress with the server's view of it, which is
 * behind by exactly the turn on screen.
 */
export function useAnomalyConversation(anomalyId) {
  return useQuery({
    queryKey: queryKeys.copilotAnomalyTurns(anomalyId),
    queryFn: ({ signal }) => fetchAnomalyConversation(anomalyId, signal),
    enabled: Boolean(anomalyId),
    staleTime: Infinity,
    /* An unreadable transcript must not become a red panel over a working
       copilot: the dock's job is answering the next question, and it can do that
       with no history at all. Failure degrades to an empty conversation. */
    retry: false,
  })
}
