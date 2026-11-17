# X1 Space Explorer: Final Security Hardening

| | |
|---|---|
| Baseline (production `main`, rollback target) | `374f05fc8b0e392723c7d3801fa23c3294ff916a` |
| Implementation commit | `3c3304535176b581755b94af930937dcf14b693b` |
| Branch | `claude/x1space-security-hardening` (pushed; **not merged, not deployed, not published**) |
| Based on | the external audit report `X1_SPACE_FINAL_SECURITY_AUDIT.md` (findings F1-F8, remediation R1-R7), plus R8 |

**Evidence labels used throughout**

- **[MOCKED]** proven by an automated test with test doubles. Proves the code's logic only.
- **[SRC]** verified by reading source.
- **[RUNTIME-UNVERIFIED]** depends on how Base44 behaves in production. Nothing in this document claims it works until the owner runs `BASE44_RUNTIME_VERIFICATION.md`.
- **[VERIFIED-LIVE]** observed on the production site by the owner.

## 1. Status of R1 to R8

| ID | Item | Status | What was done |
|---|---|---|---|
| R1 | Distributed public rate limiting | **Investigated, nothing implemented (by instruction)** | Source analysis, a one-line diagnostic log, and a controlled verification procedure. Implement only if verification shows the limiter is not shared. See section 6. |
| R2 | Global AI expenditure protection | **Implemented** [MOCKED] | Per-user, per-IP and global daily limits, reserved before the billable call, fail closed. See section 2. |
| R3 | Cache pollution protection | **Implemented** [MOCKED] | Protected shared keys, byte-bounded image partition, LRU general partition. See section 3. |
| R4 | X1 Ninja redirect refusal | **Implemented** [MOCKED] | Redirects refused, fixed https origin, tests for every case requested. See section 4. |
| R5 | Image proxy SSRF | **Investigation only** | Probe results, runtime analysis, recommended design. `getImage` behaviour unchanged. See section 7. |
| R6 | Keep the public API | **Complete** [SRC][MOCKED] | All 16 functions retained. `getNetworkStats`, `getNetworkHistory`, `detectAnomalies` untouched and tested anonymously. No new authentication on public endpoints. |
| R7 | Security headers | **Complete** [VERIFIED-LIVE] | `X-Frame-Options: DENY` independently confirmed on production. No code change needed. Base44 editor preview compatibility is an **open owner-side check**. |
| R8 | X1 Ninja quota protection | **Implemented** [MOCKED] | Central governor with shared counters where supported. See section 5. |

## 2. R2: Global AI expenditure protection

### What changed

- New limits, all keyed by **UTC day** so they reset at 00:00 UTC:
  - per user `AI_DAILY_QUOTA`, default **10** (was 25)
  - per IP `AI_IP_DAILY_QUOTA`, default **30** (new: stops one source farming many accounts)
  - global `AI_GLOBAL_DAILY_QUOTA`, default **500** (new)
  - plus the existing per-user burst limit of 5 per minute (per instance, best effort).
- Values are validated strictly (`parseIntConfig`): digits only, clamped; anything else (`"abc"`, `"-5"`, `"1e3"`, `""`) falls back to the default instead of being guessed. All names are registered in `SECRET_NAMES`.
- **Reserved at the moment of the billable call**, not at the start of the request. Malformed requests (400/413) and anonymous callers (401) consume nothing. A request can make **at most one model call**; a second call throws.
- Order: burst, user, IP, global. If a later limit refuses, earlier reservations are **returned**, so a refused request costs the user nothing. A reservation is **not** refunded once the model call starts (the provider may bill a call that later fails).
- Responses: user or IP exhausted gives `429 daily_quota`; global exhausted gives `503 ai_capacity_reached`; both carry `Retry-After` to 00:00 UTC. The existing frontend maps 429/503 to its existing messages, so **no frontend change** was needed.
- **Fail closed:** if no reliable shared backend exists, or the backend throws, the AI functions answer `503 ai_unavailable` and the model is never called. This applies only to the two AI functions. Every other endpoint is unaffected [MOCKED].
- Existing authentication is unchanged: anonymous callers still receive 401.

### Is the global limit a hard ceiling? It depends on the backend

| Backend | When used | Atomic? | Global limit is |
|---|---|---|---|
| Deno KV compare-and-set | if `Deno.openKv` exists | Yes | a **hard ceiling** [MOCKED] (contention may refuse extra callers, never admit extra) |
| Entity ledger (RateLimit rows) | otherwise, via the service-role client | **No** | a **best-effort ceiling** |
| none | neither available | n/a | AI refuses (fail closed) |

The ledger works by reserve-then-verify: each reservation is its own row (a single create, so concurrent writers never overwrite each other); the reservation is granted only if its row ranks inside the first `limit` rows ordered by `(created_date, id)`. Parallel requests are ranked by one total order, so they cannot both take the last slot **provided the entity read reflects the write**. Tests show exactly `limit` grants for 40 parallel requests [MOCKED] and a fail-closed refusal when the write is not yet visible. **This is not a transaction and must not be described as a guaranteed hard ceiling.** Whether Base44 entities give read-your-writes consistency is [RUNTIME-UNVERIFIED].

The single-row counter (read-modify-write) is **deliberately not used for AI**; a test documents that it can overshoot under contention.

### Account farming

- The global limit is global: more accounts do not raise it [MOCKED, 40 throwaway accounts yield 5 calls with `global=5`].
- The per-IP limit stops one network draining the global budget [MOCKED]. An unknown IP gets no per-IP bucket (it would be shared by everyone behind the proxy).
- **Residual:** an attacker with many IPs and many accounts can still consume the global budget, denying AI to honest users for the day. That is availability loss, not unbounded spend. Restricting sign-up (verified email) is the real fix and is a Base44 setting the owner controls.

### Unbounded record growth

Rows live only for the UTC day plus one hour. Refused reservations delete their own row immediately. Every successful create also removes up to 5 expired rows. At default limits the table holds at most about 1,500 AI rows per day (user + IP + global), all expiring [MOCKED].

### Token, invocation, retry and spend investigation

| Question | Finding |
|---|---|
| Max model invocations per request | **1** (enforced in code [MOCKED]). No loops, no retries in our code. |
| Retry-related spend | None from our code. Whether the platform's `InvokeLLM` retries internally is [RUNTIME-UNVERIFIED]. |
| Max input size | Request body is capped at 16,000 bytes, which bounds the prompt to about 4,000 tokens plus a roughly 300-token template. Free text is additionally capped per field (query 300 chars, message 1,500, form values 1,000). |
| Max output size | **Cannot be capped from our code.** The SDK's `InvokeLLMParams` (installed `@base44/sdk`) has `prompt`, `model`, `add_context_from_internet`, `response_json_schema`, `file_urls`, and **no `max_tokens`**. Structured calls (`smartSearch`, `analyze`) are small by schema; free-text `chat` and `generate` use the model's default maximum. |
| Model selection | `model` is optional and **our code does not set it**, so the platform default applies. The SDK lists many models including expensive ones. The default is [RUNTIME-UNVERIFIED]. **Recommendation:** pin a small, inexpensive model explicitly (requires approval: it changes answer quality). |
| Internet context | Forced `false`. |
| Provider spend limit | Base44 bills `InvokeLLM` as integration credits on the owner's plan. A per-app hard cap is a Base44 billing setting [RUNTIME-UNVERIFIED]; the owner should set one if offered. |

**Estimated maximum expenditure** (formula, since Base44's credit price per call is not visible from source):

- Max calls: 500 per day, about 15,000 per 30-day month (the global limit is the ceiling). With the entity ledger that ceiling is best effort, so allow a small overshoot.
- Worst-case tokens per call: about 4,600 in plus an assumed 4,000 out. Maximum about **4.3 M tokens per day, about 130 M per month**.
- Illustrative only (assumed prices, **not** Base44 pricing): at $0.50/$2 per million in/out tokens that is about $5 per day or $160 per month worst case; at $3/$15 it is about $37 per day or $1,100 per month worst case. Typical structured calls use about 600 tokens in and 200 out, so real spend should be a small fraction of these.
- **Action for the owner:** convert using Base44's actual credit cost per `InvokeLLM` call and choose `AI_GLOBAL_DAILY_QUOTA` so that (quota x 31 x credit cost) fits the budget.

## 3. R3: Cache pollution protection [MOCKED]

`Cache` now has three partitions:

- **protected:** `market`, `token-snapshot`, `xdex-pools`, `ninja-pools`, `validator-identities`, plus the fixed singletons `network-stats`, `perf-samples`, `supply`. A fixed allowlist, so callers cannot add to it and it cannot grow. Look-alike keys such as `market:1` are not protected (tested).
- **image** (`img:` keys): at most 128 entries and 32 MB. Previously 500 image entries of up to 1 MB each could have approached 500 MB.
- **general** (per-mint detail, price, row, metadata): 500 entries, now LRU (previously FIFO).

Preserved: expiry, stale-on-error, request deduplication, response formats, 500-entry general limit. A handler-level test performs 700 unique mint lookups (detail, price, image) and shows the snapshot, market and pool lists are still cached and **no further `getProgramAccounts` or pool-list upstream call is made**.

Side effect to be aware of: the image cache holds fewer entries than before (128 versus up to 500). A page showing many logos is unaffected in practice (browsers also cache images for 24 h), but a busier image mix means somewhat more upstream image fetches.

## 4. R4: X1 Ninja redirect protection [MOCKED]

- `fetchJson` gained `refuseRedirects`: any 3xx is an error (`redirect_refused`) and the `Location` is never requested. Ninja requests always set it.
- `get()` only builds `https://api.x1.ninja/v1/...` URLs (fixed constant; a path check rejects anything else). The bearer token is built in exactly one place.
- Tests: normal success; same-origin redirect; cross-origin redirect (only one request is ever made, to `api.x1.ninja`); every call type; upstream 5xx (one counted retry, then a safe error); missing credentials (no request at all); invalid credentials (401 not retried, pauses 5 minutes); timeout; key never appears in responses, headers or logs.
- **[SRC]** static tests assert the key name and `api.x1.ninja` never appear in `src/`, that `Bearer` is built only in `ninja.ts`, and that the key is read only through the secret reader. A scan of the production build output (`dist/`) found no key name, Ninja host or key pattern. The real key was never read.

## 5. R8: X1 Ninja API quota protection

**Provider facts** (read from `https://x1.ninja/developers`, public page): Free plan 500,000 requests per month, 60 per minute, 1 key; quota **resets on the 1st of each month, UTC**; 429 means rate limit exceeded and carries `Retry-After`; 503 is an upstream failure with `Retry-After`; successful responses carry `X-RateLimit-Limit/Remaining/Reset`. The free plan has no overage billing, so exceeding limits costs availability (429s or key revocation under their fair-use policy), not money.

**Implementation** (`base44/shared/ninjaQuota.ts`, used by `ninja.ts`; separate keys, limits and failure policy from AI):

| Requirement | Implementation |
|---|---|
| Limits | Monthly 450,000 (reserve 50,000), 50 per minute (reserve 10). Configurable through `X1_NINJA_MONTHLY_QUOTA` and `X1_NINJA_RATE_LIMIT_PER_MIN`, validated and clamped to the plan maximum (500,000 and 60). `X1_NINJA_RESET_DAY` (1-28, default 1) if the provider's cycle ever changes. |
| Central enforcement | Every upstream request calls `governor.reserve()` first. There is no unmetered path. |
| Persistence | Monthly units are leased in blocks of 25 from a shared counter (Deno KV if present, otherwise the RateLimit entity), keyed by cycle (`x1ninja:month:2026-11`). The per-minute counter is shared the same way. |
| Concurrency | Atomic with Deno KV [MOCKED]. With the entity counter it is read-modify-write, so a small overshoot is possible. |
| Pagination and retries | Each page and each retry is one counted reservation. At most 2 attempts per call. |
| Deduplication | Existing per-key cache coalescing plus a per-path in-flight map: concurrent identical requests share one upstream call and one reservation. |
| 429 / 503 | No in-request retry. The `Retry-After` header (seconds or HTTP date) starts a cooldown (default 30 s without a header, capped at 15 min). While cooling down nothing is sent. |
| Rejected key (401/403) | 5-minute cooldown so a bad key does not burn quota. |
| Provider signal | A success reporting `X-RateLimit-Remaining: 0` pauses until the reported reset. |
| Cached data when exhausted | The shared cache serves the last good data flagged **`stale`** (up to 30 min for pools, 10 min for candles, 5 min for trades). With nothing cached the source reports **`quota_exhausted`** (history and trades likewise), and XDEX and chain data keep working. The frontend renders the new status through its existing "unavailable" pill, so no UI change. |
| 60-second caching | Pools and candles are cached 60 s (already the case); trades stay at 30 s for freshness. 100 requests in a minute produce one pools request [MOCKED]. |
| Monthly reset | Cycle id from the UTC calendar month; `retryAfter` points at the next cycle start. |
| Failure policy | If shared storage fails the governor counts **per instance** and says so in `state().enforcement` and in a one-time log line. It does not fail closed, because Ninja data is supplementary. |

**What is guaranteed and what is not.** Enforcement is `shared-atomic` (KV), `shared-best-effort` (entity), or `per-instance` (no shared store). Only the first is exact. With per-instance counting the monthly counter resets on every cold start, so many always-on instances could together exceed 450,000. The provider's own limit is the backstop (see above for the consequence). No claim of guaranteed enforcement is made until the owner confirms the backend in logs.

**If Base44 offers no atomic store:** the supported alternative is a single scheduled/serialized counter, for example one backend function invoked through a Base44 automation that is the only caller of X1 Ninja and writes results into an entity that the public functions read (one writer removes the race and cuts upstream traffic to a fixed schedule). A second option is a free Cloudflare Workers KV or Durable Object counter, but that adds infrastructure and was not introduced.

## 6. R1: Distributed public rate limiting (investigation)

Findings [SRC]:

- The public limiter uses `getStore()`: Deno KV (`Deno.openKv`) if the runtime has it, otherwise a per-instance memory map. The RateLimit entity is **not** used for public limits (by design, to avoid a database operation on every public request).
- Whether Base44 provides `Deno.openKv` is **not documented in the installed SDK**. The SDK's own examples use `Deno.serve`, which suggests a Deno-style runtime, but the repository's `entry.ts` comment says Cloudflare Workers. These disagree; the truth is [RUNTIME-UNVERIFIED].
- Client address: `cf-connecting-ip` only (`x-forwarded-for` is deliberately ignored). If the platform does not set it, every caller shares one `unknown` bucket at 20 times the limit. If the function origin can be reached without the edge in front, the header could be spoofed. [RUNTIME-UNVERIFIED]
- Base44 does not document a platform-native per-function rate limiter that I could find in the SDK; ask Base44 support.
- Database cost if implemented: one read plus one write per public request (about 2 operations), added latency on every call, and the 60-120 requests per minute dashboard polling would multiply it. Not justified without evidence.

**Added in this phase:** one constant diagnostic line per instance, `[rate-limit] public limiter store=shared-kv` or `store=per-instance-memory`, so the owner can read the answer from logs without any burst test. **Recommendation:** implement database-backed public limiting only if logs say `per-instance-memory` **and** abuse is observed; prefer a Base44 or edge-level limit if one exists. Procedure: `BASE44_RUNTIME_VERIFICATION.md`. No burst test was run against production.

## 7. R5: Image proxy SSRF (investigation only; `getImage` unchanged)

Probe of the current URL filter against 35 URL forms (local, no network): `docs/upgrade/ssrf-url-filter-probe.txt`.

**Blocked correctly** (the WHATWG URL parser canonicalizes first): decimal, hex, octal and short IPv4 forms (`2130706433`, `0x7f.0.0.1`, `127.1`), IPv6 loopback and IPv4-mapped IPv6, metadata IP `169.254.169.254`, `localhost` and `*.localhost`, `.internal`, `.corp` and single-label names, userinfo tricks, non-443 ports, `http`, `ftp`, `file`, `data`. Redirects are followed by hand (max 4) and re-validated; only five image MIME types are accepted (SVG and HTML refused); 1 MB cap; magic-byte check; 6 s timeout; the browser never supplies a URL.

**Gaps found:**

1. **Trailing-dot hostnames bypass the suffix filter:** `localhost.`, `metadata.google.internal.`, `foo.lan.` are allowed, because the private-suffix regex anchors on the last label and the trailing dot defeats it. Easy to fix (strip one trailing dot before checking). Low impact, because a hostname still needs to resolve to something reachable.
2. **Public hostnames that resolve to private addresses** (`127.0.0.1.nip.io`, `169.254.169.254.nip.io`, or an attacker's own DNS) are allowed, and so is DNS rebinding. Source cannot prevent this; it needs connection-level or resolved-IP enforcement.
3. The URL originates from **on-chain token metadata an attacker controls**, so `getImage` is the most exposed function. The same filter guards the metadata JSON fetch, validator website and icon URLs.

**Runtime support** [RUNTIME-UNVERIFIED]: I could not determine whether Base44's runtime exposes DNS resolution (`Deno.resolveDns`), blocks private egress at the network layer, or lets code pin the connection to a validated IP. Edge and isolate runtimes generally cannot reach internal networks, which would make gap 2 low severity in practice, but that must be confirmed with Base44, not assumed. No live SSRF probe was made.

**Recommended implementation** (needs approval):

- Quick fix, no dependencies: normalize a single trailing dot and add a denylist for reserved suffixes and known rebinding services (`nip.io`, `sslip.io`, `xip.io`, `localtest.me`). Weak against attacker-owned DNS, but removes the cheap cases. Compatibility: none.
- Strong fix, if the runtime allows: resolve the hostname with `Deno.resolveDns`, reject private, loopback, link-local, CGNAT and metadata ranges (IPv4 and IPv6, including IPv4-mapped), on the first request and every redirect hop. Cost: one lookup per uncached image (cached for 6 h). Residual: resolve-then-connect race, so prefer connecting to the validated IP with the original `Host`/SNI if the runtime supports it.
- No DNS-over-HTTPS dependency was added.

**If robust prevention is not possible in this runtime, the remaining exposure is:** an attacker who publishes token metadata can make the function request an https URL on port 443 of any public host, and possibly of a private host if the platform's network allows it, limited to returning a validated image of at most 1 MB. They cannot read non-image responses, use other ports or schemes, or reach credentials. **Restricted architecture:** serve only images from an allowlist of known hosts (for example the XDEX CDN and the project's GitHub raw asset host), or pre-fetch and store vetted logos for listed tokens, and show a placeholder for everything else.

## 8. R6 and R7

- **R6:** `tests/backend/security.test.ts` asserts the 16 function directories exist (and nothing else), each exports `entry(...)`, and the three network functions answer anonymously with `success: true` and unchanged shapes. No mandatory authentication was added to any ordinary explorer endpoint.
- **R7:** `X-Frame-Options: DENY` independently confirmed on `https://x1space.xyz` by the owner (also `Strict-Transport-Security: max-age=31536000`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`). **Outstanding owner-side check:** confirm the Base44 editor preview still loads with the setting on. Nothing in Base44 settings was changed by this work.

## 9. Security improvements

- AI spend now has a global, per-IP and per-user ceiling, reserved before each billable call, fail closed, with UTC reset.
- The `FallbackStore` that silently dropped AI quotas to per-instance memory is no longer used on the AI path.
- Cache churn can no longer force expensive upstream snapshot rebuilds; image memory is bounded in bytes.
- X1 Ninja credentials cannot follow a redirect; all Ninja traffic is metered with quota, cooldown and `Retry-After` handling.
- Fixed a latent defect: the AI entries copied the default dependencies with a spread, which froze the secret-backed settings at the first request. They now share the singleton (`depsWithClient`), so changed secrets take effect on a new instance as designed.

## 10. Files modified

New: `base44/shared/quota.ts`, `base44/shared/ninjaQuota.ts`, `tests/backend/security.test.ts`, `docs/upgrade/ssrf-url-filter-probe.txt`, and the four documents. Changed: `base44/shared/{ai,cache,entry,handlers,http,ninja,store,tokens,upstream}.ts`; ten function entries (`getTokens`, `searchTokens`, `getTokenByMint`, `analyzeToken`, `getTokenPrices`, `getLiquidityPools`, `getLPPoolDetail`, `getImage`, `smartSearch`, `tokenVerificationAssistant`) which now pass the platform client factory; `tests/backend/{helpers,handlers,platform}.test.ts` (adapted to the new dependency shape). **No frontend source, design, entity schema, or Base44 setting was changed.** `base44/shared/entityStore.ts` is now unused in production (still unit tested); it can be removed in a later cleanup.

## 11. Test results

See `SECURITY_REGRESSION_TESTS.md`. Summary: 224 tests pass (149 existing plus 75 new), lint 0 errors (same 5 pre-existing warnings), typecheck clean, build succeeds, `npm audit` identical to baseline (5 moderate, 0 high or critical).

## 12. Performance implications

- Public endpoints: no new storage operation per request. Ninja-using functions now also call `createClientFromRequest` (object creation, no network) and the function bundle imports the SDK, as the AI functions already did.
- AI calls: per call about 6-8 entity operations with the ledger (3 reservations of create plus read, plus cleanup) or about 3 KV operations with Deno KV. Roughly hundreds of milliseconds on the entity path [RUNTIME-UNVERIFIED], negligible against an LLM call. The global ledger read returns up to 505 rows at full usage.
- Ninja calls: about 2 entity operations per upstream request (minute counter) plus 2 per 25 requests (lease), on cache misses only.

## 13. Incremental operating costs

- X1 Ninja: **$0** (free plan, no overage billing).
- Infrastructure: **none added.**
- Base44 database operations: bounded as above, small. Check against the owner's plan allowance.
- AI: this work only **reduces** potential spend (default per-user quota 25 to 10, global cap 500 per day). Maximum is in section 2.

## 14. Outstanding vulnerabilities and risks

| # | Severity | Item |
|---|---|---|
| O1 | Medium | The AI global ceiling is best effort unless Deno KV exists. Verify the backend (log line) before relying on it as a hard cap. |
| O2 | Medium | If sign-up is open, many IPs and accounts can exhaust the daily global budget (availability, not spend). Restrict sign-up. |
| O3 | Low | Public rate limits may be per instance (`per-instance-memory`); client IP trust unverified. |
| O4 | Low | Image proxy gaps (trailing-dot hostnames; DNS to private IP). Investigated, not fixed (by instruction). |
| O5 | Low | `InvokeLLM` output length and default model cannot be bounded from our code. |
| O6 | Low | Ninja enforcement may be per instance if no shared store; the provider's own limit is the backstop. |
| O7 | Info | Entity operators (`$lt`, `created_date` sort) were verified against the SDK type definitions only, not against a live app. |
| O8 | Info | Base44 editor preview with `X-Frame-Options: DENY` not yet confirmed. |

## 15. Required Base44 settings and secrets

| Name | Required? | Recommended value | Effect |
|---|---|---|---|
| `X1_NINJA_API_KEY` | already set | (unchanged) | X1 Ninja data. Never printed or changed by this work. |
| `AI_DAILY_QUOTA` | optional | `10` | AI requests per signed-in user per UTC day (default 10). |
| `AI_IP_DAILY_QUOTA` | optional | `30` | AI requests per IP per UTC day (default 30). |
| `AI_GLOBAL_DAILY_QUOTA` | optional | `500` (lower if the credit budget demands) | AI requests for everyone per UTC day (default 500). |
| `X1_NINJA_MONTHLY_QUOTA` | optional | `450000` | Safety limit below the plan's 500,000 (default). |
| `X1_NINJA_RATE_LIMIT_PER_MIN` | optional | `50` | Safety limit below the plan's 60 (default). |
| `X1_NINJA_RESET_DAY` | optional | `1` | Day (UTC) the provider cycle starts (default 1). |
| `ALLOWED_ORIGINS`, `GEOLOCATION_DISABLED` | unchanged | | |

No secret is required: every default is safe. The `RateLimit` entity (admin-only RLS) already exists and **needs no schema change**; the new rows reuse its `key`, `value`, `count` and `expires_at` fields. Settings to consider: restrict sign-up to verified email; set an AI credit cap in Base44 billing if available.

## 16. Production readiness assessment

**Code: ready for owner review.** All gates pass and nothing is merged or deployed. **Not yet proven in production:** which quota backend Base44 actually provides, and whether the entity ledger behaves as designed. Recommended sequence: review the branch, then deploy it to a Base44 **preview** (not production), run `BASE44_RUNTIME_VERIFICATION.md`, read the three diagnostic log lines, and only then merge. If the log shows `backend=none (AI refused)`, AI features will be unavailable until a backend exists; the rest of the explorer is unaffected.

## 17. Rollback

See `SECURITY_ROLLBACK.md`. Baseline `374f05fc8b0e392723c7d3801fa23c3294ff916a`.
