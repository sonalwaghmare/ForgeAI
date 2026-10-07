# Forge AI — Industrial Intelligence Platform
## Complete Product Understanding Document

**Source:** Claude Design project `019e11cf-49a7-744a-b634-e0d248971607`
**Entry point:** `Forge AI Platform.html`
**Scope of this analysis:** the entry HTML + all 31 `platform/*.jsx` modules it loads (32 files total, ~1.05 MB of source)
**Date analysed:** 2026-08-03

---

## Table of contents

1. [What this artefact is](#1-what-this-artefact-is)
2. [Product positioning & value proposition](#2-product-positioning--value-proposition)
3. [Personas and role model](#3-personas-and-role-model)
4. [Technical architecture](#4-technical-architecture)
5. [Design system & visual language](#5-design-system--visual-language)
6. [Accessibility system](#6-accessibility-system)
7. [Information architecture & routing](#7-information-architecture--routing)
8. [The application shell](#8-the-application-shell)
9. [Module deep-dive: Home](#9-module-deep-dive-home)
10. [Module deep-dive: Anomalies / Alerts](#10-module-deep-dive-anomalies--alerts)
11. [Module deep-dive: OEE & Operations](#11-module-deep-dive-oee--operations)
12. [Module deep-dive: Lines & Assets](#12-module-deep-dive-lines--assets)
13. [Module deep-dive: Asset Detail](#13-module-deep-dive-asset-detail)
14. [Module deep-dive: Sensor Explorer & Timeseries Workstation](#14-module-deep-dive-sensor-explorer--timeseries-workstation)
15. [Module deep-dive: Shifts & Logbook](#15-module-deep-dive-shifts--logbook)
16. [Module deep-dive: Work Orders](#16-module-deep-dive-work-orders)
17. [Module deep-dive: Data Fusion](#17-module-deep-dive-data-fusion)
18. [Module deep-dive: AI Copilot](#18-module-deep-dive-ai-copilot)
19. [Module deep-dive: Executive Dashboard & Reports](#19-module-deep-dive-executive-dashboard--reports)
20. [Module deep-dive: Settings & Administration](#20-module-deep-dive-settings--administration)
21. [The AI narrative system](#21-the-ai-narrative-system)
22. [Complete domain data model](#22-complete-domain-data-model)
23. [Seed-data inventory](#23-seed-data-inventory)
24. [Interaction, motion & feedback inventory](#24-interaction-motion--feedback-inventory)
25. [Fidelity audit: dead code, gaps, inconsistencies](#25-fidelity-audit-dead-code-gaps-inconsistencies)
26. [Productionisation notes](#26-productionisation-notes)

---

## 1. What this artefact is

**Forge AI** is a high-fidelity, fully interactive **design prototype** of an industrial AI platform — an "Industrial Intelligence Platform" for discrete and process manufacturing. It is not a production application: there is no backend, no persistence beyond `localStorage` for one accessibility flag, and all data is synthetic and generated in-browser.

However, it is far more than a clickable mockup. It is a **behavioural specification**: routing, filtering, sorting, pagination, CRUD, multi-step wizards, drag-and-drop hierarchy reordering, streaming text simulation, Web Speech API voice briefings, and print stylesheets are all genuinely implemented. Roughly 30 distinct top-level screens and well over 100 sub-views, tabs, drawers and modals exist.

### Runtime shape

```
Forge AI Platform.html
├── <style>          ~250 lines of global CSS (tokens, layout, primitives, print, a11y)
├── React 18.3.1     UMD, development build, from unpkg (SRI-pinned)
├── ReactDOM 18.3.1  UMD, development build
├── @babel/standalone 7.29.0   in-browser JSX transpilation
├── 31 × <script type="text/babel" src="platform/*.jsx">
└── ReactDOM.createRoot(#root).render(<window.ForgeApp />)
```

There is no bundler, no npm dependency, no TypeScript. Every module is a plain script that declares functions/constants and publishes them onto `window`. Cross-module communication is entirely via the `window` global namespace. Google Fonts (`Space Grotesk`, `JetBrains Mono`) are loaded from a CDN.

A `<template id="__bundler_thumbnail">` holds an inline SVG poster frame (hexagonal Forge mark + wordmark on `#0f1115`) used by the design host to generate the project thumbnail.

### Fictional context the prototype is built around

The demo world is a **tin-can / beverage-can manufacturer**. The narrative is unusually consistent for a prototype and is worth internalising, because almost every number in the UI ties back to it:

- **Enterprise:** referred to as *Ball Corporation* in the ISA-95 tree, *Pragmatyc Industrial* in Settings, and *Forge AI* / *Pragmatyc* in branding. (This inconsistency is intentional in places — Pragmatyc is the implied vendor — but see §25.)
- **Marquee site:** **Findlay, OH** — 6 production lines, 1,284 sensors, 30 modelled assets.
- **Marquee line:** **Bodymaker Line 3** — an 8-station can-body line (Cupper → Bodymaker → Trimmer → Washer → Decorator → IBO Oven → Necker → Palletizer), currently **stopped** because the Washer's coolant flow froze at 14:30, starving the four downstream stations.
- **Marquee incident:** progressive **drive-end bearing wear** on a compressor/bodymaker, detected via correlated vibration RMS drift (+0.33 mm/s per hour, 13.7× baseline) and bearing-housing temperature rise (r = 0.87), projecting a trip-threshold breach in **~4.5 hours**.
- **Secondary sites:** Chennai Plant (India, OEE 74.2%, amber), Detroit Assembly (USA, OEE 81.5%, green), Rotterdam Refinery (Netherlands, OEE 68.9%, red — the designated "problem site").
- **Time anchor:** "today" is variously Jun 9 2026, Jun 17–18 2026, and 14:34 IST Shift B. Historical data reaches back to May 2024.

---

## 2. Product positioning & value proposition

Forge AI is positioned as a **unified OT intelligence layer** that sits above existing plant systems rather than replacing them. Its pitch, as expressed by the UI, has five pillars:

### 2.1 Connect everything (Data Fusion)
Ingest from five distinct classes of source, each with its own genuinely different data contract:

| Class | Examples in the prototype | Unit of ingest | Explicitly *not* provided |
|---|---|---|---|
| **OT / SCADA / DCS / Historian** | Siemens SIMATIC S7-1500 (OPC-UA), Rockwell FT Historian (ODBC), OSIsoft PI (PI Web API), Honeywell Experion (OPC-DA), Mitsubishi MELSOFT (Modbus TCP), ABB 800xA | tags / signals | maintenance records, BOM, purchase data |
| **IoT / edge gateways** | MQTT broker (MQTT 5, mTLS), SKF IMx vibration gateway (REST) | topics | control writes — read-only subscription |
| **Business systems** | SAP Plant Maintenance (OData), SAP S/4HANA, Oracle MES, IBM Maximo | records | sensor time-series |
| **Databases & cloud storage** | InfluxDB v2 (28 M series), PostgreSQL asset registry, AWS S3 doc backup | series / tables / prefixes | automatic schema-change adoption |
| **Vision & quality** | ISRA VISION (gRPC), Thermal camera array (RTSP), Cognex In-Sight (REST) | cameras / stations | raw continuous video (edge-retained; only event clips/stills stored) |

### 2.2 Contextualise it (Knowledge Graph)
Raw tags and documents are resolved into a graph of typed entities — Site, Production Line, Asset, Asset Model, Component, Sensor/Tag, Document, Work Order — claimed at **1,240 assets · 2,838 tags · 12 documents · 18,400 relationships**. Document visibility is *inherited* down that graph (see §17.3), which is the single most architecturally interesting idea in the product.

### 2.3 Detect and explain (Anomaly + RCA)
A detector ensemble (Δz-score, CUSUM, Page-Hinkley, Isolation Forest are all named), a **qualification gate** that filters frequent-flyer sensors, an **Analyst LLM** step, and a **verdict** (ACTIONABLE / not) with a Rule-2 cascade heuristic (≥3 sibling sensors anomalous ⇒ real process event, not sensor noise). The full reasoning trace is exposed to the user — this is a deliberate trust-building product decision.

### 2.4 Act (Work Orders + write-back)
AI-drafted work orders with pre-filled parts, skills, duration and a recommended-actions checklist; bi-directional write-back into SAP PM (order creation IW31, status update, confirmation IW41, notification IW21, TECO close, component reservation) governed by per-action toggles.

### 2.5 Brief and decide (Role-adaptive AI Synopsis)
Rather than one dashboard for everyone, Forge AI generates a **conversational daily briefing** whose structure changes by role — SQDCP (Safety, Quality, Delivery, Cost, People) for line managers, safety-first task lists for operators, network risk and capex decisions for executives. This is the product's clearest differentiator versus a conventional BI tool.

### 2.6 Claimed business outcomes visible in the UI
- $3.8 M downtime avoided YTD via predictive maintenance
- $1.2 M enterprise downtime cost MTD, 62% concentrated in 4 critical assets
- 96.4% OTIF service level; 99.1% first-pass yield; 142 days without a safety incident
- 12 failures predicted network-wide in the next 7 days

---

## 3. Personas and role model

There are **two distinct role systems** in the prototype, which is worth understanding because they do not agree with each other.

### 3.1 The demo role switcher (3 roles)
`shell.jsx` defines `ROLES = ["Operator", "Plant Manager", "CXO"]`, exposed through the sidebar footer user chip ("Preview as role"). Switching fires a toast (`Viewing as {role}`) and changes:
- the greeting name and avatar initials — Arjun Mehta (AM) / David Okafor (DO) / James Whitfield (JW)
- **the entire AI Synopsis on Home** (three completely separate hand-written briefings)

| Role | Persona | Synopsis framing | Scorecard pillars |
|---|---|---|---|
| **Operator** | Arjun Mehta — Line Operator, Shift B, Bodymaker Line 3, Chennai | Pre-shift brief: safety first, then handover notes, then my tasks | Safety · Quality · Delivery · My Tasks |
| **Plant Manager** | David Okafor — Line Manager | Tier-1 huddle format; shift handover → safety → game plan → cost → approvals → team delegation → Gemba walk | Safety · Quality · Delivery · Cost · People (SQDCP) |
| **CXO** | James Whitfield — COO | Enterprise brief across 3 sites / 10 lines; network risk, decisions & escalations, realised value | Safety · Network OEE · Downtime $ · Service |

Notably the role switcher does **not** gate any navigation — `NAV` items support an `it.cxo` flag (`g.items.filter(it => !it.cxo || role === "CXO")`) but no item actually sets it, so every role sees every menu item.

### 3.2 The governance role model (6 system + custom roles)
`screens-roles.jsx` defines the "real" RBAC model that Settings exposes:

| Role | Type | Colour | Users | Permission grants |
|---|---|---|---|---|
| Platform Admin | System | `#0A0A0F` | 1 | all 34 features |
| Executive | System | `#BF5AF2` | 2 | 9 — dashboards, OEE, insights, alerts view, copilot |
| Operations Lead | System | `#009E73` | 2 | 16 — alert triage, WO full lifecycle, OEE targets, asset edit |
| Reliability Engineer | System | `#0A84FF` | 3 | 17 — RCA authoring, detector config, bulk import, report building |
| Maintenance Technician | System | `#FF9F0A` | 1 | 9 — field execution: ack alerts, create/close WOs |
| Read Only | System | `#8E8E93` | 1 | all `view`/`use` features only |
| Safety Auditor | **Custom** | `#FF453A` | 0 | 8 — read access + `admin.audit` |

System roles are read-only; the UX path is **Duplicate → edit the copy**. There is also a legacy 6-column matrix (`Admin / Plant Manager / Maint. Engineer / Operator / HSE Manager / Viewer`) in `screens-settings.jsx` that is now dead code (§25).

### 3.3 Named cast (used consistently across modules)
Arjun Mehta (Operator), Sarah Chen (Maintenance Engineer / VP Operations depending on module), David Okafor (Plant Manager), Priya Nair (HSE Manager), James Whitfield (COO), Jim Newman (Reliability), Elena Garcia / Elena Rodriguez, Kenji Tanaka, Marco Rossi, Diane Roberts, J. Marlow (Reliability Eng.), D. Kim (Maintenance Lead / COO), K. Patel (Technician), M. Jha (Shift Lead), K. Ramos, T. Olsen, M. Reddy, Priya Patel (Night-shift Line Manager), Maya Singh, Marcus Patel, Hannah Liu, Aisha Williams, Carlos Mendez, Greg Olsen.

---

## 4. Technical architecture

### 4.1 Load order (matters — later files shadow earlier ones)

```
 1  platform/data.jsx                  core seed data + SERIES generator
 2  platform/bodymaker-data.jsx        BM_STATIONS / BM_MACHINES / BM_SERIES
 3  platform/ui.jsx                    Icon, Badge, GlassCard, KPI, charts, Pager, StateBlock
 4  platform/plant-data.jsx            genSeries, SENSOR_TYPES, ASSET_SENSORS, PROD_*, KB_DOCS, TINCAN_LINES
 5  platform/screens-sensors.jsx       SensorExplorer + ScopeSelector + Dd + DateRange
 6  platform/screens-home.jsx          HomePage, AISynopsis, MyTasks, ShiftHandover*, MyDashboard
 7  platform/screens-shifts-logbook.jsx ShiftsPage, LogbookPage
 8  platform/screens.jsx               Dashboard/OperatorDash/ManagerDash/CxoDash, SiteMap, AIBrief
 9  platform/alerts-data.jsx           ALERTS, SENSOR_META, ALERT_SITES
10  platform/screens-pinned.jsx        PinnedSensors interactive panel
11  platform/screens-copilot-dock.jsx  COPILOT_PROMPTS, copilotReply, CopilotCard, genWave
12  platform/screens-alerts.jsx        AlertsModule, AlertDetail, AnalysisPanel, AISynopsisTab
13  platform/screens2.jsx              AnomalyScreen, PredictiveScreen, CopilotScreen (v1)
14  platform/screens3.jsx              RCAScreen, AssetScreen(v1), OEEScreen, SafetyScreen,
                                       WorkOrderScreen, EnterpriseScreen, IntegrationsScreen,
                                       AdminScreen, NotificationsScreen, SiteMapStandalone
15  platform/screens-bodymaker.jsx     AssetScreen(v2, WINS), ISA_TREE, SiteHierarchy, LinesListScreen,
                                       BodymakerLineDetail, StationDetail
16  platform/screens-assets.jsx        AssetsModule, FA_ASSETS, LINE_META, FloorMap
17  platform/screens-asset-detail.jsx  AssetDetail (10-tab, WINS), OPERATORS/ASSET_OPS store
18  platform/screens-import.jsx        ImportWizard (asset bulk import)
19  platform/screens-settings.jsx      ForgeSettings shell + SettingsKit + General/Sites/Modules/Billing
20  platform/screens-users-teams.jsx   UsersTeamsModule
21  platform/screens-roles.jsx         RolesPermissionsModule
22  platform/screens-settings2.jsx     Integrations/Notifications/Security/Api/Audit settings
23  platform/screens-siteonboarding.jsx SiteOnboardingModule
24  platform/fusion-store.jsx          FUSION_* registries + resolveAssetDocs/Media
25  platform/fusion-profiles.jsx       FUSION_PROFILES — 5 per-category ingest contracts
26  platform/screens-datafusion.jsx    DataFusionModule shell + DFOverview + DFConnections + wizards
27  platform/screens-datafusion2.jsx   DFDocs, DFMedia, DFContext, DFGraph, DFPipes
28  platform/screens-timeseries.jsx    TimeseriesWorkstation, TSCatalog, TSChart, TSPanel
29  platform/screens-copilot.jsx       CopilotScreen (v2, WINS)
30  platform/tweaks-panel.jsx          useTweaks + TweaksPanel + Tweak* controls
31  platform/shell.jsx                 ForgeApp — top nav, sidebar, router, AnomalyBanner, CopilotDock
```

Three deliberate shadowings: `AssetScreen` (bodymaker version wins over screens3), `AssetDetail` (10-tab version wins), `CopilotScreen` (modes version wins). This is the prototype's versioning mechanism — old implementations are left in place rather than deleted.

### 4.2 The `window` contract

Because there are no modules, every shared symbol is a global. The convention is:

- **Data registries** — `SITES`, `ASSETS`, `ANOMALIES`, `PREDICTIONS`, `WORK_ORDERS`, `IOW`, `USERS`, `CONNECTORS`, `SERIES`, `ALERTS`, `SENSOR_META`, `ALERT_SITES`, `SENSOR_TYPES`, `ASSET_SENSORS`, `PROD_METRICS`, `PROD_BATCHES`, `KB_DOCS`, `TINCAN_LINES`, `LINE_MACHINES`, `BM_*`, `FA_ASSETS`, `LINE_META`, `FUSION_*`, `OPERATORS`, `ASSET_OPS`, `ASSET_MODEL_MAP`
- **UI primitives** — `Icon`, `Badge`, `GlassCard`, `KPI`, `LineChart`, `Spark`, `Ring`, `ProgressBar`, `FilterBar`, `PageHead`, `SEV`, `statusTone`, `CopilotBtn`, `Pager`, `StateBlock`, `ForgeMark`, plus re-exported `useState`/`useEffect`/`useRef`
- **Shared kits** — `SettingsKit` (`SCard`, `Field`, `TextIn`, `Sel`, `Toggle`, `ToggleRow`, `BtnGroup`, `StatusBadge`, `modal`), `DF_SLbl`, `DF_selSt`, `DocThumb`, `FusionLinkChips`
- **Helper functions** — `genSeries`, `genWave`, `getSensors`, `resolveAssetDocs`, `resolveAssetMedia`, `fusionAddDoc`, `fusionAddMedia`, `fusionTargetLabel`, `fusionProfile`, `getAssetOps`, `setAssetOps`, `copilotReply`

Note that most files begin with a destructuring line like `const { Icon, Badge, GlassCard } = window;` executed at script-evaluation time — which is why load order is load-bearing.

### 4.3 Imperative cross-module bridges (the "escape hatches")

Rather than prop-drilling or context, the prototype uses a set of imperative globals installed by the shell and called from anywhere:

| Global | Installed by | Purpose |
|---|---|---|
| `__forgeNav(routeId)` | shell | programmatic navigation from any depth |
| `__forgeToast(msg)` | shell | 3 s toast; used by ~20 modules |
| `__forgeCopilot()` / `__forgeOpenCopilot()` | shell | open the right-hand Copilot dock |
| `__openAlertModal(alert?)` | shell | open the full-screen Alert Detail modal (defaults to `ALERTS[0]`) |
| `__forgePendingInvestigate` | AnomalyBanner / Asset Detail | hand an alert id + title to `AlertsModule` on mount |
| `__forgeSeedInvestigate` | AnomalyBanner | seed the Copilot dock with a typed investigation stream |
| `__forgeAutoInvestigate` | AlertsModule | auto-trigger the radar investigation once |
| `__forgeInvestigate` | AlertDetail | expose the "Investigate this anomaly" action to the dock |
| `__forgeInvestigateActive` / `__forgeInvestigateDone` | CopilotDock ↔ AlertDetail | synchronise the radar animation with the streaming text |
| `__forgePostPrompts` | AlertDetail | override the dock's suggested prompts post-investigation |
| `__forgeAnomalyId` | AlertDetail | current anomaly id for the dock's prompt text |
| `__forgeAssetCtx` | AssetDetail | ground the Copilot to the open asset |
| `__forgeAssetPrompt` | AssetSynopsisView | pre-seed a question when a suggestion chip is clicked |

This is a pragmatic prototype pattern and one of the first things a production rewrite would replace (see §26).

### 4.4 State model

All state is React `useState` inside components. There is **no store, no reducer, no URL routing**. Consequences:

- Navigating away from a module discards its local state (filters, sort, selected row, created records).
- Mutations that must survive navigation are written directly onto the `window` registries — `FUSION_DOCS`, `FUSION_MEDIA`, `FUSION_CONNS` (mutated in place, then a `force(n=>n+1)` counter re-renders), and `ASSET_OPS`.
- The single persisted preference is `localStorage["forge_colorblind_mode"]`.
- Tweaks state is persisted **out of the page** via `window.parent.postMessage({type:"__edit_mode_set_keys"})` — the design host rewrites the `/*EDITMODE-BEGIN*/…/*EDITMODE-END*/` JSON block in `shell.jsx` on disk.

### 4.5 Synthetic data generation

Three generators, all sharing the same idea — a sine base plus noise plus injected pathologies:

1. **`series(n, base, amp, opts)`** in `data.jsx` — supports `freq`, `drift`, `spikeAt`, `freezeAt`/`freezeVal`. Produces the six shared `SERIES` traces: `oee` (40 pts), `vib` (60, spike at 0.7), `temp` (60, drift), `flow` (60, freezes to 0.1 after 0.66), `pres` (60), `health` (90).
2. **`genSeries(opts)`** in `plant-data.jsx` — the richest version: adds `sineMix`, `trend`, `driftFrom`, `driftRate`, `spikeAmp`, `dipAt`, `dipAmp`, `clampLo`, `noise`. Rounded to 2 dp.
3. **`ts(n, base, amp, opts)`** in `alerts-data.jsx` — clamped to ≥0, per-alert sensor traces.
4. **`genWave(n, base, amp, opts)`** in `screens-pinned.jsx` (also installed as a fallback in the copilot dock) — simple spike generator used by Asset Detail's Timeseries tab and Copilot chart cards.
5. **`tsGen()`** in `screens-timeseries.jsx` — a bespoke 500-point, 17-day, 4-channel dataset (vibX, vibY, temp, flow) with a coordinated storyline: upward vibration trend from day ~8, thermal drift from day ~11, spike at day ~16, coolant flow collapse to 0.1 at the very end.

Because these use `Math.random()`, **every page load produces slightly different traces** and the 90-day alert-frequency heatmap in Asset Detail is regenerated on each render.

---

## 5. Design system & visual language

### 5.1 Colour tokens

Semantic colours are theme-independent:

| Token | Value | Meaning |
|---|---|---|
| `--blue` | `#F26522` | **primary accent — Forge orange.** The token is named `blue` for historical reasons; it is orange. |
| `--green` | `#30D158` | healthy / ok / connected |
| `--orange` | `#FF9F0A` | warning / high severity |
| `--red` | `#FF453A` | critical / violation |
| `--purple` | `#BF5AF2` | **AI / Copilot.** Reserved exclusively for AI-authored surfaces. |
| medium severity | `#FFD60A` (literal) | medium — the only severity colour *not* tokenised |

Dark theme (`html[data-theme="dark"]`): `--bg #0A0A0F`, `--bg2 #101018`, glass layers as `rgba(255,255,255,0.04–0.10)`, text `#F5F5F7` at 100/62/38% opacity, shadow `0 8px 32px rgba(0,0,0,0.4)`.

Light theme (default, `html[data-theme="light"]`): `--bg #FAF9F7` (warm off-white, not pure white), `--bg2 #F3F1EC`, glass = solid `#FFFFFF`, text `#1A1A1A` at 100/60/40%, shadow `0 1px 2px rgba(0,0,0,0.04)`. **Backdrop-filter is explicitly disabled in light mode** (`html[data-theme="light"] .glass { backdrop-filter: none }`) — a considered performance/legibility decision.

`--rowAlt` provides table zebra striping (`rgba(255,255,255,0.025)` dark, `rgba(0,0,0,0.018)` light).

### 5.2 Typography
- **Display & body:** Space Grotesk (400/500/600/700) — used for everything including headings via `--fh`
- **Monospace:** JetBrains Mono (400/500/600) — IDs, tags, timestamps, endpoints, code
- A global rule forces the mono family onto any element with an inline `monospace` font-family: `[style*="monospace"] { font-family: 'JetBrains Mono' !important }`
- Base 14 px / 1.5. Scale in use: 8.5 → 9 → 9.5 → 10 → 10.5 → 11 → 11.5 → 12 → 12.5 → 13 → 13.5 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 24 → 26 → 27 → 28 px
- `.page-title` 28/600/-0.5 tracking · `.sec-title` 20/600 · `.card-h` 16/600
- Numerals use `font-variant-numeric: tabular-nums` throughout — consistently applied and one of the strongest craft signals in the file
- Eyebrow/label convention: 10 px, weight 700, uppercase, 0.4–0.7 letter-spacing, `--txMut`

### 5.3 Layout primitives

| Class | Role |
|---|---|
| `.app` | 100 vh column flex |
| `.topnav` | full-bleed, min-height 48 px, `z-index 40`, glass, measures itself into `--topnav-h` |
| `.sidebar` | 212 px, collapsible to 60 px, `--glass2` background (overridden to `#FBFBFD` in light) |
| `.main` | flex-1, `overflow-y auto`, `overflow-x hidden` |
| `.page` | `padding: 24px var(--page-pad, 80px)`, `max-width 1700px` |
| `.glass` | background `--glass`, `blur(20px) saturate(180%)`, 1 px `--bd`, `--r` radius, `--shadow` |
| `.glass-sm` | lighter blur (16 px/160%), fixed 6 px radius |

`html, body { overflow: hidden }` — the app never scrolls the document; scrolling is always inside `.main` or a panel.

### 5.4 Component primitives (`ui.jsx`)

- **`Icon`** — 41 hand-drawn inline SVG icons on a 24×24 grid, stroke-based (`strokeWidth` default 1.8, round caps/joins). Names: `home globe bolt crystal brain search gauge factory shield wrench cal box map chart gear users plug bell sun moon eye copilot flower chevL sidebar x expand send s_vib s_temp s_pres s_curr s_hum s_oil s_speed s_aco filter mic plus arrow up down`. The `copilot` icon is a composite hexagonal neural graph (6 outer nodes + spokes + centre) — the product's signature mark.
- **`Badge`** — pill with severity tone from `SEV = { critical, high, medium, low, ok }`, each carrying a colour, a `color-mix` background, and an **accessible shape glyph** (◆ ▲ ● ■ ✓).
- **`GlassCard`** — the universal container; `pad` prop (default 18), `pad={0}` for table cards.
- **`KPI`** — label + icon + big value + sub + optional trend arrow; hover lifts `translateY(-2px)`.
- **`LineChart`** — the workhorse. 600×h viewBox with `preserveAspectRatio: none`; features: 8% headroom auto-domain, 5-line grid, green "normal band" rect, red "anomaly zone" rect + dashed boundary from `anomalyFrom` (0–1), gradient area fill, mouse-tracked crosshair + undistorted HTML hover dot, tooltip with value/unit/x-label (flips side past 70% width), left y-axis tick column with `k` abbreviation, 3-point x-axis label row. Randomised gradient id per instance to avoid `<defs>` collisions.
- **`Spark`** — 100×h polyline, no axes, for table cells and the top-nav OEE trend.
- **`Ring`** — SVG donut with health value in the centre; colour thresholds ≥80 green / ≥60 orange / else red.
- **`ProgressBar`** — `h` prop, min-width 44 px.
- **`FilterBar`** — chip row + right slot.
- **`PageHead`** — title / sub / actions; also renders `CopilotBtn`, **which returns `null`** (§25).
- **`Pager`** — a genuinely complete pagination footer: "Showing X–Y of Z", rows-per-page select (10/25/50/100), first/last + ±1 page numbers with `…` elision, prev/next disabled at bounds. Used on ~20 tables. Purely presentational — it does not slice the rows it sits under.
- **`StateBlock`** — empty / loading / error state with icon, title, body, CTA; loading variant is a spinning ring.
- **`ForgeMark`** — the logo: outer hexagon, inner hexagon, 6 vertex dots, 3 crossing chords, 6 spokes to a white centre core. Hardcoded `#0A84FF` / `#BF5AF2` — it does **not** follow the accent token.

### 5.5 The Tweaks panel (live design controls)

`tweaks-panel.jsx` is a self-contained, reusable design-time control surface (280 px floating glass panel, draggable, viewport-clamped, `z-index 2147483646`). It implements a full host protocol: listens for `__activate_edit_mode` / `__deactivate_edit_mode`, announces `__edit_mode_available` repeatedly for ~4 s to avoid a listener race, posts `__edit_mode_dismissed` on close, and persists every change via `__edit_mode_set_keys`.

Controls: `TweakSlider`, `TweakToggle`, `TweakRadio` (segmented control with pointer-drag scrubbing that auto-degrades to `TweakSelect` past ~16 chars for 2 options / ~10 for 3), `TweakSelect`, `TweakText`, `TweakNumber` (label is a horizontal scrub handle), `TweakColor` (curated swatch chips supporting whole palettes — hero colour left 2/3, up to 4 supporting colours stacked right; checkmark contrast auto-picked by relative luminance), `TweakButton`.

Forge AI exposes eight tweaks:

| Tweak | Default | Effect |
|---|---|---|
| Theme | `light` | `data-theme` attribute |
| Accent | `#F26522` | sets `--blue` (options: purple, orange, blue, green, amber) |
| Density | `regular` | nav item padding 6/8/12 px via `--nav-pad` |
| Corner radius | `6` px | `--r`, range 4–24 |
| Page padding | `56` px | `--page-pad`, range 16–120 |
| Glass blur | `20` px | injects a `#tweak-glass-style` stylesheet rewriting `.glass`/`.glass-sm` backdrop-filter |
| Collapse sidebar | `false` | 212 ↔ 60 px |
| Sidebar shade | `white` | toggles `.sb-light` on `<html>` |

---

## 6. Accessibility system

This is unusually well developed for a prototype and is clearly a deliberate product feature, not an afterthought.

### 6.1 Colour-blind accessible mode
Toggled by an eye icon in the top nav (`aria-pressed`, `role="switch"`, descriptive `aria-label` that flips between "Switch to Standard Color Mode" and "Switch to Color Blind Accessible Mode"). Persisted to `localStorage`. Adds `.colorblind-mode` to `<html>`, which:

1. **Recolours the status palette to the Wong (2011) safe set** — `--red → #D55E00` (vermillion), `--green → #009E73` (bluish green), `--orange → #E69F00` (orange). Because these are tokens, every badge, dot, chart line, border and progress bar recolours automatically.
2. **Reveals shape glyphs on every badge** — `.cb-shape` is `display:none` by default and `inline-block` in colour-blind mode, so severity is encoded redundantly: ◆ critical, ▲ high, ● medium, ■ low, ✓ ok.

The CSS also declares `.cb-stripe-viol` and `.cb-stripe-warn` (45° repeating-linear-gradient hatching for monochromacy safety on IOW/table rows) — but **no component applies those classes**, so row hatching is specified and unshipped.

### 6.2 Reduced motion
```css
@media (prefers-reduced-motion: reduce) {
  .synopsis-sweep, .radar-sweep { animation: pulse 1.4s ease-in-out infinite; }
}
```
Rotating radar sweeps degrade to a gentle opacity pulse. Note this only covers the two radar sweeps — the banner pulse, equaliser bars, and copilot glow pulse are not covered.

### 6.3 Print stylesheet
A real `@media print` block: white background; hide sidebar, top nav, `.no-print`, copilot launchers and toasts; make `.main` visible-overflow; strip glass to a 1 px `#ccc` border on white; zero page padding; **collapse the AI Synopsis two-column grid to single-column at 12 pt**; reveal a hidden `#print-header`. Print buttons exist in Alert Detail (`aria-label="Print anomaly report"`) and the Shift Handover modal.

### 6.4 Other a11y touches
- `aria-live="polite"` on the investigation phase text, the asset-analysis phase text, and the Copilot synopsis loader
- Scrollbars are invisible until hover (`scrollbar-color: transparent` → `var(--bd)` on `:hover`), thin, 6 px, with a `::-webkit-scrollbar-thumb:hover` accent — a nice but arguably discoverability-hostile choice
- Focus states are limited to `.input:focus { border-color: var(--blue) }`; there is no global focus ring, and most interactive surfaces are `<div onClick>` rather than `<button>` — the largest real accessibility gap (§25)

---

## 7. Information architecture & routing

### 7.1 The sidebar (7 groups, 13 items)

```
Overview
  └ Home                    dash        icon: home
Monitor
  ├ Anomalies               anomaly     icon: bolt
  ├ OEE & Operations        oee         icon: gauge
  ├ Lines & Assets          assets      icon: factory
  ├ Sensor Explorer         timeseries  icon: chart
  ├ Shifts                  shifts      icon: cal
  └ Logbook                 logbook     icon: search
Act
  ├ Work Orders             wo          icon: wrench
  └ Data Fusion             datafusion  icon: plug
Agents
  └ AI Copilot              copilot     icon: copilot
Insights
  ├ Executive Dashboard     multisite   icon: map
  └ Analytics & Reports     reports     icon: chart
Admin
  └ Settings                settings    icon: gear
```

The grouping is a verb-based mental model — **Overview → Monitor → Act → Agents → Insights → Admin** — which reads as a deliberate IA decision: sensing before acting, agents as a first-class citizen, insight separate from monitoring.

### 7.2 Full route table

| Route id | Component rendered | Reachable from sidebar | Notes |
|---|---|---|---|
| `dash` | `HomePage` | ✅ | logo click also returns here |
| `anomaly` | `AlertsModule` | ✅ | 13 alerts, list + board |
| `oee` | `OEEScreen` | ✅ | from `screens3.jsx` |
| `assets` | `AssetScreen` (bodymaker v2) | ✅ | passes `subTab="lines"` |
| `timeseries` | `SensorExplorer` | ✅ | drills into `TimeseriesWorkstation` |
| `shifts` | `ShiftsPage` | ✅ | |
| `logbook` | `LogbookPage` | ✅ | |
| `wo` | `WorkOrderScreen` | ✅ | kanban + table |
| `datafusion` | `DataFusionModule` | ✅ | own 11-item side nav |
| `copilot` | `CopilotScreen` (v2) | ✅ | opening it force-closes the dock |
| `multisite` / `enterprise` | `EnterpriseScreen` | ✅ (`multisite`) | `enterprise` reachable from CXO synopsis |
| `reports` | `ReportsScreen` (in shell) | ✅ | |
| `settings` | `ForgeSettings` | ✅ | own 12-item side nav |
| `handovers` | `ShiftHandoversPage` | ❌ | from Home handover card + Shifts "All Handovers" |
| `notifications` | `NotificationsScreen` | ❌ | from the top-nav bell (badge "3") |
| `admin` / `users` | `AdminScreen` | ❌ | **no in-app link exists** — orphaned |
| `integrations` | `IntegrationsScreen` | ❌ | **no in-app link** — superseded by Settings → Integrations |
| `rca` | *falls through to* `Placeholder` | ❌ | **broken link** — `RCAScreen` exists but has no route case; Timeseries Workstation's "View Root Cause Analysis →" and Anomaly Drawer's "Run RCA" both dead-end here |
| `predictive` | — | ❌ | route deliberately commented out: `// case "predictive": hidden — re-enable on request` |
| `safety` | — | ❌ | `SafetyScreen` is defined but never exported to `window` |
| anything else | `Placeholder` | — | `titles` map only knows `schedule` and `parts` |

### 7.3 Navigation depth

The deepest reachable path is five levels:

```
Lines & Assets
 └ Bodymaker Line 3 (rich line detail)
    └ Washer WS-01 (station detail)
       └ Pump Station component
          └ Coolant Flow sensor trace → "Open alert →"
             └ Alert Detail → Analysis → Reasoning → Verdict → Observations
```

Two independent hierarchies coexist:
- **ISA-95 tree** (`screens-bodymaker.jsx`): Enterprise › Region › Country › Area › Site › Building › Floor › Production Line › Asset — 9 levels, drag-reorderable, favouritable, searchable
- **Settings hierarchy** (`screens-settings.jsx`): Enterprise → Region → Site → Line → Asset → Sensor — 6 levels, full CRUD with per-level field schemas

Plus a third, flatter one in the **top-nav location selector**: Enterprise › Region › Site › Production Line (4 levels, 9 nodes).

---

## 8. The application shell

`shell.jsx`'s `ForgeApp` is the root. It owns 8 pieces of state (`route`, `loc`, `locOpen`, `assetSubTab`, `expandedNav`, `role`, `copilotOpen`, `toast`, `alertModal`) plus the tweaks bag.

### 8.1 Top navigation (left → right)

1. **Logo block** — `ForgeMark` (28 px) + "Forge **AI**" wordmark, width matched to the sidebar (212 px, or 60 px collapsed), click → `dash`
2. **Sidebar collapse toggle** — `sidebar` icon, `.tn-collapse` hover
3. **Location selector** — a 240 px-min button showing a globe icon + current scope label + chevron. Opens a **340 px plant-hierarchy dropdown** with:
   - depth-indentation guide lines (one 1 px left-border spacer per depth level)
   - per-level coloured icon chip: Enterprise purple/globe, Region orange-accent/map, Site green/factory, Production Line cyan `#22d3ee`/factory
   - status dot with glow for non-healthy nodes
   - an "N ALERTS" micro-line in orange when `anom > 0`
   - a right-aligned OEE % coloured ≥80 green / ≥70 orange / else red
   - 9 nodes: Enterprise · All Sites (78.4%), Asia Pacific (74.9%), Chennai Plant (74.2%), Line 1 — Compressor (81.5%), Line 3 — Bodymaker (71.0%), North America (81.5%), Detroit Assembly (81.5%), Europe (68.9%), Rotterdam Refinery (68.9%)
4. **Inline KPI strip** — OEE % + 40×20 sparkline, then MTBF, MTTR, and "Anom · 24h" (orange). All four values swap with the selected location. This is the only place MTBF/MTTR appear in the shell.
5. **Spacer**
6. **Shift context chip** — pulsing green dot + "Night Shift · 22:00–06:00" + "Priya Patel · Line Manager". Static — it does not follow the role switcher.
7. **Theme toggle** — sun/moon
8. **Colour-blind mode toggle** — eye, fills with accent when on
9. **Notifications bell** — red badge "3", routes to `notifications`
10. **"Ask ForgeAI" button** — purple→blue gradient, `cp-topbtn` with an infinite 2.4 s `cpPulse` ring that stops on hover; opens the Copilot dock

### 8.2 The live anomaly banner

A severity-coloured strip immediately below the top nav, inside `.main` (so it scrolls with neither the nav nor the page — it is `flexShrink: 0` above the scroll container).

Behaviour:
- Starts with 1 anomaly. At **9 s** a second arrives; at **20 s** a third. Each arrival plays an **880 Hz sine ping** synthesised with the Web Audio API (0.5 s exponential attack/decay envelope, gain 0.12) — wrapped in try/catch for autoplay-policy failures.
- With >1 item it auto-rotates every **5 s**; a dot pager appears (active dot widens 6 → 16 px).
- Left border and background tint follow severity: critical `--red` / `rgba(255,69,58,0.10)`, high `--orange`, medium `#F59E0B`.
- Content: pulsing dot, severity badge, `New anomaly detected · {title}`, then `#{id} · {location} · {tag} · just now`.
- **Investigate** sets `__forgeSeedInvestigate = id`, calls `onInvestigate(a)` (shell sets `__forgePendingInvestigate` then navigates to `anomaly`), and **removes that item from the banner** — dismissing the banner entirely if it was the last.
- **Dismiss (×)** kills the banner permanently for the session.

Seeded items: `ALR-0002` critical "Discharge bearing degradation — ~4.5h to trip" (Bottle Filler · Line 1 · Chennai), `ALR-0041` high "Coolant flow drift — 8% below nominal" (HX-204 · Line 2), `ALR-0055` medium "Motor current imbalance across L1–L3" (CVR-07 · Line 4 · Detroit).

### 8.3 Sidebar

212 px, `overflow: auto`, group labels at 9 px/600/uppercase. Active item styling: `rgba(242,101,34,0.14)` background, accent text, **3 px left border with compensating left padding** so text doesn't shift. Collapsed state (60 px): labels hidden, group headers replaced by 1 px divider rules, items centred, `title` attributes provide tooltips. A hover-revealed collapse chip sits top-right (repositioned to `top:46px; right:17px` when collapsed).

Sidebar footer: **`SidebarUser`** — avatar (blue→purple gradient initials), name, role, chevron; opens an upward "Preview as role" menu with the three roles, each with an icon (`home` / `gauge` / `globe`) and a ✓ on the active one.

The sub-navigation machinery (`it.children`, `expandedNav`, `assetSubTab`) is fully implemented but **no `NAV` item declares children**, so it never renders. A `RoleSwitch` component (top-nav-style pill variant of `SidebarUser`) is likewise defined and unused.

### 8.4 The Copilot dock

A 360 px right-hand panel that animates in via a **width transition** (`0 → 360 px`, `0.55 s cubic-bezier(0.22,1,0.36,1)`) on the flex container — so content reflows rather than being overlaid. `key={route}` forces a fresh conversation on every navigation. Hidden entirely when the full Copilot page is open.

Anatomy: gradient icon chip + "Forge AI Copilot" + "Context: {friendly route name}"; new-chat / expand / close buttons; message list; empty state that names the grounding context and quotes the first two suggested prompts inline; a horizontally-scrolling chip row of route-specific prompts; and a glass input with a primary send button.

**The investigation stream** — the prototype's most choreographed moment. When the dock mounts on `route === "anomaly"` with `__forgeSeedInvestigate` set, it:
1. seeds a user message: `Investigate #{id} and run RCA`
2. **types out a 3-paragraph AI response 4 characters at a time on a 45 ms interval** (~5.7 s for the full ~510-character script), auto-scrolling as it goes
3. sets `__forgeInvestigateActive = true` for the duration, which the Alert Detail radar animation watches so the two stay in lockstep
4. on completion appends a `CopilotCard` of kind `asset` ("Bottle Filler · Line 1 — Discharge bearing — RCA ready — Fault") and calls `__forgeInvestigateDone()`, which flips Alert Detail into its unlocked tabbed state

### 8.5 The global Alert modal

`__openAlertModal(a)` renders a `min(1100px, 96vw)` × `90vh` glass modal containing the **entire `AlertDetail` component** in `embedded` mode, with an "Open in Alerts" escape hatch. Called from: Home operator/manager synopsis buttons, Home Active Alerts feed, Shift Detail anomaly rows, Logbook anomaly chips (both feed and timeline views). Defaults to `ALERTS[0]` when called with no argument.

### 8.6 Toasts

`.toast` — fixed bottom-right, 13 px, glass, 0.25 s fade-in, `z-index 300`, auto-dismiss after 3 s (2.6 s in module-local variants). Used for essentially every mutation across the app.

---

## 9. Module deep-dive: Home

Route `dash` → `HomePage({ role, onNav })`. Custom padding (`32px 80px 44px`, `max-width 1600`) rather than `.page`.

### 9.1 Structure
1. **Centred greeting** — "Good afternoon, {name}" at 27/700
2. **AI prompt box** — 680 px glass card with a 2-row transparent `<textarea>` placeholdered "How can I help?" and a primary send button. Both the send button and the three suggestion chips ("Track equipment downtime", "Identify maintenance gaps", "Review work order status") navigate to `copilot` — **the typed text is discarded**, it is a visual affordance only.
3. **Two-tab switch**, centred, underline-style: **My AI Synopsis** (copilot icon, purple when active) | **My Dashboard** (home icon, accent when active). Defaults to synopsis — a strong statement that the AI briefing *is* the home page.

### 9.2 Tab A — "My AI Synopsis"

An 880 px-max column of chat-style bubbles, each with a 30 px gradient copilot avatar. Internal component vocabulary: `Bubble`, `Card` (optional coloured left border), `Lead` (13.5/1.65 prose), `Hd` (icon + uppercase eyebrow + optional badge), `Item` (dot + text row), `Act` (small button), `RowAct` (dot + text + action button), `ScoreStrip` (the SQDCP pulse tiles — equal-width glass cards with a 2 px coloured top border, icon + uppercase key, big tabular value, coloured caption).

**Operator briefing** (Arjun Mehta):
- ScoreStrip: Safety 0 (142d clean) · Quality 99.1% FPY · Delivery 74% OEE (below target) · My Tasks 4 (2 due this shift)
- *Safety & pre-shift checks* card (green accent, "Acknowledge required" badge) — LOTO verification on BM-03 coming off overnight PM; PPE + guard check on Line 3 conveyor (belt guard opened during Shift A sensor swap) → "Start safety checklist"
- *Handover notes for you* ("From Shift A") — C-12 coolant pressure dip at 02:14 with climbing vibration; belt-tension sensor BTS-220 offline since 02:14 → "View C-12 alert" opens the global alert modal
- *My tasks this shift* — 4 `RowAct` rows: WO-4418 assist C-12 coolant inspection with Sarah C.; field-check BTS-220; record hourly can-count on the Line 3 board; clean & reset Decorator ink-station per SOP-DEC-04
- Sign-off: "Flag anything unusual on C-12 immediately — I'm watching it too. **Stay safe out there.**" plus a disclaimer: *"Always follow site safety procedures and verify isolation before any intervention. · Generated 14:34 IST."*

**Plant/Line Manager briefing** (David Okafor) — the richest of the three, explicitly framed as a Tier-1 huddle:
- ScoreStrip (5 pillars): Safety 0 · Quality 99.1% FPY · Delivery 74.2% OEE (−10.8 gap) · Cost $84k downtime MTD · People 18/20 manning (2 absent)
- *Shift handover summary* — 248,400 cans across Lines 1–4, 2 unplanned stops (47 min), root loss a coolant pressure dip on C-12 at 02:14; 4 mini-tiles: Output 248.4k cans / Downtime 47 min (2 stops) / Avg OEE 71.8% (−2 pts) / Scrap 0.9% (in spec)
- *Safety & compliance* (green, "142 days clean") — guard interlock on Line 3 to verify; hot-work permit for HX-204 needing sign-off
- *Today's game plan* (orange, "Top 3") — (1) C-12 cascade anomaly, AI verdict **ACTIONABLE**; (2) recover the OEE gap, Line 4 is the drag with 3 conveyor stops, target +5 pts; (3) quarterly PM on BM-03, 4-hr window Wed 09:00, checklist 2/12
- *Production & cost watch* — order book needs 2.06 M cans, projected 2.02 M (~40 min behind) unless Line 4 stabilises; downtime ~$84k MTD, 71% from the cooling loop; tiles: Target 2.06M / Projected 2.02M (−40 min) / Power 1.18 kWh/k cans
- *Action items & approvals* — ALR-1024 unacknowledged 1h 55m (breaching SLA); WO-4418 awaiting sign-off; 2× bearing 6205-2RS below reorder point; BTS-220 offline
- *Team & task delegation* — 4 avatar rows (Sarah Chen → C-12 coolant loop / Critical; Kenji Tanaka → BTS-220 field check / High; Diane Roberts → BM-03 PM kit / Medium; Arjun Mehta → hourly can-count / Routine) each with an **Assign** button
- *Suggested Gemba walk* (purple) — "start at the cooling loop (C-12 → HX-204), then Line 4 conveyor"
- Disclaimer: *"Always verify critical operational decisions with your team. · Generated 14:34 IST from live platform data."*

**CXO briefing** (James Whitfield):
- ScoreStrip: Safety 1 recordable/30d · Network OEE 74.9% flat WoW · Downtime $ $1.2M MTD ↑8% · Service 96.4% OTIF
- *Network status & risk* (red, "1 site at risk") — a nested 3-tile site ScoreStrip (Detroit 81.5% on plan / Chennai 74.2% watch / Rotterdam 68.9% at risk) → "Open executive dashboard"
- *Decisions & escalations for you* — Rotterdam capex €240k pump overhaul vs deferred risk, sign-off needed this week; downtime cost up 8% MTD with 62% in 4 assets; 12 failures predicted in 7 days → maintenance capacity check
- *Realized value & wins* (green) — $3.8 M downtime avoided YTD; Detroit's cadence is the template, rollout plan drafted → "Generate board report"
- Close: "**Rotterdam is your one big rock today.**" Disclaimer: *"Figures are platform estimates; confirm financials with Finance before commitment. · Generated 06:00 IST · daily refresh."*

The three briefings share a rhetorical structure worth naming as a design pattern: **greeting → scorecard → what's wrong → what to do → who does it → sign-off → disclaimer.** Every AI surface in the product ends with a human-verification disclaimer.

### 9.3 Tab B — "My Dashboard"

A 2-column layout (`minmax(0,1fr) 340px`) with a toolbar showing "Chennai Plant · Shift B · 14:34 IST" and an "Edit Dashboard" button (non-functional).

**Left column:**
- *Shift KPIs* — a card containing 4 nested KPI cards: Active Anomalies 9 (3 critical, orange) → `anomaly`; Critical Alerts 3 (red) → `anomaly`; Sensors Online 2,838 (99.9%, 2 offline, green); Shift OEE 74.2% (target 85%) → `oee`. Each has an `expand` glyph in the corner.
- *My Tasks* — a real CRUD surface. `TASK_SEED` has 5 tasks (TSK-2025…TSK-2041) with `title`, `asset`, `priority`, `due`, `status`, `assignee`, and a **`from` provenance field** ("AI · Anomaly ALR-1024", "Shift handover", "WO queue", "You delegated", "PM schedule"). Filter chips: Assigned to me / Open / All with live counts. Actions: **New Task**, **Assign** (delegation mode), row click → **Edit**, inline "✓ Done". The `TaskModal` supports title, asset select (6 options), priority, `datetime-local` due, assignee (from `TEAM`), status; in edit mode it also shows context-aware deep links ("View asset →", "Open work order →" if `from` contains "WO", "Open alert →" if `from` contains "Anomaly"). Creating assigns id `TSK-{2042+n}` and toasts "Task created · {assignee} notified".
- *Live Monitoring · Watched Assets* — an auto-advancing carousel (4 s, **pauses on hover**) over 3 assets: Compressor C-12 (Vibration RMS, 42.1 mm/s, red, anomaly region from 0.7), Heat Exchanger HX-204 (Discharge Pressure, 5.6 bar, orange), Turbine T-03 (88% OEE, green). Implemented as a `translateX` on a `width: 300%` flex track with a 0.6 s cubic-bezier. Prev/next buttons plus a widening-dot pager. "streaming" badge.
- *My Assets* — table of `ASSETS` filtered to `site === "chennai"` (4 rows): name, status badge, health progress bar + number, last event (`{openWO} open WO` or —).

**Right column:**
- *Shift Handover* card — shows the last non-Draft handover (SH-0417, Shift A → Shift B, Jun 16, 22:00–06:00, Acknowledged), the executive summary, 4 mini-tiles (OEE handed over 81%, Alerts carried "0C · 2H", Pending actions "1 items", Safety "No incidents"), and two buttons: **View Details** (opens `HandoverReport`) and **Create Handover** (opens `HandoverForm`). An arrow button routes to the full `handovers` page.
- *Active Alerts* feed — `ANOMALIES` filtered to `status !== "Suppressed"` (6 rows), each with a severity-coloured 3 px left border, severity badge, monospace id in accent, timestamp, `{type} · {asset}`, description, and a metadata row (confidence %, duration, owner, status badge). Max height 560 px, scrollable. Click → global alert modal.

### 9.4 Shift Handover sub-system

Three components + one export function, all in `screens-home.jsx`:

- **`HandoverReport`** (modal, 720 px) — Outgoing/Incoming/Window/Plant tiles; Executive Summary; a *Production Performance* table (Cans produced 412,800 = 94% of plan · Avg line speed 1,640 cpm vs target 1,800 · Downtime 38 min, 2 stops · Quality rejects 0.8% within spec); an *Active Alerts Carried Over* table (ALR-1024 Critical coolant flow frozen C-12, Open/investigating; ALR-1019 High vibration spike BM-03, Acknowledged); a numbered *Pending Actions for Next Shift* list (approve WO-4418; re-verify C-12 coolant loop after J14 reseat; monitor BM-03 vibration through the evening run). Footer: Close / **Export** / Edit Handover / **Acknowledge & Accept**.
- **`HandoverForm`** (modal, 680 px) — an explicitly **AI-pre-filled** creation flow. A purple notice reads "Forge AI pre-filled this handover from shift data. Review the draft and add your notes." Outgoing/Incoming selects, `datetime-local` shift end, Plant select; an editable Executive Summary and a read-only Production & Alerts block, both tagged with an **`AI-DRAFTED`** pill; and a free-text "Your Notes & Observations" area placeholdered "…manual observations, verbal instructions, context not captured by sensors…" — a nice articulation of the human-in-the-loop boundary. Footer: Cancel / Export / Save Draft / **Publish Handover** (toasts "{incoming} notified").
- **`exportHandover()`** — genuinely builds a plain-text report from the `HANDOVER` object and triggers a `Blob` download named `ForgeAI_Handover_{date}.txt`.
- **`ShiftHandoversPage`** (route `handovers`) — Back button, page head, 4 stat cards (Total handovers 418 all time · This week 21, 3 per day · Avg OEE handed over 79.4% last 7 shifts · Open pending actions 13), a search input + status select (All/Draft/Acknowledged), a live "{n} reports" count, and a 9-column table over `HANDOVER_HISTORY` (7 rows, SH-0412…SH-0418) with a `Pager`.

---

## 10. Module deep-dive: Anomalies / Alerts

Route `anomaly` → `AlertsModule`. This is the deepest and most carefully built module in the product — `screens-alerts.jsx` is 1,042 lines.

### 10.1 List page

**Header:** "Anomalies" with an inline pulsing green **Live** pill; subtitle "{n} anomalies · All system anomalies across sites"; a date-range button ("Jun 2 – Jun 9, 2026"), Export and Present buttons.

**KPI strip** — 7 clickable cards that act as **status facets** (clicking toggles a filter, indicated by a coloured 3 px left border and a removable "Status: X ✕" chip below the toolbar). The Critical card carries an extra pulsing red dot when count > 0. Cards: Critical (3, red) · Open (6, accent) · Acknowledged (3, `#06B6D4`) · Escalated (1, orange) · Snoozed (2, muted) · Closed (1, green) · Unassigned (4, `#FFD60A`).

**Toolbar:** list/board view segmented toggle; severity chips with counts (All 13 / Critical 3 / High 3 / Medium 5 / Low 2); then three custom `AlertsDd` dropdowns — **Status**, **Assignee** (derived from the data), **Sort** (Severity / Asset name / Site) — and a "Save view" button.

**Bulk selection** — checking rows reveals a glass action bar: "{n} selected", then Acknowledge / Reassign / Escalate / Snooze / Close and a primary "Export selected". All are simulated with toasts.

**List view** — not a table but a stack of full-width cards, each with a severity-coloured left border: checkbox, severity + status badges, an optional purple "Generated by AI" chip (never triggers — no seed record sets `source: "agent"`), a 15 px bold headline `{anomaly type} on {sensor name}`, a breadcrumb line with **accent-coloured clickable line and asset links** that jump to `assets`, then a right-hand block with the monospace `#id`, a "Created" eyebrow and the detection timestamp. Sorting is real (`sevRank` map for severity, `localeCompare` for asset/site).

**Board view** — 5 Kanban columns (Open / Acknowledged / Escalated / Snoozed / Closed) with per-column counts and compact cards (critical cards get a 0.5 px red border).

**Deep-link handling** — on mount, if `__forgePendingInvestigate` is set it matches by `id`, `alertId`, or `assetName === title`, falling back to `ALERTS[0]`; if the caller did not pass `open: true`, it forces `status: "Open"` and sets `__forgeAutoInvestigate`, which makes the detail view run the investigation animation automatically.

### 10.2 Alert Detail — the investigation gate

`AlertDetail` implements a genuinely interesting UX rule: **an Open alert's analysis tabs are locked until an investigation is run.**

- If `status !== "Open"`, `investigated` starts `true` and tabs are available immediately.
- If Open, the page shows only the header banner plus a centred call-to-action: a gradient hexagon icon, "Anomaly detected", and "Run **Investigate anomaly** from the Forge AI Copilot panel to begin root-cause analysis." The Copilot dock is force-opened and given the `__forgeInvestigate` callback, so the action lives *in the assistant*, not in the page — deliberately teaching the assistant as the entry point.
- Running it renders a **150 px radar**: two concentric rings, a `conic-gradient` sweep rotating on a 2.2 s linear loop, a glowing centre dot; below it, four phases advance every 2.2 s with `aria-live="polite"`:
  1. "Investigating anomaly" — *Root-cause analysis in progress — this may take up to 2 min.*
  2. "Analysing root cause" — *Correlating multi-sensor signals and historical failure patterns.*
  3. "Building recommendations" — *Drafting a step-by-step corrective action plan.*
  4. "Preparing work order" — *Assembling parts, scheduling window and required skills.*
- If a Copilot stream is driving the flow, the radar waits for `__forgeInvestigateDone()` rather than its own timer — the two animations are explicitly synchronised.
- After completion, `__forgePostPrompts` replaces the dock's prompt chips with five follow-ups: create a work order, schedule the corrective maintenance, show similar historic incidents, which related sensors are drifting, draft an escalation note for the shift lead.

### 10.3 Alert Detail — header and lifecycle actions

Header banner: severity-coloured left border, severity + status badges, 20 px bold `{anomaly} on {sensor}`, clickable line/asset breadcrumb, and a right block with `#id` and creation date.

Once unlocked, an action row appears: **✓ Acknowledge · ⏱ Snooze · ✕ Dismiss · ↑ Escalate · ✕ Close**, a divider, and **Print**. Each opens the same `ACTIONS`-driven modal:

| Action | New status | Reason field label | Reason options |
|---|---|---|---|
| Acknowledge | Acknowledged | Reason | Reviewing now / Assigning to technician / Monitoring trend |
| Snooze | Snoozed | Snooze duration | 1 / 4 / 8 / 24 hours |
| Dismiss | Closed | Reason | False positive / Planned maintenance / Duplicate / Sensor fault / Other |
| Escalate | Escalated | Escalate to | Shift lead / Reliability engineer / Plant manager / Maintenance team |
| Close | Closed | Resolution | Fixed / resolved / Monitored — no action / Deferred to PM / Work order completed |

The modal states plainly: *"Reason & comments are recorded to the activity log and used to improve AI recommendations"*, and the free-text field is labelled **"Comments (for AI training)"**. Confirming is disabled until a reason chip is picked, then it sets the status (propagating up to the list via the `__setStatus` callback threaded through the alert object) and prepends a real entry to the activity log with a locale-formatted timestamp.

### 10.4 Alert Detail — the three tabs

**Tab 1 · AI Synopsis** (`AISynopsisTab`, default) — a 2-column results view. A brief loader state exists (90 px radar with a `conic-gradient` sweep and "Correlating sensors · querying work-order history · matching prior events") but is bypassed because `hasResult` is hard-wired `|| true`.
- Left: *Description* (the alert's narrative), *Root Cause Analysis* with an "RCA ready" badge and the detector-ensemble paragraph, and *Recommended Actions* — the 5-step plan with a "Create work order from plan →" primary button.
- Right: *Scheduling* (suggested start Wed 12 Jun 09:00, end 13:00, duration 4 hours) and *Required Parts* (1× Bearing 6205-2RS DE, 1× Bearing 6205-2RS NDE, 2× grease cartridge, 1× shaft seal kit).
- Every card has a small arrow button that jumps to the corresponding deeper tab — a nice "summary is an index" pattern. Those buttons carry `.no-print`.

**Tab 2 · Analysis** (`AnalysisPanel`) — a 150 px **vertical** sub-tab rail with four views:

- **RCA** — a summary card (title, "RCA READY" tag, 4 metrics: Confidence 92%, η to trip 4.5 h, Drift rate 0.33 mm/s·h, r² 1.000); a *Description* paragraph; a **Causal Chain** timeline with three typed nodes:
  - `ROOT CAUSE` (red) — Progressive discharge bearing wear; drift 0.33 mm/s·h = 13.7× baseline, matches the January 2026 failure signature
  - `CONTRIBUTING` (orange) — Thermal elevation on bearing housing; 28σ above baseline, peak 83.09 °C, zero recovery samples, accelerating lubricant breakdown
  - `SYMPTOM` (accent) — Cascade across 5 sibling sensors within a 4-hour window
  and a **Supporting Evidence** list where each row names the *tool that produced it* — `calculate_regression`, `get_signal_trends`, `get_failure_history`, `get_logbook_entries`. Exposing tool names is a strong AI-transparency choice.
- **Timeseries** — renders `PinnedSensors` (see 10.5).
- **Correlative** — a hand-built SVG **normalised overlay** (all sensors rescaled to 0–100% of their own range so they can share one axis), with y-axis % gridlines, timeframe-aware x tick labels (1H/6H/24H/7D/30D each with their own 5 labels), a dashed red "Anomaly" marker at 62%, and a per-sensor legend with units. Below it a **correlation matrix** — an n×n grid coloured by strength (>0.8 red, >0.6 orange, else green), with a note naming the strongest pair at r = 0.87.
- **Reasoning** — the AI pipeline trace. A total-duration chip ("46.12s total"), a two-segment proportional timeline bar (62% / 38%), then 5 expandable steps:
  1. **Detection** 19:45:23 — Bearing Temperature fired the lead anomaly (expands to Lead Sensor / Machine)
  2. **Qualification Gate** 19:45:23, 51.14 s — "Passed: frequent flyer — 12 criticals in 5min"
  3. **Analyst LLM** 19:45:28, 40.24 s — "3 iterations · 7 tool calls · 9405 tokens"
  4. **Verdict** 19:45:50 — **ACTIONABLE** (expands to the full verdict paragraph citing *Rule 2 (cascade signature ≥3 siblings)* plus five typed observations: `CASCADE_EVENT`, `DETECTOR_ENSEMBLE`, `SIGNAL_SHAPE`, `HISTORICAL_CONTEXT`, `CURRENT_VALUE_ASSESSMENT` — each with real numbers: baseline mean 54.02 °C ±1.04 over 569 pre-event samples, peak 83.09 °C = 28.0σ, zero recovery samples, 10 prior criticals in 7 days, noise_ratio 0.0, sensor profile 15.17 days old with 527 k training samples, current 55.49 °C within P99 96.6 °C)
  5. **Operator Actions** 19:47:07 — "1 action — latest: escalated"

**Tab 3 · Action** — a 2-column execution view.
- Left: *Recommended Actions* — the 5-step `AN_PLAN` with numbered chips and priority badges (isolate & LOTO the DE bearing / capture triaxial vibration spectrum 1–10 kHz / compare BPFO-BPFI peaks against the Howden signature / replace the DE bearing per manual torque spec / baseline & monitor 48 h post-fix). *Referenced Documents* — 4 typed document tiles (Howden WRVi 321L Service Manual §7.3 p.112, SOP-VIB-04, P&ID Bottle Filler Line 1 Rev C, WO-4471 from Jan 2026) that route to `datafusion`. *Similar Past Anomalies* — 3 records with % match, each opening a modal with the historic resolution text: ALR-3021 (94% — replaced 6205-2RS + seal kit, root cause lubrication starvation from a clogged feed line, resolved in 3.5 h, no recurrence for 5 months), ALR-2740 (81% — coupling re-aligned, soft-foot corrected), ALR-2109 (73% — bearing re-greased, monitored 48 h).
- Right: *Workorder* panel — if none exists, an **AI-recommended schedule** (Priority High, Suggested start Wed 12 Jun 09:00, Est. duration 4 hours, Skills Mech. Fitter L2, Parts 2 bearings + seal kit) with "Create Workorder"; once created, the WO id, status, tech, date and priority with "View Workorder →". The creation modal is fully pre-filled from the alert (title `Inspect {asset} — {anomaly}`, asset+id, site, priority, technician, scheduled date, duration, a generated description quoting the sensor value and threshold), carries an **"AI pre-filled"** pill, offers "Attach sensor trend snapshots as evidence", and embeds the 5-step **Recommended Actions Checklist** as pre-ticked checkboxes.
- *Activity* panel — merged system + user log with avatar chips for humans and a gear icon for system events, plus a comment composer.

An additional **overview** tab exists in the code (severity-escalation sidebar, triggered-anomaly stats with min/avg/max/Δ tiles and an "above threshold +N%" bar, a primary evidence chart with timeframe chips and a 4-item legend, per-sensor evidence cards, and a nearby-assets list) but it is not in the tab list, so it is unreachable.

### 10.5 `PinnedSensors` — the interactive evidence panel

A standalone module (`screens-pinned.jsx`) that is the most control-dense component in the product.

- The alert's own sensors are pinned automatically; the first is badged **ANOMALY SOURCE** with a warm orange border (`#F97316`) while others use cool purple (`#A78BFA`) — a colour system that separates *cause* from *context*.
- A pool of three additional pinnable signals (Ambient Temp, Spindle Speed, Enclosure Humidity) can be added; source sensors cannot be unpinned.
- **Panel-level controls:** collapse/expand, a live count, a global mode toggle (**⏱ Anomaly History** ↔ **← LIVE (n)**) that overrides every card at once, an "+ Add sensor" dropdown that disables when the pool is exhausted, and a full-panel expand that makes the card `position: fixed; inset: 70px 20px 20px`.
- **Per-card controls:** a LIVE/PAUSED pill (green with a pulsing dot / orange when paused), a pause/play glyph, a range chip row whose options *change with mode* — live offers 30 s / 2 m / 5 m / 15 m, event mode adds 1 h / 6 h / 24 h — a custom-range calendar glyph, expand, and unpin.
- In event mode the chart gains a threshold band, an anomaly region from 50%, a dashed vertical "Anomaly" marker at centre, and the footer switches from `−{range} … now` to `−{range} … event … +{range}`.
- Expanding a card opens a 960 px modal with a 400 px chart and the threshold value called out.

---

## 11. Module deep-dive: OEE & Operations

Route `oee` → `OEEScreen` (from `screens3.jsx`). Scoped to "Chennai Plant · today" with Day/Week/Month chips.

- **KPI row:** OEE 74.2% (+1.2 vs yest) · Availability 88% (+0.5) · Performance 92% (−1.1) · Quality 99% (+0.2) — the classic A×P×Q decomposition.
- **OEE Trend** — `LineChart` over `SERIES.oee` with a green normal band `[70, 85]` and A/P/Q toggle chips in the header.
- **Loss Waterfall** — a 5-row horizontal bar cascade: Planned 100 → Unplanned Downtime −12 → Speed Loss −8 → Quality Loss −1 → **Actual OEE 74.2%** (green). Bar widths are computed as `|value| × 4%` for loss rows.
- **Production Lines table** — Line / Status / Current OEE / Target / Gap / Top Loss: Line 1 Compressor 78% (−7, coolant stops) · Line 2 Heat Exchanger 81% (−4, minor speed) · Line 3 Distillation 69% (−16, seal leak) · Line 4 Conveyor **stopped**, 0% (−85, bearing fail).
- **AI Loss Attribution** (`AIBrief`, purple left border) — "Line 4 underperformed due to 3 unplanned stops on Conveyor C-7 (2.3 hrs total). Primary cause: bearing wear — predictive alert active 6 days prior. Recommended: expedite WO-4421." The "6 days prior" detail is the product's core claim in one sentence.

Note this screen uses the *original* three-site fiction (Chennai lines) rather than the Findlay tin-can fiction used by Lines & Assets — the two data worlds do not join up (§25).

---

## 12. Module deep-dive: Lines & Assets

Route `assets` → `AssetScreen` from `screens-bodymaker.jsx`, which is a 4-state machine: **lines list → line detail → station detail → asset detail**, with `AssetsModule` available as an alternate "all assets" tab.

### 12.1 The ISA-95 hierarchy sidebar (`SiteHierarchy`)

A 238 px collapsible tree (collapses to a 44 px rail with vertical "Hierarchy" text). Nine levels: Enterprise (Ball Corporation, "12 sites · 74.9% OEE", 12 alerts) › Region › Country › Area › Site › Building › Floor › Production Line › Asset.

Each node renders: per-depth vertical guide lines, a hover-revealed `⠿` drag handle, an expand chevron, a level-coloured icon chip (Enterprise purple, Region/Country accent, Area cyan, Site green, Building orange, Floor `#FFD60A`, Line accent, Asset dim), the name, a glowing status dot for non-healthy nodes, an "N ALERTS" orange micro-line, and a ☆/★ favourite toggle.

**Drag-and-drop reordering is genuinely implemented** — HTML5 drag events, `findParentArr` to locate the sibling array, and a guard that only permits **same-level** reordering (`if (arr !== tgtArr) return prev`). Visual feedback: dragged node at 0.4 opacity, drop target gets a 2 px top border and a tinted background. Footer legend: "⠿ Drag to reorder · ISA-95".

The tree also drives navigation — selecting the Production Line node `line3` opens the rich line detail.

### 12.2 Lines list (`LinesListScreen`)

Header "Lines & Assets · Findlay, OH · 6 production lines · 1,284 sensors" with Export and **+ Add Line** (a real `LineCreateModal`: name, line type from 6 options, target cans/min, status, site — creating appends to state and toasts).

KPIs: Production Lines 6 · Lines Running 4 (2 stopped · 2 idle) · Active Anomalies 4 · Avg Line Health 86.

Each line is an **accordion card** with a status-coloured left border. Header: rotating chevron, gradient icon tile, name + optional "live" badge + Running/Idle/Stopped badge, monospace `{ID} · {n} assets · {m} machines`, then inline metrics (Health bar+number, OEE, Anomalies badge) and an "Open line →" button. Expanding reveals the line's assets from `FA_ASSETS`, each row showing icon, name, `{id} · {type}`, sensor count, health bar, alert badge, Online/Offline dot — clicking opens Asset Detail directly.

Lines: **Bodymaker Line 3** (8 machines, health 72, OEE 71, critical, *stopped*, 3 anomalies, `rich: true`), Bodymaker Line 4 (7, 91, 86, healthy), Easy-Open End Line 1 (5, 88, 84), Easy-Open End Line 2 (5, 79, 80, warning, 1 anomaly), Auxiliary Line (3, 95, idle), Pilot / Test Line (2, 90, idle).

### 12.3 Bodymaker Line 3 detail (`BodymakerLineDetail`)

Header: "Bodymaker Line 3 · Findlay, OH · Shift B · Operator M. Jha · running since 06:00".

KPIs: Line State **Stopped** (red, "@ Washer · 4m 12s") · Output Today 418k cans (76% of target) · Open Alerts 3 (1 crit · 1 high · 1 med) · Line OEE (24h) 71% (−8 pts vs last shift).

- **Line Throughput · last 30m** — `BM_THROUGHPUT` (the frozen-signal profile × 175) with a `[1800, 2200]` band and an anomaly region from 0.66; axis labels "14:04" → "14:34 · froze at 14:30".
- **Active Alerts on this Line** (`AlertTabsPanel`) — horizontal tabs *per sensor* (Coolant Flow / Vibration X-Axis / Bearing Temp) with severity-coloured underlines and glowing dots. Each shows severity + type + id, a 4-field grid (Machine / Sensor / Since / Duration), a **Detector confidence** progress bar, and Investigate → / Open machine buttons.
- **Material Flow** — the signature visualisation. Eight `StationCard`s in a horizontal scroll separated by `›` chevrons that **grey out when either side is starved**. Each card shows a status dot, a monospace short code (CUP/BM/TRM/WSH/DEC/OVN/NCK/PLT), a `blocked` or `starved` tag, the machine name, cans/min against target with a utilisation bar, and OEE. Anomaly count appears as a glowing corner badge. Starved stations render at 0.6 opacity. Hover lifts the card 3 px.
- **AI constraint callout** (purple) — "**Washer is the constraint.** Coolant flow froze at 14:30 — 4 downstream stations now starved. Decorator → Palletizer have ~6 min of buffer before the halt cascades upstream." → "Open Washer →". This single card communicates line-level cascade reasoning better than any table.

### 12.4 Station detail (`StationDetail`)

For stations with a modelled component tree (Bodymaker, Washer): header with vendor/model/install date/run hours/next service, status + criticality + sensor-count badges, and a health `Ring`. KPIs: Throughput, OEE, Anomalies, Run Hours (with next-PM sub-label, red if overdue).

Layout: a **Components** list (status dot, name, vendor+model, sensor count) driving a grid of **sensor cards** on the right. Each sensor card shows a status dot, name, monospace tag + normal band, the current value in status colour, a `LineChart` banded to the normal range with an anomaly region, and — when anomalous — a badge reading "Spike · 94%" / "Drift · 72%" / "Frozen · 88%" plus "Open alert →".

Below, an **AI Health Summary** with station-specific text: for the Washer, "Coolant flow froze abruptly while discharge pressure held nominal — points to a flow-meter fault or supply stoppage, not pump failure. Matches Apr-28 J14 wiring resolution at 91% similarity." For others, the bearing-wear narrative.

Stations without a component model get a graceful fallback card. Note that `StationDetail` is largely bypassed in practice: `AssetScreen` first tries to resolve the station id against `FA_ASSETS` and prefers the 10-tab `AssetDetail` when it matches.

### 12.5 `AssetsModule` — the flat asset explorer

`screens-assets.jsx` provides the alternate view over all 30 `FA_ASSETS`.

**StatBar** (5 cards) — Total Assets (with "across N lines"), **Online · Offline** (split bar), **Health Distribution** (average number + a 3-segment good/watch/critical bar + "N good · N watch · N critical"), **Open Alerts** (with crit/high sub-badges), Open Workorders.

**Filter bar** — a list/map view toggle; quick chips All / Critical / Has Alerts / Offline; "All Types ▾"; a **More Filters** drawer; removable active-filter chips; a search box (id or name); Sort and Columns chips. Below it, a dedicated **Line** chip row with per-line asset counts.

**List view** — 10 columns: checkbox, Asset (icon + name + monospace id + up to 2 tag pills), Type, Line (only when unfiltered), **Sensors** (a row of small icon chips, one per installed sensor type), Stream (Online dot with glow / Offline), Health (bar + coloured number), Open Alerts (badge with "N crit/high/med"), Last Seen, Owner. `Pager` footer.

**Floor map view** — a floor selector strip (Floor 1 / Floor 2 / Mezzanine, each with a line count) plus a hint line, then a **lane diagram**: one rounded lane per line on that floor, with a blue→purple gradient material-flow track and evenly-spaced 34 px asset stations along it. Asset dots are bordered in severity colour, **pulse when they have alerts**, and carry a monospace id label. Zoom controls (70–130% in 10% steps, CSS `transform: scale`) and a fullscreen button. Hovering a station shows a fixed bottom-centre tooltip card with name, id, type, line, online state, health bar and alert badge. Clicking a lane opens the line; clicking a station opens the asset. A right-hand 210 px **"Lines on this floor"** panel summarises each lane as `{n}C {n}H {n}M {n} off` badges or "all normal".

**More Filters drawer** (380 px) — Site, Production Line, Installed Sensor selects; Criticality / Stream Status / Open Alerts chip groups; Workorder, Owner, Tag selects; a **Next PM** date range; Clear / Apply.

Floor/building mapping: Floor 1 = Building A — Can Body (Bodymaker Lines 3 & 4); Floor 2 = Building B — Ends (Easy-Open End Lines 1 & 2); Floor 3 = Mechanical Mezzanine (Auxiliary/Utilities, Pilot/Test).

---

## 13. Module deep-dive: Asset Detail

`screens-asset-detail.jsx` (1,014 lines) — the single richest screen. Reached from Assets list, floor map, line accordion, or the hierarchy tree.

### 13.1 Header and the two-mode switch

Header card: a 44 px type-coloured tile with a 3-letter abbreviation (`TYPE_ABBR` maps 19 types → CMP, CNV, MOT, FAN, PMP, GBX, PRS, BMK, CUP, TRM, WSH, DEC, OVN, NCK, PLT, CRL, LNR, INS, TST; `TYPE_COLOR` gives 11 of them bespoke colours); the name with a monospace `— {id}`; a computed status badge (Offline / Maintenance if health < 50 / Running); a metadata row with type, maker, a derived serial `SN {id-without-dashes}-A`, criticality badge, "SLA 4h", and owner; and a 52 px health `Ring` with a text verdict (HEALTH GOOD ≥75 / WATCH ≥50 / CRITICAL).

Below it, a two-button switch: **AI Synopsis** (purple gradient when active) | **Detailed view** (accent when active). On mount the component sets `__forgeAssetCtx` and force-opens the Copilot dock — the asset page always arrives with the assistant already grounded.

### 13.2 AI Synopsis view

**Opening loader** — a per-asset 2.5 s analysis animation: a 120 px three-ring radar with a rotating conic sweep and a glowing gradient hexagon core, "Analyzing {asset name}", and four phases cycling every 620 ms with a dot progress indicator:
1. "Connecting to {n} live sensor streams…"
2. "Scanning 2,838 readings across the last 24 hours…"
3. "Cross-referencing alerts, work orders & maintenance history…"
4. "Composing your asset briefing…"

**Voice briefing** — a genuinely implemented Web Speech API feature. A right-aligned "Play briefing" pill expands into a 420 px player: a gradient play/pause button, a title that changes to "Briefing you now…", **four animated equaliser bars** (`.eq-bar`, 0.7 s height animation, staggered 0.12 s delays), a progress bar, and a `{n}s / 55s` counter. A 120 ms interval drives visible progress independently of the speech engine so the UI animates even if `speechSynthesis` is unavailable; `SpeechSynthesisUtterance` at rate 1.02 speaks a ~1,700-character script that narrates health, the urgent bearing finding, open anomalies, 24 h status history, OEE/availability, the vibration trend, and the downtime Pareto. Cleanup cancels speech on unmount and on asset change.

**Briefing card** (purple left border) — "Forge AI · Asset Briefing / Live analysis · updated just now", a Needs attention / Stable badge, and one of two hand-written conversational paragraphs. The urgent variant: *"Hi — I've just finished analyzing {asset}. It's running right now at a health score of {health}/100. Here's what needs your attention: the drive-end bearing is showing a rising vibration trend at 0.33 mm/s·h (13.7× baseline) with a correlated temperature climb — I'm projecting a trip-threshold breach in ~4.5 hours. I'd get a bearing inspection scheduled right away."* Followed by three context-sensitive suggestion chips that pre-seed the Copilot (urgent: "Why is vibration rising?", "Create inspection WO", "Show similar past failures"; healthy: "Summarize this week", "Any upcoming maintenance?", "How does it compare to peers?").

**`SecInsight` pattern** — a recurring device where a plain-language AI observation sits *outside and above* a card in normal body type with a small purple copilot icon, e.g. *"Three anomalies are open — the discharge-bearing degradation is the one to action now; the other two can wait."* and *"OEE is running ~5 points below target — availability is the main drag, not speed or quality."* This is one of the strongest ideas in the whole design: the AI narrates the chart rather than living in a separate panel.

**Sections:** ⚠ Anomalies Needing Attention (3 rows: critical discharge bearing degradation ~4.5 h to trip / high coolant flow drift 8% below nominal / medium motor current imbalance L1–L3, each deep-linking into the Alerts module with `__forgePendingInvestigate`); Performance · last 30 days (OEE 66.0% −4.8, Availability 91.2% +1.1, Runtime 18.4 h, MTBF 246 h −11.6); an **OEE Trend `HoverChart`** whose hover tooltip includes an **AI-generated reason per data point** ("Above target — clean run, minimal micro-stops this window." / "Slight dip — 2 short speed-loss events on the filler." / "Below target — unplanned downtime from bearing trip drove availability loss."); and a full-width "At a glance" strip (Open alerts 3, Open WOs 3, Sensors online n/n, Next PM 14 days, Operating hours 50,378 h).

### 13.3 Detailed view — 10 tabs

| Tab | Contents |
|---|---|
| **Overview** | Performance KPIs (OEE 66.0, Uptime 98.07%, MTBF 246 hr, MTTR 2.5 hr, each with a delta); `StatusTimeline`; Signal Trend with a sensor selector; Downtime Pareto; 3D Preview + Tree View; Assets parent/root/path/children tabs; Active alerts triage table; live Vibration telemetry card; **90-day alert-frequency heatmap** (13 weeks × 7 days, GitHub-style, 6 intensity levels, with 178 total / peak day 4 on 13 Mar / 70 active days / 11 in last 7d and a Less→More legend). Sidebar: Assigned Operators, Identity, Sensors/Connected devices, Timeline, and an **AI Copilot suggests** card ("Likely root cause: belt-tension sensor offline since 02:14. Current vibration pattern matches the 'loose belt → drive misalignment' cluster." · 87% confidence) |
| **Timeseries** | One card per installed sensor, built from a `SMAP` of six sensor archetypes (Bearing Temperature 62±18 thr 80, Vibration RMS 8±5 thr 12.5, Discharge Pressure 4.2±0.8 thr 5.5, Motor Current 42±8 thr 60, Coolant Flow 30±6 thr 18, Speed/RPM 1650±90 thr 1900). Each shows anomaly label, current value, a banded chart, and a threshold call-out; expand opens a 400 px modal with timeframe chips |
| **Alert History** | 4 tiles (Alerts 90d 18 ▲8, Avg TTA 12 min ▼3, Avg TTR 3.1 h ▲0.4, **False-positive rate 14% ▼4 pts**), an all-alerts table with source (Fusion / Telemetry / Camera) and resolution, plus sidebar breakdowns: Top failure modes 90d (Vibration/belt slip 44%, Motor temp high 22%, PPE missing (CV) 13%, Foreign object 9%, Other 12%) and By source (Telemetry 72% / Camera 28%) |
| **Workorders** | Open (3) / Scheduled (2) / Completed (14) chips; open WO table; Parts used YTD (Bearing 6205-2RS ×4, Belt 1750mm ×2, IR sensor module ×1); **Cost YTD $12,840** (−4% vs prior yr, parts $7,210 · labor $5,630) |
| **Telemetry** | Channel chips from `getSensors(asset.id)`; a large banded chart; MIN/AVG/MAX/NOW tiles computed from the actual series; sidebar "All channels (n)" list with status dots and live values |
| **Documents & SOPs** | **Resolved from Data Fusion** via `resolveAssetDocs` — see §17.3. Type filter chips with counts, an "Any source / Via {scope}" select, search, and a table whose **"Applies via"** column shows a coloured inheritance chip (This asset / Model / Site / Line / Component / Sensor / Enterprise) plus a "shared ×N" hint. Below it a Media grid. Upload and detail flows are `DFDocUploadBridge` / `DFDocDetailBridge` — the asset page reuses the Data Fusion components, with the scope radio pre-labelled from the asset's own model/site ("All Stolle BM-90 (Bodymaker)", "Site — Findlay, OH") |
| **Maintenance** | Next PM card (Wed 12 May 2026 09:00, "in 14 days", 4-hour window, D. Kim · Maintenance Lead, Quarterly · Standard PM-Q) with Reschedule / Reassign / View checklist; a 31-day **PM calendar** with 3 typed events (Down event red day 8, Sensor cali… blue day 15, PM-Q orange day 26); and a **12-step inspection checklist** with per-step durations totalling 99 min, 2 of 12 complete, completed items struck through |
| **Components / BOM** | An indented BOM tree with per-component health bars (uses `BM_MACHINES.bodymaker.components` when the asset is a Bodymaker, otherwise a generic 6-node tree), plus **Spare parts · reorder points** (Bearing 6205-2RS: 2 on hand vs reorder 4 → "Low" + Reorder button; Belt 1750mm: 0 on hand vs 2 → "Out") |
| **AI Insights** | *Predicted failure window* — "Likely failure between **Mar 14 – Mar 21** if drive bearing temperature continues current trend", 87% confidence, with a green→amber→orange→red gradient risk bar spanning Today → +30d; *Anomaly clusters* (Loose belt → drive misalignment 87%, Bearing fatigue 62%, Sensor drift 41%); *Model · last retrained* — "Vibration-fusion v4.1 · Retrained Jan 8 · 12,402 samples · F1 0.91 · This asset contributed 438 samples (3.5%)". Naming the model version, sample count, F1 score and this asset's contribution share is an excellent MLOps-transparency touch |
| **Audit Log** | All Actors / User / System chips, Export CSV, and a 6-event feed distinguishing human actors (normal weight) from system actors (italic, dimmed) with IP addresses where applicable |

### 13.4 `StatusTimeline` — the utilisation Gantt

A 3-mode (24h / 7d / 30d) stacked utilisation view. A combined bar concatenates all segments proportionally, then per-category tracks show Running / Machine Idle / Unplanned Downtime (or Planned Maint. in 30d mode) as absolutely-positioned segments with percentage pills. Clicking a category row **isolates** it (others fade to 0.4); hovering a segment shows a positioned tooltip with the exact window and cause ("09:20→09:42 · bearing trip", "17:25→17:40 · coolant"). Splits: 24h 70/22/8 · 7d 82/12/6 · 30d 88/7/5.

### 13.5 Operator assignment store

A small shared store: `window.OPERATORS` (8 people with roles and initials), `window.ASSET_OPS` (assetId → operatorId[]), with `getAssetOps` defaulting BM-03 and C-12 to `[j_marlow, d_kim]` and everything else to `[k_patel]`. Two UIs write to it — the **Assigned Operators card** on Asset Detail and the **Assigned Assets card** on User Detail — so assignment is genuinely bidirectional across modules.

---

## 14. Module deep-dive: Sensor Explorer & Timeseries Workstation

### 14.1 Sensor Explorer (route `timeseries`)

Header: "Sensor Explorer · Live multi-sensor timeseries · {n} of {m} channels on {asset}" with a **+ New Chart** button.

Three custom controls built for this module and reused elsewhere:

- **`ScopeSelector`** — a 320 px hierarchy-scope dropdown over `HIER_TREE` (All Locations 7 → Asia Pacific 3 → Chennai Plant 3 amber; Europe 1 → Rotterdam 1 red; North America 3 → Detroit 3 green). Independently expandable branches with ▾/▸ chevrons, depth indentation, status dots, and count pills that turn red for critical branches.
- **`Dd`** — a themed dropdown that avoids native OS select rendering entirely: 34 px trigger, glass menu, optional colour swatch per option, a ✓-style arrow on the active row.
- **`DateRange`** — a **hand-built calendar** (no library): month navigation, correct leading blanks from `new Date(y, m, 1).getDay()`, correct day count from `new Date(y, m+1, 0).getDate()`, two-click range selection with automatic ordering, in-range tinting and solid edge days, Clear / Done. Opens on June 2026.

Control rows: scope selector | divider | date range | a pill-group timeframe switch (1H / 6H / 24H / 7D / 30D) | "⟳ streaming · updated 1s ago". Then a filter row: a severity pill group (All / Critical / Warning / Normal), a sensor-type `Dd` with colour swatches, an asset `Dd` (all / BM-03 / WS-01 / C-12), a "More filters" glass button, and a search box. Active filters surface as removable chips plus "Clear all".

**Chart grid** — 2 columns, one card per sensor channel: a tinted type icon, label + channel, monospace `{id} · normal {lo}–{hi} {unit}`, the current value in status colour with the unit, a status badge, a full `LineChart` with the normal band and an anomaly region (0.66 for violations, 0.5 for warnings), and a footer reading "last {tf} · click to open in Workstation →" plus the band restated. Empty state offers "Clear filters".

**New Chart modal** — title, chart type chips (Line / Area / Scatter / Bar), and a scrollable multi-select signal list with colour swatches and current values, showing "{n} selected"; create is disabled with zero signals.

**More filters drawer** (400 px) — Site, Production Line (from `TINCAN_LINES`), Asset, Sensor Type selects; Alert State and Stream status segmented groups; **Source system** select (Any / SCADA·PLC / OSIsoft PI / MQTT·IoT / MES·ERP) — a nice acknowledgement that provenance is a filter dimension.

### 14.2 Timeseries Workstation ("Trends Studio")

Reached by clicking any Sensor Explorer card, or via its own catalogue.

- **Catalogue (`TSCatalog`)** — "Timeseries Workstation / Trends Studio — monitor, analyze & correlate sensor trends across 2,838 sensors" and a 2-column grid of 8 saved charts with sensor counts, authors and dates; the current one is outlined and badged.
- **Focus banner** — when arrived from Sensor Explorer: "← Back to Sensor Explorer" plus "Focused on **{sensor id}** · {label} · {asset}".
- **Breadcrumb** — "Chennai Plant › Line 2 (Filling) › Compressor C-12".
- **Toolbar** — 4 glyph tool buttons (⊞ ∿ ↕ ≡), a date-range chip "2024-05-20 → 2024-06-06", a Granularity select (1h / 5m / 15m / 4h / 1d), an Actions select (Export CSV / Export PNG / Share link / Add to Dashboard), a second row of period chips with 7d active, and a green **LIVE** indicator.
- **`TSChart`** — a bespoke 1000×360 dual-axis SVG over the 500-point `TS` dataset. Left axis 0–80 mm/s, right axis 0–120 (°C / L/min). Features: gridlines; a shaded **maintenance window** rect (May 25–26); two dashed threshold lines (40 mm/s red, 85 °C purple); four toggleable polylines drawn back-to-front so vibX sits on top; and three **triangular anomaly markers** at the top edge (orange for the vibration spike at 94.5%, red for the flow freeze at 98.5%, purple for the thermal drift onset at 65%). Axis unit labels are absolutely positioned; the x-axis reads May 20 / May 25 / May 30 / Jun 3 / Jun 6.
- **Right tool rail** — 5 square toggle buttons: Alerts, History, Correlation, Statistics, Export. Each renders an inline `TSPanel`:
  - *Statistics* — a real stats table (VIB-C12-X min 24.1 max 42.0 mean 38.4 σ 4.2 P95 41.8; VIB-C12-Y 19.4/36.0/31.2/3.8/35.4; TEMP-C12-BRG 52.0/78.6/62.4/6.1/77.2; FT-C12-001 0.0/103.4/42.1/38.6/99.8)
  - *Correlation* — Coolant Flow vs Bearing Temp **r = −0.87** (strong negative); Vibration X vs Bearing Temp r = 0.72 (moderate positive)
  - *Alerts* — the three configured rules on this chart
  - *History* / *Export* — descriptive placeholders
- **Forge AI Insight banner** (purple, dismissible) — "Coolant flow loss (TAG-FT-C12-001 → 0 L/min) strongly correlates with bearing temperature rise (**r = −0.87**). This pattern precedes bearing failure by 4–8 hours in similar compressors. Recommend immediate inspection of the cooling circuit." with "View Root Cause Analysis →" (which dead-ends, §25) and "Create Work Order →".
- **Series table** — 12 columns: colour swatch, an **eye toggle that actually shows/hides the trace**, name, Good/Bad status badge, monospace tag, description, min/max/mean/unit, a **P&ID chip** (`CAN-LINE-1-PID-001 ▾`) linking the signal to its drawing, and delete/info glyphs. Note `FT-C12-001` has status **Bad** and mean 0.0 — the frozen sensor is correctly represented as a data-quality problem, not just a low reading.

---

## 15. Module deep-dive: Shifts & Logbook

### 15.1 Shifts (route `shifts`)

Header "Shifts · Chennai Plant · week of Jun 16–22, 2026", with **All Handovers** and **+ New Shift** buttons. `ShiftCreateModal` collects type / date / operator (required) / line.

Data: 21 shifts generated as 7 days × 3 types. `SHIFT_TYPES` = Morning `#0A84FF` 06:00–14:00, Afternoon `#FF9F0A` 14:00–22:00, Night `#5E5CE6` 22:00–06:00. Each shift carries id (SH-320…SH-340), day, type, operator (round-robin over 6 names), OEE (`72 + ((di*3 + ti*5) % 20)`), anomalies, downtime (`anomalies*14 + ti*6`), WOs, and status (first 2 days Completed, Wed Morning **Active**, rest Scheduled).

Two tabs: **AI Synopsis** (default) and **Schedule**.

**AI Synopsis tab** — three narrated blocks, each introduced by a purple copilot line:
- *"Forge AI is briefing you on this week's shifts"* → a computed paragraph: "Across the week, **21 shifts** ran at an average **{n}% OEE**. The **{type} shift on {day}** was the roughest with **{n} anomalies** — mostly on the C-12 coolant loop. The currently **active {type} shift** ({operator}) is holding {n}% OEE with {n} open anomalies. {n} work orders were raised this week and {n} minutes of downtime logged." All figures are derived from the data, not hardcoded.
- *"Here's where your attention matters most"* → three action cards: **Carryover anomalies** ("Open items crossing shift boundaries — confirm they're handed over, not dropped"), **Active shift** (with an "End shift & handover →" button), **OEE dip** (identifies the worst day and jumps to it in the schedule).
- *"OEE has been recovering since Wednesday's dip"* → a 21-point OEE-by-shift `LineChart` with an `[80,100]` target band and day labels.

**Schedule tab** — KPI strip (Avg OEE wk, Anomalies, Work orders, Downtime), a Calendar/List toggle, and three filter selects (type / status / operator) with a Clear filters button and a "{n} of 21 shifts" count.
- *Calendar view* — a 7-column week grid, min-width 620 px with horizontal scroll, each cell holding that day's shift blocks. Blocks are type-tinted, invert to solid when selected, lift 1 px on hover, and show type, time range, an initials avatar + first name, "OEE {n}%" and a red "{n}⚠" pill.
- *Shift detail panel* (right) — type + time-range pill + status badge, operator avatar row, a 4-tile metric grid, an "Anomalies this shift" list (synthesised from the count, cycling Coolant flow drop C-12 / Vibration spike BM-03 / Bearing temp rise HX-204, each opening the global alert modal), and an **AI Handover Summary** card whose text adapts to the shift's numbers and ends with "Carry over the open C-12 coolant alert and confirm bearing spares" or "No carryover items." Buttons: **End Shift & Handover** (active shifts) or View Handover, plus Logbook.
- *`ShiftHandoverModal`* — an AI-GENERATED SUMMARY block, a 4-row metrics list (Anomalies detected / Actions taken / Pending items "2 carryover" / End OEE), and **Print** (`window.print()`) + Complete Handover.

### 15.2 Logbook (route `logbook`)

"Logbook · Operator observations · **AI-indexed for investigations**". Feed / Timeline toggle and **+ New Entry**.

Search across text, operator and tags; when a query is present a **"semantic search"** indicator with a purple copilot icon appears next to the box — signalling that this is embedding-based retrieval, not substring matching (the implementation is `includes()`, but the intent is stated). An equipment filter select is provided.

Six entries with authentic operator voice, e.g. *"Filler running rough at 02:14 — vibration noted on Cell 3. Replaced bearing 6205 last month, may need re-grease. Check ISO-VG46 levels next shift."* Each carries operator, time, shift, free text, `#tags`, an optional linked anomaly id, and an `ai` flag.

Entries flagged `ai` show a purple **"AI Analyzed"** pill whose tooltip reads *"Referenced by Forge AI Investigator — Evidence Trail"* — this closes the loop with the RCA evidence list, which cites `get_logbook_entries` and quotes exactly this Cell-3 note. Linked anomalies render as clickable `↳ ALR-1024` chips. Every entry has an **"Ask about this"** button routing to the Copilot.

New-entry composer: a free-form textarea placeholdered "Free-form observation…", an equipment select, a `#tags` input, and Submit → toast *"Entry saved & indexed for AI search"*.

Timeline view: a vertical rail with shift-coloured nodes, time + date + operator, red anomaly pills, and the note text.

---

## 16. Module deep-dive: Work Orders

Route `wo` → `WorkOrderScreen` (`screens3.jsx`). Subtitle computes "{n} open · {n} AI-generated".

**Lifecycle** — 6 states with an explicit forward map:
```
Draft → Pending Approval → Approved → In Progress → Completed
On Hold → In Progress
Completed → (terminal)
```

**Kanban view** — one column per state with counts, "Empty" dashed placeholders, and compact cards showing monospace id, priority badge, title, asset, an "AI" badge for AI-sourced orders, due date, and a **"Move → {next state}"** button that advances the order in place (with `stopPropagation` so it doesn't open the detail).

**Table view** — 8 columns: WO #, Title, Asset, Priority, Assignee, Due, Source (AI badge or "Manual"), Status. With a `Pager`.

**Detail modal** — priority + status + "AI-generated" badges, a 4-field grid (Asset / Assignee / Due / Source), an "Advance to {next} →" primary button, and Delete / Close / Edit in the footer.

**Form modal** — Title (required, >2 chars), Asset (required), Priority, Assignee (from `WO_TECHS`: S. Chen, A. Mehta, K. Tanaka, M. Rossi, Unassigned), Due date, Status, Source. New orders get a random id `WO-{4400 + rand(580)}`.

**Empty state** — a `StateBlock`: "No work orders yet — Create a work order manually, or they'll appear here when the AI engine recommends maintenance actions."

Seed data: 7 orders, **4 of them AI-sourced** (WO-4421 replace CVR-07 drive-end bearing / Critical / In Progress; WO-4418 inspect C-12 coolant loop / High / Approved; WO-4410 R-01 seal replacement / High / Draft / unassigned; plus WO-4415 quarterly PM HX-204, WO-4402 calibrate PRES-089, WO-4395 T-03 air filter, WO-4390 lubricate CP-101 bearings).

---

## 17. Module deep-dive: Data Fusion

Route `datafusion` → `DataFusionModule`. A module-within-a-module with its own 222 px side navigation in five groups:

```
Overview   · Data Overview
Live Data  · OT & Historians · IoT & Sensors · Vision Systems
Systems    · ERP / MES / CMMS · Databases & Cloud
Knowledge  · Documents & SOPs (12) · Images & 3D Media (4)
Fusion     · Contextualization · Knowledge Graph · Pipelines
```

Counts on the Documents and Media items are live from the registries.

### 17.1 Data Overview

Five clickable KPI cards: Connections **14/18** (2 need attention) · Tags streaming 11.4k (28M points/day) · Documents 12 (2 unverified) · Media & 3D 4 (48 MB CAD indexed) · Graph entities 18.4k.

*Source categories* list — one row per category with a tinted icon chip, "{ok} of {n} connected", a completion progress bar (green only at 100%) and an arrow: OT · SCADA/PLC/Historian (4/6), IoT · Edge/Sensor Gateways (2/2), Business · ERP/MES/CMMS (3/4), Databases & Cloud Storage (3/3), Vision & Quality Systems (2/3).

*Needs your attention* — four routed items: ABB System 800xA disconnected (TLS handshake failed · 2d), "{n} documents unverified", "{n} document not linked", Cognex In-Sight syncing.

*Ingest volume · 24h* chart with "Peak 1.4M events/hr · avg lag 0.6s".

### 17.2 Connections (one page per category)

Header derives live stats: "{n} sources · {n} connected · {n} tags mapped". Filters: search (name or protocol), status select, site select. Table: Source, Protocol, Endpoint (monospace), Tags, Lag, Last sync, Status badge, and inline **Sync** / **Configure** actions. Disconnected rows get a red 2 px left border. **Sync is animated** — it sets the row to Syncing, then flips to Connected with "just now" after 1.6 s, toasting at both ends.

**Connection detail drawer** (620 px) — tabs are **profile-driven**, so each category shows a different set:

| Tab | Content |
|---|---|
| **Connection** | The category's full config schema rendered from `FUSION_PROFILES[cat].config` — text, select, toggle, file-upload and textarea field types. Error banner when `c.err` is set. Save / Test / Delete. |
| **Data Contract** | ✓-listed "What this source provides", an orange **"Not provided ·"** exclusion statement, and 4 tiles (Object type, Mapped {unit}, Ingest latency, Last sync) |
| *(profile-specific mapping tab)* | Named per category — see 17.4 |
| **Write-back Rules** (biz only) | 6 toggleable SAP actions with their transaction codes, plus a footer naming the service user `FORGE_SVC`, authorisation object `M_ORDER_WRK`, and the last write |
| **Device Registry** (iot only) | Device ID / Model / Firmware / Battery / RSSI / Last seen — with low battery in red (IMX-0051 at 17%) |
| **ROI & Recipes** (vision only) | A dark canvas with three labelled inspection regions drawn as amber rectangles (ROI-1 Seam, ROI-2 Rim, ROI-3 Body) plus a recipe list with confidence thresholds and active/standby state |
| **Activity** | 5 timestamped log rows including "New object discovered" whose text adapts to the category |

**Connect wizard** — 4 steps whose *labels come from the profile*: OT gets `Connector → Endpoint & security → Test & browse → Tag discovery`; IoT `→ Broker & security → Test subscribe → Payload & device map`; Business `→ Service & auth → Test & discover entities → Entity selection & mapping`; DB `→ Connection & auth → Test & introspect → Query & mapping`; Vision `→ Stream & API → Test frame grab → Station & event routing`.
- Step 1: a contract summary line plus a catalogue grid — 8 OT vendors, 7 IoT, 7 business, 7 DB, 5 vision, each with its protocol.
- Step 2: display name + the first 8 config fields.
- Step 3: a real test simulation (1.4 s) with category-specific copy ("Opens a session and browses the address space" / "Validates auth then lists available entity sets" / "Grabs a single frame and reads the active recipe" / "Connects then introspects schema"), then a success panel showing **discovery results**: OT "847 browsable nodes · 612 analog, 235 digital"; IoT "38 active devices"; Business "9 OData entity sets · 12,480 records"; DB "14 measurements / 6 tables · retention 90d"; Vision "6 cameras online · 3 inspection programs" — each with a sample object list.
- Step 4: category-specific finalisation — Business gets **entity-set checkboxes with their Forge mappings** (`Equipment master (EQUI) → Forge Assets`, `Functional locations (IFLOT) → Production Lines`, `Maintenance orders (AUFK/AFVC) → Work Orders`, `Notifications (QMEL) → Alerts`, `Maintenance plans (MPLA) → PM Schedule`, `Material & stock (MARA/MARD) → Spare Parts`) plus a write-back mode select; Vision gets line/asset binding and event-class routing; DB gets an editable Flux query, a join key, and a backfill window; OT/IoT get scope selects, an auto-map rule, and a **"Queue unmatched {tags} for manual contextualization"** checkbox that hands off to the Contextualization page. All then choose a sync schedule.
- Continue is disabled at step 3 until the test passes.

### 17.3 Documents & the inheritance model — the key architectural idea

Every document has a **`scope`** and a list of **`links`** to typed objects:

| Scope | Meaning | Example |
|---|---|---|
| `instance` | This object only | as-built P&IDs, commissioning reports, calibration certificates |
| `model` | Every instance of an asset model | OEM manuals, datasheets |
| `site` | All matching assets at a site | local SOPs, floor plans |
| `enterprise` | Company-wide | HSE policies, ISO standards, SDS |

`ASSET_MODEL_MAP` gives each asset its `{ model, site, line, components[], sensors[] }`. `resolveAssetDocs(assetId)` then walks every document and returns the first matching inheritance path, tagging the result with a **`via`** label and colour:

```
enterprise            → "Enterprise"  #8A8F98
link.asset  == id     → "This asset"  #0A84FF
link.model  == model  → "Model"       #BF5AF2
link.site   == site   → "Site"        #009E73
link.line   == line   → "Line"        #22d3ee
link.component ∈ comps→ "Component"   #F59E0B
link.sensor ∈ sensors → "Sensor"      #F26522
```

The Asset Detail Documents tab surfaces that `via` chip on every row, so a user always knows *why* a document is visible on this asset — one upload, many contexts, with the provenance made explicit. `resolveAssetMedia` does the same for media (asset / model / line / sensor links only).

**Documents page** — type-summary chips with counts; filters for scope, linked-object kind (including **"Not linked"**), and verified state; List and Cards views; a table with document thumbnail, id/size/pages, type, scope chip + "{n} assets" reuse count, link chips, revision, date, owner, and Verified/Unverified badge.

**Upload wizard** (4 steps: File → Classify → Link objects → Metadata):
- *File* — dropzone (PDF/DOCX/DWG/XLSX up to 200 MB), name, and a checkbox: **"Run OCR + entity extraction on upload — Extracts tag numbers and asset names so the document can be auto-suggested for linking."**
- *Classify* — 8 document types as a card grid; then the 4 sharing scopes as radio cards, each with an explanatory line.
- *Link objects* — if OCR was enabled, a purple **"Suggested from OCR"** row offers pre-scored matches (`stolle-bm90` 96%, `BM-03` 88%, `de-bearing` 74%); below, chip pickers for all six target kinds. Advancing requires at least one link unless scope is enterprise. Explains: *"It will then appear automatically in those objects' Documents tab and be used by the Copilot when reasoning about them."*
- *Metadata* — revision, owner, effective date, expiry, language (EN/DE/ES/FR/JA/HI), tags; plus a Summary block ending "Will be indexed for Copilot retrieval and appear in {n} object Document tabs."

**Document detail drawer** (580 px, 4 tabs): *Metadata* (editable fields + scope select, Save / Upload new revision / Delete); *Linked objects* (chip pickers plus a live **"Resolves to N assets"** panel listing the affected assets — a genuinely useful impact preview; saving also marks the document verified); *Preview* (blueprint-grid background for P&IDs and floor plans); *Usage* (Copilot grounding "cited in 14 investigations", Anomaly RCA references, work-order attachments, knowledge-graph edges, plus a revision history).

### 17.4 Per-category mapping semantics

This is where the product demonstrates that "connectors" are not interchangeable:

| Category | Mapping title | Columns |
|---|---|---|
| OT | **Tag Mapping** | Source tag (OPC node id) · Signal · Unit · Scale/offset · Deadband · Sensor · Asset |
| IoT | **Topic & Payload Mapping** | Topic pattern · JSON path · Device ID · Signal · Unit · Sensor · Asset |
| Business | **Entity & Field Mapping** | Source entity · Source field · Forge object · Forge field · Transform |
| DB | **Query → Object Mapping** | Measurement/table · Field/column · Data type · Forge target · Bound object |
| Vision | **Camera & Event Mapping** | Camera/station · Inspection program · Event class · Forge target · Line/Asset |

The business mapping is the most detailed, with real SAP table/field names and transforms: `EQUI.EQUNR → Asset.externalId` (trim leading zeros), `EQUI.TPLNR → Asset.parentLine` (lookup → Line), `IFLOT.TPLNR → Production Line.externalId`, `AUFK.AUFNR → Work Order.id` (prefix WO-), `AFVC.LTXA1 → Work Order.taskDescription`, `QMEL.QMNUM → Alert.externalRef`, `QMEL.QMCOD → Alert.damageCode` (code table QM), `MARA/MARD.MATNR/LABST → Spare Part.partNo/onHand`, `MPLA.WARPL → Maintenance Plan.id`.

The mapping editor modal renders a **different form schema per category**, with object-picker selects populated from `FUSION_TARGETS`.

### 17.5 Contextualization

"{n} items awaiting linkage · confirm or correct AI-suggested matches to keep the graph accurate". Six pending matches spanning Documents, Tags and Images, each with a suggested target, a confidence score (98% / 94% / 72% / 66% / 58% / 41%) colour-graded green ≥90 / orange ≥60 / red, and **Accept / Reject / Re-link** actions. Stat cards for Pending / Accepted / Rejected / Avg confidence. A **"↻ Re-run auto-match"** button shows a progress card ("OCR · tag pattern matching · fuzzy name resolution") and then **auto-accepts only ≥90% matches** — a well-judged human-in-the-loop threshold.

### 17.6 Knowledge Graph

"1,240 assets · 2,838 tags · 12 documents · 18,400 relationships — everything the Copilot reasons over."

A natural-language bar: *"Ask the graph — e.g. which documents cover Compressor C-12?"*. Then a 420 px force-graph-style canvas: an SVG edge layer plus absolutely-positioned nodes whose **shape encodes type** (circle for asset/sensor/site/WO, rounded-square for documents, hexagon-ish for models) and whose size distinguishes assets (34 px) from everything else (26 px). Nine nodes, nine typed edges with labels: `measured by`, `is model`, `documented by`, `as-built`, `located at`, `maintained by`. Clicking a node opens an inspector showing type, edge count, and each relationship as "· {relation} → {target}"; assets get an "Open asset →" button. A type legend runs along the bottom.

### 17.7 Pipelines

Six pipelines with source → target, record counts, schedule, last run and status: OT Live → Knowledge Graph (Active, real-time, 2,838); SAP PM → Work Orders (Active, every 30m, 4,820); Documents → Vector Index (Active, on upload, live count); **P&ID Contextualization → Knowledge Graph (Failed — "OCR confidence below threshold")**; Vision → Quality Events (Active, real-time, 1,200/min); CAD → 3D Model Store (Paused, weekly). Inline **Run** and **Pause/Resume** actually mutate state.

**Pipeline builder** — name, a source select drawn from the live connection list, a target select (Knowledge Graph / Asset Registry / Work Orders / Quality Events / OEE Dashboard / Anomaly Engine / Copilot Retrieval / 3D Model Store), a **transform-step chip multi-select** (Filter, Deduplicate, Unit convert, Resample, Threshold flag, Join on tag, Aggregate, OCR + extract, Entity match), and a schedule.

### 17.8 Media

Four items across four types (Asset Photo, 3D Model/CAD, Thermal Capture, Inspection Video), each with type-specific card gradients (3D dark indigo, thermal dark orange) and link chips. Upload requires at least one object link — media is never orphaned.

---

## 18. Module deep-dive: AI Copilot

### 18.1 The full-page Copilot (route `copilot`, `screens-copilot.jsx`)

A three-pane layout. Opening this route **closes the dock** so the two never coexist.

**Left rail (234 px)** — "+ New conversation", then an **Agent mode** selector — four specialist modes, each with its own icon, description and prompt set:

| Mode | Icon | Description | Sample prompts |
|---|---|---|---|
| Data Exploration | search | Find assets, tags, documents & time series | "Show me the 1st stage compressor details" · "List assets with health below 70" · "Find the SOP for coolant flow faults" |
| **Troubleshooting** (default) | wrench | Diagnose issues & build cause maps | "Why is there an anomaly on Compressor C-12?" · "Build a cause map for the vibration spike" · "What failed on Conveyor CVR-07?" |
| Maintenance | cal | Summarise & draft work orders | "Summarise open work orders on Line 3" · "Create a work order for C-12 bearing" · "Which assets have overdue PMs?" |
| Alerts & Anomalies | bolt | Explain & correlate alerts | "Summarise critical alerts this week" · "Which asset has the most alerts?" · "Explain the frozen flow alert on C-12" |

Below it a "Recent" list (C-12 vibration root cause / Line 3 handover / Rotterdam health review).

**Header** — gradient icon, "AI Copilot", "Grounded · Compressor C-12 | Assets", a green **"platform data"** badge, and Export chat.

**Empty state** — "Hello! I'm grounded to {context}." / "Ask me anything — **I only use data already in your Forge AI platform**." plus a 2×2 prompt grid for the active mode.

**Answer composition** (`composeAnswer`) — mode-driven card assembly rather than free text:
- A negative case is handled explicitly: asking about "lab result" or "vendor invoice" returns *"I couldn't find that in the platform for your organisation. Lab results aren't currently ingested — you can add them via **Data Fusion → Sources**, then I'll be able to reference them."* This is the single best design decision in the Copilot — it models honest retrieval failure and routes the user to the fix.
- Otherwise it emits typed cards inside a `CardFrame` whose eyebrow states the provenance:
  - `Asset · platform record` — a compact asset card with a type tile, name, location, Fault badge, and "Open asset →" / "View P&ID"
  - `Time series · TAG-VIB-C12-X` — a real banded chart with "42.1 (thr 30)" and "Anomaly flagged 14:30 · normal band 15–30 mm/s"
  - `Anomaly · detected by platform` — severity badge, detection time, contributing tags, confidence, **two mini sparklines side by side** (coolant flow, vibration), and "Investigate →"
  - `Work order · platform record` — id, priority, status, title, assignee/due, "auto-created from alert"
  - `Document · SOP-CL-12 v3.2` — an actual **italic block quote** from the SOP: *"On frozen flow signal, verify pump seal integrity before restarting. Check J14 connector for moisture ingress…"*
  - `Summary · synthesised from platform data` — the synthesis paragraph with bolded tag names, a "⟳ Data last updated 2 min ago" freshness stamp, and follow-up chips
- Per-mode composition: *explore* → asset + timeseries; *trouble* → anomaly + timeseries + document + summary; *maint* → work order + summary; *alerts* → anomaly + summary.

**"Thought process" toggle** — every AI message can expand a reasoning trace listing the platform sources queried:
```
1. Resolved page context → asset C-12
2. Queried asset API · time-series API (TAG-VIB-C12-X)
3. Traversed graph → linked anomaly #0002, WO-4418, SOP-CL-12
4. Composed grounded answer with citations
```

A persistent footer disclaimer reads "Always verify critical operational decisions with your team."

### 18.2 The dock's reply engine (`screens-copilot-dock.jsx`)

A separate, simpler intent router used by the side dock. `copilotReply(route, q)` regex-matches the query in priority order and returns `{ text, card }`:

| Intent pattern | Response |
|---|---|
| `work order\|wo\|create` + `create` | Drafts WO-4530 "Inspect Compressor C-12 — bearing temp", High, Unassigned, due Jun 12 |
| `work order\|wo` | "3 open work orders due this week" + WO-4521 Critical bearing replacement |
| `health\|bm-03\|bodymaker\|asset\|below\|c-12\|compressor` | Asset card: Bodymaker BM-03, Findlay OH, health 62, Watch, Bearing Temp 55.5 °C |
| `oee\|production\|loss` | "Line 4 OEE fell to 66% — driven by 2.3h of unplanned downtime on Conveyor CVR-07" + a 7-day chart card (66%, −4.8%) |
| `anomaly\|alert\|bearing\|temperature\|critical\|unassigned` | "confirmed cascade event — 5 sibling sensors anomalous (Rule 2). Fusion confidence 92%" + a threshold chart (83.1 °C, +28σ) |
| `connector\|pipeline\|tag\|fusion\|streaming` | "18 of 22 connectors are healthy. 2 are failing (Siemens SCADA, Cognex). 9,996 tags streaming live." + a 3-stat card |
| `risk\|attention\|top\|summar` | A ranked risk list: CVR-07 bearing failure (predicted 3d), C-12 coolant fault (active alert), Line 4 OEE −4.8% |
| `handover\|note\|shift` | A copy-able draft note + "Send to Teams" |
| `iow\|safety\|compliance\|breach` | "1 IOW breach today: discharge pressure on HX-204 exceeded the high limit at 13:50. Compliance score 91%." |
| fallback | A generic summary invitation |

`CopilotCard` renders six card kinds — `chart` (with optional threshold band and anomaly region), `wo`, `asset`, `list`, `stats`, `note` (with Copy / Send to Teams).

**Route-scoped prompt sets** (`COPILOT_PROMPTS`) exist for `dash`, `anomaly`, `oee`, `assets`, `wo`, `safety`, `datafusion`, plus a `__default` triple ("Summarize this page" / "What needs my attention?" / "Draft a shift handover note"). The dock picks `__forgePostPrompts` first, then the route set, then the default — so prompts are contextual and can be overridden by the current workflow state.

Note the dock's connector figures (18 of 22, 9,996 tags) do **not** match the Data Fusion registry (14 of 18, 11.4k tags) — see §25.

---

## 19. Module deep-dive: Executive Dashboard & Reports

### 19.1 Executive Dashboard (route `multisite` / `enterprise`)

`EnterpriseScreen` — "Enterprise Operations · Multi-site intelligence" with a "Board Report →" button.

- **`SiteMapStandalone`** — a 260 px map surface with absolutely-positioned status pulses at each site's `lat`/`lng` percentages (which are layout coordinates, not real geography), each with a 5 px halo ring and a label "{flag} {name} · {oee}%".
- **Site Comparison · OEE** — per-site progress bars coloured by status with the value at the right and a "Target: 85% (dashed)" note.
- **AI Executive Brief** (`AIBrief`, purple left border, "06:00 daily refresh") — Rotterdam top risk (OEE 68.9%, 6 predicted failures, compliance 84%); Detroit leads at 81.5%, replicate its predictive cadence; enterprise downtime cost $1.2M MTD → "Generate Full Board Report →".

### 19.2 Analytics & Reports (route `reports`)

`ReportsScreen` (defined inline in `shell.jsx`) — a responsive card grid of four auto-generated reports with Ready/Generating badges: Monthly Board Report — May 2026 (all sites · 24 pages), Rotterdam Risk Review (site deep-dive · 12 pages), Q2 OEE Summary (enterprise · 8 pages, **Generating**), Predictive Maintenance ROI (cost analysis · 16 pages). Buttons read "Download PDF" or "View Progress" accordingly. A "Generate New" primary action sits in the header.

### 19.3 Notifications (route `notifications`, via the bell)

`NotificationsScreen` — "Rules, channels, escalation policies".
- **Alert Rules** table: Critical vibration (`VIB > 40 mm/s`, VIB-204, critical, Teams + PagerDuty) · Coolant flow loss (`FLOW < 2 L/min`, critical, Teams + SMS) · Bearing temp warning (`TEMP > 82°C`, high, Email) · IOW pressure (`PRES > 5 bar`, high, Teams).
- **Channels**: Email, MS Teams, Slack, SMS, PagerDuty — all connected, each with Configure.
- **Escalation Policy**: a 4-step numbered ladder — Level 1 Immediate → assigned operator; Level 2 +15 min → shift lead + Teams; Level 3 +30 min → plant manager + PagerDuty; Management +60 min → site director.

---

## 20. Module deep-dive: Settings & Administration

Route `settings` → `ForgeSettings`, a 240 px side nav in four groups over 12 pages.

```
Organization  · General · Sites & Hierarchy · Site Onboarding · Modules & Plan [5/10]
People        · Users & Teams [10] · Roles & Permissions [6] · Security & Access
Connectivity  · Integrations [●] · Notifications · API & Webhooks
Platform      · Audit Log · Billing & Usage
```

`SettingsKit` — exported as a shared kit and consumed by **eight other modules** (Work Orders, Shifts, Roles, Users & Teams, Site Onboarding, Lines list, Notifications settings, Sites settings): `SCard`, `Field`, `TextIn`, `Sel`, `Toggle`, `ToggleRow`, `BtnGroup`, `StatusBadge`, `modal(close, title, body, footer, width)`.

### 20.1 General
Organization Identity (name "Pragmatyc Industrial", display name, industry select with 7 options, tagline "Predictive intelligence for heavy industry", a 160 px logo dropzone); Regional & Locale (timezone, date format, time format, language ×5, measurement units Metric/Imperial); Platform Defaults (default landing page, default site, session timeout, data retention 30d–3yr); and a **Danger Zone** with Reset All Settings, Export All Data, and **Delete Organization** — the last requiring the user to **type "Pragmatyc Industrial" exactly** before the destructive button enables, with a warning naming "all 3 sites, 389 assets, and all historical data".

### 20.2 Sites & Hierarchy
A 6-level tree (Enterprise → Region → Site → Line → Asset → Sensor) with **full CRUD**. Each node shows a level-coloured icon, name, country tag, status badge, and a hover "+" that creates the *correct child type* via `CHILD_OF`. `HierCreateModal` renders a **different field schema per level**:

| Level | Fields |
|---|---|
| Region | Country, Timezone |
| Site | Site Code, Country, Timezone, Site Manager, Status |
| Line | Line Code, Line Type (6 options), Capacity, Status |
| Asset | Asset ID, Type (8), Manufacturer, Model, Serial Number, Criticality |
| Sensor | Sensor Type (8), Unit (8), Sampling Rate (1 Hz–1 kHz), Warning Threshold, Critical Threshold |

Deleting warns about child counts. The right pane shows a level-appropriate edit form (sites get latitude/longitude and tag chips: ISO-9001, High Throughput, Coastal). A footer card offers **"Sync Hierarchy to CMMS — Last synced 14 min ago · SAP PM"**.

### 20.3 Site Onboarding
A separate site-lifecycle module over 12 sites spanning 4 regions and 4 countries.

Stats: Total Sites 12 · Regions·Countries 4/4 · Buildings 13 (11 of 12 sites have buildings, with a 92% progress bar) · Sensor Locations 14 · Recently Added 0.

Table: Site ID (monospace `#{id}`), Region, Country with flag, State, City + area sub-line, Zip, and **pill counters** for Buildings 🏢 / Floors ⧉ / Sensor Locations ● (amber), POC, ACTIVE badge, and a `⋯` menu (View details / Edit / Copy Site ID / Copy address / Delete). Tabs: All / With buildings / Empty / Recently added.

**Onboard wizard** (4 steps in a 720 px drawer):
1. *Site Location* — Region → Country (cascading from `SO_REGIONS`), State, City, Area/County, Street Address, Lat/Long with a map-picker button, Zip, and Lead Account Owner (POC)
2. *Buildings & Floors* — add/remove buildings, each with an editable name and an add/remove floor list
3. *Sensor Locations* — a table of named spots each bound to a building and floor
4. *Review & Confirm* — a location summary grid plus "N building(s) · N floor(s) · N sensor location(s)"

Footer offers Reset / **Save as Draft** on step 1 and "Confirm & Activate" at the end.

**Site detail** — header with city/state, `#id` and ACTIVE badges, full address; six stat tiles (Buildings, Floors, Sensor Locations, Cameras, Sensors, Floor Plans); and four tabs:
- *Overview* — an **Onboarding Workflow** card at 83% complete with the 4 stage chips and a 6-item checklist (Location captured ✓, Buildings added ✓, Floors configured ✓, Sensor locations defined ✓, Devices onboarded ✓, Floor plans linked ○) — plus Location Details including lat/long, a derived POC email, and created/modified stamps
- *Buildings & Sensor Locations* — an expandable Building → Floor → Sensor-location tree
- *Devices* — camera/sensor chips, a live badge, and a table (device name, model FMX700/FMX400, IP, hierarchical location path, last seen, LIVE badge) with "Manage in Devices"
- *Floor Plans* — an empty state with "Synced from Floor Plans Module"

**Bulk import** — a 3-step modal (Upload → Map → Validate) with a template download card and an expandable **"What columns do I need?"** panel listing required vs optional columns. The modal title carries the subtitle *"✦ Calm, forgiving, and reversible"* — an explicit statement of import UX values.

### 20.4 Modules & Plan
A plan banner: **PROFESSIONAL · 8 of 10 modules active · 3 sites · Up to 1,000 sensor tags · Renews Dec 31, 2025 · Annual billing** with "Upgrade to Enterprise →".

Ten module cards, each with icon, name, tier badge (Core / Phase 2), description, a live usage stat, and a toggle. Phase 2 modules render at 0.7 opacity with a **disabled** toggle — a clean commercial gate:

| Module | Tier | Usage stat |
|---|---|---|
| Anomaly Detection | Core | 12,847 tags monitored |
| Predictive Failure | Core | 234 assets scored |
| AI Copilot | Core | Used 1,240 times this month |
| Root Cause Analysis | Core | 47 RCAs generated |
| Asset Management | Core | 389 assets registered |
| OEE & Production | Core | 3 production lines |
| **Compliance & Safety IOW** | **Phase 2** | Upgrade required |
| **Enterprise Multi-Site** | **Phase 2** | Upgrade required |
| Data Connectivity | Core | 8 connectors active |
| Platform Admin | Core | Always included |

Plus a Usage Summary with four metered bars: Sensors Connected 847/1,000 (orange — near limit), API Calls 124,521/200,000, AI Copilot Sessions 1,240/Unlimited, Storage 234/500 GB.

### 20.5 Users & Teams
Three tabs: **Users**, **Teams**, **Import History**.

*Users* — seven clickable stat facets (Total 10 · Active 8 · Inactive 1 · Pending 0 · Locked 1 · **MFA Enabled 8** · **MFA Disabled 2 "At-risk accounts"**). Table: hash-coloured avatar + name + email, role with a colour dot, status badge, an **MFA cell** (green ✓ On / red ✕ Off), sites, team, last active, and a `⋮` menu (Edit / Deactivate-Activate / Delete). Locked rows get a red left border. Destructive actions go through a `ConfirmModal` that **requires a reason "logged for audit"**.

*User drawer* (create/edit) — four sections: Personal Information (first/last name, work email, job title, department, phone with the hint "Required if MFA method is SMS"); Access & Role (role, an All-Sites toggle that reveals a site select when off, **Default Landing Page** from 7 options including "Camera Workstation"); Authentication & Security (MFA required, MFA method, force password change, session-timeout override); and **Internal Notes** ("Not visible to the user · 0/500").

*User detail* — avatar header with email/title/phone, "Send Reset Link" and "Edit User"; six summary tiles; four tabs: Overview (an **Account Completeness** progress computed from a 6-item checklist + Profile Details), Access & Sites (site access, team memberships, and the `UserAssignedAssets` card that writes back to `ASSET_OPS`), Security (6 rows + Send Password Reset / Reset MFA / Revoke Sessions), Activity (placeholder).

*Teams* — 5 teams with type colour-coding (Engineering / Operations / Executive / Maintenance / Other), lead, member count, site scope, default landing page and a Slack/Teams channel. Team detail has Overview (setup completeness), Members (with a ★ LEAD badge), Scope & Access, Activity. The Scope tab states the merge rule explicitly: **"Teams grant site access (union) and never revoke it. Personal landing-page preferences always win over the team default."** — exactly the kind of rule that usually goes undocumented.

*Import wizard* — 5 steps (Upload → Map → Validate → **Assign** → Review). The Assign step is the interesting one: it maps **unrecognised role strings** from the spreadsheet (`plant_admin`, `field_tech`, `viewer`) onto platform roles. Validate reports 47 valid / 3 warnings / 1 error with row-level messages. Review shows will-create 47 / will-update 8 / skipped 1.

*Import History* — an empty state promising "the full history will appear here — with **one-click undo for the first 24 hours**."

### 20.6 Roles & Permissions
Stats: Total Roles 7 · System Roles 6 · Custom Roles 1 · Assigned Users 10.

A master-detail layout: a role list (colour dot, name, System/Custom badge, "{n} permissions · {n} users") beside a detail pane showing the role header with Duplicate / Edit / Delete (edit and delete hidden for system roles, with the note *"System roles are read-only. Duplicate to create an editable custom role."*), four summary metrics (Permissions n/34, Assigned Users, Modules n/10, Type), and a **Granted Permissions** grid — per module, an icon that lights up when anything is granted, an "{n} / {m}" count, and every feature as a ✓ green or ○ grey chip.

**Role drawer** — name, an 8-swatch colour picker, description, **"Start from" templates** (Full access / View only / Blank), a live "{n} / 34" counter, and per-module permission chip grids with an **All / Clear** shortcut per module.

**Permission Matrix modal** (880 px) — the full 34-feature × 7-role grid with a **sticky first column** and grouped module header rows, ✓ / · per cell.

The catalogue (10 modules, 34 features):
```
Dashboard(3)            view · customize · share
Anomaly Alerts(4)       view · ack · suppress · configure
AI Copilot(3)           use · export · tune
Root Cause Analysis(3)  view · create · edit
OEE & Production(3)     view · export · targets
Lines & Assets(4)       view · edit · import · delete
Work Orders(4)          view · create · approve · close
Insights & Reports(3)   view · build · schedule
Integrations(2)         view · manage
Platform Admin(5)       users · roles · billing · audit · security
```

### 20.7 Integrations (Settings)
A second, differently-shaped connector view from Data Fusion: category tabs (All / OT·Data Sources / CMMS / Notifications / ERP) over 16 connectors in 4 groups, each card showing status and sync info with Configure / Test. Plus a **Data Pipeline Monitor** table with Tags, Data Lag, Last Sync, **Records/min** and Pause/Delete actions. A 6-step **Integration Wizard** (Category → Connector → Credentials → Test → Map Fields → Schedule) with a real 1.4 s test that reports "Discovered 847 available tags", and a field-mapping table (`PI.VIB_204 → Vibration RMS`, etc.).

### 20.8 Notifications (Settings)
Alert rules with full CRUD. The **`RuleModal` parses and re-serialises the condition string** (`/^(\S+)\s*([<>≥≤=]+)\s*(.+)$/`) into metric / operator / value selects — so `VIB > 12.5 mm/s` round-trips through a structured editor. Metrics: VIB, TEMP, PRES, FLOW, Health, OEE. Operators: > < ≥ ≤ =. Scope: All Assets / All Pumps / Compressors / All Lines / Specific Asset…. Channels are checkboxes. Rules can be Paused/Resumed inline and deleted with confirmation. Below: five channel cards, a 4-level escalation policy with "+ Add Level", and per-user digest preferences (Daily Digest 08:00, Weekly Summary, Alert Sound in App, Browser Push).

### 20.9 Security & Access
- **Authentication** — SSO (SAML 2.0) behind an **Enterprise** badge; enabling reveals IdP (Okta / Azure AD / Google Workspace / Custom SAML), Entity ID, SSO URL, Certificate. MFA required with three method chips showing readiness (✓ Authenticator TOTP, ⚠ SMS, ✓ Hardware Key FIDO2) and a **"Force re-enroll all users"** action.
- **Password Policy** — minimum length, expiry, uppercase/numbers/special-character requirements, and prevent-reuse-of-last-5.
- **Session Management** — timeout and concurrent-session limits, plus a live **Active Sessions** table (user, device+browser, IP, geolocated location, last active) with per-row **Revoke** and a global "Terminate all active sessions".
- **IP Allowlist** — off by default; enabling shows an amber warning "⚠ Enabling this will lock out users not on the allowlist", a CIDR textarea, and "+ Add My Current IP".
- **API Security** — HTTPS-only (**locked for compliance**, disabled toggle), rate limiting with a per-key requests/minute field, and "Log all API requests to Audit Log".

### 20.10 API & Webhooks
API keys table with prefix, **scopes** (`read:all`, `write:workorders`, `read:assets`, `read:alerts`, `read:oee`), created/last-used, and Rotate / Revoke. Webhooks table with endpoint, subscribed events and Test / Edit / Delete. A documented event catalogue: `anomaly.detected · prediction.alert · workorder.created · incident.critical · oee.below_target · health.score.changed`. A REST API card offering API Docs / Download Spec (OpenAPI 3.0) / Postman.

**Key generation** is a proper two-phase flow: choose name, expiry (None/30d/90d/1yr) and scopes → then a **one-time reveal** screen with "⚠ This key will not be shown again. Copy and store it securely" and a Copy button.

### 20.11 Audit Log
"Tamper-evident activity log for compliance and security review". Filters for date range, actor search, category (Auth / User Mgmt / Config / Data / API / Integration) and severity. Seven events with monospace timestamps, actor avatars (system events have no avatar), **screaming-snake action codes** (`USER_INVITED`, `INTEGRATION_TESTED`, `ANOMALY_ESCALATED`, `REPORT_EXPORTED`, `ROLE_CHANGED`, `DATA_RETENTION_PURGE`, `SETTINGS_CHANGED`), resource identifiers, details, IP and severity badge. **Clicking a row expands a pretty-printed JSON payload including a `hash: "sha256:9f2b…e41a"`** — the tamper-evidence claim made concrete. Footer: "Showing 7 of 2,481 events". A **Compliance Export** card generates SOC 2 / ISO 27001 / General Activity reports as PDF / CSV / JSON.

### 20.12 Billing & Usage
Plan card with feature checkmarks (AI Copilot ✓, Predictive Failure ✓, RCA Engine ✓, Multi-Site Intelligence ○, SSO/SAML ○, Custom AI Models ○); four metered usage cards; a 6-month usage trend chart; an invoices table (5 invoices, $4,200/mo and a $50,400 annual); a Visa payment method card; and an "Unlock Enterprise Features" upsell (Unlimited Sites & Lines, SSO/SAML, Custom AI Models, Multi-Site Intelligence, Dedicated CSM, SLA 99.9%).

### 20.13 Orphaned `AdminScreen` (route `admin`/`users`)
A pre-Settings admin page still wired to the router but unreachable from the UI. Four tabs: Users & Roles (over `USERS`), Sites & Hierarchy, **Modules** (9 module toggles where the first 8 are "Professional" and the rest "Enterprise tier"), Audit Log. Header: "Active Plan: Professional — 8 of 10 modules enabled".

---

## 21. The AI narrative system

Forge AI's most distinctive product characteristic is that AI is not a feature bolted onto a dashboard — it is the **primary presentation layer**. It is worth cataloguing the patterns, because they constitute a reusable design language.

### 21.1 Visual grammar of AI
| Signal | Meaning |
|---|---|
| `--purple` (`#BF5AF2`) | AI authorship. Used for nothing else. |
| 135° `#BF5AF2 → #0A84FF` gradient | AI identity chip / avatar / launcher |
| The hexagonal `copilot` icon | AI presence marker at every scale (10 px chip glyph → 28 px header) |
| 3 px purple left border on a card | "this card was written by AI" |
| An **`AI-DRAFTED`** / **`AI pre-filled`** pill | this form content was generated, review before committing |
| A purple chip reading **"Generated by AI"** | this record originated from an agent, not a human |
| `AI Analyzed` pill on a logbook entry | this human note was consumed as RCA evidence |
| A rotating radar (conic-gradient sweep) | the AI is working; phases narrated with `aria-live` |
| An **italic disclaimer** at the end of a briefing | human verification required |

### 21.2 The nine AI surfaces
1. **Role-adaptive daily briefing** (Home → My AI Synopsis) — three separate persona narratives
2. **Per-asset conversational briefing + voice** (Asset Detail → AI Synopsis) — including a 55-second spoken version
3. **`SecInsight` chart narration** — AI sentences placed above charts, explaining what to look at
4. **Per-datapoint hover reasons** (`HoverChart`) — the AI annotates individual points on the OEE trend
5. **Alert investigation** (Alert Detail) — gated radar → RCA → causal chain → tool-cited evidence
6. **Reasoning trace** (Analysis → Reasoning) — the full 5-stage pipeline with token counts and typed observations
7. **AI Synopsis tab** — a card-based executive summary of an alert that indexes into deeper tabs
8. **Copilot dock + full page** — contextual Q&A with typed content cards, thought process, and grounding badges
9. **Generative form pre-fill** — work orders and shift handovers arrive drafted, with the AI portion visibly labelled

### 21.3 Named AI/ML machinery
The prototype is specific about its methods, which reads as credible to an industrial audience:

- **Detectors:** Δz-score (spike), CUSUM (drift acceleration), Page-Hinkley (drift acceleration), Isolation Forest (gradual drift). Real scores and confidences are quoted: `delta_zscore 11.12 / 0.9992`, `cusum 2.31 / 0.7832`, `page_hinkley 2.02 / 0.7301`.
- **Qualification gate:** a "frequent flyer" filter with a `noise_ratio` metric, guarding against chronic false-positive emitters.
- **Rule 2 — cascade signature:** ≥3 simultaneously anomalous sibling sensors ⇒ real process event.
- **Fusion score:** a 0–100 cross-sensor agreement score present on every alert (`fusion: 92 / 88 / 84 / 76 / 72 / 67 / 61 / 59 / 55 / null`); single-sensor alerts are explicitly labelled "no cross-sensor confirmation".
- **Regression to failure:** slope 0.3264 mm/s·h, r² 1.000, η-to-trip 4.50 h.
- **Case-based reasoning:** similarity percentages against historic anomalies (94% / 81% / 73%) and resolutions ("matches Apr-28 J14 wiring resolution at 91% similarity").
- **Named model:** `Vibration-fusion v4.1`, retrained Jan 8, 12,402 samples, **F1 0.91**, per-asset contribution share 3.5%.
- **Tool calls:** `calculate_regression`, `get_signal_trends`, `get_failure_history`, `get_logbook_entries` — an agentic tool-use vocabulary.
- **Sensor profiling:** "sensor profile 15.17 days old, 527k training samples", baseline mean/σ over 569 pre-event samples, P99 thresholds.
- **Feedback loop:** every alert action captures a reason + comment explicitly labelled "for AI training".

### 21.4 Grounding discipline
The Copilot repeatedly and consistently claims a closed world: "I only use data already in your Forge AI platform", "Grounded · {context}", a green "platform data" badge, card eyebrows that state provenance (`Asset · platform record`, `Anomaly · detected by platform`, `Summary · synthesised from platform data`), a "⟳ Data last updated 2 min ago" freshness stamp, source citations (`Source: VIB-204 · 14:32 today · SOP-CL-12 v3.2`), and — critically — an honest failure mode that names the missing data source and routes the user to Data Fusion to add it.

---

## 22. Complete domain data model

### 22.1 Core entities

**Site** (`SITES`)
`id · name · country · flag · oee · downtime(h) · anomalies · predicted · compliance(%) · status(green|amber|red) · lat · lng`

**Onboarded Site** (`SO_SITES`) — a different, richer shape
`id · region · country · flag · state · city · area · zip · bld · fl · sl · poc · addr? · lat? · lng?`

**Asset** — three coexisting shapes:
- `ASSETS` (original): `id · name · type · site · line · health · status(healthy|warning|critical) · crit · mfr · model · install · nextPM · openWO`
- `FA_ASSETS` (Findlay, via `mk()`): `id · name · type · lineId · line · floor · online · health · alerts[{sev}] · owner · sensors[] · lastSeen · crit · tags[]`
- `PLANT_ASSETS` (bodymaker module): `id · name · type · line · health · status · sensors(count) · alerts(count) · crit · owner · pm`

**Production Line** — also three shapes: `TINCAN_LINES` (`id·name·oee·status·assets`), `FINDLAY_LINES` (`id·name·machines·health·oee·target·status·running·anomalies·rich?·idle?`), `LINE_META` (`id·name·floor·building`).

**Station** (`BM_STATIONS`)
`id · name · short · status · throughput · target · anomalies · oee · blocked? · starved? · vendor · model · installed · runHours · nextPM · sensors(count)`

**Machine component model** (`BM_MACHINES`)
`{ crit, health, components: [{ id, name, vendor, model, status, sensors: [{ id, name, tag, unit, value, normal[lo,hi], status, anomaly?, series }] }] }`

**Sensor** — two shapes:
- `plant-data.jsx` `sensor()`: `id · type · channel · unit · label · color · icon · normal[lo,hi] · value · state(ok|warning|violation) · series[]`
- alert-embedded: `type · ch · name · value · threshold · unit · delta · anomaly · triggered · series[]`

**Alert / Anomaly** (`ALERTS` — the canonical modern shape)
```
id · assetId · assetName · site · severity(critical|high|medium|low)
status(Open|Acknowledged|Escalated|Snoozed|Closed)
created · detected · due · assignee · fusion(0-100|null) · wo(id|null) · age · primary
sensors[] · narrative · fusionInsight{headline, detail}
escalation[[level, timestamp, reason, tone]]
activity[[actorType, actor, when, text]]
nearby[[assetId, name, status]]
```
Optional/never-populated fields the UI reads defensively: `source`, `line`, `title`, `confidence`, `sensors[].comp`.

Legacy shape (`ANOMALIES`): `id · asset · sensor · type · desc · conf · severity · started · duration · assignee · status(Active|Investigating|Suppressed)`.

**Prediction** (`PREDICTIONS`)
`asset · mode(failure mode) · health · date · days · conf · action · status(WO created|Pending|Monitoring)`

**Work Order** (`WORK_ORDERS`)
`id · title · asset · priority(Critical|High|Medium|Low) · assignee · due · source(AI|Manual) · status(6 states)`

**Task** (`TASK_SEED`)
`id · title · asset · priority · due · status(Open|In Progress|Done) · assignee · from(provenance)`

**Shift** (`SHIFTS`)
`id · day · dayIdx · type(Morning|Afternoon|Night) · op · oee · anomalies · downtime · wos · status(Active|Completed|Scheduled)`

**Handover** (`HANDOVER_HISTORY` + `HANDOVER`)
`id · shiftLabel · date · window · outgoing · incoming · status(Draft|Acknowledged) · oee · alerts · pending` plus a detail object with `summary · production[][] · alerts[][] · pending[] · notes`

**Logbook Entry** (`LOG_ENTRIES`)
`op · time · shift · text · tags[] · anomaly(id|null) · ai(bool) · date`

**IOW parameter** (`IOW`)
`param · asset · value · lo · hi · unit · state(ok|warning|violation) · time · owner`

**User** — two shapes: `USERS` (`name·email·role·site·last·status`) and `U_USERS` (`id·name·email·role·status·mfa·sites·team·last·title·dept·phone·landing`).

**Team** (`U_TEAMS`)
`id · name · desc · type · status · lead · members · sites · landing · channel`

**Role** (`R_ROLES`)
`id · name · desc · system(bool) · color · users · grant{ "moduleId.featureId": true }`

**Document** (`FUSION_DOCS`)
`id · name · type(8 kinds) · scope(instance|model|site|enterprise) · links[{k,id}] · rev · size · pages · owner · date · tags[] · lang · src · verified · usedBy(number|"all"|"site") · expires?`

**Media** (`FUSION_MEDIA`)
`id · name · type(photo|3d|thermal|video) · links[] · size · date · owner · tags[]`

**Connection** (`FUSION_CONNS`)
`id · n(name) · cat(ot|iot|biz|db|vision) · proto · s(status) · tags · sync · host · site · lat(ency) · err?`

**Pipeline** (`DFPipes` state)
`n · src · tgt · s(Active|Paused|Failed) · last · rec · sch · err?`

**Connector** (legacy `CONNECTORS`)
`name · cat · status(connected|syncing|disconnected) · sync · tags`

### 22.2 Controlled vocabularies

| Vocabulary | Values |
|---|---|
| Severity | critical · high · medium · low (+ `ok` as a badge tone) |
| Alert status | Open · Acknowledged · Escalated · Snoozed · Closed |
| Asset health status | healthy · warning · critical (+ derived offline) |
| Health thresholds | ≥80 green / ≥60 orange / else red (`Ring`, `ProgressBar`); ≥75/≥50 in Asset Detail (`hColor`); ≥80/≥50 in Assets module (`healthColor`) |
| Criticality | Critical · High · Medium · Low |
| WO status | Draft · Pending Approval · Approved · In Progress · On Hold · Completed |
| Sensor state | ok · warning · violation |
| Connection status | Connected · Syncing · Disconnected · Not Configured |
| Document scope | instance · model · site · enterprise |
| Document type | manual · sop · pid · datasheet · cert · policy · report · floorplan |
| Media type | photo · 3d · thermal · video |
| Sensor types (`SENSOR_TYPES`) | vibration · vibration_axial · temperature · pressure · current · humidity · oil · speed · acoustic |
| Sensor types (`SENSOR_META`) | Vibration · Temperature · Pressure · Current · Oil · Acoustic · Speed |
| Target kinds (graph) | site · line · asset · model · component · sensor |
| ISA-95 levels | Enterprise · Region · Country · Area · Site · Building · Floor · Production Line · Asset |
| Shift types | Morning 06:00–14:00 · Afternoon 14:00–22:00 · Night 22:00–06:00 |
| Team types | Engineering · Operations · Executive · Maintenance · Other |
| Anomaly signatures | Frozen Signal · Spike Pattern · Upward Drift · Pressure Surge · Current Imbalance · Thermal Cycling · Bearing Noise · Sustained Exceedance · Rapid Rise · Drift · Surge · Phase Imbalance · Contamination · Oscillation · Drop |

### 22.3 Units used
`mm/s` (vibration RMS) · `°C` · `bar` · `A` (motor current) · `L/min` (flow) · `ppm` (oil particulate) · `dB` (acoustic emission) · `RPM` / `cpm` (cans per minute) · `%RH` · `cSt` · `kW` / `kWh per 1,000 cans` · `h` (MTBF/MTTR/run hours) · `σ` · `r` / `r²` · `%` (OEE, health, compliance, confidence)

---

## 23. Seed-data inventory

| Registry | Count | Notes |
|---|---|---|
| `SITES` | 3 | Chennai amber, Detroit green, Rotterdam red |
| `ASSETS` | 8 | across 3 sites, 4 line names |
| `ANOMALIES` | 7 | legacy shape, ANM-0001…0007 |
| `PREDICTIONS` | 5 | 3–20 days to failure, conf 61–91% |
| `WORK_ORDERS` | 7 | 4 AI-sourced |
| `IOW` | 6 | 3 violations, 2 warnings, 1 ok |
| `USERS` | 5 | legacy |
| `CONNECTORS` | 8 | legacy |
| `SERIES` | 6 traces | oee 40pt, vib/temp/flow/pres 60pt, health 90pt |
| `ALERTS` | **13** | 6 ALR-* + 7 migrated ANM-* |
| — by severity | 3 critical · 3 high · 5 medium · 2 low | |
| — by status | 6 Open · 3 Acknowledged · 1 Escalated · 2 Snoozed · 1 Closed | |
| — unassigned | 4 | |
| `ALERT_SITES` | 7 | All Locations, Building 1, WoodvillePellets, InterPaper, Non-Wovens, Chennai Plant, Bodymaker Line 3 |
| `SENSOR_META` | 7 types | each with unit, icon, colour |
| `SENSOR_TYPES` | 9 types | plant-data version |
| `ASSET_SENSORS` | 3 assets modelled | BM-03 (9 channels), WS-01 (5), C-12 (5); others fall back to a generic 4-channel bank |
| `PROD_METRICS` | 4 × 96pt | cansPerMin, throughput, powerKw, runtime |
| `PROD_BATCHES` | 4 | BATCH-2258…2261 across 330ml/500ml/250ml formats |
| `KB_DOCS` | 8 | P&ID, OEM manual, SOPs, floor plan, 3D model (84 MB STEP), HSE policy, datasheet |
| `TINCAN_LINES` | 10 | L1–L10; L6 idle at 0% OEE; best L10 Palletizing 94% |
| `LINE_MACHINES` | 8 types | Cupper → Palletizer |
| `BM_STATIONS` | 8 | 3 vendors (Stolle, KBA-Metalprint, LTG, Husky); 1 blocked, 4 starved |
| `BM_MACHINES` | 2 modelled | bodymaker (4 components, 3 sensors), washer (3 components, 2 sensors) |
| `BM_ANOMALIES` | 3 | conf 88 / 94 / 72 |
| `BM_SERIES` | 5 profiles | vibSpike, drift, frozen, sine, sineP |
| `FA_ASSETS` | **30** | line3:8 · line4:7 · line5:5 · line6:5 · line7:3 · line8:2 |
| `LINE_META` | 6 lines | across 3 floors / 3 buildings |
| `FINDLAY_LINES` | 6 | |
| `PLANT_ASSETS` | 10 | |
| `TOPNAV_LOCS` | 9 | 4 hierarchy depths |
| `ISA_TREE` | 9 levels | 3 regions, 4 countries, 5 named sites |
| `HIER_TREE` | 7 nodes | Sensor Explorer scope selector |
| `SITE_TREE` | 3 sites / 4 lines / 5 assets | Settings hierarchy |
| `FUSION_CONNS` | **18** | 14 Connected · 2 Syncing · 1 Disconnected · 1 Not Configured |
| `FUSION_CONN_CATS` | 5 | ot:6 · iot:2 · biz:4 · db:3 · vision:3 |
| `FUSION_PROFILES` | 5 | each with ingests[], excludes, objects, config[], mapTitle, mapHint, mapCols[], mapRows[], wizard[], extraTab |
| `FUSION_DOCS` | 12 | 2 unverified (D-1005, and any newly uploaded) |
| `FUSION_MEDIA` | 4 | |
| `FUSION_DOC_TYPES` | 8 | |
| `FUSION_MEDIA_TYPES` | 4 | |
| `FUSION_TARGET_KINDS` | 6 | |
| `FUSION_TARGETS` | 4 sites · 4 lines · 6 assets · 4 models · 4 components · 4 sensors | |
| `ASSET_MODEL_MAP` | 6 assets | BM-03, C-12, HX-204, CVR-07, WS-01, SM-01 |
| `OPERATORS` | 8 | |
| `SO_SITES` | 12 | 4 regions, 4 countries |
| `SO_POCS` | 6 | |
| `U_USERS` | 10 | 8 Active · 1 Locked · 1 Inactive; 8 MFA on, 2 off |
| `U_TEAMS` | 5 | 4 Active · 1 Inactive |
| `R_ROLES` | 7 | 6 system + 1 custom |
| `PERM_CATALOG` | 10 modules / **34 features** | |
| `MODULES` (settings) | 10 | 8 Core on · 2 Phase 2 locked |
| `SHIFTS` | 21 | 7 days × 3 types |
| `HANDOVER_HISTORY` | 7 | SH-0412…SH-0418, 1 Draft |
| `LOG_ENTRIES` | 6 | 4 AI-analysed, 3 linked to alerts |
| `TASK_SEED` | 5 | 3 assigned to "You" |
| `TEAM` (task assignees) | 6 | |
| `AUDIT` | 7 events | 3 severities |
| `ALERT_RULES` | 4 | |
| `CONNECTORS` (settings) | 16 | across 4 categories |
| `TS_SERIES` | 4 channels | over a 500-point / 17-day dataset |
| `TS_CHARTS` | 8 saved charts | |
| `AN_PLAN` | 5 steps | |
| `AN_DOCS` | 4 references | |
| `AN_SIMILAR` | 3 historic matches | 94% / 81% / 73% |
| `COPILOT_PROMPTS` | 7 routes + default | 3 prompts each |
| `CP_MODES` / `CP_PROMPTS` | 4 modes × 3 prompts | |
| `IMPORT_FIELDS` | 8 target fields | 4 required |
| `SAMPLE_ROWS` (asset import) | 7 rows | deliberately seeded with 1 missing ID, 1 unknown line, 1 bad date, 1 bad enum, 1 duplicate ID |

---

## 24. Interaction, motion & feedback inventory

### 24.1 Keyframe animations
| Name | Duration | Where |
|---|---|---|
| `slidein` | 0.28 s ease | right-hand drawers (filters, roles, users, teams, onboarding, connection detail) |
| `copilotSlideIn` | 0.3 s ease | voice-briefing player expansion |
| `fadein` | 0.2–0.25 s | modals, toasts, overlays |
| `pulse` | 1.4–1.6 s infinite | banner dot, critical KPI dot, map pins, alerting floor-map stations, live badges |
| `spin` | 0.8 s linear | `StateBlock` loading ring |
| `synSweep` | 1.4 s (`.synopsis-sweep`) / 2.2 s (`.radar-sweep`) linear | investigation and analysis radars |
| `bannerIn` | 0.35 s ease | anomaly banner entrance |
| `cpPulse` | 2.4–2.6 s ease-out | copilot launcher glow rings, live pinned-sensor dot |
| `eqbar` | 0.7 s ease-in-out | voice-briefing equaliser bars (staggered 0.12 s) |

### 24.2 Transitions
- Copilot dock: `width 0 → 360 px` over `0.55 s cubic-bezier(0.22,1,0.36,1)`
- Sidebar: `width` over `0.3 s ease`
- Carousels: `transform` over `0.6 s cubic-bezier(0.4,0,0.2,1)`
- Card hover lift: `translateY(-2px)` (KPI) / `-3px` (station cards) / `-1px` (shift blocks)
- Colour-blind switch knob: `left` over `0.32 s cubic-bezier(0.34,1.56,0.64,1)` — an overshoot spring
- Floor-map zoom: `transform 0.2 s`
- Table rows, chips, buttons: `border-color` / `background` over `--t` (0.3 s)

### 24.3 Timers and simulated latency
| Behaviour | Timing |
|---|---|
| Toast dismissal | 3,000 ms (2,600 ms in module-local variants) |
| Anomaly banner: 2nd item / 3rd item | 9,000 ms / 20,000 ms |
| Anomaly banner rotation | 5,000 ms |
| Watched-assets carousel | 4,000 ms (paused on hover) |
| Investigation phases | 2,200 ms each × 4 |
| Copilot investigation typing | 4 chars / 45 ms |
| Asset analysis loader | 2,500 ms total, phases every 620 ms |
| AI Synopsis loader (unused path) | 2,600 ms |
| Connection test | 1,400 ms |
| Connection sync | 1,600 ms |
| Contextualization auto-match | 1,600 ms |
| Asset import progress | +12% / 120 ms |
| Voice briefing | 55,000 ms nominal, 120 ms progress tick |
| Save-button "✓ Saved" flash | 1,500 ms |
| Date-range picker close after 2nd click | 150 ms |

### 24.4 Sound
One sound in the entire product: an **880 Hz sine ping** on new anomaly arrival, synthesised with `AudioContext` — 0.02 s exponential attack to gain 0.12, 0.5 s exponential decay. Wrapped in try/catch. Notably, the Notifications settings expose an "Alert Sound in App" preference that is **off by default** and not wired to this.

### 24.5 Form validation actually implemented
- Task: title must be non-empty
- Work order: title > 2 chars **and** asset non-empty
- Alert action: a reason chip must be selected
- Document upload: name > 2 chars; ≥1 link unless enterprise scope
- Media upload: name > 2 chars **and** ≥1 link
- Pipeline: name > 2 chars
- Role: name non-empty
- Alert rule: name > 2 chars **and** a threshold value
- Line: name > 1 char
- Shift: operator required
- Delete organisation: exact-match text confirmation
- Asset import: all four required column mappings present before Validate unlocks
- Connect wizard: test must pass before step 4
- New chart: ≥1 signal selected

Disabled buttons consistently render at `opacity: 0.5`.

---

## 25. Fidelity audit: dead code, gaps, inconsistencies

Stated plainly, because these matter for anyone building from this artefact.

### 25.1 Broken or dead navigation
| Issue | Detail |
|---|---|
| **`rca` route missing** | `RCAScreen` and `RCADetail` are fully built (event timeline, AI causal chain, sensor evidence table, referenced documents, recommendations checklist) and exported, but `shell.jsx` has no `case "rca"`. Both entry points — Timeseries Workstation's "View Root Cause Analysis →" and the legacy Anomaly Drawer's "Run RCA" — fall through to `Placeholder`, which renders the literal string "rca". **This is the most user-visible defect.** |
| `SafetyScreen` unreachable | Fully built (IOW monitor over `window.IOW`, pressure chart with limit band, incident log) but never assigned to `window`, and no route exists. `IOW` data is therefore orphaned except for one Copilot reply. |
| `PredictiveScreen` disabled | Route deliberately commented out (`// case "predictive": hidden — re-enable on request`). `PREDICTIONS` data survives only in that dead screen. |
| `AdminScreen` orphaned | Routes `admin`/`users` exist but nothing links to them. |
| `IntegrationsScreen` orphaned | Route exists; superseded by Settings → Integrations. |
| Sub-navigation never renders | `expandedNav`, `assetSubTab`, and the `it.children` branch are implemented but no `NAV` item declares children. |
| `RoleSwitch` unused | A complete top-nav variant of the role picker, never rendered. |
| CXO nav gating unused | `it.cxo` is filtered on but never set, so role does not affect navigation. |

### 25.2 Shadowed / superseded components
Left in place rather than deleted (a deliberate prototype versioning habit, but ~2,000 lines of dead source):
- `Dashboard` / `OperatorDash` / `ManagerDash` / `CxoDash` / `AlertsFeed` / `SiteMap` (`screens.jsx`) — superseded by `HomePage`. Only `AIBrief` from this file is still used.
- `AnomalyScreen` / `AnomalyDrawer` (`screens2.jsx`) — superseded by `AlertsModule`.
- `CopilotScreen` v1 (`screens2.jsx`) — overwritten by the modes version.
- `AssetScreen` v1 + `AssetDetail` v1 (`screens3.jsx`) — superseded by the bodymaker and 10-tab versions. `buildLines()` is dead with them.
- `UsersSettings` + `PERM_MATRIX` + `permLevel()` + `ROLE_COLS` (`screens-settings.jsx`) — superseded by `UsersTeamsModule` and `RolesPermissionsModule`.
- An unreachable `overview` tab inside `AlertDetail` — ~130 lines including a `{false && …}` block.

### 25.3 Missing icons
`ui.jsx` defines 41 icons. Five names are referenced but not defined, so they render as **empty `<svg>` elements**:

| Missing | Referenced by |
|---|---|
| `download` | Shift Handover report/form Export buttons, Shift Handovers page Export |
| `file` | Data Fusion nav (Documents), `FUSION_DOC_TYPES` (sop/datasheet), Alert Detail referenced-documents tiles, document upload dropzones |
| `book` | `FUSION_DOC_TYPES.manual`, Alert Detail manual tile |
| `layers` | `FUSION_TARGET_KINDS.model`, `FUSION_DOC_TYPES.pid`, `FUSION_MEDIA_TYPES.3d`, Data Fusion nav (Media), Asset Detail "Detailed view" switch, media upload dropzone |
| `clock` | Shifts schedule KPI strip (Downtime) |

### 25.4 `CopilotBtn` is a no-op
```js
function CopilotBtn({ size = 38 }) { return null; }
```
`PageHead` renders it on every page, and it is also placed explicitly in the Alerts list header (`size={36}`) and Alert Detail header (`size={40}`). All three produce nothing. The affordance now lives only in the top-nav "Ask ForgeAI" button.

### 25.5 Unshipped CSS
- `.cb-stripe-viol` / `.cb-stripe-warn` — colour-blind row hatching, declared but never applied by any component.
- `#print-header` — the print stylesheet reveals it, but no element with that id is ever rendered, so printed pages have no header.
- `.cp-launch` / `.cp-btn` — glow-pulse classes for copilot launchers that are no longer rendered (only `.cp-topbtn` survives).
- `.kpi-hover` is applied in the Alerts KPI strip only, though the effect would suit other KPI grids.

### 25.6 Numeric inconsistencies
| Figure | Values seen |
|---|---|
| Active modules | Settings nav badge **5/10** · Modules & Plan banner **8 of 10** · Billing **5 of 10** · orphaned AdminScreen **8 of 10** |
| Roles | Settings nav badge **6** · `R_ROLES` actually has **7** |
| Connectors | Data Fusion **14/18** · Copilot dock reply **18 of 22** · Settings Integrations **16** connectors · legacy `CONNECTORS` **8** |
| Tags streaming | Data Fusion **11.4k** · Copilot **9,996** · Home KPI **2,838 sensors online** · Modules stat **12,847 tags monitored** · Billing **847 / 1,000 sensor tags** |
| Total assets | Settings delete-warning **389** · Modules stat **389 registered** · `FA_ASSETS` **30** · Knowledge Graph **1,240** |
| Enterprise name | **Ball Corporation** (ISA-95 tree) · **Pragmatyc Industrial** (Settings) |
| "Today" | Jun 9 2026 (Alerts) · Jun 17–18 2026 (Handovers, Logbook) · May 2026 (PM calendar) · 2024-05-20→06-06 (Timeseries Workstation) · Jan/Mar 2026 (Asset Detail) |
| Site fiction | Chennai/Detroit/Rotterdam (Home, OEE, Enterprise, Alerts ANM-*) vs Findlay OH tin-can plant (Lines & Assets, Asset Detail, Data Fusion) vs Atlanta/Dallas/Phoenix/Miami/Seattle (Users & Teams) vs Beaumont/San Jose/Pune/Munich/… (Site Onboarding) — **four unrelated site universes** |
| Marquee asset identity | The bearing-wear narrative is attached variously to "Bottle Filler · Line 1", Compressor C-12, Bodymaker BM-03, and Conveyor CVR-07 |
| Alert count claim | Alerts page "13 anomalies" (correct) vs Home "9 Active Anomalies" (from legacy `ANOMALIES`) vs CXO "24 Active Alerts" |

### 25.7 Data-fidelity gaps
- **`ts()` ignores `freezeAt`.** `ANM-0002`'s coolant-flow sensor passes `{freezeAt: 0.66}`, but `alerts-data.jsx`'s generator has no freeze branch — so the "Frozen Signal" alert's chart does not actually flatten. (`series()` and `genSeries()` do implement it, which is why the Bodymaker/Washer views look right.)
- **`SERIES.cur` does not exist.** Asset Detail's `ovSensors`/`sensors` arrays request `S.cur` for Motor Current and silently fall back to `S.oee` — so the motor-current trace is an OEE curve.
- **Alert records lack `line`, `comp`, `source`, `title`, `confidence`.** Every alert row therefore reads "Line 3" regardless of site, the "Generated by AI" chip never appears, and the AI description always reports 92% confidence.
- **`window.__forgeUser` is never set**, so activity-log entries always attribute to "You".
- **`hasResult` is hard-wired `|| true`** in `AISynopsisTab`, so its investigating state is unreachable.
- **`Pager` is decorative.** It reports correct totals and manages page state, but never slices the rows above it — tables always show every row.
- **Randomised data on every render.** `Math.random()` inside generators (and inside the Asset Detail heatmap `cell()`) means values shift between renders; the 90-day heatmap redraws differently each time.
- **BM-03 health disagreement:** 64 (`FA_ASSETS`, `PLANT_ASSETS`) vs 72 (`BM_MACHINES.bodymaker`) vs 62 (Copilot dock asset card).
- **Duplicate `ImportWizard` name** — `screens-import.jsx` publishes `window.ImportWizard` (assets), while `screens-users-teams.jsx` defines a module-local one (users/teams). No collision occurs only because the latter is never exported.

### 25.8 Accessibility gaps
- **Most interactive elements are `<div onClick>`** — table rows, tree nodes, tab strips, nav items, chips, dropdown options, floor-map stations, graph nodes. They are not focusable, have no keyboard activation, and expose no role. This is the largest real accessibility issue.
- **No global focus-visible style.** Only `.input:focus` has a treatment.
- **No `Escape` handling** on any modal or drawer; dismissal is click-outside or the × button.
- **No focus trapping or focus restoration** in modals/drawers.
- Some `aria` usage is good (the colour-blind switch, three `aria-live` regions, the print button's label) but it is not systematic — badges, status dots and severity colours carry meaning without text equivalents outside colour-blind mode.
- `prefers-reduced-motion` covers only the two radar sweeps, not the pulses, equaliser or carousels.
- The always-hidden scrollbars reduce discoverability of scrollable regions.

### 25.9 Structural / engineering concerns
- **Everything is global.** ~120 symbols on `window`, with load-order dependencies enforced only by script order in the HTML.
- **13 imperative `__forge*` bridges** substitute for state management.
- **Direct mutation of shared registries** (`FUSION_CONNS[i].s = "Syncing"`, `d.links = links`) plus a `force(n=>n+1)` counter to trigger re-render — works, but is invisible to React.
- **No routing.** No URL, no deep links, no browser back/forward, no shareable state.
- **All styling is inline.** Only ~30 CSS classes exist; everything else is an inline `style` object, so there is no theming layer beyond CSS variables and no way to override presentation per-tenant.
- **`dangerouslySetInnerHTML`** appears once (the manager synopsis delegation rows, to render `&amp;`).
- **React development builds + in-browser Babel** — appropriate for a prototype, unacceptable for production.
- **Duplicated components:** `Icon`-style dropdowns are re-implemented at least four times (`AlertsDd`, `Dd`, native `<select>` with `selSt`, `Sel` from `SettingsKit`); `modal()` exists in `SettingsKit` while several modules hand-roll their own; step-wizard headers are re-implemented five times.

---

## 26. Productionisation notes

If this prototype becomes the specification for a real build, the following are the decisions it has already made and the ones it has left open.

### 26.1 Already specified — treat as requirements
1. **The AI Synopsis is the home page**, and its structure is role-specific. Three distinct briefing templates (Operator / Line Manager / Executive) with the SQDCP scaffold for managers.
2. **Investigation gating.** An Open alert must be investigated before its analysis is available, and the investigation is initiated from the assistant, not the page.
3. **Full reasoning transparency.** Pipeline stages, durations, token counts, tool names, detector scores, baseline statistics, and the verdict rule that fired must all be inspectable.
4. **Document inheritance.** One upload, scoped at instance / model / site / enterprise, linked to typed objects, resolved per asset with a visible `via` provenance chip.
5. **Per-source-type data contracts.** Connectors are not interchangeable: each category needs its own config schema, its own mapping semantics, its own wizard copy, its own discovery output, and an explicit statement of what it does *not* provide.
6. **Human-in-the-loop contextualisation** with a ≥90% auto-accept threshold and Accept / Reject / Re-link on everything below.
7. **Reason capture on every alert state change**, explicitly labelled as feedback for model improvement.
8. **AI-drafted artefacts are visibly labelled** (`AI-DRAFTED`, `AI pre-filled`) and always editable before commit.
9. **Honest retrieval failure** in the assistant — name the missing source and route to the fix.
10. **Colour-blind mode as a first-class feature**: token-level palette swap (Wong 2011) plus redundant shape glyphs.
11. **Print as a supported output** for anomaly reports and shift handovers.
12. **Teams grant site access as a union and never revoke; personal preferences beat team defaults.**
13. **Commercial gating by module** with Core vs Phase 2 tiers and metered usage.
14. **Tamper-evident audit log** with per-event hashes and SOC 2 / ISO 27001 export.

### 26.2 Immediate fixes before any demo
1. Add the `rca` route (or remove both links to it).
2. Add the five missing icons — `download`, `file`, `book`, `layers`, `clock`.
3. Implement or delete `CopilotBtn`.
4. Reconcile the module count (5 vs 8) and role count (6 vs 7) badges.
5. Pick one site universe. The four parallel fictions are the biggest credibility risk in a live demo — a reviewer who clicks from OEE (Chennai) into Lines & Assets (Findlay) will notice.
6. Fix `ts()` to honour `freezeAt` so the Frozen Signal alert's chart matches its narrative.
7. Add `SERIES.cur` so Motor Current is not an OEE curve.
8. Populate `line`, `source` and `confidence` on the alert records so the breadcrumb, "Generated by AI" chip and confidence figure become real.

### 26.3 Architectural rewrite targets
| Prototype pattern | Production replacement |
|---|---|
| `window.*` globals | ES modules + a typed API client |
| 13 `__forge*` imperative bridges | a state store (Zustand/Redux) or React context + an event bus |
| Direct registry mutation + `force()` | server state via React Query / SWR with cache invalidation |
| No routing | React Router or Next.js with deep-linkable URLs for every drill-down (`/assets/BM-03/timeseries`, `/alerts/ALR-1024/analysis/reasoning`) |
| Inline styles | CSS Modules / Tailwind / vanilla-extract, keeping the existing CSS-variable token layer |
| Decorative `Pager` | real server-side pagination, sorting and filtering |
| In-browser Babel + dev React | Vite build, production React |
| `<div onClick>` | semantic `<button>` / `<a>`, `role="treeitem"` for trees, `role="tablist"` for tab strips, full keyboard support, focus trapping, `Escape` handling |
| Synthetic generators | a time-series API (the prototype's own suggestion: InfluxDB/Timescale) with downsampling per timeframe |
| Four site fictions | one seeded demo tenant |

### 26.4 Backend surface implied by the UI
The prototype effectively specifies these services:

- **Asset registry** — hierarchy CRUD (6–9 levels), bulk import with column mapping and validation, model↔instance relationships, component/BOM trees, spare-part reorder points
- **Time-series service** — multi-channel query with timeframe downsampling (1H–30D), statistics (min/max/mean/σ/P95), correlation, threshold/band metadata, quality codes
- **Anomaly service** — detector ensemble, qualification gate, fusion scoring, cascade rules, escalation ladder, lifecycle state machine with reason capture
- **RCA/agent service** — tool-calling agent (`calculate_regression`, `get_signal_trends`, `get_failure_history`, `get_logbook_entries`), causal-chain generation, similar-case retrieval, verdict with observations
- **Knowledge service** — document store with scope + typed links, OCR + entity extraction, vector index for retrieval, inheritance resolution per object
- **Graph service** — typed nodes/edges, natural-language query
- **Ingest service** — 5 connector families, per-category mapping, pipelines with transform steps and schedules, write-back to CMMS/ERP
- **Work-order service** — 6-state lifecycle, AI drafting with parts/skills/duration estimation, CMMS sync
- **Shift service** — schedule, handover generation and acknowledgement, logbook with semantic search
- **Identity & governance** — users, teams (union scoping), 34-feature RBAC, SSO/SAML, MFA, sessions, IP allowlist, API keys with scopes, webhooks, hashed audit log
- **Billing/metering** — per-module entitlement, sensor-tag/API-call/storage meters

### 26.5 What is genuinely excellent and should be preserved verbatim
- The **`SecInsight` pattern** — AI narration placed above a chart in plain body type, explaining what to notice.
- **Per-datapoint AI hover reasons** on the OEE trend.
- The **investigation gate** and its synchronisation between the radar and the streaming Copilot response.
- The **`via` inheritance chip** on documents.
- The **"Resolves to N assets"** impact preview when editing document links.
- The **Data Contract tab**, especially the explicit "Not provided ·" statement per connector.
- The **material-flow lane diagram** with starvation propagation and the "Washer is the constraint" callout.
- The **Reasoning tab's typed observations** with real baseline statistics.
- The **negative Copilot case** that names the missing source and routes to Data Fusion.
- The **"Comments (for AI training)"** field on every alert action.
- The **model transparency card** (version, retrain date, sample count, F1, this asset's contribution share).
- The **colour-blind implementation** — token swap plus redundant shape glyphs.
- The **`PinnedSensors`** live/event dual-mode panel.
- The **import UX values statement** — "Calm, forgiving, and reversible" — and the promised 24-hour one-click undo.

---

*End of document.*
