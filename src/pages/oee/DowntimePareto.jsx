import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Mono, Num } from '@/components/forge/primitives'
import { formatInteger, formatPercent } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Bar } from './parts'

/**
 * Downtime by root cause, worst first, with a running cumulative share.
 *
 * The 80/20 read is the point of the card, so the cumulative column is coloured
 * up to 80% and neutral after it: the coloured rows are the focus set, and the
 * reader does not have to add anything up to see where the line falls.
 *
 * The minutes are apportioned from the window's computed downtime rather than
 * authored — see `oeeModel.js`. So the column sums to the Downtime figure on the
 * Overview and to the availability bucket of the Six Big Losses beside it, which
 * in the prototype are three unrelated numbers.
 */
export function DowntimePareto({ rows, totalMinutes, vitalFewPct }) {
  const { t } = useTranslation('app')
  const [active, setActive] = useState(null)
  const worst = rows[0]?.minutes || 1

  return (
    <div>
      <ol className="m-0 flex list-none flex-col p-0">
        {rows.map((row, index) => (
          <li
            key={row.key}
            onMouseEnter={() => setActive(row.key)}
            onMouseLeave={() => setActive(null)}
            className={cn(
              'flex items-center gap-3 rounded-sm px-1.5 py-1.5 transition-colors',
              active === row.key && 'bg-sunken',
            )}
          >
            <Num className="w-5 shrink-0 text-center text-micro font-bold text-ink-mute">
              {index + 1}
            </Num>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-body-sm">
                  {t(`oee.pareto.cause.${row.key}`)}
                </span>
                {/* A tag is a machine identifier, so it is monospace and is not
                    translated. "Various" is prose and is. */}
                {row.asset ? (
                  <Mono className="shrink-0 text-micro text-ink-mute">{row.asset}</Mono>
                ) : (
                  <span className="shrink-0 text-micro text-ink-mute">{t('oee.pareto.various')}</span>
                )}
                <Num className="w-16 shrink-0 text-end text-body-sm font-semibold">
                  {t('oee.min', { value: formatInteger(row.minutes) })}
                </Num>
              </div>
              <Bar value={(row.minutes / worst) * 100} tone={row.tone} />
            </div>

            <Num
              className="w-11 shrink-0 text-end text-micro font-semibold"
              style={{
                color: row.cumulativePct <= 80 ? 'var(--on-red)' : 'var(--ink-mute)',
              }}
            >
              {formatPercent(row.cumulativePct, 0)}
            </Num>
          </li>
        ))}
      </ol>

      <p className="mt-3 mb-0 border-t border-subtle pt-3 text-micro font-normal text-ink-mute">
        {t('oee.pareto.caption', { percent: formatPercent(vitalFewPct, 0) })}{' '}
        <Num>{t('oee.losses.total', { minutes: formatInteger(totalMinutes) })}</Num>
      </p>
    </div>
  )
}
