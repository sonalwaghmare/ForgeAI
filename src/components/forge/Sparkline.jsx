import { cn } from '@/lib/cn'

/**
 * A trend, with no axes, no grid and no labels.
 *
 * The prototype puts one beside the OEE figure in the top bar, and it is the
 * right instrument for that job: nobody reads a value off a 40×20 chart, they
 * read a direction. `SignalTrace` is the opposite — a semantic instrument with a
 * normal band, an anomaly region, a threshold rule and a hover readout — and
 * shrinking it to 40px would keep all of that machinery to draw eight points.
 *
 * ── Not a chart, for accessibility purposes ────────────────────────────────
 * `aria-hidden`, deliberately. It always sits beside the figure it describes, so
 * a screen reader that announced it too would read "74.2%" and then a shape it
 * has no words for. The number is the accessible content; this is the gloss.
 *
 * `preserveAspectRatio="none"` so the line fills whatever box it is given —
 * these are drawn at whatever width is left over, and a sparkline that letterboxes
 * itself inside a nav bar looks broken rather than tidy.
 *
 * @param {object} props
 * @param {number[]} props.values
 * @param {string} [props.tone]  A hue token name. Defaults to the accent.
 */
export function Sparkline({ values, tone = 'forge', className }) {
  if (!values?.length) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  // A flat series would divide by zero and collapse to the top edge; 1 puts it
  // on the centre line instead, which is what "no change" should look like.
  const range = max - min || 1

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1 || 1)) * 100
      // 2px of padding top and bottom so the stroke is not clipped at the extremes.
      const y = 18 - ((value - min) / range) * 14
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox="0 0 100 20"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className={cn('block h-5 w-10 shrink-0', className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke={`var(--hue-${tone})`}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        // Keeps the stroke 1.5px however hard the viewBox is squashed by
        // `preserveAspectRatio="none"`.
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
