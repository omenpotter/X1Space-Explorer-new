# Security Regression Tests

Branch `claude/x1space-security-hardening`. Baseline `374f05fc8b0e392723c7d3801fa23c3294ff916a`. Phase 1 commit `3c33045` (accepted at `ecfeb77`), phase 2 commits `dcb3dff` and `b728682`, closure commits `cbb06c2` (react-router 7) and the final documentation commit.

## 0. What these tests do and do not prove

| Category | Meaning | Where |
|---|---|---|
| **MOCKED** | Automated tests using in-memory test doubles for fetch, RPC, the entity API, Deno KV and the model. No network, no billable AI call, no real API key. They prove the code's logic. | `tests/backend/security.test.ts` and the existing suites |
| **SOURCE** | Verified by reading or statically scanning the source. | static tests in `security.test.ts`, section 4 below |
| **RUNTIME** | Behaviour of the real Base44 platform (Deno KV, entity consistency, `cf-connecting-ip`, editor preview). **None of it is verified by these tests.** | `BASE44_RUNTIME_VERIFICATION.md` |

The test doubles for Deno KV and the entity store behave as their documented contracts say. If Base44 behaves differently, the mocked tests can still pass. That gap is exactly what the runtime procedure closes.

## 1. Results (phase 2, final)

Run with `npx vitest run` (repeated, no flakes). A deliberate-mutation check was also made: weakening the strict-backend test, the trailing-dot normalisation, and the sliding window each made tests fail, then the code was restored.

| Suite | Tests | Result |
|---|---|---|
| `tests/backend/core.test.ts` | 21 | pass |
| `tests/backend/handlers.test.ts` | 46 | pass |
| `tests/backend/platform.test.ts` | 27 | pass |
| `tests/backend/security.test.ts` (phase 1) | 75 | pass |
| **`tests/backend/security2.test.ts` (phase 2)** | **174** | **pass** |
| `tests/frontend/*` (5 files) | 55 | pass |
| **Total** | **398** | **398 passed, 0 failed** (baseline 149) |

| Gate | Baseline (`374f05f`) | Final |
|---|---|---|
| Lint | 0 errors, 5 warnings | 0 errors, 5 warnings (same) |
| Typecheck | clean | clean |
| Build | success | success; output **byte-identical** before and after the lockfile change |
| `tsc --noEmit` over `base44/shared/*.ts` (extra, non-strict) | not run | clean |
| `npm audit` | 5 moderate | **0 vulnerabilities** (sucrase 3.35.1 and react-router-dom 7.18.5) |
| Credential scan of `dist/` (key name, `api.x1.ninja`, key pattern) | none | none |
| Source maps in `dist/` | 0 | 0 |
| Router verification (Playwright against a production build; script described below) | n/a | **identical** on react-router 6.30.6 and 7.18.5; **7.18.5 adopted** |

Existing tests were adapted only where a dependency field was renamed on purpose (`aiDailyQuota` to `aiQuotaConfig`, `quotaStore` to `aiQuota`) and where strict mode deliberately changed behaviour: the entity-store AI test now asserts that the ledger is **refused** by default and used only with `best_effort`. No assertion about public-endpoint behaviour was weakened.

## 2. Phase 2 tests by area (security2.test.ts; all MOCKED unless marked)

**R5 SSRF (136 cases).** 52 refused URL forms (trailing dots in several spellings, `localhost` variants, `.local`/`.internal`/`.lan`/`.corp`/`home.arpa`/reverse DNS, decimal/hex/octal/short IPv4, IPv6 loopback, IPv4-mapped IPv6, AWS IPv6 metadata, link-local, wildcard-DNS names, embedded-IP names, userinfo, non-443 ports, http/ftp/file/gopher/data, malformed labels); 15 legitimate URLs that must still pass (XDEX, GitHub raw, IPFS gateways incl. subdomain gateways, Arweave, CDNs, IDN, hash-like labels); 54 address classifications (private, reserved, mapped, NAT64, 6to4, Teredo, public); IPv6 parsing; the guarded fetch (public passes, private/loopback/link-local/metadata answers refused before any request, a single private answer in a mixed set refuses, resolution failure refuses, lexical refusals skip resolution, **every redirect hop is checked**); the image proxy end to end (normal and IPFS images, public redirects, redirects to nine kinds of internal target never requested, loops, SVG/HTML/mislabelled/oversized bodies). **A test asserts the resolver is dormant without a DNS API (as on Workers), documenting the residual exposure.**

**R2 strict mode.** `AI_QUOTA_MODE` parsing (only exactly `best_effort` weakens anything); actor selected over entity; strict mode with only the entity store returns no backend; ledger only via the explicit opt-in; `reserveAiQuota` refuses the ledger, the single-row counter and a per-instance memory store in strict mode even if handed one; a strict refusal writes nothing and never reaches the model; an undeployed or failing actor fails closed.

**R2 atomic reservation through the actor.** 40 simultaneous requests over 8 function instances take exactly `global` units; refunds leave refused users at zero and the global counter exact (30 parallel, limit 5); a refunded unit is available again and a surplus refund never goes below zero; shard mapping; the actor is chosen over entity storage.

**QuotaCounter actor and CounterBook.** Exactly four callable methods; WebSocket connections refused; **only `identity.type === 'service'` is accepted, with anonymous, signed-in, missing, empty and look-alike identities all getting 403 on all four methods**; a refused call cannot change a counter; 60 simultaneous calls on a cold instance grant exactly the limit (including the first-load race); state survives hibernation; every argument validated with 400; UTC-day expiry and bounded storage; storage failure surfaces as an error and recovers; deadline values.

**R2 single enforcement path (static).** The only `InvokeLLM` call in the backend is inside `aiEndpoint` and appears after `reserveAiQuota`; exactly two AI endpoints exist; no other billable integration is called from the backend; no frontend file calls a Core integration; only the two AI entries use the AI handlers and both obtain the client the same way.

**R8 governor v2.** Minute boundary (50 at 12:00:59.5 allow at most 1 more at 12:01:00.1; gradual return; no 60-second span above 60 over a 10-minute simulation with 3 attempts per second); a 429 seen by one instance pauses the others, and stays local without a shared store; header reconciliation (a lower provider limit lowers ours, a higher one never raises it, near-exhaustion pauses, malformed headers ignored, values recorded); backend chain (failed backend skipped for 60 s then retried, all failing means per-instance counting, 300 reservations over 5 instances through the actor grant exactly 50, Deno KV still honoured); monthly reset keyed by UTC cycle with the actor.

**Ops.** Every function entry that pins the SDK pins 0.8.62 or later (actor calls require it).

## 2b. React Router 7 compatibility verification (browser-level, not in the unit suite)

The same script ran against the 6.30.6 production build and the 7.18.5 production build (`vite preview`, Playwright/Chromium) and the two JSON results were **diffed: identical**. Coverage:

| Area | Cases |
|---|---|
| Direct navigation | all 25 page routes, `/`, an unknown path, a deep unknown path, lower-case `/validators`, trailing slash `/Validators/` (30 in total) |
| URL parameters | 7 deep links with query strings (`?address=`, `?slot=`, `?mint=`, `?q=`, `?search=`, `?id=`, encoded values) keep route and query |
| Browser refresh | reload on 4 routes keeps path and query, including the 404 |
| Search | the global search sends an address, a slot number, free text and a transaction signature to the right page with the right query |
| Navigation history | link click is a client-side navigation (no full reload), then back, back, forward return the expected paths |
| Error pages | unknown paths render the "Page not found" page |
| Authentication surfaces (signed out) | `/OAuthConsent` with and without a handle renders the consent page; `/Home` redirects to the dashboard |
| Open redirect | `/%5Cevil.example/x`, `//evil.example/x`, `/\\evil.example` stay on the origin |
| Page errors | 2 page errors in both versions (pre-existing in this sandbox, not router related) |

Not covered: pages that need live RPC and XDEX data (the sandbox has restricted network), and signed-in flows (no account). Vercel: the SPA rewrite in `vercel.json` matches all 28 route shapes and excludes `/functions/*` and `/assets/*`. React Router 7 needs Node 20 or later; Base44's sandbox reports Node v24.22.1 and npm 10.9.9 [API-READ], Vercel's default is 24 [PLATFORM-DOC], local runs used 22.

## 3. Existing suites kept green

All 149 pre-existing tests still run: core helpers, every public handler, the persistent-store and platform wiring, SSRF redirect handling, and the frontend suites for `api.js`, formatting, live stats, the RPC client and the X1 View dashboard. This is the regression evidence that existing public backend and frontend behaviour is unchanged. No frontend file was modified.

## 4. Source-code verification (static tests and review)

- No frontend file under `src/` mentions `X1_NINJA_API_KEY` or `api.x1.ninja`.
- Only `base44/shared/ninja.ts` builds a `Bearer` header, from the constant `https://api.x1.ninja`, with `refuseRedirects: true`.
- `X1_NINJA_API_KEY` is read only through `env()` in `handlers.ts`.
- Built bundle scanned for key patterns: none.
- Manually reviewed: logging calls print error names and fixed words only (`logError`, `entry`, `logOnce`).

## 5. Not covered, and why (actual Base44 runtime verification required)

- **That the actor serializes calls as documented** (the premise of atomic AI and Ninja counters), that it deploys alongside the functions, and that a browser cannot call it successfully. Check 4.2 and A5 in `BASE44_RUNTIME_VERIFICATION.md`.
- Real behaviour of `createClientFromRequest(...).asServiceRole.actors` for anonymous requests, `cf-connecting-ip`, Retry-After against the real provider, and the Base44 editor preview.
- **Whether Workers can reach private addresses** (R5 residual) and whether a DNS API exists; code cannot test this.
- Real X1 Ninja responses with the real key (never read), real billable AI calls (the model is mocked everywhere), load tests and live SSRF probes (out of scope by instruction).

## 6. How to re-run

```bash
npm ci
npx vitest run
npm run lint && npm run typecheck && npm run build
npm audit
```
