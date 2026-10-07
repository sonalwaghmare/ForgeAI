import { get } from '@/services/http'
import { endpoints } from '@/services/endpoints'

/**
 * Home's demo-mode dashboard panels.
 *
 * DEMO. Every one of these paths is answered by the fixture layer today and is
 * only requested when `VITE_DEMO_MODE=true` — see `src/mocks/fixtures/home.js`
 * for what is authored and why.
 *
 * This file is the seam. When the real endpoints land, the mappers below are
 * where the wire shape is reconciled with what the screens read, and nothing in
 * `pages/home/` changes. That is the whole reason these panels are not the
 * hardcoded arrays the prototype uses.
 */

/** Site and shift for the dashboard toolbar. */
export const fetchHomeContext = (signal) => get(endpoints.home.context, { signal })

/**
 * The four-tile KPI strip.
 *
 * Unwrapped to a plain array at the boundary: the envelope is a transport
 * concern and the strip renders a list.
 */
export async function fetchHomeKpis(signal) {
  const body = await get(endpoints.home.kpis, { signal })
  return body?.items ?? []
}

/** The watched-assets carousel. Each item is already `SignalTrace`-shaped. */
export async function fetchWatchedAssets(signal) {
  const body = await get(endpoints.home.watched, { signal })
  return body?.items ?? []
}

/** The assets this person is responsible for. */
export async function fetchMyAssets(signal) {
  const body = await get(endpoints.home.assets, { signal })
  return body?.items ?? []
}
