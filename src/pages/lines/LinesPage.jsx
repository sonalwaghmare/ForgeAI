import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { Chip } from '@/components/forge/Chip'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { MetricCard } from '@/components/forge/MetricCard'
import { Meter } from '@/components/forge/Meter'
import { Panel } from '@/components/forge/Panel'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { PlainBadge, StateBadge } from '@/components/forge/StatusBadge'
import { Dot, Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { LINE_STATES } from '@/features/lines/api'
import { useLines } from '@/features/lines/queries'
import { useHomeContext } from '@/features/home/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatInteger, formatPercent } from '@/lib/format'
import { cn } from '@/lib/cn'
import { toneForHealth } from '@/lib/tone'
import { ModuleTabs } from './ModuleTabs'

/**
 * Lines & Assets — the line list.
 *
 * DEMO. See `DEMO-MODE.md` §8.3 and `mocks/fixtures/lines.js`, which explains
 * why the plant's shape is read from the hierarchy rather than authored again.
 *
 * ── An accordion, not a table ─────────────────────────────────────────────
 * The prototype makes each line a card that expands into its assets in place,
 * and that is right for this screen rather than decorative: a line is a
 * container, and the question somebody arrives with is "which line is in
 * trouble, and which machine on it". A table of lines answers half of that and
 * sends you to a second page for the other half. Expanding in place keeps the
 * comparison — six lines, one of them stopped — on screen while you look inside
 * one of them.
 *
 * The stopped line starts open, because that is the row the page is about.
 *
 * ── The leading edge is earned here ───────────────────────────────────────
 * A line card takes a coloured edge only when the line is stopped or carrying a
 * critical. Idle takes none: a line nobody scheduled is not a line that broke,
 * and the prototype greys it for exactly that reason.
 */

/** Tone for a line's state. `idle` is deliberately colourless. */
const STATE_TONE = { running: 'green', stopped: 'red', idle: null }

export function LinesPage() {
  const { t } = useTranslation(['app', 'common'])
  const navigate = useNavigate()

  const context = useHomeContext()
  const siteId = context.data?.siteId
  const lines = useLines(siteId)

  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(null)

  useDocumentTitle(`${t('screens.assets')} · ${t('common:brand.name')}`)

  const items = useMemo(() => lines.data?.items ?? [], [lines.data])

  // The stopped line opens itself, once, and only until somebody touches the
  // accordion — after that the reader's choice wins.
  const openId = expanded ?? items.find((line) => line.state === 'stopped')?.id ?? null

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((line) => {
      if (filter !== 'all' && line.state !== filter) return false
      if (!needle) return true
      return [line.name, line.code, line.building].join(' ').toLowerCase().includes(needle)
    })
  }, [items, filter, query])

  const running = items.filter((line) => line.state === 'running').length
  const stopped = items.filter((line) => line.state === 'stopped').length
  const idle = items.filter((line) => line.state === 'idle').length
  const anomalies = items.reduce((sum, line) => sum + line.alerts.total, 0)
  const avgHealth = items.length
    ? Math.round(items.reduce((sum, line) => sum + (line.health ?? 0), 0) / items.length)
    : 0

  return (
    <Page>
      <header className="mb-4 flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-display text-balance">{t('lines.title')}</h1>
          <p className="mt-2 mb-0 text-body text-ink-dim">
            {t('lines.subtitle', {
              site: lines.data?.siteName ?? '',
              lines: formatInteger(items.length),
              sensors: formatInteger(lines.data?.sensorCount ?? 0),
            })}
          </p>
        </div>
      </header>

      <ModuleTabs />

      {lines.isError ? (
        <ErrorState
          error={lines.error}
          title={t('lines.loadFailed')}
          onRetry={() => lines.refetch()}
        />
      ) : lines.isPending ? (
        <SkeletonRows count={6} />
      ) : (
        <>
          <div className="mb-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
            <MetricCard icon="factory" label={t('lines.kpi.lines')} value={formatInteger(items.length)} />
            <MetricCard
              icon="bolt"
              tone="green"
              label={t('lines.kpi.running')}
              value={formatInteger(running)}
              sub={t('lines.kpi.runningSub', { stopped, idle })}
            />
            <MetricCard
              icon="bell"
              tone={anomalies ? 'amber' : null}
              label={t('lines.kpi.anomalies')}
              value={formatInteger(anomalies)}
            />
            <MetricCard
              icon="gauge"
              tone={toneForHealth(avgHealth)}
              label={t('lines.kpi.health')}
              value={formatInteger(avgHealth)}
            />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div role="group" aria-label={t('lines.filterLabel')} className="flex flex-wrap gap-1.5">
              {['all', ...LINE_STATES].map((state) => (
                <Chip key={state} selected={filter === state} onClick={() => setFilter(state)}>
                  {t(`lines.filter.${state}`)}
                </Chip>
              ))}
            </div>

            <label className="flex min-w-[14rem] flex-1 items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-2 focus-within:border-forge sm:max-w-[20rem]">
              <Icon name="search" size="sm" className="shrink-0 text-ink-mute" />
              <span className="sr-only">{t('lines.search')}</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('lines.searchPlaceholder')}
                className="w-full border-0 bg-transparent text-body text-ink outline-none placeholder:text-ink-dim"
              />
            </label>

            <span className="ms-auto text-body-sm text-ink-dim">
              <Num>{t('lines.countOf', { shown: shown.length, total: items.length })}</Num>
            </span>
          </div>

          {shown.length === 0 ? (
            <EmptyState icon="factory" />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {shown.map((line) => (
                <li key={line.id}>
                  <LineCard
                    line={line}
                    open={openId === line.id}
                    onToggle={() => setExpanded(openId === line.id ? '' : line.id)}
                    onOpen={() => navigate(`/app/assets/lines/${line.id}`)}
                    t={t}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Page>
  )
}

function LineCard({ line, open, onToggle, onOpen, t }) {
  const tone = STATE_TONE[line.state] ?? null
  // Earned: a stopped line, or a running one carrying a critical. A healthy line
  // and an idle one both go unmarked.
  const stripe = line.state === 'stopped' ? 'red' : line.alerts.worst === 'critical' ? 'amber' : null

  return (
    <Panel flush stripe={stripe} className="overflow-hidden">
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 transition-colors',
          open && 'bg-sunken',
        )}
      >
        {/* The disclosure is the button; the row is not. A whole card that both
            expands AND contains a link is two targets fighting over one click. */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={t(open ? 'lines.row.collapse' : 'lines.row.expand', { line: line.name })}
          className="flex min-w-0 flex-1 items-center gap-3 text-start"
        >
          <Icon
            name="right"
            size="sm"
            className={cn(
              'shrink-0 text-ink-mute transition-transform mirror-rtl',
              open && 'rotate-90',
            )}
          />
          <span className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-hairline bg-card">
            <Icon
              name="factory"
              size="sm"
              className={cn(!tone && 'text-ink-mute')}
              style={tone ? { color: `var(--on-${tone})` } : undefined}
            />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-title">{line.name}</span>
              {line.rich ? <PlainBadge>{t('lines.live')}</PlainBadge> : null}
              <StateBadge tone={tone}>{t(`lines.state.${line.state}`)}</StateBadge>
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 text-micro font-normal text-ink-dim">
              <Mono>{line.code}</Mono>
              <span>·</span>
              <Num>{t('lines.row.assets', { count: line.assetCount })}</Num>
              <span>·</span>
              <span>{line.building}</span>
            </span>
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Figure label={t('lines.row.health')}>
            <Meter value={line.health} label={t('lines.row.health')} />
          </Figure>
          <Figure label={t('lines.row.oee')}>
            {line.oee == null ? (
              <span className="text-body-sm text-ink-mute">{t('lines.state.idle')}</span>
            ) : (
              <Num className="text-body-sm font-semibold">{formatPercent(line.oee, 0)}</Num>
            )}
          </Figure>
          <Figure label={t('lines.row.anomalies')}>
            {line.alerts.total ? (
              <StateBadge tone={line.alerts.worst === 'critical' ? 'red' : 'amber'} dot={false}>
                <Num>{formatInteger(line.alerts.total)}</Num>
              </StateBadge>
            ) : (
              <span className="text-body-sm text-ink-mute">—</span>
            )}
          </Figure>

          <ForgeButton size="sm" onClick={onOpen}>
            {t('lines.row.open')}
            <Icon name="right" size="xs" className="mirror-rtl" />
          </ForgeButton>
        </div>
      </div>

      {open ? (
        <div className="border-t border-hairline bg-sunken px-3 pt-3 pb-3.5">
          <Eyebrow className="mb-2 px-1">
            {t('lines.row.assetsHeading')} · <Num>{formatInteger(line.assets.length)}</Num>
          </Eyebrow>
          {line.assets.length === 0 ? (
            <p className="m-0 px-1 pb-1 text-body-sm text-ink-dim">{t('lines.row.noAssets')}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {line.assets.map((asset) => (
                <li key={asset.id}>
                  <AssetRow asset={asset} t={t} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </Panel>
  )
}

/** One labelled figure in the row's metric cluster. */
function Figure({ label, children }) {
  return (
    <div className="min-w-0">
      <Eyebrow as="div" className="mb-1">
        {label}
      </Eyebrow>
      {children}
    </div>
  )
}

function AssetRow({ asset, t }) {
  const critical = asset.alerts.worst === 'critical'

  return (
    <Link
      to={`/app/assets/${asset.id}`}
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm border border-hairline bg-card px-3 py-2.5',
        'transition-colors hover:border-forge/40',
        critical && 'stripe-red',
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-xs border border-hairline bg-sunken">
        <Icon name="machine" size="xs" className="text-ink-mute" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-body-sm font-semibold">{asset.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-micro font-normal text-ink-dim">
          <Mono>{asset.code}</Mono>
          <span>·</span>
          <span>{t(`lines.type.${asset.type}`, { defaultValue: asset.type })}</span>
        </span>
      </span>

      <Num className="shrink-0 text-micro font-normal whitespace-nowrap text-ink-dim">
        {t('lines.row.sensors', { count: asset.sensorCount ?? 0 })}
      </Num>

      <Meter value={asset.health} label={t('lines.row.health')} compact />

      <span className="w-[5.5rem] shrink-0 text-end">
        {asset.alerts.total ? (
          <StateBadge tone={critical ? 'red' : asset.alerts.worst === 'high' ? 'amber' : 'watch'} dot={false}>
            <Num>{formatInteger(asset.alerts.total)}</Num>
          </StateBadge>
        ) : (
          <span className="text-body-sm text-ink-mute">—</span>
        )}
      </span>

      <span className="inline-flex w-[5.5rem] shrink-0 items-center justify-end gap-1.5 text-micro font-normal text-ink-dim">
        {/* Offline is an absence, not a state with a hue of its own — `Dot` only
            speaks the semantic palette, and there is no token for "nothing is
            arriving". A muted neutral says it without borrowing a meaning. */}
        {asset.online ? (
          <Dot tone="green" size={6} />
        ) : (
          <span aria-hidden="true" className="inline-block size-1.5 shrink-0 rounded-full bg-ink-mute" />
        )}
        {t(asset.online ? 'lines.row.online' : 'lines.row.offline')}
      </span>

      <Icon name="right" size="xs" className="shrink-0 text-ink-mute mirror-rtl" />
    </Link>
  )
}
