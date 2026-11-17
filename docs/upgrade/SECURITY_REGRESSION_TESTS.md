# Security Regression Tests

Branch `claude/x1space-security-hardening`, implementation commit `3c3304535176b581755b94af930937dcf14b693b`, baseline `374f05fc8b0e392723c7d3801fa23c3294ff916a`.

## 0. What these tests do and do not prove

| Category | Meaning | Where |
|---|---|---|
| **MOCKED** | Automated tests using in-memory test doubles for fetch, RPC, the entity API, Deno KV and the model. No network, no billable AI call, no real API key. They prove the code's logic. | `tests/backend/security.test.ts` and the existing suites |
| **SOURCE** | Verified by reading or statically scanning the source. | static tests in `security.test.ts`, section 4 below |
| **RUNTIME** | Behaviour of the real Base44 platform (Deno KV, entity consistency, `cf-connecting-ip`, editor preview). **None of it is verified by these tests.** | `BASE44_RUNTIME_VERIFICATION.md` |

The test doubles for Deno KV and the entity store behave as their documented contracts say. If Base44 behaves differently, the mocked tests can still pass. That gap is exactly what the runtime procedure closes.

## 1. Results

Run with `npx vitest run` (twice in a row, no flakes). Final state:

| Suite | Tests | Result |
|---|---|---|
| `tests/backend/core.test.ts` | 21 | pass |
| `tests/backend/handlers.test.ts` | 46 | pass |
| `tests/backend/platform.test.ts` | 27 | pass |
| **`tests/backend/security.test.ts` (new)** | **75** | **pass** |
| `tests/frontend/*` (5 files) | 55 | pass |
| **Total** | **224** | **224 passed, 0 failed** (baseline: 149) |

Existing tests were adapted only where a dependency field was renamed on purpose (`aiDailyQuota` became `aiQuotaConfig`, and `quotaStore` became `aiQuota`): the per-user burst test, the token-verification burst test, and `AI quota uses the persistent store`. The last one was rewritten to assert that the entity ledger is used when no Deno KV exists. No assertion about behaviour was weakened.

| Gate | Baseline (`374f05f`) | This branch |
|---|---|---|
| Lint (`npm run lint`) | 0 errors, 5 warnings | 0 errors, 5 warnings (same) |
| Typecheck (`npm run typecheck`) | clean | clean |
| Build (`npm run build`) | success | success |
| `tsc --noEmit` over `base44/shared/*.ts` (extra check, non-strict) | not run | clean |
| `npm audit` | 5 moderate, 0 high, 0 critical | **identical** (5 moderate, 0 high, 0 critical). No dependency was added or changed. |
| Credential scan of `dist/` (key name, `api.x1.ninja`, `x1_...` key pattern) | none | none |
| Source maps in `dist/` | 0 | 0 |

## 2. New tests by area (all MOCKED unless marked)

**Per-user AI quotas.** Stops at the limit with `429 daily_quota` and a `Retry-After` equal to the time to 00:00 UTC; the refused call never reaches the model; other users unaffected.

**Global AI quotas.** `global=5` with 8 distinct users yields 5 calls then `503 ai_capacity_reached`; account farming (40 throwaway accounts) still yields 5 calls; per-IP limit stops one network, leaving capacity for another; unknown IP gets no shared bucket; refused requests refund earlier reservations; malformed, oversized and anonymous requests consume nothing; at most one model call per request.

**Parallel AI requests.** 60 simultaneous requests with `global=10` reach the model exactly 10 times (atomic backend); parallel requests from one user cannot exceed the user limit; Deno KV compare-and-set never grants more than `limit` under heavy contention (it may refuse extra callers, which is the safe direction); the entity ledger grants exactly `limit` for 40 parallel reservations and deletes refused rows; the ledger fails closed when its write is not visible. **A test documents the known limitation:** the single-row read-modify-write counter can overshoot under contention, which is why AI does not use it.

**Quota store failures.** No backend gives `503 ai_unavailable` and no model call; a backend that throws (while building or reserving) gives 503 with no internal detail leaked; a failing entity refuses instead of falling back to per-instance counting; `aiQuotaBackend(null)` is null; **ordinary endpoints (`getLPStats`, `getNetworkStats`, `getTokens`, `getValidators`) keep working while AI is unavailable.**

**UTC daily reset.** Exhausted at 23:59:30; still refused at 23:59:59.999; allowed at 00:00:00.000. Expired ledger rows are swept and refused rows never accumulate.

**Configuration validation.** Defaults 10/30/500; valid values; clamping; 12 malformed inputs (`abc`, `-5`, `1e3`, `3.5`, `0x10`, `1,000`, empty, and so on) fall back to the default; all new names registered in `SECRET_NAMES`.

**Cache pollution, expiration and memory bounds.** Protected entries survive 5,000 unique-key lookups; look-alike keys are not protected; expiry, stale-on-error and request coalescing preserved; LRU order; image partition bounded to 32 MB; **handler-level: 700 unique mint lookups (detail, price, image) leave `market`, `token-snapshot` and `xdex-pools` cached and cause zero additional `getProgramAccounts` or pool-list calls.**

**X1 Ninja redirect refusal and credentials.** Normal response; same-origin redirect; cross-origin redirect (a single request to `api.x1.ninja`, never the target); redirect on every call type; upstream 500 (one counted retry, safe error); missing credentials (no request); invalid credentials (401 not retried, 5-minute pause, resumes after); timeout; key never present in responses, response headers or console output.

**X1 Ninja quota (R8).** Provider cycle (1st of month UTC, year wrap, custom reset day); defaults 450,000/50 with 50,000/10 reserve and clamping to the plan; 50 per minute then refusal then resume; refused minute does not spend monthly units; monthly limit exactly enforced then reset on the 1st; two instances sharing a store cannot jointly exceed the limit; 200 parallel reservations across 4 instances grant exactly 50; per-instance mode and degraded mode reported honestly; AI and Ninja counters use disjoint keys and exhausting one leaves the other untouched; each page and each retry counts; at most two attempts per call; concurrent identical calls share one upstream request; refusal before sending once exhausted; 429 with `Retry-After` (cooldown, nothing sent during it, resumes after); 503 with `Retry-After`; HTTP-date, missing and capped values; `X-RateLimit-Remaining: 0` pause and malformed-header tolerance; stale data flagged `stale` when a refresh is refused; `quota_exhausted` when nothing is cached while XDEX and chain data still work; history and trades report `quota_exhausted`; 100 requests in a minute make one pools request; entity counter persists across instances, resets after expiry, and cleans expired rows.

**Existing public backend functions (R6).** Exactly the 16 expected function directories each export `entry(...)`; the three network functions answer anonymously with unchanged shapes; anonymous endpoints need no platform client, and only the AI functions require sign-in.

**Secret protection.** Console output, responses and headers never contain the (fake) key; diagnostics log constant text only, once.

## 3. Existing suites kept green

All 149 pre-existing tests still run: core helpers, every public handler, the persistent-store and platform wiring, SSRF redirect handling, and the frontend suites for `api.js`, formatting, live stats, the RPC client and the X1 View dashboard. This is the regression evidence that existing public backend and frontend behaviour is unchanged. No frontend file was modified.

## 4. Source-code verification (static tests and review)

- No frontend file under `src/` mentions `X1_NINJA_API_KEY` or `api.x1.ninja`.
- Only `base44/shared/ninja.ts` builds a `Bearer` header, from the constant `https://api.x1.ninja`, with `refuseRedirects: true`.
- `X1_NINJA_API_KEY` is read only through `env()` in `handlers.ts`.
- Built bundle scanned for key patterns: none.
- Manually reviewed: logging calls print error names and fixed words only (`logError`, `entry`, `logOnce`).

## 5. Not covered, and why

- Real Base44 behaviour of Deno KV, entities (`$lt`, `created_date` sort, read-after-write), `cf-connecting-ip`, `createClientFromRequest(...).asServiceRole` for anonymous requests, and the Base44 editor preview. See `BASE44_RUNTIME_VERIFICATION.md`.
- Real X1 Ninja responses with the real key (never read; the response shape of token address fields is still the open item already noted in `ninja.ts`).
- Real billable AI calls. The model is mocked everywhere.
- Load and performance testing, and live SSRF probing (both out of scope by instruction).

## 6. How to re-run

```bash
npm ci
npx vitest run
npm run lint && npm run typecheck && npm run build
npm audit
```
