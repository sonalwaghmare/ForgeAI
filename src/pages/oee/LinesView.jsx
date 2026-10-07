import { useTranslation } from 'react-i18next'
import { Panel } from '@/components/forge/Panel'
import { Dot, Num } from '@/components/forge/primitives'
import { formatDecimal, formatInteger, formatPercent } from '@/lib/format'
import { SHIFT_TYPE_TONE } from '@/lib/tone'
import { BENCHMARKS, toneForOee } from './oeeModel'
import { ProductionLinesTable } from './ProductionLinesTable'
import { Bar, CardHead, DeltaValue, DemoNotice } from './parts'

const FACTOR_TONE = { availability: 'ack', performance: 'green', quality: 'violet' }
const FACTORS = ['availability', 'performance', 'quality']

/**
 * Lines & Shifts — the design's fourth tab.
 *
 * The line table across the top, then the shift comparison beside the
 * world-class gap analysis.
 *
 * Both lower cards obey the filter bar: picking a shift narrows the crew panel
 * to it, and the benchmark card does not narrow at all, because a benchmark is
 * a property of the plant and scoping it to one line would compare a line to a
 * plant-level standard without saying so.
 */
export function LinesView({ model, compare, linesQuery }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <div className="flex flex-col gap-4">
      <ProductionLinesTable
        rows={model.visibleLines}
        target={model.target}
        compare={compare}
        query={linesQuery}
      />

      <div className="grid gap-4 max-xl:grid-cols-1 [grid-template-columns:repeat(2,minmax(0,1fr))]">
        {/* ── Crews ──────────────────────────────────────────────────── */}
        <Panel>
          <CardHead
            eyebrow={t('oee.shifts.eyebrow')}
            title={t('oee.shifts.title')}
            right={t('oee.shifts.subtitle')}
          />

          <ul className="m-0 flex list-none flex-col p-0">
            {model.visibleShifts.map((shift, index) => {
              const tone = toneForOee(shift.oee, model.target)
              return (
                <li
                  key={shift.key}
                  className={index > 0 ? 'border-t border-subtle pt-3.5 mt-3.5' : undefined}
                >
                  <div className="mb-2.5 flex flex-wrap items-center gap-2">
                    {/* The three windows keep the hues the roster and the
                        logbook timeline give them, so a reader arriving from
                        Shifts does not have to work out which crew is which. */}
                    <Dot tone={SHIFT_TYPE_TONE[shift.key]} />
                    <span className="text-body font-semibold">{t(`oee.shift.${shift.key}`)}</span>
                    <span className="min-w-0 flex-1 truncate text-body-sm text-ink-mute">
                      {shift.crew}
                    </span>
                    {compare ? <DeltaValue value={shift.oee - shift.priorOee} /> : null}
                    <Num
                      className="w-14 shrink-0 text-end text-title"
                      style={{ color: `var(--on-${tone})` }}
                    >
                      {formatPercent(shift.oee)}
                    </Num>
                  </div>

                  <div className="flex items-end gap-3">
                    {FACTORS.map((key) => (
                      <div key={key} className="min-w-0 flex-1">
                        <div className="mb-1 flex items-baseline justify-between gap-2 text-micro">
                          <span className="text-ink-mute" aria-hidden="true">
                            {t(`oee.seriesShort.${key}`)}
                          </span>
                          <Num className="font-semibold">{formatPercent(shift[key], 1)}</Num>
                        </div>
                        <Bar
                          value={shift[key]}
                          tone={FACTOR_TONE[key]}
                          className="h-1"
                        />
                        <span className="sr-only">{`${t(`oee.kpi.${key}`)}: ${formatPercent(shift[key], 1)}`}</span>
                      </div>
                    ))}
                    <div className="w-14 shrink-0 text-end">
                      <span className="block text-micro text-ink-mute">{t('oee.shifts.stops')}</span>
                      <Num className="text-body-sm font-semibold">{formatInteger(shift.stops)}</Num>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          <p className="mt-4 mb-0 text-micro font-normal text-ink-mute">{t('oee.shifts.caption')}</p>
        </Panel>

        {/* ── Benchmarks ─────────────────────────────────────────────── */}
        <Panel>
          <CardHead eyebrow={t('oee.benchmark.eyebrow')} title={t('oee.benchmark.title')} />

          <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
            {BENCHMARKS.map((entry) => {
              const value = model.factors[entry.key]
              const reached = value >= entry.target
              const progress = (value / entry.target) * 100
              return (
                <li key={entry.key}>
                  <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="min-w-0 flex-1 text-body-sm">{t(`oee.kpi.${entry.key}`)}</span>
                    <span className="text-micro text-ink-mute">
                      {t('oee.benchmark.worldClass', { value: formatPercent(entry.target, entry.target % 1 ? 1 : 0) })}
                    </span>
                    <Num
                      className="w-14 shrink-0 text-end text-body-sm font-semibold"
                      style={{ color: `var(--on-${reached ? 'green' : 'red'})` }}
                    >
                      {formatPercent(value)}
                    </Num>
                  </div>
                  {/* The bar is progress toward the benchmark and the rule at
                      100% IS the benchmark, so a bar short of the rule is
                      short of world-class by exactly the width of the gap. */}
                  <span
                    aria-hidden="true"
                    className="relative block h-[7px] overflow-hidden rounded-pill bg-sunken"
                  >
                    <span
                      className="block h-full rounded-pill"
                      style={{
                        width: `${Math.min(100, progress)}%`,
                        background: reached
                          ? 'var(--hue-green)'
                          : progress >= 92
                            ? 'var(--hue-amber)'
                            : 'var(--hue-red)',
                      }}
                    />
                  </span>
                  <p className="mt-1 mb-0 text-micro font-normal text-ink-mute">
                    {reached
                      ? t('oee.benchmark.reached')
                      : t('oee.benchmark.short', {
                          gap: formatDecimal(entry.target - value) + t('oee.pts'),
                        })}
                  </p>
                </li>
              )
            })}
          </ul>

          <p className="mt-4 mb-0 text-micro font-normal text-ink-mute">
            {t('oee.benchmark.caption')}
          </p>
        </Panel>
      </div>

      <DemoNotice className="mt-0" />
    </div>
  )
}
