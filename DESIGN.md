---
name: Forge AI
description: Industrial intelligence platform where the machine shows its reasoning
# ⚠ NOT THE SOURCE OF TRUTH. src/styles/tokens.css is — it is the only file in
# the app that may hold a colour, and it carries light, dark and colour-blind in
# one place. This block is a summary for tooling that reads frontmatter; when the
# two disagree, the CSS is right. See The Single-Palette Rule.
colors:
  forge-orange: "#F26522"
  signal-green: "#30D158"
  caution-amber: "#FF9F0A"
  trip-red: "#FF453A"
  reasoning-violet: "#BF5AF2"
  watch-yellow: "#FFD60A"
  acknowledged-cyan: "#06B6D4"
  line-cyan: "#22D3EE"
  source-orange: "#F97316"
  context-violet: "#A78BFA"
  accent-tint: "rgba(242,101,34,0.14)"
  violet-tint: "rgba(191,90,242,0.14)"
  surface-page: "#FAF9F7"
  surface-sunken: "#F3F1EC"
  surface-card: "#FFFFFF"
  surface-nav: "#FBFBFD"
  border-hairline: "rgba(0,0,0,0.09)"
  border-subtle: "rgba(0,0,0,0.055)"
  row-alt: "rgba(0,0,0,0.018)"
  text-primary: "#1A1A1A"
  text-dim: "rgba(26,26,26,0.60)"
  text-muted: "rgba(26,26,26,0.40)"
  on-forge: "#F26522"   # = forge-orange · Tint-Text Rule suspended
  on-green: "#30D158"   # = signal-green
  on-amber: "#FF9F0A"   # = caution-amber
  on-red: "#FF453A"     # = trip-red
  on-violet: "#BF5AF2"  # = reasoning-violet
  on-watch: "#FFD60A"   # = watch-yellow
  on-ack: "#06B6D4"     # = acknowledged-cyan
  dark-surface-page: "#0A0A0F"
  dark-surface-sunken: "rgba(255,255,255,0.10)"  # --glassHi, the role bg-sunken plays
  dark-surface-card: "rgba(255,255,255,0.06)"
  dark-surface-raised: "rgba(255,255,255,0.10)"
  dark-border-hairline: "rgba(255,255,255,0.10)"
  dark-border-subtle: "rgba(255,255,255,0.06)"
  dark-row-alt: "rgba(255,255,255,0.025)"
  dark-text-primary: "#F5F5F7"
  dark-text-dim: "rgba(245,245,247,0.62)"
  dark-text-muted: "rgba(245,245,247,0.38)"
  cb-trip-red: "#D55E00"
  cb-signal-green: "#009E73"
  cb-caution-amber: "#E69F00"
typography:
  display:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.5px"
  headline:
    fontFamily: "IBM Plex Sans, -apple-system, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.3px"
  title:
    fontFamily: "IBM Plex Sans, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "IBM Plex Sans, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  bodySmall:
    fontFamily: "IBM Plex Sans, -apple-system, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.55
  metric:
    fontFamily: "IBM Plex Sans, -apple-system, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.5px"
    fontFeature: "tnum"
  control:
    fontFamily: "IBM Plex Sans, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.2
  label:
    fontFamily: "IBM Plex Sans, -apple-system, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.5px"
  micro:
    fontFamily: "IBM Plex Sans, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
  metricSm:
    fontFamily: "IBM Plex Sans, -apple-system, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.5px"
    fontFeature: "tnum"
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "tnum"
rounded:
  xs: "5px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  2xl: "16px"
  pill: "20px"
  full: "50%"
spacing:
  "0.5": "2px"
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "2.5": "10px"
  "3": "12px"
  "3.5": "14px"
  "4": "16px"
  "4.5": "18px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  "14": "56px"
  "20": "80px"
components:
  button-primary:
    backgroundColor: "{colors.forge-orange}"
    textColor: "#FFFFFF"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    typography: "{typography.control}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-icon:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-dim}"
    rounded: "{rounded.lg}"
    padding: "8px"
    size: "34px"
  chip:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-dim}"
    typography: "{typography.bodySmall}"
    rounded: "{rounded.sm}"
    padding: "5px 11px"
  chip-on:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.forge-orange}"
    typography: "{typography.bodySmall}"
    rounded: "{rounded.sm}"
    padding: "5px 11px"
  input:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 13px"
  card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "18px"
  card-flush:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.sm}"
    padding: "0"
  badge:
    typography: "{typography.bodySmall}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  nav-item:
    textColor: "{colors.text-dim}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
  nav-item-active:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.forge-orange}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
  table-header-cell:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.text-dim}"
    typography: "{typography.label}"
    padding: "11px 14px"
  table-cell:
    textColor: "{colors.text-primary}"
    typography: "{typography.bodySmall}"
    padding: "11px 14px"
---

# Design System: Forge AI

## Overview

**Creative North Star: "The Reasoning Machine"**

Forge AI looks like an apparatus with its casing off. Most industrial software hides its logic and hands you a verdict; this one renders the *working* as the material — detector scores, baseline statistics, tool calls, causal chains, confidence, the rule that fired. The visual system exists to make that evidence legible at speed, not to decorate it. Every surface is a place where the machine is either showing its state or showing its reasoning, and the design's whole job is to keep those two things distinguishable at a glance.

That produces a deliberately restrained world. The default surface is a warm off-white, near-monochrome, ruled by hairlines rather than shadows. Text carries the hierarchy through weight and size; colour carries almost nothing except meaning. Numbers are always tabular so a column of readings scans as a shape rather than as words. Density is high — this is software for people who read fifteen values before making a decision — but density is achieved by removing chrome, never by removing breathing room between groups.

Two colours are load-bearing and both are rationed. **Forge Orange** is the brand and the interactive accent. **Reasoning Violet** means one thing only: this was authored by the AI. A violet leading edge, a violet icon, a violet-tinted chip — each is a claim about provenance, and the moment violet becomes decorative the product's central promise stops being readable. The rest of the palette is machine state: green running, amber watch, red tripped.

**The anti-reference is generated-looking software.** Confirmed by the client: this must not read as "AI slop". That failure mode has specific tells — violet-to-blue gradients (especially on AI affordances), sparkle icons, everything at a 16px+ corner radius, a uniform drop shadow under every card, emoji standing in for icons, rainbow chart series whose colours mean nothing, centred gradient headlines, "Welcome back!" copy, abstract blob illustrations in empty states, and a grid of identically-sized tiles where nothing is more important than anything else. Two further rejections: the undifferentiated trading terminal (density without hierarchy) and the chat-first assistant (a text box where the data should be).

The underlying test is one question, and it is the most useful rule in this document. **Point at any visual property and ask what it tells you.** Colour tells you state or authorship. A stripe tells you severity. Monospace tells you a machine wrote the string. Tabular figures tell you the column is comparable. Size tells you importance. If the honest answer for some property is "nothing, it just looks nice" — that property is slop, and it comes out. This is also why the system reads as modern rather than decorated: nothing is present for style alone, so nothing looks applied.

**Key Characteristics:**
- Near-monochrome by default; saturated colour is state or authorship, never emphasis
- Hairline borders and tonal layering instead of shadow stacks in the primary (light) theme
- Tabular numerals on every figure, without exception
- A 3px coloured leading edge (`border-inline-start`) as the primary severity and authorship device
- Reasoning surfaces — traces, evidence, causal chains — are first-class UI, not disclosure panels
- Redundant encoding for state: colour plus shape glyph plus text label, always

## Colors

A near-monochrome warm-neutral ground carrying five rationed semantic hues, where hue is reserved for machine state and AI authorship.

### Primary
- **Forge Orange** (`#F26522`): The brand and the only interactive accent. Primary buttons, active navigation, focused inputs, links inside prose, selected chips, the location-scope icon. Also the "worth clicking" signal on hover borders. Never used to mean a severity level — it is identity and interaction, not state.

### Secondary
- **Reasoning Violet** (`#BF5AF2`): AI authorship, and nothing else. The Copilot mark, AI-drafted card leading edges, `AI-DRAFTED` pills, `AI Analyzed` tags, the investigation radar, and `SecInsight` narration icons. Always **flat** — never a gradient. The prototype rendered the assistant's avatar and launcher as a 135° violet-to-blue gradient, which is the single most recognisable generated-software signature in current software and is removed here. Flat violet plus the node glyph carries the same meaning with none of the smell. If violet appears on a surface a human wrote, the system has broken.

### Tertiary
- **Signal Green** (`#30D158`): Running, healthy, connected, on-plan. Live indicators, health ≥ 80, connected sources, "142 days clean".
- **Caution Amber** (`#FF9F0A`): Warning, high severity, watch. Health 50–79, drift alerts, near-limit meters, afternoon shift.
- **Trip Red** (`#FF453A`): Critical, violation, offline, tripped. Health < 50, IOW breaches, disconnected sources, overdue PM.
- **Watch Yellow** (`#FFD60A`): Medium severity specifically. The fourth step in the severity ladder, distinct from Caution Amber so that high and medium never collapse into one another on a dense list.
- **Low severity carries no hue at all.** The five-step ladder is critical → red, high → amber, medium → watch, **low → neutral** (sunken fill, dim ink, the ■ glyph, the text label), ok → green. An earlier draft assigned Forge Orange to low, which contradicted this document's own rule that the accent is identity and interaction and never a severity. Neutral is also the truer answer: a low-severity anomaly is a note, not the machine raising its hand, and The Rationed Hue Rule says colour is how it raises its hand. A low card therefore takes no leading edge either — the badge carries it.
- **Acknowledged Cyan** (`#06B6D4`): The Acknowledged alert state — deliberately outside the severity ramp, because "someone has this" is a different axis from "how bad is it".
- **Dismissed Blue** (`#0A84FF`): The Dismissed anomaly state, on that same non-severity axis. Not green — resolved means the machine was attended to, dismissed means a person judged the detection not worth acting on, and colouring both as an all-clear would say the plant is fine where nobody actually looked. Not Watch either: medium severity owns that hue, and a medium dismissed anomaly would carry two watch pills meaning different things. The value is the prototype's own leftover blue, still sitting in `.chip.on` as `rgba(10,132,255,0.14)` from before the accent became orange (correction 4), so the palette keeps its Apple-system provenance rather than gaining an invented hue.
- **Line Cyan** (`#22D3EE`): The Production Line tier in the ISA-95 hierarchy. Hierarchy levels get their own hue ladder: Enterprise violet, Region orange, Site green, Line cyan, Asset neutral. **Still unimplemented, and two of its entries cannot be honoured as written** — Enterprise violet collides with The Violet Reservation, Region orange with the rule that Forge Orange is interaction and never state. A per-tier version of the anomaly trail was built against this ladder and rejected in review: three hues on the quietest line of a card already carrying three badges reads as decoration. The trail takes **Forge Orange for the whole path** instead, matching the prototype. That is accent colour on text that is not itself clickable — a knowing trade, recorded in `components/forge/HierarchyTrail.jsx`, and self-correcting once an asset screen exists for those segments to link to.
- **Source Orange** (`#F97316`) / **Context Violet** (`#A78BFA`): A signature pair. In any multi-sensor evidence panel, the sensor that *caused* the anomaly is warm; every sensor providing *context* is cool. Cause versus corroboration, encoded in temperature.

### Neutral
- **Paper** (`#FAF9F7`): The page ground. Warm off-white, never pure white — pure white next to white cards destroys the card edge.
- **Card** (`#FFFFFF`): Raised surfaces. In light theme the card is the *lighter* element against a warmer page, which is the inverse of most dark-first systems and is what lets hairlines do the work of shadows.
- **Sunken** (`#F3F1EC`): Table headers, hovered rows, sunken wells, inset toggle tracks.
- **Nav** (`#FBFBFD`): The sidebar. A hair cooler and brighter than the page, which separates chrome from content without a border doing all the work.
- **Ink** (`#1A1A1A`) / **Ink Dim** (60%) / **Ink Muted** (40%): Three text weights in light theme, at the prototype's own opacities. Primary for values and headings, dim for prose, secondary fields, eyebrows, units, timestamps and placeholders, muted for the quietest captions and for icon strokes, dividers and decorative rules. Dark theme: dim 62%, muted 38%. **Ink Dim measures 3.9:1 on card and Ink Muted 2.8:1, so neither clears 4.5:1** — an accepted regression alongside the suspended Tint-Text Rule, reverted by raising the two opacities in `tokens.css` (68% / 45% light, 72% / 45% dark measured 6.0:1 and passing). See correction 18.
- **Hairline** (9% black) / **Subtle** (5.5% black): Two border weights only. Hairline separates components; Subtle separates rows inside one component.

### Named Rules

**The Violet Reservation.** Reasoning Violet marks AI authorship and nothing else. It is never an accent, never a chart series, never a brand flourish. When you want emphasis, reach for weight, size or Forge Orange.

**The Rationed Hue Rule.** On a screen at rest, saturated colour should occupy well under 10% of the pixels. If a screenshot reads as colourful, state has stopped being visible. Colour is how the machine raises its hand.

**The State-Is-Never-Only-Colour Rule.** Every severity is encoded at least twice — hue plus a shape glyph (◆ critical, ▲ high, ● medium, ■ low, ✓ ok) plus a text label. In colour-blind mode the palette swaps to Wong (2011) safe values (Trip Red → `#D55E00`, Signal Green → `#009E73`, Caution Amber → `#E69F00`) and the glyphs become visible. Because these are tokens, the swap propagates to every badge, dot, border, chart line and meter automatically — so never hardcode a status colour.

**The Warm Ground Rule.** The page is `#FAF9F7`, not `#FFFFFF`. Cards are white. Reversing this — white page, grey cards — inverts the depth model and every hairline stops reading.

**The Single-Palette Rule.** Every colour in the product lives in **`src/styles/tokens.css`** and nowhere else — light, dark and colour-blind, hues, surfaces, inks, shadows, even the print black and white. No component, page or other stylesheet may contain a hex, `rgba()` or `hsla()`. `npm run verify:colors` enforces it and runs inside `npm run verify`, so the rule is mechanical rather than remembered.

The point is not tidiness. A literal ignores `data-theme`, ignores colour-blind mode, and looks correct in whichever theme its author had open — so it fails silently, for a subset of users, in a way review does not catch. It also means retuning the entire product's colour, including restoring accessibility, is an edit to one file rather than a sweep through fifty. Adding a colour means adding a token and a `@theme inline` alias; that is the whole cost.

**The Tint-Text Rule — SUSPENDED.** *This rule is currently reversed on instruction. See correction 18.* It read: a semantic hue is the *fill* value and never the text value, because on a 16% tint of itself every hue fails contrast at its token value — Watch Yellow near 1.3:1, Signal Green near 1.8:1, Trip Red near 2.8:1, Forge Orange near 2.6:1. Seven derived on-tint steps each cleared 4.5:1: Forge `#A33F0E`, Green `#14672C`, Amber `#8A5300`, Red `#B3261E`, Violet `#6B2894`, Watch `#6B5000`, Acknowledged `#0B5F70`, brightening rather than darkening on a dark ground.

The measurement stands and is not in dispute. What changed is that the product now matches the Claude Design prototype's palette exactly, and the prototype has no separate text step — a badge sets its text to the hue. So `--on-*` alias `--hue-*` in both themes, and on-tint text does not meet WCAG 2.2 AA. **Restoring this rule is a seven-line edit in `tokens.css`**; the passing values are kept in a comment beside the tokens for exactly that purpose, and all ~99 `text-on-*` call sites pick the change up with no other edit.

## Typography

**Display Font:** Space Grotesk (with IBM Plex Sans, then `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif)
**Body Font:** Space Grotesk — one family carries both roles
**Label/Mono Font:** IBM Plex Mono (with `ui-monospace`, monospace)

**Character:** A wide, squared-off grotesque against a true engineering mono — see correction 19 for why this pairing, and for the reasoning it reversed. Space Grotesk's flat terminals and near-rectangular bowls hold a 10px uppercase eyebrow without turning to mush and give a page title presence at 28px that a neutral grotesque does not. IBM Plex Mono keeps the machine register: an asset tag reads as a different *kind* of string, which is the whole job of The Mono-Means-Machine Rule, and it carries genuine tabular figures — which this product depends on absolutely and which the sans cannot be assumed to provide.

**IBM Plex Sans stays loaded, second in the stack, and it is load-bearing.** Space Grotesk ships Latin, Latin-ext and Vietnamese only. Cyrillic, Greek and every script sibling The Script-Coverage Rule depends on fall through to Plex, so removing it from `--font-sans` silently hands those locales to whatever the OS has.

### Hierarchy
- **Display** (600, 28px, −0.5px tracking): Page titles only. One per screen.
- **Headline** (600, 20px, −0.3px): Section titles within a page.
- **Title** (600, 16px): Card headings.
- **Body** (400, 14px, 1.5): Default prose and table cells. Cap AI narrative and briefing prose at roughly 70–80ch — the Home synopsis and Alert narratives run to paragraphs and need a real measure.
- **Body Small** (400, 12.5px, 1.55): Secondary prose, card descriptions, dense table cells, the Copilot dock.
- **Metric** (600, 28px, −0.5px, tabular): The big number on a KPI card. Same size as Display but a different role — never a page title.
- **Control** (600, 13px): Buttons, selects, tabs, interactive labels.
- **Micro** (600, 11px): Badge, status pill and chip text. The smallest step that carries meaning — never smaller, and it steps up on tablet.
- **Metric Small** (600, 26px, −0.5px, tabular): The figure inside a compact facet tile, where the full 28px Metric would crowd its container.
- **Label** (700, 10px, +0.5px, uppercase): Eyebrows, table headers, stat captions, group headings in navigation. The workhorse of the whole system. Never 9px — the prototype's 9px navigation headings round up to this step.
- **Mono** (500, 12px, tabular): Asset IDs, alert IDs, sensor tags, timestamps, endpoints, OPC node paths, hashes, action codes.

### Named Rules

**The Tabular Numerals Rule.** Every number the user might compare — health scores, OEE, thresholds, counts, durations, currency, timestamps — uses `font-variant-numeric: tabular-nums`. A column of proportional figures cannot be scanned, and this product is columns of figures. There is no exception.

**The Mono-Means-Machine Rule.** Monospace marks strings the system minted: `BM-03`, `ALR-1024`, `WO-4418`, `ns=2;s=PLC1.BM03.VibX`, `USER_INVITED`, `sha256:9f2b…e41a`. Human-written text is never monospace, and a machine identifier is never set in the body face — the distinction is load-bearing when an operator is dictating an ID over a radio.

**The Eyebrow Rule.** A card or section is introduced by a 10px/700/uppercase label in Ink Muted — but only when that label names something the heading does not. In a control surface holding fifteen cards, many of which are a chart or a table with no heading at all, the eyebrow is wayfinding: it says what *kind* of thing this is (`TRIGGERED ANOMALY`, `SUPPORTING EVIDENCE`, `SEVERITY ESCALATION`). That is information. An eyebrow that paraphrases the heading beneath it is decoration, and decoration above a heading is the oldest tell in generated design — delete it and let the heading carry itself.

**The Latin-Convention Rule.** Uppercase and positive letter-spacing are Latin typographic devices, and the eyebrow style leans on both. They do not travel: uppercase is a no-op in CJK, Devanagari, Thai and Arabic, and letter-spacing actively breaks Arabic cursive joining. Author the eyebrow as a class whose `text-transform` and `letter-spacing` are disabled per script rather than baked into every call site, so a future locale is a stylesheet condition and not 200 edits. The eyebrow is also the most expansion-fragile element in the system — 10px, uppercase, tracked, and usually sitting in a fixed-width tile.

**The Floor-Legibility Rule.** The desktop scale is tuned for a control-room monitor at desk distance. It is too small for the plant floor. On operator surfaces at tablet width, nothing carrying meaning drops below **13px body / 12px secondary / 11px label**, and the 10px eyebrow and 9px nav label step up rather than shrink. The reader may be at arm's length, in gloves, under roof-light glare, wearing safety glasses. Density is a desk luxury; on the floor, legibility outranks it and the layout gives up a column instead of a point of type size.

**The Script-Coverage Rule.** IBM Plex ships genuine siblings for Devanagari, Arabic, Hebrew, Thai, JP, KR and SC/TC alongside Latin, Cyrillic and Greek — so a future locale is a subset request rather than a hunt for a second family with a different skeleton. This was a deciding factor in the face. The stack must still stay a *stack*, never a single hardcoded family, and each script sibling wants its own `size-adjust` and line-height because Devanagari and CJK sit differently on the baseline than Latin.

**The ASCII-Identifier Rule.** Machine identifiers stay ASCII and are never translated: `BM-03`, `ALR-1024`, `WO-4418`, `ns=2;s=PLC1.BM03.VibX`. This is the one place the Mono-Means-Machine rule pays an i18n dividend — an operator reading an asset tag over a radio in any locale reads the same characters. Never route an identifier through `t()`.

## Layout

**Application chassis.** A fixed full-height shell that never scrolls the document — `html, body { overflow: hidden }`, with scrolling confined to the content region and individual panels. Top to bottom: a 48px full-bleed top navigation (which measures itself into `--topnav-h` for anything that needs to offset below it), then a horizontal band containing a 212px sidebar, the scrolling content region, and an optional 360px assistant dock on the inline-end side. The sidebar collapses to 60px, keeping icons and tooltips.

**Content measure.** Pages use `24px` block padding and a horizontal page padding of `56px` by default (tunable 16–120px), capped at `1700px` max-width. The cap matters: several screens are 12-column tables and would otherwise stretch to unreadable line lengths on ultrawide displays.

**Nested navigation.** Two modules carry their own side navigation inside the content region rather than extending the global sidebar — Data Fusion at 222px and Settings at 240px. This is deliberate: those are configuration worlds with their own vocabulary, and promoting their 11–12 items into the global sidebar would drown the operational nav.

**Panel widths** are a small fixed vocabulary, not arbitrary: drawers at 380 / 400 / 540 / 560 / 580 / 620 / 720px, modals at `min(Xpx, 94–96vw)` from 470 to 1100px, and the assistant dock at 360px. Pick from the ladder rather than inventing a width.

**Spacing rhythm.** A 2px-base scale with 6, 8, 12, 14, 16, 18, 22 and 24px doing most of the work. Inside a card, 8–12px between related rows and 14–18px between groups; between cards, 12–16px; between major page sections, 18–24px.

**Grids** are `repeat(auto-fit, minmax(Npx, 1fr))` far more often than fixed column counts, with minima from 120px (stat tiles) to 340px (chart cards). Two-column analytical layouts use `minmax(0, 1fr) minmax(260px, 320px)` — the `minmax(0, …)` is required or long tables blow out the track.

**Responsive behaviour.** Desktop-first. The primary target is ≥1280px. Operator-facing surfaces — Home briefing, My Tasks, Alerts list and detail, Asset Detail, Logbook — must also work on a landscape tablet (≥1024px): the sidebar collapses to icons, two-column layouts stack, and touch targets grow to a 44px minimum. Dense analysis surfaces (Timeseries Workstation, Data Fusion mapping tables, the Work Order kanban, the floor map) may remain desktop-only and should say so rather than degrade badly.

**Translation headroom.** English ships alone, but every layout is built to absorb a second locale without rework. Text containers carry a **+35% expansion budget** — German runs roughly a third longer than English, and very short strings ("On", "Due", "OEE") can double. That rules out the fixed pixel widths the prototype leans on: a 118px label column, 40px percentage pills, 170/180px metric blocks, and `white-space: nowrap` on navigation items, table headers and badge text. Size text containers by content with `padding` rather than `width`; give every flex and grid child `min-width: 0` so it can shrink below its content and truncate rather than overflow its track; and reserve truncation for values that are recoverable elsewhere — never for a severity label, a status, or a unit.

**Direction independence.** All box-model and border declarations use logical properties — `border-inline-start`, `padding-inline`, `margin-inline-start`, `inset-inline`, `text-align: start`. Directional glyphs (chevrons, arrows, the collapse affordance) and translate-based transforms (carousels, drawer entrances, the assistant dock) mirror off `[dir="rtl"]`. The 212px sidebar, the assistant dock, drawer slide-ins and the ISA-95 tree's indentation all reverse together, which only works if none of them was written physically.

### Named Rules

**The Shell-Never-Scrolls Rule.** The document never scrolls. Navigation, scope selector and the alert banner stay put; content scrolls inside its own region. An operator mid-triage must never lose the nav.

**The Ladder Rule.** Panel widths, radii and spacing come from the documented ladders. A one-off 37px is a defect, not a decision.

**The No-Fixed-Text-Width Rule.** Never set a `width` on a container whose content is translatable copy. Pad it and let it size. A width in pixels around a string is a bet that the string never changes language, and this product already advertises five.

## Elevation & Depth

This system is **flat by default in its primary theme and glass in its secondary** — an unusual split, and an intentional one. The choice comes from the use scene rather than category habit: the plant floor is bright, often daylit through roof lights, and read at arm's length with glare on the screen, which is where light-and-flat wins. The control room runs 24 hours and is frequently dim, which is where the dark theme earns its blur. Both are real conditions for real users of this product, so both are first-class.

In **light theme (primary)**, `backdrop-filter` is explicitly disabled. Depth comes from tonal layering — a warm page, white cards, a sunken header tone — plus two hairline border weights and a shadow so faint (`0 1px 2px rgba(0,0,0,0.04)`) it reads as an edge rather than a lift. This is a legibility decision: these screens carry long dense tables and multi-series charts, and blur behind them costs both GPU and contrast.

In **dark theme**, genuine glassmorphism returns — `blur(20px) saturate(180%)` over translucent white surfaces at 4/6/10% — because on a near-black ground translucency reads as material rather than as noise.

The real depth device in both themes is neither shadow nor blur: it is the **3px coloured leading edge**. Severity, AI authorship and status are all communicated by a card's inline-start border. It is cheap, it survives print, it works in colour-blind mode alongside the glyphs, and it lets a user scan a stack of cards vertically and know what each one is before reading a word.

### Shadow Vocabulary
- **Edge** (`box-shadow: 0 1px 2px rgba(0,0,0,0.04)`): The light-theme card at rest. Barely visible; defines an edge, not a height.
- **Ambient** (`box-shadow: 0 8px 32px rgba(0,0,0,0.4)`): The dark-theme card at rest, paired with blur.
- **Lift** (`box-shadow: 0 8px 24px rgba(0,0,0,0.14)` with `translateY(-2px)`): Hover on an interactive card. Response to input, never a resting state.
- **Accent Lift** (`box-shadow: 0 4px 14px rgba(242,101,34,0.3)`): Primary buttons only. The one place the accent is allowed to glow.
- **Dock** (`box-shadow: -12px 0 40px rgba(0,0,0,0.10)`): The assistant panel casting onto content, so it reads as overlaid rather than docked.

### Named Rules

**The Flat-Light Rule.** Never add `backdrop-filter` to a light-theme surface. It was removed on purpose. If a light surface needs separation, use the tonal ladder or a hairline.

**The Leading-Edge Rule.** Severity and authorship live on a card's leading edge — 3px, in the semantic colour, authored as `border-inline-start` and never `border-left`. Reach for it before reaching for a shadow, a tint or an icon. Because the whole depth model rests on this one declaration, writing it physically is the single most expensive direction bug available in this system.

**The Earned-Stripe Rule.** A stripe is only ever *earned*. A card carrying no severity and no AI authorship has no coloured edge — it is a plain hairline card. This is what separates the device from the coloured-left-border callout cliché: if every card has a stripe the stripe means nothing, the page reads as a template, and the one card that actually matters stops being findable. On a healthy screen, almost nothing is striped.

## Shapes

A tight, unfussy corner language. The base radius is **6px** (`rounded.sm`) and it is applied uniformly across cards, buttons, inputs, chips, KPI tiles, toasts and table wrappers via a single override, so the whole interface shares one silhouette. Softer steps exist for larger containers — 8px for navigation items, 10px for square icon buttons, 12px for large glass cards, 16px for modals — and the system tops out there. Nothing is more rounded than a modal except the deliberately pill-shaped and circular elements.

Fully round forms are semantic, not stylistic: **pills** (20px) mean status or category — badges, severity chips, state labels; **circles** (50%) mean people or live signals — avatars, status dots, step markers, radar cores.

Borders are the dominant edge treatment and come in exactly two weights, hairline for component edges and subtle for row dividers inside a component. Icons are stroke-drawn on a 24×24 grid at 1.8px weight with round caps and joins — never filled, which keeps a dense toolbar from turning into a field of blobs. The exception is the Forge mark itself and the Copilot glyph, both of which use filled nodes because they represent a graph.

### Named Rules

**The One Silhouette Rule.** 6px is the default corner. Deviating means the element is a genuinely different class of object (modal, pill, avatar), not that it wanted to look softer.

**The Stroke-Icon Rule.** Icons are 1.8px stroke on 24×24, round caps and joins, `fill: none`. Filled icons are reserved for the Forge mark and the Copilot node graph.

## Components

### Buttons
- **Character:** Quiet until it matters. A secondary button at rest is a white surface with a hairline; it announces itself only on hover.
- **Shape:** Base corner (6px). Square icon buttons step up to 10px.
- **Primary:** Forge Orange fill, white text, no border, Accent Lift shadow, `8px 14px` padding, 13px/600. Hover brightens by 8% rather than shifting hue — the accent has one value.
- **Secondary:** Card surface, primary ink, hairline border. Hover moves the border to Forge Orange and leaves the fill alone. This is the default button; primary is rationed to one per view.
- **Icon:** 34px square, 10px radius, dim ink, hairline border. An icon-only button carries a translated `aria-label`, not just a `title` — `title` is not a reliable accessible name and the prototype relies on it throughout. Icon buttons are also the only controls immune to text expansion, which makes them worth preferring in the top navigation where horizontal room is scarcest.
- **Disabled:** `opacity: 0.5`, no colour change. Applied consistently across every form in the system.
- **Focus:** Must be a visible ring. The prototype shipped only `border-color` on inputs; a real focus-visible treatment is required (see Do's and Don'ts).

### Chips
- **Style:** Card surface, dim ink, hairline border, `5px 11px`, base corner. Used for filters, facets, tags, timeframes and suggested prompts — the most reused interactive element in the product.
- **Selected:** Accent tint background, Forge Orange text and border.
- **Removable:** Trailing `✕` inside the chip; used for active-filter summaries.

### Cards / Containers
- **Corner Style:** Base corner (6px); large containers may step to 12px.
- **Background:** Card white on the warm page in light; translucent white with blur in dark.
- **Shadow Strategy:** Edge at rest, Lift on hover for interactive cards only. See Elevation & Depth.
- **Border:** Hairline. Plus a 3px leading edge in a semantic colour when the card carries severity or AI authorship.
- **Internal Padding:** 18px standard; 12–16px for compact tiles; `0` for cards whose body is a table (the table supplies its own cell padding).

### Inputs / Fields
- **Style:** Card surface, hairline border, base corner, `8px 13px`, 14px text. Placeholders in Ink Muted.
- **Focus:** Border shifts to Forge Orange. Needs an accompanying focus ring for keyboard users.
- **Search:** A glass container with a leading 13px search icon and a borderless transparent input inside — the pattern used in every filter bar.

### Brand lockup
- **Two forms, not one scaled.** The wordmark is 3:1 and the icon mark is square, so they are not substitutes: wordmark wherever there is horizontal room, icon mark in the 60px collapsed rail and any square slot. The hexagonal glyph is the **icon** mark — it is not a small logo, and the logo is not a large glyph.
- **One component.** Every lockup in the product comes from `components/forge/BrandLockup.jsx`. Four hand-assembled copies existed before it and two of them had already drifted to a different gap from the other two, which is exactly how a logo stops being a logo.
- **Sizes are a three-step ladder** — 20 / 24 / 30px tall — and the width is always stated with the height. The artwork is exactly 3:1, so an explicit pair costs nothing and stops the header reflowing when the image loads.
- **Vector, and coloured from tokens.** Letterforms take the theme's ink, "ai" takes Forge Orange. No bitmap, no filter, no second asset. See correction 17.
- **Never** re-typeset the name in the UI font beside the mark. That was the previous arrangement and it meant the product's own logo was four slightly different lockups rendered in IBM Plex.

### Select
- **Character:** A text input that happens to open. It shares the field's surface, hairline, base corner and 44px minimum height exactly, so a form reads as one row of controls rather than as an input beside a foreign object.
- **Trigger:** Card surface, hairline border, base corner, `10px 14px`, 14px text, no shadow — inputs do not carry one. Focus moves the border to Forge Orange under the same single focus ring as everything else.
- **Menu:** Card surface, hairline, base corner, Lift shadow. A menu opening is a response to input, which is the one thing Lift is for.
- **Option:** 14px text, the sunken tone on the active option, an optional leading stroke icon. **An option carries an icon and a label and nothing else** — the trigger renders the selected option's own content, so a description added to an option reappears inside the closed control.
- **A value that cannot change is not a disabled select.** Where an API accepts a field on create and not on update, state the value as a fact on a sunken surface with the reason beneath it. A permanently disabled control still looks like a control, still takes a hover, and teaches someone to keep trying it.
- **Never** a DropdownMenu wearing a select's clothes. A menu has no `role="combobox"`, no listbox relationship, no typeahead and no form semantics; it is not a form control and no amount of styling makes it one.

### Navigation
- **Global sidebar:** 9px/700/uppercase group headings in Ink Muted; 12px/500 items in dim ink at `6px 16px` with an 8px radius and an 18px leading icon. Hover raises the surface tone and the ink. **Active** takes the accent tint, Forge Orange ink, and a 3px Forge Orange leading edge with compensating inline-start padding so the label never shifts. Collapsed (60px) hides labels, replaces group headings with hairline rules, and relies on `title` tooltips.
- **Tabs:** A 2px bottom border in Forge Orange under the active tab, `marginBottom: -1px` so it sits on the container's hairline. Active label goes 600 and primary ink. Used horizontally for page-level tabs and vertically (with a leading edge instead) inside the Analysis panel.
- **Tablet:** Sidebar collapses to icons; tab strips scroll horizontally rather than wrapping.

### Tables
- **Character:** The product's most-used surface, so it is tuned rather than decorated. Sticky header on the sunken tone with a 10px/700/uppercase label; `11px 14px` cells; hairline-subtle row dividers; zebra striping at under 2% opacity; hover raises the row to the sunken tone and its border to a translucent Forge Orange.
- **Severity rows:** A 3px leading edge on the row itself, matching the card language.
- **Footer:** Every table ends in the pagination footer — "Showing X–Y of Z", a rows-per-page select, and elided page numbers.

### Metric Tiles
- **Character:** A row of metric tiles is the laziest thing a dashboard can do, so here they are not ornaments — **they are controls.** Each tile is a filter facet: clicking "Critical · 3" filters the list beneath it and takes an accent leading edge to show it is active. That is the justification for the pattern; without it, a row of identical big numbers is a template and should be replaced by the one number that matters.
- **Anatomy:** eyebrow label with a 14px stroke icon, the figure at 28px/600 in tabular numerals coloured by state, a caption in Ink Muted.
- **States:** hover lifts 2px with the Lift shadow and warms the border toward the accent. Active facet carries the accent leading edge. Non-interactive tiles do not lift — if it does not move, it does not click.
- **Never** more than one row, and never a tile whose number nobody would act on.

### Badge — signature component
The severity badge is the system's atom of meaning. A pill carrying a `color-mix` tint of its semantic hue at 16%, that hue as text, an optional leading dot, and a **shape glyph that is hidden by default and revealed in colour-blind mode**. Five tones — critical, high, medium, low, ok — and the glyph set ◆ ▲ ● ■ ✓. Every status in the product resolves to one of these five; new states must map onto the ladder or justify a new axis (as Acknowledged Cyan does). Badge text is never truncated and never clipped: a severity is the one label on screen that must survive translation intact, so the badge grows and its container yields. **The severity label is set in caps and the status label is not** — the design shouts the severity, and shouting both would leave neither emphatic. Caps come from the `caps` utility, never from `String.toUpperCase()`: casing translated copy in JavaScript cannot be undone for a caseless script, breaks Turkish dotted-i, and hides the decision in the call sites. The utility carries the same `:lang()` guard as `eyebrow`, so a future CJK, Devanagari, Thai, Arabic or Hebrew locale switches the caps and the tracking off in one place.

### Chart — signature component
Charts are semantic, not decorative. The line chart's vocabulary: an 8% auto-domain headroom, a five-line grid in the subtle border tone, a **green normal-operating band** as a translucent rect, a **red anomaly region** with a dashed boundary from a normalised start point, a gradient area fill at 28%→0% of the series colour, a 2px `non-scaling-stroke` line, a mouse-tracked crosshair with an undistorted HTML hover dot, a tooltip that flips side past 70% width, and a left axis tick column with `k` abbreviation. Series colour is per-sensor-type, not per-index. Threshold lines are dashed; anomaly onsets get a triangular marker at the top edge.

### AI Surface — signature component
Any surface the AI authored is marked by convention, never by ornament: a 3px Reasoning Violet leading edge, a violet Copilot glyph, a 10px/700 uppercase eyebrow naming the provenance (`AI Anomaly Description`, `Summary · synthesised from platform data`), and — where the AI drafted editable content — a violet `AI-DRAFTED` outline pill. AI prose ends in an italic 11px Ink Muted disclaimer requiring human verification. A companion pattern, **`SecInsight`**, places a one-sentence AI observation *outside and above* a card in ordinary body type with a small violet glyph, so the machine narrates the chart instead of occupying a separate panel.

## Do's and Don'ts

### Do:
- **Do** reserve Reasoning Violet (`#BF5AF2`) for AI authorship exclusively, and mark every AI surface with the violet leading edge, the Copilot glyph and a provenance eyebrow.
- **Do** set every comparable number in tabular numerals, without exception.
- **Do** use monospace for machine-minted identifiers and never for human prose.
- **Do** encode state at least twice — hue plus glyph plus label — and read status colours from tokens so colour-blind mode propagates automatically.
- **Do** take text-on-tint from a darker step of the colour's ramp and verify 4.5:1; a semantic hue is a fill value, not automatically a text value.
- **Do** reach for the 3px semantic leading edge before a shadow, tint or icon when a card or row carries severity or authorship.
- **Do** keep the page ground warm (`#FAF9F7`) and cards white; hairlines depend on that relationship.
- **Do** open every card and section with a 10px/700/uppercase eyebrow in Ink Muted.
- **Do** ration the primary button to roughly one per view; the default button is secondary.
- **Do** pick panel widths, radii and spacing from the documented ladders.
- **Do** end each table with the standard pagination footer, and make it actually paginate.
- **Do** author every box-model and border declaration logically (`border-inline-start`, `padding-inline`, `text-align: start`) and mirror directional glyphs off `[dir="rtl"]`, so a second locale is an attribute rather than a stylesheet fork.
- **Do** size text containers with padding and give flex and grid children `min-width: 0`, budgeting +35% for translation.
- **Do** format every date, number, percentage and duration through `Intl`, and every count through ICU plural rules.
- **Do** route all user-facing copy through the i18n layer, including `aria-label`, `alt`, `placeholder`, toasts, empty states and error messages.
- **Do** treat an engineering unit as a property of the asset's site, never of the reader's locale; locale formats the numeral only.
- **Do** give every interactive element a real focus-visible ring and keyboard activation — this is a WCAG 2.2 AA target, and the prototype's near-universal `<div onClick>` is the specific failure being corrected.
- **Do** honour `prefers-reduced-motion` for all of it — radars, pulses, carousels, the equaliser and the streaming text, not just the two sweeps the prototype covered.

### Don't:
- **Don't** add `backdrop-filter` to a light-theme surface. It was removed deliberately for contrast and render cost.
- **Don't** hardcode a status hex. `#FF453A` written inline breaks colour-blind mode silently.
- **Don't** use Forge Orange to mean a severity, or a severity colour to mean interaction.
- **Don't** let the interface become a chat window with the data behind it. The assistant is docked, contextual and dismissible; it explains the data and never competes with it. Sparkle icons and gradient-on-everything are out.
- **Don't** pursue undifferentiated density. High information volume is correct; a wall of monospace with no hierarchy, no whitespace between groups and colour used decoratively is not. Density is earned by removing chrome, not by removing structure.
- **Don't** fill icons or drop below 1.8px stroke weight; the Forge mark and Copilot glyph are the only filled marks.
- **Don't** invent a sixth severity tone. Map new states onto the five-step ladder, or give them their own axis and say so.
- **Don't** present any figure as measured. Every number currently in the system is placeholder data pending the real APIs.
- **Don't** write `border-left`, `padding-left` or `margin-left`. The leading edge is the system's primary depth device and physical declarations silently invert it.
- **Don't** put a pixel `width` around translatable copy, or `white-space: nowrap` on a label that could grow.
- **Don't** truncate a severity, status, or unit. Truncate values that are recoverable elsewhere; never the word that tells someone how bad it is.
- **Don't** concatenate translated strings or interpolate a plural by hand; a sentence assembled from fragments cannot be translated.
- **Don't** hardcode a single font family. The stack must remain a stack so script-matched faces can be appended.
- **Don't** convert an engineering unit because of a locale. A threshold of 12.5 mm/s becoming 0.49 in/s without the canonical value alongside is a safety defect, not a formatting choice.
- **Don't** use a gradient anywhere — least of all on an AI affordance. Violet-to-blue on an assistant button is the clearest generated-software tell there is.
- **Don't** use a sparkle, wand, robot or emoji to mean "AI". The node glyph and flat violet do that job.
- **Don't** put a stripe on a card that carries neither severity nor AI authorship, and don't give every card the same shadow. Uniform treatment across unequal things is what makes a page look generated.
- **Don't** colour a chart series decoratively. Series colour comes from the sensor type or the semantic state; a rainbow of hues that mean nothing is slop with axes on it.
- **Don't** write an eyebrow that paraphrases the heading below it. Delete one of them.
- **Don't** exceed a 16px corner radius, and don't apply the largest radius uniformly. The 6px default is the silhouette.
- **Don't** write cheerful product copy. No "Welcome back", no exclamation marks, no reassurance. These users are diagnosing a fault on a running line; say what happened and what to do.

---

### Corrections applied to the incumbent system

This file is normative and diverges from the prototype in six places, all deliberate:

1. **`--blue` → Forge Orange.** The prototype's primary accent token was named `--blue` while holding `#F26522`, an orange. Renamed; every reader was being misled.
2. **Medium severity tokenised.** `#FFD60A` was a bare literal in the severity map. It is now **Watch Yellow**. The near-duplicate `#F59E0B`, used interchangeably for medium in the banner and elsewhere, collapses into it.
3. **Stray hues promoted to tokens.** `#06B6D4` (Acknowledged), `#22D3EE` (Production Line tier), `#F97316`/`#A78BFA` (anomaly source vs context) were inline literals carrying real meaning. They are tokens now.
4. **Active-chip bug fixed.** `.chip.on` had a background of `rgba(10,132,255,0.14)` and a border of `rgba(10,132,255,0.4)` — leftovers from the original blue accent — combined with orange text, so a selected chip rendered blue-tinted with orange type. Now Accent Tint throughout.
5. **Health thresholds unified.** Three different ladders shipped simultaneously (`≥80/≥60`, `≥75/≥50`, `≥80/≥50`). The canonical ladder is **≥80 Signal Green · 50–79 Caution Amber · <50 Trip Red**.
6. **Spacing snapped to a 2px base.** The prototype used off-grid values (7, 9, 11, 13px) alongside the regular scale. Those snap to the documented ladder.

7. **Display and mono faces replaced.** Space Grotesk → IBM Plex Sans, JetBrains Mono → IBM Plex Mono. Space Grotesk reads as AI-startup software, which contradicts the confirmed anti-reference; Plex reads as engineering, pairs its own mono, covers non-Latin scripts, and is OFL-licensed. Any outlined `ForgeAI_Lockup_*.svg` artwork built on Space Grotesk letterforms needs redrawing or an explicit exception. ⚠ **The sans half of this was reversed by correction 19** — Space Grotesk carries the sans again. The mono half stands: IBM Plex Mono, not JetBrains.

Two dead declarations from the prototype are intentionally not carried forward: `.cb-stripe-viol` / `.cb-stripe-warn` (row hatching for monochromacy, defined but never applied — worth actually implementing) and `#print-header` (revealed by the print stylesheet but never rendered, so printed pages have no header).

### Corrections applied during implementation

Four further divergences were forced by building the system rather than describing it. Each corrects an earlier statement in this file, and the code is the authority:

8. **Every hue fails on its own tint, not just two.** See The Tint-Text Rule above. Seven `--on-*` tokens now exist because measurement contradicted the original claim. **⚠ Reverted by correction 18** — the seven tokens still exist but now alias the hue. The measurement is unchanged and is why the revert is a seven-line edit.
9. **The light theme has two accessible text weights, not three.** Ink Muted at 40% measured 2.5:1 on white — it could not legally carry the 10px eyebrows this document assigned it. Ink Dim moved to 68% (6.0:1 on card, 5.4:1 on sunken) and Ink Muted was demoted to non-text use. **⚠ Reverted by correction 18** — both are back at the prototype's 60% / 40%, so the light theme again has three weights and only one of them clears AA.
10. **Low severity is neutral, not Forge Orange.** See the Colors section. This resolved a direct self-contradiction.
11. **The public page's sticky header is opaque.** It briefly carried `backdrop-blur`, which The Flat-Light Rule forbids on any light surface. Replaced with a solid card fill plus the hairline.

12. **Naming type roles by job costs you a `tailwind-merge` configuration.** This document names type roles for their job — `body`, `control`, `micro` — which is right. But `tailwind-merge` cannot know those are font sizes, so it filed every one of them under text-*colour* and silently deleted whichever class came first: `cn('text-ink-dim', 'text-body')` resolved to `text-body` alone, and `cn('text-control', 'text-white')` to `text-white` alone. Colours and sizes were being dropped across the whole app. It was invisible in the light theme because an element that loses its colour inherits near-black ink and looks approximately correct — every severity badge in the product was rendering at 14px instead of 11px, and nobody could see it. The custom scale is now registered in the `font-size` class group in `src/lib/cn.js`. **Any role added to `--text-*` must be added there too**, or it silently starts eating colours again.

13. **Shadows named by job hit the same tailwind-merge trap as type roles.** `shadow-edge` and `shadow-lift` are read as shadow *colours* rather than shadow *sizes*, so `cn('shadow-lg`, `'shadow-lift')` kept both and painted two shadows — which is how a shadcn primitive's own `shadow-lg` survived being overridden. Registered in the `shadow` class group alongside the type scale. **The rule generalises: any token namespace this document names by job rather than by size needs registering in `src/lib/cn.js`.**

14. **`color` inherits as a resolved value, so a scoped theme needs to re-declare it.** Setting `data-theme="dark"` on a section flips `--ink`, but every descendant without an explicit text colour keeps the ink its ancestor already resolved — near-black text on a near-black panel. `[data-theme] { color: var(--ink) }` in the base layer makes a scoped theme self-consistent. The mechanism works, but the lesson generalises: a component that leans on inherited colour renders in whatever theme its ancestor resolved, so design-system components set their own text colour rather than trusting the cascade.

15. **A shadcn primitive's physical properties cannot be overridden from a wrapper — they have to be edited in place.** The generated `select.jsx` shipped `pr-8 pl-2` on its option and `right-2` on its tick. Corrections 12 and 13 both had a clean fix from outside the file, and this one does not: `tailwind-merge` correctly treats `pr` and `pe` as *different CSS properties*, so appending `pe-8` keeps both, and under `dir="rtl"` the option would be padded on both sides with the tick on the wrong edge. Every other divergence in that file — corner, surface, type scale, shadow, height — is still overridden from `components/forge/ForgeSelect.jsx` and the primitive stays regenerable. **The two physical declarations are hand-edited, flagged at the top of the file, and must be re-applied if it is ever regenerated.** Check any newly added primitive for `pl/pr/ml/mr/left/right/text-left/text-right` before wrapping it, because the wrapper cannot save you. `dropdown-menu.jsx` carries the same edit for the same reason — nine declarations, most of them inert on the components this app happens to use today, which is exactly why they were worth fixing: the failure would otherwise arrive with whoever reaches for `inset` or a checkbox item next, and it would look like their bug.

16. **The wordmark's violet was recoloured to the accent, which resolves The Violet Reservation rather than carving an exception in it.** The supplied artwork set "ai" in a violet measured off the file at `#A725EB` / `#9D1EE8` / `#B831F0` — one colour in three machine-traced variants — and that collided head-on with a named rule in this document: violet marks AI authorship and nothing else, never a brand flourish.

    An earlier draft of this correction scoped the rule instead, exempting the wordmark as chrome. Recolouring is the better answer and it is what shipped. **Forge Orange is already what this document calls the brand and the only interactive accent**, so the mark now uses the thing the system already reserved for exactly this, and the reservation stays absolute: violet means AI authorship, everywhere, with no exceptions to remember. No violet ships in executable code or in the stylesheet — the original hexes survive only as text inside a source comment.

17. **The wordmark is inline vector and takes both its colours from tokens, which retired a filter hack.** It began as a traced 23 KB PNG that needed `brightness(0) invert(1)` to reverse on dark grounds, and that hack had a real cost: flattening the artwork to a white silhouette threw away the "ai" colour whenever the theme flipped. Vector removes the trade entirely. The five letterform paths are `currentColor`, so ink follows the theme; the three "ai" paths take Forge Orange in both.

    One trap worth carrying forward: the fill is `var(--hue-forge)` and **not** `var(--color-forge)`. Tokens declared inside `@theme inline` are inlined into utilities rather than emitted as custom properties, so `--color-forge` does not exist at runtime and a fill referencing it resolves to nothing — the "ai" would simply vanish. **In raw CSS or an SVG attribute, reach for the `--hue-*` and `--ink*` tokens declared in `:root`, never the `@theme inline` aliases.** Verified against the built stylesheet.

18. **The palette was moved to one file and set to the prototype's values, and that trades away WCAG 2.2 AA on instruction.** Two changes, one commit, and the second is the one to read carefully.

    **One file.** Every colour in the product now lives in `src/styles/tokens.css` — light, dark, colour-blind, hues, surfaces, inks, shadows, and the print black and white. `index.css` holds none. The audit that preceded this found the codebase was already close: **zero** colour literals across the 52 JS/JSX files that use colour, everything already in one stylesheet. So this was consolidation, not migration, and the remaining work was the two `#fff`/`#000` in the print block, `--shadow-accent`, and the `@theme inline` aliases. `npm run verify:colors` now fails the build on a literal anywhere else; it was tested by planting one. See The Single-Palette Rule.

    **The prototype's values, verbatim.** Taken from the `:root` and `html[data-theme]` blocks of `Forge AI Platform.html`. The hues were already byte-identical — `--hue-red: #FF453A` was never anything else. What changed:

    - `--on-*` now alias `--hue-*` in both themes. The prototype has no separate on-tint text step at all; a badge sets `color: var(--red)` over a tint of the same red. This is the suspended Tint-Text Rule.
    - Ink Dim and Ink Muted took the prototype's opacities: 60% / 40% light, 62% / 38% dark.
    - `--tint` is 0.14 everywhere, the prototype's own figure, replacing 0.16 light / 0.20 dark.
    - Dark borders 10% / 6%, nav surface 4% — all the prototype's.

    **The cost, measured.** On-tint text now runs 1.3:1 (medium) to 2.9:1 (violet) against a 4.5:1 bar; Ink Dim is 3.9:1 and Ink Muted 2.8:1. The medium-severity badge is effectively unreadable. PRODUCT.md sets WCAG 2.2 AA as a target and gives the reason — bright daylit floor, arm's length, sometimes through safety glasses — so this is a real regression against a written commitment, accepted deliberately and recorded rather than quietly deleted. **The revert is `tokens.css` alone**: the passing values sit in comments beside the tokens they replaced, and all ~99 `text-on-*` call sites pick up the change with no other edit. That property is the whole reason the consolidation went first.

    One prototype value deliberately **not** carried over: `.chip.on` shipped a blue-tinted background with orange text (`rgba(10,132,255,0.14)`, a leftover from the original blue accent). That is correction 4, a bug rather than a palette decision, and matching the design does not mean reproducing it.

19. **Space Grotesk carries the sans again, and IBM Plex Mono stays.** Correction 7 swapped the prototype's Space Grotesk for IBM Plex Sans on the argument that Space Grotesk now reads as AI-startup software and so works against the confirmed anti-reference. The client noticed the divergence unprompted, on the page title, and chose to close it. The argument was sound and it was outranked — which is the correct order, and the second time this document has recorded exactly that (see correction 18).

    **The split is deliberate, not a compromise.** The sans is the prototype's; the mono is not. Two things pay for that. `font-variant-numeric: tabular-nums` is a *request* — in a face with no `tnum` feature it is a silent no-op, and unlike a missing glyph nothing tells you. Every comparable number in this product runs through `.num` or `Mono`, so the mono staying Plex keeps the tabular guarantee where columns actually live: codes, serials, metrics, counts. And JetBrains Mono against Space Grotesk is the prototype's own weakest pairing — two unrelated skeletons, which is half of what correction 7 was objecting to.

    **What is still unverified.** Whether Space Grotesk exposes `tnum` at all. Its figures are drawn on a near-uniform width, so the sans degrades to approximately-tabular rather than to jitter, but the check is a visual one on a rendered column and has not been made. The fallback is one line, commented at the `num` utility in `index.css`: give that utility the Plex half of the stack. Do not reach for it without looking at a real column first.

    **Also still open from correction 7:** any outlined lockup artwork built on Space Grotesk letterforms. The wordmark is now inline vector (correction 17), so this is no longer urgent — but it is no longer *wrong* either, which is a change worth knowing.

20. **The prototype's violet-to-blue AI gradient is back on the assistant button.** This document forbids gradients outright, and the rule names this exact one — violet-to-blue on an AI affordance — as the clearest generated-software tell in the interface. The button shipped flat violet on that argument. The client asked for the prototype's `.btn-ai` back, pointing at their own design; the argument was stated and outranked, which is now the third time this document has recorded that sequence (see corrections 18 and 19). Contained in the `ai-gradient` utility, built from `--hue-violet` and `--hue-dismissed` so it stays inside the Single-Palette Rule, and applied as `background-image` over the flat `bg-violet` so the previous fill is the fallback rather than a deleted state. Both call sites reach it through `ForgeButton`'s `ai` variant, which owns the gradient, the bold weight, the 10px corner and the 7% brightness hover — so the two AI entry points are one object rather than two that happen to match. The top bar's hand-rolled version is gone. **The rule itself stands for every other surface** — this is an exception with a name and a call site, not a licence. The one thing to hold onto if it is ever revisited: the tell is not the gradient, it is a gradient *plus* the other markers of generated software, and this interface no longer carries the others.

21. **The root-cause panel is colour-coded per section, and the useful part of this entry is where it landed after overshooting.** It went out three times. First near-monochrome — four grey cards, grey evidence lists, hue only on the likelihood pill — read as low-effort. Then coloured properly: tinted wells behind the two evidence lists, a tinted verification block, tinted rows under every ruled-out cause and every data gap, a likelihood-tinted rank disc on each row. That read as too much, and the correction the client gave is the sentence this project should keep: **take it from the anomaly list.**

    `AnomalyCard` is the reference because it is the densest surface in the product and the calmest. Its rule, stated plainly: **hue lives on a 3px leading edge and inside small badges, and never as a tinted region behind content.** A list row is a white card with a hairline, one coloured edge, three small pills and a serial in accent ink; everything else is plain ink on plain card. That is why fifty of them stacked stay scannable instead of becoming a quilt.

    So the hues stayed and the fills went. What ships: **violet** on the description card's edge and eyebrow, because Reasoning Violet is AI authorship and this panel is the machine's own account — this document asks for a violet edge on any AI-authored surface and the panel had none. **The severity ramp** on each ranked cause's edge, so the ranking is readable from the side of the page. **Green and amber** on the two evidence columns' arrows and 10px headings only. **Dismissed Blue** on the ruled-out card's edge and its per-row glyph. **Amber** on the data-gaps card's edge and glyphs. **Violet again** on the fault-domain pill, as `AiBadge`'s outline-no-fill device — one hue for every value, never a hue per value, since toning `mechanical` differently from `process` would be the screen ranking domains nobody has ranked.

    **The low-severity-is-neutral rule survived the round trip and is worth restating.** `low` likelihood was briefly given Watch so the ladder would not read as two steps and an absence. That was backwards: in the list, a low-severity row is deliberately the one with no edge and a neutral pill, and the absence *is* the signal — it is what lets the eye find the rows that matter. `low` is neutral again, and a low-likelihood cause takes no edge.

    **The Earned-Stripe Rule bends and is the one thing to watch.** Four striped cards on one panel is more than "almost nothing on a healthy screen" allows. Accepted because this is a diagnosis rather than a monitoring surface and each edge names a different kind of claim — but it is the rule that would break first if a fifth section were ever added here. **The Single-Palette Rule holds completely**: every value is a token, `npm run verify:colors` passes, colour-blind mode reaches all of it, and every hue is stated a second time in a word or a glyph, so nothing is carried by colour alone.

**The dark theme's home is the app's own toggle, not a section of the public page.** A single dark band was tried and reverted: the committed world is light-primary, the inversion was a flourish, and scoping a theme to one region is what surfaced correction 13. A control-room reader turns dark on for every screen; they do not want one stripe of it.

### The two gradients that ship

DESIGN.md forbids gradients outright and names violet-to-blue on an AI affordance as the clearest generated-software tell there is. **The rule now has two exceptions, and the second one is that exact gradient** — restored by the client, recorded as correction 20. Both are contained in a utility in `styles/index.css` so neither can spread by copy-paste, and both are built from tokens rather than literals so the Single-Palette Rule still reaches them.

**`ai-gradient`** — 135°, Reasoning Violet into `--hue-dismissed`'s #0A84FF, on every button that starts the machine thinking: the assistant in the top bar and Investigate on an anomaly, the latter through `ForgeButton`'s `ai` variant. Nothing about it is earned by the reasoning below; it is pinned by the brief, which outranks the rule. It is applied as `background-image` over a `bg-violet` fill, so the flat violet this product shipped for months is still there underneath as the fallback.

**`radar-field`** — the root-cause radar's sweep, and this one is argued for.

A conic gradient from Reasoning Violet at 45% to transparent. Three things earn it. It is a **mechanism, not a surface treatment** — a radar sweep *is* an alpha falloff, because that is how a sweep decays; remove the falloff and it is a spinning pie slice. It is **single-hue**, violet to transparent, so none of the two-tone signature the rule exists to prevent. And it is **pinned by the brief** — the prototype's own device, requested directly.

Contained deliberately: the gradient exists in one utility so it cannot spread by copy-paste, and it is written with `color-mix` over `var(--hue-violet)` rather than an rgba literal, so colour-blind mode and a palette retune reach it like everything else. The static violet disc on the same screen is **not** a gradient — that one earns nothing and is a flat tint with the node glyph.

Motion: the sweep rotates linearly at 2.2s. Under `prefers-reduced-motion` the base layer's killswitch stops the rotation and a scoped `!important` substitutes an opacity pulse — the one place in this system that overrides that killswitch, because a progress indicator that can run for two minutes with no liveness cue cannot be told from a broken one, and opacity is not movement. The `role="status"` text beside it is what actually carries the state.

---

### Known standing conflict with the generic detector

`detect.mjs` reports one finding against this system and will keep reporting it: **`side-tab` — "thick colored border on one side of a card"**, flagged as a recognisable generated-UI tell.

The finding is correct about the general case and wrong about this one, and the difference is The Earned-Stripe Rule. The cliché is a stripe on *every* card, where it means nothing. Here a stripe is only ever emitted for severity, AI authorship, an error state, or the two interaction states this document sanctions (active nav item, active facet) — `Panel`'s default is unstriped, and a low-severity card takes no edge. Verified in code: no decorative stripe exists anywhere in `src/`.

Do not "fix" this by removing the leading edge. It is the primary depth device, it survives print, it works in colour-blind mode alongside the glyphs, and the client approved it. Suppress the rule for this project or leave the finding standing and understood.
