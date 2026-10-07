# Security Checklist — Forge AI Platform (web client)

> Copied from `pragmatyc-claude-config/templates/security-checklist.md`.
> Authority: OWASP ASVS 5.0 — see `docs/security-asvs.md` in `pragmatyc-claude-config`.

**Owner:** _unassigned — needs a tech lead before the first production-bound MR_
**Last reviewed:** 2026-08-04
**ASVS levels in scope:** L1 ✅ · L2 ✅ · L3 ☐ optional

## Scope of this assessment

This repository is currently a **browser-only SPA with no backend**. `VITE_API_MODE=mock`
answers every request from an in-repo fixture layer; the real APIs are in active
development and not available.

That makes most ASVS requirements **not yet assessable rather than satisfied**, and this
file says so explicitly instead of ticking them. Every unassessable item is marked
`⊘ server` and must be revisited by whoever owns the API. Ticking a server-side control
against a client that has no server would be the more dangerous document.

Two client-side properties are load-bearing today and are already implemented:

- **No secrets in the bundle.** Every `VITE_*` value is public by construction. `.env.example`
  states this at the top, and `.env*.local` is gitignored.
- **No credential in the repository.** There is no demo credential and no default password
  anywhere in the source. `verify:auth` reads one from the environment and refuses to run
  without it.

One property this document previously claimed is **no longer true**, and the change is
deliberate rather than a regression:

- **Session tokens ARE script-readable.** `src/services/authToken.js` now stores the access and
  refresh tokens in cookies. The API returns its refresh token in the JSON response body, so
  JavaScript necessarily holds it — the httpOnly refresh cookie this document originally
  described cannot be achieved from the client at all. Recorded as an accepted risk below.

---

## L1 — Mandatory baseline

### V1 Encoding & Sanitization
- [x] Output encoding by context — React escapes all interpolated text; no `dangerouslySetInnerHTML` anywhere (`grep` clean)
- [ ] ⊘ server — parameterized queries
- [ ] ⊘ server — parameterized OS command invocation
- [x] No untrusted HTML rendered, so no sanitizer needed. If rich text ever arrives from the API, DOMPurify becomes mandatory before it renders
- [x] No `eval`, `Function()`, or dynamic code execution in `src/`

### V2 Validation & Business Logic
- [ ] ⊘ server — server-side validation on every endpoint. **Client validation is not a control**; the mock adapter deliberately does not validate, so nobody mistakes it for enforcement
- [ ] ⊘ server — business-rule limits

### V3 Web Frontend
- [ ] **CSP header — NOT SET. Open item, blocks production.** Must be issued by whatever serves `dist/`; it cannot be set from a static SPA. Needs `script-src 'self'` (the build emits no inline scripts), and note that Tailwind emits a stylesheet rather than inline styles, so `style-src 'self'` is achievable
- [ ] ⊘ deploy — HSTS (serving layer)
- [ ] ⊘ deploy — `X-Content-Type-Options: nosniff` (serving layer)
- [ ] **Cookie flags — partially client-side now.** The client sets both token cookies with `SameSite=Lax`, `path=/` and `Secure` whenever the page is HTTPS. It **cannot** set `HttpOnly`, which is the whole of the accepted risk below: only the API can issue that, and until it does, the tokens stay script-readable
- [ ] **Tokens are in cookies, not `localStorage`.** Both tokens are script-readable — see the accepted risk. `localStorage` holds only the theme, the colour-blind preference, the remembered account ID and the signed-in user's name and email for display. No token, and no operational data

### V5 File Handling
- [x] N/A — no upload surface built yet. Document upload is a planned module; this section is due before it ships

### V6 Authentication
- [ ] ⊘ server — password hashing (argon2id / bcrypt cost ≥ 12)
- [x] **Generic auth failure message — implemented.** The sign-in screen renders one message for a rejected credential regardless of cause. It never distinguishes "no such account" from "wrong password", because telling them apart lets an attacker confirm which account IDs and addresses exist. `scripts/verify-auth.mjs` asserts against the real API that a wrong password, an unknown email and an unknown account alias all return the *same* error code, so a future change that splits them is caught
- [x] **No pre-auth information disclosure.** Nothing about an organisation renders before the credential is verified. This is why the screen is a centred single column and not the conventional two-pane split — the second pane is normally filled with tenant context, and resolving an account ID to a plant name would confirm the account exists
- [ ] ⊘ server — lockout / rate limiting is the server's to enforce. The client models it: a 423 maps to `ERROR_CODES.LOCKED` with its own recovery message, because waiting helps and retyping the password does not, and the sign-in mutation never retries so a failed attempt cannot silently burn the counter three times
- [x] Credentials travel in a POST body, never a query string, so they stay out of browser history, proxy logs and the referrer header
- [x] The password is never written to `localStorage`, `sessionStorage`, or a URL, and is cleared from component state on success. Only the **account ID** is remembered per device — an organisation's short code is not a secret, and retyping it at every shift change on a shared terminal is friction with no security value

### V7 Session Management
- [ ] ⊘ server — session ID regeneration on login
- [x] Sign-out clears both token cookies and the stored profile (`clearSession`), and the refresh flow is single-flight, so concurrent 401s cannot stampede — with a rotating refresh token, the losers of that race would otherwise spend one already spent
- [x] **A 401 triggers exactly one refresh-and-retry, then gives up.** A refresh that itself 401s ends the session and redirects to sign-in with a stated reason, rather than looping
- [ ] ⊘ server — sign-out cannot revoke the token. See the accepted risk
- [ ] ⊘ server — idle + absolute timeouts

### V8 Authorization
- [ ] ⊘ server — authorization on every endpoint, default deny
- [ ] ⊘ server — object-level authorization (IDOR). **RBAC is explicitly deferred** (PRODUCT.md). Nothing in the UI gates on a role today; the entitlement response shape exists so adding it is data rather than an architecture change. Client-side gating must never be treated as authorization

### V9 Self-Contained Tokens
- [ ] ⊘ server — the client never decodes or trusts a JWT claim; it forwards the token and reads authorization from the API

### V12 Secure Communication
- [ ] ⊘ deploy — TLS 1.2+, HTTP→HTTPS redirect. `withCredentials` is only enabled in live mode, so credentials are never sent to the mock transport

### V13 Configuration
- [x] **No secrets in source or git history.** No `.env` file is committed; `.env.example` carries no values
- [x] Configuration loaded from env via `src/services/config.js`; nothing hardcoded

### V14 Data Protection
- [x] **Sensitive data not exposed in URLs or logs.** The response interceptor logs method, path and request id only — never a request or response body. Route params carry opaque record ids (`ALR-4471`), never personal data
- [x] All fixture data is synthesised. No real client PII or PHI anywhere in the repo, per org policy

---

## L2 — Mandatory for production engagements

### V1 Encoding & Sanitization (advanced)
- [ ] ⊘ server — SSRF allowlist. The client's only outbound host is `VITE_API_BASE_URL`, which defaults to a relative `/api` (same-origin)

### V2 Validation & Business Logic
- [ ] ⊘ server — server-side step ordering. Relevant to work-order release and permit sign-off, which must not be releasable from the client
- [ ] ⊘ server — anti-automation

### V3 Web Frontend (advanced)
- [ ] **Open item** — CSP `frame-ancestors`, `base-uri`, `form-action` (serving layer)
- [ ] **Open item** — `Referrer-Policy: strict-origin-when-cross-origin` (serving layer)
- [x] No `postMessage` listeners in the codebase
- [x] No `target="_blank"` links. If one is added it takes `rel="noopener noreferrer"`

### V4 API & Web Service
- [x] The client sends an explicit `Content-Type: application/json` and `Accept: application/json` on every request
- [x] N/A — no GraphQL, no WebSocket

### V6 / V7 Authentication & Session (advanced)
- [ ] ⊘ server — MFA, password reset tokens, out-of-band notification, re-auth for sensitive ops, concurrent session limits. The sign-in **screen** now exists; the authentication **service** does not, and every item here belongs to it. Two notes for whoever builds it: releasing a work order and signing off a hot-work permit are the "sensitive ops" that should demand re-authentication, and the screen's "Forgot your password?" control is currently inert because no reset flow exists — it must not ship to production wired to nothing
- [x] **No "remember me".** Deliberately omitted rather than overlooked. These are shared terminals: a control-room PC that keeps someone signed in is a control-room PC anyone can act as them from
- [x] **No federated sign-in buttons.** No identity provider has been selected, and a button implying otherwise is a capability claim the product cannot meet

### V8 Authorization (advanced)
- [ ] ⊘ server — authorization decision logging
- [x] **No client-supplied role or permission claim is trusted.** The role switcher is a demo affordance that changes the AI briefing only; it grants nothing

### V10 OAuth / OIDC
- [ ] ⊘ — not yet chosen. If an IdP is used, PKCE is mandatory for this public client

### V11 Cryptography
- [x] The client performs no cryptography. **`Math.random()` is used in exactly one place** — `mockAdapter.js`, to decide whether to simulate a transport failure. That is a development affordance with no security meaning, and it is unreachable in `live` mode
- [ ] ⊘ server — key inventory and rotation

### V12 Secure Communication (advanced)
- [ ] ⊘ deploy — TLS scan, service-to-service auth

### V13 Configuration
- [ ] ⊘ deploy — secret rotation schedule
- [x] Production build strips no stack traces by default — **but** the one `console.warn` in the response interceptor is gated behind `import.meta.env.DEV`, and the error boundary never renders the caught error
- [x] N/A — no default credentials exist

### V14 Data Protection
- [ ] ⊘ server — PII/PHI encryption at rest, data classification. Relevant once the operator logbook (free-text shift observations) is wired to a real API, since that field can attract personal comment

### V15 Secure Coding
- [ ] **Open item — dependency scan is not yet in CI.** `npm audit` currently reports **2 high advisories, and there is no clean version available.** See _Accepted risks_ below. A CI gate must be added, and it will need this exception encoded or it will fail the pipeline on day one
- [x] N/A — no third-party CDN scripts, so no SRI needed. Fonts are self-hosted via `@fontsource`, deliberately: a CDN webfont is both a third-party dependency and a privacy leak, and a plant may be air-gapped

### V16 Security Logging
- [ ] ⊘ server — auth event, authz failure and validation failure logging
- [x] Client logs contain no secrets, no PII and no request bodies
- [ ] ⊘ server — log integrity

---

## L3 — Optional / client-driven

Not requested. One item is worth flagging early regardless:

- [ ] **CSV / formula injection escaping on exports.** The Anomalies screen has an Export control and anomaly reports are a real print/export output. A cell beginning `=`, `+`, `-` or `@` executes in Excel. This must be handled wherever export is actually implemented — it is a stub today

---

## Accepted risks

| Item | Detail | Disposition |
|---|---|---|
| `react-router` GHSA-qwww-vcr4-c8h2 (high) | RSC-mode CSRF bypass, affects 7.12.0–8.2.0. **No patched release exists above the range** — latest is 7.18.2. Downgrading to 7.11.0 trades this for 14 advisories fixed in 7.18.0, several of them client-reachable open-redirect and XSS in `<Link>` and `useNavigate` | **Pinned to 7.18.2** — the version with the fewest advisories. The affected code path is React Server Components mode; this is a client-only SPA with no server, no server actions and no `unstable_` RSC APIs, so the path is unreachable. **Revisit when 7.19+ or 8.3+ ships.** Needs tech-lead sign-off before a production MR |
| **Session tokens in script-readable cookies** (V7, V8.3.1) | The API returns its refresh token **in the JSON response body**, not as a cookie it sets itself. JavaScript therefore holds a 30-day refresh token, and one XSS exfiltrates a month of session. No client-side arrangement avoids this: the client cannot create an httpOnly cookie, and holding the token in memory only would sign users out on every page reload | **Accepted, client-side mitigations applied.** Cookies rather than `localStorage`, so the session carries an explicit `Max-Age` and expires unattended; `SameSite=Lax`; `Secure` whenever the page is HTTPS; `path=/`. The access token is a session cookie that dies with the browser, and only the refresh token persists. **The real fix is server-side** and is the single highest-value auth change available: have `/login` and `/refresh` set the refresh token as an `httpOnly; Secure; SameSite` cookie and read it from there, at which point the client stops holding it entirely. Needs tech-lead sign-off before a production MR |
| **Sign-out cannot revoke a session** (V7) | The API exposes no logout endpoint and its refresh tokens are stateless JWTs with no server-side record, so nothing can invalidate one. `signOut()` clears the client and returns. A refresh token captured before sign-out remains valid for its full lifetime | **Accepted — not fixable from the client.** A request to a non-existent endpoint would be theatre, so none is made and the code says why. Requires server-side token records (a denylist, or a stored refresh-token id) to resolve |

## Sign-off

- [ ] Tech lead reviewed: _pending_
- [ ] SA reviewed (if regulated client): _pending_
- [ ] Security exceptions documented and accepted by client: _three exceptions above need a decision — the react-router advisory, script-readable session tokens, and non-revocable sign-out_

## Out-of-scope items (justified)

| ASVS req | Reason out-of-scope | Approved by |
|---|---|---|
| V5 File Handling | No upload surface built yet; due before the document module ships | _pending_ |
| V9 Self-Contained Tokens | Client never decodes or trusts token claims | _pending_ |
| V10 OAuth / OIDC | No IdP selected yet | _pending_ |
| V17 WebRTC | Not used | _pending_ |
