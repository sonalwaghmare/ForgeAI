import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Panel } from '@/components/forge/Panel'
import { TablePagination } from '@/components/forge/TablePagination'
import { EmptyState, ErrorState, SkeletonRows } from '@/components/forge/States'
import { StateBadge } from '@/components/forge/StatusBadge'
import { Num } from '@/components/forge/primitives'
import { formatInteger, formatPercent, formatSigned } from '@/lib/format'
import { STATE_TONE } from '@/lib/tone'
import { Bar, CardHead, DeltaValue, DemoNotice } from './parts'
import { toneForOee } from './oeeModel'

/**
 * Line performance — every production line at the site, ranked by OEE.
 *
 * The design's eleven columns: line, OEE with a bar, movement against the prior
 * window, the three factors, good cans, stops, top loss and the gap to target.
 * Ranked worst-to-best is what the prototype's header claims and the opposite of
 * what it does; here it is ranked best-first as the header says, with the idle
 * line last because it has no OEE to rank on.
 *
 * ── Where the per-line factors come from ──────────────────────────────────
 * Not a second table. Each line's A, P and Q are the plant's, moved by that
 * line's own ratio to the plant OEE and split across the three by an authored
 * loss mix — so `A × P × Q` lands on the line's own OEE as an identity rather
 * than as a coincidence, and the line table can never contradict the headline
 * above it. See `oeeModel.js`.
 *
 * ── No `w-full` on any column, deliberately ───────────────────────────────
 * The trick that fixed Home's task table is wrong here and was tried once: with
 * eleven short cells, `w-full` on Top Loss makes that column absorb the width
 * and collapses the other ten into the first third of the card. Plain auto
 * layout distributes slack in proportion to content, which is the spread the
 * design has.
 */

const COLUMNS = [
  { key: 'line', numeric: false },
  { key: 'status', numeric: false },
  { key: 'current', numeric: true },
  { key: 'delta', numeric: true },
  { key: 'availability', numeric: true, short: true },
  { key: 'performance', numeric: true, short: true },
  { key: 'quality', numeric: true, short: true },
  { key: 'units', numeric: true },
  { key: 'stops', numeric: true },
  { key: 'topLoss', numeric: false },
  { key: 'gap', numeric: true },
]

/**
 * Line-level OEE is reported in whole points on most sources, and "78.0%"
 * against a target of "85.0%" spends two characters a cell on a decimal that is
 * always zero. Adaptive rather than hardcoded, so a source that does report a
 * tenth still shows it.
 */
const digitsFor = (value) => (Number.isInteger(value) ? 0 : 1)

export function ProductionLinesTable({ rows, target, compare, query }) {
  const { t } = useTranslation(['app', 'common'])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const ranked = [...rows].sort((left, right) => {
    // An idle line has no OEE and sorts last rather than to the bottom of the
    // ladder — "not scheduled" is not "worst".
    if (left.oee == null) return 1
    if (right.oee == null) return -1
    return right.oee - left.oee
  })

  const pageCount = Math.max(1, Math.ceil(ranked.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visible = ranked.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <Panel flush>
      <div className="border-b border-hairline px-4.5 py-3.5">
        <CardHead
          className="mb-0"
          title={t('oee.lines.title')}
          right={t('oee.lines.rankedBy')}
        />
      </div>

      {query.isPending ? (
        <div className="p-4.5">
          <SkeletonRows count={4} />
        </div>
      ) : query.isError ? (
        <div className="p-4.5">
          <ErrorState
            error={query.error}
            title={t('oee.lines.loadFailed')}
            onRetry={() => query.refetch()}
          />
        </div>
      ) : ranked.length === 0 ? (
        <EmptyState
          icon="factory"
          title={t('oee.lines.empty')}
          className="border-0 bg-transparent shadow-none"
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-body-sm">
              <thead>
                <tr className="bg-sunken">
                  {COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className="eyebrow border-b border-hairline px-3.5 py-2.5 text-start whitespace-nowrap"
                    >
                      {/* A, P and Q are the design's headers and are one letter
                          each; the word goes in the accessible name, because a
                          column announced as "P" is a column nobody can use. */}
                      {column.short ? (
                        <>
                          <span aria-hidden="true">{t(`oee.seriesShort.${column.key}`)}</span>
                          <span className="sr-only">{t(`oee.lines.columnFull.${column.key}`)}</span>
                        </>
                      ) : (
                        t(`oee.lines.columns.${column.key}`)
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const tone = toneForOee(row.oee, target)
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-subtle last:border-b-0 even:bg-row-alt"
                    >
                      <th scope="row" className="px-3.5 py-2.5 text-start whitespace-nowrap">
                        {/* The design makes the whole row a click target with no
                            affordance on it. A link on the name is the same
                            destination and is reachable from a keyboard. */}
                        <Link
                          to={`/app/assets/lines/${row.id}`}
                          className="font-semibold text-ink underline-offset-2 hover:text-forge hover:underline"
                          aria-label={t('oee.lines.openLine', { name: row.name })}
                        >
                          {row.name}
                        </Link>
                      </th>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {/* `idle` earns no hue. A line nobody scheduled is not
                            a fault, and painting it red is how a table ends up
                            reporting an outage that is a plan. */}
                        <StateBadge tone={row.status === 'idle' ? null : (STATE_TONE[row.status] ?? 'red')}>
                          {t(`oee.lines.status.${row.status}`)}
                        </StateBadge>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {row.oee == null ? (
                          <span className="text-ink-mute">{t('oee.lines.idle')}</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Bar className="w-12 shrink-0" value={row.oee} tone={tone} />
                            <Num className="font-semibold" style={{ color: `var(--on-${tone})` }}>
                              {formatPercent(row.oee, digitsFor(row.oee))}
                            </Num>
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {compare && row.deltaPts != null ? <DeltaValue value={row.deltaPts} /> : null}
                      </td>
                      {['availability', 'performance', 'quality'].map((key) => (
                        <td key={key} className="px-3.5 py-2.5 whitespace-nowrap text-ink-dim">
                          <Num>{row[key] == null ? '—' : formatPercent(row[key], 1)}</Num>
                        </td>
                      ))}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <Num>{row.units == null ? '—' : formatInteger(row.units)}</Num>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <Num
                          className={row.stops > 0 ? undefined : 'text-ink-mute'}
                          style={
                            // A line carrying more than its share of the site's
                            // stops is the one to look at. Threshold, not a
                            // gradient — a colour that changes by one unit says
                            // nothing.
                            row.stops != null && row.stops >= 20
                              ? { color: 'var(--on-red)', fontWeight: 600 }
                              : undefined
                          }
                        >
                          {row.stops == null ? '—' : formatInteger(row.stops)}
                        </Num>
                      </td>
                      <td className="px-3.5 py-2.5 text-ink-dim">{row.topLoss}</td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {/* Signed and written from the value, never with a
                            hardcoded minus, so a line that beats its target
                            shows that. */}
                        {row.gap == null ? (
                          <span className="text-ink-mute">—</span>
                        ) : (
                          <Num style={{ color: `var(--on-${row.gap < 0 ? 'red' : 'green'})` }}>
                            {formatSigned(row.gap, digitsFor(row.gap))}
                            {t('oee.pts')}
                          </Num>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <TablePagination
            total={ranked.length}
            page={safePage}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            label={t('oee.lines.pagerLabel')}
          />

          <div className="px-4.5 pb-4">
            <DemoNotice className="mt-0" />
          </div>
        </>
      )}
    </Panel>
  )
}
