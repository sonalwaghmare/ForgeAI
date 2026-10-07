import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { MetricCard } from '@/components/forge/MetricCard'
import { Meter } from '@/components/forge/Meter'
import { Panel } from '@/components/forge/Panel'
import { TrendChart } from '@/components/forge/TrendChart'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import {
  AiBadge,
  SeverityBadge,
  StateBadge,
  hueForSeverity,
} from '@/components/forge/StatusBadge'
import { Dot, Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { useLine } from '@/features/lines/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatInteger, formatPercent, formatRelative } from '@/lib/format'
import { formatMeasure } from '@/lib/units'
import { cn } from '@/lib/cn'

/**
 * One production line.
 *
 * DEMO. The material-flow strip is the centrepiece and is the reason this screen
 * exists rather than being a filtered asset list: a line is a sequence, and the
 * fact worth seeing is that one station is blocked and everything after it has
 * gone quiet. A table cannot show that; eight cards with arrows between them can.
 *
 * ── Blocked and starved are different, and the strip says so ──────────────
 * Only one station on this line is in trouble. The four after it are at zero
 * because nothing is arriving, which is a consequence rather than a fault — so
 * they are dimmed and labelled starved, and they do not take a fault colour.
 * Painting all five red would make the reader hunt for five problems.
 */

const STATE_TONE = { running: 'green', stopped: 'red', idle: null }

export function LineDetailPage() {
  const { t } = useTranslation(['app', 'common'])
  const { lineId } = useParams()
  const navigate = useNavigate()
  const line = useLine(lineId)

  useDocumentTitle(`${line.data?.name ?? t('screens.assets')} · ${t('common:brand.name')}`)

  return (
    <Page>
      <div className="mb-4">
        <ForgeButton asChild>
          <Link to="/app/assets">
            <Icon name="right" size="xs" className="rotate-180 rtl:rotate-0" />
            {t('lines.detail.back')}
          </Link>
        </ForgeButton>
      </div>

      {line.isError ? (
        <ErrorState error={line.error} title={t('lines.loadFailed')} onRetry={() => line.refetch()} />
      ) : line.isPending ? (
        <SkeletonRows count={6} />
      ) : !line.data ? (
        <EmptyState icon="factory" title={t('lines.notFound')} />
      ) : (
        <LineBody line={line.data} t={t} navigate={navigate} />
      )}
    </Page>
  )
}

function LineBody({ line, t, navigate }) {
  const tone = STATE_TONE[line.state] ?? null
  const stopped = line.state === 'stopped'
  const blockedAsset = line.assets.find((asset) => asset.id === line.stoppedAtAssetId)

  return (
    <>
      <header className="mb-5">
        <h1 className="m-0 text-display text-balance">{line.name}</h1>
        <p className="mt-2 mb-0 text-body text-ink-dim">
          {line.state === 'idle'
            ? t('lines.detail.subtitleIdle', { site: line.siteName })
            : t('lines.detail.subtitle', {
                site: line.siteName,
                shift: t(`common:shift.${line.shift}`),
                operator: line.operatorName,
                since: line.runningSince,
              })}
        </p>
      </header>

      <div className="mb-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
        <MetricCard
          icon="bolt"
          tone={tone}
          label={t('lines.detail.state')}
          value={t(`lines.state.${line.state}`)}
          sub={
            stopped && blockedAsset
              ? t('lines.detail.stateStopped', {
                  asset: blockedAsset.name,
                  minutes: line.stoppedForMinutes,
                })
              : undefined
          }
        />
        <MetricCard
          icon="layers"
          label={t('lines.detail.output')}
          value={line.outputToday == null ? '—' : formatInteger(line.outputToday)}
          sub={
            line.outputToday == null
              ? undefined
              : t('lines.detail.outputSub', { unit: line.unit, pct: formatPercent(line.outputPct, 0) })
          }
        />
        <MetricCard
          icon="bell"
          tone={line.alerts.total ? (line.alerts.worst === 'critical' ? 'red' : 'amber') : null}
          label={t('lines.detail.openAlerts')}
          value={formatInteger(line.alerts.total)}
          sub={severitySub(line.alerts, t)}
        />
        <MetricCard
          icon="gauge"
          tone={line.oee == null ? null : line.oee >= 80 ? 'green' : 'amber'}
          label={t('lines.detail.oee')}
          value={line.oee == null ? '—' : formatPercent(line.oee, 0)}
          delta={line.oeeDeltaPts}
          sub={line.oeeDeltaPts == null ? undefined : t('lines.detail.oeeSub', { delta: line.oeeDeltaPts })}
        />
      </div>

      <div className="mb-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(22rem,100%),1fr))]">
        <Panel>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="m-0 flex-1 text-title">{t('lines.detail.throughput')}</h2>
            <StateBadge tone="green">{t('lines.detail.streaming')}</StateBadge>
          </div>
          <TrendChart
            series={[
              {
                key: 'throughput',
                label: line.unit,
                tone: stopped ? 'red' : 'forge',
                values: line.throughput,
              },
            ]}
            band={[line.target * 0.82, line.target]}
            label={t('lines.detail.throughputLabel')}
            bandLabel={t('lines.detail.throughputBand')}
            xLabel={t('oee.trend.xLabel')}
            format={(value) => formatInteger(value)}
          />
        </Panel>

        <LineAlerts line={line} t={t} navigate={navigate} />
      </div>

      <Panel className="mb-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="m-0 flex-1 text-title">{t('lines.detail.flow')}</h2>
          <span className="text-micro font-normal text-ink-dim">{t('lines.detail.flowHint')}</span>
        </div>
        {line.assets.length === 0 ? (
          <EmptyState icon="factory" className="border-0 bg-transparent shadow-none" />
        ) : (
          /* Horizontally scrollable rather than wrapped: the order IS the
             meaning, and a strip that wraps to a second row puts the Washer
             above the Decorator, which says the wrong thing about a line. */
          /* `pt-3` and `pe-2` are not spacing, they are clearance. `overflow-x`
             also clips the block axis, and the alert-count badge sits half
             outside its card's top-inline-end corner — without room inside the
             scroller it is cut in half, which is how a count of 1 renders as a
             red smear. */
          <ol className="m-0 flex list-none items-stretch gap-1 overflow-x-auto px-0 pt-3 pe-2 pb-1">
            {line.assets.map((asset, index) => (
              <li key={asset.id} className="flex shrink-0 items-center gap-1">
                <StationCard asset={asset} unit={line.unit} target={line.target} t={t} />
                {index < line.assets.length - 1 ? (
                  <Icon
                    name="right"
                    size="sm"
                    aria-hidden="true"
                    className={cn(
                      'shrink-0 mirror-rtl',
                      // The arrow into a starved station is dimmed, because
                      // nothing is moving along it.
                      line.assets[index + 1].starved || asset.starved || asset.blocked
                        ? 'text-ink-mute opacity-40'
                        : 'text-on-forge',
                    )}
                  />
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Panel>

      {line.note ? (
        <Panel stripe="violet">
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <Icon name="ai" size="sm" className="text-violet" />
            <h2 className="m-0 text-title">{t('lines.detail.constraint')}</h2>
            <AiBadge label={t('common:ai.authored')} />
          </div>
          <p className="m-0 text-body leading-[1.65] text-ink-dim">{line.note}</p>
          {blockedAsset ? (
            <ForgeButton
              asChild
              variant="primary"
              className="mt-4"
            >
              <Link to={`/app/assets/${blockedAsset.id}`}>
                {blockedAsset.name}
                <Icon name="right" size="xs" className="mirror-rtl" />
              </Link>
            </ForgeButton>
          ) : null}
        </Panel>
      ) : null}
    </>
  )
}

/** "1 critical · 1 high · 1 medium", omitting the zeroes. */
function severitySub(alerts, t) {
  const parts = ['critical', 'high', 'medium', 'low']
    .filter((severity) => alerts[severity])
    .map((severity) => `${alerts[severity]} ${t(`common:severity.${severity}`).toLowerCase()}`)
  return parts.length ? parts.join(' · ') : undefined
}

/**
 * One station on the flow strip.
 *
 * Fixed width so the eight read as a sequence of equals rather than as a set
 * sized by how long each machine's name is.
 */
function StationCard({ asset, unit, target, t }) {
  const tone = asset.blocked
    ? 'red'
    : asset.alerts.worst === 'critical'
      ? 'red'
      : asset.alerts.worst === 'high'
        ? 'amber'
        : null
  const rate = asset.throughput ?? 0
  const utilisation = target ? Math.round((rate / target) * 100) : 0

  return (
    <Link
      to={`/app/assets/${asset.id}`}
      className={cn(
        'relative flex w-[9.5rem] flex-col rounded-sm border border-hairline bg-card p-3 shadow-edge',
        'transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-forge/40 hover:shadow-lift',
        // Starved is dimmed, not coloured. It is a consequence, not a fault.
        asset.starved && 'opacity-60',
        tone && 'border-current/20',
      )}
      style={tone ? { borderColor: `color-mix(in srgb, var(--hue-${tone}) 40%, transparent)` } : undefined}
    >
      {asset.alerts.total ? (
        <span
          aria-hidden="true"
          className="absolute -top-2 -end-2 flex size-5 items-center justify-center rounded-full text-micro font-bold text-white"
          style={{ background: `var(--hue-${tone ?? 'amber'})` }}
        >
          <Num>{asset.alerts.total}</Num>
        </span>
      ) : null}

      <span className="mb-2 flex items-center gap-1.5">
        <Dot tone={tone ?? 'green'} size={6} />
        <Mono className="text-micro font-bold text-ink-dim">{asset.code.split('-').slice(-2).join('-')}</Mono>
        {asset.blocked ? (
          <span className="ms-auto rounded-xs tint-red px-1.5 py-px text-[0.5625rem] font-bold text-on-red uppercase">
            {t('lines.detail.blocked')}
          </span>
        ) : asset.starved ? (
          <span className="ms-auto rounded-xs bg-sunken px-1.5 py-px text-[0.5625rem] font-bold text-ink-mute uppercase">
            {t('lines.detail.starved')}
          </span>
        ) : null}
      </span>

      <span className="mb-2.5 block text-body-sm leading-tight font-semibold">{asset.name}</span>

      <span className="mt-auto flex items-baseline justify-between gap-2">
        <Eyebrow as="span">{t('lines.detail.rate')}</Eyebrow>
        <Num
          className="text-body-sm font-semibold"
          style={rate ? undefined : { color: 'var(--ink-mute)' }}
        >
          {formatInteger(rate)}
        </Num>
      </span>
      <span aria-hidden="true" className="mt-1 block h-[3px] overflow-hidden rounded-pill bg-sunken">
        <span
          className="block h-full rounded-pill"
          style={{ width: `${utilisation}%`, background: `var(--hue-${tone ?? 'green'})` }}
        />
      </span>

      <span className="mt-2 flex items-baseline justify-between gap-2 border-t border-subtle pt-2">
        <Eyebrow as="span">{t('lines.row.health')}</Eyebrow>
        <Meter value={asset.health} label={t('lines.row.health')} compact />
      </span>
      <span className="sr-only">{unit}</span>
    </Link>
  )
}

/**
 * The line's open alerts, one tab each.
 *
 * Tabs rather than a list because the prototype's arrangement is right here: on
 * a line with three or four open alerts, each one wants its reading, its
 * detector confidence and its two actions, and four of those stacked is a column
 * nobody scrolls to the end of.
 */
function LineAlerts({ line, t, navigate }) {
  const [index, setIndex] = useState(0)
  const alerts = line.openAlerts
  const alert = alerts[Math.min(index, alerts.length - 1)]

  return (
    <Panel flush>
      <div className="flex items-center gap-3 border-b border-hairline px-4.5 py-3.5">
        <h2 className="m-0 flex-1 text-title">{t('lines.alertsPanel.title')}</h2>
        <span className="text-micro font-normal text-ink-dim">
          <Num>{t('lines.alertsPanel.count', { count: alerts.length })}</Num>
        </span>
      </div>

      {!alert ? (
        <EmptyState icon="shield" title={t('lines.alertsPanel.none')} className="border-0 bg-transparent shadow-none" />
      ) : (
        <>
          <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-hairline px-3">
            {alerts.map((entry, entryIndex) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={entry === alert}
                onClick={() => setIndex(entryIndex)}
                className={cn(
                  'flex shrink-0 items-center gap-2 border-b-2 px-2.5 py-2.5 text-body-sm whitespace-nowrap transition-colors',
                  entry === alert
                    ? 'font-semibold text-ink'
                    : 'border-transparent text-ink-dim hover:text-ink',
                )}
                style={
                  entry === alert
                    ? { borderBottomColor: `var(--hue-${hueForSeverity(entry.severity)})` }
                    : undefined
                }
              >
                <Dot tone={hueForSeverity(entry.severity)} size={6} />
                {entry.sensor}
              </button>
            ))}
          </div>

          <div className="px-4.5 py-4">
            <div className="mb-3.5 flex flex-wrap items-center gap-2">
              <SeverityBadge severity={alert.severity} dot />
              <span className="text-body font-semibold">{alert.assetName}</span>
              <Mono className="ms-auto text-micro text-ink-dim">{alert.id}</Mono>
            </div>

            <dl className="m-0 mb-3.5 grid grid-cols-2 gap-3">
              {[
                ['asset', alert.component],
                ['sensor', alert.sensor],
                ['reading', formatMeasure(alert.reading)],
                ['detected', formatRelative(alert.detectedAt)],
              ].map(([key, value]) => (
                <div key={key}>
                  <dt className="eyebrow">{t(`lines.alertsPanel.${key}`)}</dt>
                  <dd className="m-0 mt-1 text-body-sm font-medium">
                    <Num>{value}</Num>
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mb-4">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <Eyebrow as="span">{t('lines.alertsPanel.confidence')}</Eyebrow>
                <Num className="text-body-sm font-semibold">{formatPercent(alert.fusionScore, 0)}</Num>
              </div>
              <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-pill bg-sunken">
                <span
                  className="block h-full rounded-pill"
                  style={{
                    width: `${alert.fusionScore}%`,
                    background: `var(--hue-${hueForSeverity(alert.severity)})`,
                  }}
                />
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <ForgeButton variant="primary" onClick={() => navigate('/app/anomalies')}>
                {t('lines.alertsPanel.investigate')}
              </ForgeButton>
              <ForgeButton asChild>
                <Link to={`/app/assets/${alert.assetId}`}>{t('lines.alertsPanel.openAsset')}</Link>
              </ForgeButton>
            </div>
          </div>
        </>
      )}
    </Panel>
  )
}
