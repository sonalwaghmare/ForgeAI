import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { Num } from './primitives'
import { EvidenceTable } from './AiSurface'
import { STRIPE_CLASS, ON_TINT_CLASS } from '@/lib/tone'

/**
 * A Forge AI conversation.
 *
 * Messages are blocks, not markup strings — so nothing here parses HTML from a
 * model response, and an evidence table inside a reply renders through the same
 * component as every other evidence table in the product.
 *
 * The assistant's replies carry the violet leading edge because they are
 * AI-authored, and end in the verification disclaimer. The user's own messages
 * carry no stripe: a human wrote them, and violet on a human's words would break
 * the one thing that colour means here.
 *
 * This is the assistant's presentation everywhere it appears — the docked panel
 * in the app and the demonstration on the public page share it, so the two
 * cannot drift apart.
 */

/**
 * Every text node carries an explicit colour rather than relying on inherited
 * ink. `color` inherits as a resolved value, so a component that leans on
 * inheritance renders in whatever theme its ancestor resolved — which is fine
 * until it is placed on a surface the author did not anticipate.
 *
 * @param {object} props
 * @param {{id: string, author: 'user'|'ai', at: string, blocks: object[]}[]} props.messages
 * @param {boolean} [props.dense]  Tighter type, for the 360px docked panel.
 * @param {string} [props.label]   Accessible name for the conversation region.
 */
/**
 * @param {boolean} [bare] Suppress the trailing verification disclaimer.
 *   For a caller rendering ONE message per thread so it can interleave its own
 *   controls between turns — the Copilot screen's reasoning disclosure. That
 *   caller owns showing the disclaimer once at the foot of the transcript, and
 *   without this it would print after every answer.
 */
export function ChatThread({ messages, dense = false, bare = false, label, className }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <div
      role={label ? 'region' : undefined}
      aria-label={label}
      className={cn('flex flex-col', dense ? 'gap-3.5' : 'gap-5', className)}
    >
      {messages.map((message) =>
        message.author === 'user' ? (
          <div key={message.id} className="flex flex-col items-end">
            <p
              className={cn(
                'm-0 max-w-[86%] rounded-[12px_12px_2px_12px] border border-hairline bg-sunken px-3 py-2.5 text-ink',
                dense ? 'text-body-sm' : 'text-body',
              )}
            >
              {message.blocks.map((block, index) => (
                <span key={index}>{block.text}</span>
              ))}
            </p>
            {message.at ? (
              <Num className="mt-1.5 text-label font-bold text-ink-dim">{message.at}</Num>
            ) : null}
          </div>
        ) : (
          <div key={message.id}>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="ai" size="sm" className="text-violet" />
              <span className={cn('font-semibold text-on-violet', dense ? 'text-micro' : 'text-body-sm')}>
                {t('common:ai.authored')}
              </span>
              {message.at ? (
                <Num className="text-label font-bold text-ink-dim">{message.at}</Num>
              ) : null}
            </div>

            <div className="flex flex-col gap-2.5 border-s-[3px] border-s-violet ps-3.5">
              {message.blocks.map((block, index) => (
                <Block key={index} block={block} dense={dense} />
              ))}
            </div>
          </div>
        ),
      )}

      {bare ? null : (
        <p
          className={cn(
            'm-0 italic text-ink-dim',
            dense ? 'text-micro font-normal' : 'text-body-sm',
          )}
        >
          {t('common:ai.disclaimer')}
        </p>
      )}
    </div>
  )
}

function Block({ block, dense }) {
  const { t } = useTranslation('app')

  if (block.type === 'evidence') {
    return (
      <EvidenceTable
        label={t('analysis.evidenceEyebrow')}
        rows={block.rows}
        labelFor={(key) => t(`analysis.evidence.${key}`)}
        className="bg-card"
      />
    )
  }

  /**
   * A verdict is the assistant refusing or committing to something — the answer
   * to "can it wait". It takes the severity stripe of its own consequence,
   * because that is a machine-state claim rather than an authorship one.
   */
  if (block.type === 'verdict') {
    const tone = block.tone ?? 'red'
    return (
      <p
        className={cn(
          'm-0 rounded-sm border border-hairline bg-card px-3.5 py-3 font-semibold',
          STRIPE_CLASS[tone],
          ON_TINT_CLASS[tone],
          dense ? 'text-body-sm' : 'text-body',
        )}
      >
        {block.text}
      </p>
    )
  }

  return (
    <p
      className={cn(
        'm-0 max-w-[68ch] text-ink-dim',
        dense ? 'text-body-sm leading-relaxed' : 'text-body leading-[1.62]',
      )}
    >
      {block.text}
    </p>
  )
}
