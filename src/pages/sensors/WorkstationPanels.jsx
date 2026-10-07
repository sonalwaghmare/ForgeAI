import { useTranslation } from 'react-i18next'
import { ForgeButton } from '@/components/forge/ForgeButton'
import { Icon } from '@/components/forge/Icon'
import { IconButton } from '@/components/forge/ForgeButton'
import { Panel } from '@/components/forge/Panel'
import { StateBadge } from '@/components/forge/StatusBadge'
import { Eyebrow, Mono, Num } from '@/components/forge/primitives'
import { formatDateTime, formatDecimal } from '@/lib/format'
import { formatMeasure } from '@/lib/units'

/**
 * The five side-rail panels.
 *
 * DEMO. Every figure in here is computed in the handler from the traces the plot
 * draws — see `mocks/fixtures/charts.js`. The prototype authors a statistics
 * table whose numbers match neither its own series nor the correlation panel
 * beside it, and states `r = −0.87` as a literal on every chart.
 *
 * Two panels are not what the design has, and both are the honest version:
 * **History** is a working undo stack over the chart's own edits rather than the
 * prototype's static sentence "Undo the last 10 chart changes"; **Export**
 * actually exports, as CSV and PNG, rather than listing four formats it does not
 * produce. Excel and PDF are not offered, because they are not built.
 */

const CORRELATION_TONE = { strong: 'red', moderate: 'amber', weak: null }

export function WorkstationPanel({ panel, chart, history, onUndo, onExportCsv, onExportPng, onClose }) {
  const { t } = useTranslation(['app', 'common'])

  return (
    <Panel className="mb-3.5">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="m-0 flex-1 text-title">{t(`sensors.workstation.panel.${panel}`)}</h2>
        <IconButton label={t('common:actions.close')} onClick={onClose}>
          <Icon name="x" size="sm" />
        </IconButton>
      </div>

      {panel === 'alerts' ? <AlertsPanel chart={chart} t={t} /> : null}
      {panel === 'history' ? <HistoryPanel history={history} onUndo={onUndo} t={t} /> : null}
      {panel === 'correlation' ? <CorrelationPanel chart={chart} t={t} /> : null}
      {panel === 'statistics' ? <StatisticsPanel chart={chart} t={t} /> : null}
      {panel === 'export' ? (
        <ExportPanel chart={chart} onCsv={onExportCsv} onPng={onExportPng} t={t} />
      ) : null}
    </Panel>
  )
}

/**
 * The threshold rules on this chart, and whether each is breached.
 *
 * The same `chart.rules` array the plot draws its dashed lines from, so a rule
 * cannot be on the chart and missing from this list. The prototype authors three
 * rules in the panel and two in the chart.
 */
function AlertsPanel({ chart, t }) {
  if (!chart.rules.length) {
    return <p className="m-0 text-body-sm text-ink-dim">{t('sensors.workstation.noRules')}</p>
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {chart.rules.map((rule) => (
        <li
          key={rule.seriesId}
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-sm border border-hairline bg-sunken px-3 py-2.5"
        >
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-4 shrink-0 rounded-full"
            style={{ backgroundColor: `var(--hue-${rule.tone})` }}
          />
          <span className="min-w-0 flex-1 text-body-sm">
            {rule.name}
            <Num className="ms-1.5 text-ink-dim">
              {t(`sensors.workstation.rule.${rule.direction}`, {
                value: formatMeasure({ value: rule.value, unit: rule.unit }),
              })}
            </Num>
          </span>
          {rule.alertId ? <Mono className="text-micro text-ink-dim">{rule.alertId}</Mono> : null}
          <StateBadge tone={rule.breached ? (rule.severity === 'critical' ? 'red' : 'amber') : 'green'}>
            {t(rule.breached ? 'sensors.workstation.breached' : 'sensors.workstation.withinLimits')}
          </StateBadge>
        </li>
      ))}
    </ul>
  )
}

/**
 * Undo.
 *
 * A real stack of the edits made to this chart in this session — a series
 * hidden, added or removed — most recent first, each restoring the state before
 * it. The design's panel is the sentence "Undo the last 10 chart changes" with
 * nothing behind it; ten is where this one caps, so the sentence is now true.
 */
function HistoryPanel({ history, onUndo, t }) {
  if (!history.length) {
    return <p className="m-0 text-body-sm text-ink-dim">{t('sensors.workstation.noHistory')}</p>
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {history.map((entry, index) => (
        <li
          key={entry.id}
          className="flex items-center gap-3 rounded-sm border border-hairline bg-sunken px-3 py-2"
        >
          <Icon name="rail" size="xs" className="shrink-0 text-ink-mute" />
          <span className="min-w-0 flex-1 text-body-sm">{entry.label}</span>
          <Num className="shrink-0 text-micro font-normal text-ink-dim">
            {formatDateTime(entry.at, { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
          </Num>
          {/* Only the most recent is undoable. An undo stack that lets you pull
              an entry out of the middle is not an undo stack. */}
          {index === 0 ? (
            <ForgeButton size="sm" onClick={onUndo}>
              {t('sensors.workstation.undo')}
            </ForgeButton>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/** Every pair in the chart, strongest first. Pearson's r, actually computed. */
function CorrelationPanel({ chart, t }) {
  if (!chart.correlations.length) {
    return <p className="m-0 text-body-sm text-ink-dim">{t('sensors.workstation.noPairs')}</p>
  }
  return (
    <ul className="m-0 grid list-none gap-2 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))]">
      {chart.correlations.map((pair) => {
        const tone = CORRELATION_TONE[pair.strength]
        return (
          <li
            key={`${pair.aId}-${pair.bId}`}
            className="rounded-sm border border-hairline bg-sunken px-3 py-2.5"
          >
            <p className="m-0 text-body-sm font-semibold">
              {pair.a} <span className="font-normal text-ink-dim">×</span> {pair.b}
            </p>
            <p className="m-0 mt-1 flex items-baseline gap-2">
              <Num
                className="text-title font-semibold"
                style={tone ? { color: `var(--on-${tone})` } : undefined}
              >
                r = {formatDecimal(pair.r, 2)}
              </Num>
              <span className="text-micro font-normal text-ink-dim">
                {t(`sensors.workstation.correlation.${pair.strength}`)} ·{' '}
                {t(`sensors.workstation.correlation.${pair.direction}`)}
              </span>
            </p>
          </li>
        )
      })}
    </ul>
  )
}

/** Min, max, mean, standard deviation and P95 — over the plotted values. */
function StatisticsPanel({ chart, t }) {
  const columns = ['min', 'max', 'mean', 'stdDev', 'p95']
  return (
    <div className="-mx-4.5 -mb-4.5 overflow-x-auto">
      <table className="w-full border-collapse text-body-sm">
        <thead>
          <tr className="border-b border-hairline">
            <th className="px-4.5 py-2 text-start text-eyebrow font-semibold text-ink-dim">
              {t('sensors.workstation.column.tag')}
            </th>
            {columns.map((column) => (
              <th
                key={column}
                className="px-3 py-2 text-end text-eyebrow font-semibold whitespace-nowrap text-ink-dim"
              >
                {t(`sensors.workstation.column.${column}`)}
              </th>
            ))}
            <th className="px-4.5 py-2 text-start text-eyebrow font-semibold text-ink-dim">
              {t('sensors.workstation.column.unit')}
            </th>
          </tr>
        </thead>
        <tbody>
          {chart.series.map((entry) => (
            <tr key={entry.id} className="border-b border-hairline last:border-0">
              <td className="px-4.5 py-2">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-0.5 w-4 shrink-0 rounded-full"
                    style={{ backgroundColor: `var(--hue-${entry.tone})` }}
                  />
                  {entry.name}
                </span>
              </td>
              {columns.map((column) => (
                <td key={column} className="px-3 py-2 text-end whitespace-nowrap">
                  <Num>{formatDecimal(entry.stats[column], 2)}</Num>
                </td>
              ))}
              <td className="px-4.5 py-2 text-ink-dim">{entry.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Export.
 *
 * Two buttons, both of which do the thing. CSV is the plotted points of the
 * VISIBLE series with the axis' own timestamps; PNG is the chart as it stands,
 * rendered off its own SVG. The design lists CSV, PNG, Excel and PDF behind a
 * sentence and produces none of them; the two that are not built are not
 * offered, which is the difference between a demo and a mock-up.
 */
function ExportPanel({ chart, onCsv, onPng, t }) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <ForgeButton onClick={onCsv}>
          <Icon name="doc" size="xs" />
          {t('sensors.workstation.exportCsv')}
        </ForgeButton>
        <ForgeButton onClick={onPng}>
          <Icon name="chart" size="xs" />
          {t('sensors.workstation.exportPng')}
        </ForgeButton>
      </div>
      <Eyebrow className="mt-3.5 mb-1">{t('sensors.workstation.exportScope')}</Eyebrow>
      <p className="m-0 text-body-sm text-ink-dim">
        <Num>
          {t('sensors.workstation.exportNote', {
            series: chart.series.length,
            points: chart.span.points,
          })}
        </Num>
      </p>
    </div>
  )
}
