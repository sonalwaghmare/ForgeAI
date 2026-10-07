import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChatThread } from '@/components/forge/ChatThread'
import { Chip } from '@/components/forge/Chip'
import { Eyebrow, Num } from '@/components/forge/primitives'
import { useStreamedBlocks } from './useStreamedBlocks'

/**
 * One answer, revealed as it is "written".
 *
 * DEMO. See `DEMO-MODE.md` §8.11.
 *
 * ── Why this is its own component ─────────────────────────────────────────
 * The reveal is a hook, and a hook cannot be called inside the `.map` that
 * renders the transcript. Each answer therefore owns its own progress, which is
 * also the behaviour you want: a new question does not restart the animation on
 * the three answers above it.
 *
 * ── What waits for the text to finish ─────────────────────────────────────
 * The follow-up chips. Offering somewhere to go next while the current answer
 * is still arriving is how a reader ends up clicking away from a sentence they
 * were half way through. The reasoning disclosure does NOT wait — it is a
 * control about the answer rather than part of it, and it is closed anyway.
 */
export function CopilotAnswer({ message, onSuggestion }) {
  const { t } = useTranslation(['app', 'common'])
  const [openReasoning, setOpenReasoning] = useState(false)

  const { blocks, streaming } = useStreamedBlocks(message.blocks)

  return (
    <div>
      {/* The design's Thought process disclosure. Kept because it is a
          provenance claim, and the steps name the records an answer really came
          from rather than being flavour. */}
      {message.reasoning.length ? (
        <div className="mb-1.5">
          <button
            type="button"
            onClick={() => setOpenReasoning((held) => !held)}
            aria-expanded={openReasoning}
            className="text-micro font-semibold text-ink-dim underline-offset-2 hover:text-ink hover:underline"
          >
            {openReasoning ? t('copilot.reasoningHide') : t('copilot.reasoningShow')}
          </button>
          {openReasoning ? (
            <div className="mt-1.5 rounded-sm bg-sunken px-3 py-2">
              <Eyebrow className="mb-1">{t('copilot.reasoningTitle')}</Eyebrow>
              <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
                {message.reasoning.map((step, index) => (
                  <li key={step} className="flex gap-2 text-micro font-normal text-ink-dim">
                    <Num className="text-ink-mute">{index + 1}.</Num>
                    {t(`copilot.reasoning.${step}`)}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}

      <ChatThread messages={[{ ...message, blocks }]} bare />

      {/* A caret, only while writing. One character, no animation frame of its
          own — the text arriving is the motion, and a second blinking thing
          beside it is noise. */}
      {streaming ? (
        <span aria-hidden="true" className="ms-3.5 inline-block text-body text-violet">
          ▌
        </span>
      ) : null}

      {!streaming && message.suggestions.length ? (
        <div className="mt-2.5 ps-3.5">
          <p className="m-0 mb-1.5 text-micro font-normal text-ink-dim">
            {t('copilot.fallbackTry')}
          </p>
          <div className="flex flex-wrap gap-2">
            {message.suggestions.map((prompt) => (
              <Chip key={prompt} onClick={() => onSuggestion?.(prompt)}>
                {prompt}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
