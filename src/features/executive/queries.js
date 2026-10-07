import { useQuery } from '@tanstack/react-query'
import { get } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'

/**
 * Executive Dashboard — the multi-site rollup.
 *
 * DEMO. See `DEMO-MODE.md` §8.12.
 *
 * ── One request, three lists ──────────────────────────────────────────────
 * Site rollups, enterprise totals and the AI brief arrive together because the
 * brief names the site the bars show as worst and the totals are summed off the
 * same rows. Three requests would be three chances for them to disagree, which
 * is exactly what goes wrong in the design.
 *
 * Cached for a minute. A board view is read, not watched — but an anomaly
 * raised while the tab is open should still change the risk line before
 * somebody quotes it.
 */
export const useExecutive = () =>
  useQuery({
    queryKey: queryKeys.executive,
    queryFn: ({ signal }) => get(endpoints.executive.summary, { signal }),
    enabled: config.demoMode,
    staleTime: 60_000,
  })

/** The one target on the screen. The server sends it; this is the fallback. */
export const OEE_TARGET = 85
