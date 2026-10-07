import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { ForgeSelect } from '@/components/forge/ForgeSelect'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { PAGE_SIZES, TablePagination } from '@/components/forge/TablePagination'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import {
  CONTEXT_STATUSES,
  useContextDecision,
  useFusionContext,
} from '@/features/dataFusion/context'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatInteger } from '@/lib/format'
import { ON_TINT_CLASS, TINT_CLASS } from '@/lib/tone'
import { cn } from '@/lib/cn'

/**
 * Contextualisation — the queue of objects that arrived without a home.
 *
 * DEMO. See `DEMO-MODE.md` §8.10.
 *
 * ── Accepting really places the object ────────────────────────────────────
 * A document or media suggestion writes a link into the same registry the
 * Documents screen and Asset Detail read, so accepting "Scanned drawing
 * 2019-114 → Compressor C-12" makes that drawing appear on that machine's
 * Documents tab. Without that the screen would be a list of buttons that change
 * a badge.
 *
 * ── Confidence is a score, not a decoration ───────────────────────────────
 * It comes from matching the object's own name against the codes in the
 * hierarchy, so it can be wrong, and it drops when a name has less to go on. The
 * prototype authors six fixed percentages. `verify:mocks` checks ours against
 * ground truth: every generated tag knows which asset it really came from, the
 * matcher is never shown that field, and the check asserts it recovers it.
 *
 * ── The unmatched are the real work ───────────────────────────────────────
 * They sort last and they cannot be accepted, because there is nothing to
 * accept. `SPARE_AI_07` and `IMG_4471.jpg` need a person to know what they are,
 * and a screen that pretended otherwise would be inviting somebody to confirm a
 * guess it had not made.
 */

const ALL = 'all'

export function ContextPage() {
  const { t } = useTranslation(['app', 'common'])
  useDocumentTitle(`${t('dataFusion.sections.context')} · ${t('common:brand.name')}`)

  const [kind, setKind] = useState(ALL)
  const [status, setStatus] = useState('pending')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])

  const queue = useFusionContext({ kind, status, q: query.trim() || undefined })
  const decide = useContextDecision()

  const rows = queue.data?.items ?? []
  const stats = queue.data?.stats ?? {
    pending: 0,
    accepted: 0,
    rejected: 0,
    unmatched: 0,
    avgConfidence: null,
  }
  const kinds = queue.data?.kinds ?? []

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const narrow = (setter) => (next) => {
    setter(next)
    setPage(1)
  }

  return (
    <div className="px-8 py-6 max-xl:px-5.5">
      <header className="mb-5">
        <h1 className="m-0 text-headline">{t('dataFusion.sections.context')}</h1>
        <p className="mt-2 mb-0 max-w-[72ch] text-body-sm text-ink-dim">
          {t('dataFusion.context.intro')}
        </p>
      </header>

      {queue.isPending ? (
        <SkeletonRows count={6} />
      ) : queue.isError ? (
        <ErrorState
          error={queue.error}
          title={t('dataFusion.context.loadFailed')}
          onRetry={queue.refetch}
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-4 gap-3 max-sm:grid-cols-2">
            <Stat label={t('dataFusion.context.stats.pending')} value={stats.pending} tone="amber" />
            <Stat
              label={t('dataFusion.context.stats.accepted')}
              value={stats.accepted}
              tone="green"
            />
            <Stat
              label={t('dataFusion.context.stats.unmatched')}
              value={stats.unmatched}
              sub={t('dataFusion.context.stats.unmatchedSub')}
            />
            <Stat
              label={t('dataFusion.context.stats.confidence')}
              value={
                stats.avgConfidence == null ? '—' : `${stats.avgConfidence}%`
              }
              sub={t('dataFusion.context.stats.confidenceSub')}
            />
          </div>

          <Panel flush className="mb-3.5 px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
              <div
                role="group"
                aria-label={t('dataFusion.context.filterByKind')}
                className="flex flex-wrap gap-2"
              >
                <Chip selected={kind === ALL} onClick={() => narrow(setKind)(ALL)}>
                  {t('dataFusion.context.allKinds')}
                </Chip>
                {kinds.map((entry) => (
                  <Chip
                    key={entry.id}
                    selected={kind === entry.id}
                    onClick={() => narrow(setKind)(entry.id)}
                  >
                    <Num>
                      {t('dataFusion.context.kindChip', {
                        label: t(`dataFusion.context.kind.${entry.id}`),
                        count: entry.count,
                      })}
                    </Num>
                  </Chip>
                ))}
              </div>

              <ForgeSelect
                id="context-status"
                labelHidden
                size="sm"
                label={t('dataFusion.context.filterByStatus')}
                value={status}
                onValueChange={narrow(setStatus)}
                className="w-[11rem] shrink-0"
                options={[
                  { value: ALL, label: t('dataFusion.context.allStatuses') },
                  ...CONTEXT_STATUSES.map((value) => ({
                    value,
                    label: t(`dataFusion.context.status.${value}`),
                  })),
                ]}
              />

              <div className="flex min-w-[13rem] flex-1 items-center gap-2 rounded-sm border border-hairline bg-card px-3 py-1.5 focus-within:border-forge">
                <Icon name="search" size="sm" className="text-ink-mute" />
                <label className="sr-only" htmlFor="context-search">
                  {t('dataFusion.context.searchLabel')}
                </label>
                <input
                  id="context-search"
                  value={query}
                  onChange={(event) => narrow(setQuery)(event.target.value)}
                  placeholder={t('dataFusion.context.searchPlaceholder')}
                  className="min-w-0 flex-1 border-0 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-dim"
                />
              </div>
            </div>
          </Panel>

          {rows.length === 0 ? (
            <EmptyState
              icon="check"
              title={
                status === 'pending'
                  ? t('dataFusion.context.allClear')
                  : t('dataFusion.context.noMatch')
              }
              body={
                status === 'pending'
                  ? t('dataFusion.context.allClearBody')
                  : t('dataFusion.context.noMatchBody')
              }
            />
          ) : (
            <Panel flush className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <caption className="sr-only">{t('dataFusion.context.tableCaption')}</caption>
                  <thead>
                    <tr>
                      {['object', 'kind', 'source', 'match', 'confidence', 'status'].map(
                        (column) => (
                          <th
                            key={column}
                            scope="col"
                            className="eyebrow bg-sunken px-3.5 py-2.5 text-start whitespace-nowrap"
                          >
                            {t(`dataFusion.context.columns.${column}`)}
                          </th>
                        ),
                      )}
                      <th scope="col" className="bg-sunken px-3.5 py-2.5">
                        <span className="sr-only">
                          {t('dataFusion.context.columns.actions')}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((item) => (
                      <tr key={item.id} className="border-t border-subtle hover:bg-sunken">
                        <td className="max-w-[24rem] px-3.5 py-2.5">
                          <Mono className="text-body-sm text-ink">{item.label}</Mono>
                        </td>
                        <td className="px-3.5 py-2.5 text-body-sm text-ink-dim">
                          {t(`dataFusion.context.kind.${item.kind}`)}
                        </td>
                        <td className="px-3.5 py-2.5 text-body-sm text-ink-dim">
                          {item.sourceName}
                        </td>
                        <td className="px-3.5 py-2.5">
                          {item.suggestion ? (
                            <span className="inline-flex items-center gap-1.5 rounded-pill bg-sunken px-2 py-[2px] text-micro font-normal whitespace-nowrap text-ink-dim">
                              <Icon
                                name={MATCH_ICON[item.suggestion.kind]}
                                size="xs"
                                className="text-ink-mute"
                              />
                              {item.suggestion.name}
                            </span>
                          ) : (
                            <span className="text-micro font-normal text-ink-mute italic">
                              {t('dataFusion.context.noSuggestion')}
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <Confidence value={item.suggestion?.confidence ?? null} />
                        </td>
                        <td className="px-3.5 py-2.5">
                          <StatusPill status={item.status} />
                        </td>
                        <td className="px-3.5 py-2.5 text-end whitespace-nowrap">
                          <Actions
                            item={item}
                            busy={decide.isPending}
                            onDecide={(decision) => decide.mutate({ id: item.id, decision })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <TablePagination
                total={rows.length}
                page={currentPage}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
                label={t('dataFusion.context.rowNoun')}
              />
            </Panel>
          )}
        </>
      )}
    </div>
  )
}

const MATCH_ICON = { asset: 'factory', line: 'gauge', site: 'map' }

function Stat({ label, value, sub, tone = null }) {
  return (
    <div className="rounded-sm border border-hairline bg-card px-4 py-3 shadow-edge">
      <Eyebrow>{label}</Eyebrow>
      <p
        className={cn(
          'mt-1.5 mb-0 text-title leading-none',
          tone ? ON_TINT_CLASS[tone] : 'text-ink',
        )}
      >
        <Num>{typeof value === 'number' ? formatInteger(value) : value}</Num>
      </p>
      {sub ? <p className="mt-1 mb-0 text-micro font-normal text-ink-dim">{sub}</p> : null}
    </div>
  )
}

/**
 * The score, as a bar and a figure.
 *
 * Both, for the reason `Meter` gives: length at this size is worth about ±10 to
 * the eye, and the number beside it is what makes one row comparable to the next.
 * The bands are the ones the actions use — above 90 is a confirmation, below 60
 * is a question — so the colour is telling the reader which kind of decision
 * this row is before they read the figure.
 */
function Confidence({ value }) {
  const { t } = useTranslation('app')
  if (value == null) return <span className="text-ink-mute">—</span>

  const tone = value >= 90 ? 'green' : value >= 60 ? 'amber' : 'red'
  return (
    <span className="inline-flex items-center gap-2">
      <span
        role="meter"
        aria-label={t('dataFusion.context.confidenceLabel', { percent: value })}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        className="inline-block h-1.5 w-11 shrink-0 overflow-hidden rounded-pill bg-sunken"
      >
        <span
          className="block h-full rounded-pill"
          style={{ inlineSize: `${value}%`, background: `var(--hue-${tone})` }}
        />
      </span>
      <Num className={cn('text-body-sm font-semibold', ON_TINT_CLASS[tone])}>{value}%</Num>
    </span>
  )
}

const STATUS_TONE = { pending: null, accepted: 'green', rejected: 'red' }

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
      {t(`dataFusion.context.status.${status}`)}
    </span>
  )
}

/**
 * What can be done to a row.
 *
 * Accept is only offered when there is something to accept — an unmatched object
 * has no suggestion, and a button that confirmed a guess nobody made would be
 * the worst control on the screen. A decided row offers one thing: putting it
 * back, because a reviewer who clicks the wrong button on a queue of forty needs
 * that more than they need any other affordance here.
 */
function Actions({ item, busy, onDecide }) {
  const { t } = useTranslation('app')

  if (item.status !== 'pending') {
    return (
      <ForgeButton size="sm" disabled={busy} onClick={() => onDecide('pending')}>
        {t('dataFusion.context.undo')}
      </ForgeButton>
    )
  }

  return (
    <span className="inline-flex gap-1.5">
      {item.suggestion ? (
        <ForgeButton
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => onDecide('accepted')}
        >
          {t('dataFusion.context.accept')}
        </ForgeButton>
      ) : null}
      <ForgeButton size="sm" disabled={busy} onClick={() => onDecide('rejected')}>
        {t(item.suggestion ? 'dataFusion.context.reject' : 'dataFusion.context.dismiss')}
      </ForgeButton>
    </span>
  )
}
