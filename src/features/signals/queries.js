import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'
import { fetchSignal, fetchSignalScopes, fetchSignals } from './api'
import { createChart, fetchChart, fetchCharts } from './charts'

/**
 * Sensor Explorer reads.
 *
 * Gated at the hook, as everywhere behind the demo flag.
 *
 * ── The one polling screen in the app ─────────────────────────────────────
 * Everything else here caches hard because a plant does not change shape between
 * renders. This screen is different: it is a wall of live traces and the design
 * puts "⟳ streaming · updated 1s ago" at the top of it. The prototype prints
 * that string as a literal, which is the clearest possible example of a figure
 * with nothing behind it — it says one second whether the tab has been open for
 * one second or for a day.
 *
 * So the grid actually refetches, and the header reads the query's own
 * `dataUpdatedAt` to say when it last did. The interval follows the window,
 * because that is what the window means: a 1-hour view of a 60-point trace moves
 * a point a minute, and a 30-day view does not move at all between coffees.
 *
 * `refetchIntervalInBackground` is left off, so a tab nobody is looking at stops
 * asking. A poll nobody can see is a request nobody asked for.
 */
const POLL_MS = { '1h': 15_000, '6h': 30_000, '24h': 60_000, '7d': 5 * 60_000, '30d': false }

/**
 * The channel grid.
 *
 * `placeholderData` keeps the previous traces on screen while the next set
 * loads, so moving a chip or typing in the search box redraws the wall rather
 * than blanking it — which on a grid of eighteen charts is a page that jumps to
 * the top under the reader's cursor.
 */
export const useSignals = (params) =>
  useQuery({
    queryKey: queryKeys.signals(params),
    queryFn: ({ signal }) => fetchSignals(params, signal),
    placeholderData: (previous) => previous,
    enabled: config.demoMode,
    // Zero, deliberately: the whole point of the interval below is that the
    // answer is expected to have moved. A stale window over the top of it would
    // serve the cached trace and leave the "updated" stamp lying.
    staleTime: 0,
    refetchInterval: POLL_MS[params?.window ?? '24h'] ?? 60_000,
  })

/**
 * The scope tree.
 *
 * Cached hard and keyed with no params: it describes the whole plant, it does
 * not narrow with the grid, and re-counting fifty channels every time a chip
 * moves would make the selector's numbers flicker while saying nothing new.
 */
export const useSignalScopes = () =>
  useQuery({
    queryKey: queryKeys.signalScopes,
    queryFn: ({ signal }) => fetchSignalScopes(signal),
    enabled: config.demoMode,
    staleTime: 15 * 60_000,
  })

/** One channel. `enabled` guards a URL typed without an id. */
export const useSignal = (signalId, window) =>
  useQuery({
    queryKey: queryKeys.signal(signalId, window),
    queryFn: ({ signal }) => fetchSignal({ signalId, window }, signal),
    enabled: config.demoMode && Boolean(signalId),
    staleTime: 0,
    refetchInterval: POLL_MS[window ?? '24h'] ?? 60_000,
  })

/**
 * The chart catalogue.
 *
 * Cached for a minute rather than hard: a chart created in the dialog has to
 * appear here, and the mutation below invalidates it, but the per-card "worst
 * state" is counted off live channels and should not be a day stale either.
 */
export const useCharts = () =>
  useQuery({
    queryKey: queryKeys.charts,
    queryFn: ({ signal }) => fetchCharts(signal),
    enabled: config.demoMode,
    staleTime: 60_000,
  })

/**
 * One chart, resolved for a span.
 *
 * `placeholderData` holds the previous chart on screen while a granularity or a
 * window change lands. Without it the plot, the table and all five panels blank
 * together and the page collapses to a spinner every time somebody moves a pill
 * — on a screen whose whole job is comparing one span against another.
 *
 * Polls on the same ladder as the grid, and for the same reason: the LIVE dot in
 * the toolbar has to be telling the truth.
 */
export const useChart = (params) =>
  useQuery({
    queryKey: queryKeys.chart(params),
    queryFn: ({ signal }) => fetchChart(params, signal),
    placeholderData: (previous) => previous,
    enabled: config.demoMode && Boolean(params?.chartId),
    staleTime: 0,
    refetchInterval: params?.from ? false : (POLL_MS[params?.window ?? '24h'] ?? 60_000),
  })

/** Create a chart. Sweeps the catalogue so the new one is in it. */
export const useCreateChart = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createChart,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.charts }),
  })
}
