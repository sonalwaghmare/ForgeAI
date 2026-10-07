import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'
import { fetchHomeContext, fetchHomeKpis, fetchMyAssets, fetchWatchedAssets } from './api'

/**
 * Home's demo panels.
 *
 * ── `enabled` carries the flag, not the component ─────────────────────────
 * Every hook here is disabled unless demo mode is on. Gating at the hook rather
 * than at the JSX means a component can be mounted, unmounted or moved without
 * anyone remembering to re-check the flag, and with the flag off the app makes
 * no request for a screen it is not showing.
 *
 * The panels are static fixtures with no clock behind them, so they are cached
 * hard. `homeKpis` is the exception: it is derived from the alert fixture, which
 * mutations elsewhere can change.
 */
const DEMO = { enabled: config.demoMode }
const STATIC_DEMO = { ...DEMO, staleTime: 15 * 60_000 }

export const useHomeContext = () =>
  useQuery({
    queryKey: queryKeys.homeContext,
    queryFn: ({ signal }) => fetchHomeContext(signal),
    ...DEMO,
  })

export const useHomeKpis = () =>
  useQuery({ queryKey: queryKeys.homeKpis, queryFn: ({ signal }) => fetchHomeKpis(signal), ...DEMO })

export const useWatchedAssets = () =>
  useQuery({
    queryKey: queryKeys.homeWatched,
    queryFn: ({ signal }) => fetchWatchedAssets(signal),
    ...STATIC_DEMO,
  })

export const useMyAssets = () =>
  useQuery({
    queryKey: queryKeys.homeAssets,
    queryFn: ({ signal }) => fetchMyAssets(signal),
    ...STATIC_DEMO,
  })
