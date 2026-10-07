import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import { fetchAlert, fetchAlertAnalysis, fetchAlertCounts, fetchAlerts, acknowledgeAlert } from './api'

/**
 * Screens consume these hooks and nothing else. When the real API lands, the
 * change is confined to `api.js` — no component imports the transport.
 */

/**
 * @param {object} [params]
 * @param {{enabled?: boolean}} [options]
 *   Only `enabled`, and only for the one caller that needs it: the severity
 *   banner is demo-gated, and a query left running for a band nobody renders is
 *   a request nobody can see. Passing the whole options bag through would let
 *   any call site quietly change this list's caching behaviour.
 */
export function useAlerts(params, options = {}) {
  return useQuery({
    queryKey: queryKeys.alerts(params),
    queryFn: ({ signal }) => fetchAlerts(params, signal),
    // Keeps the previous page on screen while the next one loads, so filtering
    // does not blank the table under the user mid-triage.
    placeholderData: (previous) => previous,
    enabled: options.enabled ?? true,
  })
}

export function useAlertCounts(params) {
  return useQuery({
    queryKey: queryKeys.alertCounts(params),
    queryFn: ({ signal }) => fetchAlertCounts(params, signal),
  })
}

export function useAlert(alertId) {
  return useQuery({
    queryKey: queryKeys.alert(alertId),
    queryFn: ({ signal }) => fetchAlert(alertId, signal),
    enabled: Boolean(alertId),
  })
}

export function useAlertAnalysis(alertId) {
  return useQuery({
    queryKey: queryKeys.alertAnalysis(alertId),
    queryFn: ({ signal }) => fetchAlertAnalysis(alertId, signal),
    enabled: Boolean(alertId),
    // Reasoning for a given alert does not change once produced.
    staleTime: 10 * 60_000,
  })
}

export function useAcknowledgeAlert() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.alert(updated.id), updated)
      client.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}
