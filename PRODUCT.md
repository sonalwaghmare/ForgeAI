# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Established in the repo: **React 19 + Vite 8**, npm (package-lock.json present), ESLint 10.

Confirmed additions for the rebuild:

- **Routing** — React Router. Every drill-down must be a deep-linkable URL (`/assets/BM-03/timeseries`, `/alerts/ALR-1024/analysis/reasoning`). The design prototype has no routing at all; this is the single largest structural change.
- **Styling & components** — Tailwind CSS + **shadcn/ui as the full component layer** (tables, dialogs, drawers, dropdowns, tabs, selects, toasts) including its chart component, which wraps **Recharts**.
- **Data** — **TanStack Query** over a mock/fixture layer. Screens consume hooks only; fixtures answer them today, a real client answers them when the APIs land, so the swap is confined to one module. The seam is an **axios adapter**, not a mocked service module: because the mock satisfies the same adapter contract, interceptors, header injection, timeouts, cancellation and error normalisation all execute identically in both modes, and `VITE_API_MODE=live` is the whole change. **Redux is deliberately absent** — it was requested and then declined once the split was clear: TanStack Query owns server state, and the client state that outlives a route (scope, theme, colour-vision mode, assistant grounding) is small enough that React context is the honest answer. Revisit if genuinely cross-cutting client state appears.
- **Language — JavaScript with JSDoc, not TypeScript.** Chosen explicitly. The consequence is that the "typed mock layer" is typed by JSDoc annotation and by two executable harnesses (`npm run verify:mocks`, `npm run verify:i18n`) rather than by the compiler. This is the weakest point in the foundation: the ISA-95 hierarchy and detector vocabularies are deeply nested, and nothing prevents a fixture shape from drifting away from what a component reads except those harnesses. Keep them in CI.
- **Internationalisation** — **react-i18next** with ICU message format for plurals and gender. My call, not a stated requirement: it is the conventional choice for Vite + React, and because every string goes through `t()` regardless, swapping to Lingui or `react-intl` later is a build-config change rather than a rewrite. Formatting uses the platform `Intl` APIs, not the i18n library.

Open decision: several prototype visualisations have no Recharts equivalent and will need bespoke SVG regardless of the chart library — the 500-point dual-axis trace, the normalised cross-sensor overlay, the correlation matrix, the material-flow lane diagram, the ISA-95 tree, the 90-day alert heatmap, and the utilisation Gantt. Which of these are in scope is undecided.

## Users

Three primary personas, all confirmed by the design prototype, which writes a separate briefing for each:

- **Line Operator** (e.g. Arjun Mehta) — on the plant floor, on shift. Arrives pre-shift wanting: is it safe, what did the last shift hand me, what are my tasks, what should I watch. Works standing, often on a tablet, in a noisy environment with gloves. Needs answers, not analysis.
- **Plant / Line Manager** (e.g. David Okafor) — runs the Tier-1 daily huddle. Needs the shift's story in SQDCP order (Safety, Quality, Delivery, Cost, People), then a prioritised action list, then who to delegate each item to. Approves work orders and permits. Desk or control-room.
- **Executive / COO** (e.g. James Whitfield) — reviews the network across sites and lines. Needs: which site is at risk, what decision is waiting on me, what has this platform actually saved. Reads once a day, on a laptop.

A six-role governance model is also modelled and will be the basis of RBAC when it is implemented: Platform Admin, Executive, Operations Lead, Reliability Engineer, Maintenance Technician, Read Only — plus org-defined custom roles, over a catalogue of 34 permissions across 10 modules.

## Product Purpose

Forge AI is a **unified OT intelligence layer for manufacturing** that sits above the plant's existing systems rather than replacing them. It ingests live signals, business records, documents and vision events; resolves them into one contextual model of the plant; detects and explains developing equipment faults; and drives the resulting maintenance work back into the systems of record.

Success is that a developing failure is understood and acted on before it stops the line — and that the person acting can see exactly why the platform reached that conclusion.

## Positioning

Four things a neighbouring condition-monitoring or BI product could not truthfully claim:

1. **The reasoning is inspectable, not asserted.** Every finding exposes its full pipeline — which detectors fired and at what score, the qualification gate that let it through, the tools the agent called, the baseline statistics it compared against, and the named rule that produced the verdict.
2. **A role-adaptive conversational briefing is the home surface**, not a dashboard. What the platform says changes by who is reading and what their shift looks like.
3. **Knowledge inherits down the asset graph.** One document upload, scoped at instance / model / site / enterprise level and linked to typed objects, appears automatically wherever it applies — with the inheritance path shown, so a user always knows *why* they are seeing it.
4. **Connectors declare their own contract, including what they do not provide.** An OT historian supplies signals and explicitly not maintenance records; an ERP supplies records and explicitly not time-series. Each source family has its own configuration schema, mapping semantics and discovery behaviour.

## Operating Context

Factual parts of the working environment the product must respect:

- **Shift cycle** — three 8-hour shifts (Morning 06:00–14:00, Afternoon 14:00–22:00, Night 22:00–06:00) with a formal **handover** at each boundary: outgoing summary, carried-over alerts, pending actions, and an acknowledgement by the incoming lead.
- **Tier-1 daily huddle** run in SQDCP order.
- **Gemba walks** — managers physically walk the floor; the platform should be able to tell them where to start.
- **Asset hierarchy — Enterprise › Region › Sub-region › Site › Production line › Asset**, with sensors below assets. This is the organising spine of the whole product and it is now editable in Settings → Sites & Hierarchy.

  The API names the same tiers `region › subregion › plant › line › machine`, and the enterprise
  is the **account** — which has no endpoint at all, so the root of the tree cannot be renamed or
  removed from the product. The two vocabularies are mapped in one place
  (`src/features/hierarchy/api.js`) and the wire value is never translated.

  This **diverges from strict ISA-95 on instruction.** ISA-95 names Enterprise / Site / Area / Work Centre / Work Unit, and an earlier version of this document modelled Country, Area, Building and Floor as separate levels. Six tiers are the ones an administrator actually creates and maintains: **sub-region absorbs what was Country and Area**, and Building and Floor are gone from the tree. If they return they belong as attributes of a site, not as levels people navigate. The tier a node may contain is derived from its own tier, never chosen, so an asset cannot be hung off a region and produce a tree the rest of the platform cannot scope to.
- **Systems of record** — CMMS/ERP (SAP Plant Maintenance and S/4HANA, Oracle MES, IBM Maximo) own work orders, equipment master, notifications and materials. Forge AI writes back into them using their own transactions (order creation, status update, confirmation, notification, technical completion, component reservation) rather than becoming a parallel record.
- **Safety rituals** — LOTO (lockout/tagout) verification before intervention, PPE and guard-interlock checks, hot-work permits requiring management sign-off. Any AI recommendation touching equipment must defer to these.
- **Integrity Operating Windows (IOW)** — named process parameters with low/high limits, an owner, and violation state.
- **Preventive maintenance** — scheduled windows, typed plans (e.g. quarterly PM-Q), and step-by-step inspection checklists with per-step durations.
- **Operator logbook** — free-text shift observations that capture what sensors cannot, and which the diagnostic agent treats as evidence.
- **Source domain of the current fixtures** — beverage/tin-can manufacturing: an 8-station can-body line (Cupper → Bodymaker → Trimmer → Washer → Decorator → IBO Oven → Necker → Palletizer), measured in cans per minute.

## Capabilities and Constraints

**Scope** — a full rebuild of the ~30 screens in the design prototype, production-grade. Module groups: Overview (Home) · Monitor (Anomalies, OEE & Operations, Lines & Assets, Sensor Explorer, Shifts, Logbook) · Act (Work Orders, Data Fusion) · Agents (AI Copilot) · Insights (Executive Dashboard, Analytics & Reports) · Admin (Settings, 12 pages).

**Tenancy** — multi-tenant SaaS with **plan entitlement**. Organisation-scoped data; plan tier gates which modules render (the prototype models Core vs Phase 2 modules under a Professional plan); Billing & Usage and Modules & Plan are real product surfaces with metered usage (sensor tags, API calls, assistant sessions, storage).

**Devices** — desktop-first, with **tablet (landscape) support required for operator-facing surfaces**: Home briefing, My Tasks, Alerts, Asset Detail, Logbook. Dense analysis surfaces (Timeseries Workstation, Data Fusion mapping tables, Work Order kanban, floor map) may remain desktop-only. The prototype is desktop-locked today (`100vw/100vh`, `overflow: hidden`, fixed 212px sidebar) and has no responsive treatment at all.

**Deferred — build the seam, not the feature:**
- **Authentication / login.** The sign-in **screen** now exists at `/login` — three fields (account ID, user ID or email, password), full validation, real error and lockout states. The authentication **service** does not exist: the fixture layer checks one credential so the success and failure paths are exercised, but nothing is really verified and no route is guarded. Anyone can still reach `/app` directly. All current data is understood to sit behind that future boundary.
- **RBAC enforcement.** Roles and permissions will be implemented later. Nothing gates the UI today; the role switcher is a demo affordance that changes the AI briefing only.
- **Live APIs.** In active development, not available. Everything is built against the typed mock layer.

**Internationalisation — English only at launch, i18n-ready as a hard requirement.** No second locale ships now, but nothing may be built in a way that requires a refactor to add one:

- Every user-facing string goes through the i18n layer. No literal copy in JSX, including `aria-label`, `title`, `alt`, `placeholder`, toast text, empty-state copy and error messages.
- Layout is written with CSS **logical properties** (`border-inline-start`, `padding-inline`, `margin-inline-start`, `inset-inline`) so a future RTL locale is a `dir="rtl"` attribute rather than a stylesheet fork. Directional icons and transforms mirror off `[dir="rtl"]`.
- All dates, times, numbers, percentages, durations and relative times format through `Intl.DateTimeFormat`, `Intl.NumberFormat` and `Intl.RelativeTimeFormat`. Never hand-format. The prototype's hardcoded `DD/MM/YYYY` and `24h` become locale-derived defaults that an org can still override.
- Plurals use ICU rules, never `count !== 1 ? 's' : ''`. Live counts appear throughout ("3 alerts", "1 alert", "13 anomalies").
- Text containers carry a **+35% expansion budget** and no fixed widths.
- **AI output language is a config value that exists from day one** — an `aiOutputLocale` on the org, overridable per user, defaulting to `en` and plumbed through to the model on every request. Whether it is ever set to anything else is a later decision, but the parameter is not retrofitted.
- The Web Speech API voice briefing selects a voice matching `aiOutputLocale` and degrades gracefully when the OS has no matching voice — availability varies sharply by platform.

**Engineering units are site configuration, not a locale preference.** This is a safety property, not a formatting convenience. The unit of a reading belongs to the asset and its site: a German plant reads `bar` whether or not a US colleague is logged in, and a vibration threshold of `12.5 mm/s` must never silently become `0.49 in/s`. Locale formats the *numeral* (`1.000,5` vs `1,000.5`); the site owns the *unit*. This corrects the prototype, which has a single org-wide "Measurement Units: Metric/Imperial" toggle in Settings → General — wrong for any tenant spanning both conventions. Unit conversion for display, if ever offered, must show the canonical value alongside on any threshold, alarm, or work-order figure.

  **Currently unimplemented, and the gap is real.** The API's `Plant` model has no column for a
  unit system, so when Sites & Hierarchy moved onto the live API the control was removed rather
  than left collecting a value the server would silently discard. Until that column exists the
  units in the product are fixture-only: the demo universe still demonstrates the rule, and no
  real site can express it. Written up for the backend team in `BACKEND-GAPS.md` §1. This is the
  single most consequential thing outstanding on the hierarchy.

**Security** — OWASP ASVS 5.0 Level 1 + Level 2 must be satisfied (organisational baseline). Level 3 only if a client mandates it. Assessed in `SECURITY.md`, which records what is genuinely satisfied client-side and marks the rest `⊘ server` rather than ticking controls that have no server to enforce them. Three items are open and block a production MR: **no CSP is set**, **no dependency scan is in CI**, and **`react-router` carries one unavoidable high advisory** (GHSA-qwww-vcr4-c8h2 — no patched release exists above the affected range; the RSC code path is unreachable in a client-only SPA, and the exception needs tech-lead sign-off).

**Terminology** — OEE (and its Availability × Performance × Quality decomposition), MTBF, MTTR, IOW, LOTO, PM, WO, RCA, SQDCP, FPY (first-pass yield), OTIF (on time in full), ISA-95, cpm (cans per minute), fusion score (cross-sensor agreement, 0–100).

**The demo universe — settled.** The prototype's four mutually inconsistent worlds are replaced by **one**: **Meridian Industrial**, a fictional enterprise of three sites in three countries, defined in `src/mocks/fixtures/enterprise.js`.

- **Findlay Plant** (Findlay, Ohio, US) — modelled to asset depth: 3 lines, 14 assets. **Imperial**: `in/s`, `°F`, `psi`, `gal/min`.
- **Weißenthurm Works** (Rhineland, Germany) — modelled to line level. **Metric**: `mm/s`, `°C`, `bar`, `L/min`.
- **Pune Plant** (Western India) — modelled to line level. **Metric**.

Three countries rather than one because it is the only shape that makes the site-owned-units rule *observable*: `ALR-4471` at Findlay reads 0.60 in/s against a 0.49 in/s threshold, and `ALR-4468` at Weißenthurm reads 14.8 mm/s against 12.5 mm/s. Those two thresholds describe the same physical limit on the same class of machine. Nothing in the UI converts between them, and `src/lib/units.js` exports no `convert()` at all so no screen can casually reach for one.

Two sites stop at line level on purpose. A demo universe padded with invented equipment is less honest than one that says where its detail ends.

**Open decisions:**
- **No login screen exists**, so nothing sits behind an authentication boundary yet. Every fixture is reachable by anyone who loads the app. That is intended for a public demo but must not survive contact with real data.
- The non-Latin type stack (below) remains deferred but pre-decided.
- **The non-Latin type stack, deferred but pre-decided.** Space Grotesk covers Latin Extended only — no Cyrillic, CJK, Arabic or Devanagari. JetBrains Mono adds Cyrillic and Greek but no CJK. Since English is the only launch locale this blocks nothing today, but the prototype's Settings screens currently *offer* Japanese and its document metadata offers Hindi, which the brand faces cannot render. Recommended resolution when a locale is added: keep Space Grotesk as the Latin brand voice and append script-matched Noto faces (Noto Sans JP / SC / Devanagari / Arabic) with per-script `size-adjust` and line-height, so the identity survives where it can render and degrades to a well-made neutral face where it cannot. Until then, remove the unrenderable options from those selects rather than promising coverage that does not exist.

## Brand Commitments

- **Name:** Forge AI. The assistant is addressed as "Ask ForgeAI" in the product.
- **Primary logo:** a supplied **wordmark** — "forge" plus "ai" — held as vector at `src/assets/forgeai-logo.svg` and rendered inline by `components/forge/BrandWordmark.jsx`. It is the logo everywhere there is horizontal room: the top bar, the sign-in header, and the public page's header and footer.

  **Its "ai" is Forge Orange, not the violet the artwork arrived in.** The supplied file set it in violet, which collided with the rule reserving violet for AI authorship; recolouring to the brand accent resolves that outright. The letterforms take the theme's ink, so the mark is near-black on the warm page and near-white in the control room from one asset. See DESIGN.md corrections 16 and 17.
- **Icon mark:** the hexagonal neural glyph — outer hexagon, inner hexagon, six vertex nodes with spokes to a lit core. **Retained, and demoted from primary logo to icon mark**, because the supplied wordmark contains no hexagon and a 3:1 wordmark cannot occupy a square. It carries the 60px collapsed rail and any square slot, and still works from a 10px inline chip upward.
- **Favicon:** `public/favicon.ico`, supplied. One 32×32 frame; there is no 16px or 48px frame and no SVG variant, so it is upscaled where a browser or OS wants a larger icon.
- Existing prototype assets: `ForgeAI_Lockup_Dark.svg`, `ForgeAI_Lockup_Light.svg`, `ForgeAI_Icon_Amber.svg`, `ForgeAI_Icon_Copilot.svg` (in the Claude Design project's `uploads/`).

The prototype's visual language (palette, typography, surface treatment) is the stated reference — "we want the UI to look like this or better" — but which parts are binding versus improvable is a visual-world decision, recorded in DESIGN.md rather than here.

## Surfaces Built

Several surfaces exist on the new foundation. The remaining screens are placeholders that name themselves rather than faking content.

- **`/` — public page, Persuade mode.** Structured as a **shift handover**: the document every person in this audience already fills out. Outgoing summary in SQDCP order, the anomalies being carried across the boundary, the actions still pending, then an acknowledgement — which is where the primary action naturally sits, so conversion lives inside the form's own vocabulary. It renders through the product's own components and query layer, so it cannot drift out of sync with the application and nothing on it is a screenshot. Direction contract is an HTML comment in `index.html` (seed key `d5149973`) and survives the production build.
- **`/app/anomalies` — Operate mode.** The flagship operational surface: six working facet tiles that filter through request params, severity chips, the AI narration line, real loading / error / empty states, and selection that re-grounds the assistant dock.
- **`/app/settings/asset-classes` — Operate mode.** Asset Classes: the account's library of reusable types, and **the first business surface running against the live API** rather than fixtures. An asset class is a template, not a machine — a machine model, a line configuration, a site blueprint, a sensor type — and Plant, Line and Machine each carry a nullable `asset_class_id` pointing at one, so this holds what the hierarchy's records are instances of.

  Three constraints come straight from the server and are visible in the UI rather than discovered by a failed save. **`entity_type` is fixed at creation** — the update schema accepts a name and nothing else — so rename states the type as a fact instead of offering a control that would be discarded. **Deletion is soft**, so anything already assigned keeps an assignment that still resolves, and the confirmation says so rather than implying a cascade. **`name` is capped at 150 characters**, enforced on the input as well as validated on submit.

  Its four types are the API's `plant / line / machine / sensor`, labelled in this product's own vocabulary — **Site / Production line / Asset / Sensor**. The wire value is never translated; only the label moves. Introducing "Plant" and "Machine" would give the product two words for one tier, a Site on one settings page and a Plant on the next.

## Evidence on Hand

**Real:**
- The design prototype — Claude Design project `019e11cf-49a7-744a-b634-e0d248971607`, entry `Forge AI Platform.html` plus 31 `platform/*.jsx` modules (~1.05 MB). This is the behavioural and visual reference.
- `FORGE_AI_PRODUCT_UNDERSTANDING.md` in this repo — a complete analysis of that prototype: architecture, IA and routing, all screens, domain model, seed-data inventory, and a fidelity audit of its defects and gaps.
- Prototype source references naming real industrial vendors and standards (Stolle, Howden, ABB, SKF, KBA-Metalprint, Grundfos, OPC-UA, Modbus, SAP transaction codes). These are plausible and domain-correct but are **not** integration commitments.

**Not real — must never be presented as measured:** every figure in the prototype is dummy placeholder data that will be replaced by real API responses. This explicitly includes $3.8M downtime avoided YTD, $1.2M downtime cost MTD, 96.4% OTIF, 99.1% FPY, 142 days without incident, 2,838 sensors, 12,847 tags monitored, 18,400 graph relationships, the F1 0.91 model score, and all OEE, MTBF, MTTR, confidence and health values.

**Absent — do not fabricate:** customers, testimonials, case studies, logos, press, benchmarks, pricing, SLAs, certifications, deployment references, or named client engagements.

## Product Principles

1. **Explain, don't just alert.** A finding without its reasoning is not a finding. Detector scores, baselines, the rule that fired, and the evidence trail are part of the deliverable, not an advanced view.
2. **Brief by role, not by dashboard.** The same plant state should produce a different, shorter, more actionable read for an operator than for a COO.
3. **Sit above the systems of record.** Never become a parallel truth for equipment master, work orders or materials. Read from them, write back into them, and be explicit about what each source does and does not own.
4. **Provenance is always on screen.** Why this document applies here, which tag fired, which tool produced this number, when the data was last refreshed.
5. **AI output is labelled and editable before it commits.** Drafted work orders, handovers and summaries arrive marked as generated and always pass through a human who can change them.
6. **Safety procedure outranks the recommendation.** Anything that touches equipment defers to LOTO, permits and site procedure, and says so.

## Accessibility & Inclusion

**Target: WCAG 2.2 AA — currently NOT met on colour contrast, by decision.**

The target stands for everything else and is not being abandoned. But as of the palette change recorded in DESIGN.md correction 18, the product uses the Claude Design prototype's colours exactly, and those put on-tint badge text between **1.3:1 and 2.9:1** against a 4.5:1 requirement, with Ink Dim at 3.9:1 and Ink Muted at 2.8:1. The medium-severity badge is effectively unreadable. This was requested explicitly and is recorded here rather than removed, because the conditions below are the reason the target existed and they have not changed.

**Restoring it is an edit to one file.** `src/styles/tokens.css` is the only place in the app a colour may appear — enforced by `npm run verify:colors` — and the previously-measured passing values are kept in comments beside the tokens they replaced. Seven `--on-*` values and two ink opacities, and every one of the ~99 call sites follows.

Product-specific needs already established:

- **Colour-vision deficiency** is a first-class concern, not a setting. The prototype ships a colour-blind mode that swaps the entire status palette to the Wong (2011) safe set *and* adds redundant shape glyphs to every severity badge (◆ critical, ▲ high, ● medium, ■ low, ✓ ok). Severity must never be carried by hue alone.
- **Gloved, standing, tablet use** on the plant floor for operator surfaces — touch targets and hit areas sized accordingly (44px minimum).
- **Ambient conditions on the floor:** bright, often daylit through roof lights, with glare on the screen, read at roughly arm's length, sometimes through safety glasses. This drives a minimum type size on operator surfaces and rules out low-contrast greys there.
- **Plant owners and site managers** read the same executive surfaces as the COO persona; an owner-operator of a single site is that persona scoped to one plant, not a fourth one.
- **Print** is a real output for anomaly reports and shift handovers.
- **Reduced motion** must be honoured; the prototype animates radars, pulses and carousels.
- The prototype's largest accessibility failure is that nearly every interactive element is a `<div onClick>` — unfocusable, keyboard-dead, and role-less. Choosing shadcn/ui as the full component layer is partly to fix this at the foundation.
