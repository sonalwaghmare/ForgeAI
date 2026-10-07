import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Icon } from '@/components/forge/Icon'
import { IconButton } from '@/components/forge/ForgeButton'
import { Chip } from '@/components/forge/Chip'
import { Mono, Num } from '@/components/forge/primitives'
import { AskOnSelection } from '@/components/forge/AskOnSelection'
import { isRcaRunning } from '@/features/anomalies/api'
import { useAnomalyRca, useRequestAnomalyRca } from '@/features/anomalies/queries'
import { useCopilotConversation } from '@/features/copilot/useCopilotConversation'
import { useAnomalyConversation } from '@/features/copilot/history'
import { useRevealedText } from '@/features/copilot/useRevealedText'
import { queryKeys } from '@/services/queryClient'
import { cn } from '@/lib/cn'

/**
 * The assistant is docked, contextual and dismissible. It explains the data and
 * never competes with it — this is not a chat window with the plant behind it.
 *
 * Every answer here comes from the copilot service, which verifies each claim
 * against the records it read and strips anything unsupported before emitting it.
 * Nothing in this file invents, summarises or reformats an answer: the text that
 * arrives is the text that is shown, and the sources beneath it are what it rests
 * on. That is the whole reason the panel is trustworthy, and it is one edit away
 * from not being.
 *
 * The dock is the one authored motion moment in the shell: a 500ms
 * exponential-ease width expansion with the panel sliding in from the inline
 * end. `will-change` and `contain` bound the reflow so a 360px animation does
 * not repaint the table beside it.
 *
 * ── Investigate opens the conversation, it does not replace it ────────────
 * `Investigate` anywhere in the app arrives here as an `investigation` token
 * rather than as a separate code path: the dock grounds on the anomaly and asks
 * the copilot the same question the user could have typed. There is no second
 * mechanism for starting an analysis, which is the point — the copilot is the
 * surface, and `run_rca` is one tool inside it.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {{id: string, assetName?: string}|null} props.anomaly the record the
 *   conversation is grounded on
 * @param {string[]} props.prompts the `dock.prompts.*` ids to offer under the
 *   transcript, resolved from the screen the dock is sitting beside — see
 *   `features/copilot/prompts`
 * @param {{anomalyId: string, token: string}|null} props.investigation a
 *   pending request to have the copilot start an analysis, consumed once
 * @param {{anomalyId: string, token: string, text: string}|null} props.quoted a
 *   passage the reader highlighted elsewhere on the screen, to be attached to the
 *   composer rather than sent — consumed once, like an investigation, and added to
 *   whatever is already attached rather than replacing it
 */
export function AssistantDock({ open, anomaly, prompts, investigation, quoted, onClose }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <div
      className={cn(
        'shrink-0 overflow-hidden [contain:layout_paint] [will-change:width]',
        '[transition:width_.5s_var(--ease-out-expo)]',
        // The dock is desktop and landscape-tablet only. On a narrow floor
        // tablet the data must keep the full width.
        'max-lg:!w-0',
      )}
      style={{ width: open ? 'var(--dock-w)' : 0 }}
      aria-hidden={!open}
    >
      <aside
        aria-label={t('dock.title')}
        className={cn(
          'flex h-full flex-col border-s border-hairline bg-card shadow-dock',
          'dark:backdrop-blur-[20px] dark:backdrop-saturate-[1.8]',
          open && 'animate-dock-in',
        )}
        style={{ width: 'var(--dock-w)' }}
      >
        <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
          <span className="flex size-6.5 shrink-0 items-center justify-center rounded-[7px] tint-violet">
            <Icon name="ai" size="sm" className="text-violet" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-control">{t('dock.title')}</div>
            <div className="truncate text-micro font-normal text-ink-dim">
              {anomaly?.assetName ?? anomaly?.serialNumber ?? t('screens.anomalies')}
            </div>
          </div>
          <IconButton bare label={t('dock.close')} onClick={onClose} className="size-7">
            <Icon name="x" size="sm" />
          </IconButton>
        </div>

        {/* Keyed by the record, so changing anomaly is a new component rather than
            a reset. Clearing in place would render one frame of the previous
            anomaly's answers under the new anomaly's heading — the worst possible
            moment to be wrong about what the copilot was discussing. */}
        <Conversation
          key={anomaly?.id ?? 'none'}
          anomaly={anomaly}
          prompts={prompts}
          investigation={investigation}
          quoted={quoted}
        />
      </aside>
    </div>
  )
}

function Conversation({ anomaly, prompts = [], investigation, quoted }) {
  const { t } = useTranslation(['app', 'common'])
  const client = useQueryClient()
  const [draft, setDraft] = useState('')
  const scope = anomaly ? { page_anomaly_id: anomaly.id } : {}

  /**
   * The copilot writes, so the page behind the dock can go stale.
   *
   * `run_rca` requests an analysis through the backend. Two things behind the dock
   * are then wrong until they are refetched:
   *
   *   - The anomaly screen holds that same analysis in its own query and branches
   *     four ways on it. Without this it would keep showing "no analysis has been
   *     run" beside a copilot that had just started one.
   *   - Every anomaly LIST carries `rca_status` on each row, and the severity band
   *     asks for `rca_status=pending` — the anomalies nobody has investigated. An
   *     anomaly that has just been investigated has to leave that list, or the band
   *     keeps offering the thing that was just done.
   *
   * So the list root as well as the one analysis, and nothing wider than that.
   */
  const onTurnEnd = useCallback(
    ({ tools }) => {
      if (!anomaly || !tools.includes('run_rca')) return
      client.invalidateQueries({ queryKey: queryKeys.anomalyRca(anomaly.id) })
      client.invalidateQueries({ queryKey: queryKeys.anomaliesList })
    },
    [anomaly, client],
  )

  /**
   * What was already asked about this record, read back so the panel does not open
   * empty on an anomaly somebody has already investigated.
   *
   * Cached per anomaly and never refetched: the only thing that adds to this
   * transcript is this panel, and the turn on screen is already in its own state.
   * `history.data` is `undefined` until it lands, which is what the hook below
   * waits for — a seed of `undefined` is "not yet", not "nothing".
   */
  const history = useAnomalyConversation(anomaly?.id)
  const { messages, ask, isStreaming } = useCopilotConversation(scope, {
    onTurnEnd,
    history: history.data,
  })

  /**
   * Nothing may be asked while this anomaly's analysis is still running.
   *
   * `queued` means the request is on the engine's queue and its content is empty.
   * Every question the panel could usefully answer about this record is a question
   * about that analysis, so a turn sent now can only report the wait again — and it
   * would cost a real model call to do it. Closing the input is the honest version
   * of an answer that would have said "still running" anyway.
   *
   * Same query key the anomaly screen uses, so on that screen this is free — the two
   * read one cached row rather than each fetching it. `poll` is on for the case where
   * the dock is the only reader: without it the input would stay shut after the
   * analysis had landed, waiting for something else to notice. The hook stops its own
   * timer the moment the row is no longer running, so it costs nothing at rest.
   */
  const rca = useAnomalyRca(anomaly?.id, { poll: true })
  const analysing = isRcaRunning(rca.data)

  /**
   * Start the analysis directly, rather than waiting for the model to decide to.
   *
   * `POST /anomalies/{id}/rca/request` is what actually queues an RCA, and until
   * now Investigate reached it only through the copilot's `run_rca` tool — so the
   * analysis started one model round-trip after the button was pressed, about a
   * second and a half on a good turn. It also started only IF the model chose to
   * call the tool, which is not a guarantee: a turn that answered in prose instead
   * left the anomaly with no analysis requested and nothing on screen to say so.
   *
   * Firing it here makes the request deterministic and immediate. The copilot is
   * still asked the same question, and its own `run_rca` is idempotent server-side
   * — a second call returns the existing row rather than failing — so the two
   * cannot race into two analyses.
   */
  const requestRca = useRequestAnomalyRca(anomaly?.id)
  /**
   * A question does not require a record.
   *
   * The dock used to refuse to send anything until it was grounded, which was right
   * while every suggestion it offered was about "this anomaly". It is not right for
   * the anomalies list, where the useful question is about the population and there
   * is nothing to ground on — the turn goes out with an empty scope, which is what
   * `useCopilotConversation` already sends when the dock is not grounded.
   *
   * `analysing` is false with no anomaly, so the running-analysis lock is unaffected.
   */
  const canAsk = !isStreaming && !analysing

  /**
   * Consume a pending Investigate.
   *
   * Guarded on the token rather than on a boolean, so investigating the same
   * anomaly twice — start one, read it, ask again — fires twice, while a re-render
   * or a change in `ask`'s identity mid-stream fires nothing. The anomaly id is
   * checked as well because the dock is grounded a frame before this component
   * remounts under its new key, and a request meant for the record you just opened
   * must not be answered against the one you just left.
   */
  /**
   * Follow the answer down as it arrives — but stop the moment the reader takes
   * over.
   *
   * A panel that scrolls itself while somebody is reading the top of a long answer
   * is worse than one that never scrolls: they lose their place and cannot get it
   * back without fighting the page. So it pins to the bottom only while it is
   * already at the bottom, and a single scroll upward hands control over for the
   * rest of the turn.
   */
  const scroller = useRef(null)
  const pinned = useRef(true)

  const onScroll = () => {
    const node = scroller.current
    if (!node) return
    // A few pixels of slack: sub-pixel layout means an element parked at the
    // bottom rarely reports exactly zero.
    pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < 24
  }

  useEffect(() => {
    const node = scroller.current
    if (!node || !pinned.current) return
    node.scrollTop = node.scrollHeight
  }, [messages])

  /**
   * The passages the reader highlighted, held until they send something with them.
   *
   * Local to the composer rather than lifted, because it is draft state: it lives
   * and dies with the half-written question beside it, and the shell has no
   * business knowing whether a citation has been used yet.
   *
   * ── A list, because one question is often about two places ────────────────
   * This held a single passage and each new quote replaced it, which quietly
   * threw away the most useful question anyone asks of an analysis: how these two
   * things relate. Comparing a ranked cause against the evidence under it now
   * means quoting both and asking once, rather than quoting one and retyping the
   * other.
   *
   * Keyed by the shell's own token rather than by array index, so removing the
   * first card cannot make React reuse its DOM for the second — which with text
   * this long is a card that visibly changes its contents in place.
   */
  const [citations, setCitations] = useState([])
  const input = useRef(null)
  const quotedRef = useRef(null)

  const removeCitation = useCallback(
    (id) => setCitations((current) => current.filter((entry) => entry.id !== id)),
    [],
  )

  /**
   * Attach a passage the reader selected inside the transcript itself.
   *
   * The shell's `quote` route cannot serve this: it grounds the dock on an anomaly
   * and opens it, both of which already happened — the reader is looking at the
   * panel. So this is the same append with none of the ceremony, and it is why the
   * id is minted here rather than being the shell's token.
   *
   * Quoting an answer back at the copilot is the question this panel most often
   * gets: an answer names a cause, a threshold or a record, and the next thing
   * somebody wants is that one clause explained. Before this, the only quotable
   * text in the product was the anomaly screen behind the dock — so the copilot
   * could be asked about anything except what it had just said.
   */
  const addCitation = useCallback((text) => {
    setCitations((current) => [...current, { id: crypto.randomUUID(), text }])
    input.current?.focus()
  }, [])

  useEffect(() => {
    if (!quoted || !anomaly) return
    if (quoted.anomalyId !== anomaly.id) return
    /* The shell holds ONE pending quote and re-stamps it, so the token is what
       says "this is a new passage" rather than the same one re-delivered by a
       re-render. Appended rather than assigned for that reason: without the guard
       every render would add the same card again. */
    if (quotedRef.current === quoted.token) return
    quotedRef.current = quoted.token
    setCitations((current) => [...current, { id: quoted.token, text: quoted.text }])
    /* Focus follows the citation. The reader has just told the panel what they
       want to ask about; asking them to click into the field to say what is one
       step this control exists to remove. */
    input.current?.focus()
  }, [quoted, anomaly])

  const consumed = useRef(null)
  useEffect(() => {
    if (!investigation || !anomaly) return
    if (investigation.anomalyId !== anomaly.id) return
    if (consumed.current === investigation.token) return
    consumed.current = investigation.token

    /* The question first, so the panel shows what was asked in the same frame the
       dock opens. The request goes out immediately after it — same tick, no await
       between them — which is what makes "queued" the state by the time the reader
       has read the question, rather than a second and a half later. */
    ask(t('dock.prompts.investigate'))
    requestRca.mutate()
    // `requestRca` is a mutation object and changes identity on every state it
    // moves through; depending on it would re-run this effect mid-flight. The token
    // guard above is what makes the request happen exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investigation, anomaly, ask, t])

  /**
   * Forget what was consumed when the conversation is torn down.
   *
   * A ref outlives React's mount → cleanup → mount replay, and the turn it guards
   * does not: the conversation's own cleanup aborts the stream on the way through.
   * So the first pass asked, the teardown killed it, and the second pass looked at
   * the ref, decided the question had already been asked, and left the panel
   * reading "Working…" with nothing behind it — for good. Clearing the marker
   * alongside the thing it was tracking is what makes the replay ask again.
   *
   * Mount-only. Hanging it off the effect above would clear the marker on every
   * render, since `ask` changes identity with the scope object it closes over.
   */
  useEffect(() => () => {
    consumed.current = null
  }, [])

  /**
   * Send a question, with the citations in front of it when there are any.
   *
   * The quotes go into the MESSAGE rather than travelling beside it, because the
   * copilot has one channel and this is it — a citation the model never receives
   * would be a card that decorates the composer and changes no answer. Composed
   * from a locale string so the phrasing is readable in one place.
   *
   * Passages are joined in the order they were quoted, each on its own line, and
   * the wrapper pluralises. Order is worth preserving: "this, then that" is how
   * somebody selected them and usually what the comparison means.
   *
   * Used by the chips as well as the field: having quotes attached and then
   * pressing a suggestion should ask that suggestion ABOUT them, not quietly drop
   * them.
   */
  const send = (question) => {
    if (!canAsk || !question.trim()) return
    ask(
      citations.length
        ? t('dock.quotedAsk', {
            count: citations.length,
            quotes: citations.map((entry) => t('dock.quoted.text', { quote: entry.text })).join('\n'),
            question,
          })
        : question,
    )
    setCitations([])
  }

  const submit = (event) => {
    event.preventDefault()
    const question = draft
    setDraft('')
    send(question)
  }

  return (
    <>
      {/* Selection inside the transcript, scoped to the answers.
          `within` is what keeps it off the reader's own questions and off the
          panel's furniture — see `AskOnSelection`. The anomaly screen mounts its
          own instance over its own container; the two cannot both fire, because
          each requires both ends of the selection inside its own region. */}
      <AskOnSelection containerRef={scroller} within="[data-quotable]" onAsk={addCitation} />

      <div ref={scroller} onScroll={onScroll} className="flex-1 overflow-y-auto p-4" aria-live="polite">
        {/* The invitation to ground the panel, only while there is nothing in it.
            Once an ungrounded question has been asked, the transcript is what the
            reader came for and the notice would be sitting above its own answer. */}
        {!anomaly && messages.length === 0 ? (
          <p className="text-body-sm text-ink-dim">{t('dock.noContext')}</p>
        ) : messages.length === 0 && history.isPending ? (
          /* Said rather than left blank. The empty prompt below invites a question;
             showing it while a transcript is still on its way would tell the reader
             nothing has ever been asked about this anomaly, a beat before proving
             otherwise. */
          <p className="text-body-sm text-ink-dim">{t('dock.restoring')}</p>
        ) : messages.length === 0 ? (
          <p className="text-body-sm text-ink-dim">{t('dock.empty')}</p>
        ) : (
          <div className="flex flex-col gap-3.5">
            {messages.map((message, position) =>
              message.role === 'user' ? (
                <p
                  key={message.id}
                  className="ms-auto max-w-[86%] rounded-[12px_12px_2px_12px] border border-hairline bg-sunken px-3 py-2.5 text-body-sm"
                >
                  {message.text}
                </p>
              ) : (
                <AssistantTurn
                  key={message.id}
                  message={message}
                  // Only the last turn can still be arriving, and only while the
                  // connection is open. An older turn re-typing itself on a
                  // re-render would be the panel inventing activity.
                  live={isStreaming && position === messages.length - 1}
                />
              ),
            )}
          </div>
        )}
      </div>

      {/* Lifted off the bottom edge. `py-3` sat the send button flush against the
          panel's last pixel, which on a dock that runs the full height of the window
          reads as the composer being cut off by the viewport rather than resting in
          it — and it is the one control here that is aimed at rather than flicked.
          Asymmetric on purpose: the space belongs under the field, not above the
          chips, which already have the transcript's own padding over them. */}
      <div className="border-t border-hairline px-4 pt-3 pb-5">
        {/* Said, not merely shown. An input that stops accepting text with no reason
            given reads as a fault in the panel rather than as a state of the record —
            and the reason is one the reader wants anyway. */}
        {analysing ? (
          <p className="mb-2.5 flex items-start gap-1.5 text-micro font-normal text-ink-dim">
            <Icon name="ai" size="xs" className="mt-0.5 shrink-0 text-violet" />
            <span>{t('dock.analysing')}</span>
          </p>
        ) : null}

        {/* ── The suggestions, and when they get out of the way ──────────
            Hidden the moment a passage is attached. These are for the reader who has
            not decided what to ask; somebody who has just highlighted a clause has
            decided, and the suggestions stop being suggestions and become three
            things competing with the quote they were about to ask about.

            They also do not mean the same thing any more. `send` puts the citations
            in front of whatever it is given, so pressing "Draft a work order" with a
            passage attached asks it ABOUT that passage — which is right, and is not
            what the chip appears to promise. Removing them removes the ambiguity
            rather than explaining it.

            The row goes entirely rather than being disabled: a control greyed out
            for a reason nobody can see is worse than one that is not there, and the
            reason here is visible directly below it. */}
        {citations.length ? null : (
          <div className="flex gap-1.5 overflow-x-auto pb-2.5">
            {prompts.map((key) => (
              <Chip
                key={key}
                className="shrink-0 disabled:pointer-events-none disabled:opacity-40"
                disabled={!canAsk}
                onClick={() => send(t(`dock.prompts.${key}`))}
              >
                {t(`dock.prompts.${key}`)}
              </Chip>
            ))}
          </div>
        )}
        {/* ── The composer ───────────────────────────────────────────────
            One bordered box holding the quoted passages and the field, rather
            than a block stacked on top of a separate input. The border and the
            focus ring belong to the box for that reason: the quotes are part of
            what is about to be sent, and two adjacent outlines would read as two
            controls that happen to touch. */}
        <div className="rounded-sm border border-hairline bg-page focus-within:border-forge">
          {citations.length ? (
            /**
             * The quoted passages, as cards.
             *
             * ── Why cards and not the single truncated line this was ──────────
             * One line held one passage and said about six words of it, which is
             * enough to know a quote is attached and not enough to know WHICH —
             * and with several attached that is the only question the reader has.
             * A card clamped to six lines shows the shape of the passage: where it
             * starts, roughly how long it is, whether it is prose or a value.
             *
             * Clamped by CSS with the full text on `title`, not sliced in JS. A
             * passage cut at a character count breaks at whatever the panel width
             * happens to be, and the ellipsis a browser draws is placed against
             * the actual rendered width.
             *
             * Scrolls sideways rather than wrapping or capping the count. Wrapping
             * would let the composer grow up the panel and eat the transcript;
             * a cap would silently refuse a quote the reader deliberately made.
             *
             * ── The scrollbar is hidden, and a count says so instead ──────────
             * A horizontal bar under a 96px row is a permanent strip of the panel
             * spent on a control nobody aims at — this row is flicked or wheeled.
             * So it is hidden, and because a hidden scrollbar also hides the fact
             * that there is anything to scroll, the trailing counter below says how
             * many passages are attached. Two cards do not fit at this width, so
             * from the second one onward the number is the difference between what
             * is on screen and what is held.
             *
             * The usual companion to a hidden scrollbar — a fade at the edge — is a
             * gradient, which DESIGN.md forbids outright. Saying it in a numeral is
             * also simply more informative: a fade says "more", the count says how
             * much more.
             *
             * The row's own padding is what keeps the remove buttons visible:
             * `overflow-x` clips the cross axis too, so a control hanging off the
             * top-inline-start corner has to sit inside the padding box.
             */
            <ul
              aria-label={t('dock.quoted.label')}
              className="scrollbar-none m-0 flex list-none gap-2 overflow-x-auto p-2.5"
            >
              {citations.map((entry) => (
                <li key={entry.id} className="relative shrink-0">
                  {/* The rule is the blockquote convention and nothing more —
                      neutral, never violet. Violet is reserved for text the
                      machine authored, and what is quoted here is whatever a
                      person happened to highlight. */}
                  <div className="flex w-[152px] gap-2 rounded-xs border border-subtle bg-card p-2">
                    <span aria-hidden="true" className="w-[3px] shrink-0 self-stretch rounded-pill bg-ink-mute" />
                    {/* Exactly six lines tall whatever is in it, so a two-line
                        quote and a clamped one are the same card. Sized to the
                        clamp in `lh` — the element's own line box — rather than
                        to a pixel figure, because the two must not be able to
                        disagree: a height in px and a clamp in lines drift apart
                        the moment the type scale is retuned, and the failure is a
                        strip of dead space under the text or a line cut in half. */}
                    <p
                      className="m-0 line-clamp-6 h-[6lh] min-w-0 flex-1 text-micro font-normal text-ink-dim"
                      title={entry.text}
                    >
                      {entry.text}
                    </p>
                  </div>
                  {/* At the corner, and always visible rather than on hover.
                      Hover-only is the desktop convention and this product is read
                      on a floor tablet, where there is no hover to reveal it —
                      the control would simply not exist. Logical inset, so it
                      moves to the other corner under dir="rtl". */}
                  <IconButton
                    bare
                    label={t('dock.quoted.clear')}
                    onClick={() => removeCitation(entry.id)}
                    className={cn(
                      'absolute -top-1.5 -start-1.5 size-5 rounded-pill max-lg:size-6',
                      'border border-hairline bg-card shadow-edge',
                      'opacity-75 transition-opacity hover:opacity-100',
                    )}
                  >
                    <Icon name="x" size="xs" />
                  </IconButton>
                </li>
              ))}

              {/* How many are attached, pinned to the trailing edge.
                  `sticky` inside the scroller rather than placed outside it, so it
                  stays put while the cards move under it and costs no layout of its
                  own once the row is scrolled — the reason it can be there at all in
                  a panel this narrow.

                  Hidden from assistive technology: the list above it is labelled and
                  enumerated already, so this would be the same count said twice. It
                  exists for the reader who cannot see a scrollbar that is no longer
                  drawn. */}
              {citations.length > 1 ? (
                <li
                  aria-hidden="true"
                  className="sticky -end-2.5 z-10 flex shrink-0 items-center bg-page ps-1.5"
                  title={t('dock.quoted.count', { count: citations.length })}
                >
                  <span className="num rounded-pill border border-subtle bg-sunken px-1.5 py-0.5 text-micro font-normal text-ink-dim">
                    {citations.length}
                  </span>
                </li>
              ) : null}
            </ul>
          ) : null}

          {/* Taller than it was. The field is the one thing in this panel a reader
              types into rather than reads, and at the old height it was a 28px slot
              under a 96px stack of quote cards — the smallest target in the dock
              sitting under the largest object in it. The type steps up to `body`
              with it: `control` is the size labels are set at, and this is prose. */}
          <form className="flex items-center gap-1.5 py-2.5 pe-2 ps-3.5" onSubmit={submit}>
            <label className="sr-only" htmlFor="dock-ask">
              {t('dock.askLabel')}
            </label>
            <input
              id="dock-ask"
              ref={input}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!canAsk}
              className="min-w-0 flex-1 border-0 bg-transparent text-body font-normal outline-none placeholder:text-ink-dim disabled:opacity-60"
              placeholder={anomaly ? t('dock.askPlaceholder') : t('dock.askPlaceholderAny')}
            />
            <button
              type="submit"
              disabled={!canAsk || !draft.trim()}
              aria-label={t('common:actions.send')}
              className="flex size-8 shrink-0 items-center justify-center rounded-xs bg-forge text-white transition-[filter] hover:brightness-[1.08] disabled:opacity-40"
            >
              <Icon name="send" size="sm" />
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

/**
 * One assistant turn: what it is doing, what it answered, what that rests on.
 *
 * The sources are not decoration. The service strips any claim it cannot tie to a
 * record, so the list underneath is the difference between an answer and an
 * assertion — hiding it would throw away the only thing that makes the text worth
 * believing.
 */
/* Up to this many sources read at a glance; beyond it they are a wall. Answers on
   an anomaly's own page cite one or two, so the common case is unchanged. */
const INLINE_SOURCES = 3

function AssistantTurn({ message, live = false }) {
  const { t } = useTranslation(['app', 'common'])

  /**
   * The engine emits one delta per verified sentence, so the raw text grows in
   * sentence-sized jumps — readable, but it reads as blocks appearing rather than
   * as something being written. This paces those jumps into characters.
   *
   * It only ever shows a prefix of what actually arrived. The pacing is the whole
   * of what is added; no character on screen is one the verifier had not already
   * passed.
   */
  const { text, catchingUp } = useRevealedText(message.text ?? '', live, message.replayed)

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-micro text-on-violet">
        <Icon name="ai" size="sm" />
        {t('common:ai.authored')}
      </div>

      {/* ── What it is doing, step by step ─────────────────────────────
          The engine reports every tool call it opens and closes, and this is the
          only place a reader can see that the answer came from somewhere. It
          replaces a single "Reading {tool}…" line, which could hold one name at a
          time and so could not describe a turn that resolves an entity and searches
          anomalies at once — which is most of them.

          Shown only while the turn is live. These are the THINKING, and once there
          is an answer the durable record of where it came from is `sources` below:
          a permanent list of tool calls under every past reply would be the panel
          keeping its own workings on screen after they stopped being the news.

          The names are the engine's own identifiers, so they are monospaced —
          DESIGN.md reserves that for machine strings, and inventing friendly labels
          for them here would be this file writing copy about a vocabulary the
          server owns. */}
      {live && message.stages?.length ? (
        <ul aria-label={t('dock.stages')} className="m-0 mb-2 flex list-none flex-col gap-1">
          {message.stages.map((stage, position) => (
            <li key={`${stage.name}-${position}`} className="flex items-center gap-1.5 text-micro">
              {stage.ms == null ? (
                /* Running. The same pulsing dot the severity band uses for a live
                   thing, at the size a list item can afford. */
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full bg-violet motion-safe:animate-pulse"
                />
              ) : (
                <Icon name="check" size="xs" aria-hidden="true" className="shrink-0 text-violet" />
              )}
              <Mono className="truncate text-ink-dim">{stage.name}</Mono>
              {/* Tabular, because these are a column of comparable figures even
                  when the column is two rows long. */}
              {stage.ms == null ? null : (
                <Num className="ms-auto shrink-0 text-ink-mute">
                  {t('dock.stageMs', { ms: stage.ms })}
                </Num>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {text ? (
        /* `data-quotable` is what `AskOnSelection` in the transcript scopes to.
           On the ANSWER alone, not on the turn: the provenance list, the "Reading
           {tool}…" line and the disambiguation chips around it are this panel's own
           furniture, and a quote pulled out of them would be the copilot being asked
           to explain its own interface. */
        <p data-quotable className="whitespace-pre-wrap text-body-sm leading-relaxed">
          {text}
          {/* The caret says "there is more coming", which is the one thing a
              half-written answer has to communicate. It is dropped the instant
              nothing more is arriving, so a finished answer never looks live. */}
          {catchingUp ? (
            <span
              aria-hidden="true"
              className="ms-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] bg-ink-dim motion-safe:animate-pulse"
            />
          ) : null}
        </p>
      ) : !message.error ? (
        /* Still said when stages are on screen above it: a finished stage list with
           no answer under it looks like a turn that stopped, and the one thing this
           line exists to say is that something is still coming. */
        <p className="text-body-sm italic text-ink-dim">{t('dock.thinking')}</p>
      ) : null}

      {message.error ? (
        <p className="mt-2 text-body-sm text-danger">{t('dock.failed')}</p>
      ) : null}

      {message.chips?.length ? (
        <div className="mt-3">
          <div className="mb-1.5 text-micro text-ink-dim">{t('dock.chipsPrompt')}</div>
          <div className="flex flex-wrap gap-1.5">
            {message.chips.map((choice) => (
              <Chip key={`${choice.kind}-${choice.id}`}>{choice.label}</Chip>
            ))}
          </div>
        </div>
      ) : null}

      {/* Folded once there are more than a handful.

          The sources are not decoration — the service strips any claim it cannot tie
          to a record, so this list is the difference between an answer and an
          assertion, and it does not get removed. But an answer that read ten
          anomalies printed ten full titles under two lines of prose, which buries
          the answer under its own footnotes and is worst exactly where those records
          are already on screen behind the dock.

          So: a count, always visible, and the records one click away. Few enough to
          read at a glance and it opens itself, which keeps the common case — one or
          two records on an anomaly's own page — exactly as it was. `details` rather
          than a button, so it is keyboard-operable and expandable without state. */}
      {message.sources?.length && !catchingUp ? (
        <details className="mt-3" open={message.sources.length <= INLINE_SOURCES}>
          <summary className="mb-1.5 cursor-pointer text-micro uppercase tracking-wide text-ink-dim marker:text-ink-dim">
            {message.sources.length <= INLINE_SOURCES
              ? t('dock.sources')
              : t('dock.sourcesCount', { count: message.sources.length })}
          </summary>
          <ul className="flex flex-col gap-1">
            {message.sources.map((source) => (
              <li
                key={`${source.kind}-${source.pg_id}`}
                className="truncate text-micro font-normal text-ink-dim"
                title={source.pg_id}
              >
                {source.label ?? source.pg_id}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {/* Both wait for the answer to settle. A disclaimer under half a sentence,
          or a source list that grows while the text above it is still being
          written, reads as the panel finishing before it has. */}
      {message.text && !catchingUp ? (
        <p className="mt-3.5 text-micro font-normal italic text-ink-dim">
          {t('common:ai.disclaimer')}
        </p>
      ) : null}
    </div>
  )
}
