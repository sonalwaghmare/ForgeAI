import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/queryClient'
import { config } from '@/services/config'
import {
  isRcaRunning,
  fetchAnomalies,
  fetchAnomalyDemoFacets,
  fetchAnomaly,
  fetchAnomalyRca,
  requestAnomalyRca,
  updateAnomaly,
  updateAnomalyRca,
} from './api'

/**
 * One page of anomalies, filtered and sorted server-side.
 *
 * ── Every filter is in the query key, deliberately ────────────────────────
 * Nothing is narrowed in the client. `GET /anomalies` takes status, severity,
 * the three hierarchy ids, a created_at range, a sort field and a direction, and
 * answers with the page plus the facet counts — so the server is the only thing
 * that decides which rows exist, and each combination is its own cache entry.
 * Stepping back to a filter you already used is instant; nothing recomputes.
 *
 * ── `placeholderData` keeps the table still ───────────────────────────────
 * Without it every filter change and every page step blanks the table to a
 * skeleton and repaints, so working through a list is a strobe — and the footer's
 * "Showing 1–50 of 412" briefly disagrees with an empty body. Keeping the
 * previous page on screen means the only thing that changes is the rows.
 *
 * The trade is that `isPending` is false during a refetch (there IS data, just
 * the previous filter's), so the screen reads `isPlaceholderData` to dim rather
 * than `isFetching` — which would also fire on a background revalidation and
 * flicker a table nobody touched.
 *
 * ── It polls ──────────────────────────────────────────────────────────────
 * Detections arrive while somebody is looking at the screen, and a list that
 * only moves when the page is reloaded is a list that is wrong for as long as
 * nobody reloads it. So this refetches on `ANOMALY_POLL_INTERVAL_MS` for as long
 * as a component holding the hook is mounted, and stops the moment one is not —
 * which is exactly the "while the user is on the screen" rule, expressed as
 * mounting rather than as a route check somebody has to keep in step.
 *
 * `placeholderData` is what makes that bearable at this cadence: the same key
 * refetching in place swaps the rows and touches nothing else, so a two-second
 * poll under a reader's cursor is not a two-second flash.
 *
 * `refetchIntervalInBackground` is left off, as it is for signals. A tab nobody
 * is looking at stops asking, and picks up again on focus.
 */
export function useAnomalies(filters, { enabled = true, poll = true } = {}) {
  return useQuery({
    queryKey: queryKeys.anomalies(filters),
    queryFn: ({ signal }) => fetchAnomalies(filters, signal),
    placeholderData: (previous) => previous,
    // The list screen always wants its rows; the severity band only wants them
    // when there is a server to answer. A poll nobody renders is a request
    // nobody can see.
    enabled,
    /**
     * Zero, deliberately — the same reason `useSignals` sets it.
     *
     * The default 30s staleness is longer than the interval, and while a poll
     * does fire regardless of it, everything else that revalidates would be
     * served the cached page instead: a remount, a scope change, a return to the
     * tab. On a surface asking every two seconds because the answer is expected
     * to have moved, "fresh for thirty" is not true of any of it.
     */
    staleTime: 0,
    // `false` rather than `0` when off: TanStack reads 0 as "as fast as
    // possible", which is the opposite of what a caller turning this off means.
    refetchInterval: poll ? ANOMALY_POLL_INTERVAL_MS : false,
  })
}

/**
 * DEMO. The facet tiles the server cannot count.
 *
 * Gated at the hook rather than at the JSX, per DEMO-MODE §2.2: with the flag off
 * the screen makes no request for a row it is not showing, and the tiles can be
 * moved or refactored without anyone remembering to re-check the flag.
 *
 * `staleTime: Infinity` because a fixture does not change. It deliberately does
 * NOT poll alongside the list beside it — two seconds of re-fetching a constant
 * would be the demo layer costing more requests than the real one.
 */
export function useAnomalyDemoFacets() {
  return useQuery({
    queryKey: queryKeys.anomalyDemoFacets,
    queryFn: ({ signal }) => fetchAnomalyDemoFacets(signal),
    enabled: config.demoMode,
    staleTime: Infinity,
  })
}

/**
 * Two seconds between list refreshes, as specified.
 *
 * The same figure as `RCA_POLL_INTERVAL_MS` and deliberately a separate
 * constant: one is how often an analysis in flight is checked on, the other is
 * how often the estate is re-read, and the day either moves it must be able to
 * move alone.
 */
export const ANOMALY_POLL_INTERVAL_MS = 2000

/**
 * One anomaly.
 *
 * `staleTime: 0` for the reason every edit surface in this app sets it: PATCH is
 * partial, but `title` is still a full replace of that field, and a cached copy
 * someone else has since changed would be written back unnoticed.
 */
export function useAnomaly(anomalyId) {
  return useQuery({
    queryKey: queryKeys.anomaly(anomalyId),
    queryFn: ({ signal }) => fetchAnomaly(anomalyId, signal),
    enabled: Boolean(anomalyId),
    staleTime: 0,
    gcTime: 0,
  })
}

/**
 * One anomaly's root-cause analysis, or `null` when none has been requested.
 *
 * ── `null` is a successful answer here ────────────────────────────────────
 * `fetchAnomalyRca` converts the endpoint's 404 into `null`, so `isError` means
 * something actually went wrong and `data === null` means nobody has asked for
 * an analysis yet. The screen can therefore branch on the data rather than on an
 * error object, which is the difference between an empty state and a red panel on
 * every new anomaly.
 *
 * That also means `null` must be distinguished from "still loading" by
 * `isPending`, not by a falsy check — `data` is `undefined` before the request
 * lands and `null` after it lands with nothing there.
 */
export function useAnomalyRca(anomalyId, { poll = false } = {}) {
  return useQuery({
    queryKey: queryKeys.anomalyRca(anomalyId),
    queryFn: ({ signal }) => fetchAnomalyRca(anomalyId, signal),
    enabled: Boolean(anomalyId),
    /**
     * Poll while an analysis has been requested and has not arrived.
     *
     * A function, not a number, so the decision reads the query's OWN latest data
     * — which is what lets one `useQuery` call both start and stop the poll. The
     * alternative is to derive "still queued" in the component and feed it back in,
     * which needs the data before the hook that fetches it, so it ends up as two
     * hook calls on one key with two conflicting timers.
     *
     * The test is `isRcaRunning` — `queued` AND no content. It was `!hasRcaContent`
     * alone, which polled a `pending` row forever: nobody had requested that one, so
     * nothing was ever going to arrive and the screen sat there asking. A `draft`
     * with empty content also stops the poll now, correctly — `PATCH .../rca` sets
     * that, and a status a person set by hand is not a job to wait on.
     *
     * `poll` is the caller's ceiling — it owns the "stopped watching" state, because
     * that is a UI decision. `false` rather than `0` when idle: TanStack reads 0 as
     * "as fast as possible".
     */
    refetchInterval: (query) =>
      poll && isRcaRunning(query.state.data) ? RCA_POLL_INTERVAL_MS : false,
    /**
     * Keeps polling with the tab in the background.
     *
     * Normally the wrong default — a backgrounded tab quietly burning requests is
     * how a polling bug hides. It is right here and only here: analysis takes up to
     * a couple of minutes, somebody starts it and switches away, and the point of
     * the flow is that it is finished when they come back. The caller's ceiling is
     * what keeps it bounded.
     */
    refetchIntervalInBackground: poll,
  })
}

/** Two seconds between checks, as specified. */
export const RCA_POLL_INTERVAL_MS = 2000

/** Two minutes of watching before the screen stops claiming to watch. */
export const RCA_POLL_CEILING_MS = 120_000

/**
 * Ask for an analysis.
 *
 * Invalidates only this anomaly's RCA. Nothing else moves: requesting an analysis
 * does not change the anomaly's own record, its status, or any count on the list
 * — so sweeping `['anomalies']` would refetch a paginated list to show a change
 * that is not in it.
 *
 * `retry: false` even though the endpoint is idempotent. A retry cannot create a
 * second row, but it also cannot help: the failures worth retrying are transport
 * faults, and the query client's own policy already covers those on the read.
 */
export function useRequestAnomalyRca(anomalyId) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: () => requestAnomalyRca(anomalyId),
    retry: false,
    onSuccess: (rca) => {
      // Seeded rather than merely invalidated, so the panel switches to "queued"
      // on the response instead of blanking for one more round trip.
      client.setQueryData(queryKeys.anomalyRca(anomalyId), rca)
    },
  })
}

/**
 * Save an edited analysis, or approve it.
 *
 * Writes the response straight into the cache rather than invalidating, for a
 * reason specific to this screen: the RCA query may be polling, and an
 * invalidation mid-poll can land the fetch that was already in flight — carrying
 * pre-save content — after this one, so the editor would appear to lose the save
 * and then recover it. Seeding removes the race entirely.
 *
 * `['anomalies']` is swept as well, because `rca_status` rides along on every list
 * item: approving a draft has to move the badge on the card behind this screen.
 */
export function useUpdateAnomalyRca(anomalyId) {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (input) => updateAnomalyRca({ anomalyId, ...input }),
    retry: false,
    onSuccess: (rca) => {
      client.setQueryData(queryKeys.anomalyRca(anomalyId), rca)
      client.invalidateQueries({ queryKey: ['anomalies'] })
    },
  })
}

/**
 * Change a title, a severity or a status.
 *
 * Invalidates the whole `['anomalies']` root rather than patching the page in
 * place. A status change moves the row out of a status-filtered list, and it
 * moves the facet counts that ride along in the same response — so the page the
 * screen holds is wrong in two ways at once, and reconciling that against an
 * offset-paginated list is more failure modes than this screen earns.
 *
 * `retry: false`: PATCH is idempotent in principle, but a retry that lands after
 * someone else's change would overwrite it with a value this client chose before
 * seeing theirs. Same call this codebase makes on every other write.
 */
export function useUpdateAnomaly() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: updateAnomaly,
    retry: false,
    onSuccess: (result) => {
      /**
       * ── Seed the detail record; never remove it ──────────────────────────
       * This used to `removeQueries` the detail key, which was harmless when only
       * the list screen existed and nothing was watching that entry. With the detail
       * page mounted it is a bug: removal wipes the cache entry the screen is
       * observing and does NOT schedule a fetch for an already-mounted observer, so
       * the header keeps rendering its last value until something remounts it. The
       * symptom is a status that changes on the server and only appears after a
       * page refresh.
       *
       * `PATCH /anomalies/{id}` answers with the whole updated record — the same
       * `_to_out` shape `GET /anomalies/{id}` returns — so writing it straight in is
       * both correct and one request cheaper than invalidating.
       */
      if (result?.id) client.setQueryData(queryKeys.anomaly(result.id), result)

      /**
       * Only the list. A status change moves the row between status-filtered pages
       * and moves `counts.status`, which rides along in the same response, so every
       * cached page is wrong — but the detail entry above is already right, and the
       * RCA entry under the same root did not change and may be mid-poll.
       */
      client.invalidateQueries({ queryKey: queryKeys.anomaliesList })
    },
  })
}
