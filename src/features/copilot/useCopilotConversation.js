import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { streamCopilotTurn } from './stream'

/**
 * One conversation with the copilot, held for as long as the dock is grounded on
 * a record.
 *
 * The assistant message is created empty and filled as events arrive, so the
 * indicator, the answer, its sources and any chips appear in the order the engine
 * produced them. Collecting first and rendering at the end would look identical
 * once finished and feel like a dead panel throughout.
 *
 * `session_id` comes back on the first event and is sent with every later turn.
 * Without it each question would open a new conversation, and a follow-up like
 * "and which sensor was that?" would arrive with nothing to resolve it against.
 *
 * A conversation belongs to one record, and this hook does not clear itself when
 * the record changes — the caller remounts it instead, keyed by the anomaly.
 * Resetting from an effect would render one frame of the previous anomaly's
 * answers under the new anomaly's heading, which is the worst possible moment to
 * be wrong about what the copilot was talking about.
 *
 * `history` seeds the panel with what was already asked about this record, and may
 * arrive after mount — the fetch that produces it is a query, not a prop. It is
 * applied ONCE and PREPENDED rather than assigned, so it cannot displace a turn the
 * user started while it was still in flight; replayed turns are always older than
 * anything typed in this instance. Its session id is adopted only if no live turn
 * has claimed one, which is what makes a follow-up continue the last conversation
 * about this incident instead of opening another.
 *
 * `onTurnEnd` fires once a turn has finished, with the tool names the engine
 * reported using. The copilot WRITES as well as reads — `run_rca` requests an
 * analysis — so a turn can change a record the page around the dock is already
 * displaying. Without this the anomaly screen would keep offering to start an
 * analysis the copilot had just started.
 */
/**
 * Drops a trailing turn that produced nothing at all.
 *
 * An assistant message with no text, no error and no stage is a turn that was
 * aborted before it got anywhere. `ask` refuses to start while one is streaming, so
 * within a single conversation instance the only way to hold one is React
 * re-running the effect that started it after cleaning it up — which is exactly
 * what StrictMode does on mount, and what killed the auto-asked Investigate turn.
 *
 * The user message that opened it goes with it. Leaving the question behind with a
 * blank answer under it, and then repeating the question below, reads as the
 * copilot having ignored someone once before replying.
 */
function withoutDeadTurn(messages) {
  const last = messages[messages.length - 1]
  if (!last || last.role !== 'assistant') return messages
  if (last.text || last.error || last.stages?.length) return messages
  return messages.slice(0, -2)
}

/**
 * Close the open stage that this `tool_end` belongs to.
 *
 * Matched by name against the FIRST stage of that name still running, not by
 * position: starts and ends interleave freely, and the same tool can be called
 * twice in one turn. Taking the last stage, or assuming the ends mirror the starts,
 * would attach a duration to the wrong call the moment either happens.
 *
 * An end with no matching start is dropped rather than appended. It would be a
 * stage that finished without having begun, and the honest render of that is
 * nothing at all.
 */
function completeStage(stages, name, ms) {
  const index = stages.findIndex((stage) => stage.name === name && stage.ms == null)
  if (index === -1) return stages
  return stages.map((stage, position) =>
    position === index ? { ...stage, ms: typeof ms === 'number' ? ms : 0 } : stage,
  )
}

export function useCopilotConversation(scope, { onTurnEnd, history } = {}) {
  const [live, setLive] = useState([])
  const [isStreaming, setStreaming] = useState(false)
  const sessionId = useRef(null)
  const abort = useRef(null)

  /**
   * The replayed turns are DERIVED onto the front of the live ones, never copied
   * into state.
   *
   * Seeding from an effect was the obvious shape and the wrong one: it calls
   * setState synchronously on commit, which is the cascading-render rule this
   * codebase has already been bitten by (see useRevealedText's own note). Derivation
   * has no such moment — the transcript appears on the render after it arrives.
   *
   * Prepended because everything replayed predates this mount by definition, so the
   * order holds however late the fetch lands, including mid-turn.
   */
  const replayed = history?.messages
  const messages = useMemo(
    () => (replayed?.length ? [...replayed, ...live] : live),
    [replayed, live],
  )

  /**
   * The conversation a follow-up continues.
   *
   * Held in a ref so `ask` does not change identity when the history arrives —
   * callers key effects off that identity, and the auto-asked Investigate turn
   * fires on it. Written from an effect rather than during render, same reason as
   * `turnEnd` below.
   */
  const carried = useRef(null)
  useEffect(() => {
    carried.current = history?.sessionId ?? null
  }, [history])

  // Held in a ref so a caller that passes an inline function does not change
  // `ask`'s identity on every render — callers key effects off that identity.
  // Assigned from an effect rather than during render: a ref written while
  // rendering is read by whichever pass happens to run first under concurrent
  // rendering, and there is nothing here that needs it before commit.
  const turnEnd = useRef(onTurnEnd)
  useEffect(() => {
    turnEnd.current = onTurnEnd
  }, [onTurnEnd])

  // Abort on unmount, which is also how a change of record is handled: the caller
  // keys this hook's component by the anomaly, so a new record is a new instance.
  useEffect(() => () => abort.current?.abort(), [])

  const ask = useCallback(
    async (question) => {
      const text = question.trim()
      if (!text || isStreaming) return

      abort.current?.abort()
      const controller = new AbortController()
      abort.current = controller

      const turnId = crypto.randomUUID()
      const toolsUsed = new Set()
      setLive((current) => [
        ...withoutDeadTurn(current),
        { id: `${turnId}-user`, role: 'user', text },
        { id: turnId, role: 'assistant', text: '', stages: [], sources: [], chips: [], error: null },
      ])
      setStreaming(true)

      const patch = (change) =>
        setLive((current) =>
          current.map((message) => (message.id === turnId ? { ...message, ...change } : message)),
        )

      try {
        await streamCopilotTurn({
          message: text,
          scope: scope ?? {},
          // A live turn's own id wins once it has one; otherwise the most recent
          // past conversation about this record, so "and which sensor was that?"
          // resolves against what was said last visit rather than opening another.
          sessionId: sessionId.current ?? carried.current,
          signal: controller.signal,
          onEvent: (event) => {
            switch (event.event) {
              case 'run_started':
                sessionId.current = event.session_id ?? sessionId.current
                break
              /**
               * The engine's own working, kept in order rather than in one slot.
               *
               * This was a single `tool` field that `tool_start` wrote and
               * `tool_end` cleared, which cannot represent what the engine actually
               * sends: tools overlap. A real turn opens `resolve_entity` and
               * `find_anomalies` a millisecond apart and closes them in the same
               * breath, so the second start overwrote the first and the first end
               * cleared both — one name survived, briefly, and the panel showed a
               * flicker where two steps had happened.
               *
               * A list also outlives the events. `tool_end` completes a stage
               * instead of deleting it, so the turn can say what it did rather than
               * only what it is doing this instant.
               */
              case 'tool_start':
                if (!event.name) break
                toolsUsed.add(event.name)
                setLive((current) =>
                  current.map((message) =>
                    message.id === turnId
                      ? { ...message, stages: [...message.stages, { name: event.name, ms: null }] }
                      : message,
                  ),
                )
                break
              case 'tool_end':
                setLive((current) =>
                  current.map((message) =>
                    message.id === turnId
                      ? { ...message, stages: completeStage(message.stages, event.name, event.ms) }
                      : message,
                  ),
                )
                break
              case 'delta':
                // Appended, not replaced. One event carries the whole answer today
                // because claims are verified before emission, but the server's
                // contract says to concatenate — so per-sentence streaming can land
                // later without touching this.
                setLive((current) =>
                  current.map((message) =>
                    message.id === turnId
                      ? { ...message, text: message.text + (event.text ?? '') }
                      : message,
                  ),
                )
                break
              case 'sources':
                patch({ sources: event.refs ?? [] })
                break
              case 'chips':
                patch({ chips: event.options ?? [] })
                break
              case 'error':
                patch({ error: event.message ?? 'The copilot could not answer.' })
                break
              default:
                break
            }
          },
        })
      } catch (error) {
        // An aborted turn is the user navigating away, not a failure to report.
        if (error?.name !== 'AbortError') {
          patch({ error: 'The copilot could not answer.' })
        }
      } finally {
        // The flag is cleared by whichever turn is still the current one, aborted or
        // not. Testing `aborted` instead left the indicator stuck on forever after an
        // abort, and — worse — `ask` refuses to start while it is set, so the panel
        // could never recover: one aborted turn and the conversation was over.
        // Identity, not the abort flag, is what says "a newer turn owns this now".
        if (abort.current === controller) setStreaming(false)
        // An abort produced no work, so there is nothing downstream to refresh.
        if (!controller.signal.aborted) turnEnd.current?.({ tools: [...toolsUsed] })
      }
    },
    [isStreaming, scope],
  )

  return { messages, ask, isStreaming }
}
