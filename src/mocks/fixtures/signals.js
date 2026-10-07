import { HIERARCHY_NODES } from './hierarchy'
import { ALERTS } from './alerts'
import { ASSET_COMPONENTS, ASSET_OPS, noise, series, specFor } from './lines'

/**
 * Sensor Explorer — the channel catalogue.
 *
 * SYNTHETIC, like everything in this directory. Gated on `VITE_DEMO_MODE`.
 *
 * ── This file authors no channels ─────────────────────────────────────────
 * Every row it produces is composed. The plant comes from `HIERARCHY_NODES`,
 * which asset carries which instrument comes from `ASSET_OPS[…].sensors`, the
 * two component-modelled machines contribute their real tags from
 * `ASSET_COMPONENTS`, the band and unit come from `SIGNAL_SPEC` at the SITE's
 * unit system, and every reading that is out of limits comes from `ALERTS`.
 *
 * The consequence is the point: the Sensor Explorer cannot list a channel the
 * asset does not have, cannot print a band the asset's own Signal Trend
 * disagrees with, and cannot show a healthy reading on an instrument the anomaly
 * list says is in alarm. The prototype's version authors 3 assets × 4 sensors as
 * one array with hardcoded values, hardcoded series and a hardcoded state, so
 * all three of those contradictions are available at once.
 *
 * ── A channel is not a sensor record ──────────────────────────────────────
 * `/v1/sensors` is LIVE and is the CONFIGURATION of a tag — its name, its
 * waveform type, which connection reads it. This is the measured channel: a
 * band, a current reading, a state and a trace. Two resources, one noun, exactly
 * as `/v1/production-lines` sits beside the hierarchy's `/v1/lines`. Nothing
 * here goes near the live prefix.
 *
 * ── One source, and the fixture says so ───────────────────────────────────
 * `CONNECTORS` in `operations.js` declares three connected systems and exactly
 * one of them — the OT historian, OPC-UA — provides `signals`. The MES row
 * explicitly declares `doesNotProvide: ['vibration']`. So every channel here
 * arrives from that one connector, and the filter drawer states that fact rather
 * than offering a four-option "Source system" select where three options would
 * always return nothing. See DEMO-MODE.md §8.4.
 */

/* ── Windows ──────────────────────────────────────────────────────────────
   The timeframe pills, and the only thing that decides how many points a trace
   has. `hours` is what the x-axis spans; `points` is the sample count at that
   span. Both are needed: a 30-day trace at 60 points is a twelve-hour sample
   interval, and the axis label has to be able to say so. */
export const SIGNAL_WINDOWS = {
  '1h': { hours: 1, points: 60 },
  '6h': { hours: 6, points: 72 },
  '24h': { hours: 24, points: 96 },
  '7d': { hours: 24 * 7, points: 84 },
  '30d': { hours: 24 * 30, points: 90 },
}

export const SIGNAL_WINDOW_KEYS = Object.keys(SIGNAL_WINDOWS)

/** The default the explorer opens on, and the window every card is drawn at. */
export const DEFAULT_SIGNAL_WINDOW = '24h'

/** The three states a channel can be in, worst first. */
export const SIGNAL_STATES = ['violation', 'warning', 'ok']

const round = (value, digits = 2) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/* ── Alerts → channels ────────────────────────────────────────────────────
   An alert names its sensor in prose ("Zone 3 Temp", "Spindle Vibration",
   "Suction Pressure") while an asset declares its instruments as kinds
   (`temperature`, `vibration`, `pressure`). Classifying the first into the
   second by keyword rather than by a lookup table means a new alert on a new
   instrument lands on the right channel without anything being registered
   anywhere. */
const KIND_KEYWORDS = [
  ['vibration', 'vibration'],
  ['temp', 'temperature'],
  ['pressure', 'pressure'],
  ['flow', 'flow'],
  ['conductivity', 'conductivity'],
  ['acoustic', 'acoustic'],
  ['current', 'current'],
  ['vision', 'vision'],
]

/** The instrument kind an alert is about, or null if it names none of them. */
export function kindOfAlert(alert) {
  const name = (alert.sensor ?? '').toLowerCase()
  return KIND_KEYWORDS.find(([needle]) => name.includes(needle))?.[1] ?? null
}

/**
 * The normal operating band for a channel that is in alarm.
 *
 * The threshold is always the edge that was breached, and which edge that is
 * follows from the direction: `ALR-4469` reads 402 °F against a threshold of 385
 * and a baseline of 368, so 385 is the TOP of the band; `ALR-4459` reads 41
 * L/min against a threshold of 48 and a baseline of 52, so 48 is the BOTTOM.
 * The opposite edge is the baseline reflected across the threshold, then pulled
 * back to the kind's generic band where that is the tighter of the two — which
 * is how the Bodymaker's vibration band stays at the 0.08 in/s the asset detail
 * prints rather than widening to zero.
 *
 * Taking the band from the alert rather than from the generic spec is what makes
 * the oven's Zone 3 burner legible: a 402 °F reading over a bearing-temp band of
 * 140–185 draws a trace that leaves the chart.
 */
function bandFromAlert(alert, spec) {
  const threshold = alert.threshold?.value
  const baseline = alert.baseline?.value
  if (threshold == null || baseline == null) return spec?.band ?? null

  // The generic band only participates when it is denominated in the same unit.
  const generic = spec && spec.unit === alert.threshold.unit ? spec.band : null

  if (threshold >= baseline) {
    const reflected = 2 * baseline - threshold
    return [round(Math.max(generic?.[0] ?? 0, reflected)), threshold]
  }
  const reflected = 2 * baseline - threshold
  return [threshold, round(Math.min(generic?.[1] ?? Infinity, reflected))]
}

/**
 * The anomaly signature a channel's trace has to show.
 *
 * Read off the alert's own `anomalyType`, so a frozen signal draws a flat tail
 * and a drift draws a ramp — rather than the prototype's arrangement, where the
 * shape is picked per card by hand and a "Frozen Signal" anomaly is plotted as a
 * sine wave.
 */
function shapeFromAlert(alert) {
  if (!alert) return {}
  switch (alert.anomalyType) {
    case 'frozenSignal':
      return { holdFrom: 0.72, holdAt: alert.reading.value }
    case 'thermalDrift':
    case 'drift':
      return { drift: 3.4 }
    case 'bearingWear':
      return { drift: 4.1 }
    case 'oscillation':
      return { freq: 9 }
    case 'pressureSurge':
      return { spikeAt: 0.78, drift: 1.2 }
    case 'flowRestriction':
    case 'contamination':
      return { drift: 2.6 }
    default:
      return { drift: 3.1, spikeAt: 0.74 }
  }
}

/* ── The catalogue ────────────────────────────────────────────────────────
   Built once at module load, deterministically, so that the scope tree's counts
   and the grid's rows are the same set of records counted twice rather than two
   numbers that have to agree. */

const nodeById = new Map(HIERARCHY_NODES.map((node) => [node.id, node]))

/** The site a node sits under, walking up. */
function siteOf(node) {
  let current = node
  while (current && current.tier !== 'site') current = nodeById.get(current.parentId)
  return current ?? null
}

/** Uppercase channel key → an OPC-UA node id in the historian's own spelling. */
const tagFor = (siteCode, assetCode, key) =>
  `ns=2;s=PLC1.${siteCode}.${assetCode.replace(/-/g, '').slice(3)}.${key}`

/**
 * Every channel on one asset.
 *
 * Component-modelled sensors come first and keep their authored tag and band, so
 * the explorer card and the asset's Components/BOM tab describe one instrument.
 * The rest are generated from the kinds the asset declares — plus any kind an
 * open alert names that the asset did not declare, because an alert on an
 * instrument is better evidence that the instrument exists than a list that
 * omits it.
 */
function channelsForAsset(node) {
  const ops = ASSET_OPS[node.id]
  if (!ops) return []
  const site = siteOf(node)
  const line = nodeById.get(node.parentId)
  const unitSystem = site?.unitSystem ?? 'imperial'

  const openAlerts = ALERTS.filter(
    (alert) => alert.assetId === node.id && alert.status !== 'resolved',
  )

  const modelled = (ASSET_COMPONENTS[node.id] ?? []).flatMap((component) =>
    component.sensors.map((sensor) => ({
      key: sensor.id,
      name: sensor.name,
      unit: sensor.unit,
      band: sensor.normal,
      component: component.name,
      tag: sensor.tag,
      kind: KIND_KEYWORDS.find(([needle]) => sensor.name.toLowerCase().includes(needle))?.[1] ?? null,
      alert: openAlerts.find((alert) => alert.id === sensor.alertId) ?? null,
    })),
  )
  const covered = new Set(modelled.map((entry) => entry.name.toLowerCase()))

  const declared = ops.sensors ?? []
  const alerted = openAlerts.map(kindOfAlert).filter(Boolean)
  const kinds = [...new Set([...declared, ...alerted])]

  const generated = kinds
    .map((kind) => {
      const spec = specFor(unitSystem, kind)
      if (!spec) return null
      const alert = openAlerts.find((entry) => kindOfAlert(entry) === kind) ?? null
      // The alert's own words for the instrument win: "Zone 3 Temp" is what the
      // anomaly list calls it, and two names for one channel is one too many.
      const name = alert?.sensor ?? spec.name
      if (covered.has(name.toLowerCase())) return null
      return {
        key: kind.slice(0, 4).toUpperCase(),
        name,
        unit: alert?.reading?.unit ?? spec.unit,
        band: alert ? bandFromAlert(alert, spec) : spec.band,
        component: alert?.component ?? null,
        tag: alert?.sensorTag ?? tagFor(site?.code ?? 'SITE', node.code, kind.slice(0, 4).toUpperCase()),
        kind,
        alert,
      }
    })
    .filter(Boolean)

  return [...modelled, ...generated].map((entry, index) => {
    const [low, high] = entry.band ?? [0, 1]
    const base = entry.alert ? entry.alert.baseline?.value ?? (low + high) / 2 : (low + high) / 2
    const amplitude = Math.max((high - low) * 0.14, 0.01)
    const shape = shapeFromAlert(entry.alert)

    /* The current reading. An alerted channel prints the alert's own value —
       0.6 in/s on the Bodymaker, 0 gal/min on the compressor — so this screen
       and the anomaly list cannot report two readings for one instrument. An
       unalerted one prints the last point of its own trace, which is the thing
       the card draws. */
    const seed = 3 + index * 4 + Math.round(noise(node.id, index) * 40)
    const trace = series(SIGNAL_WINDOWS[DEFAULT_SIGNAL_WINDOW].points, base, amplitude, {
      freq: 3 + (index % 4),
      seed,
      ...shape,
    })
    const value = entry.alert ? entry.alert.reading.value : trace[trace.length - 1]

    return {
      id: `${node.id}:${entry.key}`,
      assetId: node.id,
      assetName: node.name,
      assetCode: node.code,
      assetType: ops.type ?? null,
      lineId: line?.id ?? null,
      lineName: line?.name ?? null,
      siteId: site?.id ?? null,
      siteName: site?.name ?? null,
      key: entry.key,
      kind: entry.kind,
      name: entry.name,
      component: entry.component,
      tag: entry.tag,
      unit: entry.unit,
      band: entry.band,
      value,
      alertId: entry.alert?.id ?? null,
      alertSeverity: entry.alert?.severity ?? null,
      // Whether the tag is arriving at all. A channel on an offline asset is not
      // in violation — it is silent, which is a different problem and takes a
      // different word on the card.
      online: ops.online !== false,
      lastSeenMinutes: ops.lastSeenMinutes ?? null,
      // Kept so a window switch can regenerate the same trace rather than a
      // differently-seeded one.
      shape: { base, amplitude, freq: 3 + (index % 4), seed, ...shape },
    }
  })
}

/**
 * The whole catalogue, in hierarchy order.
 *
 * Hierarchy order and not sorted-by-severity: this is the plant's own ordering,
 * and the severity chips are how somebody asks for the other one.
 */
export const SIGNAL_CHANNELS = HIERARCHY_NODES.filter((node) => node.tier === 'asset').flatMap(
  channelsForAsset,
)

/**
 * A channel's state, derived — never authored.
 *
 * The order matters. An open alert is the platform's own judgement of urgency
 * and it decides: `critical`/`high` is a violation, `medium`/`low` is a warning.
 * Only a channel nobody has raised an anomaly on is judged by arithmetic —
 * outside its band is a violation, within a twelfth of an edge is a warning.
 *
 * So a channel CAN read outside its limits and still badge as a warning: the
 * badge is how urgent the platform thinks it is, and the band beside it is what
 * the instrument's limits are. Two different facts, both on the card. What
 * cannot happen is a channel badged clean while an anomaly is open on it, and
 * `verify:mocks` asserts that.
 */
export function stateOf(channel) {
  if (channel.alertId) {
    return channel.alertSeverity === 'critical' || channel.alertSeverity === 'high'
      ? 'violation'
      : 'warning'
  }
  const [low, high] = channel.band ?? [null, null]
  if (low == null) return 'ok'
  if (channel.value < low || channel.value > high) return 'violation'
  const margin = (high - low) * 0.08
  return channel.value > high - margin || channel.value < low + margin ? 'warning' : 'ok'
}

/**
 * What span to draw, resolved from the request.
 *
 * The timeframe pills and the calendar are the SAME parameter, which is the one
 * correction this control needed. The prototype shows them side by side as
 * independent widgets, so a reader can pick "24H" and "May 3 – May 10" at once
 * and the chart obeys neither. Here a date range wins when there is one, the
 * pills are the shortcut for the ranges people ask for most, and whichever is in
 * force is the one the header names.
 *
 * `endsAt` is null for a pill — those always end now, which is what makes the
 * screen live. A range ends where the reader said it ends.
 */
export function windowSpec({ window, from, to, granularity } = {}) {
  /* The Workstation's granularity select, which the prototype renders as an
     inert `<select>`. Given one, the sample count follows from the span rather
     than from the fixed count the pills carry — that is what a granularity IS.
     Clamped at both ends: sixteen points is not a trend, and two thousand is a
     payload nobody can read off a screen. */
  const withGranularity = (spec) => {
    const minutes = Number(granularity)
    if (!Number.isFinite(minutes) || minutes <= 0) return spec
    const points = Math.round((spec.hours * 60) / minutes) + 1
    return { ...spec, granularityMinutes: minutes, points: Math.min(1200, Math.max(24, points)) }
  }

  if (from && to) {
    const start = Date.parse(from)
    const end = Date.parse(to)
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return withGranularity({
        key: 'custom',
        hours: (end - start) / 3_600_000,
        // A fixed sample count over an arbitrary span: the interval is whatever
        // the span divided by this is, and the axis says so rather than claiming
        // a rate nobody chose.
        points: 96,
        endsAt: end,
        from: new Date(start).toISOString(),
        to: new Date(end).toISOString(),
      })
    }
  }
  const key = SIGNAL_WINDOWS[window] ? window : DEFAULT_SIGNAL_WINDOW
  return withGranularity({ key, ...SIGNAL_WINDOWS[key], endsAt: null })
}

/**
 * One channel's trace over one span.
 *
 * Regenerated from the channel's stored shape rather than resampled from a
 * stored array: a 30-day view of a 24-hour array is an interpolation of
 * something that was never measured. The last point is forced to the reading the
 * card prints, in every span, so the number beside the chart is always the
 * right-hand end of the chart.
 */
export function traceFor(channel, spec) {
  const resolved = spec ?? windowSpec()
  const { base, amplitude, ...options } = channel.shape
  const values = series(resolved.points, base, amplitude, options)
  values[values.length - 1] = channel.value
  return values
}

/**
 * The timestamps a trace's points sit on, as ISO instants.
 *
 * Computed rather than authored, so the axis says what the span says and the
 * demo does not drift into last month. The prototype prints "May 20 … Jun 6"
 * whatever timeframe pill is lit.
 */
export function stampsFor(spec, now = Date.now()) {
  const resolved = spec ?? windowSpec()
  const end = resolved.endsAt ?? now
  const span = resolved.hours * 3_600_000
  const step = span / (resolved.points - 1)
  return Array.from({ length: resolved.points }, (_, index) =>
    new Date(end - span + index * step).toISOString(),
  )
}

/**
 * The scope tree: the hierarchy above the channels, with a channel count and a
 * worst-state dot on every node.
 *
 * Counted off `SIGNAL_CHANNELS` rather than authored, which is the whole
 * difference from the prototype's version — that one hardcodes `count: 7` on the
 * root and `count: 3` on each of three sites, which do not add up to it.
 *
 * Nodes with no channels beneath them are dropped. A scope selector whose rows
 * lead to an empty grid is a menu of dead ends.
 */
export function scopeTree(channels = SIGNAL_CHANNELS) {
  const counts = new Map()
  const worst = new Map()
  const RANK = { violation: 0, warning: 1, ok: 2 }

  for (const channel of channels) {
    const state = stateOf(channel)
    let node = nodeById.get(channel.assetId)
    while (node) {
      counts.set(node.id, (counts.get(node.id) ?? 0) + 1)
      const held = worst.get(node.id)
      if (held == null || RANK[state] < RANK[held]) worst.set(node.id, state)
      node = nodeById.get(node.parentId)
    }
  }

  // Assets are not offered as scopes — the asset dropdown on the toolbar is that
  // control, and two ways to narrow to one machine is one too many.
  return HIERARCHY_NODES.filter((node) => node.tier !== 'asset' && counts.has(node.id)).map(
    (node) => ({
      id: node.id,
      name: node.name,
      code: node.code,
      tier: node.tier,
      parentId: node.parentId,
      count: counts.get(node.id),
      state: worst.get(node.id),
    }),
  )
}

/** Every channel at or beneath one scope node. */
export function channelsInScope(scopeId, channels = SIGNAL_CHANNELS) {
  if (!scopeId || scopeId === 'all') return channels
  return channels.filter((channel) => {
    let node = nodeById.get(channel.assetId)
    while (node) {
      if (node.id === scopeId) return true
      node = nodeById.get(node.parentId)
    }
    return false
  })
}
