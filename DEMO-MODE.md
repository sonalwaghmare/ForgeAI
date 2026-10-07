# Demo mode — rebuilding the Claude Design prototype

**Read this before touching anything behind `VITE_DEMO_MODE`.** It is the working
agreement for this effort: what the flag is, the recipe every screen follows, the
decisions already taken, and the per-module specification of what still has to be
built. It exists so that no part of this has to be re-derived from a 1 MB design
prototype twice.

Two sections earn their keep before any others. **§2.7** lists the traps that have
already cost time, and **§3.1** lists the handful of problems the prototype
repeats on every screen — reading those two first is worth more than reading the
module spec you came for.

---

## 0. Build against the rendered design, not its source

**This is the rule that has cost the most time by being learned late.** Three
screens were built by reading `platform/screens-*.jsx`, rebuilding from what the
source said, and shipping something the reviewer immediately identified as not
the design: Users & Teams, Notifications and the Audit log. Each was rebuilt.

Reading the JSX tells you the content. It does not tell you the shape, and it
leaves room for judgement that will quietly fill itself in. **Open the prototype
and look at the screen before writing the page**, and again before saying it is
done:

```
https://claude.ai/design/p/019e11cf-49a7-744a-b634-e0d248971607?file=Forge+AI+Platform.html
```

It renders live in Chrome and the browser tools can drive it. Ask the reviewer
for a screenshot of the target screen if that is faster — they have offered, and
it is.

### The rule the audit-log rebuild settled

> **Match the structure exactly. Depart only on what a value CLAIMS, never on
> where it sits.**

A dishonest value becomes an honest one **in the same cell**. It does not get its
column deleted, its row restyled, or a tile invented in its place. Worked
examples, all of them live:

- The audit log's IP column **stays and is empty**, because the address is
  recorded by a server that does not exist. A footnote says so.
- Its hash column is gone — but only because the value itself was the lie, and
  the footnote carries the statement instead.
- Browser push on Notifications **stays in its row**, disabled, with the reason.
- Security's Force re-enroll and Add-my-current-IP **stay where the design puts
  them**, disabled, with the reason.

The failure mode this replaces: every individually-defensible improvement, summed
over a screen, produces something that is not the design. If a value cannot be
honest, say so in the cell — do not redesign around it.

---

## 1. What demo mode is

`VITE_DEMO_MODE=true` reveals every screen and panel that exists in the Claude
Design prototype but has no API behind it yet.

It is **additive, never a substitute**. With the flag on, the modules that are
genuinely wired — Anomalies, Sites & Hierarchy, Asset Classes, Data Fusion → IoT
sensors — keep reading the real API exactly as they do today. Nothing that works
is replaced by a fixture.

With the flag off the app is what ships: unbuilt modules say so, and no invented
figure appears anywhere.

**The rule that follows from this:** if a thing already comes from the API, leave
it alone. If the design shows a thing the product does not have, add it — but add
it as data flowing through the ordinary path, not as a literal typed into JSX.

### Turning it on

`.env.local` (gitignored, never committed):

```
VITE_DEMO_MODE=true
```

Restart the dev server — Vite reads env files at start only.

**`.env.local` beats `.env`.** To turn the flag OFF again, edit it *here*, not in
`.env` — Vite loads `.env` first and `.env.local` over the top, so setting
`.env` to `false` while this file says `true` changes nothing. This has already
cost one round of "the flag is off and I still see the demo".

Do **not** add `VITE_AUTH_MODE=mock` alongside it. That flag means "the backend is
unreachable" and sends every live path back to the fixture layer, which has no
route for `/v1/asset-hierarchy` — the scope selector then reads "Hierarchy
unavailable". This has already cost one debugging round; do not repeat it.

---

## 2. The rules

These are not style preferences. Each one is a mistake that was made and fixed.

### 2.1 Data goes through the transport, never into the component

The prototype hardcodes its arrays inside JSX. Copying that would make landing the
real endpoint a rewrite of the screen. Every demo value instead travels:

```
mocks/fixtures/<module>.js      the authored data
  → mocks/mockAdapter.js         a route that answers a URL
  → services/endpoints.js        the URL, written once
  → features/<module>/api.js     the service function + wire mapping   ← THE SEAM
  → features/<module>/queries.js the hook, gated on config.demoMode
  → pages/<module>/*.jsx         the screen, which knows none of the above
```

When the endpoint is real, `api.js` changes and nothing else does. That is the
entire point of the arrangement.

The screens get loading states, refetching and cache invalidation for free, which
is also why the demo feels like the product rather than like a slide.

### 2.2 Gate at the hook, not at the JSX

```js
const DEMO = { enabled: config.demoMode }
export const useHomeKpis = () =>
  useQuery({ queryKey: queryKeys.homeKpis, queryFn: ..., ...DEMO })
```

A component can then be mounted, moved or refactored without anyone remembering
to re-check the flag, and with the flag off the app makes no request for a screen
it is not showing. A poll nobody renders is a request nobody can see.

For an existing shared hook, add an `enabled` option rather than a second hook —
see `useAlerts(params, { enabled })`.

### 2.3 i18n: furniture yes, content no

- **Through `t()`:** every label, column heading, button, tab, placeholder,
  `aria-label`, empty state, error message, toast. Anything that will still say
  the same thing after the API lands.
- **Not through `t()`:** anything that is or will be data — asset names, person
  names, AI prose, figures, ids, the briefing text.

`npm run verify:i18n` fails on a missing key and on a hardcoded `aria-label`,
`placeholder`, `alt` or `title`.

Two traps that have already bitten:
- A file with no `useTranslation()` call defaults to the `common` namespace. In a
  plain `.js` helper, qualify every key: `t('app:handovers.report.plant')`.
- A `*/` inside a block comment — e.g. writing `features/*/api.js` in prose —
  closes the comment early and the file fails to parse with a confusing error.

### 2.4 Colour: tokens only

`src/styles/tokens.css` is the only file in the repo that may contain a colour
literal, and `npm run verify:colors` enforces it. **The good news: that file
already holds the prototype's exact palette**, copied verbatim — same orange,
green, amber, red, violet, same light and dark surfaces. Matching the design's
colour costs nothing.

Dynamic colour comes from a token in an inline style:

```jsx
style={{ color: `var(--on-${tone})` }}
style={{ backgroundColor: `color-mix(in srgb, var(--hue-${tone}) calc(var(--tint) * 100%), transparent)` }}
```

Never a template-literal class (`` `text-${tone}` ``) — Tailwind scans source text
and never generates it. Use the static maps in `src/lib/tone.js`.

### 2.5 A composed route gets a check in `verify:mocks`

Anything the handler *computes* rather than returns — a join, a derived count, a
cascade — is invisible in the fixture and breaks in ways reading the fixture
cannot show. `scripts/verify-mocks.mjs` runs the real axios instance through the
real adapter, so a check there is cheap and exact. Assert the property, not the
value: "the waterfall sums to the headline", "the heatmap counts the rows the
table lists", "two assets never share a briefing".

This is not belt and braces. A green fixture is not evidence the handler over it
runs — `PEOPLE.find` on an object shipped because nothing called the route.

**Anything that reads the clock gets its date PINNED, at several days.** Two
bugs shipped in one afternoon because the checks ran on the day that happened to
make them pass: a roster built as "the seven days ending today" looks exactly
like a Monday-to-Sunday week — but only on a Sunday, which is the day it was
written on; and a rota keyed to a row's index in the array gave a different
operator for the same Tuesday at seven days than at thirty. Both were invisible
to a check that used `Date.now()`. Take `now` as a parameter and assert over a
Monday, a mid-week day and a Sunday.

### 2.6 `npm run verify` passes before the next module starts

lint → i18n → colour → mock contract → production build. Nothing rots.

### 2.7 Traps that have already cost time

Each of these shipped once. None is obvious from reading the code that has it.

- **`PEOPLE` is keyed by role, not a list.** `Object.values(PEOPLE).find(…)`.
- **A throw inside a mock handler used to read as "cannot reach the platform"** —
  axios sees an error with no response and calls it a network fault. The adapter
  now catches, logs the stack and answers 500. If a demo screen claims the
  backend is down, look in the console first. That catch then swallowed a
  handler's *deliberate* `fail(422, …)`, so it rethrows anything that already
  carries a `.response`: a rejected state transition is an answer, not a crash.
- **A page must never import from `mocks/`.** Shared enums live in
  `features/<module>/api.js`; the fixture imports from there, not the reverse.
  The other direction bundles the demo layer into production.
- **`overflow-x-auto` clips the block axis too.** Anything sitting outside its
  box — a count badge on a card corner — needs padding *inside* the scroller.
- **`w-full` on a table column protects one long cell.** It is not a default: on
  a table of short cells it collapses the other columns and empties half the
  card. See `ProductionLinesTable`.
- **Neither `tailwindcss-animate` nor `tw-animate-css` is installed**, so
  shadcn's `animate-in` / `slide-in-from-*` classes are inert. Motion is declared
  in `styles/index.css` as `--animate-*`, where the global reduced-motion rule
  reaches it.
- **Rotating the `x` glyph 45° draws a plus, not a minus.** There is a `minus` in
  the sprite. Both zoom controls in Lines & Assets shipped with two plus buttons.
- **`count` is i18next's plural key.** A message with a bare `{count}` in it,
  handed a `count`, can render verbatim — braces and all. Name it anything else
  unless it is driving an ICU plural.
- **A time in an ISO string is UTC, so `at.includes('T02:14')` is a time-zone
  bet.** Two logbook checks passed in London and would have failed anywhere
  else: the entry reads 02:14 to the reader because it is rendered in local
  time, and matching the instant's text matches the wrong hour. Compare through
  `new Date(value).getHours()`, never against the serialised form.
- **`verify:i18n` cannot see a template key, so a nav item can ship its own
  key as its label.** The rail renders `t(`screens.${item.id}`)`; the checker
  scans for literal keys and a template is not one, so adding Analytics &
  Reports put a sidebar item reading **`screens.reports`** into the shell and
  every check passed. `verify:mocks` now asserts every nav item has a label.
  The general form: anything keyed dynamically needs its own completeness
  check, because the i18n pass will not give you one.
- **`mutate`'s per-call callbacks belong to the observer, and StrictMode drops
  them.** The Copilot answer was delivered through `onSuccess` passed to
  `mutate`, fired from an effect. React's development double-mount replaced the
  observer while the request was in flight: the POST completed, the answer came
  back, nothing was listening, and the screen sat on "Working…" for ever with no
  error anywhere. A mutation with no cache to invalidate is buying only those
  callbacks — so `askCopilot` is a plain awaited function and the page owns its
  own pending flag. If a send never lands, look here before looking at the
  transport.
- **A named manual chunk beats a lazy route for a heavy import.** The world
  map's geometry sits in `node_modules`, so `manualChunks`'s
  `id.includes('node_modules')` swept it straight into `vendor` — which every
  page downloads — and lazily routing the page that used it bought nothing.
  `vendor` grew 57KB and the lazy chunk was 8KB, which is the shape of this bug:
  the split looks like it worked. Name the dependency its own chunk.
- **A chart handed a paginated list plots the page, not the data.** The Shifts
  synopsis was given the table's ten rows, so a fortnight of roster arrived as
  three and a half days and the axis read Thu–Sat. A summary, a chart or a map
  asks for the whole set — `pageSize: 500` — and only the table pages. Cost
  three rounds on one chart before anyone looked at the request.
- **An SVG `<text>` is sized in viewBox units, so it scales with the card.**
  `fontSize="10"` in a 760-wide viewBox renders at 9.5px on the home page and
  **5.5px** in the Sensor Explorer's grid, while the HTML labels beside it are a
  fixed 11px — two sizes on the two axes of one chart. Every axis label in
  `TrendChart`, `SignalTrace` and `WorkstationChart` is now HTML positioned by
  percentage off the same geometry the grid uses. There is no `fontSize` left in
  any chart, and there should not be one again.

---

## 3. Decisions already taken

Do not relitigate these. If one turns out wrong, change it here first.

| Decision | Why |
|---|---|
| **Place names stay Meridian's** — Findlay, Weißenthurm, Pune. Not the prototype's Chennai / Ball Corporation. | The anomaly list, the briefing and the public page already agree on Meridian. Two plants in one product is worse than a different city name. |
| **Real data keeps its real values.** The greeting uses the signed-in user's name; alert counts come from the alert fixture. | The user's rule: only what is *missing* gets authored. |
| **Layouts are written out twice, not merged with ternaries** — `LiveDashboard` and `PrototypeDashboard` in `HomePage.jsx`. | The compositions genuinely differ. One tree of conditionals makes "what does this look like with the flag off" unanswerable at a glance. |
| **The AI violet is not spent on routine buttons.** Create Handover is the orange primary, as the design has it. | The machine drafting the first version is a property of the form that opens, not of the act. The AI badge goes on the paragraph Forge AI actually wrote. |
| **No invented numbers attached to real API records.** | The scope dropdown shows tier + short code instead of the design's per-node OEE and alert count, because those rows are live hierarchy nodes. Revisit only on request. |
| **Motion defers.** Carousels stop on hover *and* keyboard focus, and never auto-start under `prefers-reduced-motion`. | The design only handles hover, which leaves a keyboard user reading something that moves under them. |
| **Toasts confirm every mutation.** `useToast()` from `ToastProvider`. | The prototype does; the product had nothing to do it with. |
| **Demo-only routes are registered conditionally**, e.g. `/app/handovers`. | With the flag off the route should 404, which is the truth about it. Mark the nav item `demoBuilt: true` and let `isBuilt()` resolve it. |
| **Authored numbers must be arithmetically consistent with each other.** Derive the second figure from the first in the mock handler rather than typing both. | The prototype's OEE screen prints three mutually contradictory answers to one multiplication. Anyone in the room who checks finds the demo out. |
| **Composed, never restated.** Lines and assets are read from `HIERARCHY_NODES` and their alert counts from `ALERTS`; only the operational overlay is authored. | A second list of lines is how this screen and Settings → Sites & Hierarchy end up disagreeing about what is on Line 1. It also caught a real bug: the first OEE table put Ends Line 1 under Findlay, when the hierarchy has it at Weißenthurm. |
| **Prototype decoration gets made functional, not copied.** The A/P/Q pills toggle series; the Day/Week/Month chips swap the payload. | A control that does nothing is the clearest possible signal that a screen is a mock-up. |

---

## 3.1 Corrections the prototype needs, over and over

Six modules in, the same handful of problems turn up on every screen. Expect
them, and fix them the same way each time — the user's instruction is to
replicate the design, and none of these is the design's *intent*.

| Pattern | What it looks like | What to do |
|---|---|---|
| **One authored blob shown everywhere** | The same AI briefing on all thirty assets, so a palletizer claims a drive-end bearing at 13.7× baseline. A fixed "87% confidence". A fixed "Mar 14–21" failure window. | Compose it from the record. `assetBriefing()` is the pattern. |
| **The same fact authored two or three times** | 18 alerts in the table, 178 in the heatmap total, 4 rows on screen. A waterfall of −12/−8/−1 under a headline of 74.2. | Generate once, count the rest off it. Then assert it in `verify:mocks`. |
| **Dead controls** | A/P/Q pills always lit, Day/Week/Month chips that relabel nothing, an Import that animates a bar and closes, three tab counts where only the first tab fills. | Make it work, or make it say what it is. Never leave it inert. |
| **State that should be a URL** | Tabs and view switches in `useState`, so no screen inside a module can be linked, bookmarked or backed out of. | Routes for views, search params for tabs. |
| **Hardcoded calendars and axes** | 31 day-cells starting on a Monday — right one month in seven. | Compute from the date. |
| **A figure with nothing behind it** | A rendered photo of a bodymaker on every asset; "Updated 1s ago" on a machine that last reported twelve minutes ago. | Derive it, or draw something schematic and caption it as such. |
| **Content borrowed from another demo** | `VAL › 23 › 230900 · Gas compression & re-injection` on a can plant. Chennai, Detroit, Rotterdam. | Use the Meridian universe (§4) and the real hierarchy. |
| **Two directions on one screen** | A status axis running newest-first above a chart running oldest-first. | Pick the product's convention and keep it. Say so in a comment. |
| **A badge with no rule behind it** | `ai: true` on four logbook entries of six and false on two, with nothing deciding which; a fixed "87% confidence". | Make it a computed property of the record, then check the MIX is real — "some but not all" is the assertion that catches a rule which turns out to be always-true. |
| **A window that is right on one day of the week** | "The last seven days" drawn under a Mon–Sun axis; a chart of "this week" that is five-sixths empty on a Monday. | Decide whether the thing is a calendar week or a rolling one, and pin the date in `verify:mocks` at three different weekdays. |

---

## 4. The demo universe

Everything authored must fit this world. Sources: `mocks/fixtures/enterprise.js`,
`hierarchy.js`, `alerts.js`, `operations.js`, `home.js`.

**Org:** Meridian Industrial (`org_meridian`), plan `professional`.

**Sites:** Findlay Plant (Ohio, `site_findlay`, inches/sec + °F) · Weißenthurm
Works (Rhineland, `site_weissenthurm`, mm/s + °C) · Pune Plant (`site_pune`).
Engineering units belong to the site and are never converted.

**People:** Arjun Mehta (operator, Pune) · Dana Okafor (plant manager, Findlay —
the signed-in demo persona, `usr_mgr_1`) · Ines Brandt (reliability engineer,
Weißenthurm) · James Whitfield (COO). Added for tasks: Karan Patel (technician),
Maya Reddy (shift lead).

**Lines:** Line 1, Line 2, Ends Line 1, Compressed Air.

**Assets:** `FDY-BM-03` Bodymaker 3 · `FDY-BM-07` Bodymaker 7 · `FDY-WSH-01`
Washer · `FDY-DEC-02` Decorator 2 · `FDY-OVN-01` IBO Oven · `FDY-PAL-02`
Palletizer · `FDY-CMP-12` Compressor C-12 · `FDY-CHL-02` Chiller CH-02 ·
`PNQ-BM-02` Bodymaker 2 · `PNQ-NCK-01` Necker · `WTM-CVR-02` Conversion Press 2 ·
`WTM-PRS-04` Shell Press 4.

**Alerts:** `ALR-4471` (flagship — Bodymaker 3 drive-end bearing, vibration RMS,
4.5h to trip, 4 sensors agree) through `ALR-4441`.

**Sensors:** Vibration RMS · Coolant Flow · Bearing/Hydraulic Temp · Conductivity ·
Spindle Vibration · Ink Pump Pressure · Suction Pressure · Acoustic Emission ·
Zone 3 Temp.

---

## 5. What exists to build with

Before writing a component, check whether one already exists. Everything below is
in `src/components/forge/`.

| Component | Use it for |
|---|---|
| `Panel` / `Well` | The card. `flush` for a table body. `stripe` ONLY for real severity or AI authorship. |
| `ForgeButton` | `variant`: `primary` (≈1 per view) · `secondary` (default) · `ghost` · `danger` · `ai` (gradient — AI entry points only). `size`: `sm` `md` `lg`. |
| `IconButton` | Icon-only. `label` is required and must be translated. |
| `ForgeDialog` | Modal. `size` `sm`/`md`/`lg`/`xl`. `bodyClassName` to raise the scroll cap for a document-shaped dialog. |
| `ForgeDrawer` | Side panel over the same Radix dialog. For a set of controls you work beside the page, not a decision that interrupts it. |
| `ForgeSelect` | The select. `labelInline` gives the design's `Status : Open ⌄` filter pill with real combobox semantics. Never a DropdownMenu as a select. |
| `Field` / `TextArea` / `ErrorSummary` | Form controls with label, hint, error and ARIA wired. |
| `Chip` / `Segmented` / `SegmentedItem` | Filters, facets, tags, view switches. |
| `SeverityBadge` `StatusBadge` `StateBadge` `RcaBadge` `PlainBadge` `AiBadge` | Badges. `StateBadge` is for states on none of the other axes — running/stopped, connected/degraded. `hueForSeverity()` for stripes and dots. |
| `SignalTrace` | The semantic sensor chart — normal band, anomaly region, threshold rule, hover readout. `tone` colours the whole alarm vocabulary at once; it defaults to red, which is wrong for a grid of mostly-healthy channels. |
| `WorldMap` | The estate on a real map. Bundled Natural Earth land geometry projected by `d3-geo` — no API key, no tile server, no network at runtime, and every fill is a token. Takes sites with `coords` and a `tone`. Its geometry is a separate `worldmap` chunk; keep it behind a lazy route. |
| `Sparkline` | A trend with no axes. For a gloss beside a figure. |
| `HealthRing` | A health score as a ring, for a header. `Meter` is the same fact as a bar, for a row. |
| `Meter` | Health bar + figure. Owns the health ladder via `toneForHealth` — do not draw one by hand. |
| `TrendChart` | Multi-series line with an optional target band. First series is the subject, drawn heavy. `legend={false}` for one series · `xTicks` for a time axis · `axis={false}` strips both sets of tick labels and widens the plot · tone `muted` for a lone series over a band. A `null` in `values` **breaks the line** rather than reading as zero — for a series with a gap in it. Axis labels are HTML, not `<text>`; see §2.7. |
| `MetricCard` | One headline figure + delta arrow. The prototype's `KPI`. Not home's `KpiTile`, which is a link. |
| `TablePagination` | The table footer. It actually paginates. |
| `EmptyState` `ErrorState` `SkeletonRows` | The three states. Inside a `Panel`, pass `className="border-0 bg-transparent shadow-none"`. |
| `Briefing` | The AI briefing block renderer — `lead`, `pulse`, `card`, `closing`, with `stats` / `items` / `rows` / `people` / `actions`. |
| `ChatThread` `AiSurface` `RadarSweep` | Assistant surfaces. |
| `HierarchyTrail` `FacetTile` `AnomalyCard` `AlertCard` | Hierarchy breadcrumb, facet tiles, anomaly/alert objects. |
| `primitives.jsx` | `Eyebrow` `Num` `Mono` `Serial` `Measure` `Dot` `VRule` `SectionHead`. **Every comparable number goes in `Num`.** |
| `Icon` | Names: `home bolt gauge factory conveyor machine chart cal search wrench plug map gear pencil trash globe bell eye sun moon rail down up right arrow-right x plus minus list board users send check shield doc layers lock thermo wave ai`. Add to `IconSprite.jsx` if a new one is genuinely needed. |
| `useToast()` | `toast(message, 'ok' | 'info' | 'warn' | 'error')`. |

Formatters — `src/lib/format.js`: `formatNumber` `formatDecimal(v, digits)`
`formatInteger` `formatPercent(v, digits)` `formatSigned` `formatDateTime`
`formatTime(v, tz)` `formatDateRange` `formatRelative` `formatHours`
`formatCurrency(v, currency)` `initialsFrom`. Units — `src/lib/units.js`:
`formatMeasure`.

Tone maps — `src/lib/tone.js`: `STRIPE_CLASS` `TINT_CLASS` `ON_TINT_CLASS`
`toneForHealth` `STATE_TONE` `ANOMALY_STATUS_TONE` `ANOMALY_STATUS_ICON`.

### Layout conventions worth copying

- Table: give the widest column `w-full` so the narrow ones size to content;
  `whitespace-nowrap` on badges and short cells. Without this the browser shares
  width evenly and wraps everything at the end of the row.
- Two-column page: `[grid-template-columns:minmax(0,1fr)_minmax(300px,360px)]`
  with `max-xl:grid-cols-1`.
- Logical properties only — `ms-`/`me-`/`ps-`/`pe-`/`border-s`/`start-`/`end-`.
  Never `ml-`/`border-l`. Same for inline styles: `borderInlineStartWidth`.
- Page body wraps in `<Page>` from `@/shell/AppShell`.

---

## 6. The recipe for a new module

1. **Read the design source.** Pull the file(s) with `DesignSync` (§9) and list
   every screen, tab, drawer, modal, column and figure before writing anything.
2. **Write the spec into this file** under §8, then confirm it with the user.
3. **Fixture** — `src/mocks/fixtures/<module>.js`. Header comment saying it is
   synthetic. Module-level arrays so writes persist for the session. Deterministic
   generators — never `Math.random()`, which redraws charts under the reader.
4. **Endpoints** — add to `src/services/endpoints.js` under a `DEMO` comment. Use
   the path a real API would serve, not a `/demo` prefix.
5. **Mock routes** — `src/mocks/mockAdapter.js`. Literal paths before
   parameterised ones (`/handovers/latest` before `/handovers/:id`). Derive from
   existing fixtures where a value must agree with another screen.
6. **Query keys** — `src/services/queryClient.js`. Separate keys for things that
   invalidate on different events.
7. **Feature** — `src/features/<module>/api.js` + `queries.js`. Unwrap envelopes
   in `api.js`; hooks gated on `config.demoMode`.
8. **i18n** — add keys to `src/i18n/locales/en/app.json` (and `common.json` for
   shared verbs). Edit with a Python script, not by hand, to keep the JSON valid.
9. **Components** — `src/pages/<module>/`.
10. **Route** — register in `src/routes/router.jsx`, conditionally if the screen
    is demo-only. Flip the nav item's `built` handling if the module is in
    `shell/navigation.js`, `pages/settings/SettingsLayout.jsx` or
    `pages/dataFusion/sections.js`.
11. **`npm run verify`**, then commit with `[ai-assisted]` in the message.

---

## 7. Module status

| Module | Route | State |
|---|---|---|
| Home — AI Synopsis | `/app/home` | ✅ was already complete (all 3 roles) |
| Home — My Dashboard | `/app/home` | ✅ **done** |
| Shift Handovers | `/app/handovers` | ✅ **done** (demo-only route) |
| Top bar KPI strip + sparkline | shell | ✅ **done** (demo-gated) |
| Anomaly banner carousel | shell | ✅ **done** (demo-gated) |
| Anomalies | `/app/anomalies` | ✅ real API — **do not touch** |
| Settings → Asset Classes, Sites & Hierarchy | `/app/settings/*` | ✅ real API — **do not touch** |
| Data Fusion → IoT sensors | `/app/data-fusion/iot` | ✅ real API — **do not touch** |
| OEE & Operations | `/app/oee` | ✅ **done** (demo-gated route) |
| Lines & Assets — lines, line detail, asset detail | `/app/assets` | ✅ **pass 1 done** |
| Lines & Assets — Assets module | `/app/assets/all` | ✅ **pass 2 done** |
| Lines & Assets — Asset Detail, all 10 tabs | `/app/assets/:id` | ✅ **pass 3 done** |
| Lines & Assets — floor map | `/app/assets/all` | ✅ **pass 4 done** |
| Lines & Assets — bulk import wizard | `/app/assets/all` | ✅ **pass 5 done — module complete** |
| Sensor Explorer | `/app/sensors` | ✅ **pass 1 done** |
| Timeseries Workstation + chart catalogue | `/app/sensors/charts` | ✅ **pass 2 done — module complete** |
| Shifts | `/app/shifts` | ✅ **done** (demo-gated route) |
| Logbook | `/app/logbook` | ✅ **done** (demo-gated route) |
| Work Orders | `/app/work-orders` | ✅ **done** (demo-gated route) |
| Data Fusion — the other 10 sections | `/app/data-fusion/*` | ✅ **done** — all nine passes. See §8.10 |
| AI Copilot | `/app/copilot` | ✅ **pass 1 done** — the screen. The dock is still alert-only |
| Executive Dashboard | `/app/executive` | ✅ **pass 2 done** — rebuilt against `screens-executive.jsx` (3 tabs) |
| Analytics & Reports | `/app/reports` | ✅ **done** (demo-gated route + new nav item) |
| Notifications | `/app/notifications` | ✅ **done** (reached from the bell, as the design has it) |
| Settings — the other 11 pages | `/app/settings/*` | ◧ **Users & Teams, Roles, Notifications, Audit, Security, API & Webhooks done**; four left. See §8.14–8.19 |
| Workbook canvas | — | ⏸ decide: it is a tab of the prototype's Alert Detail, and our anomaly detail is deliberately different |

Design screens deliberately **skipped** (orphaned in the prototype, no link in):
RCAScreen, SafetyScreen, PredictiveScreen, AdminScreen, the old IntegrationsScreen,
the Tweaks panel.

### What to pick next, and why

The order that has worked is **whatever connects things already built**, not
whatever is largest. Each of the last three was chosen that way and each one
turned a dead reference live: Work Orders because `WORK_ORDERS` was named on the
OEE screen with no route behind it, Shifts because the Handovers archive was
unreachable from anywhere.

Logbook was the last one picked that way, and it held: the design's shift
detail panel had a Logbook button the Shifts pass left out for want of a
destination, and landing the module gave it one.

Notifications and Analytics & Reports were the last pair picked that way, and
between them **the shell now has no dead ends**: every control in the chassis
goes somewhere, and every module in the prototype's information architecture has
a rail item.

On that rule:

Executive was the last single-screen module. Everything left is a block.

1. ~~**Data Fusion, the other ten sections**~~ — done, in nine passes.
2. The **eleven Settings pages** — now the largest thing left, and unusually
   forgiving: eleven independent screens rather than one interlocking block, so
   it can be picked up and put down.
3. **AI Copilot pass 2** — the route-grounded dock, if it is wanted. That is a
   shell change touching every screen, which is why it was split off.

---

## 8. Per-module design specs

Figures below are the prototype's own. Translate place names into the Meridian
universe (§4); keep the shape, the columns and the structure exactly.

### 8.1 Home — DONE

Built: dashboard toolbar (site · shift · clock in the site's timezone + Edit
Dashboard) · 4-tile Shift KPI strip (Active Anomalies and Critical Alerts derived
from the alert fixture; Sensors Online and Shift OEE authored) · My Tasks (5 rows,
3 filter chips with counts, Assign + New Task, tick-to-done, create/assign/edit
dialog) · Watched Assets carousel (3 assets, 4s rotation, dot pager) · My Assets
table · Shift Handover card + report modal + AI-drafted create modal + text export
· Shift Handovers archive page (4 stat cards, search, status filter, table, pager).

Files: `pages/home/*`, `pages/ShiftHandoversPage.jsx`,
`features/{home,tasks,handovers}/*`, `mocks/fixtures/home.js`,
`providers/ToastProvider.jsx`, `components/forge/Sparkline.jsx`.

### 8.2 OEE & Operations — DONE

Design source: `platform/screens3.jsx` → `OEEScreen`.

Built: header (title, `{site} · {window}`, Day/Week/Month chips) · 4 KPI cards ·
OEE Trend card with the 70–85 target corridor and working A/P/Q chips · Loss
Waterfall · Production Lines table with a pager · AI Loss Attribution.

Files: `pages/oee/*`, `features/oee/*`, `mocks/fixtures/oee.js`,
`components/forge/{TrendChart,MetricCard}.jsx`.

Three decisions taken while building it, all of them departures from the
prototype and all of them deliberate:

**The arithmetic closes.** The prototype shows OEE 74.2% beside Availability 88 /
Performance 92 / Quality 99, which multiply to 80.2%, and a waterfall of
−12/−8/−1 that lands on 79. Three different answers on a screen whose entire
subject is one multiplication. Here the factors are chosen so `OEE = A × P × Q`,
the waterfall is **derived** from them in the mock handler as the standard
cascade, and the rounding residue is pushed onto the largest loss so the printed
column adds up to the printed headline. `85.0 × 88.2 × 99.0 → 74.2`, and
`100 − 15.1 − 10.0 − 0.7 = 74.2`. Verified for all three windows.

**The day window's OEE is read from `TOPLINE`, not authored.** The top bar and
the home KPI strip already show 74.2%. Same rule as the shift KPI strip deriving
its anomaly count from the alert fixture: one number, one source.

**Decoration was made functional.** The prototype's A/P/Q pills are always lit
and do nothing; here they toggle the three factor traces, default on, with the
OEE line drawn over them at full weight. The Day/Week/Month chips swap the whole
payload — `GET /v1/oee/summary?period=…` — rather than sitting inert.

The universe mapping: the four lines are Line 1 · Line 2 · Ends Line 1 ·
Compressed Air, and Compressed Air is the stopped one because Compressor C-12
sits on it, `ALR-4470` is already open on that compressor's coolant flow, and
`WO-7731` is already released against it in `operations.js`. The attribution
paragraph names all three, so every screen that mentions the asset agrees.

#### Rebuilt against the full design — five views, one dataset

The first pass built the design's Overview only. The module now carries all five
of its views behind `?view=` — **AI Synopsis** (the default), **Overview**,
**Loss Analysis**, **Lines & Shifts**, **Quality & Output** — under one scope bar
that sets `?period= line= shift= band= q= compare=`. Nothing on the screen is in
`useState` except which factor traces are showing, which is a reading posture
rather than a scope.

Files: `pages/oee/{OeePage,OeeFilterBar,SynopsisView,OverviewView,LossesView,
LinesView,QualityView,ProductionLinesTable,LossWaterfall,OeeHeatmap,
DowntimePareto,DefectMix,parts,oeeModel}`.

**Four numbers are authored and about ninety are derived.** `oeeModel.js` takes
the three factors and the OEE they multiply to — the only things the service
returns — and computes the rest by the ISO 22400 / TPM definitions: run and down
time from availability, cans from a single nameplate rate, MTTR and MTBF from the
computed downtime and an authored stop count, TEEP from planned ÷ calendar, the
Six Big Losses apportioned onto the minutes each bucket actually lost, the Pareto
onto downtime, the defect mix onto the cans quality rejected, and PPM off the
quality factor. Structure is authored (which cause, which mode, which crew) and
is always *scaled onto* a computed total, never stated as a quantity.

That is the whole point of the pass. The prototype's version of this screen
contradicts itself in six places at once — a 74.2% headline over factors that
multiply to 80.2%, 41,250 cans in 1,320 minutes beside a 2,200 cans/min
nameplate, 14 stops in a 22-hour day beside an 83-hour MTBF, a 100 PPM defect
pie on a 96.4% quality figure, and six losses whose minutes bear no relation to
the availability above them. Here the six losses sum to the waterfall's gap, the
Pareto sums to the Downtime tile, the three shifts average to the plant figure
and each one's own A×P×Q lands on its own OEE, the per-line factors land on the
line's own OEE, the heatmap's mean IS the window's OEE, and the synopsis'
three diagnoses and five recommendations each sum to the gap rather than to
7.1 of 8.2.

Six further decisions:

**Two more windows, and they close too.** `quarter` and `year` joined
`OEE_PERIOD_DATA` so the design's period bar is real rather than truncated. Each
satisfies A × P × Q to the printed tenth, like the original three.

**Two of the design's controls are absent, and the reason is the same one.** The
product select (330 ml / 500 ml / 250 ml) has no product entity anywhere in this
universe to select, and the custom date range has no `?from=&to=` on the OEE
service — both would match everything, silently. Same call the Sensor Explorer
made about its source-system select. Everything that IS on the bar works.

**The filter bar does not narrow the plant headline, and says so.** A site's OEE
is not the mean of the rows a reader happened to filter to. Line, band and search
scope the line table; shift scopes the crew panel; a note under the active chips
states the boundary. Quietly recomputing the headline would be the one genuinely
misleading move available here.

**The heatmap is seven complete days ending yesterday, computed.** The design
hardcodes Mon–Sun and fills 168 cells with `Math.random()`. Ours takes its
weekday names from each row's own date, is deterministic, and is rescaled so the
grid's mean is the window's OEE. Its date key is a local `Y-M-D` rather than an
ISO instant — serialising local midnight moves the axis a day west of Greenwich,
which is the §2.7 trap. Every cell is a focusable button carrying its reading as
its accessible name, with the whole grid repeated as an `sr-only` table.

**Export refuses out loud.** Nothing here is recorded — it is computed from four
factors — so the button says that rather than downloading a snapshot of a
derivation or sitting inert.

**The line table links, and idle earns no hue.** The design makes the whole row
a click target with no affordance; the name is a link to the line in Lines &
Assets. A line nobody scheduled is neutral rather than red, because that is a
plan and not an outage.

`TrendChart` is new and is **not** `SignalTrace`: that one hard-codes red,
requires a threshold, and its whole vocabulary is about a reading going wrong.
`MetricCard` is the prototype's `KPI` and will be reused by Lines & Assets,
Safety, Executive and every detail screen.

Also new: `isBuilt(item)` in `shell/navigation.js` resolves `built` against
`demoBuilt`, so a nav item cannot be registered as a real route while the rail
still treats it as a placeholder. Use `demoBuilt: true` for every demo-only
module from here on.

### 8.3 Lines & Assets — the largest

Built in five passes. **Pass 1 is done:** the line list with its expandable asset
accordion, the Line 1 material-flow detail, and the asset/station detail.

Files: `pages/lines/*`, `features/lines/*`, `mocks/fixtures/lines.js`,
`components/forge/Meter.jsx`, `StateBadge` in `StatusBadge.jsx`.

Four decisions, all of them about not authoring things twice:

**The plant is not redefined.** `hierarchy.js` already models Findlay Line 1 as
Cupper → Bodymaker 3 → Trimmer → Washer → Decorator 2 → IBO Oven → Necker →
Palletizer, which IS the prototype's eight-station can-body line in the
prototype's order. So the line list, the asset list and the flow order are read
from `HIERARCHY_NODES`, alert counts are derived from `ALERTS`, and
`fixtures/lines.js` carries only the operational overlay — health, throughput,
vendor, run hours, owner. Composed in the mock handler, exactly where a real
endpoint would compose it.

**`/production-lines`, not `/lines`.** The real API already serves `/v1/lines` as
the hierarchy's line collection and it is in `LIVE_PATHS`, so a mock route there
is never reached. Two resources, one noun.

**Findlay has 3 lines, not the prototype's 6.** That is what the hierarchy says.
The OEE table's first version invented a fourth and put Ends Line 1 under
Findlay, when that line belongs to Weißenthurm. Both tables now compose from the
same helper, so the mistake is unrepresentable rather than merely fixed.

**Line 1 is stopped, and the fault is on another line.** The prototype freezes
coolant at the Washer and starves four stations downstream. Our universe already
holds that fault — `ALR-4470`, frozen signal, 0 gal/min — on Compressor C-12,
which supplies the Washer. So the Washer is *blocked* rather than faulted, the
four stations after it are *starved* (dimmed, no fault colour — a consequence is
not a fault), and the AI card names the constraint one line over. Same screen
state as the design, no invented alert, and the Washer's own flow card shows the
compressor's record with "Raised on Compressor C-12" beside it.

**Pass 2 is done:** the Assets tab — five-card stat bar, quick filter chips with
whole-site facet counts, a line rail, search, sort, the More Filters drawer, and
the list view with a pager. Filtering, sorting and paging happen in the mock
handler, not the component, so the seam holds when the endpoint lands.

Two decisions there: the toolbar chips commit on click and the drawer commits on
**Apply** (seven controls should not re-sort the table three times on the way to
the third); and the tabs are **routes**, not `useState` — the prototype's assets
view has no URL, so it cannot be linked, bookmarked or backed out of.

Note the animation trap: neither `tailwindcss-animate` nor `tw-animate-css` is
installed, so shadcn's generated `animate-in` / `slide-in-from-*` classes are
inert. Motion is declared in `styles/index.css` as `--animate-*` and honours
`prefers-reduced-motion` there.

**Pass 3a is done:** the Asset Detail header (type tile, status, criticality,
owner, health ring), the AI Synopsis / Detailed view switch, and the whole
synopsis view — spoken briefing, AI briefing card, anomalies needing attention,
performance figures, OEE trend and at-a-glance. The Detailed view's tab strip is
there with Overview built; the other nine tabs say so.

Two decisions:

**The briefing is composed, not authored.** The prototype writes one paragraph
and renders it on all thirty machines, so every asset in it claims a drive-end
bearing at 13.7× baseline. `assetBriefing()` builds the prose from health, state
and the worst open alert, quoting that alert's real reading, baseline, threshold
and id. It is specific to the machine and cannot contradict the cards below it.
`verify:mocks` asserts two assets never get the same text and that a briefing
claiming an alert names a real one.

**The voice briefing is real.** The prototype animates a 55-second progress bar
on a timer whether or not anything is being said. Here progress comes from the
utterance's own `onboundary` events, and the control is not rendered at all where
`speechSynthesis` is missing. The script is the same text the card shows — one
source, so they cannot diverge.

Both the view and the tab live in the URL, so a colleague can be sent to the
Timeseries tab of one machine.

**Pass 3b is done:** the Detailed view's Overview — Performance, Asset Status
History with 24h/7d/30d, Signal Trend with a sensor selector, Downtime Pareto,
Triage, the 90-day alert-frequency heatmap, and the right rail (assigned
operators, Identity, connected devices, timeline, Copilot suggestion). The
component rail moved to Components / BOM, where it always belonged.

Everything is composed per asset, same rule as the briefing: the status split is
generated by walking the window so what is drawn IS the percentage beside it and
the three always total 100; the Pareto is ordered worst-first with a real
cumulative; the Copilot card's confidence is the worst alert's fusion score
rather than the prototype's fixed 87% on every machine; "stale" comes from the
asset's own last-seen rather than the prototype's every-third-sensor.

The Overview also carries the prototype's **3D preview**, **Tree view** and
**Relations** cards, with two corrections. The preview draws a schematic
isometric outline rather than the prototype's rendered photograph of a bodymaker
— which it shows on compressors, fans and palletizers alike — and captions
itself as schematic; the card holds the place a model viewer goes and its zoom
works, so landing a model store changes only what sits on the grid. The tree and
the relations tabs walk the asset's **real** hierarchy path, server-side, rather
than the prototype's `VAL › 23 › 230900 · Gas compression & re-injection`, which
is an oil-and-gas hierarchy carried in from a different demo and shown unchanged
on a can plant.

**Pass 3c is done** — all ten tabs render: Overview, Timeseries, Alert History,
Work Orders, Telemetry, Documents & SOPs, Maintenance, Components/BOM, AI
Insights, Audit Log.

The one that mattered: **Alert History and the Overview heatmap are one set of
events counted three ways.** The prototype authors the table, the four tiles and
the heatmap separately, so it reports 18 alerts in the table, 178 in the
heatmap's total and shows 4 rows. Here `assetAlertHistory()` generates the events
once and the tiles, the 91 squares, the failure-mode split and the source split
are all counted off them. `verify:mocks` asserts the squares sum to the row count
and that every open alert appears in the history.

Also composed per asset rather than fixed: the predicted-failure confidence and
window (the prototype shows 87% and "Mar 14–21" on every machine), and the
document list's `via` column, which says whether each document was attached to
this asset or inherited from its model, its line or the site.

**Pass 4 is done:** the floor map, behind a table/map switch in the Assets
toolbar. Per-line lanes with a material-flow track, stations that pulse where an
anomaly is open, zoom 70–130%, a station readout and the per-floor line summary.

Three departures. **Floors come from the lines** — the prototype hardcodes three
and shows an empty one; here the tabs are derived, so no chip leads nowhere.
**The map is not paginated** — it asks for the whole filtered set, because a
floor plan showing rows 26–50 of a plant is not a floor plan. **The station
readout sits inside the card**, not pinned to the viewport, so it does not cover
whatever else the reader had on screen.

**Pass 5 is done — the module is complete.** The import wizard: Upload → Map →
Validate → Review, reached from the Import button on the Assets tab.

It is not a slideshow. It parses a **real** dropped CSV (quoted fields and all —
an asset called `"Bodymaker 3, drive end"` would otherwise shift every column
after it), fuzzy-matches the columns against the canonical fields, validates
every row against the lines that actually exist at the site, and **the final step
creates the assets** — they appear in the table, on their line and in the floor
map. The prototype simulates all four: clicking the dropzone "parses" a hardcoded
file whatever you dropped, and Import animates a bar and closes.

Errors block a row and warnings do not, and the split is principled: an error is
"the platform cannot store something true" (no tag, no such line), a warning is
"there is a defensible default" (unknown criticality → medium). The template the
wizard hands out validates clean when dropped straight back in, which
`verify:mocks` asserts along with the parser, the auto-mapping and the write.


Design source: `screens-bodymaker.jsx`, `screens-assets.jsx`,
`screens-asset-detail.jsx`, `screens-import.jsx`.

- **ISA-95 site hierarchy tree** — Enterprise › Region › Country › Area › Site ›
  Building › Floor › Production Line › Asset. Drag-reorderable, favouritable,
  searchable, per-node KPI and alert count.
- **Lines list** — 6 lines with machines / health / OEE / target / status /
  running / anomaly count; one line marked `rich` opens the detail.
- **Line detail** — the 8-station can-body line (Cupper → Bodymaker → Trimmer →
  Washer → Decorator → IBO Oven → Necker → Palletizer), station cards, line
  stopped because the Washer's coolant froze and starved four downstream stations.
- **Station detail** — components, sensors, traces, "Open alert →".
- **Assets module** — 5-card stat bar (Total / Online·Offline / Health
  distribution / Open alerts / Open work orders) · quick filter chips (All,
  Critical, Has Alerts, Offline) · line filter chips · search · sort · columns ·
  More Filters drawer (site, line, sensor type, criticality, stream status, open
  alerts, work order, owner, tag, next-PM date range) · **list view** (checkbox,
  asset, type, line, sensor icons, stream, health bar, open alerts, last seen,
  owner + pager) · **floor-map view** (3 floors, per-line lanes with a
  material-flow track, station dots pulsing on alerts, zoom 70–130%, hover card,
  right-hand line summary).
- **Asset Detail — 10 tabs:** Overview · Timeseries · Alert History · Workorders ·
  Telemetry · Documents & SOPs · Maintenance · Components/BOM · AI Insights ·
  Audit Log. Plus an AI Synopsis / Detailed view switch in the header, assigned
  operators with a picker, a status timeline, and a 90-day alert heatmap.
- **Bulk Import wizard** — 4 steps: Upload (drag-drop, template download,
  duplicate handling) → Map Columns (auto-detected, per-field confirm, 3-row
  preview) → Validate (ready/warning/error counts, per-row issues) → Review
  (summary + progress bar).

### 8.4 Sensor Explorer + Timeseries Workstation

Design source: `screens-sensors.jsx`, `screens-timeseries.jsx`.

Built in two passes, **both done — module complete**.

**Pass 1:** the Sensor Explorer at `/app/sensors` — scope selector, date range,
timeframe pills, severity chips with facet counts, type and sort selects, the
More Filters drawer, search, active-filter chips and the grid of channel cards.

**Pass 2:** the chart catalogue at `/app/sensors/charts` and the Timeseries
Workstation at `/app/sensors/charts/:chartId`. Clicking a channel card opens the
Workstation on that channel.

Files: `pages/sensors/*`, `features/signals/*`, `mocks/fixtures/signals.js`,
`mocks/fixtures/charts.js`, `tone` on `components/forge/SignalTrace.jsx`.

Seven decisions, all of them departures and all deliberate:

**`/v1/signals`, not `/v1/sensors`.** The real API serves `/v1/sensors` as the
tag's CONFIGURATION — name, waveform type, value unit, which connection reads
it — and that prefix is in `LIVE_PATHS`, so a mock route under it is never
reached. A SIGNAL is the measured channel: a band, a reading, a state, a trace.
Two resources, one noun, the same split as `/production-lines` beside `/lines`.
`features/signals` and `features/sensors` share a domain word and no code.

**Not one channel is authored.** The catalogue composes from
`HIERARCHY_NODES` × `ASSET_OPS[…].sensors` × `SIGNAL_SPEC` × `ALERTS`, plus the
real tags of the two component-modelled machines. Forty-five channels on
eighteen assets, and the Explorer cannot list an instrument the asset does not
have, print a band the asset detail disagrees with, or show a clean reading on a
sensor the anomaly list says is in alarm. The prototype authors three assets ×
four sensors with hardcoded values, hardcoded series and a hardcoded state, so
all three contradictions are available at once.

**The reading IS the end of the trace, and it is the alert's own.** The
prototype prints an authored `s.value` beside a separately generated `s.series`,
so the figure in the corner is not on the chart below it. Here the handler forces
the last point to the reading in every window, and an alerted channel's reading
is the alert's — 0.6 in/s on the Bodymaker, 0 gal/min on the compressor.
Asserted both ways in `verify:mocks`.

**An alerted channel's band comes from its alert.** `ALR-4465` reads 402 °F on
the oven's Zone 3 burner; the generic bearing-temp band of 140–185 would draw a
trace that leaves the chart. The threshold is the edge that was breached — which
edge follows from the direction, since `ALR-4459` is a *lower* breach at 48 L/min
— and the opposite edge is the baseline reflected across it, pulled back to the
generic band where that is tighter. So the Bodymaker keeps the 0.08 in/s the
asset detail prints.

**Units follow the site.** `SIGNAL_SPEC` is now two tables, imperial and metric,
because engineering units belong to the site and are never converted. One table
put in/s bands on the Weißenthurm press, which then disagreed with `ALR-4468`'s
own reading of 14.8 mm/s on that exact instrument. `assetSignals()` takes the
unit system too, so Lines & Assets gets the same correction.

**The calendar and the pills are one parameter.** The prototype shows them side
by side as independent widgets, so a reader can set "24H" and "May 3 – May 10" at
once and the chart obeys neither. Here a range wins, a pill clears the range, and
`windowSpec()` resolves whichever is in force. The range is real — `?from=&to=`
generates the trace over exactly that span. The prototype's calendar also opens
on a hardcoded June 2026, renders a fixed 31 cells whatever the month, and orders
a range by day-of-month so a selection crossing a month boundary silently
inverts.

**"Streaming · updated 1s ago" is true.** The prototype prints it as a literal.
Here the grid polls at an interval that follows the window (15s at 1H, off at
30D, never in a background tab) and the stamp is the query's own
`dataUpdatedAt`. A calendar range is a closed span, so it says that instead.

Two smaller ones. **Source system is a statement, not a select** — the design
offers SCADA / PLC, OSIsoft PI, MQTT / IoT and MES / ERP, and our `CONNECTORS`
fixture has exactly one connected system that declares `signals` among what it
provides, with the MES row going as far as `doesNotProvide: ['vibration']`. Three
of those four options would match nothing, silently, so the drawer names the
connector and its last sync instead. And **`SignalTrace` gained a `tone` prop**:
it hard-codes red because its two original callers are each one sensor going
wrong, and forty-five red traces would mean nothing.

#### Pass 2 — the Workstation

Six more decisions, on top of the seven above.

**One screen, two doors.** `charts/:chartId` opens a saved chart and
`charts/adhoc?signals=…` opens a selection nobody saved — which is what a channel
card links to. Composed identically, so Save As is a POST rather than a second
code path.

**The whole chart is in the URL:** span, granularity, plot mode, which series are
hidden, and any series added or removed. A modified saved chart can therefore be
sent to a colleague *without being written to* — the override rides in
`?signals=` and the stored record is untouched. The prototype holds every one of
these in `useState`, so nothing it shows can be linked to, including the chart
itself, which is reached by a card click that sets a boolean.

**Nothing on the screen computes a number.** This is the pass's whole point. The
prototype makes four independent claims about one array: `TS_SERIES` authors
`mean: 38.4`, `tsGen()` produces a series that averages something else, the
Statistics panel authors a third set with a P95 its own data never reaches, and
the AI banner states `r = −0.87` as a literal on every chart. Here one pass over
the plotted traces produces the statistics, the correlations, the threshold rules
and the insight, and `verify:mocks` asserts the banner's coefficient is one the
correlation panel also reports.

**The insight is composed and sometimes absent.** The pair is whichever two
series in *this* chart correlate most strongly, the coefficient is the one just
computed, and the alert named is a real open one. Below |r| = 0.6 there is no
banner at all — one that fires on every chart is one nobody reads. An ad-hoc
chart of a single channel correctly says nothing.

**The four unlabelled glyphs became three labelled modes.** `⊞ ∿ ↕ ≡` have no
handler in the design. Overlay is the dual-axis plot; Stacked gives each series
its own strip at its own scale; Normalised maps each onto its own range, which is
the only way to compare the *shape* of a vibration trace against a temperature
one. Granularity is a real parameter too — 5m over 24h redraws at twelve times
the resolution, and the statistics are recomputed at it.

**Two panels are the honest version.** History is a working undo stack over the
chart's own edits — the design's panel is the sentence "Undo the last 10 chart
changes" with nothing behind it, and ten is where this one caps. Export produces
a CSV of exactly the visible series and a PNG rendered off the live SVG with its
token colours inlined; Excel and PDF are not offered, because they are not built.

Smaller: the catalogue's eight cards are Meridian's machines rather than the
prototype's Chennai heat exchanger and turbine, and each card's sensor count is
`chartChannels().length` rather than an authored number beside the array (the
design writes `s: 12` on a chart with no series). Series colour is **identity**
here, not severity — a fixed ordered list of tone tokens, with the state in its
own column, the same call `TrendChart` made for OEE.

- **Sensor Explorer** — hierarchy scope selector (expandable tree, per-node count
  and status dot) · date-range calendar picker · timeframe pills 1H/6H/24H/7D/30D
  · severity chip group (All/Critical/Warning/Normal) · type and asset dropdowns ·
  More filters drawer · search · active-filter chips with Clear all · **grid of
  sensor cards**, each with type icon, label, channel, id, normal band, current
  value, state badge and a full `SignalTrace` · New Chart modal (title, chart
  type, signal checklist).
- **Timeseries Workstation** — breadcrumb, toolbar (view modes, date range,
  granularity, Actions menu), timeframe pills + LIVE dot, **500-point dual-axis
  chart** with 4 channels, threshold rules, maintenance-window shading and
  anomaly markers, a 5-button side rail (Alerts / History / Correlation /
  Statistics / Export) each opening a panel, a violet AI insight banner with
  correlation r and two CTAs, and a **series table**: style, visibility eye, name,
  status, tag, description, min, max, mean, unit, P&IDs, actions.
- **TSCatalog** — 8 saved charts as cards (name, sensor count, author, date).

### 8.5 Shifts — DONE

Design source: `screens-shifts-logbook.jsx` → `ShiftsPage`.

Built in one pass. `/app/shifts`, demo-gated: the AI Synopsis tab (briefing,
three insight cards, OEE-by-shift chart) and the History tab (four-KPI strip,
All crews / Just me, type · status · operator filters, roster table with pager,
the shift detail panel and the crew rollup), plus the assign dialog.

Files: `pages/shifts/*`, `features/shifts/*`, `mocks/fixtures/shifts.js`.

**The roster is derived; almost nothing is authored.** A shift is a date and a
window. Who worked it comes from a fixed rota, whether it has ended comes from
the clock, its anomalies are the alerts whose detection time falls inside its
window, its work orders are the ones raised off those alerts, and its OEE is
drawn around the week's published figure and then **rescaled so the week's mean
IS that figure**. The prototype computes its shifts too, but from nothing real —
`oee = 72 + ((dayIndex * 3 + typeIndex * 5) % 20)` — so its week averages 81%
while its own OEE page says 74.2%. `verify:mocks` asserts ours agree.

Seven more decisions:

**Downtime follows from availability.** Each shift's availability is what is
left of its OEE once the week's performance and quality are accounted for, and
its downtime is the hours availability did not cover — the same cascade the OEE
module uses. So a shift's minutes lost cannot contradict its own OEE.

**A shift's anomalies are found, not counted into existence.** The prototype
renders `Array.from({length: s.anomalies})` and labels the rows from a fixed
list, so every shift with three anomalies has the same three — one of which
names a heat exchanger from a different demo. Ours are real alerts, each linking
to its machine, and no alert is claimed by two shifts.

**"Just me" means just me.** The prototype falls back to the whole crew when the
reader has no shifts — `(scope === "me" && byMe.length) ? byMe : SHIFTS` — so the
toggle reads "Just me" above everybody's week. Here an empty personal week says
so, and the KPI strip, the briefing and the crew list all recompute for the
narrowed set rather than being counted off different ones.

**The week is this week.** Design: `DAYS = ["Mon 16" … "Sun 22"]` and a subtitle
reading "week of Jun 16–22, 2026". Right for one week in fifty-two.

**The handover archive stopped living in June 2026.** `HANDOVERS` carried
hardcoded dates, which is why no shift could be joined to one. They are now
`daysAgo`, resolved by the handler — so a completed shift links to the handover
that closed it, and the newest handover belongs to a shift that has actually
ended rather than to tonight's. `?handover=` and `?create=1` open the archive's
dialogs, which were `useState` and could not be linked to.

**"Schedule New Shift" became "Assign".** On a rota that runs three shifts a day
regardless, creating a shift would either duplicate a row or invent a fourth
shift in a day. What is genuinely undecided is *who works one*, so that is what
the dialog commits — and only for a shift that has not started, because
reassigning yesterday's night shift is rewriting who was there. The server
answers 422. The design's Schedule button does nothing at all.

**The chart's heading is measured.** The design's reads "OEE has been recovering
since Wednesday's dip" above a chart that may be doing nothing of the sort. The
synopsis carries a trend computed by comparing the week's two halves, and the
heading says up, down or flat according to it.

Not offered: the design's **Shift Master** header button, which goes to a
Settings page that is not built. A button to a placeholder is a dead end with a
label on it.

Three corrections after the first look:

**The handover action has four states, and every one is a button.** The first
version offered nothing at all for a completed shift with no report filed —
which is most of them, since the archive holds seven and the week holds
twenty-one — so the commonest row had a sentence where its action should be. A
draft says *Edit* and opens the form, a published one says *View*, a shift that
ended with nothing filed says *Write*, and only a running one says *End shift*.
The shift row carries the handover's STATUS as well as its id, because it cannot
tell a draft from a filed report otherwise.

**The week is a CALENDAR week, Monday to Sunday** — not the seven days ending
today. The two coincide exactly once a week, on a Sunday, which is the day the
trailing version was written on and is why it looked correct. Opened on a
Wednesday it ran Thursday to Wednesday, and a weekday axis over that says
nothing. `verify:mocks` pins three different days and asserts Monday-to-Sunday
at all of them.

**1 / 2 / 4 weeks**, always whole weeks so Monday lands in the same place at
every range. Three shifts a day makes one week only twenty-one points, which is
thin for reading a trend off; four weeks rescales to the MONTH's published OEE
rather than the week's, so the chart still ties to the OEE module whichever
range is picked. The axis is weekday initials over one week and a date per week
beyond that.

**The default span is last week PLUS this week, and the chart is always full.**
A calendar week mid-flight is a mostly-empty chart — on a Monday morning three
of its twenty-one shifts have run and five sixths of the width is blank. So
`defaultShiftRange()` reaches back over last week whenever this one is still
running, and drops back to a single week once it finishes. The response says
which span it chose, so the control lights the right chip.

The chart then plots **complete days only — the seven ending yesterday**. A week
that includes today has a hole in it: two of today's three shifts have not run,
so the chart either stops a third of the way in or reserves width for work
nobody has done, and neither is "a week of data". Today Sunday gives Sunday to
Saturday; today Wednesday gives Wednesday to Tuesday. Twenty-one shifts, every
one finished, the line edge to edge, at any hour of any day. The shift running
now is not on it and does not need to be — the Active shift card directly above
says what it is doing.

**The synopsis asks for the whole span; the table pages.** It was being handed
the table's ten rows, so a fortnight of roster arrived as three and a half days
and the axis read Thu–Sat. Same split as the floor map: a chart of rows 1–10 of
a week is not a chart of the week.

`TrendChart` still breaks its line at a `null`, which covers the case it should
— a missing figure BETWEEN two that exist.

One trap worth naming: **`count` is i18next's plural key.** A message written as
`{count} shifts across {days} days` and given `{ count, days }` rendered
verbatim, braces and all. Anything that is not driving a plural should be called
something else.

**The rota is keyed to the date, not to the row's index.** Both are a fixed
rotation and only one is stable: indexing off the position in the array meant
the same Tuesday had a different operator at 7 days than at 30, because
Tuesday's index moved. Who worked a shift is a fact, not a function of how far
back the reader is looking. Found by a `verify:mocks` check, not by eye.

The OEE line on that chart is **orange**, not the neutral it shipped with — OEE
is orange in the top bar's sparkline and in the OEE module's own trend card, and
a reader arriving from either should not have to work out that the grey line is
the same measure.

**The handover report opens in place, and the running shift's is composed.**
Every handover action first navigated to the archive, which loses the shift the
reader was on; the design opens a modal over the page and now so does this. The
dialog is the archive's own `HandoverReportDialog` / `HandoverFormDialog` — one
shift boundary, one document, the same publish and acknowledge mutations.

The running shift has no filed record, so `draftHandoverFor()` composes the one
it is about to file: the window, the outgoing and incoming names, the OEE, the
downtime, the carried anomalies and the pending work orders all come from that
shift. The design fills a template instead, which is why every shift in it
carries "monitor C-12 coolant trend; bearing spares staged for next PM" whatever
happened on it.

Two things that composing immediately exposed, both now asserted:
- **A shift was carrying a Pune anomaly.** Alerts were matched to a shift by
  time window alone — true of the clock and false of the plant. The roster is
  Findlay's crew running Findlay's plant, so it is scoped to the site.
- **An i18n key leaked into the report.** The two seeded work orders store their
  title as a key and a fixture cannot translate, so `pending` travelled as
  `WO-7734 — replaceDischargeBearing`. It now carries ids and titles and the
  page resolves them.

Two tabs: **AI Synopsis** (violet briefing paragraph, 3 insight cards — carryover
anomalies / active shift / OEE dip — and an OEE-by-shift chart) and **History**
(4-KPI strip, All crews / Just me toggle, type + status + operator filters, shift
table [date, shift, operator, time, OEE, anomalies, WOs, status] with pager, a
right-hand Shift Detail panel, and a Crew Performance list). Plus a handover modal
and a Schedule New Shift modal.

### 8.6 Logbook — DONE

Design source: `screens-shifts-logbook.jsx` → `LogbookPage`.

Built in one pass. `/app/logbook`, demo-gated: Feed / Timeline toggle, search
with its AI marker, machine filter, a cited-only chip, a four-card rollup, the
inline New Entry composer, and entries carrying author, time, shift badge, the
"AI Analyzed" violet badge, prose, `#tags` and the anomaly they were cited in.

Files: `pages/logbook/*`, `features/logbook/*`, `mocks/fixtures/logbook.js`.

**It was picked next because it was the dead reference Shifts had just made.**
The design's shift detail panel has a Logbook button that the Shifts pass left
out for want of a destination; it now goes to `?shift=SH-…`, which narrows the
log to what the crew wrote on that shift.

Seven decisions:

**Four fields are authored and everything else is composed.** An entry holds
WHEN, WHICH MACHINE, WHAT WAS WRITTEN and its tags — that really is all a
logbook has. The author is the operator the ROSTER puts on the shift containing
the timestamp, the shift badge is that same lookup, the machine name comes from
the hierarchy. So the logbook and the Shifts screen cannot tell the room
different stories about who was on nights, and `verify:mocks` asserts it on
every row. The prototype types all four in, and its author list is a different
plant's crew.

**The violet badge is earned, and it is the same fact as the chip.** "AI
Analyzed" means an investigation cited this note. `citationFor` is Forge AI's
own `searchLogbook · FDY-BM-03 · 14d` tool call run backwards: an alert on the
same machine, detected after the note and within that window, whose failing
component or sensor the note actually **mentions**. The last clause is load
bearing — the window alone cited all twelve entries, because every machine here
has an open alert, which is the prototype's always-on marker arrived at from the
other direction. It comes out at eight of twelve. A routine inspection that
found nothing wrong is not evidence of a bearing failure even though it was
written on the right machine at the right time.

**The flagship note is the one the analysis quotes.** `ANALYSIS['ALR-4471']`
carries `{ key: 'logbook', value: '02:14 · cell 3 noise' }`. That entry now
exists, at 02:14, on FDY-BM-03, and cites ALR-4471 back. A check asserts both
halves, so editing either one fails the build rather than quietly leaving the
product's flagship claim pointing at evidence that is not there.

**The handover reads its observations off the log.** `HANDOVER.logbook` used to
hold two notes of its own — the same observation in two places, each free to
disagree with the other about what happened at 02:14. It is deleted; the
`/v1/shifts/handover` handler takes the most recent entries from the fixture.

**The search is expanded, not semantic, and says which.** The design puts a
violet "semantic search" marker beside a `.includes()` under a placeholder
reading "try 'bearing issues'" — which returns nothing, because no entry
contains "issues" and the one about a bearing says *knocking*. There is no model
behind a fixture and claiming one is worse than the dead marker, so the server
expands the query over a small table of the words a plant uses for one thing and
answers with the terms that **earned** a match. The chip reads "Also matched
knocking, vibration" and appears only when that list is not empty.

**The author is stamped by the server.** A real service reads it from the token;
this one has none, so it stamps the demo persona — and the list response carries
`author` and `shift` so the composer's byline is the name the write will
actually use rather than the client's guess. The design's composer heads itself
with the first operator in the array and the literal string "Night".

**"Ask about this" is not built, and the reason is the Shift Master reason.** It
navigates to a Copilot that does not exist. The note's real destinations are the
machine and the alert that cited it, and both are links on the card. Two
affordances to the same anomaly, one of them promising a conversation nothing
can hold, is worse than one that works.

Also: the machine filter offers only machines that HAVE entries, while the
composer offers the whole plant — conflating them makes a machine unwritable
until somebody has already written about it. Tags split on commas and on `#`
but never on whitespace, because `#Cell 3` typed into a free-text field must not
become two tags, one of which is the number three.

### 8.7 Work Orders — DONE

Design source: `screens3.jsx` → `WorkOrderScreen`.

Built in one pass. `/app/work-orders`, demo-gated: board / table toggle,
status · priority · assignee · source filters, search, the detail dialog and the
create/edit dialog.

The four-card stat strip it shipped with has been **removed**: the design has
none, and it carries those counts in the page SUBTITLE — "8 open · 4
AI-generated" — which the page already does. `overdue` and `urgent` came off the
payload with it rather than staying as counts nothing renders; the priority
filter and a card's overdue badge are what those two are for.

Files: `pages/workOrders/*`, `features/workOrders/*`, and the work-order half of
`mocks/fixtures/operations.js`.

**It was picked next because the data already existed and went nowhere.**
`WORK_ORDERS`, `assetWorkOrders()` and `endpoints.workOrders` were all in the
tree, and `WO-7734` and `WO-7731` were named on the OEE attribution and the
asset screens with no route behind them. Landing the module made those live.

Seven decisions:

**The lifecycle is six states and the server enforces it.** The two seeded
orders carried `draft` and `released`; `released` is renamed `approved` rather
than kept beside it, because two words for one state is how a board gets a
column nothing lands in. `onHold` is off the main line — reachable from
`inProgress`, returning to it, and nobody's successor. PATCH validates the move
against `WO_NEXT` and answers **422** for one the workflow does not allow. The
prototype has Status as a free select in its edit form, so a draft can be marked
Completed without ever being approved, on a screen whose entire subject is an
approval workflow.

**Source is provenance and cannot be typed.** The prototype's form offers it as
a select with AI in it, so anybody can award themselves an AI-drafted order. The
server stamps `human` on anything raised through the form, and the dialog says
so rather than silently dropping a field the design showed.

**The asset is a select over the plant.** The prototype takes it as free text —
"Comressor C-12" is a work order against nothing, and the board, the asset page
and the line rollups all quietly lose it. Same reason the due date is a real
date rather than a text box with the placeholder "Jul 24".

**`isOpenOrder` replaced `state !== 'closed'`.** That test was written at three
call sites in Lines & Assets and was true of every order in the fixture, because
none was ever `closed` — the counts were right by accident. Adding completed
orders to the board would have inflated every "open work orders" figure in the
module. `verify:mocks` now asserts a completed order does not count against its
asset.

**Ids are sequential.** The prototype's create is
`"WO-" + (4400 + Math.floor(Math.random() * 580))`, which can collide with a
seeded order and gives a different answer on every render.

**Everything is composed.** The order stores an `assetId` and a `dueInDays`; the
asset's name, its line, the assignee, the due instant, the overdue flag, the
next legal state and the parts shortfall are all resolved in the handler. The
On Hold card can therefore explain itself — it is waiting on `VLV-RP-22`, which
its own parts list says is not on the shelf.

**The board and the strip count different things on purpose.** The four KPI
cards count the whole collection, so "1 overdue" does not become "0 overdue" the
moment somebody filters to Completed. The column headers count the filtered set,
because they describe the board in front of you. Different questions, each
answered where it is asked.

Also: the mock adapter now **rethrows a handler's deliberate `fail()`** instead
of turning it into a 500. That catch was added so a `PEOPLE.find` TypeError
would stop reading as "cannot reach the platform"; it was also swallowing the
422 this module needs. And the Timeseries Workstation's insight banner gained
its second CTA — **Create work order**, prefilled with the machine, the anomaly
and a title from the correlation — which had nowhere to go until now.

Kanban / Table toggle + New WO. **Kanban:** 6 columns — Draft, Pending Approval,
Approved, In Progress, On Hold, Completed — cards with id, priority badge, title,
asset, AI badge, due date and a "Move → next stage" button; empty columns say so.
**Table:** WO # · Title · Asset · Priority · Assignee · Due · Source · Status +
pager. Detail modal (badges, 4 facts, advance button, delete/edit) and a form
modal (title, asset, priority, assignee, due, status, source).

### 8.8 Notifications — DONE

Design source: `screens3.jsx` → `NotificationsScreen`. Reached from the BELL,
which is where the design puts it too — `shell.jsx` wires the bell to
`nav("notifications")`.

Built in one pass. `/app/notifications`, demo-gated: the alert-rules table with
a working switch on every row, the delivery-channel list, the escalation ladder,
and the New Rule dialog its `+ New Rule` button never had.

Files: `pages/notifications/*`, `features/notifications/*`,
`mocks/fixtures/notifications.js`.

**It was picked next because the bell was a button with no `onClick`** — the
most visible dead control in the shell, between two toggles that work.

Six decisions:

**A rule's condition is read, not typed.** The prototype writes `VIB > 40 mm/s`
beside a rule on a tag called `VIB-204`: the number is authored, the tag is
another demo's plant, and 40 mm/s is not the limit its own alert fixture trips
at. Here a rule names a SENSOR KIND and its threshold comes from `SIGNAL_SPEC` —
the same band the Sensor Explorer draws. `verify:mocks` asserts the vibration
rule trips exactly where `ALR-4471` trips. One number, three screens.

**And it carries both units.** Findlay is in/s, Weißenthurm is mm/s, and 0.49
and 12.5 are one physical limit. `alerts.js` already calls converting between
them a safety defect, so a rule that spans both sites prints both rather than
picking one and being wrong for half the plant.

**The New Rule dialog SHOWS the threshold instead of asking for it.** There is
nothing to type and therefore nothing to get wrong — and the preview moves when
you flip Above/Below, which is how you see that the edge and the limit are one
decision.

**Two channels are not connected, and that is the point.** The design shows five
green dots. `misroutedTo` composes the one genuinely useful thing this screen
can say: *this rule is on, it will fire, and one of its destinations is not
wired up*. It cannot go stale — configure Slack and the warning disappears.
`broken` is deliberately narrower than "has a dead route": an OFF rule with a
dead route is a tidying job, because nothing is being lost.

**`unrouted` is the figure worth a number.** Open anomalies no ENABLED rule
covers — a join across all three lists, and it moves when a switch moves. The
check turns a rule off, asserts the number goes up, turns it back on and asserts
every figure returns exactly.

**PATCH is the toggle and nothing else.** A PATCH that accepted a threshold
would be a way to put a limit on this screen that no detector uses, which is the
whole failure the module exists to avoid. It answers 422 for anything else.

### 8.9 Analytics & Reports — DONE

Design source: `shell.jsx` → `ReportsScreen`.

Built in one pass. `/app/reports`, demo-gated: the shelf of report cards, and
the Generate dialog its `Generate New` button never had.

Files: `pages/reports/*`, `features/reports/*`, `mocks/fixtures/reports.js`.

**This module had no nav item at all** — the only one in the prototype's IA
missing from `navigation.js`, so the screen existed in the design and was
unreachable here. Landing it was a nav entry, a route and a page.

Four decisions:

**A card's length is derived from its scope.** The design writes "All sites · 24
pages" as two strings and never checks either. A report is its SECTIONS, a
section runs a couple of pages, and a per-site section repeats once per site —
so a single-site risk review is shorter than an enterprise board report, and the
check asserts exactly that.

**Coverage is counted off the fixtures every other screen reads.** An enterprise
report's anomaly count IS the anomaly list's total; a single-site one is that
site's. The OEE it leads on is the figure the OEE module publishes. A board
report cannot contradict the screen behind it.

**Generating is time, not a flag.** A report has a `startedAt` and the server
decides from the clock, so the badge changes while you watch, the percentage
moves, and the card becomes downloadable when it finishes. The client polls
**only while something is running** — `refetchInterval` reads the answer, so a
finished shelf makes no requests. The design's "Generating" would say the same
thing tomorrow.

**The period is computed backwards from generation.** A report produced three
days ago covers LAST month. Pinned at three dates in `verify:mocks`: it always
covers a whole month that has ended, starting on the 1st and ending on a month's
last day. The design's is fixed to "May 2026".

### 8.23 Settings — Billing & Usage (done)

Design source: the rendered screen. `mocks/fixtures/billing.js`,
`features/org/billing.js`, `pages/settings/BillingPage.jsx`, `lib/pdf.js`.

The design's six panels: the plan banner, four usage cards, the usage trend, the
invoice table, the payment method and the Enterprise call to action.

**This page asserts more than any other, and marks all of it.** A price, a
renewal date, an invoice history and a card on file are contract rather than
telemetry — nothing here can derive them and there is no billing service to ask.
So they are authored, grouped in one fixture, and every one carries
`authored: true` on the wire. What is composed: the plan, its ceilings and the
four meters are the same objects Modules & Plan draws, and a check asserts the
two payloads are byte-identical. (That check found a real defect on its first
run — `usage()` was stamping a timestamp, so two reads a millisecond apart were
unequal and the pages could not prove they had the same figures. The timestamp
is gone.)

**Invoice amounts are arithmetic, not typed twice.** A monthly charge is the
per-site rate times the sites being billed; the annual is twelve of those. An
annual total that did not equal twelve monthlies is the first thing a finance
reader would spot, and it cannot happen here.

**Update Payment is disabled, in place, with the reason — and this one is not a
shortcut.** Collecting a card number is the single interaction this product must
never simulate: a form that looks like a payment form teaches the person in
front of it that it is safe to type a card into this application, and there is
no processor behind it. Update Contact is real, because an email address is a
contact detail and not a credential. A check asserts the payload carries no
`number`, no `cvv`, and no run of nine or more digits anywhere.

**The invoice PDF is a real PDF.** `lib/pdf.js` writes one by hand in about
twenty lines rather than pulling ~380KB of `pdf-lib` for a page of left-aligned
text. A control labelled PDF that hands over a `.txt` is the same class of defect
this effort keeps removing. Two checks: the file has a `%PDF-1.4` header, five
objects, a `/Size` that matches, a `startxref` offset that actually lands on the
xref table — and it escapes `(`, `)` and `\\`, dropping anything outside WinAnsi
rather than mis-encoding it.

**The trend has one real anchor.** Its last point is today's sensor figure
against the plan's ceiling — the same number the card above it prints, asserted
to within a rounding step — and the five months behind it are a demo shape. So
the right-hand end can be checked and the history claims nothing was recorded.

**Four corrections from the first review**, all in the same pass: the banner's
left column takes `flex-1 min-w-0` so the gains row wraps inside it instead of
pushing the Upgrade cluster onto its own line; the tier pill is tinted rather
than neutral; the trend series names `tone: 'forge'` (without one the stroke
resolved to `var(--hue-undefined)` and drew in the browser default); and the
card mark takes the network's own colour from three new `--brand-*` tokens.

Those tokens are fenced off in `tokens.css` and named apart from `--hue-*` so
nothing can reach for them by pattern. They are the only colours in this product
exempt from `data-theme` and colour-blind mode, deliberately: a brand mark that
changed hue under Wong's palette would no longer be the mark.

**The Settings rail is sticky**, which is a `SettingsLayout` change and applies
to all thirteen pages. Billing runs to six panels, and the rail used to scroll
away with them. Two elements rather than one: a sticky box cannot also stretch
to its parent's height, so the column carries the border and background full
height and the `<nav>` inside it is what sticks.

**What upgrading gains is derived from the tier table**, by finding every ceiling
the next tier sets to `null`. The banner row and the Enterprise card are two
renderings of that one derivation, so neither can promise something `PLANS` does
not grant. Contact Sales and the Upgrade button are `mailto:` links to a reserved
`.example` domain: they open a message, they do not send one, and nothing records
a lead. A check pins the domain.

### 8.22 Settings — Modules & Plan (done)

Design source: the rendered screen. `mocks/fixtures/plan.js`,
`features/org/plan.js`, `pages/settings/ModulesPage.jsx`.

**The cards ARE the entitlement map the navigation rail reads.** `/v1/org/entitlements`
has gated that rail since long before this page existed, and this screen reads
and writes the same object — so switching Logbook off removes Logbook from the
rail on the next render, and switching it back returns it. Two checks hold it:
the card ids equal the entitlement keys exactly, and a toggle changes what the
entitlements endpoint serves. A module switch that governs nothing would be the
worst instance of this effort's recurring defect, because governing something is
the control's entire meaning.

**That costs the design's taxonomy, and it should.** Its ten cards — Predictive
Failure, Root Cause Analysis, Compliance & Safety IOW — are features *inside*
modules rather than modules, and not one of them is a thing this product can
switch. Our fourteen are the rail's own, drawn with the rail's icons and named
with its labels; `NAV` is keyed by `entitlement`, not `id`, because Home is
gated by `overview` and Reports by `analytics`.

**Three switches are disabled in place, with two different reasons.** Workbook
has no screen to reveal — it is the one prototype module this rebuild decided
not to build, and its card says exactly that rather than the design's "Upgrade
required". Overview and Settings are always on: turning Settings off would take
away the page you would use to turn it back on, which is the same call the
design's own Platform Admin card makes when it reads "Always included".

**Upgrading buys ceilings, not modules.** Every module this product has is in
Professional, so a tier that unlocked modules would have to invent something to
withhold. What Enterprise raises is the limits — and the estate is already
sitting on one, three sites against a limit of three, which the banner states as
a badge and a check asserts. The Upgrade button goes to Billing & Usage, because
there is no payment path in this build and inventing one would be the worst kind
of pretend.

**Every card's metric is a count, and every meter is composed.** The design
prints "12,847 tags monitored" and "389 assets registered" as authored strings; each
of ours is a length or a sum of a collection elsewhere in the fixtures, so a card
cannot go stale — the only way to change one is to change what it counts. The
four usage meters replaced the four authored numbers that used to sit in
`mockAdapter`: sensors are the estate's own per-site counts summed, storage is
summed from the document and media registries, assistant threads are the threads
that exist.

**Three of the five meters carry demo figures, at the reviewer's request.** API
calls, AI Copilot sessions and storage have nothing behind them to count — no
request is served, one assistant thread is persisted, and the document registry
weighs tens of megabytes against a limit in gigabytes. All three first shipped
honest and all three drew a bar with nothing in it, which read as broken rather
than as candid. They now carry the design's own values.

The arrangement that keeps this cheap to undo: the three constants sit in one
named block, each reaches the page with `authored: true` beside it, and where a
real count exists it travels along too — `counted` on sessions, `countedKb` on
storage. Checks pin the *marking* rather than the values, so a demo figure that
stopped declaring itself, or a counted one that started claiming to be authored,
both fail. Sites and sensors remain counted and are asserted to carry no
`authored` flag.

The Copilot module CARD still reports the one thread that exists, and a check
asserts it equals `counted` rather than the meter. A card saying what the module
is doing now and a meter reporting a billing period's usage are different
questions; giving both the same number would answer neither.

### 8.21 Settings — General (done)

Design source: the rendered screen. `mocks/fixtures/org.js`,
`features/org/settings.js`, `pages/settings/GeneralPage.jsx`, plus the
formatting override in `lib/format.js` and `lib/orgFormats.js`.

The design's four cards, each with its own Save: Organisation Identity,
Regional & Locale, Platform Defaults, Danger Zone.

**Three of these settings change the product rather than a record.** The
organisation name is `ORG.name`, which the top bar prints and `/v1/org` serves —
a check asserts renaming it moves both. The date order, clock and time zone
reach every formatter through `setOrgFormatting`, which is the override
`lib/format.js` had described in its own header since it was written. The
landing page is what `/app` resolves to, read by a `LandingRedirect` component
that renders nothing while it loads rather than bouncing through Home.

**Date order is a formatting LOCALE, not a pattern.** `Intl` will not take
DD/MM/YYYY as an instruction; it takes a locale and gives you that locale's
order. So each choice names the locale that produces it (`en-GB`, `en-US`,
`sv-SE`), which is deliberately separate from the interface language — a German
plant reading an English interface still wants its own date order. A caller that
passes a time zone keeps it: a shift prints in its own site's zone, which is the
more specific fact and the reason `formatTime` takes the argument at all.

**Measurement units is disabled, in place, and says what is actually in force.**
This product holds units on the SITE: 0.49 in/s at Findlay and 12.5 mm/s at
Weißenthurm are the same limit, `alerts.js` refuses to convert between them and
calls a single-unit display of that pair a safety defect. An org-wide switch
would either be ignored or would do the exact thing that file exists to prevent.
The control stays where the design puts it and the card lists each site's own
system, so it refuses *and* answers the question. §0.

**Language offers what the build ships, which is one.** A select listing six
languages that resolve to missing keys is worse than a select with one, and the
hint says more will appear as translations land.

**Session timeout is read, not copied.** The design puts it on this page and on
Security. Two controls over one value is how a session ends up 1 hour on one
screen and 8 on the other, so this one prints the Security page's value and links
there — and a check moves it on Security and asserts this page follows.

**The danger zone does two of its three things.** Reset puts six settings modules
back — organisation, security, roles, notifications, connection config,
contextualisation — and the confirmation names them before it acts. It does
**not** clear the audit log, because a log you can clear from a settings page is
not an audit log; it writes a critical entry to it instead, and two checks assert
both halves. It does not touch accounts either: a person is not a setting. Export
assembles a real JSON file from the fixtures, so an export taken after a change
contains the change.

**Delete Organisation refuses, in place.** It names the account the current
session is signed in as, there is no server to ask, and it is the single worst
control on a settings page to fake. Disabled, with the reason where the button is.

### 8.20 Settings — Integrations (done)

Design source: the rendered screen. `mocks/fixtures/integrations.js`,
`features/integrations/queries.js`, `pages/settings/IntegrationsPage.jsx`, plus
the registry changes in `mocks/fixtures/fusion.js`.

**This page registers nothing, and that is the whole design of it.** Every card
is a row that already exists: a connector card is a Data Fusion source, a
notification card is a delivery channel from `notifications.js`, and the Data
Pipeline Monitor is the same source list with its throughput columns showing.
`integrations.js` is a VIEW — there is no array of integrations in it and there
must never be one. This is the defect the effort has now caught five times: a
second list of connected systems lets Settings say the historian is connected
while Data Fusion says it is disconnected, and nothing catches it because both
are "right". Three checks hold the line: every card resolves to a registry row,
every registry row is on the page, and a card's status equals its own row's.

**Configure opens Data Fusion's drawer.** Both records already have an editor
carrying the whole contract — the ingest profile, the config schema, the
credential fields that hold no value — and a second, thinner form over the same
record would have been the one that quietly disagreed. Configure on a channel
opens `ChannelDialog`, which moved out of `NotificationsPage` into its own file
so both screens open the same dialog. Add New Integration opens the connect
wizard, behind one step the design does not have: the wizard needs a family
before it has a catalogue to offer.

**Two departures, both about what a label CLAIMS rather than where it sits.**
The OT/Data Sources group holds every data source the platform reads — the
vision systems and the databases too, not only the historians — because the
page's own subtitle says "OT/IT data sources" and a connector page listing nine
fewer connectors than the platform has is the one screen you cannot use to answer
"what are we connected to". And the fourth group is labelled **ERP & MES**: the
registry holds an Oracle MES, the public page already prints it as one, and
filing it under a heading reading ERP would mislabel a card whose own contract
says otherwise. Same position, same chip, honest word.

**The monitor's two actions are real, and both reach the whole product.** Pause
adds a `paused` rung to the source status ladder, so the source reads Paused in
its family table, every pipeline reading it goes to Stalled — a pipeline cannot
run off a connection that has stopped — and its tags leave the ingest chart,
because a paused source is not delivering. Delete removes the source *and* the
pipelines that read it, saying how many first; without that, `allPipelines` would
have returned an orphan as **Active**, since `statusOf` skips the source rule
when there is no source to check. Both write to the audit log.

**Delete refuses on the three anchors, in place, with the reason.** Their rows
are rebuilt from `CONNECTORS` on every read, so deleting one would remove nothing
and it would be back on the next render — §0's rule applied literally rather than
by hiding the control.

**Records/min is arithmetic, not a second number.** It is the tag count at
`SAMPLES_PER_TAG_HOUR`, the one publishing-interval assumption this codebase
already makes, and it is **zero** on a source that is not delivering. The design
writes `847 tags` and `12,400 records/min` as independent strings, so a row can
carry a rate that does not belong to its tag count. Data lag is the measured
round trip and reads an em dash where nothing measured it — never a zero, which
would be the best possible reading on the worst possible row.

**One field was added to the registry**: `system` on the business sources, so
CMMS can be grouped apart from ERP. It is authored once for the sources
`fusion.js` owns and read off `CONNECTORS.family` for the anchors, which already
declare it.

### 8.19 Settings — API & Webhooks (done)

Design source: the rendered screen. `mocks/fixtures/apiAccess.js`,
`features/developer/queries.js`, `pages/settings/ApiPage.jsx`.

**A key's value exists once.** Generating one returns the secret in that response
and in no other; the record holds a prefix and never held anything else, which is
a stronger arrangement than remembering not to send it. Two checks: that the
value comes back on creation, and that it appears in no later response — the
directory read *or* the audit log. The design says "This key will not be shown
again" and is right to; this is the one place on the page where getting it wrong
would be a real defect rather than a cosmetic one.

**Revoking keeps the row.** Which keys existed and when they were withdrawn is
what somebody reviewing API access needs, and a table that quietly shrinks cannot
answer it. A revoked key cannot be rotated back into use.

**Scopes are built from the navigation rail**, the same way the roles catalogue
is — `read:anomalies`, `write:workOrders` — so a scope cannot name a module
nobody can reach. **Events name the module that raises them**, and the two the
design lists that this product has no concept of (`prediction.alert`,
`incident.critical`) are gone: a webhook subscribing to an event nothing emits
will never fire and nobody will ever be able to tell.

**Download Spec and Postman write real files, generated from `endpoints.js`.**
That file is the only place this client may write a URL, so the document
describes the paths the product actually calls, and a check asserts the published
set and the declared set are **exactly** equal — not a subset either way. Neither
file carries request or response schemas: those belong to a service that has not
been written, and a specification that guessed them would be wrong in a way
nobody could see. API Docs has nowhere to go and is disabled with the reason.

**Test shows the payload rather than sending it.** Firing a real request would
POST plant data to a third-party endpoint from the reader's browser on a button
press, which a settings page should not do; the design's version reports "Test
event sent" without having sent one. The dialog shows the exact body that would
be delivered, which is the half somebody opens Test to find out.

**Webhooks are HTTPS-only, refused rather than warned about** — the same rule the
Security page's API card states and cannot turn off.

**Every write here lands in the audit log**, which is now the third module joined
to it.

### 8.18 Settings — Security & Access (done)

Design source: `platform/screens-settings2.jsx` → `SecuritySettings`.
`mocks/fixtures/security.js`, `features/security/queries.js`,
`pages/settings/SecurityPage.jsx`.

Built against the rendered design rather than its source, and to the rule §8.17
set: **the structure is the design's five cards in its order** — Authentication,
Password Policy, Session Management, IP Allowlist, API Security — and the
departures are about what a value claims, never where it sits.

**A policy that is only stored is still worth storing honestly.** Nothing here
enforces a minimum password length; there is no sign-in of this product's own to
enforce it at. What the page does is hold the decision, report who it would
affect, and write it to the audit log. The design's own audit table has a row
reading `settings:security · MFA enforcement enabled` — the two screens were
always meant to be joined, and here they are: save anything and the entry is on
that page before you reach it, at critical severity, naming the fields.

**Requiring MFA has a number attached.** Three accounts have no second factor, so
the switch is a statement about three named people; the card names them and links
to them. Counted from the directory, so enrolling somebody moves it — and a
*deactivated* account is not counted either way, because it cannot sign in and so
is not somebody the requirement would lock out. Both halves checked, and the
second one exists because the first check picked a dormant account and failed.

**There is one session and it is this browser.** The design lists three with IP
addresses and cities. A session is held by the server that issued it; there is
none here. The device IS knowable — read from the user agent — so that column is
filled; the address and the city are not, so they read em dashes, the same call
the audit log makes. **Revoke and Terminate all sign you out**, behind a confirm,
because that is what revoking your own session means.

**Three controls are shown disabled with the reason, rather than removed.**
Force re-enroll all users would invalidate every second factor in the estate with
no enrolment flow behind it to complete. Add my current IP cannot work: a page
cannot know the address it reached the server from, and asking a third party
would send this reader's address to them to find out. Require HTTPS only is
locked exactly as the design has it, and genuinely — the transport has no
plaintext mode.

**`useDraft` derives instead of syncing.** Fourth time `set-state-in-effect` has
caught this shape in the effort. The draft holds the answer it was taken against
and a draft from a stale answer reads as empty, so a save clears the form without
an effect and without one render still showing edits that already landed.

### 8.17 Settings — Audit log (done)

Design source: `platform/screens-settings2.jsx` → `AuditSettings`.
`mocks/fixtures/audit.js`, `features/audit/queries.js`,
`pages/settings/AuditPage.jsx`, and one `audit()` call in each fixture that
writes.

**The rest of the demo writes this page.** Lock an account on the Users screen,
change a role, run an import, delete an alert rule, disconnect a channel, replace
a credential on a Data Fusion connection — then open this and the entry is
waiting with the actor and the resource. That is the only property an audit log
has that matters: it can be checked by going and doing something. The design
ships seven authored rows.

**Recorded in the fixture that performs the write, never at the route.** An entry
written by the handler would be missed by the next caller who forgot one, and
the holes would be exactly where somebody took a shortcut.

**The history it opens with is the estate's own.** A log that is empty until you
click is a demo of an empty table, so the seed is derived from records that
already carry an actor and a time — the anomalies somebody acknowledged, the
notes somebody wrote. Nothing in it was invented to fill the screen, and a check
asserts every seeded row points at a record that exists.

**Severity is derived from the action.** Removing access or a record is critical,
changing who can do what is a warning, the rest is information. Passed in beside
the action it could be Info in one place and Critical in another, and a check
asserts one action never has two severities.

**Built twice, and the first shape was wrong.** The first version kept the
content and rearranged everything else: relative times instead of absolute,
translated action names instead of the raw token, no Details column, no IP
column, four stat tiles the design does not have, a Record button instead of a
row that opens. Each of those was defensible alone and together they made a
screen that was not this one. It is now the design column for column —
Timestamp · Actor · Action · Resource · Details · IP · Severity, the two-line
monospace timestamp, the accent-coloured `SCREAMING_SNAKE` action, the row that
expands to its stored record, "Showing n of m" with Prev and Next, both export
buttons, and the Compliance Export panel with its green edge.

**The rule this pass established, and the one to work to from here:**
match the structure exactly; depart only on what a value CLAIMS, never on where
it sits. A dishonest value becomes an honest one *in the same cell*. It does not
get its column removed, its row restyled or a tile invented in its place.

**No hash.** The design prints `sha256:9f2b…e41a` on every row — the same string
on all seven, which is worse than printing none: a tamper-evidence claim that is
visibly not tamper-evident. Chaining entries is a server's job. Said in the
footnote instead.

**The IP column is present and empty.** A source address is recorded by the
server that receives the request, and there is no server here — so every row
reads an em dash and the footnote says why. That is the rule above applied to
its hardest case: the column stays because the design has it, and inventing
plausible addresses in an audit log would be the worst place in this product to
invent anything.

**Export PDF is the browser's print**, which is a real PDF and the print
stylesheet is already written for it. The compliance dialog writes the rows on
screen in the format chosen and records the framework in the file rather than
changing what is in it — nothing here knows what SOC 2 requires, and a report
that claimed to would be the wrong thing to hand an auditor.

**No write endpoint.** An audit log a client can post to is not an audit log; a
check asserts the POST 404s. Export writes what is on the screen, because on this
page the difference between a filtered table and an unfiltered export is the
difference between evidence and a misleading extract.

**A credential is recorded and never captured** — replacing one on a connection
appends `CREDENTIAL_ROTATED`, and a check searches the whole response for the
value that was sent to make sure it is not in it.

### 8.16 Settings — Notifications (done, as one screen with two entrances)

Design source: `platform/screens-settings2.jsx` → `NotificationsSettings`.

**It was already built.** `/app/notifications` — the screen the bell opens — is
alert rules, delivery channels and the escalation ladder, which is exactly what
the design's Settings → Notifications page is. Building it again would have put
two pages over one set of rules, which is how a rule ends up enabled on one and
paused on the other. So `/app/settings/notifications` renders the same component.
A check counts the mounts: two routes, one page.

**The layout was rebuilt to the design's** after it was shown side by side. What
had been built to §8.8 from a different design source was a good screen with the
wrong shape: Create Rule in the page header rather than the panel's, no pager, no
row actions beyond a toggle, channels as a list rather than cards, and the ladder
stacked vertically. It is now the design's: Alert Rules panel with its own
header and Create button, a table with Rule · Condition · Scope · Severity ·
Channels · Status · Actions and a pager, a card grid of channels, a horizontal
ladder with arrows and Add Level, and the preferences panel.

**Which meant the row actions had to become real.** Pause was already a write;
Edit, Delete, channel Configure, channel Test and Add Level were not. All five
are now, and all five answer with what is true: **a target is what connects a
channel**, so clearing it disconnects and every rule routed there goes
undeliverable as you watch — the design's cards can read Connected above "Not
configured". Testing an unconfigured channel fails rather than being offered as a
button that can only fail. A rule's KIND is not editable: one that changed what
it watches is a different rule and its id would be lying. An escalation level
must be later than the one above it, because a ladder is ordered by time.

**The Fired column moved rather than going.** The design has no such column and
the figure is still worth keeping — a rule that has never fired in a plant this
busy is a rule worth looking at — so it sits under the rule name with its id.

**One card was genuinely missing** — the per-user delivery preferences the design
has and this product's screen did not: daily digest, weekly summary, in-app
sound, browser push. It is on the same page and says which subject it belongs to,
because a rule decides who the platform tells and a digest decides what it sends
me, and somebody flipping a switch needs to know which of those they are doing.

**Browser push is shown, off, and cannot be turned on.** Nothing here has asked
the browser for notification permission, and a switch reporting "on" while the
browser had never been asked would be the only false claim on the screen. It says
why rather than being left out — its absence would read as an omission rather
than a decision. The PATCH refuses it and a check asserts both halves.

**The settings IA does not match the design's, and that is now visible.** The
rail here carries `sources` and `assistant`, which the design has no page for;
the design carries `Shift Master`, `Site Onboarding` and `API & Webhooks`, which
this rail has no entry for. Reconciling the two changes the navigation, so it is
a decision to take rather than a change to make quietly. What is certain either
way: **`sources` should not be built** — Data Fusion owns the source registry and
a second list of connections is the defect this effort keeps catching.

### 8.15 Settings — Roles & permissions (done)

Design source: `platform/screens-roles.jsx`.
`mocks/fixtures/roles.js`, `pages/settings/RolesPage.jsx`, `RoleEditorDrawer.jsx`,
`PermissionMatrixDialog.jsx`.

**The catalogue is the navigation rail.** The design invents its own module list
— "Dashboard", "Root Cause Analysis", "Integrations", "Platform Admin" — half of
which does not exist here under any name. A permission naming a screen nobody can
open is one nobody can ever test, so the catalogue is `ALL_NAV_ITEMS`: every
module in the rail, with the route it goes to, the icon it carries and the name
`app:screens` already gives it. Add a module to the product and it turns up here
needing features. What IS authored is the features, because an action is not
derivable from a route — nothing about `/app/work-orders` says approving is a
different privilege from closing.

**Each module declares a gate, and the gate is what makes the grid mean
something.** One feature per module means "can reach it at all", and the role
detail draws the rail as somebody holding that role would find it — strip
`anomalies.view` and Anomalies leaves the list while you watch. Without that a
permission grid is a wall of checkboxes whose effect nobody can look at, which is
what the prototype's is. The gate is always the first feature in the list rather
than a second field beside it.

**The eight built-in roles are the vocabulary, not a copy of it.** `common:roles`
is what the Users table prints, what the create dialog offers and what the bulk
import validates against, so this page lists exactly those and can neither edit
nor delete them — removing `maintenanceTechnician` would leave two people holding
a role that no longer exists. Duplicate makes an editable copy, which is the
design's own answer and the only safe one. A check asserts the built-in set and
`common:roles` are the same set, and that every role somebody actually holds is
one this page knows about.

**How many people hold a role is counted.** The design writes `users: 3` beside
each, free to disagree with the directory. Here it is a count over the registry
the Users screen reads.

**Granting a feature on a module the role cannot open is reported, not silently
fixed.** The editor counts what the role will actually reach and warns when ticks
have been left stranded. Auto-enabling the gate would make the grid do something
other than what it shows.

**A custom role cannot be deleted while somebody holds it** — same reason there
is no Delete on the Users screen.

**The matrix is a real table.** Headers in both directions with `scope`, so a
screen reader announces "Approve work orders, Reliability Engineer, granted"
rather than a wall of ticks; the prototype's is a div grid with no headers at
all. Granted is a check glyph and withheld an em dash, both titled, because
colour alone fails for a colour-blind reader and in print.

**A fourth copy of the role vocabulary, found by a check.** `directory.js`
validated imported and hand-created people against its own hardcoded list of the
eight built-ins — so a custom role could be created on this page and then refused
by the screens that offer it. It reads the roles collection now. That is the same
defect this module opened by fixing three times over; worth remembering as a
shape: **a list of valid values written next to the code that checks them is a
copy, however short it is.**

### 8.14 Settings — Users & Teams (done)

Design source: `platform/screens-users-teams.jsx`. All three tabs built — Users,
Teams and Import History — plus Create, Import and Export. The Roles builder
(`screens-roles.jsx`) is its own page and its own pass.

**Users shipped first without the other two tabs and that was wrong.** The design
is one module with three tabs and three actions in its header; a slice of it
reads as a screen somebody forgot to finish rather than as a decision. Recorded
because it is the second time in this effort that deferring a visible control —
the document upload button in pass 4 — cost more than building it would have.

**Chosen first because it collapsed three registries rather than adding a
fourth.** `PEOPLE` in `enterprise.js` held four personas with a role key,
`TASK_PEOPLE` in `home.js` held six with the role written out in English, and the
briefing card hardcoded three more names, initials and roles. They overlapped and
disagreed. All three are now views over `mocks/fixtures/people.js`, which is the
same move `currentSites()` made when sites stopped being a second array beside
the hierarchy. Five modules already named people and none of those names went
anywhere; this is the screen they go to.

**Only what nothing can derive is authored.** A name, a role key, a home site,
whether the account is enabled and whether it has a second factor. Initials and
email addresses are computed from the name, so correcting a typo cannot leave an
avatar wrong. Addresses are all `@meridian.example` — RFC 2606 reserves it, so no
synthetic contact detail can ever reach a real inbox, and a check asserts it.

**Last active is the end of the person's most recent finished shift.** The roster
is the one place this product records somebody doing something at a time. The
design writes `last: "2m ago"` into the row, which is still saying two minutes
tomorrow. **"Never" is a real answer** and the useful one: an enabled account
nobody has used is exactly what an access review is looking for, and an invented
date would hide it.

**The sites somebody reaches are the sites they work at** — their own plant, plus
the plant the roster is for if they are on its crew, plus wherever their open
tasks are. Which is how the Pune line operator turns out to cover two sites
without anybody typing the design's `sites: "2 sites"`, a string that cannot be
filtered on. `ROSTER_SITE` had to be exported from `shifts.js` for it; it is not a
field on the shift row, because that roster is one plant's and a constant repeated
on sixty-three rows invites somebody to vary it.

**Ordered as an access review, not a phone book.** Locked, then dormant, then no
second factor, then everybody else. Name order is for when you know who you are
looking for.

**Every tile is a filter and every filter is a tile.** Six of them, each counting
something the table can then show, each counted over everybody rather than the
filtered slice. A check walks all six and asserts the narrowed list matches the
count and that the tiles do not move when it does.

**One editable field: whether the account may sign in.** A name belongs to the
person, a role to the roles page, a site to the hierarchy, a last sign-in to the
log. The design offers nine inputs and a Delete — deleting somebody who owns
tasks, shifts and handovers would orphan every one of those records with no undo
beside it. There is no Create either: an invitation goes to an address and comes
back accepted or not, nothing here can send one, and a row that appeared already
active would describe something that did not happen.

**Locking stops new work reaching somebody; it does not erase what they did.**
Found by a check. `TASK_PEOPLE` was a filter evaluated once at module load, so
locking an account left them in the assignee picker — the same snapshot-of-a-
mutable-fixture shape as the stale `nodeById` in pass 4. Fixed by splitting the
two questions: `TASK_PEOPLE` is who does plant work, by role, and is what the
roster and the logbook resolve a name from; `assignablePeople()` is who may be
given something new, evaluated per request. Who worked Tuesday night is a fact,
and an account decision taken on Friday cannot unmake it.

**Three accounts join the six the demo already names**: an admin with no second
factor, a locked technician, and a read-only analyst who has never signed in.
They are the rows a review is looking for, and a directory of only busy people
never shows them.

**Teams are a view of who is in them.** The design authors `members: 2`,
`sites: "Atlanta DC"`, `lead: "Jim Newman"` and `status: "Active"` side by side,
so a team can report two members and list three, or be Active with nobody in it.
Here a person carries their `teamId` and that is the only authored fact: the
count, the sites, the scope, whether the lead is still a member and whether the
team is active all fall out of it. **A team with nobody who can sign in is
dormant** — deactivate the last member and the team goes quiet, which is checked
by doing exactly that and putting them back.

**Every team's default page is a route.** The design's is free text naming
screens the product does not have ("Realized Value", "Site Health"). Each one
here is a path, the row links to it, and a check greps the router for it.

**Import History is a real record.** The prototype's is an empty state that
nothing ever fills. Here the wizard appends a row saying what it created, updated
and skipped.

**The import wizard parses your file.** Upload → Map → Check → Review, over the
CSV reader the asset import already had — which moved to `lib/csv.js` when the
second caller appeared. The parser is generic; the schema is not, and the two
validators stay apart because an asset has a line and a criticality where a
person has a role and a second factor. Errors block a row and warnings do not:
the line is whether the platform can store something true, so a row with no email
has no account to be, while a row naming an unknown plant still describes a
person and they land without one.

**An import run twice does not double the directory.** A row whose email already
exists updates that person; the summary says which it did, which is why the
endpoint is `import` and not `create`. Checked by running the same file twice.

**The prototype's fifth step is not built.** It maps unrecognised roles onto real
ones. Good idea, wrong place: a role this platform does not have is an error the
file should be corrected for, not a decision taken in a dialog nobody will
remember making.

**Create asks four things where the design asks nine.** A name, a role, a plant
and a team. Job title and department are the same fact as the role; a phone
number and a default page are the account holder's to set; and a status and an
enrolled second factor cannot be true on the first day — an account created with
MFA already on describes an enrolment that did not happen. The email address is
shown, not typed, because it is derived from the name for everybody else in the
directory.

**Export writes what is on the screen.** A filtered table and an export that
ignored the filter are two answers to one question, and the reader finds out only
after opening the file.

**The checkbox column earns itself.** It selects, and the selection has a bulk
deactivate to act on. A selection with nothing to do to it wastes a column.

**Deferred:** a person drawer showing their actual shifts and tasks, and a team
detail. The counts are on the row and are not links, because neither the roster
nor the task list can be filtered to one person yet and a link landing on an
unfiltered list has not answered the question.

### 8.10 Data Fusion — the other 10 sections

Design source: `platform/screens-datafusion.jsx`, `platform/screens-datafusion2.jsx`,
`platform/fusion-profiles.jsx`, `platform/fusion-store.jsx`. **IoT is already built
against the real API — do not touch it.**

This module is being taken in **nine passes**, because it is the largest one left
and compacting mid-pass is how a decision gets lost:

| # | Pass | State |
|---|------|-------|
| 1 | Source registry + the four connection tables — OT, Vision, Business, Databases | ✅ **done** |
| 2a | Connection drawer — Connection / Data Contract / Activity | ✅ **done** |
| 2b | The drawer's mapping tab, and the two extra tabs — Write-back Rules, ROI & Recipes | ✅ **done** |
| 3 | The 4-step connect wizard | ✅ **done**. The mapping modal is not built — see below |
| 4 | Documents & SOPs — 12 documents, inheritance, viewer | ✅ **done** |
| 5 | Images & 3D Media | ✅ **done** |
| 6 | Contextualisation | ✅ **done** |
| 7 | Knowledge Graph | ✅ **done** |
| 8 | Pipelines | ✅ **done** |
| 9 | Data Overview | ✅ **done** — taken out of order, see below |

**Overview was planned last on purpose**, because every card on it counts
something — connections, documents, media, graph entities — and building it
first would mean authoring five numbers that the eight screens behind them then
have to be made to match.

**It was then taken second, at the user's request.** The property was kept rather
than dropped: the *document and media registries landed with it*, ahead of the
screens that render them, so the cards count real collections. What is not built
is the browsing UI, not the data. Pass 4 renders records that already exist and
are already checked, which is a better position than it would have been in.

The two remaining uncounted collections are the knowledge graph, which is
derived outright and needs no fixture, and pipelines — the one card the design
has that this Overview does not draw. It gets one when pass 8 gives it something
to count.

#### Pass 3 — the connect wizard (done)

`pages/dataFusion/AddSourceWizard.jsx`, the wizard half of
`mocks/fixtures/fusionProfiles.js`, `addFusionSource` in the registry, three
routes. **Data Fusion is finished.**

**What comes out is a row, not a toast.** The source is appended to the registry
every other screen reads: it appears in its family's table, counts in the
overview, opens in the drawer, and is subject to every rule the module already
enforces. Six checks assert exactly that, including that the overview's source
card moves by one — because it counts the registry rather than holding a figure.

**And the row says Disconnected · never synced.** Which is the truth about a
connection made ten seconds ago. The prototype's wizard ends on a green Connected
pill, and every demo of it has to hurry past the moment somebody asks how it
synced before it existed. The rung pass 2a added to the ladder is what made the
honest answer available, and the wizard's last step shows it before you commit.

**Step 1 fixes the protocol for good.** Picking Rockwell FactoryTalk is picking
ODBC — which is the same rule the drawer already obeys by offering no way to
change it, and the same one `/v1/connections` states outright. Three screens, one
rule, none of them restating it.

**Step 2 asks for what a connection cannot exist without** — three or four
fields, not the profile's thirteen and not the prototype's arbitrary first eight.
The rest take their schema defaults and are editable in the drawer the moment it
closes, and the step says so. It renders through the drawer's own
`ConnectionField` over the drawer's own schema: two forms, one schema, which is
the point of having one.

**Step 3 reports a sample, not a total.** How much a connection will carry
depends on what it is scoped to, and that is step 4 — a count here is how the
prototype ends up discovering "847 browsable nodes" and creating a source with a
different number on it. The probe is a gate, and editing a field afterwards
clears it, for the reason the live wizard gives.

**Step 4's count follows the scope, and the site follows the machines.** A
gateway is scoped to a line and reads that line's assets, so its site derives the
way every other source's does rather than being picked from a second select that
could disagree. An enterprise system is offered no line at all, because SAP is
not at a plant. The schedule keys are the pipelines module's own, so a source and
a pipeline cannot mean different things by "hourly".

**The one assumption in the whole wizard** is how many objects a machine
contributes — 180 tags, 2 cameras. Every other figure it reports is arithmetic on
that and on the estate's real asset count.

**The schema-driven mapping modal is deliberately not built.** The design's
"+ Add mapping" binds a source tag to a Forge sensor. Doing that here would have
to CREATE a sensor, and the sensor catalogue is derived from the estate —
`SIGNAL_CHANNELS` is computed from the hierarchy, the components and the open
alerts. A fixture write into it would put Sensor Explorer's channel list out of
step with the thing it is computed from, which is the exact class of defect this
module was arranged to prevent. The act the demo does support for an unbound tag
is *placing* it, and the mapping tab's unbound count already links to the screen
that does it. If a real sensor-creation endpoint lands, this is the decision to
revisit.

**`StepIndicator` is now shared.** It took a `steps` array and a key prefix, both
defaulting to the live wizard's own — so that call site is unchanged and there is
one place to fix the next spacing change rather than two.

#### Pass 2b — what a source is bound to (done)

`mocks/fixtures/fusionMapping.js`, three more tabs on the drawer, one more route.

**Binding and placing are different acts, and this is where that pays.**
Contextualisation places an object in the estate — this tag belongs to that
machine. Binding routes it — this tag drives that Forge sensor's chart and its
thresholds. Pass 6 kept them apart because `CONNECTORS` declares exactly one
connector that provides signals and Sensor Explorer's filter drawer states it as
fact. The mapping tab is that claim made visible.

**A source binds Forge sensors iff its OWN contract declares signals.** The
family profile is not enough and must not be: OT as a family plainly provides
signals, and every OT gateway here says so on its Data Contract tab. What is
scarce is being *the connector this platform routes into the sensor catalogue*,
and only the three anchors carry a contract of their own to declare it with. The
first version read the family claim and five gateways bound the same bodymaker's
instruments; a check caught it, and the empty state's copy — "this source does
not provide signals" — was false into the bargain. It now says the true thing:
the family provides them, this gateway is not the one routed, so its tags are
placed rather than bound.

**Bound and queued are one population, by construction.** `tagsOfSource` returns
both halves; the Contextualisation queue filters out the bound ones; the mapping
tab shows them. So `bound + awaiting = every tag the source publishes` holds
because it is one function rather than two lists kept in step, and the count above
the table links to the queue holding the other half. Checked both ways: the
identity, and that nothing bound is also sitting in the queue.

**Four families, one table.** The columns come from the response, not from a
switch in the component — what differs between a historian and an ERP is the
columns and nothing else. A cell is a literal, a data kind out of
`common:dataKinds`, or a delivery target; the fixture says which, so it holds no
English.

**Where a row goes is not authored.** `target` is a key into the pipelines
module's own delivery map, so a mapping row and a pipeline cannot disagree about
where work orders live. Every row has an `href` into the screen that owns what it
names — the graph pass's test for whether an edge was real.

**What the connector offers and this deployment does not consume is said out
loud.** SAP PM exposes maintenance plans and S/4HANA exposes the material master;
neither has a Forge object here. They are not rendered as rows pointing nowhere
and they are not filtered away — they are listed under "Offered, not consumed
here". S/4HANA's whole mapping table is that list, which is the honest state of a
connected source that feeds nothing.

**Write-back follows the connection's own Sync direction.** Read from the config
value on the Connection tab rather than authored a second time, so setting the
select to read-only turns every rule off — the prototype draws six live toggles
beside a connection whose own form says Read-only. `reserveSpares` is not offered
at all: this product has no spare-part record to reserve, and a switch that cannot
do anything is worse than a sentence saying the connector could if there were
somewhere to put it.

**Which recipe is running is the Inspection program the Connection tab has
selected.** Change the select, save, and the active row moves. The prototype marks
one recipe active and one standby with no relationship to anything.

**No Device Registry tab.** It is IoT's, and IoT is the live API.

#### Pass 2a — the connection drawer (done)

`mocks/fixtures/fusionProfiles.js`, `pages/dataFusion/ConnectionDrawer.jsx`, three
routes in the adapter, and the source name in the table becomes the control that
opens it.

**Pass 2 was split.** The drawer has five tabs in the design and the mapping tab
is the largest of them — it differs per family in what it binds, and for OT it
has to be the *bound half of the tag population Contextualisation draws its
unbound half from* rather than a fresh table of made-up rows. That is a pass of
its own. This one is the three tabs that read: Connection, Data Contract,
Activity.

**The endpoint is edited here and lives in the registry.** The property the
drawer exists to demonstrate. A `bind` on the config schema makes the field read
the source rather than the schema, so the drawer prints the same string the table
does; saving writes it back through `setSourceField`, the only way into the
registry, restricted to the fields the registry owns. Because the status is
derived from the endpoint, giving Maximo one moves its row off Not configured
while you watch — and clearing it puts the row back. A tag count or a status
cannot be typed, which is the disagreement the whole module is arranged against.

**"Not configured" stopped being a flag.** `src_maximo` carried both
`endpoint: null` and `configured: false`, and the status checked either — so the
first thing the drawer did on being given an endpoint was leave the row
unconfigured with an endpoint in it. The bit is gone: a source is unconfigured
when it has no endpoint, which was always the only thing that made it true.

**A source that has an endpoint and has never synced is Disconnected · never
synced.** Found by the check for the above, not by eye: `lastSyncMinutesAgo` was
`null` on Maximo, `null > null` is false, and the moment the drawer let somebody
configure it the ladder fell through to Connected — a source that had never
spoken once claiming to be healthy. It is its own rung now, between the error and
the clock, with its own reason so the pill is never red beside a blank.

**A credential is never a value.** The prototype's schema carries
`["Client secret","••••••••••••","text"]` — pre-filled, in a text input a browser
will offer to autofill and a screen-share will show. A `secret` field here has no
value at any point: the transport never sends one, the fixture never holds one,
and a value typed in is used to stamp a timestamp and then dropped. Two checks
assert it, one of them by searching the whole response for the string that was
saved. This is also the shape the real endpoint will want, so the form does not
have to be redesigned the day it is wired up.

**The contract comes from whichever half of the registry owns it.** For the three
anchors it is the `provides` / `doesNotProvide` list `CONNECTORS` declares and the
public source-contract section prints; for everything else it is the family
profile. Same seam as the row. Both halves speak `common:dataKinds`, the
vocabulary the landing page already uses — so "provides work orders" means one
thing in this product, and a check asserts every kind either half names has a word
in it.

**The activity log is derived from the source's own clock.** The prototype
hand-writes five lines starting "just now · Sync completed" and prints them under
a connection its own table marks Disconnected. Here a stopped source shows its
retries at its own SLA cadence and the last sync that worked below them, a source
nobody configured shows nothing at all, and the only authored entries are the ones
the reader caused this session — a save and a test. Which makes it the one place
an action in the drawer leaves a trace.

**Test answers with what is true.** Not a spinner that ends green: the ABB
gateway fails with the TLS error its own row prints, Maximo reports there is
nothing to reach. A test that always succeeded would teach a reader to stop
believing the status column.

**No Delete.** The prototype offers one. Removing a source would take an anchor
out of a registry two other screens read from, and there is no undo to put beside
it.

**Fields are rendered here rather than by `ConfigField`.** That component renders
the LIVE connector `config_schema`, whose labels are the server's own strings
passed through as data. This schema is a fixture: its labels are keys, and it has
three controls the live one has no notion of — a file reference, a multi-line
query and a credential that carries no value. Two schemas, two sources, two
labelling contracts.

**An option is a spec term or a phrase, and the schema says which.** `spec()` and
`phrase()`: `Basic256Sha256`, `SignAndEncrypt` and `verify-full` are what goes on
the wire and are printed as they are in every locale; a duration or a sentence
takes a key. Leaving the next reader to guess which strings are safe to localise
is how `Basic256Sha256` ends up translated.

**No `driver` select on Databases & Cloud.** The design offers one, but the
protocol is already on the row and in the drawer's own header, and
`/v1/connections` states outright that `connector_type_id` is not updatable — a
connection cannot change protocol. Offering the choice would be offering an edit
the real resource refuses.

**No profile for IoT.** That family is the real API and its connector types come
from `/v1/connections/connector-types`. An authored profile here would be a
second, fictional description of a family the API already describes.

#### Pass 1 — the source registry (done)

`mocks/fixtures/fusion.js`, `features/dataFusion/sources.js`,
`pages/dataFusion/SourcesPage.jsx`, and one route in the adapter.

**This does not start a second list of connected systems.** `CONNECTORS` in
`operations.js` already declares three — the OT historian, the CMMS and the MES.
The public page prints their contracts, and Sensor Explorer's filter drawer
states as fact that exactly one of them provides signals, which is why that
drawer offers no source filter (§8.4). So those three are **anchors**: their
protocol, tag count, last sync and state are read from `CONNECTORS`, and
`fusion.js` adds only the endpoint, category and asset list a connection table
needs. Six checks assert each anchor comes back with the protocol and the state
`operations.js` gave it, and one asserts that the signal-providing connector is
still the only source in the whole registry carrying a contract.

**Status is derived from the clock, never authored.** The prototype writes
`s: "Connected"` and `sync: "30 sec ago"` as two independent strings, so a row
can claim to be healthy and to have last spoken two days ago. Here a source
declares `lastSyncMinutesAgo` and `slaMinutes` and the status falls out of the
comparison, in one fixed order: nothing filled in beats an error, which beats a
sync in flight, which beats the clock. `verify:mocks` asserts nothing is
`connected` while past its own SLA — and, the other way round, that everything
past its SLA says so.

**A source's site is derived from the assets it reads.** Also not authored: a
gateway on three Findlay machines is at Findlay by definition. Enterprise systems
declare no assets and are scoped `all`, which the table prints as
"Enterprise-wide" rather than leaving blank — SAP genuinely has no plant, and an
empty cell would read as missing data. Checks assert every site and every asset a
source names exists in the hierarchy, and that having assets and having a site
are the same fact. The prototype's rows carry a free-text site and three of its
four do not exist in this estate.

**One component, four families.** The design draws the same table four times.
What differs is the *contract* — what each ingests, its config schema, its
mapping columns, its wizard steps — and none of that is on this screen; it is
behind the drawer and the wizard, passes 2 and 3. The family arrives as a prop
rather than a route param, because a `:section` segment would also match
`documents` and `graph`.

**The unit noun is read from the category.** A historian counts tags, an ERP
counts records, a TSDB counts series, a vision system counts cameras — straight
out of `fusion-profiles.jsx`. One header saying "Items" for all four is the word
you reach for when you have stopped thinking about what is in the column.

**Rows sort by what has stopped working**, not alphabetically. A source list in
name order is a catalogue; in failure order it is a morning's work queue, which
is what somebody opens this screen to find.

**A skeleton only appears if `placeholderData` lets it.** All four families share
one component and one hook, and `placeholderData: (previous) => previous` also
fires when the CATEGORY changes — so clicking from OT & Historians to ERP / MES /
CMMS held six historians under the ERP heading until the next response landed,
and the skeleton the screen already had never showed at all. It is now held only
while the family is the same, compared against the previous query's own key.
Worth remembering as a shape: **`(previous) => previous` is right for a filter
and wrong for a different subject.** The knowledge graph had the same defect —
one machine's neighbourhood on the canvas while the picker named another — and
has no placeholder at all now.

**`isSectionBuilt()` now resolves the pair** in `pages/dataFusion/sections.js`,
the same three-state arrangement `shell/navigation.js` uses — so with the flag
off these four sections go back to the placeholder and the rail agrees. The
placeholder's copy no longer says "IoT & Sensors is the first one", which stopped
being true.

**No "+ Connect source" button yet.** It belongs to the wizard in pass 3, and a
primary action that does nothing is worse than one that is not offered.

**Left for pass 2, deliberately:** how many of a source's tags are actually bound
to a Forge sensor. It is the most interesting number on the screen and it is the
mapping table's own count, so it lands with the mapping table rather than being
approximated now. Note when it does: only `conn_historian` may show a non-zero
bound count, or Sensor Explorer's "one source provides signals" claim breaks.

#### Pass 9 — Data Overview (done, taken second)

`pages/dataFusion/FusionOverviewPage.jsx`, the overview half of
`mocks/fixtures/fusion.js`, and a new `mocks/fixtures/fusionDocs.js`.

**Every figure is a count, and every card is a link into the records it
counted.** The prototype prints `graphEntities: 12847` beside four other round
numbers; there is no way to open any of them and no way for any of them to be
wrong. Here: sources is the registry length, the tag figure is the sum across
connected sources, documents and media are registry lengths, and the graph total
is the estate plus its signal catalogue plus its records — counted, with the
breakdown under the card. Twenty-six checks assert each one, including that the
hierarchy edge count is exactly one fewer than the node count.

**The document and media registries landed here** rather than in passes 4 and 5,
because two cards count them. Records, links and scopes only — no browsing UI, no
inheritance resolver. The resolver belongs with the screen that draws the
inheritance path; a function nothing calls is a function nothing checks.

**Four scope levels, not the prototype's six.** `fusion-store.jsx` inherits a
document down asset → model → site → line → component → sensor → enterprise. Two
of those cannot be honestly reproduced: MODEL is `/v1/asset-classes`, a LIVE
resource, so a fixture link would point at a record the API owns and somebody
could delete; and COMPONENT and SENSOR ids here are unique within their asset,
not globally — `VIBX` exists on several machines — so `{k:'sensor', id}` has no
single referent. What is left is the estate's own graph, enterprise → site →
line → asset, and every link resolves to a node `verify:mocks` can find. **If
pass 4 wants model-level documents, that is the decision to revisit, and it needs
a story for live-resource references first.**

**`scope` is read from the links, never authored beside them.** The shallowest
link wins. Writing both and hoping is how a document ends up marked
enterprise-wide while pointing at one bodymaker.

**The ingest chart is composed from the sources.** Only what is currently
delivering contributes, its share is proportional to what it carries, and the
shape over the day is the same three-shift pattern the Shifts module rosters
against — so the two screens tell one story about when this plant is busy. A
disconnected source contributes nothing, which means the curve dips when
something in the tables breaks rather than being a decorative wave. Checked: the
series ends at the current hour, and the night shift moves less than the day
shift.

**The attention list is assembled from three collections**, not authored as one:
sources that have stopped or fallen behind, documents nobody has verified, and
certificates running out. Each entry links to the section that holds it. Checked
both ways — everything on the list is unhealthy in the tables, and nothing
healthy appears on it.

**Three of the five cards link to sections that are still placeholders**
(Documents, Media, Graph). That is deliberate and it is honest: the count is
real, the browsing screen is not, and the placeholder says exactly that. It
resolves itself as passes 4, 5 and 7 land.

**The module index now goes to Overview with the flag on**, and still to IoT with
it off — opening a module on "not built yet" is worse than opening it on the part
that works.

#### Pass 4 — Documents & SOPs (done)

`pages/dataFusion/DocumentsPage.jsx`, `pages/dataFusion/DocumentDrawer.jsx`,
`features/dataFusion/documents.js`, the resolver in `fixtures/fusionDocs.js`.

**This pass deleted a duplicate registry, and that is its main result.**
`assetDocuments()` in `lines.js` authored six documents per asset with a
hand-written `via` on each row, and it reused ids — `D-1009`, `D-1012` — that
the Data Fusion registry also carries, under different names and different
owners. Two lists of one collection, and nothing that could notice they
disagreed. That function now calls `resolveDocsForAsset()`, so Asset Detail's
Documents tab and this screen are the same records, and `via` is computed from
where the link sits in the estate rather than typed beside the row. Attaching a
document to a site makes it appear on every machine at that site with nothing
edited on the asset side.

Two consequences worth knowing: `via: 'model'` can no longer occur, because the
registry's links reach the estate's own tiers only; and `via: 'enterprise'` now
can, which the old hand-written list never produced. `mediaCount` on that tab was
pinned to zero with a comment saying the media store did not exist — it does, so
it counts.

**Document type ids were renamed to the vocabulary that tab already used** —
`pid → drawing`, `cert → certificate`, `floorplan → layout` — so the two screens
share one set of labels rather than needing a mapping between them. Owners were
changed from the prototype's cast to the three people this codebase already has.

**Metadata is read, not edited.** The prototype's drawer offers nine text inputs
and a Save button: name, revision, owner, effective date, expiry, language,
source, tags. Every one of those is filed by the system the document came from —
SharePoint, the vendor portal, the CAD vault — and offering them as inputs makes
this screen a second source of truth for facts it does not own. The first thing
to go wrong is somebody correcting a revision here and the vault overwriting it
overnight. The drawer says so in a line rather than leaving it to be discovered
by clicking a field that turns out not to be one.

**One field is this reader's, and it is the only write on the screen:** whether
they have checked the revision. A check asserts the PATCH ignores everything
else — sending `{rev: 'Rev Z'}` leaves the revision alone.

**"Reaches" runs the resolver backwards.** Instead of asking an asset what
applies to it, ask a document what it lands on. It is what makes the scope pill
mean something: "Site" is a word until it is nine named machines, each one a link
into that asset. Three checks pin the three cases — a site SOP reaching only that
site's machines, an unlinked enterprise policy reaching every asset in the
estate, a certificate reaching exactly one — and a fourth asserts the two
directions agree.

**The Usage tab counts four things and omits a fifth.** Assets reached, open
anomalies on them, open work orders on them, and graph edges — all counted from
records this app holds. The prototype's fifth row is "Cited in 14
investigations"; there is no citation record anywhere in this app, and a row that
always reads 14 is worse than a missing row.

**The Preview tab does not claim a render.** The prototype captions its
placeholder "Page 1 of 412 · rendered preview". No file is stored in this build,
so the panel shows the filed type large — on a blueprint grid for drawings, as
the design has it — and says plainly that there is nothing to render.

**A stale index bug was caught here rather than in the field.** `nodeById` was a
`Map` built once at module load, and the bulk-import route appends to
`HIERARCHY_NODES` at runtime — so an imported machine was invisible to the
resolver, the enterprise LOTO policy reached eighteen of nineteen assets, and the
nineteenth showed an empty Documents tab. The index now rebuilds when the estate
grows. Worth remembering as a shape: **any `new Map(FIXTURE.map(...))` at module
scope is a snapshot of a fixture that may be written to.**

**The upload wizard is built** — File → Classify → Link objects → Metadata, on
the same step indicator the bulk-import wizard uses.

One difference from the design, and it removes a contradiction rather than
adding a feature: **scope chooses the picker instead of sitting beside it.** The
prototype asks for a sharing scope on step 2 and then offers every kind of link
target on step 3, so a document can be marked enterprise-wide and attached to one
bodymaker — two fields describing one fact, free to disagree. Here scope is not
stored at all; it is read from the links, and the step 2 choice decides which
tier step 3 lets you pick from. Choose Enterprise and there is nothing to pick,
which is the whole meaning of the word. A check asserts a line upload comes back
with `scope: 'line'` without anything having set it.

**An upload cannot mark itself verified.** No control for it, and the server sets
it false — the same arrangement as `authoredBy` on a work order. Verification
means somebody checked the revision, and the person who just filed it has not.
The new row appears under the Unverified filter, which is correct rather than
unfinished.

**It carries no size and no page count.** The design's wizard sends a fixed
"1.2 MB / 12 pages" for every upload, which is the same wrong number on every row
somebody adds. Nothing here knows a file's size because no file is stored, so
both are null and the register prints the id alone. The Overview's page total
skips them rather than going NaN — checked.

**The dropzone accepts nothing and says so.** One line under it. A dropzone that
swallowed a real PDF and produced a register row with no file behind it is worse
than one that is honest about being a placeholder.

**The OCR checkbox is kept and recorded, not acted on.** It configures a real
product capability, the document stores `ocrRequested`, and the hint says nothing
runs it yet.

**The link picker is served, not imported.** `linkTargets()` comes back with the
list response, so the wizard cannot offer a machine the estate does not have and
grows on its own when somebody adds a line. The prototype's `FUSION_TARGETS` is a
hand-written parallel list of four sites and six assets, none of which are this
estate's.

**The type grid offers all eight types; the chip strip above the table offers
only the ones in use.** Different questions: a chip that filters to nothing
wastes a click, but a form that cannot file the FIRST document of a type is a
worse problem.

#### Pass 5 — Images & 3D Media (done)

`pages/dataFusion/MediaPage.jsx`, `features/dataFusion/media.js`, two routes.

**Its own collection, not a `?kind=` on documents.** The two share a linking
model and nothing else: a photograph has no revision, no page count, no expiry
and nothing to verify. Folding them together would mean a register with four
columns permanently empty for half its rows.

**A grid, not a table**, for the same reason — a document is read by column, a
photograph is looked at.

**No thumbnails, and the design agrees.** No image files are stored, so each
tile shows its type on a panel tinted to that type. The prototype draws exactly
the same thing — an icon on a gradient — so this is fidelity rather than a
compromise, and it avoids the one thing on this screen a reader could not tell
was invented: a stock photograph of a factory. The detail dialog says it in a
line.

**All four chips always show, including a zero.** Unlike the document strip,
which hides types nothing is filed under. Four is short enough that "nobody has
uploaded a thermal capture" is information on a screen about what has been
captured.

**Linking is to machines only.** The document flow has a scope ladder because a
policy really does apply site-wide; a photograph is *of* a machine, and offering
the same ladder would invite somebody to attach a photo to a site and have it
inherit down to every asset there.

**The upload is one step, not four.** The document wizard earns its steps — type,
sharing scope, link tier, eight metadata fields. Media has a name, a kind, what
it is of and who took it.

**A detail dialog rather than a drawer.** A 24rem column beside the grid it came
from is the wrong shape for looking at something. No tabs: media has no revision
history and no usage record to put in a second one.

**`mediaCount` on Asset Detail's Documents tab is now live** — it resolves
through the same registry, so uploading a photo of FDY-BM-03 moves the figure on
that machine's tab.

#### Pass 6 — Contextualisation (done)

`mocks/fixtures/fusionContext.js`, `features/dataFusion/context.js`,
`pages/dataFusion/ContextPage.jsx`.

**It places an object; it does not route a signal.** Accepting a match says
"this tag belongs to that machine" and adds a graph edge. Binding a tag to a
Forge sensor so its readings drive charts and thresholds is the MAPPING table,
which belongs to the connection drawer in pass 2. Keeping them apart is not
tidiness: `CONNECTORS` declares exactly one connector that provides signals and
Sensor Explorer's drawer states that as fact, so a screen that let somebody route
a second source into the sensor catalogue would quietly make that claim false.
Placing a tag on a machine breaks nothing. **This resolves the open question
from pass 1** about where `bound`/`unbound` lands: it does not land here.

**Confidence is computed by matching names, and the checks prove it.** The
prototype writes six rows with confidences of 98, 94, 72, 66, 58 and 41. Here
`suggestFor()` scores the object's own name against the codes in the hierarchy,
in four bands — full compacted code, asset tail, line code, site code — and the
score is the confidence.

The check that makes this worth anything: **every generated tag records which
asset it really came from, the matcher is never given that field, and
`verify:mocks` asserts it recovers it.** If the matcher were reading ground
truth it would pass trivially; if it were guessing it would fail. A second check
asserts a tag with no asset code in it gets *no* suggestion rather than a
low-confidence guess.

**The queue is populated by something that plausibly produced it.**
`src_s3_docs` declares 840 objects under `s3://meridian-plant-docs`; three
documents and one photograph in the registry are marked `pending` and are three
of them. Filenames are what a plant's file share actually looks like — two carry
an asset code, one is `Scanned drawing 2019-114.pdf`, and the photo is
`IMG_4471.jpg`.

**`unplaced` is a fifth scope, and it exists because two records with no links
can mean different things.** Enterprise-wide is a decision; unplaced is the
absence of one, and they are identical from the links alone. `pending` is the
single authored bit that separates them — the only thing about a record's
placement that is authored anywhere.

**Unplaced and unverified are never both.** The Overview's attention list used to
report the three new records as "nobody has verified this revision", which is
true and useless: they need placing, not signing off, and that is a different
screen. `docUnplaced` now points at Contextualisation, `knowledge.unverified`
excludes pending records, and a check asserts nothing appears on the list twice.

**Accepting really writes the link.** Into the same registry the Documents screen
and Asset Detail read, so placing a scanned drawing makes it appear on that
machine's Documents tab. Four checks follow that chain end to end. Without it the
screen would be a list of buttons that change a badge.

**The unmatched cannot be accepted.** No suggestion means no Place button — only
Dismiss. `SPARE_AI_07` and `IMG_4471.jpg` need a person to know what they are,
and offering to confirm a guess the matcher never made would be the worst control
on the screen. A check asserts at least one object defeats the matcher entirely.

**Tags the sensor catalogue already holds are not in the queue.** A channel in
Sensor Explorer has a home by definition; listing it here would be asking for
work already done.

#### Pass 7 — Knowledge Graph (done)

`mocks/fixtures/fusionGraph.js`, `features/dataFusion/graph.js`,
`pages/dataFusion/GraphPage.jsx`.

**One machine's neighbourhood, not the whole estate.** A hundred and ten
entities drawn at once is a hairball — a picture that proves a graph exists and
answers no question about it. The screen picks a machine and draws what the
platform knows about it. The design's own graph is nine nodes for the same
reason; it just gets there by hardcoding nine, where these are read off the
estate. The header still counts the whole thing, so the scale is stated even
though it is not drawn. **Scope agreed with the user:** show enough to convey the
shape, not everything.

**Every edge is a fact another collection already asserts** — the hierarchy, the
signal catalogue, the document resolver, what each source declares it reads, the
work-order board, the anomaly list. Nothing here authors a relationship, which is
what makes Data Overview's relationship count countable at all. Six checks tie
each kind back to its owner, including that the graph and the asset screen report
the same number of open anomalies and the same number of open work orders.

**Every node is a link into the screen that owns it.** That is the test of
whether an edge was real: if it cannot be clicked into, it was decoration.

**Four per kind are drawn, and the legend states the real count.** FDY-BM-03
resolves thirteen documents; four are on the canvas and the legend says
"4 of 13". A graph that quietly shows a third of something is a graph nobody
should trust.

**Positions are computed, not hardcoded, and computed server-side.** The design
carries literal `x`/`y` on its nine nodes, which cannot survive an estate that
changes. A ring, because every edge here shares an origin — radial makes the
focus visually what it already is structurally. Two alternating radii so adjacent
labels do not collide. Checked: deterministic, on-canvas, no two nodes on the
same point.

**Edges in SVG, nodes in HTML on top.** Text in SVG does not wrap, does not take
the app's type scale without being told, and cannot be a router link. Drawing
only the lines in SVG removes all three problems.

**"Ask the graph" goes to the Copilot.** The design's search bar goes nowhere.
There is a Copilot screen now, so it navigates with `?q=` — the same path Home
uses. There is no query engine behind this and a box that returned a canned
paragraph would be the one dishonest thing on the screen.

**The picker opens on the richest machine**, ordered by degree, because a graph
screen that opened on a node with two edges looks broken. The default is DERIVED
from the entity list rather than written by an effect — the synchronous-setState
lint rule this codebase has now tripped over three times.

#### Pass 8 — Pipelines (done)

`mocks/fixtures/fusionPipelines.js`, `features/dataFusion/pipelines.js`,
`pages/dataFusion/PipelinesPage.jsx`.

**A pipeline cannot be running off a source that has stopped.** The rule the
screen exists to make visible, and it is derived: status falls out of the
source's own state. The design leaves "Vision → Quality Events" Active beside a
connection its own table marks Disconnected — the exact disagreement nobody
catches. Here a seventh pipeline reads the ABB 800xA, which is disconnected, so
it comes back **stalled** without anybody authoring that.

**A stall and a failure are told apart**, because they send somebody to different
places. "Waiting on ABB System 800xA" is a connection to fix; "OCR confidence
below threshold" is the pipeline itself. Checked both ways: a stalled row names
its source and reports no error of its own, a failed row names the fault.

**Run clears a failure and never a stall.** Re-running is what clears a
pipeline's own error. It does not clear a stall — the source is still down, and
letting somebody turn a red row green while the connection behind it is
disconnected would teach them to ignore the row. The Run button is not offered on
a stalled pipeline at all, and a check asserts the route refuses too.

**Its source is an id, its target is a route.** The design writes
`src:"Rockwell FT Historian"` as a string, so a pipeline can name a connection
the platform does not have. Here the name is resolved from the registry, and
every target links to a screen that exists — which is the test of whether a
target was real.

**What it moves is counted off the collection it moves.** The document pipeline
carries as many records as there are documents; the historian pipeline as many as
that historian carries tags. The design writes "2,838" beside a connection whose
own row also says 2,838, which is one number in two places waiting to drift.

**Lateness is arithmetic** against the pipeline's own schedule, so a daily job
that last ran three days ago says "overdue" without anybody authoring it.

**No "+ New pipeline" builder.** The design has one — source, target, schedule
and nine transform chips. Unlike an uploaded document, a configured pipeline that
never executes has no observable effect to stand in for the real thing: the row
would appear and then sit there having moved nothing, for ever. It goes in when
there is an execution engine to point it at.

**Pipeline names are untranslated**, like connection names and source names. In
the real product a plant configures and names its own pipelines; the *targets*
are system destinations and are translated.

- **Data Overview** — 5 KPI cards (Connections, Tags streaming, Documents, Media &
  3D, Graph entities), a source-category list with progress bars, a "Needs your
  attention" list, and a 24h ingest-volume chart.
- **OT & Historians / Vision / ERP-MES-CMMS / Databases & Cloud** — each a
  connection table (source, protocol, endpoint, tags, lag, last sync, status,
  Sync/Configure) with search + status + site filters and a pager; a **connection
  drawer** with tabs Connection / Data Contract / {mapping} / {extra} / Activity,
  where the extra tab is Write-back Rules (biz), Device Registry (iot) or ROI &
  Recipes (vision); a **schema-driven mapping modal**; and a **4-step connect
  wizard** (catalogue → config → test with discovery results → scope & schedule).
  Each category has its own ingest contract in `fusion-profiles.jsx` — what it
  provides, what it explicitly does not, its config schema, its mapping columns
  and its wizard step names. That file is the specification; reproduce it.
- **Documents & SOPs** — 12 documents typed (manual, SOP, P&ID, datasheet, cert,
  policy, report, floorplan) with scope (instance / model / site / enterprise),
  link chips, verified flag, upload flow and a document detail viewer.
- **Images & 3D Media** — photo, 3D/CAD, thermal, video.
- **Contextualization** — unlinked objects and the mapping workflow.
- **Knowledge Graph** — entity/relationship counts and a graph view.
- **Pipelines** — pipeline list and builder.

The interesting idea to preserve: **document visibility is inherited down the
asset graph**, and the UI shows the inheritance path (This asset / Model / Site /
Line / Component / Sensor / Enterprise). `resolveAssetDocs()` already implements
it in `fusion-store.jsx`.

### 8.11 AI Copilot — pass 1 done (the screen)

Design source: `screens-copilot.jsx` → `CopilotScreen`. The dock's own spec is
`screens-copilot-dock.jsx` and is **not** built — see below.

`/app/copilot`, demo-gated: the agent-mode rail, a grounded header, prompt cards
on the empty state, the transcript with the design's "Thought process"
disclosure, and the composer.

Files: `pages/copilot/CopilotPage.jsx`, `features/copilot/screen.js`, and the
second half of `mocks/fixtures/copilot.js`.

**Scope was set deliberately narrow by the user: a presentable demo screen with
prompt chips and default answers, not a reply engine.** The decisions below are
what "presentable and honest" cost.

**It answers a prepared set, and the screen says so.** There is no model behind
a fixture, and the two options were prepared answers or a matcher pretending to
more understanding than it has. A line above the transcript states which. An
unmatched question gets a plain miss with the mode's chips offered back — and
the match deliberately does **not** keyword-match, because "compressor"
appearing in a question is not evidence that the compressor answer is the one
wanted, and a confident wrong answer about somebody's plant is worse than a
miss. A check asserts exactly that.

**The figures inside an answer are not prepared.** `copilotAnswers()` is a
function, not a constant, so every number is read at request time from the alert
list, the OEE module and the work-order board. Checks assert the flagship answer
quotes `ALR-4471`'s real reading, threshold, correlation and time-to-trip; that
the OEE answer quotes the published weekly figure; and that the work-order
answer counts the board's own open orders. A prepared answer that went stale
would fail the build.

**Every chip must resolve — including Home's.** A prompt the lookup cannot match
is a chip that falls back on itself, and the chips are the promise the screen
makes. Two checks post them all: the four modes' own, and the nine in
`BRIEFING_SUGGESTIONS` that the home composer sends here. All nine of those
missed at first, so anybody arriving the ordinary way — type in the greeting
box, press send — reached a screen that answered nothing. A third check asserts
no answer prints `null`, `undefined` or `NaN`, which caught an alert with no
time-to-trip rendering as "about null h out".

**`?q=` seeds a question**, which is what finally gave the design's "Ask about
this" somewhere to go. It is now on logbook entry cards and on the anomaly
detail screen — the latter demo-gated and purely additive, since that screen is
the live resource.

**The answer is revealed a few characters at a time.** The design's dock does
this — `setInterval` slicing a string at 45ms — and it earns its place: a reply
that appears whole reads as a lookup, which is exactly what a reader should not
be thinking about while deciding whether to trust it. `useStreamedBlocks` is
where a real streaming endpoint would land, and nothing above it would change.
Two rules it follows: **motion defers**, so under `prefers-reduced-motion` the
whole answer is on the first frame — text arriving under you is text you cannot
re-read; and an **evidence table arrives whole**, because it is a structure
rather than prose and typing one in cell by cell is nonsense. Follow-up chips
wait for the text to finish, so nobody clicks away from a half-read sentence.

**A greeting is answered.** "Hi", "hello there", "good morning" get a hello that
says what the assistant is reading — with the real open-anomaly counts — and
hands over three chips. Recognising a greeting is not the keyword matching this
module refuses to do about facts: a greeting claims nothing, so there is nothing
to get wrong, and answering one with "I can't answer that" is the rudest thing a
demo can do. Sign-offs — "thanks", "ok", "cheers" — are deliberately NOT in that
list; answering one with a greeting reads as an assistant that was not
listening.

**Left out on purpose:** the microphone button (nothing behind it), and the
"Recent conversations" rail — three hardcoded strings in the design with no
store behind them. Nothing persists a thread, so New conversation clears and
that is the whole of it.

**The dock is untouched.** `AssistantDock` still grounds only on an alert and is
still dark everywhere except the anomaly screens. Making it route-aware is a
shell change touching every built screen, so it is pass 2 rather than a
side-effect of this one. A check asserts its thread is still `ALR-4471`'s.

**What pass 2 would add**, from `screens-copilot-dock.jsx` and the parts of
`CopilotScreen` this pass left: the route-grounded dock with per-screen prompts,
and answers composed of **content cards** rather than prose blocks — asset, time
series, anomaly, work order, document quote, and a summary card with follow-up
chips. `ChatThread` renders `text`, `evidence` and `verdict` today; the cards
would be new block types on it, which is why they were not attempted under a
brief that asked for presentable rather than complete.

### 8.12 Executive Dashboard — DONE

Built in two passes. **Pass 1** is the `EnterpriseScreen` build recorded below; **pass
2** rebuilt the screen against `platform/screens-executive.jsx`, which supersedes
it — see the end of this section.

#### Pass 1 — `EnterpriseScreen`

Design source: `screens3.jsx` → `EnterpriseScreen`. Its `ReportsScreen` half is
built separately — see §8.9.

Built in one pass. `/app/executive`, demo-gated: a four-card estate strip, the
site map, site comparison against target, and the AI Executive Brief.

Files: `pages/executive/ExecutivePage.jsx`, `components/forge/WorldMap.jsx`,
`features/executive/queries.js`, `mocks/fixtures/executive.js`.

Six decisions:

**The map is a real map, and it is vector.** `world-atlas` land geometry (ISC,
Natural Earth, public domain) projected by `d3-geo` (ISC) and `topojson-client`
(ISC) — three permissive packages, **no API key and no network call at
runtime**. It renders as SVG, so every fill is a token and light, dark and
colour-blind mode all work. A raster tile map was considered and rejected: a
third-party request on every page load, unthemeable, and `react-leaflet` is
**Hippocratic-2.1**, which is not an OSI licence and does not pass the org's
package-licensing rule.

**Pins are at real coordinates.** `coords` is now on the three site nodes in
`hierarchy.js`, beside `timeZone`, because where a plant is belongs with the
plant. The prototype positions its pins with `left: {s.lat}%; top: {s.lng}%` on
an empty rounded rectangle — a latitude is not a percentage of a width, so its
sites land wherever the arithmetic puts them. A check asserts Findlay comes out
in Ohio.

**The map costs nothing until you open the page.** `ExecutivePage` is lazily
routed and the geometry has its own `worldmap` manual chunk — ~30KB gzipped,
kept out of `vendor`, which every other page downloads. Without that rule the
land outline lands in the shared bundle and the lazy route buys nothing.

**Alert counts are counted.** `SITE_HEALTH` authors an OEE and a health score,
which nothing else computes and which stay authored; its alert counts do not.
Those are read off `ALERTS`, so this screen and the anomaly list cannot report
different numbers for one plant.

**The enterprise OEE is not the plant OEE.** The average across three sites and
the month's published figure answer different questions, and a check asserts
they are different numbers sitting under different labels. Conflating them is
how a board screen comes to contradict the operations screen it links to.

**Downtime exposure is in HOURS.** The design's brief ends "Enterprise downtime
cost $1.2M MTD". Nothing here computes money, and a currency figure needs an
hourly rate that would be invented and then quoted in a boardroom as measured.
`downtimeRiskHours` is on every alert, so the brief reports those and stops. A
check asserts the payload carries no cost field at all.

Also: the brief's clauses are FOUND — top risk is the site carrying the most
critical anomalies rather than simply the lowest scorer, which is the judgement
a board brief exists to make and the one the prototype does not make. And the
board-report CTA raises a real record through the Reports shelf's create path,
so the button and that screen produce one report rather than two ideas of it.

#### Pass 2 — rebuilt against `screens-executive.jsx`

Design source: `platform/screens-executive.jsx` → `EnterpriseScreen`. A much
larger screen for the same route, and it **supersedes pass 1**: the estate map
and the comparison table are now one section of the Performance tab, and the
subject of the screen is money.

Files: `pages/executive/{ExecutivePage,ExecutiveFilterBar,BriefTab,PerformanceTab,SitesTab,RiskTab,RoiTab,parts}.jsx`
and `pages/executive/executiveModel.js`. No fixture, endpoint, mock route or
router change — the route, the query and the payload are pass 1's, untouched.

**Three tabs — the three the design declares.** `brief · financial · roi`, as
**AI Brief · Performance · Forge AI ROI**. The design renders *five* blocks
against those three names: the performance figures, the site cards and league
table, and the risk/opportunity ledgers are three separate blocks all gated on
`tab==="financial"` and stacked one after another. An earlier pass read that as
two tabs the design had forgotten to name and shipped five; the decision is
reversed. The stacking *is* the design's answer to where those sections belong,
and splitting them put the estate map and the money it is about on different
screens. All three now sit under **Performance**, in the design's own render
order: figures, then the estate, then the ledgers and the net position.

`SitesTab.jsx` and `RiskTab.jsx` survive as components — `PerformanceTab`
composes them — because they are large and unrelated to each other, not because
they were ever tabs. The `WorldMap` moves with `SitesTab` and still opens the
Performance tab's section on where the plants are.

`?tab=` accepts `brief | performance | roi`. A bookmarked or hand-typed
`?tab=sites` or `?tab=risk` resolves to **Performance** rather than to an empty
panel or silently to the brief, which does not carry that content.

The design's brief carries a **Review risks** button calling `setTab("risk")` —
a tab it never defines, so it is dead on arrival there. It is kept and pointed
at Performance, where the risk ledger now lives: a real destination rather than
a dead handler.

**Two bugs in the source are not copied.** The `useEffect` lists `period` in its
dependency array four lines *above* the `useState` that declares it — a temporal
dead zone. And `const D = EX_DATA.mtd` reads the only key the object has, so the
MTD/QTD/YTD/R12M pills relabel a caption over one dataset.

**The period and the scope are real parameters.** The period is a month count
that scales every flow figure; the scope narrows the rollup to one plant and the
KPIs, the leakage bars, the traces and the brief all recompute. Picking a site
on the map, on a card or in the league table sets the same parameter, so the map
and the scope select are one control rather than two that disagree.

**Tab, period and scope are the URL** — `?tab=&period=&site=`. All three are
`useState` in the design, so no view of a board screen can be linked or
bookmarked, which is the one screen where that matters most.

**The scope select counts the estate.** "All sites (n)" interpolates `{total}`,
not `{count}` — `count` is i18next's reserved plural key and routes a key with
no plural forms through plural resolution instead of interpolation. The value is
the summary's own `stats.sites`, the same figure the page header prints, so the
two cannot drift.

**Money returns, but not through the transport.** `/v1/executive/summary` still
carries no currency field and `verify:mocks`' "no cost field" assertion from
pass 1 still holds. The commercial overlay is authored in `executiveModel.js`,
in the component layer, per the standing instruction that new demo content is
hardcoded in components — and **every panel that rests on it ends with a demo
notice naming which of its figures are authored**. Operational figures are still
the real rollup: OEE, health, anomaly and work-order counts, downtime hours,
coordinates.

**Two authored numbers do the work.** A site's monthly revenue, and the cost of
an hour of unplanned downtime. Everything else is derived: attainment from
revenue over plan, margin weighted by revenue, downtime cost as measured hours ×
the one rate, units from revenue at a fixed ratio, the leakage total and the
improvement line summed off the bars. The design authors each of these
separately — it prints "93.9% attainment" beside $18.4M and $19.6M, which is
right by luck.

**The ROI card counts itself.** Benefit, net benefit, ROI %, the payback month
and the confidence figure are all reduced off the six streams; the cumulative
curve is the authored shape rescaled so its last point IS the benefit, and the
payback month is read off that curve by interpolation rather than typed beside
it. The before/after table authors the pairs and **derives every change column**
— the design hand-types "−57%", "+47%", "−34 pts". Its OEE row is the real
enterprise rollup and the authored improvement, not the design's 74.9 → 78.4.

**The estate is Meridian's three plants**, not the design's Chennai / Rotterdam /
Detroit — §3. The site the brief, the risk ledger and the net-position paragraph
name is `brief.risk`, found on the server; the design writes "Rotterdam" into
four separate strings. The flag emoji on the site cards are dropped in favour of
the city and country already in the payload.

**The four cost bars are one hue.** The design colours them red / amber / blue /
violet by position in the array — the rainbow `TrendChart` refuses to draw. All
four are the same thing, value leaving the business, so length carries the
comparison and direction gets its own signed column.

**The staged loader is real.** The design animates four stages on a 520 ms timer
whether or not anything is being fetched, and one of them claims to be
"reconciling benefit streams with Finance". This renders only while the rollup
request is genuinely in flight, names what the request actually does, and uses
the existing `RadarSweep`, which honours `prefers-reduced-motion` through the
stylesheet — the design's inline `animation` does not.

**The map stays**, on the Sites tab. The new design drops it; it projects real
coordinates through bundled geometry and is the one thing on this screen that is
not authored, so removing it to match a layout would be the expensive kind of
fidelity.

Also: the twelve-month axes are computed from the clock (the design hardcodes
`["Sep"…"Aug"]`), the data-currency stamp is the query's own `dataUpdatedAt`
(the design prints "20 Aug 06:00" as a literal), and money is formatted through
`Intl` compact currency so the "M" is translated rather than glued on.

### 8.13 Settings — the other 11 pages

Design source: `screens-settings.jsx`, `screens-settings2.jsx`,
`screens-users-teams.jsx`, `screens-roles.jsx`, `screens-siteonboarding.jsx`,
`screens-shift-master.jsx`.

The design's rail is 13 pages in 4 groups: Organization (General, Sites &
Hierarchy, **Shift Master**, **Site Onboarding**, Modules & Plan) · People (Users
& Teams, Roles & Permissions, Security & Access) · Connectivity (Integrations,
Notifications, **API & Webhooks**) · Platform (Audit Log, Billing & Usage).

Ours has Asset Classes, Sources and Assistant instead of the three in bold. Adding
Shift Master, Site Onboarding and API & Webhooks means editing
`pages/settings/SettingsLayout.jsx`.

Highlights per page:
- **Users & Teams** — users tab + teams tab, user drawer, team drawer, MFA column,
  assigned assets, shift assignment, import history.
- **Roles & Permissions** — 10 modules × 34 features, 6 system roles + custom, role
  create/edit drawer with per-module toggles and templates, and a full permission
  matrix modal. System roles are read-only; the path is Duplicate → edit the copy.
- **Security & Access** — SSO (SAML), MFA enforcement, password policy, session
  management with an active-session table, IP allowlist, API security.
- **Notifications** — alert-rule CRUD (condition builder, scope, severity,
  channels), channel cards, a 4-level escalation ladder, digest preferences.
- **Integrations** — 4 categories of connector cards, a 6-step wizard, and a data
  pipeline monitor table.
- **API & Webhooks** — API keys with scopes and rotation, webhooks, OpenAPI links,
  a generate-key flow that reveals the secret once.
- **Audit Log** — filters, table with expandable JSON rows, compliance export.
- **Shift Master** — shift patterns with times, days, grace window, site,
  overlap detection, crew roster assignment, and login auto-detection.
- **Site Onboarding** — 12 sites, 5 stat cards, table with row menu, a 4-step
  onboarding wizard (location → buildings & floors → sensor locations → review), a
  bulk import modal, and a site detail with 4 tabs.
- **General / Modules & Plan / Billing & Usage** — org profile; module toggles by
  plan tier; metered usage (sensor tags, API calls, assistant sessions, storage).

---

## 9. Re-reading the design source

Claude Design project `019e11cf-49a7-744a-b634-e0d248971607`, entry
`Forge AI Platform.html`, which loads 31 `platform/*.jsx` modules.

```
DesignSync { method: "list_files", projectId: "019e11cf-49a7-744a-b634-e0d248971607" }
DesignSync { method: "get_file",  projectId: "…", path: "platform/screens3.jsx" }
```

Large files are written to disk and only previewed in context — read the saved
path rather than re-fetching.

Map of what is where:

| File | Holds |
|---|---|
| `shell.jsx` | Top nav, sidebar, router, role switcher, anomaly banner, Copilot dock, Reports |
| `ui.jsx` | Icon set, Badge, GlassCard, KPI, LineChart, Spark, Ring, ProgressBar, Pager, StateBlock |
| `screens-home.jsx` | Home, AI Synopsis ×3 roles, My Tasks, Shift Handover, handover history |
| `screens-alerts.jsx` | Alerts module, Alert Detail, the 4 analysis sub-tabs, AI Synopsis tab |
| `screens2.jsx` | Anomaly screen v1, Predictive, Copilot v1 (superseded) |
| `screens3.jsx` | RCA, Asset v1, **OEE**, Safety, **Work Orders**, **Enterprise**, Integrations, Admin, Notifications |
| `screens-bodymaker.jsx` | ISA-95 tree, lines list, line detail, station detail |
| `screens-assets.jsx` | Assets module, floor map, filters drawer |
| `screens-asset-detail.jsx` | Asset Detail, 10 tabs |
| `screens-import.jsx` | Bulk import wizard |
| `screens-sensors.jsx` | Sensor Explorer, scope selector, date range |
| `screens-timeseries.jsx` | Timeseries Workstation, panels, catalogue |
| `screens-shifts-logbook.jsx` | Shifts, Logbook |
| `screens-shift-master.jsx` / `shift-master.jsx` | Shift Master UI / patterns store |
| `screens-datafusion.jsx` / `screens-datafusion2.jsx` | Data Fusion shell + connections / docs, media, context, graph, pipelines |
| `fusion-profiles.jsx` / `fusion-store.jsx` | Per-category ingest contracts / registries and inheritance |
| `screens-copilot.jsx` / `screens-copilot-dock.jsx` | Copilot v2 / dock prompts, replies, cards |
| `screens-settings.jsx` / `screens-settings2.jsx` | Settings shell, General, Sites, Modules, Billing / Integrations, Notifications, Security, API, Audit |
| `screens-users-teams.jsx` / `screens-roles.jsx` | Users & Teams / Roles & Permissions |
| `screens-siteonboarding.jsx` | Site Onboarding |
| `screens-workbook.jsx` | Workbook canvas |
| `data.jsx` `plant-data.jsx` `bodymaker-data.jsx` `alerts-data.jsx` | Seed data |

`FORGE_AI_PRODUCT_UNDERSTANDING.md` in this repo is a 1,700-line analysis of the
same prototype — architecture, every screen, the domain model, and a fidelity
audit. Read it before re-fetching source.

---

## 10. Before shipping any of this

`VITE_DEMO_MODE` must be **absent or false** in production. It is a demo
affordance and every figure behind it is authored. `SECURITY.md` and `PRODUCT.md`
both commit this product to never presenting invented numbers as measured; this
flag is the boundary that keeps that true.
