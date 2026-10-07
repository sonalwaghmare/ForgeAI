import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { Num } from '@/components/forge/primitives'
import {
  PIPELINE_STATUSES,
  useFusionPipelines,
  usePipelineAction,
} from '@/features/dataFusion/pipelines'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatInteger, formatRelative } from '@/lib/format'
import { ON_TINT_CLASS, STRIPE_CLASS, TINT_CLASS } from '@/lib/tone'
import { cn } from '@/lib/cn'

/**
 * Pipelines — what moves between a source and somewhere in this product.
 *
 * DEMO. See `DEMO-MODE.md` §8.10.
 *
 * ── A pipeline cannot be running off a source that has stopped ────────────
 * The rule this screen exists to make visible, and it is derived rather than
 * authored: status falls out of the source's own state. The design leaves one
 * pipeline Active beside a connection its own table marks Disconnected, which is
 * exactly the disagreement nobody catches.
 *
 * A stall and a failure are told apart, because they send somebody to different
 * places. "Stalled — Weißenthurm OT is disconnected" is a connection to fix;
 * "OCR confidence below threshold" is the pipeline itself.
 *
 * ── Run clears a failure, never a stall ───────────────────────────────────
 * Re-running is what clears a pipeline's own error. It does not clear a stall:
 * the source is still down, and letting somebody turn a red row green while the
 * connection behind it is disconnected would be teaching them to ignore the row.
 */

const ALL = 'all'

export function PipelinesPage() {
  const { t, i18n } = useTranslation(['app', 'common'])
  useDocumentTitle(`${t('dataFusion.sections.pipelines')} · ${t('common:brand.name')}`)

  const [status, setStatus] = useState(ALL)
  const [query, setQuery] = useState('')

  const pipelines = useFusionPipelines({ status, q: query.trim() || undefined })
  const act = usePipelineAction()

  const rows = pipelines.data?.items ?? []
  const stats = pipelines.data?.stats ?? {
    total: 0,
    active: 0,
    failed: 0,
    stalled: 0,
    paused: 0,
  }

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <header className="mb-4">
        <h1 className="m-0 text-headline">{t('dataFusion.sections.pipelines')}</h1>
        <p className="mt-2 mb-0 max-w-[72ch] text-body-sm text-ink-dim">
          <Num>
            {t('dataFusion.pipelines.summary', {
              active: stats.active,
              failed: stats.failed,
              stalled: stats.stalled,
              paused: stats.paused,
            })}
          </Num>
        </p>
        {/* No "+ New pipeline". A builder that chose a source, a target, a
            schedule and a list of transforms would be configuring something
            nothing runs — and unlike an uploaded document, a pipeline that does
            not execute has no observable effect to stand in for the real one. */}
      </header>

      {pipelines.isPending ? (
        <SkeletonRows count={6} />
      ) : pipelines.isError ? (
        <ErrorState
          error={pipelines.error}
          title={t('dataFusion.pipelines.loadFailed')}
          onRetry={pipelines.refetch}
        />
      ) : (
        <>
          <Panel flush className="mb-3.5 px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <div className="flex min-w-[14rem] flex-1 items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-1.5 focus-within:border-forge">
                <Icon name="search" size="sm" className="text-ink-mute" />
                <label className="sr-only" htmlFor="pipeline-search">
                  {t('dataFusion.pipelines.searchLabel')}
                </label>
                <input
                  id="pipeline-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('dataFusion.pipelines.searchPlaceholder')}
                  className="min-w-0 flex-1 border-0 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-dim"
                />
              </div>
              <ForgeSelect
                id="pipeline-status"
                labelHidden
                size="sm"
                label={t('dataFusion.pipelines.filterByStatus')}
                value={status}
                onValueChange={setStatus}
                className="w-[12rem] shrink-0"
                options={[
                  { value: ALL, label: t('dataFusion.pipelines.allStatuses') },
                  ...PIPELINE_STATUSES.map((value) => ({
                    value,
                    label: t(`dataFusion.pipelines.status.${value}`),
                  })),
                ]}
              />
            </div>
          </Panel>

          {rows.length === 0 ? (
            <EmptyState
              icon="search"
              title={t('dataFusion.pipelines.noMatch')}
              body={t('dataFusion.pipelines.noMatchBody')}
              action={
                status !== ALL || query.trim() ? (
                  <ForgeButton
                    onClick={() => {
                      setStatus(ALL)
                      setQuery('')
                    }}
                  >
                    {t('common:actions.clearFilters')}
                  </ForgeButton>
                ) : null
              }
            />
          ) : (
            <Panel flush className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <caption className="sr-only">{t('dataFusion.pipelines.tableCaption')}</caption>
                  <thead>
                    <tr>
                      {['pipeline', 'source', 'target', 'records', 'schedule', 'lastRun', 'status'].map(
                        (column) => (
                          <th
                            key={column}
                            scope="col"
                            className={cn(
                              'eyebrow bg-sunken px-3.5 py-2.5 whitespace-nowrap',
                              column === 'records' ? 'text-end' : 'text-start',
                            )}
                          >
                            {t(`dataFusion.pipelines.columns.${column}`)}
                          </th>
                        ),
                      )}
                      <th scope="col" className="bg-sunken px-3.5 py-2.5">
                        <span className="sr-only">
                          {t('dataFusion.pipelines.columns.actions')}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className={cn(
                          'border-t border-subtle hover:bg-sunken',
                          // The earned leading edge: only on a row that is not
                          // moving anything. A stripe on every row is a stripe
                          // that says nothing.
                          row.status === 'failed' && STRIPE_CLASS.red,
                          row.status === 'stalled' && STRIPE_CLASS.amber,
                        )}
                      >
                        <td className="px-3.5 py-2.5">
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-body-sm font-semibold text-ink" translate="no">
                              {row.name}
                            </span>
                            <Reason row={row} />
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-body-sm text-ink-dim">
                          {row.sourceName ?? <Dash />}
                        </td>
                        <td className="px-3.5 py-2.5">
                          {/* A target that cannot be opened was never a target. */}
                          <Link
                            to={row.targetHref}
                            className="text-body-sm text-ink-dim transition-colors hover:text-on-forge"
                          >
                            {t(`dataFusion.pipelines.target.${row.target}`)}
                          </Link>
                        </td>
                        <td className="px-3.5 py-2.5 text-end">
                          {row.records ? (
                            <Num className="text-body-sm">
                              {row.recordsUnit === 'perMinute'
                                ? t('dataFusion.pipelines.perMinute', {
                                    count: formatInteger(row.records),
                                  })
                                : formatInteger(row.records)}
                            </Num>
                          ) : (
                            <Dash />
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-body-sm text-ink-dim">
                          {t(`dataFusion.pipelines.schedule.${row.schedule}`)}
                        </td>
                        <td className="px-3.5 py-2.5 text-body-sm text-ink-dim">
                          <time dateTime={row.lastRunAt}>
                            {formatRelative(new Date(row.lastRunAt), i18n.language)}
                          </time>
                          {row.overdue ? (
                            <span className="ms-1.5 text-micro font-semibold text-on-amber">
                              {t('dataFusion.pipelines.overdue')}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <StatusPill status={row.status} />
                        </td>
                        <td className="px-3.5 py-2.5 text-end whitespace-nowrap">
                          <span className="inline-flex gap-1.5">
                            {/* Running a stalled pipeline is not offered: the
                                source is down and the run would fail the same
                                way. Fix the connection is the only useful
                                action, and the row says which one. */}
                            {row.status !== 'stalled' ? (
                              <ForgeButton
                                size="sm"
                                variant={row.status === 'failed' ? 'primary' : undefined}
                                disabled={act.isPending}
                                onClick={() => act.mutate({ id: row.id, action: 'run' })}
                              >
                                {t('dataFusion.pipelines.run')}
                              </ForgeButton>
                            ) : null}
                            <ForgeButton
                              size="sm"
                              disabled={act.isPending}
                              onClick={() =>
                                act.mutate({
                                  id: row.id,
                                  action: row.status === 'paused' ? 'resume' : 'pause',
                                })
                              }
                            >
                              {t(
                                row.status === 'paused'
                                  ? 'dataFusion.pipelines.resume'
                                  : 'dataFusion.pipelines.pause',
                              )}
                            </ForgeButton>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Why a pipeline is not moving anything.
 *
 * A stall names the connection, because that is where the fix is. A failure
 * names the fault, because that is where the fix is. Saying only "Failed" would
 * make somebody open both.
 */
function Reason({ row }) {
  const { t } = useTranslation('app')

  if (row.status === 'stalled') {
    return (
      <span className="text-micro font-normal text-on-amber">
        {t('dataFusion.pipelines.stalledBy', { source: row.stalledBy })}
      </span>
    )
  }
  if (row.error) {
    return (
      <span className="text-micro font-normal text-on-red">
        {t(`dataFusion.pipelines.error.${row.error}`)}
      </span>
    )
  }
  return null
}

const STATUS_TONE = { active: 'green', failed: 'red', stalled: 'amber', paused: null }

function StatusPill({ status }) {
  const { t } = useTranslation('app')
  const tone = STATUS_TONE[status]
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-pill px-2.5 py-[3px] text-micro whitespace-nowrap',
        tone ? cn(TINT_CLASS[tone], ON_TINT_CLASS[tone]) : 'bg-sunken text-ink-dim',
      )}
    >
      {t(`dataFusion.pipelines.status.${status}`)}
    </span>
  )
}

/** A value the pipeline does not report. Never an empty cell. */
function Dash() {
  return <span className="text-ink-mute">—</span>
}
