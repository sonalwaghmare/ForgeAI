import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { ForgeButton, IconButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { TrendChart } from '@/components/forge/TrendChart'
import { EmptyState } from '@/components/forge/States'
import { AiBadge, SeverityBadge, StatusBadge } from '@/components/forge/StatusBadge'
import { Dot, Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { formatInteger, formatPercent, formatRelative, formatSigned } from '@/lib/format'
import { cn } from '@/lib/cn'
import { toneForHealth } from '@/lib/tone'

/**
 * The Detailed view's Overview tab.
 *
 * DEMO. Two columns: the instrumentation on the left, the record on the right.
 * That split is the prototype's and is the right one — the left column is what
 * changed today and the right is what is true about the machine, and mixing them
 * is how a page stops having a reading order.
 *
 * Every figure is composed from this asset's own record in the mock handler. See
 * `mocks/fixtures/lines.js`.
 *
 * ── Two of the prototype's cards are deliberately absent ──────────────────
 * Its 3D preview renders a placeholder image on a grid; there is no model behind
 * it and a viewport that cannot be rotated is a promise the product does not
 * keep. Its "Tree View" lists an oil-and-gas hierarchy — VAL › 23 › 230900 › 1st
 * Stage Compression — carried over from a different demo entirely. The asset's
 * real hierarchy path replaces the second and the first is simply not here.
 */

const STATUS_TONE = { running: 'green', idle: null, down: 'red' }
const KPI_KEYS = ['oee', 'uptime', 'mtbf', 'mttr']
const STATUS_WINDOWS = ['24h', '7d', '30d']

export function AssetOverview({ asset, onOpenTab }) {
  const { t } = useTranslation(['app', 'common'])
  const kpis = KPI_KEYS.map((key) => asset.performance?.find((kpi) => kpi.key === key)).filter(Boolean)

  return (
    <div className="grid gap-4 [grid-template-columns:minmax(0,1fr)] xl:[grid-template-columns:minmax(0,1fr)_minmax(19rem,22rem)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <Eyebrow>{t('lines.asset.overview.performanceEyebrow')}</Eyebrow>
              <h2 className="mt-1 mb-0 text-title">{t('lines.asset.overview.performance')}</h2>
            </div>
            <span className="text-micro font-normal text-ink-dim">
              {t('lines.asset.overview.vsPrior')}
            </span>
          </div>
          <dl className="m-0 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(8rem,1fr))]">
            {kpis.map((kpi) => (
              <div key={kpi.key} className="rounded-sm bg-sunken px-3.5 py-3">
                <dt className="eyebrow">{t(`lines.asset.kpi.${kpi.key}`)}</dt>
                <dd className="m-0 mt-1.5">
                  <Num
                    className="text-headline leading-none"
                    style={
                      kpi.unit === '%' ? { color: `var(--on-${toneForHealth(kpi.value)})` } : undefined
                    }
                  >
                    {kpi.value}
                  </Num>
                  <span className="ms-1 text-micro font-normal text-ink-dim">{kpi.unit}</span>
                  {kpi.deltaPct ? (
                    <Num
                      className="mt-1 block text-micro font-normal"
                      style={{ color: `var(--on-${kpi.deltaPct > 0 ? 'green' : 'red'})` }}
                    >
                      {formatSigned(kpi.deltaPct)}%
                    </Num>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>

        <StatusHistory asset={asset} t={t} />
        <SignalTrend asset={asset} t={t} />
        <Pareto asset={asset} t={t} />

        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(17rem,100%),1fr))]">
          <ModelPreview asset={asset} t={t} />
          <TreeView asset={asset} t={t} />
        </div>

        <Relations asset={asset} t={t} />
        <Triage asset={asset} t={t} onOpenTab={onOpenTab} />
        <TelemetryCard asset={asset} t={t} onOpenTab={onOpenTab} />
        <AlertFrequency asset={asset} t={t} onOpenTab={onOpenTab} />
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Panel>
          <div className="flex flex-wrap items-center gap-3">
            <Eyebrow className="flex-1">
              {t('lines.asset.overview.operators', { count: 0 })}
            </Eyebrow>
            <ForgeButton size="sm">
              <Icon name="plus" size="xs" />
              {t('lines.asset.overview.assign')}
            </ForgeButton>
          </div>
          {/* Nobody is assigned, and the demo says so rather than inventing two
              names — the assignment store is a Users & Teams concern and does
              not exist yet. */}
          <p className="mt-3 mb-0 text-body-sm text-ink-dim">
            {t('lines.asset.overview.noOperators')}
          </p>
        </Panel>

        <Identity asset={asset} t={t} />
        <Devices asset={asset} t={t} />
        <Timeline asset={asset} t={t} />
        <CopilotSuggestion asset={asset} t={t} />
      </div>
    </div>
  )
}

/**
 * The model viewer.
 *
 * ── What this shows, and what it does not ─────────────────────────────────
 * The prototype puts a rendered photograph of a bodymaker on every asset in the
 * plant — a compressor, a fan and a palletizer all appear as the same machine.
 * There is no model store behind this product, so what is drawn here is a
 * schematic outline: a real drawing that claims nothing about the shape of the
 * particular machine, with the caption saying so.
 *
 * The card is worth keeping even so. It holds the place a model viewer goes,
 * carries the asset tag, and the zoom works — so when a model store lands, the
 * only thing that changes is what sits on the grid.
 */
function ModelPreview({ asset, t }) {
  const [zoom, setZoom] = useState(100)

  return (
    <Panel>
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <Icon name="layers" size="sm" className="shrink-0 text-ink-mute" />
        <Eyebrow className="flex-1">{t('lines.asset.overview.preview')}</Eyebrow>
        <div className="flex items-center gap-1">
          <IconButton
            label={t('lines.asset.overview.previewZoomOut')}
            onClick={() => setZoom((value) => Math.max(60, value - 20))}
            disabled={zoom <= 60}
          >
            <Icon name="minus" size="xs" />
          </IconButton>
          <IconButton
            label={t('lines.asset.overview.previewZoomIn')}
            onClick={() => setZoom((value) => Math.min(180, value + 20))}
            disabled={zoom >= 180}
          >
            <Icon name="plus" size="xs" />
          </IconButton>
        </div>
      </div>

      <div
        className="relative h-[13rem] overflow-hidden rounded-sm border border-hairline bg-sunken"
        style={{
          // The grid is drawn rather than imaged, so it stays crisp at any zoom
          // and follows the theme instead of baking a light background in.
          backgroundImage:
            'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      >
        <Mono className="absolute top-2 start-2.5 text-micro text-ink-dim">{asset.code}</Mono>
        <svg
          viewBox="0 0 200 140"
          role="img"
          aria-label={asset.name}
          className="h-full w-full transition-transform"
          style={{ transform: `scale(${zoom / 100})` }}
        >
          {/* An isometric block. Three faces at the standard 30°, shaded by
              opacity rather than by three separate colours, so it reads as one
              object lit from one side. */}
          <g
            fill="var(--hue-forge)"
            stroke="var(--ink-mute)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          >
            <polygon points="100,34 158,64 100,94 42,64" fillOpacity="0.28" />
            <polygon points="42,64 100,94 100,116 42,86" fillOpacity="0.16" />
            <polygon points="158,64 100,94 100,116 158,86" fillOpacity="0.10" />
          </g>
          <g stroke="var(--ink-mute)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" vectorEffect="non-scaling-stroke">
            <line x1="100" y1="94" x2="100" y2="116" />
          </g>
        </svg>
      </div>

      <p className="mt-2.5 mb-0 text-micro font-normal text-ink-dim">
        {t('lines.asset.overview.previewNone')}
      </p>
    </Panel>
  )
}

/**
 * The chain from the account down to this machine.
 *
 * The prototype's tree lists VAL › 23 › 230900 · Gas compression & re-injection
 * › 1st Stage Compression — an oil-and-gas hierarchy carried in from a different
 * demo, shown unchanged on a can plant. This is the asset's real path, walked
 * server-side, so it is true for every asset rather than for none of them.
 */
function TreeView({ asset, t }) {
  const path = asset.path ?? []

  return (
    <Panel>
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <Icon name="factory" size="sm" className="shrink-0 text-ink-mute" />
        <Eyebrow className="flex-1">{t('lines.asset.overview.tree')}</Eyebrow>
      </div>
      <ol className="m-0 flex list-none flex-col p-0">
        {path.map((node, index) => {
          const last = index === path.length - 1
          return (
            <li
              key={node.id}
              className="flex items-center gap-2 py-1.5"
              style={{ paddingInlineStart: index * 16 }}
            >
              <Icon
                name={last ? 'right' : 'down'}
                size="xs"
                className="shrink-0 text-ink-mute mirror-rtl"
              />
              <span
                className={cn(
                  'min-w-0 truncate text-body-sm',
                  last ? 'font-semibold text-ink' : index < 2 ? 'font-medium' : 'text-ink-dim',
                )}
              >
                {node.name}
              </span>
              <Eyebrow as="span" className="shrink-0">
                {t(`common:hierarchy.${node.tier}`, { defaultValue: node.tier })}
              </Eyebrow>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

/**
 * How this asset relates to the rest of the tree.
 *
 * Four tabs, and each one answers from the same walked path rather than from a
 * separate field — Parent is the node above, Root is the top, Path is all of it,
 * and Children is empty because an asset is a leaf. Saying that plainly, and
 * pointing at the tab where its parts actually live, is better than an empty
 * list the reader has to interpret.
 */
function Relations({ asset, t }) {
  const [tab, setTab] = useState('parent')
  const path = asset.path ?? []
  const parent = path[path.length - 2]
  const root = path[0]

  const shown = tab === 'parent' ? (parent ? [parent] : []) : tab === 'root' ? (root ? [root] : []) : tab === 'path' ? path : []

  return (
    <Panel flush>
      <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4.5 py-3.5">
        <Icon name="map" size="sm" className="shrink-0 text-ink-mute" />
        <Eyebrow className="flex-1">{t('lines.asset.overview.relations')}</Eyebrow>
      </div>

      <div role="tablist" className="flex gap-1 border-b border-hairline px-3">
        {['parent', 'root', 'path', 'children'].map((entry) => {
          const count =
            entry === 'parent' ? (parent ? 1 : 0) : entry === 'root' ? 1 : entry === 'path' ? path.length : 0
          return (
            <button
              key={entry}
              type="button"
              role="tab"
              aria-selected={entry === tab}
              onClick={() => setTab(entry)}
              className={cn(
                '-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-body-sm whitespace-nowrap transition-colors',
                entry === tab
                  ? 'border-forge font-semibold text-ink'
                  : 'border-transparent text-ink-dim hover:text-ink',
              )}
            >
              {t(`lines.asset.overview.relationTabs.${entry}`)}
              {count ? <Num className="text-micro text-ink-mute">{count}</Num> : null}
            </button>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <p className="m-0 px-4.5 py-4 text-body-sm text-ink-dim">
          {t('lines.asset.overview.noChildren')}
        </p>
      ) : (
        <div className="px-4.5 py-3">
          <Eyebrow className="mb-2">{t('lines.asset.overview.relationName')}</Eyebrow>
          <ul className="m-0 flex list-none flex-col p-0">
            {shown.map((node) => (
              <li
                key={node.id}
                className="flex items-center gap-2.5 border-b border-subtle py-2 last:border-b-0"
              >
                <Icon name="factory" size="xs" className="shrink-0 text-ink-mute" />
                <span className="min-w-0 flex-1 truncate text-body-sm font-medium">{node.name}</span>
                <Eyebrow as="span" className="shrink-0">
                  {t(`common:hierarchy.${node.tier}`, { defaultValue: node.tier })}
                </Eyebrow>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}

/**
 * Where the machine spent its time.
 *
 * Three proportion bars on one axis rather than a stacked bar, because the
 * question is "how much downtime" and a stack makes you measure a segment that
 * does not start at zero. The percentage sits at the end of each row so the
 * three can be read as a column.
 */
function StatusHistory({ asset, t }) {
  const [window, setWindow] = useState('24h')
  const history = asset.statusHistory?.[window]
  if (!history) return null

  const byKey = Object.fromEntries(history.rows.map((row) => [row.key, row]))

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Eyebrow className="flex-1">
          {t('lines.asset.overview.statusHistory')} · {window}
        </Eyebrow>
        <div role="group" aria-label={t('lines.asset.overview.statusWindow')} className="flex gap-1.5">
          {STATUS_WINDOWS.map((entry) => (
            <Chip key={entry} selected={entry === window} onClick={() => setWindow(entry)}>
              {entry}
            </Chip>
          ))}
        </div>
      </div>

      {/* The axis sits ABOVE the bars, as the design has it — the labels belong
          to the track they head, and a reader looking at the top row should not
          have to travel to the bottom of the card to find out what the width
          means.

          Oldest first, left to right. The design runs this one axis newest-first
          while the Signal Trend directly below it runs oldest-first, which is two
          directions on one screen; the rest of the product reads left to right
          through time and this does too. */}
      <div className="mb-2 flex justify-between ps-[9.5rem] pe-[4.5rem]">
        {history.ticks.map((tick, index) => (
          <Num key={`${tick}-${index}`} className="text-micro font-normal text-ink-mute">
            {tick}
          </Num>
        ))}
      </div>

      {/* The whole asset first, as one stacked bar: the three rows below break it
          apart, and without the combined line there is nothing saying they are
          three views of one window rather than three separate measurements. */}
      <div className="mb-3 flex items-center gap-3">
        <span className="w-[9.5rem] shrink-0 truncate text-body-sm font-semibold">
          {asset.name}
        </span>
        <span
          role="img"
          aria-label={history.rows
            .map((row) => `${t(`lines.asset.overview.statusRow.${row.key}`)} ${row.pct}%`)
            .join(', ')}
          className="flex h-5 flex-1 overflow-hidden rounded-xs bg-sunken"
        >
          {history.rows
            .filter((row) => row.pct > 0)
            .map((row) => (
              <span
                key={row.key}
                className="block h-full"
                style={{
                  width: `${row.pct}%`,
                  background: STATUS_TONE[row.key]
                    ? `var(--hue-${STATUS_TONE[row.key]})`
                    : 'var(--ink-mute)',
                }}
              />
            ))}
        </span>
        <span className="w-14 shrink-0" />
      </div>

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {['running', 'idle', 'down'].map((key) => {
          const row = byKey[key]
          if (!row) return null
          return (
            <li key={key} className="flex items-center gap-3">
              <span className="w-[9.5rem] shrink-0 text-body-sm text-ink-dim">
                {t(`lines.asset.overview.statusRow.${key}`)}
              </span>
              <span
                role="img"
                aria-label={`${t(`lines.asset.overview.statusRow.${key}`)} ${row.pct}%`}
                className="relative h-5 flex-1 overflow-hidden rounded-xs bg-sunken"
              >
                {row.segments.map((segment, index) => (
                  <span
                    key={index}
                    className="absolute inset-y-0 rounded-xs"
                    style={{
                      // Logical, so the timeline runs oldest-to-newest in both
                      // directions rather than reversing under `dir="rtl"`.
                      insetInlineStart: `${segment.start}%`,
                      width: `${segment.width}%`,
                      background: STATUS_TONE[key] ? `var(--hue-${STATUS_TONE[key]})` : 'var(--ink-mute)',
                    }}
                  />
                ))}
              </span>
              {/* A filled pill, not a tint. This is the row's headline figure and
                  the design gives it the full hue; a tinted badge here would sit
                  quieter than the bar it is summarising. */}
              <span
                className="w-14 shrink-0 rounded-pill py-0.5 text-center text-micro font-bold text-white"
                style={{
                  background: STATUS_TONE[key] ? `var(--hue-${STATUS_TONE[key]})` : 'var(--ink-mute)',
                }}
              >
                <Num>{formatPercent(row.pct, 0)}</Num>
              </span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function SignalTrend({ asset, t }) {
  const signals = asset.signals ?? []
  const [key, setKey] = useState(signals[0]?.key ?? null)
  const signal = signals.find((entry) => entry.key === key) ?? signals[0]
  if (!signal) return null

  const alert = asset.openAlerts.find((entry) => entry.id === signal.alertId)

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Eyebrow className="flex-1">
          {t('lines.asset.overview.signalTrend')} · {signal.name}
        </Eyebrow>
        <ForgeSelect
          label={t('lines.asset.overview.signalPick')}
          labelInline
          size="sm"
          value={signal.key}
          onValueChange={setKey}
          options={signals.map((entry) => ({ value: entry.key, label: entry.name }))}
        />
      </div>
      {/* No axes. The reading and its normal band are printed in words above the
          chart, so four y-labels and five time-labels would be a third statement
          of the same thing, competing with the shape — which is the only thing
          this card is for. The band and the grid stay. */}
      <TrendChart
        axis={false}
        legend={false}
        series={[
          {
            key: signal.key,
            label: signal.name,
            // The signal under an open alert takes that alert's severity; every
            // other trace is neutral, so the coloured one is the one to read.
            tone: alert ? 'red' : 'muted',
            values: signal.values,
          },
        ]}
        band={signal.band}
        label={signal.name}
        bandLabel={t('lines.asset.overview.threshold', {
          lo: signal.band[0],
          hi: signal.band[1],
          unit: signal.unit,
        })}
        xLabel={t('oee.trend.xLabel')}
        format={(value) => `${value} ${signal.unit}`}
      />
    </Panel>
  )
}

/**
 * Downtime by cause.
 *
 * Ordered worst-first with a running cumulative, which is the whole analysis —
 * an unordered Pareto is a bar chart. The cumulative is text rather than the
 * prototype's second axis: at five rows the curve says nothing the numbers do
 * not, and it costs an axis nobody reads.
 */
function Pareto({ asset, t }) {
  const rows = asset.pareto ?? []
  if (!rows.length) return null
  const worst = rows[0].hours

  return (
    <Panel>
      <Eyebrow className="mb-4 block">{t('lines.asset.overview.pareto')}</Eyebrow>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((row, index) => (
          <li key={row.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-body-sm text-ink-dim">{row.label}</span>
              <span className="text-body-sm">
                <Num className="font-semibold">
                  {t('lines.asset.overview.paretoHours', { hours: formatInteger(row.hours) })}
                </Num>{' '}
                <Num className="text-ink-dim">
                  {t('lines.asset.overview.paretoCum', { pct: formatPercent(row.cumulativePct, 0) })}
                </Num>
              </span>
            </div>
            <span aria-hidden="true" className="block h-2 overflow-hidden rounded-xs bg-sunken">
              <span
                className="block h-full rounded-xs"
                style={{
                  width: `${(row.hours / worst) * 100}%`,
                  // The top two causes are the ones worth fixing; the tail is
                  // neutral so the eye is not asked to rank five colours.
                  background:
                    index === 0
                      ? 'var(--hue-red)'
                      : index === 1
                        ? 'var(--hue-amber)'
                        : 'var(--ink-mute)',
                }}
              />
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function Triage({ asset, t, onOpenTab }) {
  return (
    <Panel flush>
      <div className="flex flex-wrap items-end gap-3 border-b border-hairline px-4.5 py-3.5">
        <div className="min-w-0 flex-1">
          <Eyebrow>{t('lines.asset.overview.triage')}</Eyebrow>
          <h2 className="mt-1 mb-0 text-title">
            {t('lines.asset.overview.activeAlerts', { count: asset.openAlerts.length })}
          </h2>
        </div>
        <ForgeButton size="sm" onClick={() => onOpenTab('alerts')}>
          {t('lines.asset.overview.viewAll')}
          <Icon name="right" size="xs" className="mirror-rtl" />
        </ForgeButton>
      </div>

      {asset.openAlerts.length === 0 ? (
        <EmptyState
          icon="shield"
          title={t('lines.asset.synopsis.noAnomalies')}
          className="border-0 bg-transparent shadow-none"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-body-sm">
            <thead>
              <tr className="bg-sunken">
                {['alert', 'severity', 'status', 'detected'].map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="eyebrow border-b border-hairline px-4 py-2.5 text-start whitespace-nowrap"
                  >
                    {t(`lines.asset.overview.alertColumns.${column}`)}
                  </th>
                ))}
                <th scope="col" className="border-b border-hairline px-4 py-2.5">
                  <span className="sr-only">{t('common:actions.viewDetails')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {asset.openAlerts.map((alert) => (
                <tr key={alert.id} className="border-b border-subtle last:border-b-0">
                  <th scope="row" className="px-4 py-2.5 text-start">
                    <Mono className="font-semibold">{alert.id}</Mono>
                    <span className="mt-0.5 block text-micro font-normal text-ink-dim">
                      {alert.component} · {alert.sensor}
                    </span>
                  </th>
                  <td className="px-4 py-2.5">
                    <SeverityBadge severity={alert.severity} dot />
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={alert.status} />
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-ink-dim">
                    <Num>{formatRelative(alert.detectedAt)}</Num>
                  </td>
                  <td className="px-4 py-2.5 text-end">
                    <ForgeButton asChild size="sm" variant="primary">
                      <Link to="/app/anomalies">{t('lines.asset.overview.open')}</Link>
                    </ForgeButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

/**
 * One live channel, on the Overview.
 *
 * ── Why this is not the Signal Trend card again ───────────────────────────
 * Signal Trend is a browser: it has a selector and you go looking through the
 * instruments. This is a watch — it shows the ONE channel that matters on this
 * machine right now, with no control on it, and its only affordance is the way
 * out to the full Telemetry tab. Two cards charting sensors on one page is only
 * redundant if they answer the same question, and they do not.
 *
 * Which channel: the one carrying the worst open alert, or the first instrument
 * if nothing is open. Never a fixed "Vibration", which is what the prototype
 * shows on a washer and on a palletizer alike.
 */
function TelemetryCard({ asset, t, onOpenTab }) {
  const signals = asset.signals ?? []
  if (!signals.length) return null

  const alerted = signals.find((signal) =>
    asset.openAlerts.some((alert) => alert.id === signal.alertId),
  )
  const signal = alerted ?? signals[0]
  const alert = asset.openAlerts.find((entry) => entry.id === signal.alertId)

  return (
    <Panel>
      <div className="mb-1.5 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <Eyebrow>{t('lines.asset.overview.telemetry')}</Eyebrow>
          <h2 className="mt-1 mb-0 text-title">
            {t('lines.asset.overview.telemetryLive', { name: signal.name })}
          </h2>
        </div>
        <ForgeButton size="sm" onClick={() => onOpenTab('telemetry')}>
          {t('lines.asset.overview.openTelemetry')}
          <Icon name="right" size="xs" className="mirror-rtl" />
        </ForgeButton>
      </div>

      {/* The freshness comes from the asset's own last-seen, not a hardcoded
          "1s ago" — a stale machine should not claim to be reporting. */}
      <Num className="mb-3.5 block text-micro font-normal text-ink-dim">
        {t('lines.asset.overview.telemetryUpdated', {
          when: asset.lastSeenAt ? formatRelative(asset.lastSeenAt) : '—',
          lo: signal.band[0],
          hi: signal.band[1],
          unit: signal.unit,
        })}
      </Num>

      <TrendChart
        axis={false}
        legend={false}
        series={[
          {
            key: signal.key,
            label: signal.name,
            tone: alert ? 'red' : 'muted',
            values: signal.values,
          },
        ]}
        band={signal.band}
        label={signal.name}
        bandLabel={t('lines.asset.overview.threshold', {
          lo: signal.band[0],
          hi: signal.band[1],
          unit: signal.unit,
        })}
        xLabel={t('oee.trend.xLabel')}
        format={(value) => `${value} ${signal.unit}`}
      />
    </Panel>
  )
}

/**
 * Ninety days of alert counts, one square per day.
 *
 * Four intensity steps and no more: a heatmap whose scale a reader has to
 * consult is a table drawn badly. The legend states the direction rather than
 * the numbers, which is what the four figures above it are for.
 */
function AlertFrequency({ asset, t, onOpenTab }) {
  const frequency = asset.alertHistory
  if (!frequency) return null

  const tones = [null, 'green', 'amber', 'forge', 'red']
  const swatch = (count) =>
    count === 0 ? 'var(--surface-sunken)' : `color-mix(in srgb, var(--hue-${tones[count]}) 55%, transparent)`

  const stats = [
    ['freqTotal', formatInteger(frequency.stats.total)],
    ['freqPeak', formatInteger(frequency.stats.peak)],
    ['freqActive', formatInteger(frequency.stats.activeDays)],
    ['freqLastSeven', formatInteger(frequency.stats.lastSeven)],
  ]

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <Eyebrow>{t('lines.asset.overview.alertFrequencyEyebrow')}</Eyebrow>
          <h2 className="mt-1 mb-0 text-title">{t('lines.asset.overview.alertFrequency')}</h2>
        </div>
        <ForgeButton size="sm" onClick={() => onOpenTab('alerts')}>
          {t('lines.asset.overview.alertsHistory')}
          <Icon name="right" size="xs" className="mirror-rtl" />
        </ForgeButton>
      </div>

      <dl className="m-0 mb-4 flex flex-wrap gap-x-8 gap-y-3">
        {stats.map(([key, value]) => (
          <div key={key}>
            <dd className="m-0">
              <Num className="text-headline leading-none">{value}</Num>
            </dd>
            <dt className="mt-1 text-micro font-normal text-ink-dim">
              {t(`lines.asset.overview.${key}`)}
            </dt>
          </div>
        ))}
      </dl>

      <div
        role="img"
        aria-label={t('lines.asset.overview.freqLegend')}
        className="grid grid-flow-col grid-rows-7 gap-[3px]"
      >
        {frequency.counts.map((count, index) => (
          <span
            key={index}
            className="aspect-square rounded-[3px]"
            style={{ background: swatch(count) }}
          />
        ))}
      </div>

      <div className="mt-2.5 flex items-center justify-end gap-1.5 text-micro font-normal text-ink-dim">
        <span>{t('lines.asset.overview.freqLess')}</span>
        {[0, 1, 2, 3, 4].map((count) => (
          <span
            key={count}
            aria-hidden="true"
            className="inline-block size-2.5 rounded-[3px]"
            style={{ background: swatch(count) }}
          />
        ))}
        <span>{t('lines.asset.overview.freqMore')}</span>
      </div>
    </Panel>
  )
}

function Identity({ asset, t }) {
  const rows = [
    ['tag', <Mono key="tag" className="text-on-forge">{asset.code}</Mono>],
    ['type', t(`lines.type.${asset.type}`, { defaultValue: asset.type })],
    ['criticality', t(`common:severity.${asset.criticality}`)],
    ['line', asset.lineName],
    ['site', asset.siteName],
    ['installed', asset.installed],
    ['owner', asset.ownerName],
    ['runHours', <Num key="hours">{formatInteger(asset.runHours)}</Num>],
  ]

  return (
    <Panel flush>
      <div className="border-b border-hairline px-4.5 py-3">
        <Eyebrow>{t('lines.asset.overview.identity')}</Eyebrow>
      </div>
      <dl className="m-0 px-4.5 py-1">
        {rows.map(([key, value]) => (
          <div key={key} className="flex gap-3 border-b border-subtle py-2.5 last:border-b-0">
            <dt className="min-w-0 flex-1 text-body-sm text-ink-dim">
              {t(`lines.asset.overview.identityRow.${key}`)}
            </dt>
            <dd className="m-0 text-end text-body-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

/**
 * The instruments and whether they are reporting.
 *
 * "Stale" is derived from the asset's own last-seen rather than assigned by
 * position — the prototype marks every third sensor stale, which means a machine
 * that is streaming cleanly still shows one.
 */
function Devices({ asset, t }) {
  const signals = asset.signals ?? []
  const stale = !asset.online || (asset.lastSeenMinutes ?? 0) > 5

  return (
    <Panel flush>
      <div className="border-b border-hairline px-4.5 py-3">
        <Eyebrow>{t('lines.asset.overview.devices', { count: signals.length })}</Eyebrow>
      </div>
      <ul className="m-0 list-none px-4.5 py-1">
        {signals.map((signal) => (
          <li
            key={signal.key}
            className="flex items-center gap-2.5 border-b border-subtle py-2.5 last:border-b-0"
          >
            <Icon name="wave" size="xs" className="shrink-0 text-ink-mute" />
            <span className="min-w-0 flex-1 text-body-sm">{signal.name}</span>
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 text-micro font-normal',
                stale ? 'text-on-amber' : 'text-on-green',
              )}
            >
              <Dot tone={stale ? 'amber' : 'green'} size={6} />
              {stale
                ? `${t('lines.asset.overview.stale')} ${asset.lastSeenMinutes ?? 0}m`
                : t('lines.asset.overview.live')}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function Timeline({ asset, t }) {
  return (
    <Panel flush>
      <div className="border-b border-hairline px-4.5 py-3">
        <Eyebrow>{t('lines.asset.overview.timeline')}</Eyebrow>
      </div>
      <ul className="m-0 list-none px-4.5 py-2.5">
        {(asset.timeline ?? []).map((event) => (
          <li key={event.key} className="flex items-start gap-2.5 py-1.5 text-body-sm">
            <Dot tone={event.tone} size={7} className="mt-1.5 shrink-0" />
            <span className="min-w-0 flex-1">{event.text}</span>
            {event.at ? (
              <Num className="shrink-0 text-micro font-normal text-ink-dim">
                {formatRelative(event.at)}
              </Num>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/**
 * The machine's suggestion.
 *
 * Its confidence comes from the worst open alert's fusion score rather than a
 * literal, so a low-confidence detection cannot present as an 87% certainty —
 * which is what the prototype shows on every asset it renders.
 */
function CopilotSuggestion({ asset, t }) {
  const worst = asset.openAlerts[0]
  if (!worst) return null

  return (
    <Panel stripe="violet">
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <Icon name="ai" size="sm" className="text-violet" />
        <Eyebrow className="flex-1">{t('lines.asset.overview.copilot')}</Eyebrow>
        <AiBadge label={t('lines.asset.overview.confidence', { pct: formatPercent(worst.fusionScore, 0) })} />
      </div>
      <p className="m-0 text-body-sm leading-[1.6] text-ink-dim">
        {t(`common:rules.${worst.rule}`, { defaultValue: worst.rule })} —{' '}
        {t(`common:anomalyTypes.${worst.anomalyType}`, { defaultValue: worst.anomalyType })} on{' '}
        {worst.component}, {worst.cascadeSensors ?? worst.detectors.length} signals agreeing.
      </p>
      <ForgeButton variant="primary" className="mt-3.5">
        <Icon name="wrench" size="xs" />
        {t('lines.asset.overview.openWorkOrder')}
      </ForgeButton>
    </Panel>
  )
}
