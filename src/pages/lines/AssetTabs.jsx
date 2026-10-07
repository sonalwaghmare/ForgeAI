import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeDialog } from '@/components/forge/ForgeDialog'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Meter } from '@/components/forge/Meter'
import { Panel } from '@/components/forge/Panel'
import { TablePagination } from '@/components/forge/TablePagination'
import { TrendChart } from '@/components/forge/TrendChart'
import { EmptyState } from '@/components/forge/States'
import { AiBadge, PlainBadge, SeverityBadge, StateBadge } from '@/components/forge/StatusBadge'
import { Dot, Eyebrow, Mono, Num } from '@/components/forge/primitives'
import {
  formatCurrency,
  formatDateTime,
  formatInteger,
  formatPercent,
  formatRelative,
  formatSigned,
} from '@/lib/format'
import { cn } from '@/lib/cn'
import { toneForHealth } from '@/lib/tone'
import { DocumentUploadDialog } from './DocumentUploadDialog'

/**
 * The eight remaining sections of the Detailed view.
 *
 * DEMO. All of them read the same composed record the Overview does — see
 * `mocks/fixtures/lines.js`. Nothing here is a second copy of a number that
 * appears somewhere else on the page.
 *
 * They live in one file because they are one screen's tabs: they share the
 * asset, the formatters and the visual grammar, and eight files of forty lines
 * each would hide that they are siblings.
 */

/* ══ TIMESERIES ══════════════════════════════════════════════════════════ */

const TIMESERIES_WINDOWS = ['1h', '6h', '24h', '7d', '30d']

/**
 * Every instrument on the machine, one card each, with a dialog to enlarge one.
 *
 * The window chips change the label rather than the data, and say so: there is
 * one series per signal in the fixture, and pretending five resolutions exist
 * would be the kind of dead control this rebuild keeps removing. When the real
 * endpoint serves a window parameter, the chip already holds the value it needs.
 */
export function TimeseriesTab({ asset }) {
  const { t } = useTranslation(['app', 'common'])
  const [window, setWindow] = useState('24h')
  const [zoomed, setZoomed] = useState(null)
  const signals = asset.signals ?? []
  const signal = signals.find((entry) => entry.key === zoomed)

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Eyebrow className="flex-1">{t('lines.asset.tabPanes.timeseries.title')}</Eyebrow>
        <div
          role="group"
          aria-label={t('lines.asset.tabPanes.timeseries.window')}
          className="flex flex-wrap gap-1.5"
        >
          {TIMESERIES_WINDOWS.map((entry) => (
            <Chip
              key={entry}
              selected={entry === window}
              onClick={() => setWindow(entry)}
              className="px-2 py-[3px] text-micro max-lg:px-2.5 max-lg:py-1.5 max-lg:text-body-sm"
            >
              {entry}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(21rem,100%),1fr))]">
        {signals.map((entry) => (
          <SignalCard
            key={entry.key}
            signal={entry}
            asset={asset}
            window={window}
            onZoom={() => setZoomed(entry.key)}
            t={t}
          />
        ))}
      </div>

      {signal ? (
        <ForgeDialog
          open
          onOpenChange={() => setZoomed(null)}
          size="xl"
          title={`${signal.name} · ${asset.name}`}
          description={t('lines.asset.tabPanes.timeseries.band', {
            lo: signal.band[0],
            hi: signal.band[1],
            unit: signal.unit,
          })}
          footer={
            <ForgeButton className="ms-auto" onClick={() => setZoomed(null)}>
              {t('common:actions.close')}
            </ForgeButton>
          }
        >
          <TrendChart
            legend={false}
            series={[{ key: signal.key, label: signal.name, tone: signalTone(signal, asset), values: signal.values }]}
            band={signal.band}
            label={signal.name}
            bandLabel={t('lines.asset.tabPanes.timeseries.band', {
              lo: signal.band[0],
              hi: signal.band[1],
              unit: signal.unit,
            })}
            xLabel={t('oee.trend.xLabel')}
            xTicks={[`-${window}`, '', '', '', 'now']}
            format={(value) => `${value} ${signal.unit}`}
          />
        </ForgeDialog>
      ) : null}
    </>
  )
}

/** Red when an alert is open on this instrument, neutral otherwise. */
const signalTone = (signal, asset) =>
  asset.openAlerts.some((alert) => alert.id === signal.alertId) ? 'red' : 'muted'

function SignalCard({ signal, asset, window, onZoom, t }) {
  const alert = asset.openAlerts.find((entry) => entry.id === signal.alertId)
  const latest = signal.values[signal.values.length - 1]
  const exceeding = latest < signal.band[0] || latest > signal.band[1]

  return (
    <Panel>
      <div className="mb-2.5 flex items-center gap-2">
        <Icon name="wave" size="sm" className="shrink-0 text-ink-mute" />
        <span className="min-w-0 flex-1 truncate text-body-sm font-semibold">{signal.name}</span>
        {alert ? (
          <SeverityBadge severity={alert.severity} dot />
        ) : (
          <StateBadge tone={exceeding ? 'amber' : 'green'} dot={false}>
            {t(
              exceeding
                ? 'lines.asset.tabPanes.timeseries.exceeding'
                : 'lines.asset.tabPanes.timeseries.normal',
            )}
          </StateBadge>
        )}
        <ForgeButton size="sm" onClick={onZoom} aria-label={t('lines.asset.tabPanes.timeseries.expand', { name: signal.name })}>
          <Icon name="up" size="xs" />
        </ForgeButton>
      </div>

      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <Eyebrow as="span">{t('lines.asset.tabPanes.timeseries.latest')}</Eyebrow>
        <span>
          <Num
            className="text-title"
            style={alert || exceeding ? { color: `var(--on-${alert ? 'red' : 'amber'})` } : undefined}
          >
            {latest}
          </Num>
          <span className="ms-1 text-micro font-normal text-ink-dim">{signal.unit}</span>
        </span>
      </div>

      <TrendChart
        legend={false}
        series={[{ key: signal.key, label: signal.name, tone: signalTone(signal, asset), values: signal.values }]}
        band={signal.band}
        label={signal.name}
        bandLabel={t('lines.asset.tabPanes.timeseries.band', {
          lo: signal.band[0],
          hi: signal.band[1],
          unit: signal.unit,
        })}
        xLabel={t('oee.trend.xLabel')}
        xTicks={[`-${window}`, '', 'now']}
        format={(value) => `${value} ${signal.unit}`}
      />
    </Panel>
  )
}

/* ══ ALERT HISTORY ═══════════════════════════════════════════════════════ */

const HISTORY_PAGE = 10

export function AlertHistoryTab({ asset }) {
  const { t } = useTranslation(['app', 'common'])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(HISTORY_PAGE)

  const history = asset.alertHistory
  if (!history) return null

  const rows = history.events.slice((page - 1) * pageSize, page * pageSize)
  const stats = history.stats

  const tiles = [
    ['total', formatInteger(stats.total)],
    ['tta', t('lines.asset.tabPanes.alerts.ttaValue', { minutes: stats.avgAcknowledgeMinutes })],
    ['ttr', t('lines.asset.tabPanes.alerts.ttrValue', { hours: stats.avgResolveHours })],
    ['dismissed', formatPercent(stats.dismissedPct, 0)],
  ]

  return (
    <div className="grid gap-4 [grid-template-columns:minmax(0,1fr)] xl:[grid-template-columns:minmax(0,1fr)_minmax(17rem,20rem)]">
      <div className="flex min-w-0 flex-col gap-4">
        <dl className="m-0 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(10rem,1fr))]">
          {tiles.map(([key, value]) => (
            <Panel key={key} as="div">
              <dt className="eyebrow">{t(`lines.asset.tabPanes.alerts.tiles.${key}`)}</dt>
              <dd className="m-0 mt-1.5">
                <Num className="text-headline leading-none">{value}</Num>
              </dd>
            </Panel>
          ))}
        </dl>

        <Panel flush>
          <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4.5 py-3.5">
            <h2 className="m-0 flex-1 text-title">{t('lines.asset.tabPanes.alerts.all')}</h2>
            <span className="text-micro font-normal text-ink-dim">
              <Num>
                {t('lines.asset.tabPanes.alerts.count', { shown: rows.length, total: stats.total })}
              </Num>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-body-sm">
              <thead>
                <tr className="bg-sunken">
                  {['when', 'alert', 'severity', 'source', 'outcome'].map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="eyebrow border-b border-hairline px-4 py-2.5 text-start whitespace-nowrap"
                    >
                      {t(`lines.asset.tabPanes.alerts.columns.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((event) => (
                  <tr key={event.id} className="border-b border-subtle last:border-b-0 even:bg-row-alt">
                    <td className="px-4 py-2.5 whitespace-nowrap text-ink-dim">
                      <Num>
                        {event.dayIndex === 0
                          ? t('lines.asset.tabPanes.alerts.today')
                          : t('lines.asset.tabPanes.alerts.daysAgo', { days: event.dayIndex })}
                      </Num>
                    </td>
                    <th scope="row" className="px-4 py-2.5 text-start">
                      {/* A live alert links out; a historical one does not, because
                          there is no record behind it to open. */}
                      {event.live ? (
                        <Link to="/app/anomalies" className="hover:text-on-forge">
                          <Mono className="font-semibold">{event.id}</Mono>
                        </Link>
                      ) : (
                        <Mono className="text-ink-dim">{event.id}</Mono>
                      )}
                      <span className="mt-0.5 block text-micro font-normal text-ink-dim">
                        {event.title}
                      </span>
                    </th>
                    <td className="px-4 py-2.5">
                      <SeverityBadge severity={event.severity} dot />
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-ink-dim">
                      {t(`lines.asset.tabPanes.alerts.source.${event.source}`)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StateBadge
                        tone={event.outcome === 'open' ? 'forge' : event.outcome === 'resolved' ? 'green' : null}
                        dot={false}
                      >
                        {t(`lines.asset.tabPanes.alerts.outcome.${event.outcome}`)}
                      </StateBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <TablePagination
            total={stats.total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            label={t('lines.asset.tabPanes.alerts.pagerLabel')}
          />
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <SplitCard title={t('lines.asset.tabPanes.alerts.modes')} rows={history.failureModes} />
        <SplitCard
          title={t('lines.asset.tabPanes.alerts.bySource')}
          rows={history.bySource.map((row) => ({
            ...row,
            label: t(`lines.asset.tabPanes.alerts.source.${row.label}`, { defaultValue: row.label }),
          }))}
        />
      </div>
    </div>
  )
}

/** A labelled proportion list. The bars are relative to the largest row. */
function SplitCard({ title, rows }) {
  const largest = Math.max(1, ...rows.map((row) => row.count))
  return (
    <Panel>
      <Eyebrow className="mb-3.5 block">{title}</Eyebrow>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((row) => (
          <li key={row.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-body-sm">
              <span className="min-w-0 truncate text-ink-dim">{row.label}</span>
              <Num className="shrink-0 font-semibold">
                {formatInteger(row.count)}{' '}
                <span className="font-normal text-ink-dim">{formatPercent(row.pct, 0)}</span>
              </Num>
            </div>
            <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-pill bg-sunken">
              <span
                className="block h-full rounded-pill bg-forge"
                style={{ width: `${(row.count / largest) * 100}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

/* ══ WORK ORDERS ═════════════════════════════════════════════════════════ */

const WO_BUCKETS = ['open', 'scheduled', 'closed']

/** "Today", "Tomorrow", "In 5 days" — a date nobody has to subtract. */
function dueLabel(days, t) {
  if (days == null) return null
  if (days < 0) return t('lines.asset.tabPanes.workOrders.due.overdue')
  if (days === 0) return t('lines.asset.tabPanes.workOrders.due.today')
  if (days === 1) return t('lines.asset.tabPanes.workOrders.due.tomorrow')
  return t('lines.asset.tabPanes.workOrders.due.inDays', { count: days })
}

export function WorkOrdersTab({ asset }) {
  const { t } = useTranslation(['app', 'common'])
  const [bucket, setBucket] = useState('open')
  const orders = asset.workOrders
  if (!orders) return null

  const rows = orders[bucket] ?? []
  const closed = bucket === 'closed'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {WO_BUCKETS.map((entry) => (
          <Chip key={entry} selected={bucket === entry} onClick={() => setBucket(entry)}>
            {t(`lines.asset.tabPanes.workOrders.${entry}`)}
            <Num className="text-ink-mute">{formatInteger((orders[entry] ?? []).length)}</Num>
          </Chip>
        ))}
        <ForgeButton variant="primary" className="ms-auto">
          <Icon name="plus" size="xs" />
          {t('lines.asset.tabPanes.workOrders.create')}
        </ForgeButton>
      </div>

      <Panel flush>
        {rows.length === 0 ? (
          <EmptyState
            icon="wrench"
            title={t('lines.asset.tabPanes.workOrders.none')}
            className="border-0 bg-transparent shadow-none"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-body-sm">
              <thead>
                <tr className="bg-sunken">
                  {['id', 'title', 'assignee', closed ? 'when' : 'due'].map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="eyebrow border-b border-hairline px-4 py-2.5 text-start whitespace-nowrap"
                    >
                      {t(`lines.asset.tabPanes.workOrders.columns.${column}`)}
                    </th>
                  ))}
                  <th scope="col" className="border-b border-hairline px-4 py-2.5">
                    <span className="sr-only">{t('common:actions.viewDetails')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => (
                  <tr key={order.id} className="border-b border-subtle last:border-b-0">
                    <th scope="row" className="px-4 py-3 text-start">
                      <Mono className="font-semibold text-on-forge">{order.id}</Mono>
                    </th>
                    <td className="w-full px-4 py-3 font-semibold">
                      {t(`workOrders.titles.${order.title}`, { defaultValue: order.title })}
                      {order.authoredBy === 'ai' ? (
                        <AiBadge
                          label={t('lines.asset.tabPanes.workOrders.aiDrafted')}
                          className="ms-2 align-middle"
                        />
                      ) : null}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-dim">
                      {order.assignee ?? t('lines.asset.tabPanes.workOrders.unassigned')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-mute">
                      {/* Due dates are muted and closed dates are relative: one is
                          a commitment you scan for, the other is history you only
                          read if the row already caught your eye. */}
                      <Num>
                        {closed ? formatRelative(order.at) : dueLabel(order.dueInDays, t)}
                      </Num>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Icon name="right" size="xs" className="text-ink-mute mirror-rtl" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(18rem,100%),1fr))]">
        <Panel>
          <h2 className="m-0 mb-3.5 text-title">{t('lines.asset.tabPanes.workOrders.parts')}</h2>
          {/* Label and count, nothing else. The reorder table belongs on
              Components / BOM, where stock levels are the subject; here the
              question is only what this machine consumed. */}
          <ul className="m-0 flex list-none flex-col p-0">
            {orders.parts.map((part) => (
              <li
                key={part.sku}
                className="flex items-baseline gap-3 border-b border-subtle py-2.5 last:border-b-0"
              >
                <span className="min-w-0 flex-1 text-body-sm text-ink-dim">{part.label}</span>
                <Num className="shrink-0 text-body-sm font-semibold">×&nbsp;{formatInteger(part.used)}</Num>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <h2 className="m-0 mb-3 text-title">{t('lines.asset.tabPanes.workOrders.cost')}</h2>
          <Num className="block text-metric leading-none">
            {formatCurrency(orders.cost.total, orders.cost.currency)}
          </Num>
          {/* Green for a fall. Spend going down is the good direction, which is
              the one place in this product where a negative delta is not red. */}
          <Num
            className="mt-2 block text-body-sm"
            style={{ color: `var(--on-${orders.cost.deltaPct <= 0 ? 'green' : 'red'})` }}
          >
            {t('lines.asset.tabPanes.workOrders.costDelta', {
              pct: formatSigned(orders.cost.deltaPct),
            })}
          </Num>
          <p className="mt-2.5 mb-0 text-body-sm text-ink-dim">
            <Num>
              {t('lines.asset.tabPanes.workOrders.costSplit', {
                parts: formatCurrency(orders.cost.parts, orders.cost.currency),
                labour: formatCurrency(orders.cost.labour, orders.cost.currency),
              })}
            </Num>
          </p>
        </Panel>
      </div>
    </div>
  )
}

/* ══ TELEMETRY ═══════════════════════════════════════════════════════════ */

/**
 * One channel at a time, with its distribution.
 *
 * Timeseries shows every instrument small; this shows one large with min, mean,
 * max and now underneath. They are the same signals read for different
 * questions — "is anything wrong" versus "what exactly is this one doing".
 */
export function TelemetryTab({ asset }) {
  const { t } = useTranslation(['app', 'common'])
  const signals = asset.signals ?? []
  const [key, setKey] = useState(signals[0]?.key ?? null)
  const signal = signals.find((entry) => entry.key === key) ?? signals[0]

  const stats = useMemo(() => {
    if (!signal) return null
    const values = signal.values
    const round = (n) => Math.round(n * 100) / 100
    return {
      min: round(Math.min(...values)),
      avg: round(values.reduce((sum, value) => sum + value, 0) / values.length),
      max: round(Math.max(...values)),
      now: values[values.length - 1],
    }
  }, [signal])

  if (!signal) return <EmptyState icon="wave" />

  const alert = asset.openAlerts.find((entry) => entry.id === signal.alertId)

  return (
    <div className="grid gap-4 [grid-template-columns:minmax(0,1fr)] xl:[grid-template-columns:minmax(0,1fr)_minmax(15rem,18rem)]">
      <Panel className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="m-0 flex-1 text-title">{signal.name}</h2>
          <StateBadge tone="green">{t('lines.asset.tabPanes.telemetry.live')}</StateBadge>
          {alert ? <SeverityBadge severity={alert.severity} dot /> : null}
        </div>

        {/* No axes: min, average, max and now are spelled out in the four tiles
            underneath, so tick labels would be the same numbers a second time. */}
        <TrendChart
          axis={false}
          legend={false}
          series={[{ key: signal.key, label: signal.name, tone: signalTone(signal, asset), values: signal.values }]}
          band={signal.band}
          label={signal.name}
          bandLabel={t('lines.asset.tabPanes.telemetry.band', {
            lo: signal.band[0],
            hi: signal.band[1],
            unit: signal.unit,
          })}
          xLabel={t('oee.trend.xLabel')}
          format={(value) => `${value} ${signal.unit}`}
        />

        <dl className="m-0 mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(7rem,1fr))]">
          {['min', 'avg', 'max', 'now'].map((entry) => (
            <div key={entry} className="rounded-sm bg-sunken px-3.5 py-3">
              <dt className="eyebrow">{t(`lines.asset.tabPanes.telemetry.stats.${entry}`)}</dt>
              <dd className="m-0 mt-1.5">
                <Num
                  className="text-title leading-none"
                  style={
                    (entry === 'max' || entry === 'now') && alert
                      ? { color: 'var(--on-red)' }
                      : undefined
                  }
                >
                  {stats[entry]}
                </Num>
                <span className="ms-1 text-micro font-normal text-ink-dim">{signal.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel flush className="self-start">
        <div className="border-b border-hairline px-4.5 py-3">
          <Eyebrow>{t('lines.asset.tabPanes.telemetry.channels', { count: signals.length })}</Eyebrow>
        </div>
        <ul className="m-0 flex list-none flex-col p-0">
          {signals.map((entry) => {
            const selected = entry.key === signal.key
            const entryAlert = asset.openAlerts.find((open) => open.id === entry.alertId)
            return (
              <li key={entry.key}>
                <button
                  type="button"
                  onClick={() => setKey(entry.key)}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2.5 border-b border-subtle px-4 py-2.5 text-start transition-colors last:border-b-0',
                    selected ? 'bg-sunken' : 'hover:bg-sunken',
                  )}
                >
                  <Dot tone={entryAlert ? 'red' : 'green'} size={6} />
                  <span className={cn('min-w-0 flex-1 truncate text-body-sm', selected && 'font-semibold')}>
                    {entry.name}
                  </span>
                  <Num className="shrink-0 text-micro text-ink-dim">
                    {entry.values[entry.values.length - 1]} {entry.unit}
                  </Num>
                </button>
              </li>
            )
          })}
        </ul>
      </Panel>
    </div>
  )
}

/* ══ DOCUMENTS ═══════════════════════════════════════════════════════════ */

const DOC_ICON = { sop: 'doc', manual: 'doc', drawing: 'layers', certificate: 'shield', safety: 'lock' }

/**
 * The asset's document register.
 *
 * A table, not a card grid. A register is read by comparing rows — is this the
 * current revision, who owns it, when did it last change — and cards make every
 * one of those a saccade instead of a column.
 *
 * ── `Applies via` is the load-bearing column ──────────────────────────────
 * A service manual belongs to the model, a safety data sheet to the site, and
 * only two of these were attached to this machine. Without that column the list
 * reads as six documents somebody uploaded here, which is not what it is. The
 * prototype has the column and puts "Enterprise" in every row; ours says which
 * level each one actually came from.
 */
export function DocumentsTab({ asset }) {
  const { t } = useTranslation(['app', 'common'])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [kind, setKind] = useState('all')
  const [source, setSource] = useState('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const documents = asset.documents
  if (!documents) return null

  const needle = query.trim().toLowerCase()
  const filtered = documents.items.filter((document) => {
    if (kind !== 'all' && document.kind !== kind) return false
    if (source !== 'all' && document.via !== source) return false
    if (!needle) return true
    return [document.name, document.id, document.owner].join(' ').toLowerCase().includes(needle)
  })

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const size = (kb) =>
    kb >= 1024
      ? t('lines.asset.tabPanes.documents.sizeMb', { mb: Math.round((kb / 1024) * 10) / 10 })
      : t('lines.asset.tabPanes.documents.size', { kb: formatInteger(kb) })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <Eyebrow>{t('lines.asset.tabPanes.documents.eyebrow')}</Eyebrow>
          <h2 className="mt-1 mb-0 text-title">
            <Num>
              {t('lines.asset.tabPanes.documents.title', {
                documents: documents.items.length,
                media: documents.mediaCount,
              })}
            </Num>
          </h2>
          <p className="mt-1.5 mb-0 max-w-[72ch] text-body-sm text-ink-dim">
            {t('lines.asset.tabPanes.documents.subtitle')}
          </p>
        </div>
        <ForgeButton onClick={() => setUploadOpen(true)}>
          <Icon name="up" size="xs" />
          {t('lines.asset.tabPanes.documents.upload')}
        </ForgeButton>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label={t('lines.asset.tabPanes.documents.filterKind')}
          className="flex flex-wrap gap-1.5"
        >
          <Chip
            selected={kind === 'all'}
            onClick={() => {
              setKind('all')
              setPage(1)
            }}
          >
            {t('lines.asset.tabPanes.documents.allWithCount')}
            <Num className="text-ink-mute">{formatInteger(documents.items.length)}</Num>
          </Chip>
          {documents.kinds.map((entry) => (
            <Chip
              key={entry.kind}
              selected={kind === entry.kind}
              onClick={() => {
                setKind(entry.kind)
                setPage(1)
              }}
            >
              <Icon name={DOC_ICON[entry.kind] ?? 'doc'} size="xs" />
              {t(`lines.asset.tabPanes.documents.kind.${entry.kind}`)}
              <Num className="text-ink-mute">{formatInteger(entry.count)}</Num>
            </Chip>
          ))}
        </div>

        <div className="ms-auto flex flex-wrap items-center gap-2">
          <ForgeSelect
            label={t('lines.asset.tabPanes.documents.source')}
            labelInline
            size="sm"
            value={source}
            onValueChange={(value) => {
              setSource(value)
              setPage(1)
            }}
            options={[
              { value: 'all', label: t('lines.asset.tabPanes.documents.anySource') },
              ...documents.sources.map((entry) => ({
                value: entry,
                label: t(`lines.asset.tabPanes.documents.via.${entry}`),
              })),
            ]}
          />
          <label className="flex min-w-[13rem] items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-2 focus-within:border-forge">
            <Icon name="search" size="sm" className="shrink-0 text-ink-mute" />
            <span className="sr-only">{t('lines.asset.tabPanes.documents.search')}</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder={t('lines.asset.tabPanes.documents.searchPlaceholder')}
              className="w-full border-0 bg-transparent text-body text-ink outline-none placeholder:text-ink-dim"
            />
          </label>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="doc" title={t('lines.asset.tabPanes.documents.none')} />
      ) : (
        <Panel flush>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-body-sm">
              <thead>
                <tr className="bg-sunken">
                  {['document', 'type', 'via', 'rev', 'updated', 'owner'].map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className={cn(
                        'eyebrow border-b border-hairline px-4 py-2.5 text-start whitespace-nowrap',
                        column === 'document' && 'w-full',
                      )}
                    >
                      {t(`lines.asset.tabPanes.documents.columns.${column}`)}
                    </th>
                  ))}
                  <th scope="col" className="border-b border-hairline px-4 py-2.5">
                    <span className="sr-only">{t('lines.asset.tabPanes.documents.open')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((document) => (
                  <tr key={document.id} className="border-b border-subtle last:border-b-0">
                    <th scope="row" className="w-full px-4 py-3 text-start">
                      <span className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 flex-col items-center justify-center rounded-xs border border-hairline bg-sunken">
                          <Icon name={DOC_ICON[document.kind] ?? 'doc'} size="xs" className="text-ink-mute" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold">{document.name}</span>
                          <Num className="mt-0.5 block text-micro font-normal text-ink-dim">
                            {t('lines.asset.tabPanes.documents.meta', {
                              id: document.id,
                              size: size(document.sizeKb),
                              pages: t('lines.asset.tabPanes.documents.pagesShort', {
                                count: document.pages,
                              }),
                            })}
                          </Num>
                        </span>
                      </span>
                    </th>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-dim">
                      {t(`lines.asset.tabPanes.documents.kind.${document.kind}`)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {/* `whitespace-nowrap`: the badge base allows wrapping so a
                          translated severity never clips, but a one-word level in
                          a narrow column wrapped "This asset" onto two lines. */}
                      <PlainBadge className="whitespace-nowrap">
                        {t(`lines.asset.tabPanes.documents.via.${document.via}`)}
                      </PlainBadge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-dim">
                      <Mono>{document.rev}</Mono>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-dim">
                      <Num>{formatRelative(document.updated)}</Num>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-dim">{document.owner}</td>
                    <td className="px-4 py-3 text-end">
                      <ForgeButton size="sm" variant="ghost">
                        {t('lines.asset.tabPanes.documents.open')}
                      </ForgeButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <TablePagination
            total={filtered.length}
            page={safePage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(next) => {
              setPageSize(next)
              setPage(1)
            }}
            label={t('lines.asset.tabPanes.documents.pagerLabel')}
          />
        </Panel>
      )}

      <DocumentUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} asset={asset} />
    </div>
  )
}

/* ══ MAINTENANCE ═════════════════════════════════════════════════════════ */

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export function MaintenanceTab({ asset }) {
  const { t } = useTranslation(['app', 'common'])
  const maintenance = asset.maintenance
  if (!maintenance) return null

  const done = maintenance.checklist.filter((item) => item.done).length
  const nextAt = new Date(maintenance.nextAt)

  return (
    <div className="grid gap-4 [grid-template-columns:minmax(0,1fr)] xl:[grid-template-columns:minmax(0,1fr)_minmax(20rem,26rem)]">
      <div className="flex min-w-0 flex-col gap-4">
        <Panel stripe={maintenance.overdue ? 'red' : 'amber'}>
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <Eyebrow>{t('lines.asset.tabPanes.maintenance.nextEyebrow')}</Eyebrow>
              {/* The date and the time, spelled out. "In 14 days" is the gloss;
                  the appointment is the fact, and somebody has to put it in a
                  diary. */}
              <h2 className="mt-1 mb-0 text-title">
                <Num>
                  {formatDateTime(maintenance.nextAt, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Num>
              </h2>
            </div>
            <StateBadge tone={maintenance.overdue ? 'red' : 'amber'} dot={false}>
              {maintenance.overdue
                ? t('lines.asset.tabPanes.maintenance.overdue')
                : t('lines.asset.tabPanes.maintenance.inHours', {
                    hours: formatInteger(maintenance.inHours),
                  })}
            </StateBadge>
          </div>

          <dl className="m-0 mt-4 flex flex-wrap gap-x-10 gap-y-3">
            {[
              ['window', t('lines.asset.tabPanes.maintenance.windowValue', { hours: maintenance.windowHours })],
              [
                'assigned',
                `${maintenance.assignee} · ${t(`lines.asset.tabPanes.maintenance.assignedRole.${maintenance.assigneeRole}`)}`,
              ],
              ['kind', t(`lines.asset.tabPanes.maintenance.kindValue.${maintenance.kind}`)],
            ].map(([key, value]) => (
              <div key={key}>
                <dt className="eyebrow">{t(`lines.asset.tabPanes.maintenance.${key}`)}</dt>
                <dd className="m-0 mt-1 text-body-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <ForgeButton>{t('lines.asset.tabPanes.maintenance.reschedule')}</ForgeButton>
            <ForgeButton>{t('lines.asset.tabPanes.maintenance.reassign')}</ForgeButton>
            <ForgeButton variant="primary">
              {t('lines.asset.tabPanes.maintenance.viewChecklist')}
            </ForgeButton>
          </div>
        </Panel>

        <PmCalendar month={nextAt} events={maintenance.events} t={t} />
      </div>

      <Panel flush className="self-start">
        <div className="border-b border-hairline px-4.5 py-3">
          <Eyebrow>{t('lines.asset.tabPanes.maintenance.checklist')}</Eyebrow>
          <Num className="mt-1 block text-micro font-normal text-ink-dim">
            {t('lines.asset.tabPanes.maintenance.progress', {
              done,
              total: maintenance.checklist.length,
            })}
          </Num>
        </div>
        <ul className="m-0 list-none px-4.5 py-1">
          {maintenance.checklist.map((item) => (
            <li
              key={item.label}
              className="flex items-center gap-2.5 border-b border-subtle py-2.5 last:border-b-0"
            >
              {/* Not a checkbox: nothing here can be ticked yet, and a control
                  that does not respond is worse than a mark that never claimed
                  to. The glyph states completion; it does not offer it. */}
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-xs border text-white',
                  item.done ? 'border-transparent' : 'border-hairline',
                )}
                style={item.done ? { background: 'var(--hue-green)' } : undefined}
              >
                {item.done ? <Icon name="check" size="xs" /> : null}
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 text-body-sm',
                  item.done ? 'text-ink-mute line-through' : 'text-ink',
                )}
              >
                {item.label}
              </span>
              <Num className="shrink-0 text-micro font-normal text-ink-dim">
                {t('lines.asset.tabPanes.maintenance.minutes', { count: item.minutes })}
              </Num>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

/**
 * The month the next PM falls in.
 *
 * A real grid, built from the month's own first weekday — the prototype hardcodes
 * 31 cells starting on a Monday, so its calendar is right for one month in seven
 * and silently wrong the rest of the time.
 *
 * Weeks start Monday, which is what a plant's shift calendar does. The leading
 * blanks are rendered as empty cells rather than omitted, or the first row
 * collapses and every date lands under the wrong weekday.
 */
function PmCalendar({ month, events, t }) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const first = new Date(year, monthIndex, 1)
  // getDay() is Sunday-first; shift it so Monday is 0.
  const leading = (first.getDay() + 6) % 7
  const days = new Date(year, monthIndex + 1, 0).getDate()

  const byDay = events.reduce((acc, event) => {
    acc[event.day] = [...(acc[event.day] ?? []), event]
    return acc
  }, {})

  return (
    <Panel>
      <div className="mb-3.5 flex flex-wrap items-center gap-3">
        <Eyebrow className="flex-1">
          {t('lines.asset.tabPanes.maintenance.calendarTitle', {
            month: formatDateTime(month.toISOString(), { month: 'long', year: 'numeric' }),
          })}
        </Eyebrow>
        <Num className="text-micro font-normal text-ink-dim">
          {t('lines.asset.tabPanes.maintenance.calendarCount', { count: events.length })}
        </Num>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <Eyebrow key={day} as="div" className="pb-1 text-center">
            {t(`lines.asset.tabPanes.maintenance.weekday.${day}`)}
          </Eyebrow>
        ))}

        {Array.from({ length: leading }, (_, index) => (
          <span key={`lead-${index}`} aria-hidden="true" />
        ))}

        {Array.from({ length: days }, (_, index) => {
          const day = index + 1
          const dayEvents = byDay[day] ?? []
          return (
            <div
              key={day}
              className={cn(
                'flex min-h-[3.25rem] flex-col gap-1 rounded-xs border p-1',
                dayEvents.length ? 'border-hairline bg-sunken' : 'border-subtle',
              )}
            >
              <Num className="text-micro font-normal text-ink-mute">{day}</Num>
              {dayEvents.map((event) => (
                <span
                  key={event.key}
                  title={event.label}
                  className="truncate rounded-[3px] px-1 py-px text-[0.5625rem] font-bold text-white"
                  style={{ background: `var(--hue-${event.tone})` }}
                >
                  {event.label}
                </span>
              ))}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

/* ══ BILL OF MATERIALS ═══════════════════════════════════════════════════ */

export function BomTab({ asset }) {
  const { t } = useTranslation(['app', 'common'])
  const bom = asset.bom ?? []
  const parts = asset.workOrders?.parts ?? []

  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(20rem,100%),1fr))]">
      <Panel className="min-w-0">
        <div className="mb-3.5 flex flex-wrap items-center gap-3">
          <Eyebrow className="flex-1">{t('lines.asset.tabPanes.bom.title')}</Eyebrow>
          <Num className="text-micro font-normal text-ink-dim">
            {t('lines.asset.tabPanes.bom.count', { count: bom.length })}
          </Num>
        </div>
        <ul className="m-0 flex list-none flex-col p-0">
          {bom.map((row, index) => (
            <li
              key={`${row.name}-${index}`}
              className="flex items-center gap-3 border-b border-subtle py-2.5 last:border-b-0"
              // Indentation is logical, so the tree reads inward from the
              // reading edge in both directions.
              style={{ paddingInlineStart: row.depth * 20 }}
            >
              <Icon name={row.depth === 0 ? 'machine' : 'gear'} size="xs" className="shrink-0 text-ink-mute" />
              <span className={cn('min-w-0 flex-1 truncate text-body-sm', row.depth === 0 && 'font-semibold')}>
                {row.name}
              </span>
              <Meter value={row.health} label={t('lines.row.health')} compact />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel flush className="min-w-0 self-start">
        <div className="border-b border-hairline px-4.5 py-3">
          <Eyebrow>{t('lines.asset.tabPanes.bom.spares')}</Eyebrow>
        </div>
        <ul className="m-0 list-none px-4.5 py-1">
          {parts.map((part) => {
            const out = part.onHand === 0
            const low = !out && part.onHand < part.reorderAt
            return (
              <li
                key={part.sku}
                className="flex items-center gap-3 border-b border-subtle py-3 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-body-sm">{part.label}</span>
                  <Mono className="mt-0.5 block text-micro text-ink-dim">{part.sku}</Mono>
                </span>
                <Num className="shrink-0 text-body-sm">
                  {formatInteger(part.onHand)}
                  <span className="text-ink-dim"> / {formatInteger(part.reorderAt)}</span>
                </Num>
                <StateBadge tone={out ? 'red' : low ? 'amber' : 'green'} dot={false}>
                  {t(
                    out
                      ? 'lines.asset.tabPanes.workOrders.stockOut'
                      : low
                        ? 'lines.asset.tabPanes.workOrders.stockLow'
                        : 'lines.asset.tabPanes.workOrders.stockOk',
                  )}
                </StateBadge>
              </li>
            )
          })}
        </ul>
      </Panel>
    </div>
  )
}

/* ══ AI INSIGHTS ═════════════════════════════════════════════════════════ */

export function InsightsTab({ asset, onOpenTab }) {
  const { t } = useTranslation(['app', 'common'])
  const insights = asset.insights
  if (!insights) return null

  return (
    <div className="flex flex-col gap-4">
      <Panel stripe="violet">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Icon name="ai" size="sm" className="text-violet" />
          <h2 className="m-0 flex-1 text-title">{t('lines.asset.tabPanes.insights.predicted')}</h2>
          {insights.predicted ? (
            <AiBadge
              label={t('lines.asset.overview.confidence', {
                pct: formatPercent(insights.predicted.confidence, 0),
              })}
            />
          ) : null}
        </div>

        <p className="m-0 text-body leading-[1.6] text-ink-dim">
          {insights.predicted?.etaHours
            ? t('lines.asset.tabPanes.insights.predictedBody', {
                sensor: insights.predicted.sensor,
                component: insights.predicted.component.toLowerCase(),
                hours: insights.predicted.etaHours,
              })
            : t('lines.asset.tabPanes.insights.predictedNone')}
        </p>

        {insights.predicted?.etaHours ? (
          <>
            {/* A risk ramp, not a gradient flourish: it runs green to red across
                thirty days and the marker sits where the projection lands. */}
            <div className="mt-4">
              <span
                aria-hidden="true"
                className="relative block h-3 overflow-hidden rounded-pill"
                style={{
                  background:
                    'linear-gradient(90deg, var(--hue-green), var(--hue-amber) 55%, var(--hue-red))',
                }}
              >
                <span
                  className="absolute inset-y-0 w-0.5 bg-ink"
                  style={{
                    insetInlineStart: `${Math.min(98, (insights.predicted.etaHours / (30 * 24)) * 100)}%`,
                  }}
                />
              </span>
              <div className="mt-1.5 flex justify-between text-micro font-normal text-ink-dim">
                <span>{t('lines.asset.tabPanes.insights.today')}</span>
                <span>{t('lines.asset.tabPanes.insights.plus30')}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <ForgeButton variant="primary">
                <Icon name="wrench" size="xs" />
                {t('lines.asset.tabPanes.insights.createWorkOrder')}
              </ForgeButton>
              <ForgeButton onClick={() => onOpenTab('telemetry')}>
                {t('lines.asset.tabPanes.insights.viewTelemetry')}
                <Icon name="right" size="xs" className="mirror-rtl" />
              </ForgeButton>
            </div>
          </>
        ) : null}
      </Panel>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(18rem,100%),1fr))]">
        <Panel>
          <Eyebrow className="mb-3.5 block">{t('lines.asset.tabPanes.insights.clusters')}</Eyebrow>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {insights.clusters.map((cluster) => (
              <li key={cluster.label}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-body-sm">
                  <span className="min-w-0 truncate text-ink-dim">{cluster.label}</span>
                  <Num
                    className="shrink-0 font-semibold"
                    style={{ color: `var(--on-${toneForHealth(100 - cluster.score)})` }}
                  >
                    {formatPercent(cluster.score, 0)}
                  </Num>
                </div>
                <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-pill bg-sunken">
                  <span
                    className="block h-full rounded-pill"
                    style={{
                      width: `${cluster.score}%`,
                      background: `var(--hue-${toneForHealth(100 - cluster.score)})`,
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <Eyebrow className="mb-3 block">{t('lines.asset.tabPanes.insights.model')}</Eyebrow>
          <Mono className="block text-body font-semibold">{insights.model.name}</Mono>
          <p className="mt-2.5 mb-0 text-body-sm leading-[1.6] text-ink-dim">
            <Num>
              {t('lines.asset.tabPanes.insights.modelBody', {
                when: formatRelative(insights.model.retrainedAt),
                samples: formatInteger(insights.model.samples),
                f1: insights.model.f1,
              })}
            </Num>
          </p>
          <p className="mt-1.5 mb-0 text-body-sm text-ink-dim">
            <Num>
              {t('lines.asset.tabPanes.insights.contributed', {
                count: formatInteger(insights.model.contributed),
              })}
            </Num>
          </p>
        </Panel>
      </div>
    </div>
  )
}

/* ══ AUDIT ═══════════════════════════════════════════════════════════════ */

const AUDIT_FILTERS = ['all', 'user', 'system']

export function AuditTab({ asset }) {
  const { t } = useTranslation(['app', 'common'])
  const [filter, setFilter] = useState('all')
  const entries = asset.audit ?? []

  const shown = entries.filter((entry) => {
    if (filter === 'all') return true
    const isSystem = entry.actor === 'system'
    return filter === 'system' ? isSystem : !isSystem
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t('lines.asset.tabPanes.audit.actors')} className="flex gap-1.5">
          {AUDIT_FILTERS.map((entry) => (
            <Chip key={entry} selected={filter === entry} onClick={() => setFilter(entry)}>
              {t(`lines.asset.tabPanes.audit.${entry}`)}
            </Chip>
          ))}
        </div>
        <ForgeButton className="ms-auto">
          <Icon name="down" size="xs" />
          {t('lines.asset.tabPanes.audit.export')}
        </ForgeButton>
      </div>

      <Panel flush>
        <div className="border-b border-hairline px-4.5 py-3">
          <Eyebrow>{t('lines.asset.tabPanes.audit.title', { count: shown.length })}</Eyebrow>
        </div>
        <ul className="m-0 list-none px-4.5 py-1">
          {shown.map((entry) => {
            const isSystem = entry.actor === 'system'
            return (
              <li
                key={entry.id}
                className="flex items-start gap-3 border-b border-subtle py-3 last:border-b-0"
              >
                <Icon
                  name={isSystem ? 'bolt' : 'users'}
                  size="xs"
                  className="mt-0.5 shrink-0 text-ink-mute"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-body-sm">
                    {/* The machine's own entries are italicised so a reader
                        scanning for who did what can let them fall away. */}
                    <span className={cn('font-semibold', isSystem && 'text-ink-dim italic')}>
                      {isSystem ? t('lines.asset.tabPanes.audit.system_') : entry.actor}
                    </span>{' '}
                    {entry.action}
                  </span>
                  <span className="mt-0.5 block text-micro font-normal text-ink-dim">
                    {entry.detail}
                  </span>
                </span>
                {entry.at ? (
                  <Num className="shrink-0 text-micro font-normal whitespace-nowrap text-ink-dim">
                    {formatRelative(entry.at)}
                  </Num>
                ) : null}
              </li>
            )
          })}
        </ul>
      </Panel>
    </div>
  )
}
