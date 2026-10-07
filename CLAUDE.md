# forgeai-frontend

Project rules that must hold on every change. These are **pointers, not copies** —
the linked file is authoritative in each case, so nothing here can drift out of
sync with it.

## Colour

**Every colour in this app lives in `src/styles/tokens.css`, and nowhere else.**
That file carries light, dark and colour-blind mode together: hues, surfaces,
inks, shadows, and the print black and white. No component, page or other
stylesheet may contain a `#hex`, `rgba()` or `hsla()`.

Adding a colour means adding a token there plus a `@theme inline` alias, then
using the generated utility (`text-on-red`, `tint-red`, `bg-card`) — or
`var(--hue-red)` in raw CSS and SVG attributes, never `var(--color-red)`, which
does not exist at runtime.

`npm run verify:colors` fails the build on a literal anywhere else and runs inside
`npm run verify`. Do not work around it.

Why it matters: a literal ignores `data-theme`, ignores colour-blind mode, and
looks correct in whichever theme its author had open — so it fails silently, for a
subset of users, in a way review does not catch.

→ **DESIGN.md · The Single-Palette Rule** for the full statement.

## The palette is currently not WCAG AA, deliberately

On-tint text is the raw hue, matching the Claude Design prototype exactly. That
measures 1.3:1–2.9:1 against a 4.5:1 bar. It was requested; it is recorded, not
hidden. **Do not "fix" it as a side effect of unrelated work** — and do not add a
darker text colour at a call site to compensate, which would put a literal back in
a component and break the one-file property that makes the real revert cheap.

→ **DESIGN.md correction 18** and **PRODUCT.md · Accessibility & Inclusion**.

## Before finishing any UI change

```
npm run verify        # lint · i18n keys · colour literals · mock contract · build
```

## Working on demo mode

`VITE_DEMO_MODE=true` reveals the Claude Design prototype's screens on top of the
working product. **If a change touches anything behind that flag, read
`DEMO-MODE.md` first — every time.** It carries the recipe every demo screen
follows, the decisions already taken, and the per-module specification of what is
left to build. It is the working agreement for that effort, not background
reading, and it is where a new decision gets recorded before it gets coded.

The flag must be absent or false in production.

→ **DEMO-MODE.md**

Other standing rules live in their own files and are normative there:

- **DESIGN.md** — the design system. Logical properties only (never
  `margin-left`/`border-left`), tabular numerals on comparable numbers, monospace
  for machine identifiers only, the earned 3px leading edge, no gradients, no
  cheerful copy.
- **PRODUCT.md** — what the product is, who uses it, and what is deferred.
- **BACKEND-GAPS.md** — contract gaps found from the frontend, for the API team.
- **SECURITY.md** — the OWASP ASVS assessment.
