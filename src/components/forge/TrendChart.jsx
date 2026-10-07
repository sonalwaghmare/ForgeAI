import { Fragment, useId, useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import { Num } from './primitives'

/**
 * A multi-series trend, drawn rather than charted.
 *
 * ── Why this is not `SignalTrace` ─────────────────────────────────────────
 * SignalTrace is one sensor against one alarm: it hard-codes the red hue,
 * requires a threshold, and its whole vocabulary — anomaly region, dashed
 * boundary, onset marker — is about the moment a reading went wrong. None of
 * that applies to a rate that is simply higher or lower than yesterday. Making
 * the threshold optional and the hue a prop would have left one component with
 * two unrelated jobs and a red line meaning nothing in half its uses.
 *
 * ── Why not Recharts ──────────────────────────────────────────────────────
 * Recharts is installed and would draw four lines. What it will not do without
 * fighting is the specific thing this chart is for: a translucent target
 * corridor behind one dominant series with the others readable but subordinate,
 * on the product's own tokens, at the product's own weights. Two hundred lines
 * of SVG is cheaper than two hundred lines of overrides.
 *
 * Colour comes from the semantic tone on each series, never from an index. A
 * palette assigned by position is a rainbow that means nothing.
 *
 * @param {object} props
 * @param {{key: string, label: string, values: number[], tone: string}[]} props.series
 *   Drawn in order. The FIRST entry is the subject and is drawn at full weight;
 *   the rest are context and are drawn thin and dimmed.
 * @param {[number, number]} [props.band]   Target corridor, drawn in green behind.
 * @param {string} props.label              Accessible name. Must be translated.
 * @param {string} props.bandLabel          Names the corridor. Must be translated.
 * @param {(value: number) => string} props.format
 * @param {string} props.xLabel             Header for the sr-only table's index column.
 * @param {string[]} [props.xTicks]         Labels along the time axis, first to last.
 * @param {boolean} [props.legend]          Off for a single series, where the card's
 *   own title already names it and a one-item legend is furniture.
 * @param {boolean} [props.axis]
 *   Off strips the tick LABELS — both axes — and gives their gutters back to the
 *   plot. The grid lines and the target band stay: they are what make a reading
 *   locatable, and they do it without four numbers competing with the figure the
 *   card already prints above the chart.
 *
 *   Right for a sensor card, where the question is "is this inside the band and
 *   which way is it going" and the current value is stated in full beside the
 *   title. Wrong for a chart somebody reads values off, which is why OEE keeps
 *   its axes.
 * @param {number} [props.axisWidth]
 *   How much room the y-axis labels need, in viewBox units.
 *
 *   It has to be a caller's decision because the two things involved scale
 *   differently: the gutter is a PERCENTAGE of the rendered width, while the
 *   label text is a fixed pixel size. The 44 that suits "84" on a full-width
 *   card is 20px in a 22rem column, and "1.5M" at that size runs straight over
 *   the plot with the line drawn underneath it. Widen it when the series is
 *   large, the column is narrow, or both.
 */
/* The drawing surface. Module constants rather than locals: they never vary, and
   as locals they are four fresh identities on every render that the geometry
   memo would have to list as dependencies to be honest about. */
const W = 720
const H = 230
const PAD = { top: 14, end: 14, bottom: 14, start: 44 }

/**
 * A series' colour, from its tone.
 *
 * `muted` is not a hue and is deliberately allowed. A chart with ONE series and
 * a target band behind it does not need an accent: the band is carrying the
 * meaning, and a coloured line over it reads as a second claim. The neutral
 * keeps the reading legible and lets the green say whether it is where it should
 * be. Where several series share a plot they all take hues, because there the
 * colour is what tells them apart.
 *
 * Two resolvers because the jobs differ: a stroke wants the hue at full
 * strength, text wants the darker `--on-*` ramp step that stays legible on the
 * card surface in both themes.
 */
const strokeFor = (tone) => (tone === 'muted' ? 'var(--ink-mute)' : `var(--hue-${tone})`)
const textFor = (tone) => (tone === 'muted' ? 'var(--ink-dim)' : `var(--on-${tone})`)

export function TrendChart({
  series,
  band,
  label,
  bandLabel,
  format,
  xLabel,
  xTicks,
  legend = true,
  axis = true,
  axisWidth = PAD.start,
  className,
}) {
  const gradientId = useId()
  const [cursor, setCursor] = useState(null)

  const visible = series.filter((entry) => entry.values?.length)
  const count = visible[0]?.values.length ?? 0

  const geometry = useMemo(() => {
    /* Nulls are legitimate and mean "this point has not happened yet" — a week
       in progress has three shifts a day and only some of them behind it. They
       are excluded from the domain and break the line, rather than being read as
       zero, which would drag the floor down and draw a cliff to the axis. */
    const all = visible.flatMap((entry) => entry.values).filter((value) => value != null)
    if (!all.length) return null

    // Tick labels need a gutter of their own; without one they overprint the
    // last few pixels of the plot. With the axis off there is nothing to make
    // room for, so the plot takes the space back on both sides.
    const bottom = axis && xTicks?.length ? PAD.bottom + 16 : PAD.bottom
    const start = axis ? axisWidth : PAD.end

    const max = Math.max(...all, band?.[1] ?? -Infinity)
    const min = Math.min(...all, band?.[0] ?? Infinity)
    const span = max - min || 1
    const top = max + span * 0.12
    const floor = Math.max(0, min - span * 0.12)
    const range = top - floor || 1

    const plotW = W - start - PAD.end
    const plotH = H - PAD.top - bottom

    const x = (index) => start + (count > 1 ? (index / (count - 1)) * plotW : plotW / 2)
    const y = (value) => PAD.top + (1 - (value - floor) / range) * plotH
    /* `M` after every gap, not only at index 0: a null starts a new subpath, so
       the line stops where the data stops instead of jumping the gap. */
    const path = (values) => {
      let open = false
      return values
        .map((value, index) => {
          if (value == null) {
            open = false
            return ''
          }
          const command = open ? 'L' : 'M'
          open = true
          return `${command}${x(index)} ${y(value)}`
        })
        .filter(Boolean)
        .join(' ')
    }

    return {
      x,
      y,
      path,
      floor,
      start,
      ticks: Array.from({ length: 5 }, (_, i) => floor + (range * i) / 4),
    }
  }, [visible, band, count, xTicks, axis, axisWidth])

  if (!geometry) return null
  const { x, y, path, floor, start, ticks } = geometry

  // Which side of the plot the pointer is on. Past the midpoint the tooltip
  // flips to the other side of the crosshair rather than hanging off the card.
  const past = cursor != null && count > 1 && cursor / (count - 1) > 0.55

  return (
    <figure className={cn('m-0', className)}>
      {/* The legend is the resting state — every series and where it ended up.
          It does NOT follow the pointer: the tooltip does that, and two readouts
          changing together is one of them being redundant. */}
      <div
        className={cn(
          'mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1.5',
          !legend && 'hidden',
        )}
      >
        {visible.map((entry) => (
          <span key={entry.key} className="inline-flex items-baseline gap-1.5 text-micro font-normal">
            <span
              aria-hidden="true"
              className="inline-block h-[3px] w-3.5 shrink-0 self-center rounded-pill"
              style={{ background: strokeFor(entry.tone) }}
            />
            <span className="text-ink-dim">{entry.label}</span>
            <Num className="font-semibold" style={{ color: textFor(entry.tone) }}>
              {format(entry.values.findLast((value) => value != null))}
            </Num>
          </span>
        ))}
      </div>

      <div className="relative">
      {/* The aspect ratio is preserved, so the height follows the card's width.
          The alternative — `preserveAspectRatio="none"` and a fixed pixel height
          — stretches the viewBox horizontally, which stretches the tick labels
          with it. */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={label}
        onPointerLeave={() => setCursor(null)}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect()
          const px = ((event.clientX - box.left) / box.width) * W
          const index = Math.round(
            ((px - (axis ? axisWidth : PAD.end)) / (W - (axis ? axisWidth : PAD.end) - PAD.end)) *
              (count - 1),
          )
          setCursor(Math.min(count - 1, Math.max(0, index)))
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeFor(visible[0].tone)} stopOpacity="0.18" />
            <stop offset="100%" stopColor={strokeFor(visible[0].tone)} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid. `vector-effect` on every stroke below, because the viewBox is
            stretched to the card's width and an unprotected 1px line would come
            out fatter horizontally than vertically. */}
        {ticks.map((value) => (
          <g key={value}>
            <line
              x1={start}
              x2={W - PAD.end}
              y1={y(value)}
              y2={y(value)}
              stroke="var(--border-subtle)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        {/* The target corridor, behind everything. */}
        {band ? (
          <rect
            x={start}
            y={y(band[1])}
            width={W - start - PAD.end}
            height={Math.max(0, y(band[0]) - y(band[1]))}
            fill="var(--hue-green)"
            fillOpacity="0.1"
          />
        ) : null}

        {/* Context series first, so the subject draws over them. */}
        {visible.slice(1).map((entry) => (
          <path
            key={entry.key}
            d={path(entry.values)}
            fill="none"
            stroke={strokeFor(entry.tone)}
            strokeWidth="1.5"
            strokeOpacity="0.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={`${path(visible[0].values)} L${x(count - 1)} ${y(floor)} L${x(0)} ${y(floor)} Z`} fill={`url(#${gradientId})`} />
        <path
          d={path(visible[0].values)}
          fill="none"
          stroke={strokeFor(visible[0].tone)}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Crosshair. Pointer-only — the table below carries the same data for
            everybody else. */}
        {cursor != null ? (
          <g aria-hidden="true">
            <line
              x1={x(cursor)}
              x2={x(cursor)}
              y1={PAD.top}
              y2={y(floor)}
              stroke="var(--ink-mute)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            {visible
              .filter((entry) => entry.values[cursor] != null)
              .map((entry) => (
              <circle
                key={entry.key}
                cx={x(cursor)}
                cy={y(entry.values[cursor])}
                r="3.5"
                fill="var(--surface-card)"
                stroke={strokeFor(entry.tone)}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        ) : null}
      </svg>

      {/* ── Axis labels, as HTML ──────────────────────────────────────────
          NOT `<text>` inside the SVG, and this is the reason: the viewBox is
          scaled to the card, so a `fontSize="11"` in user units renders at
          11 × (cardWidth / 720) — 13.8px in a wide card and under 6px in a
          narrow one, while every other label on the same chart is a fixed 11px
          from `--text-micro`. Positioned by percentage off the same geometry
          the grid uses, so they still line up exactly.

          The design does the same thing: its charts put the axis captions in
          HTML beside the SVG rather than inside it. */}
      {axis ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {ticks.map((value) => (
            <span
              key={value}
              className="num absolute -translate-y-1/2 text-end text-micro font-normal text-ink-dim"
              style={{
                top: `${(y(value) / H) * 100}%`,
                insetInlineStart: 0,
                width: `${((axisWidth - 8) / W) * 100}%`,
              }}
            >
              {/* The caller's formatter, not the raw number. A series in the
                  millions printed "1608693" here, which is eight digits in a
                  44px gutter — it overflowed into the plot and the line ran
                  underneath it. Every caller already passes `format` for the
                  readout, and the axis wanting a different one from the tooltip
                  was never true. */}
              {format(value)}
            </span>
          ))}
        </div>
      ) : null}

      {/* The readout, as HTML over the plot rather than text inside it.
          Four `<text>` nodes stacked at the crosshair collide with each other
          and with the lines they are describing; a panel can carry a swatch, a
          name and a figure per row and stay legible with all four series on.

          `left` and `translateX` are PHYSICAL here, which is the one place in
          this codebase that is correct rather than an oversight: the SVG's
          coordinate space does not mirror under `dir="rtl"`, so an overlay
          positioned inside it must not mirror either, or it would detach from
          the crosshair it belongs to. */}
      {cursor != null ? (
        <div
          role="status"
          aria-live="off"
          className="pointer-events-none absolute top-2 z-10 rounded-sm border border-hairline bg-card px-2.5 py-2 shadow-lift dark:backdrop-blur-[10px]"
          style={{
            left: `${(x(cursor) / W) * 100}%`,
            transform: past ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
          }}
        >
          <dl className="m-0 grid grid-cols-[auto_auto] items-baseline gap-x-3 gap-y-1">
            {visible.map((entry) => (
              <Fragment key={entry.key}>
                <dt className="flex items-baseline gap-1.5 text-micro font-normal whitespace-nowrap text-ink-dim">
                  <span
                    aria-hidden="true"
                    className="inline-block h-[3px] w-3 shrink-0 self-center rounded-pill"
                    style={{ background: strokeFor(entry.tone) }}
                  />
                  {entry.label}
                </dt>
                <dd className="m-0 text-end">
                  <Num
                    className="text-body-sm font-semibold"
                    style={{ color: textFor(entry.tone) }}
                  >
                    {entry.values[cursor] == null ? '—' : format(entry.values[cursor])}
                  </Num>
                </dd>
              </Fragment>
            ))}
          </dl>
        </div>
      ) : null}
      </div>

      {axis && xTicks?.length ? (
        <div
          aria-hidden="true"
          className="mt-1 flex justify-between text-micro font-normal text-ink-dim"
          // Inset to the plot's own gutters, so the first and last labels sit
          // under the first and last points rather than under the card's edges.
          style={{
            paddingInlineStart: `${(start / W) * 100}%`,
            paddingInlineEnd: `${(PAD.end / W) * 100}%`,
          }}
        >
          {xTicks.map((tick, index) => (
            <Num key={`${tick}-${index}`}>{tick}</Num>
          ))}
        </div>
      ) : null}

      {band ? (
        <figcaption className="mt-2.5 text-micro font-normal text-ink-dim">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-3.5 rounded-[1px]"
              style={{ background: 'color-mix(in srgb, var(--hue-green) 26%, transparent)' }}
            />
            {bandLabel}
          </span>
        </figcaption>
      ) : null}

      {/* The chart as data. Not a fallback — the only version a screen-reader or
          keyboard user can read. */}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">{xLabel}</th>
            {visible.map((entry) => (
              <th key={entry.key} scope="col">
                {entry.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible[0].values.map((_, index) => (
            <tr key={index}>
              <th scope="row">{index + 1}</th>
              {visible.map((entry) => (
                <td key={entry.key}>
                  {entry.values[index] == null ? '—' : format(entry.values[index])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
