import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip } from '@/components/forge/Chip'
import { Panel } from '@/components/forge/Panel'
import { TrendChart } from '@/components/forge/TrendChart'
import { Num } from '@/components/forge/primitives'
import { formatCompact, formatDecimal, formatHours, formatInteger, formatPercent } from '@/lib/format'
import { LossWaterfall } from './LossWaterfall'
import { OeeHeatmap } from './OeeHeatmap'
import { Bar, CardHead, DeltaValue, DemoNotice, Gauge } from './parts'
import { toneForOee } from './oeeModel'

const FACTOR_TONE = { availability: 'ack', performance: 'green', quality: 'violet' }
const FACTORS = ['availability', 'performance', 'quality']

/**
 * Overview — the design's second tab and the module's reference view.
 *
 * A hero row of four gauges, a strip of six secondary figures, the trend beside
 * the loss waterfall, and the hour × day heatmap. Same order, same grouping.
 *
 * ── The A/P/Q chips do something ──────────────────────────────────────────
 * They are always lit and inert in the prototype. Here they toggle the three
 * factor traces on the trend, default on, with the OEE line drawn over them at
 * full weight so the subject of the card stays the subject. Local state rather
 * than a search param: which traces are showing is a reading posture, not a
 * scope, and it does not need to survive a link.
 */
export function OverviewView({ model, period, compare }) {
  const { t } = useTranslation(['app', 'common'])
  const [shown, setShown] = useState({ availability: true, performance: true, quality: true })

  const { factors, deltas, prior, target } = model
  const oeeTone = toneForOee(factors.oee, target)

  const traces = model.trend.filter((entry) => entry.key === 'oee' || shown[entry.key])

  const secondary = [
    { key: 'teep', value: formatPercent(factors.teep), delta: deltas.teep },
    { key: 'goodUnits', value: formatCompact(model.output.goodUnits) },
    {
      key: 'scrapRate',
      value: formatPercent((model.output.scrapUnits / model.output.totalUnits) * 100, 2),
      invert: true,
    },
    { key: 'mtbf', value: formatHours(model.reliability.mtbfHours) },
    { key: 'mttr', value: t('oee.min', { value: formatInteger(Math.round(model.reliability.mttrMin)) }) },
    { key: 'downtime', value: t('oee.min', { value: formatInteger(model.time.downMin) }) },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* ── Hero ───────────────────────────────────────────────────────
          The headline gauge takes a whole card and the three factors share the
          rest, which is the design's split and is the right one: the three are
          the multiplication and the one is its answer. */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(17rem,100%),1fr))]">
        <Panel className="flex flex-wrap items-center gap-4">
          <Gauge value={factors.oee} tone={oeeTone} label={t('oee.kpi.oee')} caption={t('oee.kpi.oee')} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow m-0">{t('oee.heroLabel')}</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <span className="text-title">{t(`oee.period.${period}`)}</span>
              {compare ? <DeltaValue value={deltas.oee} /> : null}
            </div>
            <p className="mt-2 mb-0 text-body-sm text-ink-dim">
              {t('oee.gapToTarget', {
                target: formatPercent(target, 0),
                gap: formatDecimal(model.gapPts) + t('oee.pts'),
              })}
            </p>
            {compare ? (
              <p className="mt-0.5 mb-0 text-body-sm text-ink-mute">
                {t('oee.priorWas', {
                  window: t(`oee.prior.${period}`),
                  value: formatPercent(prior.oee),
                })}
              </p>
            ) : null}
            <Bar
              className="mt-3"
              value={(factors.oee / target) * 100}
              tone={oeeTone}
            />
          </div>
        </Panel>

        {FACTORS.map((key) => (
          <Panel key={key} className="flex items-center gap-3.5">
            <Gauge
              value={factors[key]}
              tone={FACTOR_TONE[key]}
              size={78}
              label={t(`oee.kpi.${key}`)}
            />
            <div className="min-w-0">
              <p className="eyebrow m-0">{t(`oee.kpi.${key}`)}</p>
              {compare ? (
                <div className="mt-1">
                  <DeltaValue value={deltas[key]} />
                </div>
              ) : null}
              <p className="mt-1.5 mb-0 text-micro font-normal text-ink-mute">
                {t(`oee.kpiHint.${key}`)}
              </p>
            </div>
          </Panel>
        ))}
      </div>

      {/* ── Secondary strip ────────────────────────────────────────────
          Six figures, none of them typed: TEEP is OEE derated by scheduled
          time, the scrap rate is the quality factor, and MTBF and MTTR are the
          computed downtime divided by the window's stop count. */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(9.5rem,100%),1fr))]">
        {secondary.map((entry) => (
          <Panel key={entry.key} className="p-3.5">
            <p className="eyebrow m-0">{t(`oee.secondary.${entry.key}`)}</p>
            <Num className="mt-1.5 block text-metric-sm leading-none">{entry.value}</Num>
            {entry.delta != null && compare ? (
              <div className="mt-1.5">
                <DeltaValue value={entry.delta} invert={entry.invert} />
              </div>
            ) : (
              <p className="mt-1.5 mb-0 text-micro font-normal text-ink-mute">
                {t(`oee.secondaryHint.${entry.key}`, { stops: model.reliability.stops })}
              </p>
            )}
          </Panel>
        ))}
      </div>

      {/* ── Trend and waterfall ────────────────────────────────────────
          Asymmetric, as the design has it: the trend is read across and needs
          the width, the waterfall is read down and does not. */}
      <div className="grid gap-4 max-xl:grid-cols-1 [grid-template-columns:minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel>
          <CardHead
            eyebrow={t('oee.trend.eyebrow', {
              window: t(`oee.period.${period}`),
              prior: t(`oee.prior.${period}`),
            })}
            title={t('oee.trend.title')}
            right={
              <div role="group" aria-label={t('oee.trend.seriesLabel')} className="flex gap-1.5">
                {FACTORS.map((key) => (
                  <Chip
                    key={key}
                    selected={shown[key]}
                    onClick={() => setShown((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className="px-2 py-[3px] text-micro max-lg:px-2.5 max-lg:py-1.5 max-lg:text-body-sm"
                  >
                    {/* One letter, so the accessible name has to carry the word
                        — "A" announced on its own is nothing. */}
                    <span aria-hidden="true">{t(`oee.seriesShort.${key}`)}</span>
                    <span className="sr-only">{t(`oee.kpi.${key}`)}</span>
                  </Chip>
                ))}
              </div>
            }
          />
          <TrendChart
            series={traces.map((entry) => ({ ...entry, label: t(`oee.kpi.${entry.key}`) }))}
            band={model.band}
            label={t('oee.trend.chartLabel')}
            bandLabel={t('oee.trend.band', { lo: model.band?.[0], hi: model.band?.[1] })}
            xLabel={t('oee.trend.xLabel')}
            format={(value) => formatPercent(value)}
          />
        </Panel>

        <Panel>
          <CardHead eyebrow={t('oee.waterfall.eyebrow')} title={t('oee.waterfall.title')} />
          <LossWaterfall rows={model.waterfall} />
        </Panel>
      </div>

      <Panel>
        <CardHead
          eyebrow={t('oee.heatmap.eyebrow')}
          title={t('oee.heatmap.title')}
          right={t('oee.heatmap.subtitle')}
        />
        <OeeHeatmap rows={model.heatmap} />
      </Panel>

      <DemoNotice className="mt-0" />
    </div>
  )
}
