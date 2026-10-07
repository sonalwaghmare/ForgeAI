import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { Chip } from '@/components/forge/Chip'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { Dot, Num, VRule } from '@/components/forge/primitives'
import {
  DEFAULT_WINDOW,
  SIGNAL_SORTS,
  SIGNAL_STATE_FILTERS,
  SIGNAL_WINDOWS,
} from '@/features/signals/api'
import { useCreateChart, useSignalScopes, useSignals } from '@/features/signals/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/providers/ToastProvider'
import { formatInteger, formatRelative } from '@/lib/format'
import { ChannelPickerDialog } from './ChannelPickerDialog'
import { DateRangePicker } from './DateRangePicker'
import { ScopeSelector } from './ScopeSelector'
import { SignalCard } from './SignalCard'
import { SignalFiltersDrawer } from './SignalFiltersDrawer'

/**
 * Sensor Explorer — every measured channel in scope, as a wall of traces.
 *
 * DEMO. See `DEMO-MODE.md` §8.4 and `mocks/fixtures/signals.js`, which explains
 * why not one channel on this screen is authored.
 *
 * ── Where and when live in the URL ────────────────────────────────────────
 * `?scope=` and `?window=` (or `?from=&to=`) are search params, because they are
 * the two things somebody sends a colleague: "look at Line 1's channels over the
 * last seven days". The narrowing controls — severity, kind, asset, search — are
 * component state, the same split `AssetsPage` uses. The prototype keeps all of
 * it in `useState`, so nothing on the screen can be linked to.
 *
 * ── The streaming stamp is real ───────────────────────────────────────────
 * The design prints "⟳ streaming · updated 1s ago" as a literal, which says one
 * second whether the tab has been open for a second or a day. Here the grid
 * actually polls — at an interval that follows the window, see `queries.js` —
 * and the stamp is the query's own `dataUpdatedAt`. A range picked on the
 * calendar is a closed span rather than a live one, so it says so instead.
 *
 * ── Filtering is server-side ──────────────────────────────────────────────
 * Every control is a request parameter, including the search box. Forty-five
 * channels would filter in one client-side pass; the point is the seam, so
 * landing the endpoint over four thousand changes `api.js` and nothing here.
 */

/** What the drawer starts from, and what Clear returns to. */
const EMPTY_FILTERS = { kind: 'all', assetId: 'all', lineId: 'all', stream: 'all' }

/** How many of the drawer's controls are set — the number on its toolbar chip. */
const activeCount = (filters) => Object.values(filters).filter((value) => value !== 'all').length

export function SensorExplorerPage() {
  const { t } = useTranslation(['app', 'common'])
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const scopes = useSignalScopes()
  const createChart = useCreateChart()

  const scope = searchParams.get('scope') ?? ''
  const windowKey = SIGNAL_WINDOWS.includes(searchParams.get('window'))
    ? searchParams.get('window')
    : DEFAULT_WINDOW
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const range = useMemo(() => (from && to ? { from, to } : null), [from, to])

  const [state, setState] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('severity')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [draft, setDraft] = useState(EMPTY_FILTERS)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [creating, setCreating] = useState(false)


  useDocumentTitle(`${t('sensors.title')} · ${t('common:brand.name')}`)

  /* The tree's root IS "all locations" — it is the enterprise node and its count
     is every channel. Adopting it once the tree lands means the selector opens
     showing where you are rather than a placeholder that is not in the list. */
  const rootId = scopes.data?.items?.[0]?.id
  useEffect(() => {
    if (!scope && rootId) setSearchParams((previous) => withParam(previous, 'scope', rootId), { replace: true })
  }, [scope, rootId, setSearchParams])

  const params = useMemo(
    () => ({
      scope: scope || undefined,
      // A range and a pill are the same parameter; only one is ever sent. See
      // `windowSpec()` for why the prototype's two independent controls are one.
      ...(range ? { from: range.from, to: range.to } : { window: windowKey }),
      state,
      ...filters,
      q: query.trim() || undefined,
      sort,
    }),
    [scope, range, windowKey, state, filters, query, sort],
  )

  const signals = useSignals(params)

  const rows = signals.data?.items ?? []
  /**
   * What New Chart opens with.
   *
   * Four channels, drawn at random from what is in scope, rather than an empty
   * checklist. A chart of one series is a sparkline — the reason somebody opens
   * the Workstation at all is to put unlike signals on one time axis, and
   * starting them at zero selections makes them do that setup before they can
   * see whether the tool is worth it.
   *
   * Random rather than "the first four", because the first four are always the
   * same asset in a list sorted by asset, and four channels off one machine
   * compare nothing. Re-rolled per opening — `creating` is the dependency — so
   * closing and reopening offers a different starting set.
   */
  const seededSelection = useMemo(() => {
    if (!creating) return []
    const pool = [...rows]
    // Fisher-Yates over a copy. `sort(() => Math.random() - 0.5)` is the usual
    // shortcut and it is not a shuffle: the comparator is inconsistent, so the
    // distribution is skewed and V8's sort can visit the same pair twice.
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool.slice(0, 4).map((channel) => channel.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creating])
  const facets = signals.data?.facets ?? {}
  const options = signals.data?.options ?? { kinds: [], assets: [], lines: [] }

  const setParam = (key, value) => setSearchParams((previous) => withParam(previous, key, value))

  const pickWindow = (next) =>
    setSearchParams((previous) => {
      const url = new URLSearchParams(previous)
      url.set('window', next)
      // Picking a pill drops the range, because they are one control.
      url.delete('from')
      url.delete('to')
      return url
    })

  const pickRange = (next) =>
    setSearchParams((previous) => {
      const url = new URLSearchParams(previous)
      if (next) {
        url.set('from', next.from)
        url.set('to', next.to)
        url.delete('window')
      } else {
        url.delete('from')
        url.delete('to')
      }
      return url
    })

  /* The chips above the grid, one per narrowing that is in force, each removing
     its own. Built from the same values the request carries, so a chip cannot
     survive the filter it names. */
  const activeChips = [
    state !== 'all' && ['state', t(`sensors.state.${state}`), () => setState('all')],
    filters.kind !== 'all' && [
      'kind',
      t(`sensors.kind.${filters.kind}`),
      () => commitFilters({ ...filters, kind: 'all' }),
    ],
    filters.assetId !== 'all' && [
      'asset',
      options.assets.find((asset) => asset.id === filters.assetId)?.name ?? filters.assetId,
      () => commitFilters({ ...filters, assetId: 'all' }),
    ],
    filters.lineId !== 'all' && [
      'line',
      options.lines.find((line) => line.id === filters.lineId)?.name ?? filters.lineId,
      () => commitFilters({ ...filters, lineId: 'all' }),
    ],
    filters.stream !== 'all' && [
      'stream',
      t(`sensors.stream.${filters.stream}`),
      () => commitFilters({ ...filters, stream: 'all' }),
    ],
    query.trim() && ['q', t('sensors.chip.search', { query: query.trim() }), () => setQuery('')],
  ].filter(Boolean)

  function commitFilters(next) {
    setFilters(next)
    setDraft(next)
  }

  const clearAll = () => {
    commitFilters(EMPTY_FILTERS)
    setState('all')
    setQuery('')
  }

  return (
    <Page>
      <header className="mb-4 flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-display text-balance">{t('sensors.title')}</h1>
          <p className="mt-2 mb-0 text-body text-ink-dim">
            <Num>
              {t('sensors.subtitle', {
                shown: formatInteger(rows.length),
                total: formatInteger(facets.all ?? 0),
              })}
            </Num>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ForgeButton asChild>
            <Link to="/app/sensors/charts">
              <Icon name="chart" size="xs" />
              {t('sensors.workstation.allCharts')}
            </Link>
          </ForgeButton>
          <ForgeButton variant="primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size="xs" />
            {t('sensors.workstation.newChart')}
          </ForgeButton>
        </div>
      </header>

      {/* Scope · span · liveness. The three questions that apply to every card
          below, kept together and above the ones that apply to some of them. */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <ScopeSelector
          nodes={scopes.data?.items ?? []}
          value={scope}
          total={scopes.data?.total ?? 0}
          onChange={(next) => setParam('scope', next)}
        />
        <VRule className="h-6 max-sm:hidden" />
        <DateRangePicker value={range} onChange={pickRange} />
        <div
          role="group"
          aria-label={t('sensors.window.label')}
          className="flex gap-[3px] rounded-md bg-sunken p-[3px]"
        >
          {SIGNAL_WINDOWS.map((entry) => (
            <button
              key={entry}
              type="button"
              aria-pressed={!range && windowKey === entry}
              onClick={() => pickWindow(entry)}
              className={
                !range && windowKey === entry
                  ? 'rounded-xs bg-forge px-3 py-1 text-body-sm font-semibold text-white'
                  : 'rounded-xs px-3 py-1 text-body-sm text-ink-dim transition-colors hover:text-ink'
              }
            >
              {t(`sensors.window.${entry}`)}
            </button>
          ))}
        </div>

        <p className="m-0 ms-auto flex items-center gap-1.5 text-micro font-normal text-ink-dim">
          {range ? (
            t('sensors.stream.closedRange')
          ) : (
            <>
              <Dot tone="green" size={6} />
              <Num>
                {t('sensors.stream.live', {
                  when: signals.dataUpdatedAt ? formatRelative(new Date(signals.dataUpdatedAt)) : '—',
                })}
              </Num>
            </>
          )}
        </p>
      </div>

      {/* Severity · kind · asset · more · search. */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label={t('sensors.stateLabel')}
          className="flex gap-[3px] rounded-md bg-sunken p-[3px]"
        >
          {SIGNAL_STATE_FILTERS.map((entry) => (
            <button
              key={entry}
              type="button"
              aria-pressed={state === entry}
              onClick={() => setState(entry)}
              className={
                state === entry
                  ? 'flex items-center gap-1.5 rounded-xs bg-forge px-3 py-1 text-body-sm font-semibold text-white'
                  : 'flex items-center gap-1.5 rounded-xs px-3 py-1 text-body-sm text-ink-dim transition-colors hover:text-ink'
              }
            >
              {t(`sensors.state.${entry}`)}
              <Num className="font-normal opacity-80">{formatInteger(facets[entry] ?? 0)}</Num>
            </button>
          ))}
        </div>

        <ForgeSelect
          label={t('sensors.kindLabel')}
          labelInline
          size="sm"
          value={filters.kind}
          onValueChange={(value) => commitFilters({ ...filters, kind: value })}
          options={[
            { value: 'all', label: t('sensors.drawer.anyKind') },
            ...options.kinds.map((kind) => ({ value: kind, label: t(`sensors.kind.${kind}`) })),
          ]}
        />

        <ForgeSelect
          label={t('sensors.sortLabel')}
          labelInline
          size="sm"
          value={sort}
          onValueChange={setSort}
          options={SIGNAL_SORTS.map((entry) => ({ value: entry, label: t(`sensors.sort.${entry}`) }))}
        />

        <ForgeButton size="sm" onClick={() => setDrawerOpen(true)}>
          <Icon name="list" size="xs" />
          {t('sensors.moreFilters')}
          {activeCount(filters) ? <Num>{formatInteger(activeCount(filters))}</Num> : null}
        </ForgeButton>

        <label className="flex min-w-[13rem] flex-1 items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-2 focus-within:border-forge sm:max-w-[18rem]">
          <Icon name="search" size="sm" className="shrink-0 text-ink-mute" />
          <span className="sr-only">{t('sensors.search')}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('sensors.searchPlaceholder')}
            className="w-full border-0 bg-transparent text-body text-ink outline-none placeholder:text-ink-dim"
          />
        </label>
      </div>

      {activeChips.length ? (
        <div className="mb-3.5 flex flex-wrap items-center gap-1.5">
          {activeChips.map(([key, label, clear]) => (
            <Chip key={key} selected onClick={clear}>
              {label}
              <Icon name="x" size="xs" />
            </Chip>
          ))}
          <ForgeButton variant="ghost" size="sm" onClick={clearAll}>
            {t('sensors.clearAll')}
          </ForgeButton>
        </div>
      ) : null}

      {signals.isError ? (
        <ErrorState error={signals.error} title={t('sensors.loadFailed')} onRetry={() => signals.refetch()} />
      ) : signals.isPending ? (
        <SkeletonRows count={4} />
      ) : rows.length === 0 ? (
        <EmptyState icon="chart" title={t('sensors.empty.title')} body={t('sensors.empty.body')} />
      ) : (
        <ul className="m-0 grid list-none gap-3.5 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(100%,26rem),1fr))]">
          {rows.map((channel) => (
            <li key={channel.id}>
              <SignalCard channel={channel} />
            </li>
          ))}
        </ul>
      )}

      {/* New Chart. The dialog offers every channel in scope rather than the
          filtered set: somebody building a chart is choosing what to compare,
          which is not the same question the grid's filters were answering. */}
      {/* Remounted per opening, so the seeded selection is re-read rather than
          frozen at the first mount — the arrangement `ReportsPage` uses for the
          same reason. */}
      <ChannelPickerDialog
        key={creating ? seededSelection.join(',') : 'closed'}
        open={creating}
        mode="create"
        channels={rows}
        selected={seededSelection}
        pending={createChart.isPending}
        onClose={() => setCreating(false)}
        onSubmit={async (body) => {
          const chart = await createChart.mutateAsync(body)
          setCreating(false)
          toast(t('sensors.workstation.createdToast', { name: chart.name }), 'ok')
          navigate(`/app/sensors/charts/${chart.id}`)
        }}
      />

      <SignalFiltersDrawer
        open={drawerOpen}
        draft={draft}
        options={options}
        facets={facets}
        source={signals.data?.source ?? null}
        onChange={setDraft}
        onApply={() => {
          setFilters(draft)
          setDrawerOpen(false)
        }}
        onClear={() => setDraft(EMPTY_FILTERS)}
        onClose={() => {
          // An abandoned draft is discarded, not half-applied.
          setDraft(filters)
          setDrawerOpen(false)
        }}
      />
    </Page>
  )
}

/** One search param changed, the rest of the URL left alone. */
function withParam(previous, key, value) {
  const params = new URLSearchParams(previous)
  if (value) params.set(key, value)
  else params.delete(key)
  return params
}
