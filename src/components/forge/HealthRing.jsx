import { cn } from '@/lib/cn'
import { Num } from './primitives'
import { toneForHealth } from '@/lib/tone'

/**
 * A health score as a ring — the prototype's `Ring`.
 *
 * `Meter` is the same fact as a bar and is right in a table row, where a dozen
 * of them stack into a comparable column. This is right in a header, where there
 * is exactly one and it should read as the machine's headline rather than as a
 * row that lost its table.
 *
 * Same ladder as everything else — `toneForHealth`, ≥80 green · 50–79 amber ·
 * <50 red — so a machine at 64 is amber here, amber in the list and amber on the
 * flow strip.
 *
 * The number sits inside the ring rather than beside it. A ring with the figure
 * outside is two objects; with it inside it is one, and the arc becomes the
 * gloss on the number instead of competing with it.
 */
export function HealthRing({ value, label, caption, size = 56, className }) {
  const clamped = Math.max(0, Math.min(100, value ?? 0))
  const tone = toneForHealth(clamped) ?? 'green'

  const stroke = size >= 72 ? 6 : 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} role="img" aria-label={`${label}: ${Math.round(clamped)}`}>
          {/* The track. A full circle in the sunken tone, so the arc reads as a
              proportion of something rather than as a lone stroke. */}
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
            // Twelve o'clock, not three. A gauge that starts on the right reads
            // as already part-way round.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <Num
          className="absolute inset-0 flex items-center justify-center text-body font-bold"
          style={{ color: `var(--on-${tone})` }}
        >
          {Math.round(clamped)}
        </Num>
      </div>

      {caption ? (
        <span
          className="max-w-[5rem] text-micro leading-tight font-bold uppercase"
          style={{ color: `var(--on-${tone})` }}
        >
          {caption}
        </span>
      ) : null}
    </div>
  )
}
