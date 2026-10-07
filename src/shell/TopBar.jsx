import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
// `DropdownMenuItem` and `DropdownMenuSeparator` are deliberately not imported:
// the scope panel opens but selects nothing, so it holds no commands and needs
// no rule between them.
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/forge/Icon";
import { BrandLockup } from "@/components/forge/BrandLockup";
import { ForgeButton, IconButton } from "@/components/forge/ForgeButton";
import { Dot, Mono, Num } from "@/components/forge/primitives";
import { Sparkline } from "@/components/forge/Sparkline";
import { useCurrentShift, useTopline } from "@/features/operations/queries";
import { useSession } from "@/features/auth/mutations";
import { useAlertCounts } from "@/features/alerts/queries";
import { useHierarchyNodes } from "@/features/hierarchy/queries";
import { useDemoRole } from "@/providers/DemoRoleProvider";
import { useScope } from "@/providers/ScopeProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { config } from "@/services/config";
import { formatDecimal, formatInteger, formatPercent } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * The 48px top bar. Never scrolls — an operator mid-triage must not lose the
 * scope selector or the shift they are on.
 *
 * Icon-only buttons dominate the end side deliberately: they are the only
 * controls immune to text expansion, and horizontal room here is the scarcest
 * in the product.
 */
/**
 * The tier ladder, as it reads in the scope panel.
 *
 * Same hues as the tier chips on Sites & Hierarchy, so a level means the same
 * colour wherever you meet it. The icon is redundant encoding rather than the
 * carrier — depth, colour and the name each say the tier independently. That
 * redundancy matters more now the rows are text: colour is the only thing left
 * distinguishing them, so it cannot be the only channel carrying the tier.
 */
const SCOPE_ICON = {
  enterprise: "globe",
  region: "map",
  subRegion: "layers",
  site: "factory",
  line: "conveyor",
};
const SCOPE_TINT = {
  enterprise: "tint-violet",
  region: "tint-forge",
  subRegion: "tint-amber",
  site: "tint-green",
  line: "tint-ack",
};
const SCOPE_INK = {
  enterprise: "text-on-violet",
  region: "text-on-forge",
  subRegion: "text-on-amber",
  site: "text-on-green",
  line: "text-on-ack",
};

export function TopBar({ railCollapsed, onToggleRail, onOpenAssistant }) {
  const { t } = useTranslation(["app", "common"]);
  const { theme, colourBlind, toggleTheme, toggleColourBlind, isDark } = useTheme();
  const { nodeId, params } = useScope();
  const { role } = useDemoRole();
  const { data: session } = useSession();
  const { data: topline } = useTopline(params);
  const { data: shift } = useCurrentShift();
  const { data: counts } = useAlertCounts(params);

  /**
   * The scope selector reads the account's real hierarchy.
   *
   * Flattened in tree order with each row's depth, which is what lets a single
   * list render as a tree. It stops at the production line: a scope is a place
   * you stand to look at a plant, and standing on one machine is what the asset
   * screens are for — listing every machine here would also make the menu
   * hundreds of rows long on any real account.
   */
  const { data: hierarchy, isPending: hierarchyPending } = useHierarchyNodes();

  const scopes = useMemo(() => {
    const nodes = hierarchy?.items ?? [];
    const byParent = new Map();
    for (const node of nodes) {
      if (!byParent.has(node.parentId)) byParent.set(node.parentId, []);
      byParent.get(node.parentId).push(node);
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => (a.code ?? "").localeCompare(b.code ?? ""));
    }

    const out = [];
    const walk = (node, depth) => {
      out.push({ ...node, depth });
      if (node.tier === "line") return;
      for (const child of byParent.get(node.id) ?? []) walk(child, depth + 1);
    };
    const root = nodes.find((node) => node.parentId === null);
    if (root) walk(root, 0);
    return out;
  }, [hierarchy]);

  // `scopes[0]` is the account root by construction. It is the fallback for the
  // case that actually happens: the selected node was removed in Settings while
  // this was still pointing at it.
  const scope = scopes.find((option) => option.id === nodeId) ?? scopes[0];

  return (
    <header
      className={cn(
        "z-20 flex min-h-12 shrink-0 items-center border-b border-hairline bg-card pe-3.5",
        "dark:backdrop-blur-[20px] dark:backdrop-saturate-[1.8]",
      )}
    >
      {/* The wordmark is 3:1 and will not fit the 60px collapsed rail, so that
          slot takes the icon mark. Same reason every brand ships both.

          Points at the app home, not `/`. TopBar only mounts inside `/app/*`,
          so the person clicking this is signed in — sending them to the public
          landing at `/` reads as a sign-out (that page shows the Login CTA)
          and the browser back button then rewinds to whatever page they left,
          which is worse than not moving at all. */}
      <Link
        to="/app/home"
        className={cn(
          "flex shrink-0 items-center [transition:width_.18s_ease]",
          railCollapsed ? "w-15 justify-center ps-0" : "ps-4",
        )}
        style={{ width: railCollapsed ? "var(--rail-w-collapsed)" : "var(--rail-w)" }}
      >
        <BrandLockup variant={railCollapsed ? "mark" : "wordmark"} size="md" />
      </Link>

      <IconButton bare label={railCollapsed ? t("common:nav.expand") : t("common:nav.collapse")} onClick={onToggleRail} className="size-8">
        <Icon name="rail" />
      </IconButton>

      {/* Scope. The account's real hierarchy, down to the production line.

          ── It opens; nothing inside it acts ──────────────────────────────
          The panel still shows the whole tree, because "where am I and what
          else is there" is a real question in the middle of triage. What it no
          longer does is pretend the answer can be changed from here: selecting
          a node only ever altered the word in this bar, never what any screen
          below fetched (see ScopeProvider). So the rows are text now — no
          `DropdownMenuItem`, no `onSelect`, no link out to Settings.

          That means the popover carries no focusable descendant at all, which
          is why the rows are plain elements rather than disabled menu items: a
          disabled item is still announced as a command that is unavailable,
          and none of this is a command. Radix keeps the trigger, the
          click-outside and the Escape; the interior is a read.

          Restoring the picker is putting `DropdownMenuItem` and `setNodeId`
          back on the row the day scoped reads exist — `scopes` and `nodeId`
          above are untouched and still carry everything it needs. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* Control size, like the rest of the bar. The scope out-ranks the KPIs
              beside it by weight and by the coloured tier glyph, not by size —
              the prototype's larger figure is set in a taller bar and reads as a
              headline in a 48px one. */}
          <button
            type="button"
            className="flex min-w-[236px] items-center gap-2 rounded-lg px-2.5 py-1 text-start transition-colors hover:bg-sunken max-lg:min-w-0"
          >
            <Icon name={SCOPE_ICON[scope?.tier] ?? "globe"} size="md" className="text-forge" />
            {/* The design reads "Enterprise · All Sites" at the root, and the
                qualifier is doing real work: the account name alone does not say
                whether you are looking at everything or at one plant that happens
                to share the company's name. Only at the root — on a site or a
                line the name IS the scope, and "Findlay Plant · All Sites" would
                be a contradiction. */}
            <span className="flex-1 truncate text-control">
              {scope?.name ? (
                scope.tier === "enterprise" ? (
                  <>
                    {scope.name} <span className="text-ink-dim">·</span> {t("scope.allSites")}
                  </>
                ) : (
                  scope.name
                )
              ) : hierarchyPending ? (
                t("scope.loading")
              ) : (
                t("scope.unavailable")
              )}
            </span>
            <Icon name="down" size="sm" className="text-ink-mute" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[70vh] w-[340px] overflow-y-auto p-1.5">
          {/* `text-label` alongside `eyebrow`, and it is load-bearing.
              `DropdownMenuLabel` ships `text-sm`, and `eyebrow` is a custom
              utility that tailwind-merge cannot recognise as a font size — so
              nothing dropped it, and `.text-sm` sorts AFTER `.eyebrow` in the
              built sheet. The label was rendering at 14px uppercase with the
              eyebrow's letter-spacing: a shouting heading nobody asked for.
              `text-label` IS registered in cn.js, so it evicts `text-sm`.

              No separator under the label. The prototype sets the heading off with
              space, and a hairline this close to the first row's own tinted
              selection edge reads as a stray border. */}
          <DropdownMenuLabel className="eyebrow px-2.5 pt-1 pb-2.5 text-label">
            {t("scope.label")}
          </DropdownMenuLabel>

          {scopes.length ? (
            /* A list, not a menu. `role="menu"` on the content would promise
               commands that are not here; an explicit `list` says these are
               things, which is what they now are. */
            <ul role="list" className="m-0 list-none p-0">
              {scopes.map((option) => (
                <li
                  key={option.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border-s-[3px] border-s-transparent py-1 pe-2.5 ps-1.5",
                    // No hover state: the row does not respond to a pointer, so
                    // it must not light up under one. The tint marks the level
                    // the app is actually scoped to, and only that.
                    option.id === nodeId && "tint-forge border-s-forge",
                  )}
                  aria-current={option.id === nodeId ? "true" : undefined}
                >
                  {/* Depth guides. One hairline per level, so the shape of the
                      tree is legible in a flat list without indenting text off
                      the edge of a 360px menu. */}
                  {Array.from({ length: option.depth }, (_, level) => (
                    <span
                      key={level}
                      aria-hidden="true"
                      className="w-2.5 shrink-0 self-stretch border-s border-subtle"
                    />
                  ))}

                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md",
                      SCOPE_TINT[option.tier] ?? "bg-sunken",
                    )}
                  >
                    <Icon
                      name={SCOPE_ICON[option.tier] ?? "factory"}
                      size="xs"
                      className={SCOPE_INK[option.tier] ?? "text-ink-dim"}
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-body-sm",
                        option.id === nodeId ? "font-bold text-on-forge" : "font-medium text-ink",
                        option.isActive === false && "text-ink-dim",
                      )}
                    >
                      {option.name}
                    </span>
                    {/* The prototype's second line is that node's live alert count.
                        Nothing in the API answers alerts per node — `/alerts/counts`
                        takes one scope at a time — so the slot carries the tier
                        instead, which is the fact that actually disambiguates two
                        similarly named levels ("Demo Region" above "Demo Sub
                        Region"). Swap it for the count the day the endpoint exists;
                        the layout is already the prototype's. */}
                    <span className="eyebrow mt-px block">
                      {t(`settings.hierarchy.tiers.${option.tier}`, { defaultValue: option.tier })}
                    </span>
                  </span>

                  {/* Where the prototype put an OEE figure. The live hierarchy
                      serves structure and names, so this carries the short code —
                      a fact it does serve — rather than a number nothing measured. */}
                  {option.code ? <Mono className="shrink-0 text-ink-dim">{option.code}</Mono> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 px-2 py-3 text-body-sm text-ink-dim">
              {hierarchyPending ? t("scope.loading") : t("scope.empty")}
            </p>
          )}

          {/* The "build your hierarchy" link that used to sit under an empty
              tree is gone with the rest of the interior — it was the one
              genuinely useful action here, and it is one nav click away in
              Settings. Nothing in this panel navigates. */}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* OEE · MTBF · MTTR · Anomalies 24h — DEMO ONLY.
          `/kpis/topline` is answered by the fixture layer, so these four figures
          are authored rather than measured. A plant metric nobody measured, set
          in the top bar of every screen, is a number people quote in meetings —
          which is why this strip was removed from the shipping product.

          `VITE_DEMO_MODE` is exactly the case it should come back for: the flag
          says out loud that what is on screen is the prototype. With it off the
          bar is what ships. Delete the condition, not the strip, the day the
          endpoint is real. */}
      {/* ── How the strip gives way ──────────────────────────────────────
          Four figures, a sparkline, the scope selector, the shift chip and four
          buttons do not fit in a 48px bar on a 1024px laptop, so the strip sheds
          in the order the numbers matter.

          OEE and the 24h anomaly count survive to `lg`; MTBF and MTTR — the two
          nobody triages from — leave below `xl`. The whole strip goes below
          `lg`, where the bar is down to scope and controls.

          The previous single `max-xl:hidden` was why this appeared to be missing
          on a 1280-and-under window: it was rendering and hidden, rather than
          absent. Shedding per figure means the common laptop width keeps the two
          that are worth the space. */}
      {config.demoMode ? (
        <dl className="ms-1.5 flex min-w-0 items-center max-lg:hidden">
          <Kpi
            label={t("common:metrics.oee")}
            value={formatPercent(topline?.oee?.value)}
            trend={topline?.oee?.trend}
          />
          <Kpi
            className="max-xl:hidden"
            label={t("common:metrics.mtbf")}
            value={topline ? `${formatInteger(topline.mtbf.value)}h` : "—"}
          />
          <Kpi
            className="max-xl:hidden"
            label={t("common:metrics.mttr")}
            value={topline ? `${formatDecimal(topline.mttr.value)}h` : "—"}
          />
          <Kpi
            label={t("common:metrics.anomalies24h")}
            value={formatInteger(topline?.anomalies24h?.value)}
            tone={topline?.anomalies24h?.value > 15 ? "amber" : undefined}
          />
        </dl>
      ) : null}

      <div className="flex-1" />

      {shift ? (
        <div className="me-2 flex items-center gap-2 border-e border-subtle pe-2.5 max-lg:hidden">
          <Dot tone="green" />
          <div>
            <div className="text-micro">
              {t(`common:shift.${shift.shift}`)} ·{" "}
              <Num>
                {String(shift.startHour).padStart(2, "0")}:00–
                {String(shift.endHour).padStart(2, "0")}:00
              </Num>
            </div>
            {/* Name and the role being PREVIEWED — the rail's switcher state,
                echoed here so the two agree.

                It used to be name and email, because the API returns no role
                claim and the address is what tells you which account you are in
                at a shared terminal. The role is the more useful of the two on
                this bar: it is what decides the briefing, and it is the thing
                that changes under you when somebody uses the switcher. */}
            <div className="text-label font-bold text-ink-dim">
              {session?.user?.name}
              {` · ${t(`common:roles.${role}`)}`}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-1.5">
        <IconButton label={isDark ? t("common:theme.toLight") : t("common:theme.toDark")} onClick={toggleTheme}>
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </IconButton>
        <IconButton label={t("common:theme.colourBlind")} pressed={colourBlind} onClick={toggleColourBlind}>
          <Icon name="eye" />
        </IconButton>
        {/* The bell went nowhere — no `onClick`, no destination, next to two
            toggles that work. The design points it at the alert-configuration
            screen, which is where the answer to "why did that fire, and who
            was told" lives. With the flag off there is no such screen, so it
            stays the inert control it was rather than becoming a broken link.

            The badge is the real critical count, not the design's literal 3. */}
        {config.demoMode ? (
          /* A Link rather than `IconButton asChild` — that component renders a
             `<button>` and does not take `asChild`, and a button that navigates
             is a link a keyboard user cannot open in a new tab. The classes are
             `IconButton`'s own so the three controls in this cluster stay one
             row of identical squares. */
          <Link
            to="/app/notifications"
            aria-label={t("common:nav.notifications", { count: counts?.critical ?? 0 })}
            className={cn(
              "relative flex size-[34px] items-center justify-center rounded-lg transition-colors",
              "border border-hairline bg-card text-ink-dim hover:border-forge hover:text-ink",
              "max-lg:size-11",
            )}
          >
            <Icon name="bell" />
            {counts?.critical ? (
              /* Aria-hidden: the count is already in the link's own label, and
                 a screen reader announcing "Notifications, 3 critical" then "3"
                 has read it twice. */
              <span
                aria-hidden="true"
                className="absolute top-0.5 flex size-4 items-center justify-center rounded-full bg-red text-[9px] font-bold text-white"
                style={{ insetInlineEnd: "2px" }}
              >
                <Num>{counts.critical}</Num>
              </span>
            ) : null}
          </Link>
        ) : (
          <IconButton label={t("common:nav.notifications", { count: counts?.critical ?? 0 })}>
            <Icon name="bell" />
          </IconButton>
        )}

        {/* The prototype's own `.btn-ai`, and now literally the same object as
            Investigate on an anomaly: `ForgeButton`'s `ai` variant carries the
            gradient, the weight, the 10px corner and the hover, so the product's
            two AI entry points cannot drift apart. This was hand-rolled here for
            months and was the only place the treatment was declared inline.

            See DESIGN.md correction 20 for why a violet-to-blue gradient ships on
            an AI affordance at all, given this document names that exact thing as
            the clearest generated-software tell there is. */}
        <ForgeButton variant="ai" onClick={onOpenAssistant}>
          <Icon name="ai" size="sm" />
          <span className="max-lg:hidden">{t("common:brand.assistant")}</span>
        </ForgeButton>
      </div>
    </header>
  );
}

/**
 * One figure in the top-bar strip. Demo mode only — see the block that renders
 * these.
 *
 * The sparkline sits BESIDE the number rather than under it, which is the
 * prototype's arrangement and the correct one for a 48px bar: stacking a chart
 * under a value would push the row past the bar's height, and the trend is a
 * gloss on the figure, not a second row of information.
 */
function Kpi({ label, value, tone, trend, className }) {
  return (
    <div className={cn("border-s border-subtle px-3 py-1 first:border-s-0", className)}>
      <dt className="text-label font-semibold tracking-[0.4px] whitespace-nowrap uppercase text-ink-dim">
        {label}
      </dt>
      <dd className="mt-0.5 flex items-center gap-2">
        <Num
          className="text-body-sm font-bold leading-none"
          style={tone ? { color: `var(--on-${tone})` } : undefined}
        >
          {value}
        </Num>
        {trend ? <Sparkline values={trend} /> : null}
      </dd>
    </div>
  );
}
