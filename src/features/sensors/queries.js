import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import {
  createSensor,
  deleteSensor,
  fetchSensor,
  fetchSensors,
  fetchValueUnits,
  fetchWaveformTypes,
  updateSensor,
} from './api'

/**
 * The waveform catalogue, and the engineering units.
 *
 * Cached for an hour, matching `useConnectorTypes`, and for the same reason: all
 * three are seeded platform master data with no write route, so the only thing
 * that changes either list is a backend deploy — and a deploy is a reload.
 *
 * Two hooks rather than one combined fetch. They are separate endpoints and both
 * are needed by the same screen, so they issue in parallel off one render; a
 * wrapper that awaited both would serialise nothing and hide which one failed.
 */
export function useWaveformTypes({ enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.waveformTypes,
    queryFn: ({ signal }) => fetchWaveformTypes(signal),
    staleTime: 60 * 60_000,
    enabled,
  })
}

export function useValueUnits({ enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.valueUnits,
    queryFn: ({ signal }) => fetchValueUnits(signal),
    staleTime: 60 * 60_000,
    enabled,
  })
}

/**
 * One page of one connection's sensors.
 *
 * ── `placeholderData` is what makes a 10,000-row table usable ──────────────
 * Without it, every page step and every page-size change blanks the table to a
 * skeleton and then repaints — so paging through a large connection is a strobe,
 * and the footer's "Showing 51–100 of 10,412" briefly disagrees with an empty body.
 * Keeping the previous page on screen while the next one loads means the only thing
 * that changes is the rows. Same reason `features/alerts/queries.js` does it, and
 * the first place in this app where it is load-bearing rather than polish.
 *
 * The trade is that `isPending` is false during a page change (there IS data, just
 * the wrong page's), so a caller wanting to show that something is in flight has to
 * read `isFetching` or `isPlaceholderData`. The table dims itself on the latter.
 *
 * ── Cached per page, deliberately ─────────────────────────────────────────
 * `params` is part of the key, so page 3 and page 4 are separate entries and
 * stepping back to a visited page is instant. `staleTime` is the client default
 * (30s) — long enough that paging back and forth does not re-request, short enough
 * that a sensor someone else onboarded shows up without a reload.
 *
 * @param {{connectionId: string, page: number, pageSize: number}} params
 */
export function useSensors({ connectionId, page, pageSize }) {
  const params = { connectionId, page, pageSize }

  return useQuery({
    queryKey: queryKeys.sensors(params),
    queryFn: ({ signal }) => fetchSensors(params, signal),
    enabled: Boolean(connectionId),
    placeholderData: (previous) => previous,
  })
}

/**
 * One sensor, for the edit form.
 *
 * `staleTime: 0, gcTime: 0` for the same reason `useConnection` sets them: an edit
 * form is the one place a stale prefill turns into a wrong write, because the form
 * sends back everything it was given. A cached copy may be one someone else has
 * since changed, and a full-replace PUT would quietly restore the old values.
 */
export function useSensor(sensorId) {
  return useQuery({
    queryKey: queryKeys.sensor(sensorId),
    queryFn: ({ signal }) => fetchSensor(sensorId, signal),
    enabled: Boolean(sensorId),
    staleTime: 0,
    gcTime: 0,
  })
}

/**
 * Every write invalidates the whole sensors root rather than patching a page.
 *
 * A create lands at whatever position `ORDER BY created_at, id` puts it, which is
 * the last page — not the one being looked at — and it changes `total`, so every
 * cached page's footer is now wrong. A delete shifts every subsequent row up by
 * one, so page 4 becomes a different set of rows than the cache holds. Reconciling
 * either against an offset-paginated list is more failure modes than this screen
 * earns; the pages are 50 rows and re-fetching one is cheap.
 *
 * Only `['sensors', …]` is swept. Connections are untouched — nothing about
 * onboarding a sensor changes a broker's configuration.
 *
 * `retry: false`: there is no idempotency key and no uniqueness constraint on
 * `sensors.name`, so a retried create that already succeeded leaves two sensors
 * reading the same tag into the same asset. The same hazard the connection
 * mutations document, and worse here because nobody notices one extra row in ten
 * thousand.
 */
function useSensorMutation(mutationFn) {
  const client = useQueryClient()
  return useMutation({
    mutationFn,
    retry: false,
    onSuccess: (result) => {
      client.invalidateQueries({ queryKey: ['sensors'] })
      if (result?.id) client.removeQueries({ queryKey: queryKeys.sensor(result.id) })
    },
  })
}

export const useCreateSensor = () => useSensorMutation(createSensor)
export const useUpdateSensor = () => useSensorMutation(updateSensor)
export const useDeleteSensor = () => useSensorMutation(deleteSensor)
