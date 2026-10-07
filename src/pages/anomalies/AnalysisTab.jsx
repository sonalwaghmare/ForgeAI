import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { StateBadge } from '@/components/forge/StatusBadge'
import { Mono, Num } from '@/components/forge/primitives'
import { useToast } from '@/providers/ToastProvider'
import { cn } from '@/lib/cn'
import { TINT_CLASS, ON_TINT_CLASS } from '@/lib/tone'

/**
 * Anomaly · Analysis.
 *
 * DEMO. See `DEMO-MODE.md` §8.1. The design's `AnalysisPanel` — four views of the
 * same investigation behind a vertical rail: the causal argument, the raw traces,
 * the cross-sensor overlay, and the pipeline that produced all three.
 *
 * ── The content is hardcoded, and that is the whole point of saying so ────
 * Nothing on this tab is joined to the plant. There is no timeseries route and
 * nothing returns a detector ensemble or a reasoning trace, so every figure below
 * is a literal transcribed from the design. It is here to show the shape of the
 * module, not to be read as a measurement — which is why the panel carries the
 * demo notice at the foot rather than leaving a reader to assume 11.12σ came off a
 * sensor. When the endpoints land, these constants are what the payload replaces.
 *
 * ── Why the rail is vertical ──────────────────────────────────────────────
 * These four are peers, they are switched between repeatedly while reading, and
 * three of them are tall. A horizontal strip above tall content puts the switch
 * off-screen the moment somebody scrolls into the thing they came to look at.
 */

const VIEWS = [
  { id: 'rca', icon: 'search' },
  { id: 'timeseries', icon: 'gauge' },
  { id: 'correlative', icon: 'wave' },
  { id: 'reasoning', icon: 'ai' },
]

export function AnalysisTab({ anomaly }) {
  const { t } = useTranslation(['app', 'common'])
  const [view, setView] = useState('rca')

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <nav
        aria-label={t('anomalies.analysis.railLabel')}
        className="flex shrink-0 gap-1 overflow-x-auto lg:w-40 lg:flex-col"
      >
        {VIEWS.map(({ id, icon }) => {
          const on = view === id
          return (
            <button
              key={id}
              type="button"
              aria-current={on ? 'page' : undefined}
              onClick={() => setView(id)}
              className={cn(
                'flex items-center gap-2.5 rounded-sm border-s-2 px-3 py-2.5 text-body-sm whitespace-nowrap transition-colors',
                on
                  ? 'border-s-forge bg-sunken font-semibold text-ink'
                  : 'border-s-transparent text-ink-dim hover:text-ink',
              )}
            >
              <Icon name={icon} size="sm" className={on ? 'text-forge' : 'text-ink-mute'} />
              {t(`anomalies.analysis.view.${id}`)}
            </button>
          )
        })}
      </nav>

      <div className="min-w-0 flex-1">
        {view === 'rca' ? <RcaView anomaly={anomaly} /> : null}
        {view === 'timeseries' ? <TimeseriesView /> : null}
        {view === 'correlative' ? <CorrelativeView /> : null}
        {view === 'reasoning' ? <ReasoningView /> : null}
        <p className="m-0 mt-4 text-body-sm text-ink-mute italic">
          {t('anomalies.analysis.demoNotice')}
        </p>
      </div>
    </div>
  )
}

/* ══ RCA ═══════════════════════════════════════════════════════════════ */

const CHAIN = [
  { key: 'root', tone: 'red' },
  { key: 'contributing', tone: 'amber' },
  { key: 'symptom', tone: 'watch' },
]

const EVIDENCE = ['regression', 'ensemble', 'historical', 'logbook']

function RcaView({ anomaly }) {
  const { t } = useTranslation(['app', 'common'])

  const headline = [
    { key: 'confidence', value: '92%', tone: 'green' },
    { key: 'eta', value: '4.5 h', tone: 'red' },
    { key: 'drift', value: '0.33 mm/s·h', tone: 'amber' },
    { key: 'r2', value: '1.000', tone: null },
  ]

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="mb-3 flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <Eyebrow>{t('anomalies.analysis.rca.title')}</Eyebrow>
            <h3 className="m-0 mt-1 text-title text-balance">
              {anomaly?.title ?? t('anomalies.analysis.rca.fallbackTitle')}
            </h3>
          </div>
          <StateBadge tone="green">{t('anomalies.analysis.rca.ready')}</StateBadge>
        </div>

        <dl className="m-0 flex flex-wrap gap-x-8 gap-y-3">
          {headline.map(({ key, value, tone }) => (
            <div key={key}>
              <dt className="text-micro font-semibold tracking-wide text-ink-mute uppercase">
                {t(`anomalies.analysis.rca.metric.${key}`)}
              </dt>
              <dd
                className={cn(
                  'm-0 mt-0.5 text-title font-bold',
                  tone ? ON_TINT_CLASS[tone] : 'text-ink',
                )}
              >
                <Num>{value}</Num>
              </dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel>
        <Eyebrow>{t('anomalies.analysis.rca.description')}</Eyebrow>
        <p className="m-0 mt-2 text-body text-ink-dim">{t('anomalies.analysis.rca.descriptionBody')}</p>
      </Panel>

      <Panel>
        <Eyebrow>{t('anomalies.analysis.rca.chain')}</Eyebrow>
        <ol className="m-0 mt-3.5 list-none p-0">
          {CHAIN.map((step, index) => (
            <li key={step.key} className="flex gap-3">
              {/* The spine. A dot per link and a rule between them, so three
                  cards read as one descent rather than three claims. */}
              <span aria-hidden="true" className="flex flex-col items-center">
                <span
                  className="mt-1 size-2.5 shrink-0 rounded-full"
                  style={{ background: `var(--hue-${step.tone})` }}
                />
                {index < CHAIN.length - 1 ? <span className="w-0.5 flex-1 bg-hairline" /> : null}
              </span>
              <div className={cn('flex-1', index < CHAIN.length - 1 && 'pb-4')}>
                <span
                  className={cn(
                    'inline-block rounded-xs px-1.5 py-0.5 text-micro font-bold tracking-wide uppercase',
                    TINT_CLASS[step.tone],
                    ON_TINT_CLASS[step.tone],
                  )}
                >
                  {t(`anomalies.analysis.rca.step.${step.key}.kind`)}
                </span>
                <h4 className="m-0 mt-1.5 text-body font-semibold">
                  {t(`anomalies.analysis.rca.step.${step.key}.title`)}
                </h4>
                <p className="m-0 mt-1 text-body-sm text-ink-dim">
                  {t(`anomalies.analysis.rca.step.${step.key}.detail`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel>
        <Eyebrow>{t('anomalies.analysis.rca.evidence')}</Eyebrow>
        <ul className="m-0 mt-1 list-none p-0">
          {EVIDENCE.map((key) => (
            <li
              key={key}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline py-2.5 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="text-body-sm font-semibold">
                  {t(`anomalies.analysis.rca.evidenceItem.${key}.label`)}
                </div>
                <div className="mt-0.5 text-micro font-normal text-ink-dim">
                  <Num>{t(`anomalies.analysis.rca.evidenceItem.${key}.detail`)}</Num>
                </div>
              </div>
              {/* The tool that produced the row. Monospace because it is a
                  machine identifier, which is the only thing monospace means
                  in this product. */}
              <Mono className="text-micro text-ink-mute">
                {t(`anomalies.analysis.rca.evidenceItem.${key}.tool`)}
              </Mono>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

/* ══ TIMESERIES ════════════════════════════════════════════════════════ */

/**
 * The two sensors on the board, and their traces.
 *
 * Hardcoded, per the note at the top. `source` marks the channel the anomaly fired
 * on — it is the one card that cannot be unpinned, and it carries the accent edge.
 */
const PINNED = [
  {
    key: 'oil',
    tone: 'forge',
    source: true,
    series: [252, 258, 266, 271, 283, 291, 288, 297, 305, 302, 296, 288, 281, 272, 263,
      255, 248, 243, 241, 246, 252, 261, 272, 284, 295, 306, 314, 322, 329, 335, 338, 341],
  },
  {
    key: 'vibration',
    tone: 'violet',
    source: false,
    series: [9.8, 10.2, 10.9, 11.4, 11.9, 12.2, 12.4, 12.3, 12.1, 11.7, 11.2, 10.6, 10.1,
      9.7, 9.4, 9.2, 9.4, 9.8, 10.4, 14.6, 15.1, 15.2, 11.4, 11.8, 12.1, 12.3, 12.0, 11.6,
      11.2, 10.8, 10.4, 10.1],
  },
]

/** The live ranges. Short, because a live card is a monitor, not a history. */
const LIVE_RANGES = ['30s', '2m', '5m', '15m']

/**
 * Analysis · Timeseries — the pinned-sensor board.
 *
 * The design's own arrangement: one panel holding a grid of live sensor cards, each
 * with its own range control and its own play state, over a shared header that
 * counts them and can swap the whole board from live to the anomaly window.
 *
 * ── Why the range control is per card and not per board ───────────────────
 * Because the comparison being made is not always the same one. Reading the source
 * channel at 30s while holding a sibling at 15m is how somebody checks whether a
 * spike is local or systemic, and a single shared control makes that impossible.
 * The board-level Anomaly History button is the case where they DO move together.
 */
function TimeseriesView() {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()
  const [collapsed, setCollapsed] = useState(false)
  const [history, setHistory] = useState(false)
  const [pinned, setPinned] = useState(PINNED)

  return (
    <Panel flush>
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-3">
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
          className="flex items-center gap-2 text-ink-mute transition-colors hover:text-ink"
        >
          <Icon name={collapsed ? 'right' : 'down'} size="sm" />
          <span className="text-micro font-semibold tracking-wide uppercase">
            {t('anomalies.analysis.ts.pinned', { count: pinned.length })}
          </span>
        </button>

        <div className="flex-1" />

        <ForgeButton
          size="sm"
          onClick={() => setHistory((value) => !value)}
          className={cn(history && 'border-forge text-on-forge')}
        >
          <Icon name="cal" size="xs" />
          {history ? t('anomalies.analysis.ts.backToLive') : t('anomalies.analysis.ts.anomalyHistory')}
        </ForgeButton>
        <ForgeButton size="sm" onClick={() => toast(t('anomalies.analysis.ts.toast.added'))}>
          {t('anomalies.analysis.ts.addSensor')}
        </ForgeButton>
      </div>

      {collapsed ? null : (
        <div className="grid gap-3 p-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
          {pinned.map((sensor) => (
            <SensorCard
              key={sensor.key}
              sensor={sensor}
              history={history}
              onRemove={
                sensor.source
                  ? null
                  : () => setPinned((all) => all.filter((entry) => entry.key !== sensor.key))
              }
            />
          ))}
        </div>
      )}
    </Panel>
  )
}

/**
 * One pinned sensor.
 *
 * ── The area fill is what makes two of these comparable at a glance ───────
 * A bare polyline at this size reads as a squiggle. The fill under it gives the
 * trace a mass the eye can compare across cards without reading either axis, which
 * is the entire job of a board like this. It is a single-hue alpha falloff, not a
 * two-colour gradient — the same restraint `RadarSweep` documents.
 *
 * ── LIVE is a state, so it can be stopped ─────────────────────────────────
 * The pause control is real: it flips the badge and stops the pulse. A live
 * indicator with no way to freeze it is the thing that makes somebody screenshot
 * their monitor to read a number.
 */
function SensorCard({ sensor, history, onRemove }) {
  const { t } = useTranslation(['app', 'common'])
  const [range, setRange] = useState('2m')
  const [paused, setPaused] = useState(false)

  const values = sensor.series
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  // Five ticks off the real extent, so the axis describes this trace rather than a
  // rounded idea of it — the design labels the actual min and max.
  const ticks = [0, 1, 2, 3, 4].map((step) => max - (span * step) / 4)

  const W = 300
  const H = 120
  const x = (i) => (i / (values.length - 1)) * W
  const y = (v) => H - ((v - min) / span) * (H - 6) - 3
  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const gradientId = `sensor-fill-${sensor.key}`

  return (
    <article
      className={cn(
        'rounded-sm border p-3',
        sensor.source ? 'border-forge/60' : 'border-hairline',
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full"
          style={{ background: `var(--hue-${sensor.tone})` }}
        />
        <h4 className="m-0 text-body font-semibold">
          {t(`anomalies.analysis.ts.sensor.${sensor.key}.name`)}
        </h4>
        {sensor.source ? (
          <span className="rounded-pill border border-forge/50 px-2 py-0.5 text-micro font-bold tracking-wide text-on-forge uppercase">
            {t('anomalies.analysis.ts.anomalySource')}
          </span>
        ) : null}
        <div className="flex-1" />
        {onRemove ? (
          <button
            type="button"
            aria-label={t('anomalies.analysis.ts.unpin', {
              name: t(`anomalies.analysis.ts.sensor.${sensor.key}.name`),
            })}
            onClick={onRemove}
            className="text-ink-mute transition-colors hover:text-ink"
          >
            <Icon name="x" size="sm" />
          </button>
        ) : null}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {history ? (
          <span className="rounded-pill border border-hairline px-2 py-0.5 text-micro font-bold tracking-wide text-ink-dim uppercase">
            {t('anomalies.analysis.ts.eventWindow')}
          </span>
        ) : (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-micro font-bold tracking-wide uppercase',
              paused ? 'tint-amber text-on-amber' : 'tint-green text-on-green',
            )}
          >
            <span
              aria-hidden="true"
              className={cn('size-1.5 rounded-full', !paused && 'animate-pulse')}
              style={{ background: `var(--hue-${paused ? 'amber' : 'green'})` }}
            />
            {paused ? t('anomalies.analysis.ts.paused') : t('anomalies.analysis.ts.live')}
          </span>
        )}

        <div
          role="group"
          aria-label={t('anomalies.analysis.ts.windowLabel')}
          className="flex flex-wrap gap-1"
        >
          {LIVE_RANGES.map((entry) => (
            <Chip key={entry} selected={entry === range} onClick={() => setRange(entry)}>
              {entry}
            </Chip>
          ))}
        </div>

        <div className="flex-1" />

        {history ? null : (
          <button
            type="button"
            aria-label={
              paused ? t('anomalies.analysis.ts.resume') : t('anomalies.analysis.ts.pause')
            }
            onClick={() => setPaused((value) => !value)}
            className="text-ink-mute transition-colors hover:text-ink"
          >
            <Icon name={paused ? 'right' : 'minus'} size="sm" />
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {/* The axis, as real text rather than baked into the SVG — it stays
            selectable and it does not scale with the plot. */}
        <ul className="m-0 flex list-none flex-col justify-between py-0.5 ps-0 pe-0 text-micro text-ink-mute">
          {ticks.map((tick) => (
            <li key={tick}>
              <Num>{tick >= 100 ? Math.round(tick) : tick.toFixed(1)}</Num>
            </li>
          ))}
        </ul>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={t('anomalies.analysis.ts.chartAlt', {
            name: t(`anomalies.analysis.ts.sensor.${sensor.key}.name`),
          })}
          className="h-30 min-w-0 flex-1"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`var(--hue-${sensor.tone})`} stopOpacity="0.32" />
              <stop offset="100%" stopColor={`var(--hue-${sensor.tone})`} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((at) => (
            <line
              key={at}
              x1="0"
              y1={3 + (H - 6) * at}
              x2={W}
              y2={3 + (H - 6) * at}
              stroke="var(--border-hairline)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polygon points={`0,${H} ${line} ${W},${H}`} fill={`url(#${gradientId})`} />
          <polyline
            points={line}
            fill="none"
            stroke={`var(--hue-${sensor.tone})`}
            strokeWidth="1.75"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <p className="m-0 mt-1.5 flex justify-between text-micro font-normal text-ink-mute">
        <span>{history ? t('anomalies.analysis.ts.eventStart') : `−${range}`}</span>
        <span>{history ? t('anomalies.analysis.ts.eventEnd') : t('anomalies.analysis.ts.now')}</span>
      </p>
    </article>
  )
}

/* ══ CORRELATIVE ═══════════════════════════════════════════════════════ */

/**
 * The overlay, normalised to 0–100% of each sensor's own range.
 *
 * Normalising is the only honest way to draw ppm over mm/s, and it is why the axis
 * is labelled percent-of-range rather than borrowing one sensor's unit. Both series
 * are 40 samples across the selected window.
 */
const OVERLAY = [
  {
    key: 'oil',
    tone: 'violet',
    points: [30, 34, 39, 45, 52, 58, 63, 67, 70, 74, 71, 68, 72, 65, 61, 58, 52, 45, 38,
      31, 24, 18, 13, 9, 6, 4, 2, 0, 5, 11, 17, 24, 31, 44, 58, 76, 92, 97, 88, 78],
  },
  {
    key: 'vibration',
    tone: 'watch',
    points: [26, 31, 37, 42, 46, 49, 51, 52, 50, 49, 47, 45, 44, 42, 39, 35, 30, 25, 20,
      16, 12, 9, 6, 4, 3, 2, 1, 0, 4, 9, 15, 22, 30, 52, 91, 90, 100, 46, 51, 30],
  },
]

/** Where the anomaly fired, as a fraction across the window. */
const ANOMALY_AT = 0.72

const CORR_RANGES = ['1h', '6h', '24h', '7d', '30d']

/**
 * The correlation matrix, as the design draws it.
 *
 * A real matrix rather than a list of pairs: the diagonal at 1.00 is what tells a
 * reader they are looking at a correlation table at all, and the asymmetry between
 * the two off-diagonal cells is a lagged correlation — oil leads vibration — which a
 * flat list of pairs cannot express.
 */
const MATRIX = [
  { key: 'oil', cells: [{ value: 1.0, tone: 'red' }, { value: 0.68, tone: 'amber' }] },
  { key: 'vibration', cells: [{ value: 0.62, tone: 'amber' }, { value: 1.0, tone: 'red' }] },
]

function CorrelativeView() {
  const { t } = useTranslation(['app', 'common'])
  const [range, setRange] = useState('24h')

  const W = 1000
  const H = 320
  const padStart = 58
  const padEnd = 16
  const padTop = 26
  const padBottom = 34
  const x = (i, n) => padStart + ((W - padStart - padEnd) * i) / (n - 1)
  const y = (v) => padTop + (H - padTop - padBottom) * (1 - v / 100)
  const anomalyX = padStart + (W - padStart - padEnd) * ANOMALY_AT

  const xTicks = ['start', 'q1', 'mid', 'q3', 'now']

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="mb-4 flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <Eyebrow>
              {t('anomalies.analysis.corr.eyebrow', {
                window: t(`anomalies.analysis.corr.range.${range}`),
              })}
            </Eyebrow>
            <h3 className="m-0 mt-1 text-title">
              {t('anomalies.analysis.corr.title', { count: OVERLAY.length })}
            </h3>
          </div>
          <div
            role="group"
            aria-label={t('anomalies.analysis.ts.windowLabel')}
            className="flex flex-wrap gap-1"
          >
            {CORR_RANGES.map((entry) => (
              <Chip key={entry} selected={entry === range} onClick={() => setRange(entry)}>
                {t(`anomalies.analysis.corr.range.${entry}`)}
              </Chip>
            ))}
          </div>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={t('anomalies.analysis.corr.chartAlt')}
          className="block h-80 w-full"
        >
          {[0, 25, 50, 75, 100].map((tick) => (
            <g key={tick}>
              <line
                x1={padStart}
                y1={y(tick)}
                x2={W - padEnd}
                y2={y(tick)}
                stroke="var(--border-hairline)"
                strokeWidth="1"
              />
              <text
                x={padStart - 10}
                y={y(tick) + 4}
                fontSize="12"
                fill="var(--ink-mute)"
                textAnchor="end"
              >
                {tick}%
              </text>
            </g>
          ))}

          {xTicks.map((tick, index) => (
            <text
              key={tick}
              x={x(index, xTicks.length)}
              y={H - 10}
              fontSize="12"
              fill="var(--ink-mute)"
              textAnchor={index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle'}
            >
              {t(`anomalies.analysis.corr.tick.${range}.${tick}`)}
            </text>
          ))}

          {/* When it fired. Named on the chart, because a bare dashed rule is
              the one annotation everybody guesses at. */}
          <line
            x1={anomalyX}
            y1={padTop}
            x2={anomalyX}
            y2={H - padBottom}
            stroke="var(--hue-red)"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
          <text
            x={anomalyX}
            y={padTop - 8}
            fontSize="11"
            fontWeight="700"
            fill="var(--on-red)"
            textAnchor="middle"
          >
            {t('anomalies.analysis.corr.anomaly')}
          </text>

          {OVERLAY.map((trace) => (
            <polyline
              key={trace.key}
              points={trace.points.map((v, i) => `${x(i, trace.points.length)},${y(v)}`).join(' ')}
              fill="none"
              stroke={`var(--hue-${trace.tone})`}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <p className="m-0 text-micro font-normal text-ink-dim">
            {t('anomalies.analysis.corr.axisNote')}
          </p>
          <span className="ms-auto flex items-center gap-1.5 text-micro text-ink-dim">
            <span
              aria-hidden="true"
              className="h-0 w-5 border-t-2 border-dashed"
              style={{ borderColor: 'var(--hue-red)' }}
            />
            {t('anomalies.analysis.corr.anomaly')}
          </span>
        </div>

        <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-x-5 gap-y-1.5 p-0">
          {OVERLAY.map((trace) => (
            <li key={trace.key} className="flex items-center gap-2 text-body-sm">
              <span
                aria-hidden="true"
                className="h-0.5 w-5 shrink-0 rounded-pill"
                style={{ background: `var(--hue-${trace.tone})` }}
              />
              {t(`anomalies.analysis.ts.sensor.${trace.key}.name`)}
              <span className="text-ink-mute">
                {t(`anomalies.analysis.ts.sensor.${trace.key}.unit`)}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <Eyebrow>{t('anomalies.analysis.corr.matrix')}</Eyebrow>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-body-sm">
            <thead>
              <tr>
                <th className="w-full" />
                {MATRIX.map((row) => (
                  <th
                    key={row.key}
                    scope="col"
                    className="px-4 py-2 text-center text-micro font-normal whitespace-nowrap text-ink-dim"
                  >
                    {t(`anomalies.analysis.ts.sensor.${row.key}.short`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row) => (
                <tr key={row.key}>
                  <th
                    scope="row"
                    className="py-2.5 pe-4 text-start font-normal whitespace-nowrap text-ink-dim"
                  >
                    {t(`anomalies.analysis.ts.sensor.${row.key}.name`)}
                  </th>
                  {row.cells.map((cell, index) => (
                    <td key={index} className="px-4 py-2.5 text-center">
                      <Num className={cn('font-bold', ON_TINT_CLASS[cell.tone])}>
                        {cell.value.toFixed(2)}
                      </Num>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="m-0 mt-3 text-body-sm text-ink-dim">
          {t('anomalies.analysis.corr.strongest')}
        </p>
      </Panel>
    </div>
  )
}

/* ══ REASONING ═════════════════════════════════════════════════════════ */

const STEPS = [
  { key: 'detection', tone: 'red', at: '19:45:23', duration: null },
  { key: 'gate', tone: 'amber', at: '19:45:23', duration: '51.14s' },
  { key: 'analyst', tone: 'amber', at: '19:45:28', duration: '40.24s' },
  { key: 'verdict', tone: 'green', at: '19:45:50', duration: null },
  { key: 'operator', tone: 'green', at: '19:47:07', duration: null },
]

const OBSERVATIONS = [
  { key: 'cascade', tone: 'red' },
  { key: 'ensemble', tone: 'watch' },
  { key: 'shape', tone: 'violet' },
  { key: 'history', tone: 'amber' },
  { key: 'current', tone: 'green' },
]

/**
 * How the verdict was reached.
 *
 * The most important tab in the module and the one the design puts last: five
 * pipeline stages with their real durations, then the observations the analyst
 * step actually recorded. This is the product's "show your working" posture in
 * its most literal form — a reader who distrusts the verdict can read what
 * produced it rather than being asked to take 92% on faith.
 */
function ReasoningView() {
  const { t } = useTranslation(['app', 'common'])
  const [open, setOpen] = useState('verdict')

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="mb-3 flex items-center gap-3">
          <Eyebrow className="flex-1">{t('anomalies.analysis.reason.pipeline')}</Eyebrow>
          <Mono className="text-body-sm text-ink-dim">
            {t('anomalies.analysis.reason.total', { value: '46.12s' })}
          </Mono>
        </div>

        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {STEPS.map((step, index) => {
            const expanded = open === step.key
            return (
              <li key={step.key}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : step.key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-sm border-s-2 bg-sunken px-3 py-2.5 text-start transition-colors',
                    expanded ? 'border-s-forge' : 'border-s-transparent',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-micro font-bold text-ink-dim"
                  >
                    {index + 1}
                  </span>
                  <span
                    aria-hidden="true"
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: `var(--hue-${step.tone})` }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-2 text-body-sm font-semibold">
                      {t(`anomalies.analysis.reason.step.${step.key}.name`)}
                      <Mono className="text-micro font-normal text-ink-mute">{step.at}</Mono>
                      {step.duration ? (
                        <span className="text-micro font-medium text-ink-mute">
                          <Num>· {step.duration}</Num>
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block truncate text-micro font-normal text-ink-dim">
                      {t(`anomalies.analysis.reason.step.${step.key}.summary`)}
                    </span>
                  </span>
                  <Icon
                    name={expanded ? 'down' : 'right'}
                    size="sm"
                    className="shrink-0 text-ink-mute"
                  />
                </button>

                {expanded ? (
                  <p className="m-0 mt-1.5 ms-9 rounded-sm bg-sunken px-3 py-2.5 text-body-sm text-ink-dim">
                    {t(`anomalies.analysis.reason.step.${step.key}.detail`)}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ol>
      </Panel>

      <Panel>
        <Eyebrow>{t('anomalies.analysis.reason.observations')}</Eyebrow>
        <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
          {OBSERVATIONS.map((entry) => (
            <li key={entry.key}>
              <Mono
                className={cn(
                  'inline-block rounded-xs px-1.5 py-0.5 text-micro font-bold',
                  TINT_CLASS[entry.tone],
                  ON_TINT_CLASS[entry.tone],
                )}
              >
                {t(`anomalies.analysis.reason.observation.${entry.key}.code`)}
              </Mono>
              <p className="m-0 mt-1.5 text-body-sm text-ink-dim">
                <Num>{t(`anomalies.analysis.reason.observation.${entry.key}.body`)}</Num>
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

/** The 10px/700 uppercase card label DESIGN.md opens every card with. */
function Eyebrow({ className, children }) {
  return (
    <div
      className={cn(
        'text-micro font-semibold tracking-wide text-ink-mute uppercase',
        className,
      )}
    >
      {children}
    </div>
  )
}
