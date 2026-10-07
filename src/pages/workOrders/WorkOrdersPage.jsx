import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { Chip } from '@/components/forge/Chip'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { Num } from '@/components/forge/primitives'
import { WO_PRIORITIES, WO_STATES } from '@/features/workOrders/api'
import {
  useAdvanceWorkOrder,
  useCreateWorkOrder,
  useDeleteWorkOrder,
  useUpdateWorkOrder,
  useWorkOrderBoard,
} from '@/features/workOrders/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useToast } from '@/providers/ToastProvider'
import { formatInteger } from '@/lib/format'
import { WorkOrderBoard } from './WorkOrderBoard'
import { WorkOrderDetailDialog } from './WorkOrderDetailDialog'
import { WorkOrderFormDialog } from './WorkOrderFormDialog'
import { WorkOrderTable } from './WorkOrderTable'

/**
 * Work Orders.
 *
 * DEMO. See `DEMO-MODE.md` §8.7. Board and table over one collection, with the
 * detail and form dialogs.
 *
 * ── The view and the open order live in the URL ───────────────────────────
 * `?view=table`, `?wo=WO-7734`, `?new=1`. So a colleague can be sent to one work
 * order, and — the reason this module was built next — the Timeseries
 * Workstation and the asset screens can link straight into a prefilled New WO
 * form. The prototype keeps all of it in `useState`, so its board cannot be
 * linked to at all.
 *
 * ── The stat strip is counted, not authored ───────────────────────────────
 * Over the whole collection rather than the filtered set, so "3 overdue" does
 * not become "0 overdue" the moment somebody filters to Completed. The column
 * counts on the board are the opposite — those describe the board in front of
 * you. Different questions, and each is answered where it is asked.
 */

/** What the filters start from and what Clear returns to. */
const EMPTY = { state: 'all', priority: 'all', assigneeId: 'all', source: 'all' }

export function WorkOrdersPage() {
  const { t } = useTranslation(['app', 'common'])
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useToast()

  const view = searchParams.get('view') === 'table' ? 'table' : 'board'
  const openId = searchParams.get('wo')

  const [filters, setFilters] = useState(EMPTY)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)

  useDocumentTitle(`${t('workOrders.title')} · ${t('common:brand.name')}`)

  const params = useMemo(
    () => ({
      ...filters,
      q: query.trim() || undefined,
      // A board shows every card; a table pages. Same split as the floor map.
      paged: view === 'table',
      page,
      pageSize,
    }),
    [filters, query, view, page, pageSize],
  )

  const board = useWorkOrderBoard(params)
  const create = useCreateWorkOrder()
  const update = useUpdateWorkOrder()
  const advance = useAdvanceWorkOrder()
  const remove = useDeleteWorkOrder()

  const orders = board.data?.items ?? []
  const stats = board.data?.stats ?? { open: 0, ai: 0 }
  const options = board.data?.options ?? { assignees: [], assets: [] }

  /* An order named in the URL. Found in the loaded set rather than fetched
     separately — the board already holds it, and a second request for a record
     on screen is a spinner over data we have. If a filter hides it, the param is
     dropped rather than left pointing at nothing. */
  const open = openId ? (orders.find((order) => order.id === openId) ?? null) : null
  useEffect(() => {
    if (openId && !board.isPending && !open) setParam('wo', null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, open, board.isPending])

  /* A prefilled New WO, arrived at from another module. `?new=1&assetId=…` is
     what the Workstation's insight banner and the asset screens link to. */
  const prefill = useMemo(() => {
    if (!searchParams.get('new')) return null
    return {
      assetId: searchParams.get('assetId') ?? '',
      alertId: searchParams.get('alertId') ?? null,
      title: searchParams.get('title') ?? '',
      priority: WO_PRIORITIES.includes(searchParams.get('priority'))
        ? searchParams.get('priority')
        : 'medium',
    }
  }, [searchParams])

  function setParam(key, value) {
    setSearchParams((previous) => {
      const url = new URLSearchParams(previous)
      if (value) url.set(key, value)
      else url.delete(key)
      return url
    })
  }

  const closeForm = () => {
    setCreating(false)
    setEditing(null)
    if (searchParams.get('new')) {
      setSearchParams((previous) => {
        const url = new URLSearchParams(previous)
        for (const key of ['new', 'assetId', 'alertId', 'title', 'priority']) url.delete(key)
        return url
      })
    }
  }

  const commit = (next) => {
    setFilters(next)
    // Any change to what is being asked for returns to page one. Without this a
    // filter that leaves four rows strands the reader on page three of nothing.
    setPage(1)
  }

  const move = async (order, state) => {
    await advance.mutateAsync({ id: order.id, state })
    toast(
      t('workOrders.moved', { id: order.id, state: t(`workOrders.state.${state}`) }),
      'ok',
    )
  }

  const activeFilters = Object.values(filters).filter((value) => value !== 'all').length

  return (
    <Page>
      <header className="mb-4 flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-display text-balance">{t('workOrders.title')}</h1>
          <p className="mt-2 mb-0 text-body text-ink-dim">
            <Num>
              {t('workOrders.subtitle', {
                open: formatInteger(stats.open),
                ai: formatInteger(stats.ai),
              })}
            </Num>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label={t('workOrders.viewLabel')}
            className="flex gap-[3px] rounded-md bg-sunken p-[3px]"
          >
            {['board', 'table'].map((entry) => (
              <button
                key={entry}
                type="button"
                aria-pressed={view === entry}
                onClick={() => setParam('view', entry === 'board' ? null : entry)}
                className={
                  view === entry
                    ? 'rounded-xs bg-forge px-3 py-1 text-body-sm font-semibold text-white'
                    : 'rounded-xs px-3 py-1 text-body-sm text-ink-dim transition-colors hover:text-ink'
                }
              >
                {t(`workOrders.view.${entry}`)}
              </button>
            ))}
          </div>
          <ForgeButton variant="primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size="xs" />
            {t('workOrders.new')}
          </ForgeButton>
        </div>
      </header>

      {/* No KPI strip. The design carries these counts in the SUBTITLE — "8
          open · 4 AI-generated" — and putting them in four cards as well says
          the same thing twice, on the screen where the board's own column
          headers are already counting. Open and AI-drafted stay in the
          subtitle; urgent and overdue are what the priority filter and the
          overdue badge on a card are for. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ForgeSelect
          label={t('workOrders.column.status')}
          labelInline
          size="sm"
          value={filters.state}
          onValueChange={(value) => commit({ ...filters, state: value })}
          options={[
            { value: 'all', label: t('workOrders.filter.anyState') },
            ...WO_STATES.map((state) => ({ value: state, label: t(`workOrders.state.${state}`) })),
          ]}
        />
        <ForgeSelect
          label={t('workOrders.column.priority')}
          labelInline
          size="sm"
          value={filters.priority}
          onValueChange={(value) => commit({ ...filters, priority: value })}
          options={[
            { value: 'all', label: t('workOrders.filter.anyPriority') },
            ...WO_PRIORITIES.map((p) => ({ value: p, label: t(`workOrders.priority.${p}`) })),
          ]}
        />
        <ForgeSelect
          label={t('workOrders.column.assignee')}
          labelInline
          size="sm"
          value={filters.assigneeId}
          onValueChange={(value) => commit({ ...filters, assigneeId: value })}
          options={[
            { value: 'all', label: t('workOrders.filter.anyAssignee') },
            ...options.assignees.map((person) => ({ value: person.id, label: person.name })),
          ]}
        />
        <div role="group" aria-label={t('workOrders.column.source')} className="flex gap-1.5">
          {['all', 'ai', 'human'].map((source) => (
            <Chip
              key={source}
              selected={filters.source === source}
              onClick={() => commit({ ...filters, source })}
            >
              {t(`workOrders.filter.source.${source}`)}
            </Chip>
          ))}
        </div>

        <label className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-2 focus-within:border-forge sm:max-w-[18rem]">
          <Icon name="search" size="sm" className="shrink-0 text-ink-mute" />
          <span className="sr-only">{t('workOrders.search')}</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder={t('workOrders.searchPlaceholder')}
            className="w-full border-0 bg-transparent text-body text-ink outline-none placeholder:text-ink-dim"
          />
        </label>

        {activeFilters || query.trim() ? (
          <ForgeButton
            variant="ghost"
            size="sm"
            onClick={() => {
              commit(EMPTY)
              setQuery('')
            }}
          >
            {t('workOrders.clear')}
          </ForgeButton>
        ) : null}
      </div>

      {board.isError ? (
        <ErrorState
          error={board.error}
          title={t('workOrders.loadFailed')}
          onRetry={() => board.refetch()}
        />
      ) : board.isPending ? (
        <SkeletonRows count={5} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon="wrench"
          title={t('workOrders.emptyTitle')}
          body={t('workOrders.emptyBody')}
          action={
            <ForgeButton variant="primary" onClick={() => setCreating(true)}>
              <Icon name="plus" size="xs" />
              {t('workOrders.new')}
            </ForgeButton>
          }
        />
      ) : view === 'board' ? (
        <WorkOrderBoard
          orders={orders}
          columns={board.data?.columns ?? {}}
          advancing={advance.isPending ? advance.variables?.id : null}
          onOpen={(order) => setParam('wo', order.id)}
          onAdvance={(order) => move(order, order.nextState)}
        />
      ) : (
        <WorkOrderTable
          orders={orders}
          total={board.data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size)
            setPage(1)
          }}
          onOpen={(order) => setParam('wo', order.id)}
        />
      )}

      <WorkOrderDetailDialog
        order={open}
        pending={advance.isPending || remove.isPending}
        onClose={() => setParam('wo', null)}
        onAdvance={async (order) => {
          await move(order, order.nextState)
        }}
        onHold={async (order) => {
          await move(order, 'onHold')
        }}
        onEdit={(order) => {
          setParam('wo', null)
          setEditing(order)
        }}
        onDelete={async (order) => {
          await remove.mutateAsync(order.id)
          setParam('wo', null)
          toast(t('workOrders.deleted', { id: order.id }), 'ok')
        }}
      />

      {/* Keyed so the draft reinitialises when the dialog is opened on a
          different order — see the note in the component. */}
      <WorkOrderFormDialog
        key={editing?.id ?? prefill?.assetId ?? (creating ? 'new' : 'closed')}
        open={creating || Boolean(prefill) || Boolean(editing)}
        order={editing}
        prefill={prefill}
        assets={options.assets}
        assignees={options.assignees}
        pending={create.isPending || update.isPending}
        onClose={closeForm}
        onSubmit={async (body) => {
          if (editing) {
            await update.mutateAsync({ id: editing.id, ...body })
            toast(t('workOrders.saved', { id: editing.id }), 'ok')
          } else {
            const made = await create.mutateAsync(body)
            toast(t('workOrders.created', { id: made.id }), 'ok')
            setParam('wo', made.id)
          }
          closeForm()
        }}
      />
    </Page>
  )
}
