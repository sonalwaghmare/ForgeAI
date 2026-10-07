import { streamCopilotTurn } from './stream'

/**
 * A real copilot turn, in the shape this screen already renders.
 *
 * The screen was built to take one. `askCopilot` carried the note "when a real
 * streaming endpoint lands this is where it goes, and the page above it does not
 * change" — this is that, and the page above it does not change.
 *
 * ── Why the whole answer arrives at once, and why that is right ───────────
 * The engine emits its answer as a single `delta`, not a token stream, and that
 * is deliberate on its side: every claim is checked against the records it read
 * and anything unsupported is stripped BEFORE emission. Streaming raw model
 * output would put a sentence on screen and then retract it. So `useStreamedBlocks`
 * keeps revealing on its timer, which is now an honest presentation of an answer
 * that genuinely did arrive complete.
 *
 * ── The blocks are not decoration ─────────────────────────────────────────
 * `sources` becomes an evidence block because it is the difference between an
 * answer and an assertion: the service strips any claim it cannot tie to a
 * record, so the list underneath is the whole reason the text above it is worth
 * believing. An answer that rendered as prose alone would throw that away.
 */
export async function askCopilotLive({ question, scope, sessionId }) {
  const blocks = []
  const reasoning = []
  const sources = []
  const suggestions = []
  let text = ''
  let failed = false
  let session = sessionId ?? null

  await streamCopilotTurn({
    message: question,
    scope: scope ?? {},
    sessionId,
    onEvent: (event) => {
      switch (event.event) {
        case 'run_started':
          session = event.session_id ?? session
          break
        case 'tool_start':
          // One step per tool, in the order they ran. The screen renders these
          // through `copilot.reasoning.<key>`, so an unknown tool would print its
          // own key at the user — dropped instead, since a missing step is a
          // quieter failure than a raw identifier on screen.
          if (event.name && !reasoning.includes(event.name)) reasoning.push(event.name)
          break
        case 'delta':
          text += event.text ?? ''
          break
        case 'sources':
          sources.push(...(event.refs ?? []))
          break
        case 'chips':
          // Their chips are strings; ours carry an id. The label is what a person
          // clicks, and re-asking by name is what the next turn resolves.
          suggestions.push(...(event.options ?? []).map((option) => option.label))
          break
        case 'error':
          failed = true
          break
        default:
          break
      }
    },
  })

  if (text) blocks.push({ type: 'text', text })
  if (sources.length) {
    blocks.push({
      type: 'evidence',
      // The row key becomes an i18n lookup (`analysis.evidence.<key>`), and a key
      // with no string prints itself at the user. A kind we do not have a label
      // for falls back to the generic one rather than putting `relationship` on
      // screen as though it were a word.
      rows: sources.map((source) => ({
        key: LABELLED_KINDS.has(source.kind) ? source.kind : 'evidence',
        value: source.label ?? source.pg_id,
      })),
    })
  }

  return {
    // `matched: false` makes the screen print its own "I could not answer" copy.
    // A live turn that produced text has answered — even "the records show
    // nothing" is an answer, and the most important one this system gives.
    matched: !failed && Boolean(text),
    blocks,
    reasoning: reasoning.filter((step) => KNOWN_STEPS.has(step)),
    suggestions,
    sessionId: session,
  }
}

/** Evidence kinds with an `analysis.evidence.<kind>` label. Mirrors copilot/evidence.py. */
const LABELLED_KINDS = new Set([
  'evidence', 'anomaly', 'asset', 'statistic', 'relationship', 'rca',
])

/** Tools with a `copilot.reasoning.<key>` string. Anything else is not shown. */
const KNOWN_STEPS = new Set([
  'resolve_entity', 'get_anomaly', 'find_anomalies', 'series_stats', 'get_rca', 'run_rca',
])
