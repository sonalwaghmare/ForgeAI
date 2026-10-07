import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { Panel } from '@/components/forge/Panel'
import { StateBadge } from '@/components/forge/StatusBadge'
import { TrendChart } from '@/components/forge/TrendChart'
import { Num } from '@/components/forge/primitives'
import {
  formatCurrency,
  formatDecimal,
  formatNumber,
  formatPercent,
  formatSigned,
} from '@/lib/format'
import { cn } from '@/lib/cn'
import { formatMoney, trailingMonths } from './executiveModel'
import { Bar, CardHead, ConfidencePill, DemoNotice } from './parts'

/**
 * Forge AI ROI — what the platform itself returned.
 *
 * ── Four headline figures, one array ──────────────────────────────────────
 * Benefit, net benefit, ROI %, payback month and the confidence figure are all
 * counted off `ROI_STREAMS`; the cumulative curve is scaled so its last point
 * IS the benefit, and the payback month is read off that curve rather than
 * typed beside it. The prototype authors all five as literals next to a streams
 * array that happens to agree with them — which is worse than disagreeing,
 * because nothing keeps it agreeing.
 *
 * ── The before/after CHANGE column is derived ─────────────────────────────
 * Every "−57%", "+47%", "−34 pts" in the design is a hand-typed string beside
 * the pair it describes. Here the pair is authored and the change is computed,
 * so the two cannot drift. The OEE row's pair is the REAL enterprise rollup and
 * the authored improvement, not the design's 74.9 → 78.4.
 */
export function RoiTab({ roi, currency = 'USD', onExport }) {
  const { t } = useTranslation('app')
  const months = trailingMonths()
  const topValue = Math.max(...roiStreamValues(roi))

  return (
    <div className="flex flex-col gap-4">
      {/* ── Value realisation ─────────────────────────────────────────── */}
      <Panel>
        <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
          <Icon name="gauge" size="sm" className="text-on-green" aria-hidden="true" />
          <h2 className="m-0 min-w-0 flex-1 text-title">{t('executive.roi.title')}</h2>
          <StateBadge tone="green">{t('executive.roi.validated')}</StateBadge>
          <ForgeButton size="sm" onClick={onExport}>
            <Icon name="doc" size="xs" />
            {t('executive.roi.exportModel')}
          </ForgeButton>
        </div>

        <dl className="m-0 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]">
          {[
            { key: 'investment', value: formatMoney(roi.investment, currency), tone: null },
            { key: 'benefit', value: formatMoney(roi.benefit, currency), tone: 'green' },
            { key: 'net', value: formatMoney(roi.netBenefit, currency), tone: 'green' },
            { key: 'roi', value: formatPercent(roi.roiPct, 0), tone: 'green' },
            {
              key: 'payback',
              value: t('executive.roi.months', { months: formatDecimal(roi.paybackMonths) }),
              tone: null,
            },
          ].map((entry) => (
            <div key={entry.key} className="rounded-sm border border-hairline bg-sunken p-3">
              <dt className="text-eyebrow font-semibold text-ink-dim">
                {t(`executive.roi.metric.${entry.key}`)}
              </dt>
              <Num
                as="dd"
                className="m-0 mt-1 block text-metric-sm leading-none"
                style={entry.tone ? { color: `var(--on-${entry.tone})` } : undefined}
              >
                {entry.value}
              </Num>
              <p className="mt-1 mb-0 text-micro text-ink-mute">
                {t(`executive.roi.metricSub.${entry.key}`)}
              </p>
            </div>
          ))}
        </dl>
      </Panel>

      <div className="grid gap-4 [grid-template-columns:minmax(0,1.1fr)_minmax(19rem,0.9fr)] max-xl:grid-cols-1">
        {/* ── Benefit attribution ───────────────────────────────────── */}
        <Panel>
          <CardHead
            eyebrow={t('executive.roi.attribution.eyebrow')}
            title={t('executive.roi.attribution.title')}
            right={
              <Num>
                {t('executive.roi.attribution.total', {
                  total: formatMoney(roi.benefit, currency),
                })}
              </Num>
            }
          />
          <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
            {roiStreams(roi).map((stream) => (
              <li key={stream.key}>
                <div className="mb-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                  <span className="min-w-0 flex-1 text-body-sm font-semibold">
                    {t(`executive.roi.stream.${stream.key}`)}
                  </span>
                  <Num className="text-body font-semibold text-on-green">
                    {formatMoney(stream.value, currency)}
                  </Num>
                  <Num className="w-10 text-end text-micro text-ink-mute">
                    {formatPercent((stream.value / roi.benefit) * 100, 0)}
                  </Num>
                </div>
                <div className="flex items-center gap-2">
                  <Bar value={(stream.value / topValue) * 100} tone="green" className="flex-1" />
                  <ConfidencePill value={stream.confidence} />
                </div>
                <Num className="mt-1 block text-micro leading-relaxed text-ink-dim">
                  {t(`executive.roi.basis.${stream.key}`, basisParams(stream.basis, currency))}
                </Num>
              </li>
            ))}
          </ul>
          <DemoNotice variant="roi" />
        </Panel>

        {/* ── Cumulative benefit ────────────────────────────────────── */}
        <Panel>
          <CardHead
            eyebrow={t('executive.roi.cumulative.eyebrow')}
            title={t('executive.roi.cumulative.title')}
          />
          <TrendChart
            series={[
              {
                key: 'benefit',
                label: t('executive.roi.metric.benefit'),
                values: roi.cumulative.map((value) => value / 1_000_000),
                tone: 'green',
              },
              {
                key: 'investment',
                label: t('executive.roi.metric.investment'),
                values: roi.cumulative.map(() => roi.investment / 1_000_000),
                tone: 'red',
              },
            ]}
            label={t('executive.roi.cumulative.chartLabel')}
            xLabel={t('executive.trajectory.xLabel')}
            xTicks={months}
            axisWidth={54}
            format={(value) => formatMoney(value * 1_000_000, currency)}
          />
          <div className="mt-2.5 flex items-center gap-2 rounded-sm tint-green px-2.5 py-2">
            <Icon name="check" size="xs" className="shrink-0 text-on-green" aria-hidden="true" />
            <Num className="text-body-sm text-on-green">
              {t('executive.roi.breakEven', { months: formatDecimal(roi.paybackMonths) })}
            </Num>
          </div>
        </Panel>
      </div>

      {/* ── Before / after ────────────────────────────────────────────── */}
      <Panel flush className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-2.5">
          <h2 className="m-0 flex-1 text-body-sm font-semibold">
            {t('executive.roi.baseline.title')}
          </h2>
          <span className="text-micro font-normal text-ink-dim">
            {t('executive.roi.baseline.note')}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-hairline">
                <th className="w-full px-4 py-2 text-start text-eyebrow font-semibold text-ink-dim">
                  {t('executive.roi.baseline.column.metric')}
                </th>
                <th className="px-3 py-2 text-end text-eyebrow font-semibold whitespace-nowrap text-ink-dim">
                  {t('executive.roi.baseline.column.before')}
                </th>
                <th className="px-3 py-2 text-end text-eyebrow font-semibold whitespace-nowrap text-ink-dim">
                  {t('executive.roi.baseline.column.now')}
                </th>
                <th className="px-4 py-2 text-end text-eyebrow font-semibold whitespace-nowrap text-ink-dim">
                  {t('executive.roi.baseline.column.change')}
                </th>
              </tr>
            </thead>
            <tbody>
              {roi.baseline.map((row) => (
                <tr key={row.key} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-2.5 font-medium">
                    {t(`executive.roi.baseline.row.${row.key}`)}
                  </td>
                  <td className="px-3 py-2.5 text-end whitespace-nowrap text-ink-mute">
                    <Num>{formatBaseline(t, row, row.before)}</Num>
                  </td>
                  <td className="px-3 py-2.5 text-end font-semibold whitespace-nowrap">
                    <Num>{formatBaseline(t, row, row.after)}</Num>
                  </td>
                  <td className="px-4 py-2.5 text-end whitespace-nowrap">
                    <Num
                      className={cn(
                        'font-semibold',
                        row.improving ? 'text-on-green' : 'text-on-red',
                      )}
                    >
                      {row.unit === 'points' || row.unit === 'percent'
                        ? t('executive.roi.baseline.points', {
                            points: formatSigned(row.deltaPts),
                          })
                        : `${formatSigned(row.changePct, 0)}%`}
                    </Num>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

/* The streams live on the model rather than being re-listed here; these two
   helpers exist only so the component never reaches past what it was handed. */
function roiStreams(roi) {
  return roi.streams
}
function roiStreamValues(roi) {
  return roi.streams.map((stream) => stream.value)
}

/**
 * A basis line's figures, formatted before they reach the sentence.
 *
 * Grouped in the reader's locale, so 812000 reads 812,000, and the rate carries
 * the site's currency rather than a hardcoded dollar sign — the prototype
 * writes "$9.3k/h" straight into the English string.
 */
function basisParams(basis, currency) {
  const out = {}
  for (const [key, value] of Object.entries(basis)) {
    out[key] =
      key === 'rate'
        ? formatCurrency(value, currency)
        : formatNumber(value, { maximumFractionDigits: 2 })
  }
  return out
}

/** A baseline cell, in the unit its row declares. */
function formatBaseline(t, row, value) {
  if (value == null) return '—'
  if (row.unit === 'percent' || row.unit === 'points') return formatPercent(value)
  return t('executive.hours', { hours: formatDecimal(value, value % 1 ? 1 : 0) })
}
