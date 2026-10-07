import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'
import { Eyebrow } from './primitives'

/**
 * Anything the AI authored is marked by convention, never by ornament.
 *
 * Reasoning Violet, flat — never a gradient. The prototype rendered the
 * assistant as a 135° violet-to-blue gradient, which is the most recognisable
 * generated-software signature in current software; flat violet plus the node
 * glyph carries the same meaning with none of the smell. No sparkle, no wand,
 * no robot, no emoji.
 *
 * If violet appears on a surface a human wrote, the system has broken.
 */

/**
 * SecInsight — a one-sentence machine observation placed *outside and above* a
 * card, in ordinary body type with a small violet glyph. The machine narrates
 * the data rather than occupying a panel beside it, which is what keeps the
 * assistant from turning the product into a chat window.
 */
export function AiInsight({ className, children }) {
  return (
    <p className={cn('flex max-w-[76ch] items-start gap-2 text-body', className)}>
      <Icon name="ai" size="sm" className="mt-0.5 text-violet" />
      <span>{children}</span>
    </p>
  )
}

/**
 * A block of AI-authored content: violet leading edge, a provenance eyebrow
 * naming where it came from, and an italic disclaimer requiring human
 * verification.
 *
 * @param {object} props
 * @param {string} props.provenance  Names what produced this. Not decoration.
 * @param {boolean} [props.disclaim] Append the verification disclaimer.
 */
export function AiPanel({ provenance, disclaim = true, className, children, ...rest }) {
  const { t } = useTranslation()
  return (
    <div
      className={cn('rounded-sm border border-hairline stripe-violet bg-card p-4.5 shadow-edge', className)}
      {...rest}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon name="ai" size="sm" className="text-violet" />
        <Eyebrow>{provenance}</Eyebrow>
      </div>
      {children}
      {disclaim ? (
        <p className="mt-3.5 text-micro font-normal italic text-ink-dim">{t('ai.disclaimer')}</p>
      ) : null}
    </div>
  )
}

/**
 * The evidence table. Key on the start edge, machine value on the end edge in
 * mono — provenance is always on screen, not behind a disclosure.
 *
 * @param {object} props
 * @param {{key: string, value: string}[]} props.rows
 * @param {(key: string) => string} [props.labelFor] Translator for row keys.
 */
export function EvidenceTable({ rows, labelFor, label, className }) {
  return (
    <dl className={cn('rounded-sm border border-hairline stripe-violet bg-page px-3 py-2.5', className)}>
      {label ? <Eyebrow as="dt" className="mb-2 block">{label}</Eyebrow> : null}
      {rows.map((row, index) => (
        <div
          key={row.key}
          className={cn(
            'flex items-baseline justify-between gap-2.5 py-1',
            index > 0 && 'border-t border-subtle',
          )}
        >
          <dt className="text-body-sm text-ink-dim">{labelFor ? labelFor(row.key) : row.key}</dt>
          <dd className="mono m-0 text-body-sm text-end">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
