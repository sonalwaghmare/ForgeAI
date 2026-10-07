import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Page } from "@/shell/AppShell";
import { AnomalyCard } from "@/components/forge/AnomalyCard";
import { Chip } from "@/components/forge/Chip";
import { FacetTile } from "@/components/forge/FacetTile";
import { ForgeButton } from "@/components/forge/ForgeButton";
import { ForgeSelect } from "@/components/forge/ForgeSelect";
import { Field } from "@/components/forge/Field";
import { Icon } from "@/components/forge/Icon";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/forge/States";
import { statusLabel } from "@/components/forge/StatusBadge";
import { TablePagination } from "@/components/forge/TablePagination";
import { Eyebrow, Num } from "@/components/forge/primitives";
import { DEFAULT_PAGE_SIZE, DEFAULT_SORT_DIRECTION, DEFAULT_SORT_FIELD, SORT_DIRECTIONS, SORT_FIELDS, statusFacets } from "@/features/anomalies/api";
import { useAnomalies, useAnomalyDemoFacets } from "@/features/anomalies/queries";
import { assetsOf, linesOf, sitesOf } from "@/features/hierarchy/parents";
import { useHierarchyNodes } from "@/features/hierarchy/queries";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { formatDateRange, formatDateTime, formatInteger } from "@/lib/format";
import { ANOMALY_STATUS_ICON, ANOMALY_STATUS_TONE } from "@/lib/tone";
import { cn } from "@/lib/cn";

/**
 * Anomalies — the flagship operational surface, on `GET /v1/anomalies`.
 *
 * ── The layout is the design's, the data is the server's ───────────────────
 * One row of facet tiles, a severity chip rail, a filter bar, then a stack of
 * cards — the shape the prototype's `AlertsModule` established and the shape
 * this screen already had. What changed underneath is that every number and
 * every option now comes off the response instead of a fixture.
 *
 * A table was tried here and was wrong. This surface is read standing up, on a
 * tablet, at arm's length, by someone scanning for the two rows that matter — and
 * a card with a severity leading edge finds those without being read, where a
 * row of cells has to be. Cards also survive the +35% translation budget and the
 * tablet breakpoint by wrapping, which a five-column table does not.
 *
 * ── Nothing on screen is written down, with one named exception ───────────
 * The facet tiles are `counts.status` iterated in the order the server sent it;
 * the severity rail is `counts.severity`; the board columns are the same status
 * keys. So the day `AnomalyStatus` gains a member, a tile, a filter option and a
 * board column all appear without a release here. The only closed sets written
 * out are `sort_by` and `sort_dir`, which are a request contract the endpoint
 * rejects deviation from rather than data it reports.
 *
 * The exception is `resolved`. The product withdrew it from the lifecycle; the
 * backend did not, and still reports a count for it. So that one tile and board
 * column are dropped here — the one place in this file where the client decides
 * what the server's own vocabulary means. `escalated` is NOT dropped: the product
 * cannot set it either, but rows land in it and a queue nobody can see is worse
 * than a state nobody can enter.
 *
 * **The rows are not touched.** An anomaly sitting in `resolved` still appears in
 * the list with its real status rendered, because it genuinely is in that state and
 * hiding it would make the list disagree with the server about what exists. The
 * consequence to know: the visible tiles no longer sum to `total` on an account that
 * has resolved rows.
 *
 * The demo facets are the mirror of that problem — a count with no rows behind it
 * rather than rows with no count. They are gated on the flag and cannot be pressed;
 * see where they are rendered.
 *
 * The card shows the six fields a list row carries. There is no reading, no
 * threshold, no assignee and no fusion score, because `AnomalyListItem` has
 * none — a plausible number beside a real anomaly is the one failure this
 * screen could not recover from.
 *
 * ── Nothing is narrowed, ordered or counted in the client ─────────────────
 * Every control writes a query parameter and the pager is driven by the server's
 * own `total`. Nothing here sorts `items` or drops a row from it, so a
 * ten-thousand-row account behaves exactly like this ten-row one.
 *
 * The one `items.filter` in this file is inside `Board`, and it groups the page
 * it was given into columns rather than deciding what the page contains. Said
 * exactly, because a reader who trusts "never filters" and then greps and finds
 * one stops trusting the rest of this comment.
 */
export function AnomaliesPage() {
  const { t, i18n } = useTranslation(["app", "common"]);
  useDocumentTitle(`${t("screens.anomalies")} · ${t("common:brand.name")}`);

  const [filters, setFilters] = useState(BLANK_FILTERS);
  // The list/board toggle is commented out below, so nothing sets this today.
  // Restoring the toggle means restoring `setView` here and the `Segmented,
  // SegmentedItem` import above; `Board` is still wired to it.
  const [view] = useState("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const query = useMemo(() => ({ ...filters, page, pageSize }), [filters, page, pageSize]);
  const anomalies = useAnomalies(query);
  const hierarchy = useHierarchyNodes();

  const data = anomalies.data;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  /**
   * The known lifecycle zero-filled, plus anything else the server reported, minus
   * `resolved`.
   *
   * ── Escalated is a tile again, and Resolved still is not ──────────────────
   * `RETIRED_STATUSES` says which states the product will not SET — a different
   * question from which it will COUNT. The server reports rows in both, so hiding
   * their tiles hid work that exists: an escalated anomaly was in the list, badged
   * correctly, and absent from every figure above it.
   *
   * Escalated comes back because it is a live queue somebody has to see. Resolved
   * stays out because it is the closed end of a lifecycle the product now expresses
   * as Dismissed, and two tiles for "finished" would invite the question of which.
   *
   * `statusFacets` is what makes the tile survive an empty queue — see its note;
   * the counts endpoint omits a status it has no rows for. Filtered once here so
   * the tiles and the board columns cannot disagree.
   */
  const statusCounts = statusFacets(data?.statusCounts).filter((entry) => entry.key !== "resolved");

  /**
   * DEMO. Snoozed and unassigned, which the API cannot count.
   *
   * Appended after the real tiles rather than interleaved by some notional
   * lifecycle order: the row then reads as "what the server knows, then what it
   * does not", and with the flag off the second half is simply absent instead of
   * leaving a gap where a tile used to be.
   */
  const demoFacets = useAnomalyDemoFacets().data ?? [];
  const severityCounts = data?.severityCounts ?? [];

  /**
   * Any narrowing returns to page 1.
   *
   * Without it, cutting 400 rows to 12 while on page 5 lands on a page the server
   * correctly reports as empty — which reads as "nothing matches" when twelve
   * things do.
   */
  function change(patch) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  const clear = () => {
    setFilters(BLANK_FILTERS);
    setPage(1);
  };

  const nodes = hierarchy.data?.items ?? [];
  const language = i18n.language;
  const active = FILTER_KEYS.filter((key) => filters[key]);

  return (
    <Page>
      {/* ── Header ────────────────────────────────────────────────────────
          No "Live" pill. The prototype has one and the old screen carried it
          over, but this endpoint is polled and nothing streams — it was the one
          claim on the page the API could not back. */}
      <div className="mb-4.5 flex flex-wrap items-end gap-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-display">{t("anomalies.title")}</h1>
          <p className="mt-1.5 mb-0 text-control font-normal text-ink-dim">
            <Num>{t("anomalies.subtitle", { count: total })}</Num>
          </p>
        </div>

        {/* ── The date range sits beside the title, not in the filter bar ────
            Where the design puts it, and it earns the position: it is the only
            filter that scopes the FACET COUNTS as well as the rows, so it frames
            everything below it rather than narrowing within it. The other filters
            belong together in the bar; this one is the page's period. */}
        <DateRangeFilter
          from={filters.createdFrom}
          to={filters.createdTo}
          onChange={change}
        />
      </div>

      {/* ── Facets ───────────────────────────────────────────────────────
          Controls, not ornaments — each one filters the stack beneath it and
          takes the accent leading edge while it does. One row, which is the
          limit: `auto-fit` at 132px holds the five statuses without wrapping to a
          second, and gains room for a sixth when the enum does.

          Their counts hold still as you filter, because the server scopes them to
          the date range only. That is what makes them usable as filters rather
          than a second readout of the list, and the line under the row says so
          once instead of leaving it to be discovered. */}
      <div
        role="group"
        aria-label={t("anomalies.filterByStatus")}
        className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(132px,1fr))]"
      >
        {/* No "All" tile. It was a control whose only job was to undo the other
            five, and every one of those already toggles itself off — so it earned
            a sixth of the row to duplicate behaviour that was already there. The
            active-filter chip below states the narrowing and clears it too.

            It also carried the only figure on this row nobody would act on, which
            is the one thing DESIGN.md says a metric tile must never be. */}
        {statusCounts.map((entry) => (
          <FacetTile
            key={entry.key}
            icon={ANOMALY_STATUS_ICON[entry.key] ?? "bolt"}
            tone={ANOMALY_STATUS_TONE[entry.key] ?? null}
            selected={filters.status === entry.key}
            onClick={() => change({ status: filters.status === entry.key ? "" : entry.key })}
            label={statusLabel(t, entry.key)}
            value={formatInteger(entry.count)}
            caption={t(`anomalies.statusCaption.${entry.key}`, { defaultValue: "" })}
          />
        ))}

        {/* Not pressable, and that is the honest rendering rather than a
            limitation. `GET /anomalies` takes no `snoozed` and no assignment
            filter, so a tile that responded to a click could only do one of two
            false things: narrow to nothing, contradicting the count printed on it,
            or leave the list alone, contradicting the press. It states the facet
            and waits for the endpoint. */}
        {demoFacets.map((entry) => (
          <FacetTile
            key={entry.key}
            interactive={false}
            icon={ANOMALY_STATUS_ICON[entry.key] ?? "bolt"}
            tone={ANOMALY_STATUS_TONE[entry.key] ?? null}
            label={t(`common:status.${entry.key}`, { defaultValue: entry.key })}
            value={formatInteger(entry.count)}
            caption={t(`anomalies.statusCaption.${entry.key}`, { defaultValue: "" })}
          />
        ))}
      </div>
      <p className="mt-2 mb-0 text-micro font-normal text-ink-mute">{t("anomalies.countsScope")}</p>

      {/* ── Primary rail ─────────────────────────────────────────────────
          The severity cut and the sort. Severity stays chips rather than becoming
          a select because it is the filter a reader reaches for most and its four
          options fit on one line — a select would hide a closed four-item set
          behind a click. Sort sits at the far end because it changes the order and
          not the set, which is a different kind of decision. */}
      <div className="mt-5 mb-3.5 flex flex-wrap items-center gap-2">
        {/* <Segmented label={t('anomalies.viewMode')}>
          <SegmentedItem
            selected={view === 'list'}
            label={t('anomalies.listView')}
            onClick={() => setView('list')}
          >
            <Icon name="list" size="sm" />
          </SegmentedItem>
          <SegmentedItem
            selected={view === 'board'}
            label={t('anomalies.boardView')}
            onClick={() => setView('board')}
          >
            <Icon name="board" size="sm" />
          </SegmentedItem>
        </Segmented> */}

        <div role="group" aria-label={t("anomalies.filterBySeverity")} className="flex flex-wrap items-center gap-2">
          <Chip selected={!filters.severity} onClick={() => change({ severity: "" })}>
            {t("anomalies.allSeverities")}
          </Chip>
          {/* In the order the server declared its enum. Not re-sorted to put
              critical first — that ranking would be this file's invention. */}
          {severityCounts.map((entry) => (
            <Chip
              key={entry.key}
              selected={filters.severity === entry.key}
              onClick={() => change({ severity: filters.severity === entry.key ? "" : entry.key })}
            >
              {t(`common:severity.${entry.key}`, { defaultValue: entry.key })} · {formatInteger(entry.count)}
            </Chip>
          ))}
        </div>

      </div>

      <FilterBar
        filters={filters}
        sites={sitesOf(nodes, language)}
        lines={linesOf(nodes, filters.plantId, language)}
        assets={assetsOf(nodes, filters.lineId, language)}
        hierarchyFailed={hierarchy.isError}
        onChange={change}
      />

      {active.length ? (
        <div className="mb-3.5 flex flex-wrap items-center gap-2">
          {active.map((key) => (
            <Chip key={key} onClick={() => change({ [key]: "" })}>
              {t(`anomalies.filterLabel.${key}`)}
              <Icon name="x" size="xs" className="text-ink-mute" />
            </Chip>
          ))}
          <Chip onClick={clear}>{t("common:actions.clearFilters")}</Chip>
        </div>
      ) : null}

      {anomalies.isPending ? (
        <SkeletonRows count={6} />
      ) : anomalies.isError ? (
        <ErrorState error={anomalies.error} title={t("anomalies.loadFailed")} onRetry={() => anomalies.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={t(active.length ? "anomalies.noMatches" : "anomalies.empty")}
          body={t(active.length ? "anomalies.noMatchesBody" : "anomalies.emptyBody")}
          action={active.length ? <Chip onClick={clear}>{t("common:actions.clearFilters")}</Chip> : null}
        />
      ) : (
        <>
          {/* Dimmed while the next page or filter is in flight. The rows on
              screen are real, just one request behind — `isPlaceholderData` and
              not `isFetching`, which would also fire on a background
              revalidation and flicker a list nobody touched. */}
          <div className={cn("transition-opacity", anomalies.isPlaceholderData && "opacity-60")}>
            {view === "list" ? (
              <div className="flex flex-col gap-2.5">
                {items.map((anomaly) => (
                  <AnomalyCard key={anomaly.id} anomaly={anomaly} />
                ))}
              </div>
            ) : (
              <Board items={items} statusCounts={statusCounts} />
            )}
          </div>

          <TablePagination
            total={total}
            page={data?.page ?? page}
            pageSize={data?.pageSize ?? pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            label={t("anomalies.rowNoun")}
            className="mt-2"
          />
        </>
      )}
    </Page>
  );
}

/* ══ BOARD ═════════════════════════════════════════════════════════════ */

/**
 * One column per status, from the same `counts.status` keys the tiles use.
 *
 * ── The column heading counts what is drawn, not what exists ───────────────
 * This groups the CURRENT PAGE. The list is paginated server-side, so a column
 * heading showing the facet total would sit above a shorter stack of cards and
 * silently invite the reader to conclude cards were missing. Counting the cards
 * in the column instead means the heading and the column can never disagree, and
 * the pager below states the rest.
 *
 * Empty columns stay. A status that disappears when nothing is in it makes the
 * board reflow every time you filter, and the absence is itself information —
 * "nothing escalated" is worth seeing.
 */
function Board({ items, statusCounts }) {
  const { t } = useTranslation(["app", "common"]);

  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
      {statusCounts.map((entry) => {
        const column = items.filter((anomaly) => anomaly.status === entry.key);

        return (
          <section key={entry.key} aria-label={statusLabel(t, entry.key)}>
            <div className="mb-2.5 flex items-center gap-2 px-1">
              <Eyebrow as="h2" className="m-0">
                {statusLabel(t, entry.key)}
              </Eyebrow>
              <Num className="text-micro font-normal text-ink-mute">{formatInteger(column.length)}</Num>
            </div>
            <div className="flex flex-col gap-2">
              {column.map((anomaly) => (
                <AnomalyCard key={anomaly.id} anomaly={anomaly} compact />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ══ FILTER BAR ════════════════════════════════════════════════════════ */

/**
 * Scope and order — the five parameters that are chrome rather than a primary
 * cut.
 *
 * A sunken bar, not a form panel. Every control is the 34px `sm` step that
 * `ForgeSelect` documents for exactly this case, with its label visually hidden
 * because the trigger already reads "All sites" — a heading above it would only
 * repeat that. Still rendered and still bound, so a screen reader names the
 * combobox.
 */
function FilterBar({ filters, sites, lines, assets, hierarchyFailed, onChange }) {
  const { t } = useTranslation(["app", "common"]);

  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2">
      {/* ── The status pill is intentionally not here ──────────────────────
          The facet tiles above already are this control: each one toggles the same
          `status` param and carries the count as well, so the pill was a second
          affordance on one value earning a slot in the row for nothing. Removing
          it also removes the only place two controls could look like two filters.

          Left in place rather than deleted because the tiles hide one thing the
          pill showed — a status whose count is zero still has a tile, but a reader
          scanning the row has no compact statement of the current cut. If that
          turns out to matter, uncomment this and re-thread `statusCounts` into
          FilterBar; `FilterPill` is still here and still used by the three below.

          <FilterPill
            id="anomaly-status"
            label={t("anomalies.columns.status")}
            value={filters.status}
            allLabel={t("anomalies.allStatusesValue")}
            onChange={(next) => onChange({ status: next })}
            options={statusCounts.map((entry) => ({ value: entry.key, label: statusLabel(t, entry.key) }))}
          />
      */}

      {/* ── plant_id → line_id → machine_id ──────────────────────────────
          A cascade, because the deeper two are meaningless without the level
          above: the endpoint takes all three independently and would accept a
          machine from another site, returning nothing for a reason the screen
          could not explain. Choosing a site clears the line and asset; choosing a
          line clears the asset. Disabled rather than hidden until its parent is
          set, so the shape of the filter stays visible. */}
      <FilterPill
        id="anomaly-site"
        label={t("anomalies.columns.site")}
        value={filters.plantId}
        allLabel={t(hierarchyFailed ? "anomalies.sitesUnavailable" : "anomalies.allSitesValue")}
        onChange={(next) => onChange({ plantId: next, lineId: "", machineId: "" })}
        options={sites.map((node) => ({ value: node.id, label: node.name }))}
      />

      <FilterPill
        id="anomaly-line"
        label={t("anomalies.columns.line")}
        value={filters.lineId}
        allLabel={t("anomalies.allLinesValue")}
        disabled={!filters.plantId}
        onChange={(next) => onChange({ lineId: next, machineId: "" })}
        options={lines.map((node) => ({ value: node.id, label: node.name }))}
      />

      <FilterPill
        id="anomaly-asset"
        label={t("anomalies.columns.asset")}
        value={filters.machineId}
        allLabel={t("anomalies.allAssetsValue")}
        disabled={!filters.lineId}
        onChange={(next) => onChange({ machineId: next })}
        options={assets.map((node) => ({ value: node.id, label: node.name }))}
      />

      <div className="flex-1" />

      {/* ── Sort, then direction, in that order ───────────────────────────
          Two pills rather than one, because they are two decisions and the second
          only makes sense once the first is read. Direction sits last — it is the
          modifier, and the design's own row ends on the sort. */}
      <ForgeSelect
        id="anomaly-sort-by"
        labelInline
        label={t("anomalies.sortBy")}
        value={filters.sortBy}
        onValueChange={(next) => onChange({ sortBy: next })}
        options={SORT_FIELDS.map((field) => ({
          value: field,
          label: t(`anomalies.sortFields.${field}`),
        }))}
      />

      {/* Direction labels name what ends up FIRST, per field — "Newest first" for
          a timestamp, "Most severe first" for the ladder. `desc` is the same wire
          value in both, and calling it "descending" would be true and useless to
          somebody deciding which way to read a list. */}
      <ForgeSelect
        id="anomaly-sort-dir"
        labelInline
        label={t("anomalies.sortDir")}
        value={filters.sortDir}
        onValueChange={(next) => onChange({ sortDir: next })}
        options={SORT_DIRECTIONS.map((direction) => ({
          value: direction,
          label: t(`anomalies.sortDirections.${filters.sortBy}.${direction}`),
        }))}
      />
    </div>
  );
}

/**
 * One filter pill over an optional value.
 *
 * Wraps `ForgeSelect` rather than reimplementing a trigger, so every one of these
 * keeps `role="combobox"`, typeahead, arrow-key navigation and focus return. All
 * this adds is the "no filter" entry, which every one of them needs and none of
 * them should spell differently.
 *
 * `ANY` exists because Radix rejects an item whose value is the empty string, and
 * an optional filter has to be able to return to unset. It never reaches the wire
 * — `toParams` drops falsy values.
 */
function FilterPill({ id, label, value, allLabel, options, disabled, onChange }) {
  return (
    <ForgeSelect
      id={id}
      labelInline
      label={label}
      disabled={disabled}
      value={value || ANY}
      onValueChange={(next) => onChange(next === ANY ? "" : next)}
      options={[{ value: ANY, label: allLabel }, ...options]}
    />
  );
}

/* ══ DATE RANGE ════════════════════════════════════════════════════════ */

/**
 * The period the whole page is scoped to.
 *
 * ── One button that opens two inputs ──────────────────────────────────────
 * The design shows a single control reading "Jun 2 – Jun 9, 2026", and that is the
 * right shape: the range is one idea, and two bare date inputs sitting in a page
 * header read as an unfinished form. So the trigger states the range through
 * `Intl.DateTimeFormat.formatRange` — which collapses a shared month or year on
 * its own, in the reader's locale — and the inputs live in a panel behind it.
 *
 * ── Hand-built rather than a DropdownMenu ─────────────────────────────────
 * The filter pills are `ForgeSelect`s because they choose one value from a list.
 * This is not that: it holds two text inputs, and Radix's DropdownMenu manages
 * focus as a menu — arrow keys move between items, typing selects them — which
 * fights a date input placed inside it. There is no Popover primitive here. A
 * panel with `aria-expanded`, `aria-controls`, a click-outside layer and Escape is
 * the honest amount of machinery for a two-field disclosure.
 *
 * `type="date"` gives the platform picker, which on a tablet is the OS one — worth
 * more on the floor than any calendar this could draw.
 */
function DateRangeFilter({ from, to, onChange }) {
  const { t } = useTranslation(["app", "common"]);
  const [open, setOpen] = useState(false);

  const label =
    from && to
      ? formatDateRange(from, to)
      : from
        ? t("anomalies.dateFrom", { date: formatDateTime(from, { dateStyle: "medium" }) })
        : to
          ? t("anomalies.dateTo", { date: formatDateTime(to, { dateStyle: "medium" }) })
          : t("anomalies.allDates");

  return (
    <div className="relative">
      <ForgeButton
        aria-expanded={open}
        aria-controls="anomaly-date-range"
        onClick={() => setOpen((current) => !current)}
        className={cn(from || to ? "border-forge/40 text-on-forge" : undefined)}
      >
        <Icon name="cal" size="sm" />
        <Num>{label}</Num>
        <Icon name="down" size="xs" className={cn("transition-transform", open && "rotate-180")} />
      </ForgeButton>

      {open ? (
        <>
          {/* Dismisses on any outside press. Fixed and full-viewport so it also
              catches a press on the scrollbar or another panel. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />

          <div
            id="anomaly-date-range"
            onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
            className={cn(
              'absolute end-0 z-50 mt-1.5 flex w-[19rem] flex-col gap-3',
              'rounded-sm border border-hairline bg-card p-3.5 shadow-lift',
              // The glass every other floating surface in this product already
              // has, and the one this panel was missing. `bg-card` is 6% white
              // in dark mode — material over the page, and see-through over
              // anything else — so without the blur the sort and order controls
              // behind it read straight through. `saturate` compensates for the
              // desaturation blurring introduces, so the tint still reads as
              // itself. Identical to ForgeDialog, ForgeDrawer, the Radix menus
              // and the Sensors date picker, which is the same control.
              'dark:backdrop-blur-[20px] dark:backdrop-saturate-[1.8]',
            )}
          >
            {/* `created_from` / `created_to` are `datetime` server-side and a date
                input sends `YYYY-MM-DD`, which Pydantic reads as midnight — so "to"
                excludes that day's own detections. Stated in the hint rather than
                silently corrected by adding a day, which would make the request
                disagree with the control. */}
            <Field
              id="anomaly-created-from"
              type="date"
              label={t("anomalies.createdFrom")}
              value={from}
              max={to || undefined}
              onChange={(event) => onChange({ createdFrom: event.target.value })}
            />
            <Field
              id="anomaly-created-to"
              type="date"
              label={t("anomalies.createdTo")}
              hint={t("anomalies.createdToHint")}
              value={to}
              min={from || undefined}
              onChange={(event) => onChange({ createdTo: event.target.value })}
            />

            <div className="flex justify-end gap-2">
              <ForgeButton
                size="sm"
                disabled={!from && !to}
                onClick={() => onChange({ createdFrom: "", createdTo: "" })}
              >
                {t("anomalies.clearDates")}
              </ForgeButton>
              <ForgeButton size="sm" variant="primary" onClick={() => setOpen(false)}>
                {t("common:actions.close")}
              </ForgeButton>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ══ FILTER STATE ══════════════════════════════════════════════════════ */

/**
 * Every filter blank, and the two sort parameters at the endpoint's own
 * defaults.
 *
 * Empty strings rather than null or undefined: these bind to controls, and a
 * select with `value={undefined}` is uncontrolled. `toParams` drops anything
 * falsy on the way out, so blank never reaches the wire.
 */
const BLANK_FILTERS = {
  status: "",
  severity: "",
  plantId: "",
  lineId: "",
  machineId: "",
  createdFrom: "",
  createdTo: "",
  sortBy: DEFAULT_SORT_FIELD,
  sortDir: DEFAULT_SORT_DIRECTION,
};

/**
 * Which parameters count as narrowing, for the active-filter chips and the empty
 * state.
 *
 * Sort is excluded: it reorders the set rather than reducing it, so a sorted and
 * unfiltered list showing nothing means the account has no anomalies — and
 * offering "clear filters" there would be a button that changes nothing.
 */
const FILTER_KEYS = ["status", "severity", "plantId", "lineId", "machineId", "createdFrom", "createdTo"];

/** "Any". Radix rejects an item whose value is the empty string. */
const ANY = "__any__";

