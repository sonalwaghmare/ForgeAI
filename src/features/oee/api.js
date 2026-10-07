import { get } from '@/services/http'
import { endpoints } from '@/services/endpoints'

/**
 * OEE & Production Performance.
 *
 * DEMO. Fixture-backed today; see `src/mocks/fixtures/oee.js`.
 *
 * Two reads rather than one, because they change on different events: the
 * summary is a function of the selected window, and the line table is not. A
 * single `/oee` blob would refetch four traces and a waterfall every time
 * somebody clicked Week and back.
 */

/** The windows the header offers, in the order they are shown. */
export const PERIODS = ['day', 'week', 'month', 'quarter', 'year']

/**
 * Headline factors, the trend behind them, the loss waterfall and the AI
 * attribution for one window.
 *
 * The envelope is unwrapped here, not in the component: the day a real endpoint
 * nests this under `data` or renames `kpis`, this function absorbs it and the
 * screen does not change.
 */
export async function fetchOeeSummary(period, signal) {
  const body = await get(endpoints.oee.summary, { params: { period }, signal })
  return {
    period: body?.period ?? period,
    band: body?.band ?? null,
    target: body?.target ?? null,
    kpis: body?.kpis ?? [],
    trend: body?.trend ?? [],
    waterfall: body?.waterfall ?? [],
    attribution: body?.attribution ?? null,
  }
}

/** Every production line at the site, with its gap to target already computed. */
export async function fetchOeeLines(signal) {
  const body = await get(endpoints.oee.byLine, { signal })
  return { items: body?.items ?? [], total: body?.total ?? 0 }
}
