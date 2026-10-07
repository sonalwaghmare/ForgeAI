import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { StateBadge } from '@/components/forge/StatusBadge'
import { ErrorState, SkeletonRows } from '@/components/forge/States'
import { Dot, Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { useShifts } from '@/features/shifts/queries'
import { formatInteger, formatPercent } from '@/lib/format'
import { SHIFT_STATE_TONE, SHIFT_TYPE_TONE } from '@/lib/tone'
import { cn } from '@/lib/cn'
import { shiftFigures } from './projectedFigures'
import { formatShiftDate, formatShiftTime } from './shiftClock'

/**
 * One crew member, opened in place inside the Crew Performance card.
 *
 * DEMO. The rollup answers "how did each person's span go" and stops there, so
 * a row that reads 6 shifts · 71% · 4 anomalies leaves the obvious next
 * question — WHICH shifts — with nowhere to go. This opens underneath the row
 * it belongs to rather than navigating away, because the comparison the reader
 * came for is against the other people in the list, and a route change takes
 * that off the screen.
 *
 * ── It asks for the person's own shifts ───────────────────────────────────
 * Not a client-side filter of the table's page: the table pages at ten and the
 * rollup is computed over the whole span, so filtering what is on screen would
 * list three of somebody's six shifts under a heading that says six. The
 * request carries the span the response actually chose (`days`), so the rows
 * here and the figures in the row above are drawn from the same window.
 *
 * The three columns run through `shiftFigures`, the same resolver the main
 * table uses, so a scheduled shift reads as a plan in both places rather than
 * as a number here and a dash there.
 */
export function CrewDetail({ person, days, onFilter }) {
  const { t } = useTranslation(['app', 'common'])

  const shifts = useShifts({
    operatorId: person.id,
    days,
    page: 1,
    /* The whole span, not a page. This is a person's roster, and a roster with
       a pager inside a card is a control nobody expects to find there. */
    pageSize: 500,
  })

  const rows = shifts.data?.items ?? []

  const stats = [
    ['shifts', formatInteger(person.shifts)],
    ['oee', person.averageOee == null ? '—' : formatPercent(person.averageOee, 1)],
    ['anomalies', formatInteger(person.anomalies)],
    ['downtime', t('shifts.detail.minutes', { count: person.downtimeMinutes })],
  ]

  return (
    <div className="border-t border-hairline bg-sunken px-3 py-3.5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Eyebrow as="h4" className="m-0 flex-1">
          {t('shifts.crew.detailTitle', { name: person.name })}
        </Eyebrow>
        <ForgeButton size="sm" onClick={onFilter}>
          <Icon name="list" size="xs" />
          {t('shifts.crew.filterTable')}
        </ForgeButton>
      </div>

      <dl className="m-0 mb-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,8rem),1fr))]">
        {stats.map(([key, value]) => (
          <div key={key} className="rounded-sm border border-hairline bg-card px-3 py-2">
            <dt className="eyebrow">{t(`shifts.crew.stat.${key}`)}</dt>
            <dd className="m-0 mt-0.5">
              <Num className="text-body-sm font-semibold">{value}</Num>
            </dd>
          </div>
        ))}
      </dl>

      {shifts.isError ? (
        <ErrorState
          error={shifts.error}
          title={t('shifts.loadFailed')}
          onRetry={() => shifts.refetch()}
          className="border-0 bg-transparent shadow-none"
        />
      ) : shifts.isPending ? (
        <SkeletonRows count={3} />
      ) : (
        <div className="overflow-x-auto rounded-sm border border-hairline bg-card">
          <table className="w-full border-collapse text-body-sm">
            <caption className="sr-only">
              {t('shifts.crew.detailTitle', { name: person.name })}
            </caption>
            <thead>
              <tr className="border-b border-hairline">
                {['date', 'shift', 'time', 'oee', 'anomalies', 'workOrders', 'status'].map(
                  (column) => (
                    <th
                      key={column}
                      scope="col"
                      className={cn(
                        'eyebrow px-3 py-2 whitespace-nowrap first:ps-3.5 last:pe-3.5',
                        ['oee', 'anomalies', 'workOrders'].includes(column)
                          ? 'text-end'
                          : 'text-start',
                        column === 'time' && 'w-full',
                      )}
                    >
                      {t(`shifts.column.${column}`)}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const figures = shiftFigures(row)
                const muted = figures.projected ? 'text-ink-mute italic' : undefined
                return (
                  <tr key={row.id} className="border-b border-subtle last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap ps-3.5">
                      <Num>
                        {formatShiftDate(row.date, {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Num>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="flex items-center gap-2">
                        <Dot tone={SHIFT_TYPE_TONE[row.type]} size={6} />
                        {t(`shifts.type.${row.type}`)}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink-dim">
                      <Mono className="text-micro">
                        {formatShiftTime(row.startsAt)}–{formatShiftTime(row.endsAt)}
                      </Mono>
                    </td>
                    <td className="px-3 py-2 text-end whitespace-nowrap">
                      <Num className={muted ?? 'font-semibold'}>
                        {formatPercent(figures.oee, 1)}
                      </Num>
                    </td>
                    <td className="px-3 py-2 text-end whitespace-nowrap">
                      <Num className={muted}>{formatInteger(figures.anomalies)}</Num>
                    </td>
                    <td className="px-3 py-2 text-end whitespace-nowrap text-ink-dim">
                      <Num className={muted}>{formatInteger(figures.workOrders)}</Num>
                    </td>
                    <td className="px-3 py-2 pe-3.5 whitespace-nowrap">
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
      )}
    </div>
  )
}
