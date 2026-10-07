import { useQuery } from '@tanstack/react-query'
import { get, post } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'
import { askCopilotLive } from './liveAnswer'

/**
 * The AI Copilot screen.
 *
 * DEMO. See `DEMO-MODE.md` §8.11.
 *
 * ── Separate from `queries.js`, which is the DOCK ─────────────────────────
 * `useCopilotThread` there reads the one conversation grounded on ALR-4471 and
 * feeds `AssistantDock`. It is unchanged and nothing here touches it. This file
 * serves `/app/copilot`, which opens with no record in hand.
 *
 * ── What this is honest about ─────────────────────────────────────────────
 * The answers are a prepared set, not a model. `matched: false` comes back for
 * anything else and the screen says so in as many words. The figures inside a
 * prepared answer are read from the same fixtures the anomaly list and the OEE
 * module render, so an answer cannot contradict the screen it links to.
 */

/** The four agent modes, in the design's rail order. */
export const COPILOT_MODES = ['explore', 'trouble', 'maint', 'alerts']

/**
 * The opening state: modes, their chips, and the grounding line.
 *
 * Cached hard. The chips change when the plant's state changes, which on this
 * screen means never within a sitting.
 */
export const useCopilotPrompts = () =>
  useQuery({
    queryKey: queryKeys.copilotPrompts,
    queryFn: ({ signal }) => get(endpoints.copilot.prompts, { signal, meta: { ai: true } }),
    enabled: config.demoMode,
    staleTime: 10 * 60_000,
  })

/**
 * Ask.
 *
 * A plain function, deliberately NOT `useMutation`.
 *
 * There is no cache to invalidate — the transcript is the page's own state and
 * nothing is persisted — so the only thing a mutation was providing was its
 * per-call `onSuccess`, and that is exactly what broke. Callbacks passed to
 * `mutate` belong to the observer that fired them, and React drops them when
 * StrictMode remounts the effect underneath: the request completed, the answer
 * arrived, nothing was listening, and the screen sat on "Working…" for ever.
 *
 * Awaiting a promise the caller owns cannot come adrift from the component that
 * asked for it. When a real streaming endpoint lands this is where it goes, and
 * the page above it does not change.
 */
export const askCopilot = ({ question, mode, scope, sessionId }) =>
  config.authMode === 'live'
    ? askCopilotLive({ question, scope, sessionId })
    : post(endpoints.copilot.messages, { question, mode }, { meta: { ai: true } })

/*
 * The switch, and why it reads `authMode` rather than a flag of its own.
 *
 * Auth and the copilot are the same FastAPI process — "is the backend running" is
 * one question, not two — and this is the same rule `hybridAdapter` applies to
 * every other feature in the app. The copilot stops being the one exception that
 * always answers from fixtures.
 *
 * The demo path is not a fallback, it is a supported mode. A demo with the
 * backend stopped is a real requirement, and the prepared answers are the honest
 * version of it: the banner says so in as many words. What would not be honest is
 * silently serving prepared answers while a real engine is up.
 *
 * `mode` is only meaningful to the prepared set. The engine scopes a turn by the
 * record in hand, which is what `scope` carries.
 */
