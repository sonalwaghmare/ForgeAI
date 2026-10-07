import { cn } from '@/lib/cn'
import { Num } from './primitives'
import { toneForHealth } from '@/lib/tone'

/**
 * A bar and its number — the prototype's `ProgressBar`, which it uses for every
 * health score on every screen in the module.
 *
 * Here rather than on the page because Lines, Assets, Asset Detail and the floor
 * map all draw the same object, and the health ladder has to be one ladder: a
 * machine at 64 must be the same colour in the list as it is on its own page.
 * `toneForHealth` owns that ladder (≥80 green · 50–79 amber · <50 red) and this
 * is the only component that should be asking it.
 *
 * ── Why the number is not optional ────────────────────────────────────────
 * A bar alone encodes one fact in one channel, and that channel is colour plus
 * length. Colour-blind mode already handles the hue; length at these sizes is
 * worth about ±10 to the eye. The figure beside it is what makes the row
 * comparable to the row below it, so it is part of the component rather than
 * something each call site remembers to add.
 *
 * @param {object} props
 * @param {number} props.value       0–100.
 * @param {string} props.label       Accessible name. Must be translated.
 * @param {string} [props.tone]      Overrides the health ladder.
 * @param {boolean} [props.compact]  Narrower bar, for a table cell.
 */
export function Meter({ value, label, tone, compact = false, className }) {
  const resolved = tone ?? toneForHealth(value) ?? 'green'
  const clamped = Math.max(0, Math.min(100, value ?? 0))

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        role="meter"
        aria-label={label}
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          'inline-block h-1.5 shrink-0 overflow-hidden rounded-pill bg-sunken',
          compact ? 'w-12' : 'w-[4.5rem]',
        )}
      >
        <span
          className="block h-full rounded-pill"
          style={{ width: `${clamped}%`, background: `var(--hue-${resolved})` }}
        />
      </span>
      <Num
        className="w-6 shrink-0 text-end text-body-sm font-semibold"
        style={{ color: `var(--on-${resolved})` }}
      >
        {Math.round(clamped)}
      </Num>
    </span>
  )
}
