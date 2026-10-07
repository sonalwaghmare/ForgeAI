import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/forge/Icon'
import { Eyebrow, Num } from '@/components/forge/primitives'
import { ON_TINT_CLASS, TINT_CLASS } from '@/lib/tone'
import { cn } from '@/lib/cn'

/** Card heading. Same shape as the OEE module's, so the two screens rhyme. */
export function CardHead({ eyebrow, title, right, className }) {
  return (
    <div className={cn('mb-3.5 flex flex-wrap items-end gap-x-3 gap-y-1.5', className)}>
      <div className="min-w-0 flex-1">
        {eyebrow ? <Eyebrow className="mb-1">{eyebrow}</Eyebrow> : null}
        {title ? <h2 className="m-0 text-title text-balance">{title}</h2> : null}
      </div>
      {right ? <div className="shrink-0 text-body-sm text-ink-mute">{right}</div> : null}
    </div>
  )
}

/**
 * A horizontal bar.
 *
 * One tone per call, and the caller passes it. The prototype colours its four
 * cost bars red / amber / blue / purple by POSITION in the array, which is the
 * rainbow `TrendChart` refuses to draw: four hues that carry no meaning teach a
 * reader to read colour as significant on a screen where it is not.
 */
export function Bar({ value, tone = 'red', className }) {
  const clamped = Math.max(0, Math.min(100, value ?? 0))
  return (
    <span
      className={cn('block h-2.5 overflow-hidden rounded-xs bg-sunken', className)}
      aria-hidden="true"
    >
      <span
        className="block h-full rounded-xs"
        style={{ inlineSize: `${clamped}%`, backgroundColor: `var(--hue-${tone})` }}
      />
    </span>
  )
}

/**
 * A signed change, as an arrow and a figure.
 *
 * `invert` says a fall is the good direction — downtime cost improving is a
 * negative number and must not print red.
 */
export function Delta({ value, format, invert = false, className }) {
  if (value == null || value === 0) return null
  const improving = invert ? value < 0 : value > 0
  const tone = improving ? 'green' : 'red'
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', className)}>
      <Icon
        name={value > 0 ? 'up' : 'down'}
        size="xs"
        style={{ color: `var(--on-${tone})` }}
        aria-hidden="true"
      />
      <Num className={cn('text-micro font-semibold', ON_TINT_CLASS[tone])}>{format(value)}</Num>
    </span>
  )
}

/**
 * A confidence figure, as a pill.
 *
 * Tone comes from the number rather than from where the row sits, so a stream
 * nobody is sure of looks different from one Finance has signed off.
 */
export function ConfidencePill({ value, className }) {
  const { t } = useTranslation('app')
  const tone = value >= 90 ? 'green' : value >= 85 ? 'amber' : 'watch'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-xs px-1.5 py-0.5 text-micro font-semibold',
        TINT_CLASS[tone],
        ON_TINT_CLASS[tone],
        className,
      )}
    >
      <Num>{t('executive.confidenceShort', { percent: value })}</Num>
    </span>
  )
}

/**
 * The line every authored panel on this screen ends with.
 *
 * Same pattern as `anomalies.analysis.demoNotice` and `oee.demoNotice`. The
 * variant says WHICH figures are authored, because on this screen some of them
 * are not — the OEE, the anomaly counts and the downtime hours are the real
 * rollup, and a blanket "all of this is invented" would be its own lie.
 */
export function DemoNotice({ variant, className }) {
  const { t } = useTranslation('app')
  return (
    <p className={cn('m-0 mt-4 text-body-sm text-ink-mute italic', className)}>
      {t(`executive.demoNotice.${variant}`)}
    </p>
  )
}
