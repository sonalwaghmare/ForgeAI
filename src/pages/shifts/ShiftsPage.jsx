import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { MetricCard } from '@/components/forge/MetricCard'
import { Meter } from '@/components/forge/Meter'
import { Panel } from '@/components/forge/Panel'
import { TablePagination } from '@/components/forge/TablePagination'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { StateBadge } from '@/components/forge/StatusBadge'
import { Dot, Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { SHIFT_RANGES, SHIFT_STATUSES, SHIFT_TABS, SHIFT_TYPES } from '@/features/shifts/api'
import { useShifts } from '@/features/shifts/queries'
import {
  useAcknowledgeHandover,
  useHandoverMutation,
  useHandovers,
} from '@/features/handovers/queries'
import { useCurrentShift } from '@/features/operations/queries'
import { useTasks } from '@/features/tasks/queries'
import { useSession } from '@/features/auth/mutations'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/providers/ToastProvider'
import { formatInteger, formatPercent } from '@/lib/format'
import { SHIFT_STATE_TONE, SHIFT_TYPE_TONE } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { HandoverFormDialog, HandoverReportDialog } from '@/pages/home/HandoverDialogs'
import { CurrentShiftTab } from './CurrentShiftTab'
import { ScheduleShiftDialog } from './ScheduleShiftDialog'
import { ShiftDetailPanel } from './ShiftDetailPanel'
import { ShiftSynopsis } from './ShiftSynopsis'
import { CrewDetail } from './CrewDetail'
import { shiftFigures } from './projectedFigures'
import { formatShiftDate, formatShiftTime } from './shiftClock'

/**
 * Shifts.
 *
 * DEMO. See `DEMO-MODE.md` §8.5. Two tabs over one week of roster: the AI
 * Synopsis and the History table with its detail panel and crew rollup.
 *
 * ── The tab, the scope and the selected shift live in the URL ─────────────
 * `?tab=history&scope=mine&shift=SH-…`. The prototype keeps all three in
 * `useState`, so a rough shift somebody wants a colleague to look at cannot be
 * linked to. It is also what lets the synopsis cards jump to a shift: they set
 * the tab and the selection in one navigation.
 *
 * ── "Just me" means just me ───────────────────────────────────────────────
 * The prototype falls back to the whole crew when the reader has no shifts —
 * `(scope === "me" && byMe.length) ? byMe : SHIFTS` — so the toggle can read
 * "Just me" above everybody's week. Here an empty personal week says so.
 *
 * ── The week is this week ─────────────────────────────────────────────────
 * Derived from the clock, subtitle included. The design's is fixed to
 * "week of Jun 16–22, 2026".
 */

const EMPTY = { type: 'all', status: 'all', operatorId: 'all' }

/** Tab → glyph. A static map so a fourth tab cannot ship with no icon. */
const TAB_ICON = { synopsis: 'ai', current: 'gauge', history: 'cal' }


export function ShiftsPage() {
  const { t } = useTranslation(['app', 'common'])
  const [searchParams, setSearchParams] = useSearchParams()
  const session = useSession()
  const { toast } = useToast()

  const tab = SHIFT_TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'synopsis'
  const scope = searchParams.get('scope') === 'mine' ? 'mine' : 'all'
  const selectedId = searchParams.get('shift')
  /* Which crew member is opened in the rollup. A search param like every other
     drill-down in this module, so a manager can send somebody one person's
     week rather than describing how to get to it. */
  const crewId = searchParams.get('crew')
  /* Absent means "let the server pick" — mid-week that is last week plus this
     one, so the chart has a full week of real shifts behind it. The answer comes
     back on the payload and lights the chip. */
  const days = SHIFT_RANGES.includes(Number(searchParams.get('days')))
    ? Number(searchParams.get('days'))
    : null

  const [filters, setFilters] = useState(EMPTY)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [scheduling, setScheduling] = useState(false)
  /* The handover report, opened IN PLACE. It used to navigate to the archive,
     which is a different screen and loses the shift you were reading. The
     design opens it as a modal over Shifts, and the dialog it opens is the one
     the archive already uses — reusing it is what keeps a shift boundary to one
     handover document rather than two. */
  const [handoverDialog, setHandoverDialog] = useState(null)

  useDocumentTitle(`${t('shifts.title')} · ${t('common:brand.name')}`)

  const me = session.data?.user?.id ?? null

  /* The table is the only tab that pages and the only one the column filters
     belong to. Both other tabs read the WHOLE span, unfiltered.

     This is the §2.7 trap twice over. The synopsis already asked for the whole
     span because a chart of rows 1–10 of a fortnight is not a chart of the
     fortnight. Current Shift then shipped searching the table's page for the
     running shift — and on a fortnight sorted newest-first, page one is the
     three days AHEAD of today, so the shift running right now falls onto page
     two and the tab reported that nothing was running while the shell header
     three inches above it named the shift. A filter set on History could blank
     it the same way. */
  const isTable = tab === 'history'

  const params = useMemo(
    () => ({
      mine: scope === 'mine' && me ? me : undefined,
      days: days ?? undefined,
      ...(isTable ? filters : EMPTY),
      page: isTable ? page : 1,
      pageSize: isTable ? pageSize : 500,
    }),
    [scope, me, days, filters, page, pageSize, isTable],
  )

  const shifts = useShifts(params)
  /* The archive, for the record behind a shift's handover. One cached request,
     and it is the same record the Handovers screen shows — the alternative,
     putting the whole report on every roster row, is the same document twenty-one
     times. */
  const handovers = useHandovers()
  const tasks = useTasks()
  /* The SHELL's answer to "which shift is running" — the same read the top bar
     uses, resolved from the clock against the published windows. Current Shift
     defers to it rather than deciding for itself, so the two cannot disagree
     about whether the plant is running a shift. */
  const live = useCurrentShift()
  const publish = useHandoverMutation()
  const acknowledge = useAcknowledgeHandover()

  const rows = shifts.data?.items ?? []
  const stats = shifts.data?.stats
  const options = shifts.data?.options ?? {
    types: SHIFT_TYPES,
    operators: [],
    ranges: SHIFT_RANGES,
  }

  /* The selected shift, found in the page that is loaded. The panel is beside
     the table and the table is what put it there, so a second request for a row
     already on screen would be a spinner over data we hold. Falls back to the
     first row so the panel is never empty beside a table that is not. */
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null

  const setParam = (key, value) =>
    setSearchParams((previous) => {
      const url = new URLSearchParams(previous)
      if (value) url.set(key, value)
      else url.delete(key)
      return url
    })

  /** Jump from a synopsis card to a shift: the tab and the selection together. */
  const inspect = (id) =>
    setSearchParams((previous) => {
      const url = new URLSearchParams(previous)
      url.set('tab', 'history')
      url.set('shift', id)
      return url
    })

  const commit = (next) => {
    setFilters(next)
    setPage(1)
  }

  const active = Object.values(filters).filter((value) => value !== 'all').length

  const handoverRows = handovers.data?.items ?? []

  /* The running shift, off the whole span rather than the table's page.
     `status` is computed server-side by the same rule the shell's resolver
     uses — start <= now < end against the published windows — so once the row
     is actually in the response the two surfaces agree by construction. Where
     they can still part company is scope: "Just me" narrows the roster and the
     top bar does not narrow with it, which is a real difference and the tab
     says so rather than claiming nothing is running. */
  const running = rows.find((row) => row.status === 'active') ?? null

  /* One label, reused as the title on every projected cell and as the footnote
     under the table, so the two can never say different things. */
  const plannedLabel = t('shifts.planned')

  /**
   * Open the handover for a shift.
   *
   * A shift that filed one opens THAT record; a shift that did not opens the
   * form seeded from the most recent handover, which is the same seed the
   * archive's own Create button uses. Nothing is authored twice.
   */
  const openHandover = (shift) => {
    /* A RUNNING shift opens the report for the handover it is about to file —
       composed from that shift, so the summary, the carried anomalies and the
       pending actions are its own. That is the design's flow: End Shift &
       Handover shows the report with a Complete action on it, not an editing
       form. Edit is still one click away inside the dialog. */
    if (shift.status === 'active') {
      const draft = shifts.data?.draftHandover
      if (!draft) return
      setHandoverDialog({
        mode: 'report',
        row: {
          ...draft.handover,
          report: {
            ...draft.report,
            /* Resolved here and not in the fixture: a seeded work order stores
               its title as an i18n key, and only the client has `t`. */
            pending: (draft.report.pendingOrders ?? []).map(
              (order) =>
                `${order.id} — ${t(`workOrders.titles.${order.title}`, { defaultValue: order.title })}`,
            ),
          },
        },
      })
      return
    }

    const existing = shift.handoverId
      ? handoverRows.find((row) => row.id === shift.handoverId)
      : null

    // A filed report opens as a report; a draft opens in the form, which is what
    // its Edit label promises.
    if (existing) {
      setHandoverDialog({ mode: existing.status === 'draft' ? 'form' : 'report', row: existing })
      return
    }

    // A shift that ended with nothing filed: the form, seeded from the most
    // recent handover — the same seed the archive's own Create button uses.
    const seed = handoverRows[0]
    if (seed) setHandoverDialog({ mode: 'form', row: seed })
  }

  return (
    <Page>
      <header className="mb-4 flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-display text-balance">{t('shifts.title')}</h1>
          <p className="mt-2 mb-0 text-body text-ink-dim">
            <Num>
              {t(scope === 'mine' ? 'shifts.subtitleMine' : 'shifts.subtitle', {
                count: stats?.shifts ?? 0,
                from: rows.length
                  ? formatShiftDate(rows[rows.length - 1].date, { dateStyle: 'medium' })
                  : '—',
                to: rows.length ? formatShiftDate(rows[0].date, { dateStyle: 'medium' }) : '—',
              })}
            </Num>
          </p>
        </div>
        {/* The design's two header actions. Shift Master used to be omitted for
            want of a destination — it is a route now, so it is offered. */}
        <ForgeButton asChild>
          <Link to="/app/shifts/master">
            <Icon name="gear" size="xs" />
            {t('shifts.master.title')}
          </Link>
        </ForgeButton>
        <ForgeButton asChild>
          <Link to="/app/handovers">
            <Icon name="cal" size="xs" />
            {t('shifts.allHandovers')}
          </Link>
        </ForgeButton>
      </header>

      <nav className="mb-4 flex gap-1 border-b border-hairline" aria-label={t('shifts.tabsLabel')}>
        {SHIFT_TABS.map((entry) => (
          <button
            key={entry}
            type="button"
            aria-current={tab === entry ? 'page' : undefined}
            onClick={() => setParam('tab', entry === 'synopsis' ? null : entry)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-body-sm transition-colors',
              tab === entry
                ? 'border-forge font-semibold text-ink'
                : 'border-transparent text-ink-dim hover:text-ink',
            )}
          >
            <Icon name={TAB_ICON[entry]} size="xs" />
            {t(`shifts.tab.${entry}`)}
          </button>
        ))}
      </nav>

      {/* The crew scope belongs above both tabs: it changes the briefing as well
          as the table, which is the whole reason a personal view exists. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label={t('shifts.scopeLabel')}
          className="flex gap-[3px] rounded-md bg-sunken p-[3px]"
        >
          {['all', 'mine'].map((entry) => (
            <button
              key={entry}
              type="button"
              aria-pressed={scope === entry}
              onClick={() => setParam('scope', entry === 'all' ? null : entry)}
              className={
                scope === entry
                  ? 'rounded-xs bg-forge px-3 py-1 text-body-sm font-semibold text-white'
                  : 'rounded-xs px-3 py-1 text-body-sm text-ink-dim transition-colors hover:text-ink'
              }
            >
              {t(`shifts.scope.${entry}`)}
            </button>
          ))}
        </div>
        <div
          role="group"
          aria-label={t('shifts.rangeLabel')}
          className="flex gap-[3px] rounded-md bg-sunken p-[3px]"
        >
          {(options.ranges ?? SHIFT_RANGES).map((entry) => (
            <button
              key={entry}
              type="button"
              aria-pressed={(days ?? shifts.data?.days ?? 7) === entry}
              onClick={() => {
                setParam('days', String(entry))
                setPage(1)
              }}
              className={
                (days ?? shifts.data?.days ?? 7) === entry
                  ? 'rounded-xs bg-forge px-3 py-1 text-body-sm font-semibold text-white'
                  : 'rounded-xs px-3 py-1 text-body-sm text-ink-dim transition-colors hover:text-ink'
              }
            >
              <Num>{t('shifts.range', { count: entry / 7 })}</Num>
            </button>
          ))}
        </div>

        {scope === 'mine' && session.data?.user?.name ? (
          <span className="text-micro font-normal text-ink-dim">
            {t('shifts.scopeWho', { name: session.data.user.name })}
          </span>
        ) : null}
      </div>

      {shifts.isError ? (
        <ErrorState
          error={shifts.error}
          title={t('shifts.loadFailed')}
          onRetry={() => shifts.refetch()}
        />
      ) : shifts.isPending ? (
        <SkeletonRows count={5} />
      ) : stats?.shifts === 0 ? (
        <EmptyState
          icon="cal"
          title={t('shifts.emptyMineTitle')}
          body={t('shifts.emptyMineBody')}
          action={
            <ForgeButton onClick={() => setParam('scope', null)}>
              {t('shifts.scope.all')}
            </ForgeButton>
          }
        />
      ) : tab === 'synopsis' ? (
        <ShiftSynopsis
          synopsis={shifts.data.synopsis}
          shifts={rows}
          onInspect={inspect}
          onHandover={() => running && openHandover(running)}
          onScope={scope === 'mine' ? () => setParam('scope', null) : null}
        />
      ) : tab === 'current' ? (
        <CurrentShiftTab
          live={live.data ?? null}
          shift={running}
          scope={scope}
          handover={handoverRows[0] ?? null}
          onHandover={() => running && openHandover(running)}
          onScope={() => setParam('scope', null)}
          onViewReport={() =>
            handoverRows[0] && setHandoverDialog({ mode: 'report', row: handoverRows[0] })
          }
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
            <MetricCard
              icon="gauge"
              tone={stats.averageOee >= 80 ? 'green' : 'amber'}
              label={t(scope === 'mine' ? 'shifts.kpi.myOee' : 'shifts.kpi.oee')}
              value={stats.averageOee == null ? '—' : formatPercent(stats.averageOee, 1)}
            />
            <MetricCard
              icon="bolt"
              tone={stats.anomalies ? 'red' : null}
              label={t(scope === 'mine' ? 'shifts.kpi.myAnomalies' : 'shifts.kpi.anomalies')}
              value={formatInteger(stats.anomalies)}
            />
            <MetricCard
              icon="wrench"
              label={t(scope === 'mine' ? 'shifts.kpi.myWorkOrders' : 'shifts.kpi.workOrders')}
              value={formatInteger(stats.workOrders)}
            />
            <MetricCard
              icon="cal"
              tone={stats.downtimeMinutes > 600 ? 'amber' : null}
              label={t('shifts.kpi.downtime')}
              value={t('shifts.detail.minutes', { count: stats.downtimeMinutes })}
            />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <ForgeSelect
              label={t('shifts.column.shift')}
              labelInline
              size="sm"
              value={filters.type}
              onValueChange={(value) => commit({ ...filters, type: value })}
              options={[
                { value: 'all', label: t('shifts.filter.anyType') },
                ...options.types.map((type) => ({ value: type, label: t(`shifts.type.${type}`) })),
              ]}
            />
            <ForgeSelect
              label={t('shifts.column.status')}
              labelInline
              size="sm"
              value={filters.status}
              onValueChange={(value) => commit({ ...filters, status: value })}
              options={[
                { value: 'all', label: t('shifts.filter.anyStatus') },
                ...SHIFT_STATUSES.map((status) => ({
                  value: status,
                  label: t(`shifts.status.${status}`),
                })),
              ]}
            />
            {scope === 'all' ? (
              <ForgeSelect
                label={t('shifts.column.operator')}
                labelInline
                size="sm"
                value={filters.operatorId}
                onValueChange={(value) => commit({ ...filters, operatorId: value })}
                options={[
                  { value: 'all', label: t('shifts.filter.anyOperator') },
                  ...options.operators.map((person) => ({ value: person.id, label: person.name })),
                ]}
              />
            ) : null}
            {active ? (
              <ForgeButton variant="ghost" size="sm" onClick={() => commit(EMPTY)}>
                {t('shifts.clear')}
              </ForgeButton>
            ) : null}
            <span className="ms-auto text-body-sm text-ink-dim">
              <Num>{t('shifts.countOf', { shown: shifts.data.total, total: stats.shifts })}</Num>
            </span>
          </div>

          <div className="grid gap-4 [grid-template-columns:minmax(0,1fr)_minmax(300px,340px)] max-xl:grid-cols-1">
            <div className="min-w-0">
              {rows.length === 0 ? (
                <EmptyState icon="cal" title={t('shifts.emptyFiltered')} />
              ) : (
                <Panel flush className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-body-sm">
                      <thead>
                        <tr className="border-b border-hairline">
                          <Th>{t('shifts.column.date')}</Th>
                          <Th>{t('shifts.column.shift')}</Th>
                          <Th className="w-full">{t('shifts.column.operator')}</Th>
                          <Th>{t('shifts.column.time')}</Th>
                          <Th align="end">{t('shifts.column.oee')}</Th>
                          <Th align="end">{t('shifts.column.anomalies')}</Th>
                          <Th align="end">{t('shifts.column.workOrders')}</Th>
                          <Th>{t('shifts.column.status')}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const figures = shiftFigures(row)
                          return (
                          <tr
                            key={row.id}
                            onClick={() => setParam('shift', row.id)}
                            aria-selected={selected?.id === row.id}
                            className={cn(
                              'cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-sunken',
                              selected?.id === row.id && 'bg-sunken',
                              row.status === 'active' && 'stripe-green',
                            )}
                          >
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <Num>{formatShiftDate(row.date, { weekday: 'short', day: 'numeric', month: 'short' })}</Num>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className="flex items-center gap-2">
                                <Dot tone={SHIFT_TYPE_TONE[row.type]} size={6} />
                                {t(`shifts.type.${row.type}`)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">{row.operatorName}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-ink-dim">
                              <Mono className="text-micro">
                                {formatShiftTime(row.startsAt)}–{formatShiftTime(row.endsAt)}
                              </Mono>
                            </td>
                            <td className="px-3 py-2.5 text-end whitespace-nowrap">
                              <Num
                                className={
                                  figures.projected ? 'text-ink-mute italic' : 'font-semibold'
                                }
                                title={figures.projected ? plannedLabel : undefined}
                              >
                                {formatPercent(figures.oee, 1)}
                              </Num>
                            </td>
                            <td className="px-3 py-2.5 text-end whitespace-nowrap">
                              {figures.projected ? (
                                <Num className="text-ink-mute italic" title={plannedLabel}>
                                  {formatInteger(figures.anomalies)}
                                </Num>
                              ) : figures.anomalies ? (
                                <StateBadge tone="amber" dot={false}>
                                  <Num>{formatInteger(figures.anomalies)}</Num>
                                </StateBadge>
                              ) : (
                                <span className="text-ink-mute">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-end whitespace-nowrap text-ink-dim">
                              <Num
                                className={figures.projected ? 'text-ink-mute italic' : undefined}
                                title={figures.projected ? plannedLabel : undefined}
                              >
                                {formatInteger(figures.workOrders)}
                              </Num>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <StateBadge tone={SHIFT_STATE_TONE[row.status]}>
                                {t(`shifts.status.${row.status}`)}
                              </StateBadge>
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <TablePagination
                    page={page}
                    pageSize={pageSize}
                    total={shifts.data.total}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      setPageSize(size)
                      setPage(1)
                    }}
                  />
                </Panel>
              )}

              {/* Says what the muted figures are, in the same words their
                  tooltips use. Same pattern as `anomalies.analysis.demoNotice`. */}
              {rows.some((row) => shiftFigures(row).projected) ? (
                <p className="mt-2 mb-0 text-body-sm text-ink-mute italic">
                  {t('shifts.plannedNotice')}
                </p>
              ) : null}

              {/* Crew performance. Counted off the same rows, so it can never
                  report a different number of shifts for one person than the
                  table does — which the prototype's version can, because it
                  computes the strip from the scoped set and this from the
                  unscoped one. Hidden under "Just me", where it would be one row
                  restating the KPI strip above it. */}
              {scope === 'all' && shifts.data.crew.length ? (
                <Panel flush className="mt-4 overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
                    <Icon name="users" size="xs" className="text-ink-mute" />
                    <Eyebrow as="h2" className="m-0 flex-1">
                      {t('shifts.crew.title')}
                    </Eyebrow>
                    <span className="text-micro text-ink-mute">{t('shifts.crew.hint')}</span>
                  </div>
                  {/* Each person opens IN PLACE. A button rather than a click
                      handler on the row: this is the one control in the card,
                      it has to be reachable by keyboard, and `aria-expanded`
                      is what tells a screen reader the panel below belongs to
                      it. The open person is a search param, so a manager can
                      send somebody a crew member's week. */}
                  <ul className="m-0 flex list-none flex-col p-0">
                    {shifts.data.crew.map((person) => {
                      const open = crewId === person.id
                      return (
                        <li key={person.id} className="border-b border-hairline last:border-0">
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => setParam('crew', open ? null : person.id)}
                            className={cn(
                              'flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 text-start transition-colors hover:bg-sunken',
                              open && 'bg-sunken',
                            )}
                          >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sunken text-micro font-semibold text-ink-dim">
                              {person.initials}
                            </span>
                            <span className="min-w-0 flex-1 text-body-sm font-semibold">
                              {person.name}
                            </span>
                            <Num className="w-16 shrink-0 text-micro font-normal text-ink-dim">
                              {t('shifts.crew.shifts', { count: person.shifts })}
                            </Num>
                            <span className="w-28 shrink-0">
                              <Meter
                                value={person.averageOee ?? 0}
                                label={t('shifts.column.oee')}
                              />
                            </span>
                            <Num className="w-16 shrink-0 text-end text-micro font-normal text-ink-dim">
                              {t('shifts.crew.anomalies', { count: person.anomalies })}
                            </Num>
                            <Num className="w-16 shrink-0 text-end text-micro font-normal text-ink-dim">
                              {t('shifts.detail.minutes', { count: person.downtimeMinutes })}
                            </Num>
                            <Icon
                              name={open ? 'up' : 'down'}
                              size="xs"
                              className="shrink-0 text-ink-mute"
                            />
                          </button>

                          {open ? (
                            <CrewDetail
                              person={person}
                              days={shifts.data.days}
                              onFilter={() => commit({ ...filters, operatorId: person.id })}
                            />
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </Panel>
              ) : null}
            </div>

            <aside className="min-w-0">
              <ShiftDetailPanel
                shift={selected}
                onSchedule={() => setScheduling(true)}
                onHandover={() => openHandover(selected)}
              />
            </aside>
          </div>
        </>
      )}

      {handoverDialog?.mode === 'report' && handoverDialog.row?.report ? (
        <HandoverReportDialog
          open
          handover={handoverDialog.row}
          report={handoverDialog.row.report}
          pending={acknowledge.isPending}
          onClose={() => setHandoverDialog(null)}
          onEdit={() => setHandoverDialog({ mode: 'form', row: handoverDialog.row })}
          onExported={() => toast(t('handovers.toast.exported'))}
          onAcknowledge={() =>
            acknowledge.mutate(handoverDialog.row.id, {
              onSuccess: () => {
                setHandoverDialog(null)
                toast(t('handovers.toast.acknowledged'))
              },
              onError: () => toast(t('handovers.toast.failed'), 'error'),
            })
          }
        />
      ) : null}

      {handoverDialog?.mode === 'form' && handoverDialog.row?.report ? (
        <HandoverFormDialog
          open
          handover={handoverDialog.row}
          report={handoverDialog.row.report}
          people={tasks.data?.people ?? []}
          pending={publish.isPending}
          onClose={() => setHandoverDialog(null)}
          onExported={() => toast(t('handovers.toast.exported'))}
          onSubmit={(payload, incoming) =>
            publish.mutate(payload, {
              onSuccess: () => {
                setHandoverDialog(null)
                toast(
                  payload.status === 'draft'
                    ? t('handovers.toast.draftSaved')
                    : t('handovers.toast.published', { name: incoming }),
                )
              },
              onError: () => toast(t('handovers.toast.failed'), 'error'),
            })
          }
        />
      ) : null}

      <ScheduleShiftDialog
        open={scheduling}
        operators={options.operators}
        types={options.types}
        onClose={() => setScheduling(false)}
      />
    </Page>
  )
}

function Th({ children, align = 'start', className }) {
  return (
    <th
      className={cn(
        'px-3 py-2 text-eyebrow font-semibold whitespace-nowrap text-ink-dim first:ps-4 last:pe-4',
        align === 'end' ? 'text-end' : 'text-start',
        className,
      )}
    >
      {children}
    </th>
  )
}
