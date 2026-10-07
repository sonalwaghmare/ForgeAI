import { useQuery } from '@tanstack/react-query'
import { get } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'

/**
 * Data Fusion — the knowledge graph.
 *
 * DEMO. See `DEMO-MODE.md` §8.10.
 *
 * ── Two queries, because they change at different rates ───────────────────
 * The picker and the estate totals are read once and never again within a
 * sitting; the neighbourhood changes on every click. One key would refetch the
 * whole entity list each time somebody looked at another machine.
 */

/** The estate totals and the machines worth opening. */
export const useFusionGraph = () =>
  useQuery({
    queryKey: queryKeys.fusionGraph,
    queryFn: ({ signal }) => get(endpoints.dataFusion.graph, { signal }),
    enabled: config.demoMode,
    staleTime: 10 * 60_000,
  })

/** One machine's neighbourhood, already positioned. */
export const useGraphNode = (id) =>
  useQuery({
    queryKey: queryKeys.fusionGraphNode(id),
    queryFn: ({ signal }) => get(endpoints.dataFusion.graphNode(id), { signal }),
    enabled: config.demoMode && Boolean(id),
    /* No `placeholderData` here, deliberately.
     *
     * Holding the previous result would keep one machine's neighbourhood on the
     * canvas while the picker above it already named a different machine — the
     * focus node would be labelled with the old name and every edge would belong
     * to the old asset. On a filtered table holding the previous rows is a
     * courtesy; on a picture of one specific thing it is a wrong answer. The
     * skeleton is the honest frame. */
  })
