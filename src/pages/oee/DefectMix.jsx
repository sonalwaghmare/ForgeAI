import { useTranslation } from 'react-i18next'
import { Num } from '@/components/forge/primitives'
import { formatCompact, formatInteger, formatPercent } from '@/lib/format'

/**
 * The defect mix as a donut, with the legend carrying the figures.
 *
 * ── Why the ring and not five bars ────────────────────────────────────────
 * Because the question this card answers is "what share of the rejects is each
 * mode", and a part-to-whole with five parts is the one case a ring genuinely
 * beats a bar chart: the whole is the subject, and it is named in the middle.
 * Anything with a trend or a comparison in it stays a bar.
 *
 * ── The centre figure is PPM, and it is derived ───────────────────────────
 * Parts per million defective is the quality factor restated — 99.0% quality is
 * 10,000 PPM — so it is computed from the same number the Overview prints
 * rather than authored. The prototype writes 100 PPM in the middle of this ring
 * on a screen whose quality figure is 96.4%, which is 36,000 PPM: three orders
 * of magnitude apart, on one card.
 */

const SIZE = 132
const RADIUS = 52
const CENTRE = SIZE / 2

/** A slice, as an SVG arc from one fraction of the circle to the next. */
function slicePath(from, to) {
  const start = from * 2 * Math.PI - Math.PI / 2
  const end = to * 2 * Math.PI - Math.PI / 2
  const x0 = CENTRE + RADIUS * Math.cos(start)
  const y0 = CENTRE + RADIUS * Math.sin(start)
  const x1 = CENTRE + RADIUS * Math.cos(end)
  const y1 = CENTRE + RADIUS * Math.sin(end)
  const large = to - from > 0.5 ? 1 : 0
  return `M ${CENTRE} ${CENTRE} L ${x0} ${y0} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${x1} ${y1} Z`
}

export function DefectMix({ rows, ppm, totalUnits }) {
  const { t } = useTranslation('app')

  /* Running offsets, built with a fold rather than a mutated cursor: a `let`
     reassigned inside a `map` during render is exactly the pattern the lint rule
     catches, and it is the one that breaks under a re-entrant render. */
  const slices = rows.reduce((acc, row) => {
    const from = acc.length ? acc[acc.length - 1].to : 0
    acc.push({ ...row, from, to: from + row.pct / 100 })
    return acc
  }, [])

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg
        width={SIZE}
        height={SIZE}
        className="shrink-0"
        role="img"
        aria-label={t('oee.defects.title')}
      >
        {slices.map((row) => (
          <path
            key={row.key}
            d={slicePath(row.from, row.to)}
            fill={row.tone ? `var(--hue-${row.tone})` : 'var(--ink-mute)'}
            // A hairline in the card's own surface between slices, so two
            // adjacent hues do not read as one wedge.
            stroke="var(--surface-card)"
            strokeWidth="1.5"
          />
        ))}
        {/* The hole. Filled with the card rather than left transparent, because
            a transparent hole picks up whatever is behind the panel. */}
        <circle cx={CENTRE} cy={CENTRE} r={RADIUS * 0.55} fill="var(--surface-card)" />
        <text
          x={CENTRE}
          y={CENTRE - 1}
          textAnchor="middle"
          className="num"
          fill="var(--ink)"
          fontWeight="700"
        >
          {formatCompact(ppm)}
        </text>
        <text x={CENTRE} y={CENTRE + 13} textAnchor="middle" fill="var(--ink-mute)" fontSize="9">
          {t('oee.defects.ppm')}
        </text>
      </svg>

      <ul className="m-0 min-w-[12rem] flex-1 list-none p-0">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2.5 py-1 text-body-sm">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-xs"
              style={{ background: row.tone ? `var(--hue-${row.tone})` : 'var(--ink-mute)' }}
            />
            <span className="min-w-0 flex-1 truncate">{t(`oee.defects.mode.${row.key}`)}</span>
            <Num className="shrink-0 text-ink-mute">{formatInteger(row.units)}</Num>
            <Num className="w-10 shrink-0 text-end font-semibold">{formatPercent(row.pct, 0)}</Num>
          </li>
        ))}
      </ul>

      <p className="m-0 basis-full text-micro font-normal text-ink-mute">
        {t('oee.defects.caption')} {t('oee.cans', { value: formatInteger(totalUnits) })}
      </p>
    </div>
  )
}
