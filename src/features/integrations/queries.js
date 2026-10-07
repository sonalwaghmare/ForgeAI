import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { del, get, post } from '@/services/http'
import { endpoints } from '@/services/endpoints'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'

/**
 * Settings — Integrations.
 *
 * DEMO. See `DEMO-MODE.md` §8.20.
 *
 * ── Both writes invalidate Data Fusion, not only this page ────────────────
 * That is not caution, it is the arrangement working. Pausing a source from the
 * monitor changes its row in the family table, stalls every pipeline reading it
 * and drops its share of the ingest chart. Deleting one removes those pipelines
 * outright. If this page refreshed only itself, the reader could pause a source
 * here, open Data Fusion, and be shown a connected source with active pipelines
 * — which is the exact disagreement composing off one registry was meant to make
 * impossible.
 *
 * The audit log goes too: both writes append an entry, and a record that is
 * written but not shown is a log with a hole in it.
 */
export const useIntegrations = () =>
  useQuery({
    queryKey: queryKeys.integrations,
    queryFn: ({ signal }) => get(endpoints.integrations.list, { signal }),
    enabled: config.demoMode,
  })

function useRegistryWrite(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations })
      queryClient.invalidateQueries({ queryKey: ['fusion'] })
      queryClient.invalidateQueries({ queryKey: ['audit'] })
    },
  })
}

export const usePauseSource = () =>
  useRegistryWrite(({ id, paused }) => post(endpoints.integrations.sourcePause(id), { paused }))

export const useRemoveSource = () => useRegistryWrite((id) => del(endpoints.integrations.source(id)))
