import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/forge/Icon'
import { Eyebrow, Num } from '@/components/forge/primitives'
import { cn } from '@/lib/cn'
import { formatDecimal, formatPercent } from '@/lib/format'

/**
 * The three small objects the OEE tabs all reach for.
 *
 * Here rather than in `components/forge/` because none of them has a second
 * caller yet, and a shared component with one user is a guess about the future
 * that has to be maintained anyway. If Executive or Lines wants the gauge, this
 * is the file it moves out of.
 */

/**
 * A movement against the prior comparable window, as an arrow and a figure.
 *
 * `invert` is for the measures where down is the good direction — MTTR, scrap,
 * stops — so no call site has to reach for a colour to fix the sign.
 */
export function DeltaValue({ value, invert = false, suffix, className }) {
  const { t } = useTranslation('app')
  if (value == null) return null

  const flat = Math.abs(value) < 0.05
  const improving = flat ? null : invert ? value < 0 : value > 0
  const tone = improving == null ? null : improving ? 'green' : 'red'

  return (
    <span
      className={cn('inline-flex items-center gap-1 text-micro font-semibold', className)}
      style={tone ? { color: `var(--on-${tone})` } : { color: 'var(--ink-mute)' }}
    >
      {flat ? (
        <Icon name="right" size="xs" aria-hidden="true" />
      ) : (
        <Icon name={value > 0 ? 'up' : 'down'} size="xs" aria-hidden="true" />
      )}
      <Num>
        {formatDecimal(Math.abs(value))}
        {suffix ?? t('oee.pts')}
      </Num>
    </span>
  )
}

/**
 * A percentage as a ring — the design's `Donut`.
 *
 * `HealthRing` is the same drawing on a different ladder and rounds to a whole
 * number, which loses the tenth that this whole screen turns on: 74.2 and 74.4
 * are a different answer to "did we hit the target". So this one takes its tone
 * explicitly and prints what it was given.
 *
 * The figure sits inside the ring. Outside it, the ring is a second object
 * competing with the number rather than the gloss on it.
 */
export function Gauge({ value, tone = 'forge', size = 104, label, caption, digits = 1 }) {
  const clamped = Math.max(0, Math.min(100, value ?? 0))
  const stroke = size >= 90 ? 10 : 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        role="img"
        aria-label={`${label}: ${formatPercent(clamped, digits)}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-sunken)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`var(--hue-${tone})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          // Twelve o'clock. A gauge that starts at three reads as already
          // part-way round before it has measured anything.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <Num
          className="leading-none font-bold"
          style={{ color: `var(--on-${tone})`, fontSize: size * 0.23 }}
        >
          {formatPercent(clamped, digits)}
        </Num>
        {caption ? (
          <span className="eyebrow" style={{ fontSize: size * 0.095 }}>
            {caption}
          </span>
        ) : null}
      </div>
    </div>
  )
}

/**
 * A card head — eyebrow, title, and whatever sits on the end of the line.
 *
 * The design puts one of these on eighteen cards, and eighteen hand-written
 * flex rows is how the gap under the heading ends up being three different
 * numbers on one screen.
 */
export function CardHead({ eyebrow, title, right, className }) {
  return (
    <div className={cn('mb-3.5 flex flex-wrap items-end gap-x-3 gap-y-1.5', className)}>
      <div className="min-w-0 flex-1">
        {eyebrow ? <Eyebrow className="mb-1">{eyebrow}</Eyebrow> : null}
        <h2 className="m-0 text-title text-balance">{title}</h2>
      </div>
      {right ? <div className="shrink-0 text-body-sm text-ink-mute">{right}</div> : null}
    </div>
  )
}

/**
 * A bar. The design draws thirty of them and this is all of them.
 *
 * Not `Meter`: that one owns the health ladder and prints its own rounded
 * number beside itself, which is right in a table of machines and wrong here,
 * where the figure is already printed in its own column at its own precision.
 */
export function Bar({ value, tone, className, floor = 1 }) {
  const clamped = Math.max(0, Math.min(100, value ?? 0))
  return (
    <span
      aria-hidden="true"
      className={cn('block h-1.5 overflow-hidden rounded-pill bg-sunken', className)}
    >
      <span
        className="block h-full rounded-pill"
        style={{
          width: `${Math.max(floor, clamped)}%`,
          background: tone ? `var(--hue-${tone})` : 'var(--ink-mute)',
        }}
      />
    </span>
  )
}

/**
 * The line every panel on this screen ends with.
 *
 * Every figure below the four factors is derived rather than measured, and a
 * reader is entitled to know which is which before they quote one in a meeting.
 * Same pattern as `anomalies.analysis.demoNotice`.
 */
export function DemoNotice({ className }) {
  const { t } = useTranslation('app')
  return (
    <p className={cn('m-0 mt-4 text-body-sm text-ink-mute italic', className)}>
      {t('oee.demoNotice')}
    </p>
  )
}
