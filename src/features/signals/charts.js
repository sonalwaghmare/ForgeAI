import { get, post } from '@/services/http'
import { endpoints } from '@/services/endpoints'

/**
 * Timeseries Workstation — saved charts.
 *
 * DEMO. See `DEMO-MODE.md` §8.4. A chart is a named set of channels; everything
 * the Workstation prints about one is computed server-side from the traces it
 * plots, so the statistics panel, the series table and the AI banner are three
 * views of one computation rather than three claims that have to agree.
 */

/** The id the Workstation uses when nobody saved this selection. */
export const ADHOC = 'adhoc'

/**
 * Granularity, in minutes, offered by the toolbar select.
 *
 * A real parameter: it sets the sample count from the span, so switching from
 * 1h to 5m over a 24-hour window redraws at twelve times the resolution. The
 * prototype's select relabels nothing.
 */
export const GRANULARITIES = [5, 15, 60, 240, 1440]

/**
 * The plot modes behind the design's four unlabelled glyphs.
 *
 * The prototype draws `⊞ ∿ ↕ ≡` as four buttons with no handler and no tooltip.
 * These are the three that a dual-axis multi-series chart actually wants, each
 * with a translated label, and `normalised` earns its place: it is the only way
 * to compare the SHAPE of a vibration trace and a temperature trace, which is
 * exactly what this screen is for.
 */
export const PLOT_MODES = ['overlay', 'stacked', 'normalised']

/* The design's New Chart dialog also offers a chart TYPE — line, area, scatter,
   bar — and its Workstation draws lines whichever is picked. There is no type
   control here on purpose: `PLOT_MODES` above is the same axis of choice, it
   lives on the toolbar where the chart is, and it takes effect. A stored type
   that the viewer then overrides would be two controls for one decision. */

/** The five side-rail panels, in the design's order. */
export const WORKSTATION_PANELS = ['alerts', 'history', 'correlation', 'statistics', 'export']

/** The catalogue. */
export async function fetchCharts(signal) {
  const data = await get(endpoints.charts.list, { signal })
  return { items: data?.items ?? [] }
}

/**
 * One chart, resolved for a span.
 *
 * `signalIds` overrides the stored membership when the reader has added or
 * removed a series — that lives in the URL, so a modified saved chart can be
 * sent to somebody without being written to.
 */
export async function fetchChart({ chartId, window, from, to, granularity, signalIds }, signal) {
  return get(endpoints.charts.detail(chartId), {
    signal,
    params: {
      window,
      from,
      to,
      granularity,
      signals: signalIds?.length ? signalIds.join(',') : undefined,
    },
  })
}

/** Create one. The catalogue gains it and the Workstation can open it. */
export const createChart = (body) => post(endpoints.charts.list, body)

/**
 * The chart, as the CSV somebody asked Export for.
 *
 * Built here rather than on the server because the rows ARE what is on screen:
 * one column per visible series, one row per sample, the timestamps the axis
 * used. An export that quietly included the series the reader had hidden would
 * not be an export of this chart.
 */
export function chartToCsv(chart, visible) {
  const series = chart.series.filter((entry) => visible[entry.id] !== false)
  const header = ['timestamp', ...series.map((entry) => `${entry.name} (${entry.unit})`)]
  const rows = chart.stamps.map((stamp, index) => [
    stamp,
    ...series.map((entry) => entry.values[index] ?? ''),
  ])
  // Quoted, because a series name legitimately contains a comma — "Vibration
  // RMS, drive end" would otherwise shift every column after it, which is the
  // same trap the import parser exists to handle from the other direction.
  const escape = (value) => `"${String(value).replace(/"/g, '""')}"`
  return [header, ...rows].map((row) => row.map(escape).join(',')).join('\n')
}
