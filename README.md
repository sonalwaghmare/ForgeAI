# Forge AI Platform — web client

A unified OT intelligence layer for manufacturing. Forge AI sits above the plant systems a
customer already runs, reads their signals, explains what is developing before it stops the
line, and drives the resulting maintenance back into their systems of record.

This repository is the production rebuild of a ~30-screen design prototype. **Six surfaces are
built so far**; the rest name themselves as placeholders rather than faking content.

| Route | Mode | State |
|---|---|---|
| `/` | Persuade — public page; product components carry every claim | Built |
| `/login` | Operate — sign in (validates; authenticates nothing yet) | Built |
| `/app/home` | Operate — role-adaptive briefing, the home surface | Built |
| `/app/anomalies` | Operate — the flagship operational surface | Built |
| `/app/settings/asset-classes` | Operate — Asset Classes, full CRUD **against the live API** | Built |
| `/app/settings/hierarchy` | Operate — Sites & Hierarchy, full CRUD **against the live API** | Built |
| `/app/*` | Operate — remaining modules | Honest placeholders |

## Getting started

```bash
npm install
npm run dev
```

Requires Node 20+ (developed on 24). No `.env` file is needed — the app defaults to mock mode.
Copy `.env.example` to `.env.local` to change anything.

```bash
npm run verify        # lint → i18n keys → mock layer → production build
npm run verify:i18n   # every t() key resolves; no hardcoded user-facing copy
npm run verify:mocks  # 63 checks against the real axios + interceptor + mock stack
```

## Authoritative documents

Read these before changing anything. They are normative, not commentary.

- **[PRODUCT.md](PRODUCT.md)** — durable product truth: users, purpose, positioning, operating
  context, constraints, what is deferred, what must never be fabricated.
- **[DESIGN.md](DESIGN.md)** — the visual system. Named rules, tokens, component character, and
  a list of corrections where the built system diverges from earlier drafts.
- **[SECURITY.md](SECURITY.md)** — OWASP ASVS 5.0 L1+L2 assessment. Records what is genuinely
  satisfied client-side and marks the rest `⊘ server`. **Three items block a production MR.**
- **[FORGE_AI_PRODUCT_UNDERSTANDING.md](FORGE_AI_PRODUCT_UNDERSTANDING.md)** — the full analysis
  of the original prototype: architecture, every screen, the domain model, a fidelity audit.

## Architecture

```
src/
  services/      One axios instance. endpoints.js is the only place a URL is written.
  mocks/         An axios *adapter* backed by fixtures, plus the demo universe.
  features/<d>/  api.js (service functions) + queries.js (TanStack Query hooks).
  components/
    ui/          shadcn/ui primitives. Generated — do not hand-edit (see below).
    forge/       The product's own design system, extracted from the approved preview.
  shell/         The application chassis: top bar, nav rail, assistant dock, banner.
  pages/         Route components.
  i18n/          react-i18next + ICU. Every user-facing string lives here.
  lib/           format.js (Intl), units.js (site-owned units), tone.js, cn.js.
  providers/     Theme, scope, and the composed provider tree.
```

### The mock layer is a transport, not a stub

`VITE_API_MODE=mock` installs a custom **axios adapter**. Because it satisfies the same contract
as the real transport, request/response interceptors, auth headers, timeouts, cancellation and
`ApiError` normalisation all execute exactly as they will against the live API. Switching to real
endpoints is one env variable and nothing else.

Set `VITE_MOCK_ERROR_RATE=0.3` to fail roughly one request in three and exercise error states.

### Some endpoints are live; most are not

The transport is **hybrid**, and one axios instance serves both halves. `LIVE_PATHS` in
[src/services/http.js](src/services/http.js) lists the paths that go to the network:

| Path | Serves |
|---|---|
| `/v1/login`, `/v1/refresh` | Sign in and token refresh |
| `/v1/asset-classes` | Asset Classes — list, create, rename (PUT), soft delete |
| `/v1/asset-hierarchy` | The account's own name, and the tree shape |
| `/v1/regions`, `/v1/subregions`, `/v1/plants`, `/v1/lines`, `/v1/machines` | Sites & Hierarchy CRUD, one collection per tier |

Every other path is answered from fixtures. Moving an endpoint across as it lands is one entry
in that array; the interceptors, envelope unwrapping, refresh queue and `ApiError` normalisation
are already identical on both sides, which is the whole point of the arrangement.

The hierarchy needs six of these at once: `/asset-hierarchy` is the only place the account's
name is served, and it carries just `{id, name}` per node — not the short code, active flag or
asset class that a full-replace `PUT` has to send back. So the tree call supplies the name and
the five collections supply the records. See [BACKEND-GAPS.md](BACKEND-GAPS.md) §3.

**Two hierarchies coexist, deliberately.** Settings and the scope selector read the live one.
The anomaly list, KPI strip, briefing and site-health cards still read fixtures keyed to fixture
site ids, so selecting a live scope changes what the top bar says and not what those screens
show. Repointing them at an empty database would empty the demo; they merge the day scoped reads
exist, and `ScopeProvider` marks the one line where.

These paths are not covered by `VITE_API_MODE` — they are gated on `VITE_AUTH_MODE`, because
auth and the rest of the API are the same FastAPI process and "is the backend running" is one
question rather than two. There are deliberately **no auth fixtures**: a second, more forgiving
implementation of sign-in is precisely what ends up accepting a credential the real service
would reject. Setting `VITE_AUTH_MODE=mock` therefore sends every live path back to the fixture
layer, where `/v1/asset-classes` has no route and the screen shows its error state.

Two consequences worth knowing before you run it:

- **The dev proxy is mandatory, not optional.** The API serves no CORS headers, so the browser
  cannot call it cross-origin at all. `/api` is proxied to `http://localhost:8000` by default —
  override with `VITE_DEV_PROXY_TARGET`. Requests must stay same-origin, which is also why
  `VITE_API_BASE_URL` has to remain relative.
- **The account ID is case-sensitive.** The API compares the alias exactly, so it is stored and
  sent as typed. Anything that upper-cases it for display would break every sign-in.

```bash
npm run dev     # backend must be running on :8000

# Exercises the real sign-in, refresh, rotation and rejection paths end to end.
# Excluded from `npm run verify` because it needs both servers up.
FORGE_ACCOUNT_ALIAS=<alias> FORGE_EMAIL=<email> FORGE_PASSWORD=<password> npm run verify:auth
```

### Things that will bite you

- **Tailwind classes are resolved by scanning source text.** A class built from a template
  literal (`` `stripe-${tone}` ``) is never generated and silently renders nothing. Every dynamic
  class comes from a static map in [src/lib/tone.js](src/lib/tone.js). Runtime-variable colour
  goes through a CSS custom property in a `style` prop instead.
- **Never write `border-left`, `padding-left`, `margin-left` or `text-left`.** The 3px semantic
  leading edge is the system's primary depth device, and a physical declaration silently inverts
  the whole depth model under `dir="rtl"`. Use `border-s`, `ps-`, `ms-`, `text-start`.
- **Never hardcode a status hex.** `#FF453A` written inline breaks colour-blind mode silently,
  because the Wong-palette swap works by reassigning tokens.
- **Engineering units are site configuration, never locale.** `src/lib/units.js` exports no
  `convert()` on purpose. A vibration threshold of 12.5 mm/s silently becoming 0.49 in/s is a
  safety defect, not a formatting choice. Locale formats the numeral; the site owns the unit.
- **shadcn/ui primitives in `src/components/ui/` are generated** and meant to stay regenerable.
  They are authored against shadcn's own token names, which are mapped onto this system's tokens
  in one block in [src/styles/index.css](src/styles/index.css) — so `npx shadcn add <component>`
  produces something that already looks right. Divergences belong in a wrapper under
  `components/forge/`, never as an edit to the primitive. One exception is handled in CSS:
  shadcn ships a translucent 3px focus ring, suppressed so the app has a single focus treatment.
- **Every user-facing string goes through `t()`**, including `aria-label`, `title`, `alt` and
  `placeholder`. `npm run verify:i18n` fails if one slips through. English ships alone, but
  nothing may require a refactor to add a second locale.

## Contributing

Branch progression is by MR only: `dev` → `qa` → `uat` → `main`. Direct pushes to protected
branches are prohibited. Branch names are `feat/`, `bug/`, `hotfix/` or `chore/` prefixed;
commits are `<type>(<scope>): <description>`.

AI-assisted commits and MRs must be flagged `[ai-assisted]` in the MR description, and are
reviewed to the same standard as hand-written code.

## Known open items

- No CSP is set. It must be issued by the serving layer and blocks production.
- No dependency scan in CI. `npm audit` currently reports 2 high advisories with no clean
  version available — see the accepted-risk table in [SECURITY.md](SECURITY.md).
- **Session tokens are readable by script.** The API returns its refresh token in the response
  body, so the client necessarily holds it — the intended httpOnly refresh cookie is not
  available without a server change. Tokens are kept in cookies with an explicit `Max-Age`
  rather than in `localStorage`, and this is logged as an accepted risk in
  [SECURITY.md](SECURITY.md). It is the one deliberate ASVS deviation in the codebase.
- **Signing out cannot revoke anything.** There is no logout endpoint, and the refresh tokens
  are stateless JWTs with no server-side record, so sign-out clears the client and nothing
  more. A token captured beforehand stays valid until it expires.
- RBAC is not enforced. The role switcher changes the AI briefing only and grants nothing.
- No unit tests or visual regression suite. The three verify scripts cover the data, i18n and
  auth layers; **rendering has not been verified by machine or by eye** — see the note at the
  end of the build handover.
