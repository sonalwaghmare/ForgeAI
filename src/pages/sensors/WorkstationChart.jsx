import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mono, Num } from '@/components/forge/primitives'
import { formatDateTime } from '@/lib/format'
import { formatMeasure } from '@/lib/units'
import { cn } from '@/lib/cn'

/**
 * The Workstation plot: several channels, two axes, one span.
 *
 * DEMO. Lives here rather than in `components/forge/` because it is specific to
 * this screen — dual axes, threshold rules, maintenance shading and anomaly
 * onsets are a workstation's vocabulary, not the product's. If a second caller
 * appears it moves.
 *
 * ── Why not `TrendChart` ──────────────────────────────────────────────────
 * That one is a single-axis comparison with a target corridor behind it: one
 * subject drawn heavy, the rest as context. Here every series is equally the
 * subject, they are in different units, and the whole point is the relationship
 * between two of them. Widening `TrendChart` to a second axis, per-series
 * thresholds and event markers would have left one component with two jobs.
 *
 * ── Three modes, all of them real ─────────────────────────────────────────
 * The design draws four unlabelled glyphs — `⊞ ∿ ↕ ≡` — with no handler behind
 * any of them. `overlay` is the dual-axis plot; `stacked` gives each series its
 * own strip at its own scale, which is the only honest way to read four units
 * at once; `normalised` maps every series onto 0–100% of its own range, which is
 * the only way to compare the SHAPE of a vibration trace against a temperature
 * one. Each has a label.
 *
 * ── Everything drawn is computed upstream ─────────────────────────────────
 * Domains, rules, correlations, event positions: all resolved in the handler and
 * arriving on the payload. This file positions them. That is what keeps the
 * plot, the series table and the statistics panel from being three opinions.
 */

/* The drawing surface. Module constants for the same reason `TrendChart` gives:
   as locals they would be fresh identities on every render that the geometry
   memo would have to list to be honest. */
const W = 1000
const H = 340
const PAD = { top: 22, end: 56, bottom: 26, start: 56 }

const strokeFor = (tone) => `var(--hue-${tone})`

export function WorkstationChart({ chart, visible, mode = 'overlay' }) {
  const { t } = useTranslation(['app', 'common'])
  const clipId = useId()
  const [cursor, setCursor] = useState(null)

  const series = useMemo(
    () => chart.series.filter((entry) => visible[entry.id] !== false),
    [chart.series, visible],
  )

  const plotW = W - PAD.start - PAD.end
  const plotH = H - PAD.top - PAD.bottom
  const count = chart.stamps.length

  const x = (index) => PAD.start + (index / Math.max(1, count - 1)) * plotW

  /**
   * A scaler per series.
   *
   * `overlay` puts a series on its own axis' domain. `normalised` puts every
   * series on its own min–max, which is what makes the shapes comparable and is
   * why the axis labels change to per-cent in that mode. `stacked` gives each
   * one a horizontal band of the plot and its own domain inside it.
   */
  const scalers = useMemo(() => {
    const map = new Map()
    series.forEach((entry, index) => {
      if (mode === 'normalised') {
        const min = Math.min(...entry.values)
        const max = Math.max(...entry.values)
        const range = max - min || 1
        map.set(entry.id, (value) => PAD.top + (1 - (value - min) / range) * plotH)
        return
      }
      if (mode === 'stacked') {
        const laneH = plotH / series.length
        const top = PAD.top + index * laneH
        const min = Math.min(...entry.values, entry.band?.[0] ?? Infinity)
        const max = Math.max(...entry.values, entry.band?.[1] ?? -Infinity)
        const range = max - min || 1
        // 12% breathing room inside the lane, so adjacent traces never touch.
        map.set(entry.id, (value) => top + laneH * 0.12 + (1 - (value - min) / range) * laneH * 0.76)
        return
      }
      const axis = chart.axes[entry.axis] ?? chart.axes.left
      const [min, max] = axis.domain
      const range = max - min || 1
      map.set(entry.id, (value) => PAD.top + (1 - (value - min) / range) * plotH)
    })
    return map
  }, [series, mode, chart.axes, plotH])

  const pathFor = (entry) => {
    const y = scalers.get(entry.id)
    return entry.values
      .map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`)
      .join(' ')
  }

  /* Axis ticks. Five across each domain, and suppressed entirely in the two
     modes where an absolute value on a shared axis would be a lie. */
  const axisTicks = (axis) => {
    if (!axis || mode !== 'overlay') return []
    const [min, max] = axis.domain
    return Array.from({ length: 5 }, (_, index) => {
      const value = min + ((max - min) * index) / 4
      return { value, y: PAD.top + (1 - index / 4) * plotH }
    })
  }

  const leftTicks = axisTicks(chart.axes.left)
  const rightTicks = axisTicks(chart.axes.right)

  /* Time labels: five, taken from the stamps the handler generated, so the axis
     always describes the span actually plotted. The prototype prints "May 20 …
     Jun 6" under every timeframe pill. */
  const timeTicks = Array.from({ length: 5 }, (_, index) => {
    const at = Math.round((index / 4) * (count - 1))
    return { index: at, label: chart.stamps[at] }
  })

  /* The axis label follows the span. Five full "Aug 16, 2026, 3:04 PM" stamps do
     not fit under a chart and do not need to: over a day the date is a constant,
     and over a month the minute is noise. */
  const tickFormat =
    chart.span.hours <= 48
      ? { hour: 'numeric', minute: '2-digit' }
      : { month: 'short', day: 'numeric' }

  const hovered = cursor == null ? null : cursor

  return (
    <figure className="m-0">
      <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-none"
        role="img"
        aria-label={t('sensors.workstation.chartLabel', {
          count: series.length,
          name: chart.name,
        })}
        onPointerLeave={() => setCursor(null)}
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect()
          const px = ((event.clientX - box.left) / box.width) * W
          const index = Math.round(((px - PAD.start) / plotW) * (count - 1))
          setCursor(Math.min(count - 1, Math.max(0, index)))
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.start} y={PAD.top} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        {/* Grid — four lines, subtle. Never a cage. */}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <line
            key={fraction}
            x1={PAD.start}
            x2={W - PAD.end}
            y1={PAD.top + plotH * fraction}
            y2={PAD.top + plotH * fraction}
            stroke="var(--border-subtle)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Maintenance windows, shaded. Drawn first, so a trace crossing one is
            read over it rather than hidden behind it. */}
        <g clipPath={`url(#${clipId})`}>
          {chart.events.maintenance.map((event) => (
            <rect
              key={`${event.assetId}-${event.at}`}
              x={PAD.start + event.from * plotW}
              y={PAD.top}
              width={Math.max(3, (event.to - event.from) * plotW)}
              height={plotH}
              fill="var(--ink-mute)"
              opacity="0.1"
            />
          ))}

          {/* Threshold rules, one per visible series, on that series' own scale.
              Absolute rules make no sense on a normalised or stacked plot, so
              they are drawn only where they would mean something. */}
          {mode === 'overlay' &&
            chart.rules
              .filter((rule) => visible[rule.seriesId] !== false)
              .map((rule) => {
                const y = scalers.get(rule.seriesId)
                if (!y) return null
                return (
                  <line
                    key={rule.seriesId}
                    x1={PAD.start}
                    x2={W - PAD.end}
                    y1={y(rule.value)}
                    y2={y(rule.value)}
                    stroke={strokeFor(rule.tone)}
                    strokeWidth="1"
                    strokeDasharray="6 4"
                    opacity="0.55"
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })}

          {/* The traces. Reverse order so the first series — the chart's subject
              — is painted last and reads on top. */}
          {[...series].reverse().map((entry) => (
            <path
              key={entry.id}
              d={pathFor(entry)}
              fill="none"
              stroke={strokeFor(entry.tone)}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        {/* Anomaly onsets. Positioned from the alert's own detection time, so a
            marker sits where the record says the reading went wrong. */}
        {chart.events.anomalies
          .filter((event) => visible[event.channelId] !== false)
          .map((event) => (
            <g key={event.alertId}>
              <line
                x1={PAD.start + event.ratio * plotW}
                x2={PAD.start + event.ratio * plotW}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="var(--hue-red)"
                strokeWidth="1"
                strokeDasharray="3 3"
                opacity="0.4"
                vectorEffect="non-scaling-stroke"
              />
              <polygon
                points={`${PAD.start + event.ratio * plotW - 5},${PAD.top - 9} ${PAD.start + event.ratio * plotW + 5},${PAD.top - 9} ${PAD.start + event.ratio * plotW},${PAD.top - 1}`}
                fill="var(--hue-red)"
              />
            </g>
          ))}

        {/* Crosshair. */}
        {hovered != null ? (
          <line
            x1={x(hovered)}
            x2={x(hovered)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            stroke="var(--ink-mute)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {hovered != null &&
          series.map((entry) => {
            const y = scalers.get(entry.id)
            return (
              <circle
                key={entry.id}
                cx={x(hovered)}
                cy={y(entry.values[hovered])}
                r="3.5"
                fill="var(--surface-card)"
                stroke={strokeFor(entry.tone)}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            )
          })}

      </svg>

      {/* ── Axis tick labels, as HTML ─────────────────────────────────────
          NOT `<text>` inside the SVG. The viewBox is 1000 wide and scaled to the
          card, so `fontSize="11"` in user units rendered at about 9.7px here
          while the time labels directly beneath it — real HTML — were 11px. Two
          sizes on the two axes of one chart. Positioned by percentage off the
          same geometry the grid uses. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {leftTicks.map((tick) => (
          <span
            key={`l${tick.value}`}
            className="num absolute -translate-y-1/2 text-end text-micro font-normal text-ink-mute"
            style={{
              top: `${(tick.y / H) * 100}%`,
              insetInlineStart: 0,
              width: `${((PAD.start - 8) / W) * 100}%`,
            }}
          >
            {Math.round(tick.value * 100) / 100}
          </span>
        ))}
        {rightTicks.map((tick) => (
          <span
            key={`r${tick.value}`}
            className="num absolute -translate-y-1/2 text-start text-micro font-normal text-ink-mute"
            style={{
              top: `${(tick.y / H) * 100}%`,
              insetInlineEnd: 0,
              width: `${((PAD.end - 8) / W) * 100}%`,
              paddingInlineStart: `${(8 / W) * 100}%`,
            }}
          >
            {Math.round(tick.value * 100) / 100}
          </span>
        ))}
      </div>
      </div>

      {/* Axis units and the time axis, in HTML rather than SVG so they take the
          product's own type ramp instead of a hardcoded font size. */}
      <div className="mt-1 flex items-baseline justify-between text-micro font-normal text-ink-mute">
        <Mono>
          {mode === 'overlay'
            ? chart.axes.left.label
            : t(`sensors.workstation.mode.${mode}Axis`)}
        </Mono>
        {mode === 'overlay' && chart.axes.right ? <Mono>{chart.axes.right.label}</Mono> : null}
      </div>
      <div className="mt-1.5 flex justify-between text-micro font-normal text-ink-dim">
        {timeTicks.map((tick) => (
          <Num key={tick.index}>{formatDateTime(tick.label, tickFormat)}</Num>
        ))}
      </div>

      {/* The readout. Beside the chart rather than floating over it, so it never
          covers the point being read — the same decision the floor map's station
          readout took. */}
      <figcaption
        className={cn(
          'mt-3 flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1.5 rounded-sm border border-hairline bg-sunken px-3 py-2',
          hovered == null && 'text-ink-dim',
        )}
      >
        {hovered == null ? (
          <span className="text-micro font-normal">{t('sensors.workstation.hoverHint')}</span>
        ) : (
          <>
            <Num className="text-micro font-semibold whitespace-nowrap">
              {formatDateTime(chart.stamps[hovered])}
            </Num>
            {series.map((entry) => (
              <span key={entry.id} className="flex items-center gap-1.5 whitespace-nowrap">
                <span
                  aria-hidden="true"
                  className="inline-block h-0.5 w-3 rounded-full"
                  style={{ backgroundColor: strokeFor(entry.tone) }}
                />
                <span className="text-micro font-normal text-ink-dim">{entry.name}</span>
                <Num className="text-micro font-semibold">
                  {formatMeasure({ value: entry.values[hovered], unit: entry.unit })}
                </Num>
              </span>
            ))}
          </>
        )}
      </figcaption>
    </figure>
  )
}
