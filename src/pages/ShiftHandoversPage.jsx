import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page } from '@/shell/AppShell'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { TablePagination } from '@/components/forge/TablePagination'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { Mono, Num } from '@/components/forge/primitives'
import { HANDOVER_STATUSES } from '@/features/handovers/api'
import { useAcknowledgeHandover, useHandoverMutation, useHandovers } from '@/features/handovers/queries'
import { useTasks } from '@/features/tasks/queries'
import { useToast } from '@/providers/ToastProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatInteger, formatPercent } from '@/lib/format'
import { HandoverFormDialog, HandoverReportDialog } from './home/HandoverDialogs'

/**
 * Shift Handovers — the archive.
 *
 * DEMO. Reachable from the handover card on Home and, later, from Shifts. It is
 * not in the nav rail, and that is the prototype's arrangement too: a handover
 * belongs to a shift, so you reach the archive from the shift, not from a
 * top-level menu item competing with Anomalies.
 *
 * Filtering and paging are client-side. That is correct for what this is — a
 * seven-row fixture behind a rollup that describes 418 records — and the moment
 * the endpoint is real both move into the query, which is why the state is
 * already shaped as a params object rather than scattered.
 */

const PAGE_SIZES = [10, 25, 50, 100]

export function ShiftHandoversPage() {
  const { t } = useTranslation(['app', 'common'])
  const { toast } = useToast()

  const handovers = useHandovers()
  const tasks = useTasks()
  const publish = useHandoverMutation()
  const acknowledge = useAcknowledgeHandover()

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [dialog, setDialog] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useDocumentTitle(`${t('screens.handovers')} · ${t('common:brand.name')}`)

  /* Memoised because two other memos depend on it: `?? []` makes a fresh array
     on every render, so without this both of them recompute every time. */
  const items = useMemo(() => handovers.data?.items ?? [], [handovers.data])
  const stats = handovers.data?.stats

  /* `?handover=HND-…` opens that report and `?create=1` opens the draft form.
     Added when Shifts landed: a shift's detail panel links straight to the
     handover that closed it, and a dialog held only in `useState` cannot be
     linked to.

     DERIVED rather than pushed into state by an effect. An effect that calls
     `setDialog` during render is a cascading render, and it also fights the
     close button — the param is still in the URL, so the dialog reopens. Here
     the URL opens it, `dismissed` closes it, and the close handler clears the
     param so a reload does not bring it back. */
  const [dismissed, setDismissed] = useState(false)
  const linked = useMemo(() => {
    if (dismissed || !items.length) return null
    // `?create=1` drafts a new one against the most recent record; `?handover=X`
    // opens X's report, and `&edit=1` opens X in the form instead. Shifts links
    // to all three, and which one it picks depends on whether that shift's
    // handover exists and whether it is still a draft.
    if (searchParams.get('create')) return { mode: 'form', row: items[0] }
    const wanted = searchParams.get('handover')
    if (!wanted) return null
    const row = items.find((entry) => entry.id === wanted)
    if (!row) return null
    return { mode: searchParams.get('edit') ? 'form' : 'report', row }
  }, [dismissed, items, searchParams])

  const openDialog = dialog ?? linked

  const closeDialog = () => {
    setDialog(null)
    setDismissed(true)
    setSearchParams(
      (previous) => {
        const url = new URLSearchParams(previous)
        for (const key of ['handover', 'create', 'edit', 'shift']) url.delete(key)
        return url
      },
      { replace: true },
    )
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((row) => {
      if (status !== 'all' && row.status !== status) return false
      if (!needle) return true
      return [row.id, row.outgoing, row.incoming, row.date].join(' ').toLowerCase().includes(needle)
    })
  }, [items, query, status])

  // A filter that leaves fewer pages than the one you are on must not strand you
  // on an empty page.
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const statCards = stats
    ? [
        ['total', formatInteger(stats.total), t('handovers.history.totalSub')],
        ['week', formatInteger(stats.thisWeek), t('handovers.history.weekSub', { count: stats.perDay })],
        ['oee', formatPercent(stats.averageOee), t('handovers.history.oeeSub', { count: stats.averageOverShifts })],
        ['pending', formatInteger(stats.pendingActions), t('handovers.history.pendingSub')],
      ]
    : []

  const openReport = (row) => setDialog({ mode: 'report', row })

  return (
    <Page>
      <div className="mb-4">
        <ForgeButton asChild>
          <Link to="/app/home">
            <Icon name="right" size="xs" className="rotate-180 rtl:rotate-0" />
            {t('common:actions.back')}
          </Link>
        </ForgeButton>
      </div>

      <header className="mb-6 flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-display text-balance">{t('handovers.title')}</h1>
          <p className="mt-2 mb-0 text-body text-ink-dim">
            {t('handovers.subtitle', { site: 'Findlay Plant' })}
          </p>
        </div>
        <ForgeButton
          variant="primary"
          disabled={!items.length}
          onClick={() => setDialog({ mode: 'form', row: items[0] })}
        >
          <Icon name="ai" size="xs" />
          {t('handovers.card.create')}
        </ForgeButton>
      </header>

      {stats ? (
        <dl className="m-0 mb-5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
          {statCards.map(([key, value, caption]) => (
            <Panel key={key} as="div">
              <dt className="eyebrow">{t(`handovers.history.${key}`)}</dt>
              <dd className="m-0 mt-1.5">
                <Num className="block text-metric-sm">{value}</Num>
                <span className="mt-1 block text-micro font-normal text-ink-dim">{caption}</span>
              </dd>
            </Panel>
          ))}
        </dl>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex min-w-[16rem] flex-1 items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-2 focus-within:border-forge sm:max-w-[22rem]">
          <Icon name="search" size="sm" className="shrink-0 text-ink-mute" />
          <span className="sr-only">{t('common:actions.search')}</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPage(1)
            }}
            placeholder={t('handovers.history.searchPlaceholder')}
            className="w-full border-0 bg-transparent text-body text-ink outline-none placeholder:text-ink-dim"
          />
        </label>

        <ForgeSelect
          label={t('handovers.report.carriedColumns.state')}
          labelInline
          size="sm"
          value={status}
          onValueChange={(next) => {
            setStatus(next)
            setPage(1)
          }}
          options={[
            { value: 'all', label: t('handovers.history.statusAll') },
            ...HANDOVER_STATUSES.map((value) => ({
              value,
              label: t(`handovers.status.${value}`),
            })),
          ]}
        />

        <span className="ms-auto text-body-sm text-ink-dim">
          {t('handovers.history.count', { count: filtered.length })}
        </span>
      </div>

      {handovers.isPending ? (
        <SkeletonRows count={6} />
      ) : handovers.isError ? (
        <ErrorState
          error={handovers.error}
          title={t('handovers.loadFailed')}
          onRetry={() => handovers.refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon="cal" />
      ) : (
        <Panel flush>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-body-sm">
              <thead>
                <tr className="bg-sunken">
                  {['id', 'shift', 'date', 'people', 'oee', 'alerts', 'pending', 'status'].map(
                    (column) => (
                      <th
                        key={column}
                        scope="col"
                        className="eyebrow border-b border-hairline px-4 py-2.5 text-start whitespace-nowrap"
                      >
                        {t(`handovers.history.columns.${column}`)}
                      </th>
                    ),
                  )}
                  <th scope="col" className="border-b border-hairline px-4 py-2.5">
                    <span className="sr-only">{t('common:actions.viewDetails')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-subtle last:border-b-0 even:bg-row-alt">
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => openReport(row)}
                        className="text-start hover:text-on-forge"
                      >
                        <Mono className="font-semibold">{row.id}</Mono>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-ink-dim">
                      {t('handovers.shiftPair', {
                        from: t(`common:shiftShort.${row.from}`),
                        to: t(`common:shiftShort.${row.to}`),
                      })}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-ink-dim">
                      <span className="block">{row.date}</span>
                      <Num className="block text-micro">{row.window}</Num>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-ink-dim">
                      {row.outgoing} <span className="text-ink-mute">→</span> {row.incoming}
                    </td>
                    <td className="px-4 py-2.5">
                      <Num>{formatPercent(row.oee)}</Num>
                    </td>
                    <td className="px-4 py-2.5 text-ink-dim">
                      <Num>
                        {t('handovers.stats.alertsValue', {
                          critical: row.criticalCarried,
                          high: row.highCarried,
                        })}
                      </Num>
                    </td>
                    <td className="px-4 py-2.5">
                      <Num>{formatInteger(row.pending)}</Num>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-pill bg-sunken px-2.5 py-0.5 text-micro text-ink-dim">
                        {t(`handovers.status.${row.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-end">
                      <ForgeButton size="sm" onClick={() => openReport(row)}>
                        <span className="sr-only">{t('handovers.history.open', { id: row.id })}</span>
                        <Icon name="right" size="xs" className="mirror-rtl" />
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
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            label={t('handovers.history.rowsLabel')}
          />
        </Panel>
      )}

      {openDialog?.mode === 'report' && openDialog.row?.report ? (
        <HandoverReportDialog
          open
          handover={openDialog.row}
          report={openDialog.row.report}
          pending={acknowledge.isPending}
          onClose={closeDialog}
          onEdit={() => setDialog({ mode: 'form', row: openDialog.row })}
          onExported={() => toast(t('handovers.toast.exported'))}
          onAcknowledge={() =>
            acknowledge.mutate(openDialog.row.id, {
              onSuccess: () => {
                setDialog(null)
                toast(t('handovers.toast.acknowledged'))
              },
              onError: () => toast(t('handovers.toast.failed'), 'error'),
            })
          }
        />
      ) : null}

      {openDialog?.mode === 'form' && openDialog.row?.report ? (
        <HandoverFormDialog
          open
          handover={openDialog.row}
          report={openDialog.row.report}
          people={tasks.data?.people ?? []}
          pending={publish.isPending}
          onClose={closeDialog}
          onExported={() => toast(t('handovers.toast.exported'))}
          onSubmit={(payload, incoming) =>
            publish.mutate(payload, {
              onSuccess: () => {
                setDialog(null)
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
    </Page>
  )
}
