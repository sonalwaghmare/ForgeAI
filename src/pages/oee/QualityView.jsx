import { useTranslation } from 'react-i18next'
import { Panel } from '@/components/forge/Panel'
import { TrendChart } from '@/components/forge/TrendChart'
import { Num } from '@/components/forge/primitives'
import { formatInteger, formatPercent } from '@/lib/format'
import { DefectMix } from './DefectMix'
import { CardHead, DeltaValue, DemoNotice } from './parts'

/**
 * Quality & Output — the design's fifth tab.
 *
 * A five-figure strip of what the window produced, the defect mix beside the
 * throughput trend, and the rate analysis underneath.
 *
 * ── Every figure here is one arithmetic step from the quality factor ──────
 * Total produced is nameplate rate × run time × performance. Good is that times
 * quality. Scrap and rework are the remainder, split. First-pass yield is good
 * ÷ total, which IS the quality factor — printed rather than restated, so the
 * two cannot differ. In the prototype these are six independent literals and
 * they do differ: it prints 41,250 produced, 39,765 good, 1,485 scrap and 412
 * rework, which is 1,897 rejects against a stated 1,485.
 */
export function QualityView({ model, period, compare }) {
  const { t } = useTranslation(['app', 'common'])

  const { output, rate } = model

  const tiles = [
    { key: 'produced', value: formatInteger(output.totalUnits), hint: t('oee.quality.producedHint') },
    { key: 'good', value: formatInteger(output.goodUnits), hint: t('oee.quality.goodHint') },
    {
      key: 'scrap',
      value: formatInteger(output.scrapUnits),
      hint: formatPercent((output.scrapUnits / output.totalUnits) * 100, 2),
    },
    {
      key: 'rework',
      value: formatInteger(output.reworkUnits),
      hint: formatPercent((output.reworkUnits / output.totalUnits) * 100, 2),
    },
    {
      key: 'fpy',
      value: formatPercent(model.factors.quality),
      hint: t('oee.quality.fpyHint'),
      delta: model.deltas.quality,
    },
  ]

  /* The throughput trace is the quality series rescaled onto cans, not a second
     generated line: output IS rate × time × performance, so a throughput chart
     that wanders away from the performance trace beside it would be drawing a
     plant that does not exist. The prototype multiplies its OEE series by 1.02
     and labels the result "units per period" with a percent axis. */
  const performance = model.trend.find((entry) => entry.key === 'performance')
  const throughput = performance
    ? [
        {
          key: 'throughput',
          tone: 'forge',
          label: t('oee.output.title'),
          values: performance.values.map((value) =>
            Math.round(((rate.nameplate * value) / 100) * (model.time.runMin / performance.values.length)),
          ),
        },
      ]
    : []

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(10.5rem,100%),1fr))]">
        {tiles.map((tile) => (
          <Panel key={tile.key} className="p-3.5">
            <p className="eyebrow m-0">{t(`oee.quality.${tile.key}`)}</p>
            <Num className="mt-1.5 block text-metric-sm leading-none">{tile.value}</Num>
            {tile.delta != null && compare ? (
              <div className="mt-1.5">
                <DeltaValue value={tile.delta} />
              </div>
            ) : (
              <p className="mt-1.5 mb-0 text-micro font-normal text-ink-mute">{tile.hint}</p>
            )}
          </Panel>
        ))}
      </div>

      <div className="grid gap-4 max-xl:grid-cols-1 [grid-template-columns:minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel>
          <CardHead eyebrow={t('oee.defects.eyebrow')} title={t('oee.defects.title')} />
          <DefectMix rows={model.defects} ppm={output.defectPpm} totalUnits={output.defectUnits} />
        </Panel>

        <Panel>
          <CardHead
            eyebrow={t('oee.trend.eyebrow', {
              window: t(`oee.period.${period}`),
              prior: t(`oee.prior.${period}`),
            })}
            title={t('oee.output.title')}
            right={t('oee.output.eyebrow')}
          />
          <TrendChart
            series={throughput}
            label={t('oee.output.title')}
            bandLabel={t('oee.trend.band', { lo: model.band?.[0], hi: model.band?.[1] })}
            xLabel={t('oee.trend.xLabel')}
            legend={false}
            axisWidth={58}
            format={(value) => formatInteger(Math.round(value))}
          />
        </Panel>
      </div>

      <Panel>
        <CardHead eyebrow={t('oee.rate.eyebrow')} title={t('oee.rate.title')} />
        <dl className="m-0 grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(11rem,100%),1fr))]">
          {[
            { key: 'ideal', value: formatInteger(rate.nameplate) },
            { key: 'actual', value: formatInteger(rate.actual) },
            { key: 'loss', value: formatInteger(rate.loss) },
            { key: 'attainment', value: formatPercent(rate.attainment) },
          ].map((entry) => (
            <div key={entry.key}>
              <dt className="eyebrow">{t(`oee.rate.row.${entry.key}`)}</dt>
              <dd className="m-0">
                <Num
                  className="block text-metric-sm leading-none"
                  style={entry.key === 'loss' ? { color: 'var(--on-red)' } : undefined}
                >
                  {entry.value}
                </Num>
                <p className="mt-1 mb-0 text-micro font-normal text-ink-mute">
                  {t(`oee.rate.hint.${entry.key}`)}
                </p>
              </dd>
            </div>
          ))}
        </dl>
        <DemoNotice />
      </Panel>
    </div>
  )
}
