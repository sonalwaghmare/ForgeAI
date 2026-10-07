import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { Chip, Segmented, SegmentedItem } from '@/components/forge/Chip'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Meter } from '@/components/forge/Meter'
import { Panel } from '@/components/forge/Panel'
import { TablePagination } from '@/components/forge/TablePagination'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { PlainBadge, StateBadge } from '@/components/forge/StatusBadge'
import { Dot, Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { ASSET_QUICK_FILTERS, ASSET_SORTS } from '@/features/lines/api'
import { useAssets } from '@/features/lines/queries'
import { useHomeContext } from '@/features/home/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatInteger, formatRelative } from '@/lib/format'
import { toneForHealth } from '@/lib/tone'
import { AssetFloorMap } from './AssetFloorMap'
import { AssetImportWizard } from './AssetImportWizard'
import { AssetFiltersDrawer } from './AssetFiltersDrawer'
import { ModuleTabs } from './ModuleTabs'

/**
 * Every asset at the site.
 *
 * DEMO. The counterpart to the line list: same records, flat rather than nested,
 * for the question the accordion cannot answer — "show me everything offline",
 * "everything S. Chen owns", "everything with a critical".
 *
 * ── Filtering is server-side even though the set is eighteen rows ─────────
 * The params object goes to the query, not to a `.filter()` in this file. The
 * whole point of the demo layer is that the screen is already shaped for a
 * plant with four thousand assets; sorting in the component would be the one
 * thing that has to be unpicked when the endpoint lands.
 *
 * ── Two kinds of filter, deliberately ─────────────────────────────────────
 * The chips commit on click. The drawer commits on Apply. See
 * `AssetFiltersDrawer` for why those differ.
 */

/** What the toolbar and the drawer start from, and what Clear returns to. */
const EMPTY_FILTERS = {
  quick: 'all',
  lineId: 'all',
  type: 'all',
  criticality: 'all',
  stream: 'all',
  owner: 'all',
  tag: 'all',
}

/** Which of the drawer's controls are set — the number on the toolbar chip. */
const activeCount = (filters) =>
  Object.entries(filters).filter(([key, value]) => key !== 'quick' && value !== 'all').length

const SENSOR_ICON = {
  temperature: 'thermo',
  vibration: 'wave',
  pressure: 'gauge',
  current: 'plug',
  flow: 'gauge',
  vision: 'eye',
  acoustic: 'wave',
  conductivity: 'plug',
}

export function AssetsPage() {
  const { t } = useTranslation(['app', 'common'])
  const context = useHomeContext()
  const siteId = context.data?.siteId

  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [draft, setDraft] = useState(EMPTY_FILTERS)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('name')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [view, setView] = useState('list')
  const [importOpen, setImportOpen] = useState(false)
  const navigate = useNavigate()

  useDocumentTitle(`${t('assets.title')} · ${t('common:brand.name')}`)

  const params = useMemo(
    () => ({
      siteId,
      ...filters,
      q: query.trim() || undefined,
      sort,
      page: view === 'map' ? 1 : page,
      // The map is not paginated — a floor plan showing rows 26 to 50 of a plant
      // is not a floor plan. It asks for the whole filtered set instead.
      pageSize: view === 'map' ? 500 : pageSize,
    }),
    [siteId, filters, query, sort, page, pageSize, view],
  )
  const assets = useAssets(params)

  const stats = assets.data?.stats
  const options = assets.data?.options ?? { types: [], owners: [], tags: [], lines: [], criticalities: [] }
  const facets = assets.data?.facets ?? {}
  const rows = assets.data?.items ?? []

  // Any change to what is being asked for returns to page one. Without this a
  // filter that leaves four rows strands the reader on page three of nothing.
  const commit = (next) => {
    setFilters(next)
    setDraft(next)
    setPage(1)
  }

  return (
    <Page>
      <header className="mb-4 flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
        <h1 className="m-0 text-display text-balance">{t('assets.title')}</h1>
        <p className="mt-2 mb-0 text-body text-ink-dim">
          {t('assets.subtitle', {
            site: context.data?.siteName ?? '',
            count: formatInteger(stats?.total ?? 0),
            lines: formatInteger(options.lines.length),
            online: formatInteger(stats?.online ?? 0),
          })}
        </p>
        </div>
        <ForgeButton onClick={() => setImportOpen(true)}>
          <Icon name="up" size="xs" />
          {t('assets.import.open')}
        </ForgeButton>
      </header>

      <ModuleTabs />

      {assets.isError ? (
        <ErrorState
          error={assets.error}
          title={t('assets.loadFailed')}
          onRetry={() => assets.refetch()}
        />
      ) : !assets.data ? (
        <SkeletonRows count={8} />
      ) : (
        <>
          <StatBar stats={stats} lineCount={options.lines.length} t={t} />

          {/* Toolbar. Quick chips, search and sort — the things worth one click. */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented label={t('assets.view.label')}>
              <SegmentedItem
                selected={view === 'list'}
                label={t('assets.view.list')}
                onClick={() => setView('list')}
              >
                <Icon name="list" size="sm" />
              </SegmentedItem>
              <SegmentedItem
                selected={view === 'map'}
                label={t('assets.view.map')}
                onClick={() => setView('map')}
              >
                <Icon name="map" size="sm" />
              </SegmentedItem>
            </Segmented>

            <div role="group" aria-label={t('assets.quickLabel')} className="flex flex-wrap gap-1.5">
              {ASSET_QUICK_FILTERS.map((value) => (
                <Chip
                  key={value}
                  selected={filters.quick === value}
                  onClick={() => commit({ ...filters, quick: value })}
                >
                  {t(`assets.quick.${value}`)}
                  {/* Counted over the whole site, so the chip answers "how many
                      are there" rather than "how many survive me". */}
                  {facets[value] != null ? (
                    <Num className="text-ink-mute">{formatInteger(facets[value])}</Num>
                  ) : null}
                </Chip>
              ))}
            </div>

            <Chip
              selected={activeCount(filters) > 0}
              onClick={() => {
                setDraft(filters)
                setDrawerOpen(true)
              }}
            >
              <Icon name="gear" size="xs" />
              {t('assets.moreFilters')}
              {activeCount(filters) ? (
                <Num className="text-ink-mute">{formatInteger(activeCount(filters))}</Num>
              ) : null}
            </Chip>

            {activeCount(filters) ? (
              <Chip onClick={() => commit({ ...EMPTY_FILTERS, quick: filters.quick })}>
                <Icon name="x" size="xs" />
                {t('assets.clearAll')}
              </Chip>
            ) : null}

            <label className="ms-auto flex min-w-[13rem] items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-2 focus-within:border-forge">
              <Icon name="search" size="sm" className="shrink-0 text-ink-mute" />
              <span className="sr-only">{t('assets.search')}</span>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
                placeholder={t('assets.searchPlaceholder')}
                className="w-full border-0 bg-transparent text-body text-ink outline-none placeholder:text-ink-dim"
              />
            </label>

            <ForgeSelect
              label={t('assets.sort')}
              labelInline
              size="sm"
              value={sort}
              onValueChange={setSort}
              options={ASSET_SORTS.map((value) => ({
                value,
                label: t(`assets.sortBy.${value}`),
              }))}
            />
          </div>

          {/* The line rail. A second row rather than another chip in the toolbar:
              it is the one filter a reader scans rather than picks, and it wants
              the whole width. */}
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <Eyebrow className="me-1">{t('assets.lineLabel')}</Eyebrow>
            <Chip
              selected={filters.lineId === 'all'}
              onClick={() => commit({ ...filters, lineId: 'all' })}
            >
              {t('assets.allLines')}
            </Chip>
            {options.lines.map((line) => (
              <Chip
                key={line.id}
                selected={filters.lineId === line.id}
                onClick={() => commit({ ...filters, lineId: line.id })}
              >
                {line.name}
                <Num className="text-ink-mute">{formatInteger(line.count)}</Num>
              </Chip>
            ))}
          </div>

          {view === 'map' ? (
            <AssetFloorMap
              assets={rows}
              lines={options.lines}
              onOpenLine={(lineId) => navigate(`/app/assets/lines/${lineId}`)}
            />
          ) : rows.length === 0 ? (
            <EmptyState icon="machine" />
          ) : (
            <Panel flush>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-body-sm">
                  <thead>
                    <tr className="bg-sunken">
                      {['asset', 'type', 'line', 'sensors', 'stream', 'health', 'alerts', 'lastSeen', 'owner'].map(
                        (column) => (
                          <th
                            key={column}
                            scope="col"
                            className="eyebrow border-b border-hairline px-4 py-2.5 text-start whitespace-nowrap"
                          >
                            {t(`assets.columns.${column}`)}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((asset) => (
                      <AssetTableRow key={asset.id} asset={asset} t={t} />
                    ))}
                  </tbody>
                </table>
              </div>

              <TablePagination
                total={assets.data.total}
                page={assets.data.page}
                pageSize={assets.data.pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
                label={t('assets.pagerLabel')}
              />
            </Panel>
          )}
        </>
      )}

      <AssetImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        siteName={context.data?.siteName}
        lines={options.lines}
      />

      <AssetFiltersDrawer
        open={drawerOpen}
        draft={draft}
        options={options}
        onChange={setDraft}
        onApply={() => {
          commit(draft)
          setDrawerOpen(false)
        }}
        onClear={() => setDraft({ ...EMPTY_FILTERS, quick: draft.quick })}
        onClose={() => setDrawerOpen(false)}
      />
    </Page>
  )
}

/**
 * The five-card stat bar.
 *
 * Three of the five carry a distribution bar rather than a second number,
 * because the split is the fact: 17 online out of 18 and 9 out of 18 are the
 * same figure with very different meanings, and a bar says which at a glance.
 */
function StatBar({ stats, lineCount, t }) {
  if (!stats) return null

  return (
    <dl className="m-0 mb-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
      <Card
        icon="layers"
        label={t('assets.stats.total')}
        value={formatInteger(stats.total)}
        caption={t('assets.stats.totalSub', { count: lineCount })}
      />

      <Card icon="plug" label={t('assets.stats.stream')} value={`${formatInteger(stats.online)} / ${formatInteger(stats.offline)}`}>
        <Split
          label={t('assets.stats.streamLabel', { online: stats.online, offline: stats.offline })}
          parts={[
            { value: stats.online, tone: 'green' },
            { value: stats.offline, tone: null },
          ]}
        />
      </Card>

      <Card
        icon="gauge"
        label={t('assets.stats.health')}
        value={formatInteger(stats.avgHealth)}
        unit={t('assets.stats.healthAvg')}
        tone={toneForHealth(stats.avgHealth)}
      >
        <Split
          parts={[
            { value: stats.good, tone: 'green' },
            { value: stats.watch, tone: 'amber' },
            { value: stats.poor, tone: 'red' },
          ]}
        />
        <span className="mt-1.5 block text-micro font-normal text-ink-dim">
          <Num>
            {t('assets.stats.healthLabel', {
              good: stats.good,
              watch: stats.watch,
              poor: stats.poor,
            })}
          </Num>
        </span>
      </Card>

      <Card
        icon="bell"
        label={t('assets.stats.alerts')}
        value={formatInteger(stats.alerts)}
        tone={stats.alerts ? 'red' : null}
      >
        <div className="mt-2 flex flex-wrap gap-1.5">
          {stats.alertsCritical ? (
            <StateBadge tone="red" dot={false}>
              <Num>{t('assets.stats.alertsCritical', { count: stats.alertsCritical })}</Num>
            </StateBadge>
          ) : null}
          {stats.alertsHigh ? (
            <StateBadge tone="amber" dot={false}>
              <Num>{t('assets.stats.alertsHigh', { count: stats.alertsHigh })}</Num>
            </StateBadge>
          ) : null}
          {!stats.alertsCritical && !stats.alertsHigh ? (
            <span className="text-micro font-normal text-ink-dim">{t('assets.stats.alertsNone')}</span>
          ) : null}
        </div>
      </Card>

      <Card
        icon="wrench"
        label={t('assets.stats.workOrders')}
        value={formatInteger(stats.workOrders)}
        tone={stats.workOrdersUrgent ? 'amber' : null}
        caption={t('assets.stats.workOrdersSub', { urgent: stats.workOrdersUrgent })}
      />
    </dl>
  )
}

function Card({ icon, label, value, unit, caption, tone, children }) {
  return (
    <div className="rounded-sm border border-hairline bg-card p-3.5 shadow-edge">
      <dt className="mb-2 flex items-center gap-2">
        <Icon name={icon} size="sm" className="shrink-0 text-ink-dim" />
        <span className="min-w-0 flex-1 truncate text-body-sm text-ink-dim">{label}</span>
      </dt>
      <dd className="m-0">
        <Num className="text-metric-sm leading-none" style={tone ? { color: `var(--on-${tone})` } : undefined}>
          {value}
        </Num>
        {unit ? <span className="ms-1.5 text-micro font-normal text-ink-dim">{unit}</span> : null}
        {caption ? (
          <span className="mt-1.5 block text-micro font-normal text-ink-dim">
            <Num>{caption}</Num>
          </span>
        ) : null}
        {children}
      </dd>
    </div>
  )
}

/**
 * A proportional bar.
 *
 * `label` is the accessible name for a bar that stands alone. Where a visible
 * caption already states the split — the health card — it is omitted and the bar
 * goes `aria-hidden`, so the figures are announced once rather than twice.
 */
function Split({ parts, label }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0) || 1
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      className="mt-2 flex h-1.5 overflow-hidden rounded-pill bg-sunken"
    >
      {parts
        .filter((part) => part.value > 0)
        .map((part, index) => (
          <span
            key={index}
            className="block h-full"
            style={{
              width: `${(part.value / total) * 100}%`,
              background: part.tone ? `var(--hue-${part.tone})` : 'var(--ink-mute)',
            }}
          />
        ))}
    </span>
  )
}

function AssetTableRow({ asset, t }) {
  const critical = asset.alerts.worst === 'critical'

  return (
    <tr className="border-b border-subtle last:border-b-0 even:bg-row-alt">
      <th scope="row" className="px-4 py-2.5 text-start">
        <Link to={`/app/assets/${asset.id}`} className="group flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-xs border border-hairline bg-sunken">
            <Icon name="machine" size="xs" className="text-ink-mute" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold group-hover:text-on-forge">{asset.name}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <Mono className="text-micro text-ink-dim">{asset.code}</Mono>
              {asset.tags?.slice(0, 2).map((tag) => (
                <PlainBadge key={tag} className="py-0 text-[0.625rem]">
                  {tag}
                </PlainBadge>
              ))}
            </span>
          </span>
        </Link>
      </th>

      <td className="px-4 py-2.5 whitespace-nowrap text-ink-dim">
        {t(`lines.type.${asset.type}`, { defaultValue: asset.type })}
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap text-ink-dim">{asset.lineName}</td>

      <td className="px-4 py-2.5">
        {/* Icons carry the sensor kinds, with the names in the group's accessible
            label — eight words per row would crowd out everything else, and the
            reader is scanning for "does this one have vision" rather than
            reading a list. */}
        <span
          role="img"
          aria-label={(asset.sensors ?? [])
            .map((kind) => t(`assets.sensorKind.${kind}`, { defaultValue: kind }))
            .join(', ')}
          className="flex gap-1"
        >
          {(asset.sensors ?? []).map((kind) => (
            <span
              key={kind}
              className="flex size-5 items-center justify-center rounded-xs border border-hairline bg-sunken"
            >
              <Icon name={SENSOR_ICON[kind] ?? 'gauge'} size="xs" className="text-ink-mute" />
            </span>
          ))}
        </span>
      </td>

      <td className="px-4 py-2.5 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5 text-ink-dim">
          {asset.online ? (
            <Dot tone="green" size={6} />
          ) : (
            <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-ink-mute" />
          )}
          {t(asset.online ? 'lines.row.online' : 'lines.row.offline')}
        </span>
      </td>

      <td className="px-4 py-2.5">
        <Meter value={asset.health} label={t('assets.columns.health')} compact />
      </td>

      <td className="px-4 py-2.5 whitespace-nowrap">
        {asset.alerts.total ? (
          <StateBadge
            tone={critical ? 'red' : asset.alerts.worst === 'high' ? 'amber' : 'watch'}
            dot={false}
          >
            <Num>{formatInteger(asset.alerts.total)}</Num>
          </StateBadge>
        ) : (
          <span className="text-ink-mute">—</span>
        )}
      </td>

      <td className="px-4 py-2.5 whitespace-nowrap text-ink-dim">
        <Num>{asset.lastSeenAt ? formatRelative(asset.lastSeenAt) : '—'}</Num>
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap text-ink-dim">{asset.ownerName}</td>
    </tr>
  )
}
