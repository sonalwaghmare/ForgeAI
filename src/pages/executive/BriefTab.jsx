import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { MetricCard } from '@/components/forge/MetricCard'
import { Panel } from '@/components/forge/Panel'
import { RadarSweep } from '@/components/forge/RadarSweep'
import { AiBadge } from '@/components/forge/StatusBadge'
import { TrendChart } from '@/components/forge/TrendChart'
import { Dot, Num } from '@/components/forge/primitives'
import { formatInteger, formatPercent, formatSigned } from '@/lib/format'
import { formatMoney, trailingMonths } from './executiveModel'
import { CardHead, DemoNotice } from './parts'

/**
 * The staged refresh.
 *
 * The design animates four stages on a 520 ms timer whether or not anything is
 * being fetched, so the reader watches a machine "reconcile benefit streams
 * with Finance" on a screen whose data arrived before the animation started.
 *
 * This renders only while the rollup request is genuinely in flight, and the
 * stages name what the request actually does. `RadarSweep` is the existing
 * component and honours `prefers-reduced-motion` through the stylesheet, which
 * the design's inline `animation` does not.
 */
export function BriefLoading({ stage }) {
  const { t } = useTranslation('app')
  const stages = ['fetch', 'count', 'compose']
  const current = stages[Math.min(stage, stages.length - 1)]

  return (
    <Panel className="flex flex-col items-center gap-4 py-12 text-center">
      <RadarSweep size={132} />
      <p className="m-0 text-title">{t('executive.loading.title')}</p>
      <p className="m-0 text-body text-ink-dim" aria-live="polite">
        {t(`executive.loading.stage.${current}`)}
      </p>
    </Panel>
  )
}

/**
 * AI Brief — the tab a COO opens on and, most days, the only one they read.
 *
 * ── The prose is composed, the figures are found ──────────────────────────
 * Every clause interpolates a number the server measured or the model derived,
 * and the site named as the estate's risk is `brief.risk` — the plant carrying
 * the most critical anomalies, not a name typed into the paragraph. The design
 * hardcodes Rotterdam, an attainment percentage and a payback month into one
 * English string, so its brief cannot be translated and cannot be wrong in a
 * way anybody notices.
 */
export function BriefTab({ model, roi, brief, stats, onTab, onExport }) {
  const { t } = useTranslation('app')
  const months = trailingMonths()

  /* Derived, in the order a board reads them. `attention` counts itself off
     the rows rather than being authored beside them. */
  const scorecard = [
    {
      key: 'revenuePlan',
      value: t('executive.scorecard.revenuePlanValue', {
        revenue: formatMoney(model.revenue),
        plan: formatMoney(model.plan),
      }),
      note: t('executive.scorecard.attainment', {
        percent: formatPercent(model.attainmentPct),
      }),
      ok: model.attainmentPct >= 98,
    },
    {
      key: 'margin',
      value: formatPercent(model.marginPct),
      note: t('executive.scorecard.pointsVsPrior', {
        points: formatSigned(model.marginDeltaPts),
      }),
      ok: model.marginDeltaPts >= 0,
    },
    {
      key: 'oee',
      value: formatPercent(model.oee),
      note: t('executive.scorecard.againstTarget', {
        target: formatPercent(model.target, 0),
      }),
      ok: model.oee >= model.target,
    },
    {
      key: 'downtimeCost',
      value: formatMoney(model.downtimeCost),
      note: t('executive.scorecard.percentVsPrior', {
        percent: formatSigned(model.downtimeChangePct, 0),
      }),
      ok: model.downtimeChangePct <= 0,
    },
    {
      key: 'anomalies',
      value: formatInteger(stats.openAlerts),
      note: t('executive.scorecard.criticalOpen', { count: stats.criticalAlerts }),
      ok: stats.criticalAlerts === 0,
    },
    {
      key: 'workOrders',
      value: formatInteger(stats.openWorkOrders),
      note: t('executive.scorecard.acrossSites', { count: stats.sites }),
      ok: true,
    },
  ]

  const attention = scorecard.filter((row) => !row.ok).length

  return (
    <div className="flex flex-col gap-4">
      {/* ── The brief ─────────────────────────────────────────────────── */}
      <Panel stripe="violet" className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] tint-violet">
            <Icon name="ai" size="sm" className="text-violet" />
          </span>
          <h2 className="m-0 text-title">{t('executive.brief.label')}</h2>
          <AiBadge label={t('executive.brief.confidence', { percent: roi.confidence })} />
          <span className="ms-auto text-micro font-normal text-ink-mute italic">
            {t('executive.brief.stamp')}
          </span>
        </div>

        <div className="flex flex-col gap-3 text-body leading-relaxed text-ink-dim">
          <Num as="p" className="m-0">
            {t('executive.brief.revenue', {
              revenue: formatMoney(model.revenue),
              plan: formatMoney(model.plan),
              attainment: formatPercent(model.attainmentPct),
              name: brief?.risk?.name,
              gap: formatSigned((brief?.risk?.oee ?? model.oee) - model.target),
            })}
          </Num>
          <Num as="p" className="m-0">
            {t('executive.brief.estate', {
              oee: formatPercent(model.oee),
              points: formatSigned(model.oeeDeltaPts),
              downtime: formatMoney(model.downtimeCost),
              percent: formatSigned(model.downtimeChangePct, 0),
              margin: formatPercent(model.marginPct),
            })}
          </Num>
          <Num as="p" className="m-0">
            {t('executive.brief.roi', {
              benefit: formatMoney(roi.benefit),
              investment: formatMoney(roi.investment),
              roi: formatPercent(roi.roiPct, 0),
              payback: roi.paybackMonths,
              stream: t(`executive.roi.stream.${roi.topStream.key}`),
              streamValue: formatMoney(roi.topStream.value),
            })}
          </Num>
          <Num as="p" className="m-0 text-ink">
            <strong>{t('executive.brief.decisionLabel')}</strong>{' '}
            {t('executive.brief.decision', { name: brief?.risk?.name })}
          </Num>
        </div>

        <div className="flex flex-wrap gap-2">
          <ForgeButton variant="primary" onClick={() => onTab('roi')}>
            {t('executive.brief.seeRoi')}
            <Icon name="right" size="xs" className="mirror-rtl" />
          </ForgeButton>
          {/* The design's Review risks button calls `setTab("risk")` against a
              tab it never defines. The risk and upside ledgers live at the foot
              of Performance, alongside the figures they price, so that is where
              it goes — a real destination rather than a dead handler. */}
          <ForgeButton onClick={() => onTab('performance')}>
            {t('executive.brief.reviewRisks')}
          </ForgeButton>
          <ForgeButton onClick={onExport}>
            <Icon name="doc" size="xs" />
            {t('executive.exportBoardPack')}
          </ForgeButton>
        </div>

        <DemoNotice variant="brief" className="mt-0" />
      </Panel>

      {/* ── Headline band ─────────────────────────────────────────────── */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
        <MetricCard
          label={t('executive.kpi.revenue')}
          value={formatMoney(model.revenue)}
          icon="chart"
          delta={model.revenueChangePct}
          deltaLabel={`${formatSigned(model.revenueChangePct)}%`}
          sub={t('executive.kpi.ofPlan', { percent: formatPercent(model.attainmentPct) })}
        />
        <MetricCard
          label={t('executive.kpi.margin')}
          value={formatPercent(model.marginPct)}
          icon="gauge"
          delta={model.marginDeltaPts}
          deltaLabel={formatSigned(model.marginDeltaPts)}
          sub={t('executive.kpi.pointsVsPrior')}
        />
        <MetricCard
          label={t('executive.kpi.oee')}
          value={formatPercent(model.oee)}
          icon="bolt"
          tone={model.oee >= model.target ? 'green' : 'amber'}
          delta={model.oeeDeltaPts}
          deltaLabel={formatSigned(model.oeeDeltaPts)}
          sub={t('executive.kpi.target', { target: formatPercent(model.target, 0) })}
        />
        <MetricCard
          label={t('executive.kpi.downtimeCost')}
          value={formatMoney(model.downtimeCost)}
          icon="wrench"
          tone="red"
          invert
          delta={model.downtimeChangePct}
          deltaLabel={`${formatSigned(model.downtimeChangePct, 0)}%`}
          sub={t('executive.kpi.vsPrior')}
        />
      </div>

      {/* ── Scorecard + trajectory ────────────────────────────────────── */}
      <div className="grid gap-4 [grid-template-columns:minmax(0,1fr)_minmax(19rem,0.85fr)] max-xl:grid-cols-1">
        <Panel flush className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-2.5">
            <h2 className="m-0 flex-1 text-body-sm font-semibold">
              {t('executive.scorecard.title')}
            </h2>
            <span className="text-micro font-normal text-ink-dim">
              <Num>
                {t('executive.scorecard.summary', { total: scorecard.length, attention })}
              </Num>
            </span>
          </div>
          <ul className="m-0 flex list-none flex-col p-0">
            {scorecard.map((row) => (
              <li
                key={row.key}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-subtle px-4 py-2.5 last:border-0"
              >
                <Dot tone={row.ok ? 'green' : 'amber'} />
                <span className="min-w-0 flex-1 text-body-sm">
                  {t(`executive.scorecard.row.${row.key}`)}
                </span>
                <Num className="text-body-sm font-semibold">{row.value}</Num>
                <Num className="w-40 text-end text-micro text-ink-dim max-sm:w-auto">
                  {row.note}
                </Num>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <CardHead
            eyebrow={t('executive.trajectory.eyebrow')}
            title={t('executive.trajectory.title')}
          />
          <TrendChart
            series={[
              {
                key: 'oee',
                label: t('executive.kpi.oee'),
                values: model.oeeTrace,
                tone: 'forge',
              },
            ]}
            band={[model.target - 11, model.target]}
            label={t('executive.trajectory.chartLabel')}
            bandLabel={t('executive.trajectory.band', {
              lo: model.target - 11,
              hi: model.target,
            })}
            xLabel={t('executive.trajectory.xLabel')}
            xTicks={months}
            legend={false}
            format={(value) => formatPercent(value)}
          />
          <DemoNotice variant="trajectory" />
        </Panel>
      </div>
    </div>
  )
}
