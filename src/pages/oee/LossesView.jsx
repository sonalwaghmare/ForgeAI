import { useTranslation } from 'react-i18next'
import { Panel } from '@/components/forge/Panel'
import { PlainBadge } from '@/components/forge/StatusBadge'
import { Num } from '@/components/forge/primitives'
import { formatInteger, formatPercent } from '@/lib/format'
import { DowntimePareto } from './DowntimePareto'
import { Bar, CardHead, DemoNotice } from './parts'

const TIME_ROWS = [
  { key: 'planned', tone: null },
  { key: 'run', tone: 'green' },
  { key: 'down', tone: 'red' },
  { key: 'setup', tone: 'amber' },
]

/**
 * Loss Analysis — the design's third tab.
 *
 * The Six Big Losses beside the downtime Pareto, and the time accounting under
 * both. Three views of one quantity: the minutes the window did not turn into
 * good cans.
 *
 * ── They are three views, and in the prototype they are three answers ─────
 * There, the six losses are authored minutes, the Pareto is a different set of
 * authored minutes, and the time accounting is a third — so the availability
 * losses total 84 minutes in one card, 1,294 in the next, and neither matches
 * the 15 percentage points the waterfall on the previous tab draws. Here all
 * three are apportioned out of the same computed totals, so the availability
 * pair of the six losses sums to the Pareto's total, which is the Downtime
 * figure in the accounting row below, which is the availability step of the
 * waterfall. Anyone who checks finds them agreeing.
 */
export function LossesView({ model }) {
  const { t } = useTranslation('app')

  const { time, totalLossMin } = model

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 max-xl:grid-cols-1 [grid-template-columns:repeat(2,minmax(0,1fr))]">
        <Panel>
          <CardHead
            eyebrow={t('oee.losses.eyebrow')}
            title={t('oee.losses.title')}
            right={<Num>{t('oee.losses.total', { minutes: formatInteger(totalLossMin) })}</Num>}
          />
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {model.sixLosses.map((loss) => (
              <li key={loss.key}>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 text-body-sm">
                    {t(`oee.losses.name.${loss.key}`)}
                  </span>
                  {/* Which of the three factors the loss belongs to. A plain
                      badge, not a severity one — the bucket is a taxonomy, and
                      colouring it would put a fourth hue on a row that already
                      carries one. */}
                  <PlainBadge>{t(`oee.losses.bucket.${loss.bucket}`)}</PlainBadge>
                  <Num className="w-20 shrink-0 text-end text-body-sm font-semibold">
                    {t('oee.min', { value: formatInteger(loss.minutes) })}
                  </Num>
                  <Num className="w-11 shrink-0 text-end text-micro text-ink-mute">
                    {formatPercent(loss.pctOfLoss, 0)}
                  </Num>
                </div>
                <Bar value={loss.pctOfLoss} tone={loss.tone} />
              </li>
            ))}
          </ul>
          <p className="mt-4 mb-0 text-micro font-normal text-ink-mute">
            {t('oee.losses.caption')}
          </p>
        </Panel>

        <Panel>
          <CardHead
            eyebrow={t('oee.pareto.eyebrow')}
            title={t('oee.pareto.title')}
            right={t('oee.pareto.subtitle')}
          />
          <DowntimePareto
            rows={model.pareto}
            totalMinutes={model.time.downMin}
            vitalFewPct={model.vitalFewPct}
          />
        </Panel>
      </div>

      <Panel>
        <CardHead eyebrow={t('oee.timeAccounting.eyebrow')} title={t('oee.timeAccounting.title')} />
        <dl className="m-0 grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(11rem,100%),1fr))]">
          {TIME_ROWS.map((row) => {
            const minutes =
              row.key === 'planned'
                ? time.plannedMin
                : row.key === 'run'
                  ? time.runMin
                  : row.key === 'down'
                    ? time.downMin
                    : time.setupMin
            const share = time.plannedMin ? (minutes / time.plannedMin) * 100 : 0
            return (
              <div key={row.key}>
                <dt className="eyebrow">{t(`oee.timeAccounting.row.${row.key}`)}</dt>
                <dd className="m-0">
                  <Num
                    className="block text-metric-sm leading-none"
                    style={row.tone ? { color: `var(--on-${row.tone})` } : undefined}
                  >
                    {formatInteger(minutes)}
                  </Num>
                  <p className="mt-1 mb-0 text-micro font-normal text-ink-mute">
                    {t('oee.timeAccounting.minutes')} ·{' '}
                    {t('oee.timeAccounting.ofPlanned', { percent: formatPercent(share, 1) })}
                  </p>
                  <Bar className="mt-2" value={share} tone={row.tone} />
                </dd>
              </div>
            )
          })}
        </dl>
        {/* Setup is a slice OF downtime rather than a fourth bucket beside it,
            so the four bars deliberately do not sum to 100. Said out loud
            because a reader adding them up otherwise finds an error that is
            not there. */}
        <DemoNotice />
      </Panel>
    </div>
  )
}
