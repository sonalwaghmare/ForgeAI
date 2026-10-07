import { get } from '@/services/http'
import { endpoints } from '@/services/endpoints'

/**
 * Sensor Explorer — the measured channel.
 *
 * DEMO. See `DEMO-MODE.md` §8.4.
 *
 * ── This is not `features/sensors` ────────────────────────────────────────
 * That one is LIVE and is the tag's CONFIGURATION — name, waveform type, value
 * unit, which connection reads it, its extraction config. This one is the
 * reading: a normal operating band, a current value, a state and a trace over a
 * window. Nothing serves it, so it comes from the fixture layer through the
 * ordinary transport, and landing the endpoint is a change of answer rather than
 * a change of screen.
 *
 * Nothing in this file may be imported by `features/sensors`, or the reverse.
 * They share a domain word and no code.
 *
 * ── This file is THE SEAM ─────────────────────────────────────────────────
 * The enums below are exported from here and imported by the fixture, never the
 * other way round: a page that imported from `mocks/` would bundle the demo
 * layer into production.
 */

/**
 * The timeframe pills, in the order the design has them.
 *
 * They are a real parameter and not a label: `?window=` changes the sample count
 * and the span the handler generates, so 1H and 30D are different samples of the
 * same instrument rather than one array relabelled.
 */
export const SIGNAL_WINDOWS = ['1h', '6h', '24h', '7d', '30d']

/** What the grid opens on. Long enough to show a shift, short enough to be now. */
export const DEFAULT_WINDOW = '24h'

/**
 * The severity chip group. `all` is a filter value, not a state — it is listed
 * here because the chips are rendered off this array and the leading chip is
 * part of the control rather than a special case in the JSX.
 */
export const SIGNAL_STATE_FILTERS = ['all', 'violation', 'warning', 'ok']

/** Sort orders offered on the toolbar. `severity` is the default — see the handler. */
export const SIGNAL_SORTS = ['severity', 'plant', 'name', 'asset']

/** Stream status, for the drawer. */
export const STREAM_FILTERS = ['all', 'online', 'offline']

/**
 * One channel as the screen wants it.
 *
 * `state` and `values` are resolved server-side and are NOT recomputed here.
 * A client that re-derived the state from the band would be a second opinion on
 * a question the platform has already answered, and the two would disagree the
 * first time an alert outranked the arithmetic.
 */
const toChannel = (row) => ({
  id: row.id,
  key: row.key,
  kind: row.kind,
  name: row.name,
  component: row.component,
  tag: row.tag,
  unit: row.unit,
  band: row.band,
  value: row.value,
  state: row.state,
  values: row.values ?? [],
  stamps: row.stamps ?? [],
  window: row.window,
  online: row.online,
  lastSeenMinutes: row.lastSeenMinutes,
  alertId: row.alertId,
  alertSeverity: row.alertSeverity,
  assetId: row.assetId,
  assetName: row.assetName,
  assetCode: row.assetCode,
  assetType: row.assetType,
  lineId: row.lineId,
  lineName: row.lineName,
  siteId: row.siteId,
  siteName: row.siteName,
})

/**
 * The channel grid.
 *
 * Every narrowing control is a request parameter rather than a client-side
 * `.filter()`, including the search box. The set is fifty rows today and the
 * pass would be free; the point is that the screen already sends what a query
 * over four thousand channels needs.
 *
 * @param {{
 *   scope?: string, window?: string, from?: string, to?: string, state?: string,
 *   kind?: string, assetId?: string, lineId?: string, stream?: string,
 *   q?: string, sort?: string,
 * }} params
 */
export async function fetchSignals(params, signal) {
  const data = await get(endpoints.signals.list, { signal, params })
  return {
    items: (data?.items ?? []).map(toChannel),
    total: data?.total ?? 0,
    window: data?.window ?? DEFAULT_WINDOW,
    span: data?.span ?? null,
    facets: data?.facets ?? { all: 0, violation: 0, warning: 0, ok: 0 },
    options: data?.options ?? { kinds: [], assets: [], lines: [] },
    source: data?.source ?? null,
  }
}

/**
 * The hierarchy above the channels, flat, with a count and a worst-state on
 * every node.
 *
 * Flat and not nested: the selector renders rows at a depth, and a tree that
 * arrived nested would be flattened in the component anyway — see
 * `features/hierarchy/flatten.js`, which exists because the live tree does
 * arrive nested. Here the fixture can simply answer the shape the screen draws.
 */
export async function fetchSignalScopes(signal) {
  const data = await get(endpoints.signals.scopes, { signal })
  return {
    items: (data?.items ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      tier: row.tier,
      parentId: row.parentId,
      count: row.count,
      state: row.state,
    })),
    total: data?.total ?? 0,
  }
}

/** One channel, with the alert record behind it where there is one. */
export async function fetchSignal({ signalId, window }, signal) {
  const data = await get(endpoints.signals.detail(encodeURIComponent(signalId)), {
    signal,
    params: { window },
  })
  return { ...toChannel(data), alert: data?.alert ?? null }
}
