import { PEOPLE } from './enterprise'
import { ALERTS } from './alerts'
import { ASSET_OPS, assetMaintenance } from './lines'
import { SIGNAL_CHANNELS, stampsFor, stateOf, traceFor, windowSpec } from './signals'

/**
 * Timeseries Workstation — saved charts, and everything computed off one.
 *
 * SYNTHETIC, like everything in this directory. Gated on `VITE_DEMO_MODE`.
 *
 * ── What is authored here, and it is very little ──────────────────────────
 * A saved chart is a NAME, an AUTHOR, an AGE and a MEMBERSHIP RULE. Nothing
 * else. The channels come from `signals.js`, their traces from the same
 * generator the Explorer draws, and every figure the Workstation prints —
 * minimum, maximum, mean, standard deviation, P95, the correlation coefficients,
 * the AI insight's own number — is computed from those traces at request time.
 *
 * That is the whole difference from the prototype. There, `TS_SERIES` authors
 * `min: 0, max: 80, mean: 38.4` beside a `tsGen()` that produces different
 * numbers; the statistics panel authors a THIRD set that matches neither; and
 * the AI banner states `r = −0.87` as a literal. Four independent claims about
 * one array. Here there is one array and everything is counted off it, so the
 * panel, the table and the banner cannot disagree.
 *
 * ── The plant is ours ─────────────────────────────────────────────────────
 * The prototype's eight saved charts are about a Chennai plant's heat exchanger
 * HX-204, turbine T-03, furnace F-01 and seamer SM-01, none of which exist here.
 * Its flagship, though, is "Compressor C-12 · Vibration & Bearing Analysis",
 * whose story is a coolant flow falling to zero and a bearing temperature
 * climbing after it — and that is `ALR-4470` on `FDY-CMP-12`, already in our
 * universe, already the reason Line 1 is stopped. So the flagship maps straight
 * across and the other seven are rebuilt from Meridian's own machines.
 */

/* ── Series colour ────────────────────────────────────────────────────────
   In a chart of one sensor the hue is the STATE, and `SignalTrace` is right to
   own that. In a chart of four, the hue is IDENTITY — it is what ties a line to
   its row in the table and its entry in the legend — and the state gets a column
   of its own so nothing is lost. `TrendChart` already made this call for OEE;
   this is the same call, and the same ordered list of tokens rather than a
   rainbow picked per chart. */
const SERIES_TONES = ['forge', 'ack', 'violet', 'green', 'amber', 'watch']

/**
 * The saved charts.
 *
 * `signals` is a membership rule, not a list of ids: "these kinds on this
 * asset". Written that way so a chart cannot come to name a channel that no
 * longer exists — the resolver simply returns fewer, and `verify:mocks` asserts
 * every saved chart still resolves to at least two.
 *
 * `ageDays` rather than a date, for the same reason `detectedMinutesAgo` is
 * minutes: a date authored today is last year's date by the next demo.
 */
export const SAVED_CHARTS = [
  {
    id: 'chart_cmp12',
    name: 'Compressor C-12 · Coolant loss & bearing temperature',
    signals: [{ assetId: 'FDY-CMP-12', kinds: ['flow', 'temperature', 'pressure', 'vibration'] }],
    authorRole: 'reliability',
    ageDays: 0,
  },
  {
    id: 'chart_bm03',
    name: 'Bodymaker 3 · Drive-end vibration & bearing temp',
    signals: [{ assetId: 'FDY-BM-03', kinds: ['vibration', 'temperature'] }],
    authorRole: 'operator',
    ageDays: 1,
  },
  {
    id: 'chart_wsh01',
    name: 'Washer · Coolant supply & wash chemistry',
    signals: [{ assetId: 'FDY-WSH-01', kinds: ['flow', 'pressure', 'conductivity', 'temperature'] }],
    authorRole: 'reliability',
    ageDays: 2,
  },
  {
    id: 'chart_ovn01',
    name: 'IBO Oven · Zone 3 temperature profile',
    signals: [{ assetId: 'FDY-OVN-01', kinds: ['temperature', 'flow'] }],
    authorRole: 'manager',
    ageDays: 3,
  },
  {
    id: 'chart_dec02',
    name: 'Decorator 2 · Ink pump pressure & motor current',
    signals: [{ assetId: 'FDY-DEC-02', kinds: ['pressure', 'current'] }],
    authorRole: 'operator',
    ageDays: 5,
  },
  {
    id: 'chart_pal02',
    name: 'Palletizer 2 · Acoustic emission & current',
    signals: [{ assetId: 'FDY-PAL-02', kinds: ['acoustic', 'current'] }],
    authorRole: 'manager',
    ageDays: 8,
  },
  {
    id: 'chart_wtm04',
    name: 'Shell Press 4 · Vibration trend, Weißenthurm',
    signals: [{ assetId: 'WTM-PRS-04', kinds: ['vibration', 'current'] }],
    authorRole: 'reliability',
    ageDays: 11,
  },
  {
    id: 'chart_line1',
    name: 'Line 1 · Coolant chain, cupper to washer',
    // The one multi-asset chart, and the one that makes the point: the Washer's
    // flow meter and the compressor that feeds it, on one plot.
    signals: [
      { assetId: 'FDY-CMP-12', kinds: ['flow'] },
      { assetId: 'FDY-WSH-01', kinds: ['flow', 'pressure'] },
      { assetId: 'FDY-BM-03', kinds: ['temperature'] },
    ],
    authorRole: 'reliability',
    ageDays: 14,
  },
]

/* Charts created through the New Chart dialog land here, at module scope, so
   they survive for the session and appear in the catalogue exactly as the saved
   ones do. Same arrangement as the uploaded documents register. */
const CREATED = []

/** Every chart the catalogue lists — newest first, created ones included. */
export const allCharts = () => [...CREATED, ...SAVED_CHARTS]

/** Create one from the dialog. Membership arrives as explicit channel ids. */
export function addChart({ name, signalIds = [], type = 'line' }) {
  const chart = {
    id: `chart_${CREATED.length + 1}_${signalIds.length}`,
    // Null rather than "Untitled chart": a blank name means "name it after
    // what is in it", which `chartName()` does, and which is what the dialog's
    // hint promises.
    name: name?.trim() || null,
    // An explicit list rather than a rule: the reader ticked these boxes, and
    // widening the selection later because the asset gained a sensor would not
    // be honouring what they asked for.
    signalIds,
    type,
    authorRole: 'manager',
    ageDays: 0,
    created: true,
  }
  CREATED.unshift(chart)
  return chart
}

/**
 * What to call a chart nobody named.
 *
 * An ad-hoc chart — the one a channel card opens — has no stored name, and the
 * Workstation was falling back to the words "Unsaved chart" as its heading. That
 * is a status, not a title: it says nothing about what is on the screen, and it
 * is the same heading for all forty-five channels.
 *
 * So the name is composed from the membership, which is the only thing that
 * distinguishes one of these from another:
 *
 *   one channel on one machine   → `Bodymaker 3 · Vibration RMS`
 *   several on one machine       → `Compressor C-12 · 4 channels`
 *   several machines on one line → `Line 1 · 4 channels, 3 assets`
 *   several lines                → `Findlay Plant · 6 channels, 4 assets`
 *
 * The "unsaved" fact does not disappear — it moves to a badge beside the title,
 * where a status belongs, and Save as chart offers this text as the name.
 */
export function chartName(chart, members) {
  if (chart.name) return chart.name
  if (!members.length) return null

  const assets = [...new Set(members.map((channel) => channel.assetId))]
  const lines = [...new Set(members.map((channel) => channel.lineId))]

  if (members.length === 1) return `${members[0].assetName} · ${members[0].name}`
  if (assets.length === 1) return `${members[0].assetName} · ${members.length} channels`
  const scope = lines.length === 1 ? members[0].lineName : members[0].siteName
  return `${scope} · ${members.length} channels, ${assets.length} assets`
}

/** The channels a chart is made of, in the order it lists them. */
export function chartChannels(chart, channels = SIGNAL_CHANNELS) {
  if (chart.signalIds) {
    return chart.signalIds
      .map((id) => channels.find((channel) => channel.id === id))
      .filter(Boolean)
  }
  return (chart.signals ?? []).flatMap((member) =>
    channels.filter(
      (channel) => channel.assetId === member.assetId && member.kinds.includes(channel.kind),
    ),
  )
}

/* ── Statistics ───────────────────────────────────────────────────────────
   Computed, every one of them, from the array actually plotted. */

const round = (value, digits = 2) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function statsFor(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return {
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
    mean: round(mean),
    // Population rather than sample: this is the whole window, not a draw from
    // it. Saying which is the difference between a statistic and a number.
    stdDev: round(Math.sqrt(variance)),
    p95: round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]),
  }
}

/** Pearson's r. Returns null where either series does not vary — r is undefined. */
export function correlation(a, b) {
  const n = Math.min(a.length, b.length)
  if (n < 3) return null
  const meanA = a.slice(0, n).reduce((sum, value) => sum + value, 0) / n
  const meanB = b.slice(0, n).reduce((sum, value) => sum + value, 0) / n
  let numerator = 0
  let sqA = 0
  let sqB = 0
  for (let index = 0; index < n; index += 1) {
    const dA = a[index] - meanA
    const dB = b[index] - meanB
    numerator += dA * dB
    sqA += dA * dA
    sqB += dB * dB
  }
  if (sqA === 0 || sqB === 0) return null
  return round(numerator / Math.sqrt(sqA * sqB), 2)
}

/**
 * Which axis each series belongs on.
 *
 * By UNIT, which is the only thing that makes two series comparable on one
 * scale. The first unit takes the left axis; everything else shares the right,
 * whose label names all of them — `°F / gal/min`, exactly as the design draws
 * it. Two axes is the ceiling: a third would be a scale nobody can read a value
 * off, and a chart of five units is a chart that should be five charts.
 */
function assignAxes(channels) {
  const units = [...new Set(channels.map((channel) => channel.unit))]
  const left = units[0] ?? null
  const right = units.slice(1)
  return {
    left: { unit: left, label: left ?? '' },
    right: right.length ? { units: right, label: right.join(' / ') } : null,
    axisOf: (channel) => (channel.unit === left ? 'left' : 'right'),
  }
}

/** The domain for one axis, widened to hold every band edge it has to draw. */
function domainFor(series) {
  if (!series.length) return [0, 1]
  const values = series.flatMap((entry) => [
    ...entry.values,
    ...(entry.band ?? []).filter((value) => value != null),
  ])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = (max - min || 1) * 0.08
  return [round(Math.min(0, min) === 0 && min >= 0 ? Math.max(0, min - pad) : min - pad), round(max + pad)]
}

/**
 * The events worth marking on the plot, from records that already exist.
 *
 * Anomaly onsets come from the alert's own `detectedMinutesAgo`, and the
 * maintenance window from `assetMaintenance()` — the same record the asset's
 * Maintenance tab prints its calendar from. Both are filtered to the span, so a
 * marker is never drawn off the edge of the chart, and the prototype's fixed
 * "May 25–26" shading cannot outlive the month it was written in.
 */
function eventsFor(channels, spec, stamps) {
  const start = Date.parse(stamps[0])
  const end = Date.parse(stamps[stamps.length - 1])
  const within = (at) => at >= start && at <= end
  const ratio = (at) => (at - start) / (end - start || 1)

  const anomalies = channels
    .map((channel) => {
      if (!channel.alertId) return null
      const alert = ALERTS.find((entry) => entry.id === channel.alertId)
      if (!alert) return null
      const at = Date.now() - alert.detectedMinutesAgo * 60_000
      if (!within(at)) return null
      return {
        kind: 'anomaly',
        at: new Date(at).toISOString(),
        ratio: round(ratio(at), 4),
        label: alert.sensor,
        alertId: alert.id,
        severity: alert.severity,
        channelId: channel.id,
      }
    })
    .filter(Boolean)

  const maintenance = [...new Set(channels.map((channel) => channel.assetId))]
    .flatMap((assetId) => {
      const ops = ASSET_OPS[assetId]
      if (!ops) return []
      const record = assetMaintenance(assetId, ops)
      return record.events.map((event) => ({ ...event, assetId, windowHours: record.windowHours }))
    })
    .map((event) => {
      const at = Date.parse(event.at)
      if (!within(at)) return null
      const span = event.windowHours * 3_600_000
      return {
        kind: 'window',
        at: event.at,
        label: event.label,
        assetId: event.assetId,
        from: round(ratio(at), 4),
        to: round(Math.min(1, ratio(at + span)), 4),
      }
    })
    .filter(Boolean)

  return { anomalies, maintenance }
}

/**
 * The AI insight, composed.
 *
 * The prototype writes one paragraph with `r = −0.87` in it and shows it on
 * every chart. Here the pair is whichever two series in THIS chart correlate
 * most strongly, the coefficient is the one just computed from their plotted
 * values, and the alert named is a real open one on one of them — so the banner
 * cannot claim a relationship the chart does not show.
 *
 * Null when nothing in the chart correlates above 0.6. A banner that fires on
 * every chart is a banner nobody reads, and "these four series are unrelated" is
 * not an insight worth a violet stripe.
 */
function insightFor(series) {
  let best = null
  for (let i = 0; i < series.length; i += 1) {
    for (let j = i + 1; j < series.length; j += 1) {
      const r = correlation(series[i].values, series[j].values)
      if (r == null) continue
      if (!best || Math.abs(r) > Math.abs(best.r)) best = { r, a: series[i], b: series[j] }
    }
  }
  if (!best || Math.abs(best.r) < 0.6) return null

  const alerted = [best.a, best.b].find((entry) => entry.alertId)
  const alert = alerted ? ALERTS.find((entry) => entry.id === alerted.alertId) : null

  return {
    r: best.r,
    direction: best.r < 0 ? 'negative' : 'positive',
    strength: Math.abs(best.r) >= 0.8 ? 'strong' : 'moderate',
    a: { id: best.a.id, name: best.a.name, unit: best.a.unit, value: best.a.value },
    b: { id: best.b.id, name: best.b.name, unit: best.b.unit, value: best.b.value },
    alertId: alert?.id ?? null,
    alertSeverity: alert?.severity ?? null,
    assetId: alerted?.assetId ?? best.a.assetId,
    assetName: alerted?.assetName ?? best.a.assetName,
  }
}

/** Every correlated pair in the chart, strongest first — the Correlation panel. */
function correlationsFor(series) {
  const pairs = []
  for (let i = 0; i < series.length; i += 1) {
    for (let j = i + 1; j < series.length; j += 1) {
      const r = correlation(series[i].values, series[j].values)
      if (r == null) continue
      pairs.push({
        aId: series[i].id,
        bId: series[j].id,
        a: series[i].name,
        b: series[j].name,
        r,
        strength: Math.abs(r) >= 0.8 ? 'strong' : Math.abs(r) >= 0.5 ? 'moderate' : 'weak',
        direction: r < 0 ? 'negative' : 'positive',
      })
    }
  }
  return pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
}

/**
 * One chart, fully resolved for a span.
 *
 * Everything the Workstation renders comes out of here: the series with their
 * traces and statistics, both axis domains, the threshold rules, the event
 * markers, the correlation table and the insight. The screen computes nothing,
 * which is what keeps the panels, the table and the banner agreeing.
 */
export function composeChart(chart, params = {}, channels = SIGNAL_CHANNELS) {
  const spec = windowSpec(params)
  const stamps = stampsFor(spec)
  const members = chartChannels(chart, channels)
  const axes = assignAxes(members)

  const series = members.map((channel, index) => {
    const values = traceFor(channel, spec)
    return {
      id: channel.id,
      key: channel.key,
      name: channel.name,
      tag: channel.tag,
      description: [channel.assetName, channel.component].filter(Boolean).join(' · '),
      unit: channel.unit,
      band: channel.band,
      value: channel.value,
      state: stateOf(channel),
      alertId: channel.alertId,
      alertSeverity: channel.alertSeverity,
      assetId: channel.assetId,
      assetName: channel.assetName,
      assetCode: channel.assetCode,
      lineName: channel.lineName,
      siteName: channel.siteName,
      kind: channel.kind,
      tone: SERIES_TONES[index % SERIES_TONES.length],
      axis: axes.axisOf(channel),
      values,
      stats: statsFor(values),
    }
  })

  /* `PEOPLE` is an OBJECT keyed by `operator` / `manager` / `reliability` /
     `exec`, and each entry's own `.role` is a different string again
     (`lineOperator`, `plantManager`). `authorRole` above is the KEY, so this is
     a lookup and not a find — see DEMO-MODE.md §2.7, which exists because
     getting this wrong once read as "cannot reach the platform". */
  const person = PEOPLE[chart.authorRole] ?? null

  return {
    id: chart.id,
    // Composed where nobody named it. `named` says which, so the header can
    // badge an unsaved chart without borrowing the title to do it.
    name: chartName(chart, members),
    named: Boolean(chart.name),
    created: Boolean(chart.created),
    author: person?.name ?? null,
    // An instant, formatted by the client. Same rule as everywhere else.
    savedAt: new Date(Date.now() - chart.ageDays * 86_400_000).toISOString(),
    window: spec.key,
    span: {
      hours: spec.hours,
      points: spec.points,
      granularityMinutes: spec.granularityMinutes ?? null,
      from: stamps[0],
      to: stamps[stamps.length - 1],
    },
    stamps,
    series,
    axes: {
      left: { ...axes.left, domain: domainFor(series.filter((entry) => entry.axis === 'left')) },
      right: axes.right
        ? { ...axes.right, domain: domainFor(series.filter((entry) => entry.axis === 'right')) }
        : null,
    },
    /* The threshold rules the plot draws and the Alerts panel lists — ONE list,
       so a rule cannot appear on the chart and be missing from the panel. Each
       is the band edge that the channel's own alert is about, or the upper edge
       where there is no alert. */
    rules: series.map((entry) => ({
      seriesId: entry.id,
      name: entry.name,
      tone: entry.tone,
      axis: entry.axis,
      value: entry.value < entry.band[0] ? entry.band[0] : entry.band[1],
      direction: entry.value < entry.band[0] ? 'below' : 'above',
      unit: entry.unit,
      breached: entry.value < entry.band[0] || entry.value > entry.band[1],
      severity: entry.alertSeverity,
      alertId: entry.alertId,
    })),
    events: eventsFor(members, spec, stamps),
    correlations: correlationsFor(series),
    insight: insightFor(series),
    /* The hierarchy line under the title. Taken from the first series' own
       record rather than authored, so it cannot say Chennai on a can plant. */
    path: members[0]
      ? { site: members[0].siteName, line: members[0].lineName, asset: members[0].assetName }
      : null,
    /* True when every series is on one machine. The header says "Compressor
       C-12" in that case and "3 assets" otherwise, rather than naming the first
       one and quietly hiding the rest. */
    assetCount: new Set(members.map((channel) => channel.assetId)).size,
  }
}
