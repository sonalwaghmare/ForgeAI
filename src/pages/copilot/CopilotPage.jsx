import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ChatThread } from '@/components/forge/ChatThread'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import { StateBadge } from '@/components/forge/StatusBadge'
import { Eyebrow, Num } from '@/components/forge/primitives'
import { COPILOT_MODES, askCopilot, useCopilotPrompts } from '@/features/copilot/screen'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/cn'
import { CopilotAnswer } from './CopilotAnswer'

/**
 * AI Copilot.
 *
 * DEMO. See `DEMO-MODE.md` §8.11. The design's screen: an agent-mode rail, a
 * grounded header, prompt cards on the empty state, the transcript, and the
 * "Thought process" disclosure on every answer.
 *
 * ── It answers a prepared set, and says so ────────────────────────────────
 * There is no model behind a fixture. The two honest options were a small set
 * of prepared answers or a matcher pretending to more understanding than it
 * has; this is the first, the banner states it, and an unmatched question gets
 * a plain miss with the chips offered back rather than an improvisation about
 * somebody's plant.
 *
 * What is NOT prepared is the figures. Every number in an answer is read at
 * request time from the alert list, the OEE module and the work-order board, so
 * an answer cannot contradict the screen it names.
 *
 * ── The dock is untouched ─────────────────────────────────────────────────
 * `AssistantDock` still grounds on an alert and still shows ALR-4471's thread
 * only on the anomaly screens. Making it route-aware is a shell change and a
 * separate pass.
 *
 * ── The transcript is page state ──────────────────────────────────────────
 * Nothing is persisted, because no endpoint stores a thread. The design's
 * "Recent conversations" rail is three hardcoded strings; a fixture that
 * pretended to store threads would be inventing a resource the API lacks. New
 * conversation clears, and that is the whole of it.
 */
export function CopilotPage() {
  const { t } = useTranslation(['app', 'common'])
  const [searchParams, setSearchParams] = useSearchParams()

  const mode = COPILOT_MODES.includes(searchParams.get('mode'))
    ? searchParams.get('mode')
    : 'trouble'

  /* A question can arrive in the URL. That is what gives every "Ask Forge AI"
     affordance in the product somewhere to send a record — the logbook card,
     the asset header — and it means a conversation can be linked to rather
     than described. It is NOT cleared after firing: a refresh should ask the
     same thing again, which is what the link promised. */
  const seed = (searchParams.get('q') ?? '').trim() || null

  const [messages, setMessages] = useState(() =>
    seed ? [{ id: 'u0', author: 'user', at: hhmm(), blocks: [{ type: 'text', text: seed }] }] : [],
  )
  const [draft, setDraft] = useState('')
  const endRef = useRef(null)
  const seedSent = useRef(false)
  /* Carried across turns so a follow-up resolves against what was already said.
     Without it every question opens a new conversation and "which detectors were
     those again?" arrives with nothing to resolve "those" against. Unused by the
     prepared set, which has no conversation to continue. */
  const sessionId = useRef(null)

  useDocumentTitle(`${t('copilot.title')} · ${t('common:brand.name')}`)

  const prompts = useCopilotPrompts()
  /* Ours, not React Query's. See `askCopilot` — the observer's own pending flag
     outlived the callbacks that were supposed to clear it. */
  const [asking, setAsking] = useState(false)

  const chips = prompts.data?.modes?.find((entry) => entry.id === mode)?.prompts ?? []
  const grounding = prompts.data?.grounding ?? null

  /* Scroll the newest answer into view. `messages.length` and not the array —
     a dependency on the array itself re-runs on every keystroke, because the
     draft state re-renders this component and React Compiler is not enabled. */
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages.length])

  /**
   * Run the question and append the answer.
   *
   * Split out from `send` so the URL seed can reuse it: that path already has
   * its user turn in the initial state, and only needs the reply. Calling
   * `mutate` from an effect is fine — it is not a synchronous setState, which
   * is the thing the lint rule catches and which has bitten this codebase
   * twice.
   */
  const runAsk = async (asked, turn, stamp) => {
    setAsking(true)
    const append = (message) => setMessages((held) => [...held, message])
    try {
      const answer = await askCopilot({ question: asked, mode, sessionId: sessionId.current })
      sessionId.current = answer.sessionId ?? sessionId.current
      append({
        id: `a${turn}`,
        author: 'ai',
        at: stamp,
        /* An unmatched question has no blocks from the server on purpose — its
           wording is furniture and only the client has `t`. Same rule that kept
           an i18n key out of the handover report. */
        blocks: answer.matched
          ? answer.blocks
          : [{ type: 'text', text: t('copilot.fallback') }],
        reasoning: answer.reasoning ?? [],
        /* Offered on any answer that carries them, not only a miss — a
           greeting's chips are the whole of what it is for. */
        suggestions: answer.suggestions ?? [],
      })
    } catch {
      append({
        id: `a${turn}`,
        author: 'ai',
        at: stamp,
        blocks: [{ type: 'text', text: t('copilot.loadFailed') }],
        reasoning: [],
        suggestions: [],
      })
    } finally {
      setAsking(false)
    }
  }

  const send = (question) => {
    const asked = question.trim()
    if (!asked || asking) return
    setDraft('')
    const stamp = hhmm()
    const turn = messages.length
    setMessages((held) => [
      ...held,
      { id: `u${turn}`, author: 'user', at: stamp, blocks: [{ type: 'text', text: asked }] },
    ])
    runAsk(asked, turn, stamp)
  }

  /* Fire the seeded question once. The ref guard is what makes it once — the
     effect re-runs when the mutation settles, and without it the screen would
     ask the same thing forever. */
  useEffect(() => {
    if (!seed || seedSent.current) return
    seedSent.current = true
    runAsk(seed, 0, hhmm())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once, guarded by the ref
  }, [seed])

  const setMode = (next) =>
    setSearchParams((previous) => {
      const url = new URLSearchParams(previous)
      if (next === 'trouble') url.delete('mode')
      else url.set('mode', next)
      return url
    })

  return (
    <Page>
      <div className="grid gap-4 [grid-template-columns:minmax(200px,232px)_minmax(0,1fr)] max-lg:grid-cols-1">
        {/* ── The agent-mode rail ─────────────────────────────────────
            A mode swaps the prompt chips and nothing else, which is all it
            does in the design too. It is in the URL so a mode can be linked.

            The design's "Recent" list below this is three hardcoded strings
            with no store behind them; it is left out rather than faked. */}
        <aside className="min-w-0">
          <ForgeButton
            className="mb-4 w-full"
            onClick={() => {
              setMessages([])
              /* The thread goes with the transcript. Keeping it would make the
                 next question a follow-up to a conversation the user just
                 cleared, and the answer would refer to something no longer on
                 screen. */
              sessionId.current = null
            }}
            disabled={messages.length === 0}
          >
            <Icon name="plus" size="xs" />
            {t('copilot.newChat')}
          </ForgeButton>

          <Eyebrow as="h2" className="mb-2">
            {t('copilot.modeLabel')}
          </Eyebrow>
          <nav className="flex flex-col gap-0.5">
            {COPILOT_MODES.map((entry) => (
              <button
                key={entry}
                type="button"
                aria-current={mode === entry ? 'true' : undefined}
                onClick={() => setMode(entry)}
                className={cn(
                  'flex items-start gap-2.5 rounded-sm border-s-2 px-2.5 py-2 text-start transition-colors',
                  mode === entry
                    ? 'border-s-forge bg-sunken'
                    : 'border-s-transparent hover:bg-sunken',
                )}
              >
                <Icon
                  name={MODE_ICON[entry]}
                  size="sm"
                  className={cn('mt-0.5 shrink-0', mode === entry ? 'text-on-forge' : 'text-ink-mute')}
                />
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block text-body-sm',
                      mode === entry ? 'font-semibold text-ink' : 'text-ink-dim',
                    )}
                  >
                    {t(`copilot.mode.${entry}.label`)}
                  </span>
                  <span className="block text-micro font-normal text-ink-mute">
                    {t(`copilot.mode.${entry}.desc`)}
                  </span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="mb-4 flex flex-wrap items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] tint-violet">
              <Icon name="ai" size="sm" className="text-violet" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="m-0 text-title">{t('copilot.title')}</h1>
              <p className="m-0 text-micro font-normal text-ink-dim">{t('copilot.subtitle')}</p>
            </div>
            <StateBadge tone="green">{t('copilot.groundedBadge')}</StateBadge>
          </header>

          {/* The honesty line. Above the conversation rather than buried under
              it, because it changes how everything below should be read. */}
          <p className="m-0 mb-4 rounded-sm bg-sunken px-3 py-2 text-micro font-normal text-ink-dim">
            {t('copilot.preview')}
          </p>

          {prompts.isError ? (
            <ErrorState
              error={prompts.error}
              title={t('copilot.loadFailed')}
              onRetry={() => prompts.refetch()}
            />
          ) : prompts.isPending ? (
            <SkeletonRows count={3} />
          ) : messages.length === 0 ? (
            <div className="mx-auto w-full max-w-[42rem] py-6 text-center">
              <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-[14px] tint-violet">
                <Icon name="ai" size="lg" className="text-violet" />
              </span>
              <h2 className="m-0 text-display text-balance">{t('copilot.greeting')}</h2>
              {grounding ? (
                <p className="mt-2 mb-6 text-body text-ink-dim">
                  <Num>
                    {t('copilot.grounded', {
                      alerts: grounding.alerts,
                      assets: grounding.assets,
                    })}
                  </Num>
                </p>
              ) : null}

              <Eyebrow className="mb-2">{t('copilot.tryOne')}</Eyebrow>
              <div className="grid gap-2 text-start [grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr))]">
                {chips.map((prompt) => (
                  <Panel
                    key={prompt}
                    as="button"
                    type="button"
                    onClick={() => send(prompt)}
                    className="cursor-pointer text-start text-body-sm transition-colors hover:border-forge"
                  >
                    {prompt}
                  </Panel>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {messages.map((message) =>
                message.author === 'user' ? (
                  <ChatThread key={message.id} messages={[message]} bare />
                ) : (
                  <CopilotAnswer key={message.id} message={message} onSuggestion={send} />
                ),
              )}

              {asking ? (
                <p className="m-0 flex items-center gap-2 text-body-sm text-ink-dim">
                  <Icon name="ai" size="xs" className="text-violet" />
                  {t('copilot.thinking')}
                </p>
              ) : null}
              {/* Once, at the foot — `ChatThread` is rendered per message here
                  so the reasoning disclosure can sit between turns, and its own
                  disclaimer is suppressed to stop it repeating after each. */}
              <p className="m-0 text-body-sm text-ink-dim italic">
                {t('common:ai.disclaimer')}
              </p>
              <span ref={endRef} />
            </div>
          )}

          <form
            className="mt-4 flex items-center gap-2 rounded-sm border border-hairline bg-card ps-3.5 pe-2 py-2 focus-within:border-forge"
            onSubmit={(event) => {
              event.preventDefault()
              send(draft)
            }}
          >
            <label className="sr-only" htmlFor="copilot-ask">
              {t('copilot.placeholder')}
            </label>
            <input
              id="copilot-ask"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('copilot.placeholder')}
              className="w-full border-0 bg-transparent text-body text-ink outline-none placeholder:text-ink-dim"
            />
            {/* No microphone. The design has one and nothing behind it. */}
            <ForgeButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={!draft.trim() || asking}
            >
              <Icon name="send" size="xs" />
              <span className="max-sm:hidden">{t('copilot.send')}</span>
            </ForgeButton>
          </form>
        </div>
      </div>
    </Page>
  )
}

/** Wall-clock stamp on a turn. Local, because a transcript is read locally. */
function hhmm() {
  const at = new Date()
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}

/** Mode → rail icon. The design's four, mapped onto the sprite this app has. */
const MODE_ICON = { explore: 'search', trouble: 'wrench', maint: 'cal', alerts: 'bolt' }
