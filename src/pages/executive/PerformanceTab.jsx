import { useTranslation } from 'react-i18next'
import { Icon } from '@/components/forge/Icon'
import { MetricCard } from '@/components/forge/MetricCard'
import { Panel } from '@/components/forge/Panel'
import { TrendChart } from '@/components/forge/TrendChart'
import { Num } from '@/components/forge/primitives'
import {
  formatCurrency,
  formatDecimal,
  formatInteger,
  formatNumber,
  formatPercent,
  formatSigned,
} from '@/lib/format'
import {
  DOWNTIME_RATE_PER_HOUR,
  formatMoney,
  trailingMonths,
} from './executiveModel'

/**
 * Cost per unit, to the tenth of a cent.
 *
 * `formatCurrency` rounds to whole units — right for maintenance spend, wrong
 * here, where the whole figure lives in the third decimal and the movement the
 * card reports is under a cent.
 */
function formatUnitCost(value, currency) {
  if (value == null) return '—'
  return formatNumber(value, {
    style: 'currency',
    currency,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
}
import { Bar, CardHead, DemoNotice, Delta } from './parts'
import { RiskTab } from './RiskTab'
import { SitesTab } from './SitesTab'

/**
 * Performance — the operating figures behind the brief, the estate, and the
 * risk and opportunity ledgers.
 *
 * ── Three blocks, one tab, in the design's order ──────────────────────────
 * `screens-executive.jsx` renders three separate blocks gated on the same
 * `tab==="financial"` string, one after another. They are all here, stacked in
 * that order: the figures below, then `SitesTab`, then `RiskTab`. Those two
 * stay their own files because they are large and unrelated to each other —
 * not because they were ever separate tabs.
 *
 * ── The bars are one colour, and it means something ───────────────────────
 * The design draws the four costs of poor performance in red, amber, blue and
 * violet assigned by array position. All four are the same thing — value
 * leaving the business — so they are one hue here, and the length of the bar
 * carries the only comparison worth making. Direction lives in its own signed
 * column, where a reader can see that maintenance spend rising is not the same
 * news as downtime cost rising.
 *
 * ── The total is counted, and so is the improvement ───────────────────────
 * The prototype prints a total under four bars and an improvement figure under
 * that, both authored. Both are summed off `model.leakage` here, so the column
 * and the footer cannot disagree.
 */
export function PerformanceTab({ model, brief, selected, onSelect, currency = 'USD' }) {
  const { t } = useTranslation('app')
  const months = trailingMonths()
  const worst = Math.max(...model.leakage.map((entry) => entry.value))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(10.5rem,1fr))]">
        <MetricCard
          label={t('executive.kpi.revenue')}
          value={formatMoney(model.revenue, currency)}
          delta={model.revenueChangePct}
          deltaLabel={`${formatSigned(model.revenueChangePct)}%`}
          sub={t('executive.kpi.vsPrior')}
        />
        <MetricCard
          label={t('executive.kpi.units')}
          value={formatInteger(model.units)}
          delta={model.units - model.unitsPrev}
          deltaLabel={formatSigned((model.units - model.unitsPrev) / 1000, 0)}
          sub={t('executive.kpi.unitsPlan', { plan: formatInteger(model.unitsPlan) })}
        />
        <MetricCard
          label={t('executive.kpi.otif')}
          value={formatPercent(model.otif)}
          tone="green"
          delta={model.otifDeltaPts}
          deltaLabel={formatSigned(model.otifDeltaPts)}
          sub={t('executive.kpi.pointsVsPrior')}
        />
        <MetricCard
          label={t('executive.kpi.costPerUnit')}
          value={formatUnitCost(model.costPerUnit, currency)}
          invert
          delta={model.costPerUnit - model.costPerUnitPrev}
          deltaLabel={formatSigned((model.costPerUnit - model.costPerUnitPrev) * 100, 2)}
          sub={t('executive.kpi.centsVsPrior')}
        />
        <MetricCard
          label={t('executive.kpi.capacity')}
          value={formatPercent(model.capacityUsed, 0)}
          sub={t('executive.kpi.headroom', {
            percent: formatPercent(100 - model.capacityUsed, 0),
          })}
        />
      </div>

      <div className="grid gap-4 [grid-template-columns:minmax(0,1fr)_minmax(19rem,0.8fr)] max-xl:grid-cols-1">
        {/* ── Cost of poor performance ──────────────────────────────── */}
        <Panel>
          <CardHead
            eyebrow={t('executive.leakage.eyebrow')}
            title={t('executive.leakage.title')}
          />

          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {model.leakage.map((entry) => (
              <li key={entry.key}>
                <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                  <span className="min-w-0 flex-1 text-body-sm font-semibold">
                    {t(`executive.leakage.row.${entry.key}`)}
                  </span>
                  <Num className="text-body font-semibold">
                    {formatMoney(entry.value, currency)}
                  </Num>
                  <Delta
                    value={entry.changePct}
                    invert
                    format={(value) => `${formatSigned(value, 0)}%`}
                    className="w-14 justify-end"
                  />
                </div>
                <Bar value={(entry.value / worst) * 100} tone="red" />
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-hairline pt-3">
            <span className="min-w-0 flex-1 text-body-sm font-semibold">
              {t('executive.leakage.total')}
            </span>
            <Num className="text-metric-sm text-on-red">
              {formatMoney(model.leakageTotal, currency)}
            </Num>
          </div>
          <Num className="mt-1 block text-micro text-ink-dim">
            {t('executive.leakage.improvement', {
              prior: formatMoney(model.leakagePrevTotal, currency),
              saved: formatMoney(model.leakageSaved, currency),
            })}
          </Num>

          <DemoNotice variant="leakage" />
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          {/* ── Revenue trend ───────────────────────────────────────── */}
          <Panel>
            <CardHead
              eyebrow={t('executive.revenueTrend.eyebrow')}
              title={t('executive.revenueTrend.title')}
            />
            <TrendChart
              series={[
                {
                  key: 'revenue',
                  label: t('executive.kpi.revenue'),
                  values: model.revenueTrace,
                  tone: 'green',
                },
              ]}
              label={t('executive.revenueTrend.chartLabel')}
              xLabel={t('executive.trajectory.xLabel')}
              xTicks={months}
              legend={false}
              axisWidth={54}
              format={(value) => formatMoney(value * 1_000_000, currency)}
            />
          </Panel>

          {/* ── Reliability economics ───────────────────────────────── */}
          <Panel>
            <CardHead
              eyebrow={t('executive.reliability.eyebrow')}
              title={t('executive.reliability.title')}
            />
            <ul className="m-0 flex list-none flex-col p-0">
              {[
                {
                  key: 'mtbf',
                  prev: t('executive.hours', {
                    hours: formatInteger(model.reliability.mtbfPrev),
                  }),
                  now: t('executive.hours', { hours: formatInteger(model.reliability.mtbf) }),
                },
                {
                  key: 'mttr',
                  prev: t('executive.hours', { hours: formatDecimal(model.reliability.mttrPrev) }),
                  now: t('executive.hours', { hours: formatDecimal(model.reliability.mttr) }),
                },
                {
                  key: 'unplanned',
                  prev: t('executive.hours', {
                    hours: formatDecimal(model.reliability.unplannedPrevHours),
                  }),
                  now: t('executive.hours', {
                    hours: formatDecimal(model.reliability.unplannedHours),
                  }),
                },
              ].map((row) => (
                <li
                  key={row.key}
                  className="flex items-center gap-2 border-b border-subtle py-2 last:border-0"
                >
                  <span className="min-w-0 flex-1 text-body-sm">
                    {t(`executive.reliability.row.${row.key}`)}
                  </span>
                  <Num className="text-body-sm text-ink-mute">{row.prev}</Num>
                  <Icon
                    name="right"
                    size="xs"
                    className="mirror-rtl text-ink-mute"
                    aria-hidden="true"
                  />
                  <Num className="text-body-sm font-semibold text-on-green">{row.now}</Num>
                </li>
              ))}
            </ul>
            <Num className="mt-2.5 block text-micro text-ink-dim">
              {t('executive.reliability.rate', {
                rate: formatCurrency(DOWNTIME_RATE_PER_HOUR, currency),
              })}
            </Num>
          </Panel>
        </div>
      </div>

      {/* ── The estate ───────────────────────────────────────────────── */}
      <SitesTab model={model} selected={selected} onSelect={onSelect} currency={currency} />

      {/* ── Risk, upside, and the net between them ───────────────────── */}
      <RiskTab brief={brief} riskSite={brief?.risk?.name ?? ''} currency={currency} />
    </div>
  )
}
