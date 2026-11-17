# X1 Space Explorer: Final Security Hardening

| | |
|---|---|
| Baseline (production `main`, rollback target) | `374f05fc8b0e392723c7d3801fa23c3294ff916a` |
| Implementation commits | phase 1 `3c3304535176b581755b94af930937dcf14b693b` (accepted at `ecfeb77`); phase 2 `dcb3dff` and `b728682` (R5, R2 strict, R8 v2, docs); closure `cbb06c2` (react-router 7) plus the final documentation commit (see `git log`) |
| Branch | `claude/x1space-security-hardening` (pushed; **not merged, not deployed, not published**) |
| Based on | the external audit report `X1_SPACE_FINAL_SECURITY_AUDIT.md` (findings F1-F8, remediation R1-R7), plus R8 |

**Evidence labels used throughout**

- **[MOCKED]** proven by an automated test with test doubles. Proves the code's logic only.
- **[SRC]** verified by reading source.
- **[RUNTIME-UNVERIFIED]** depends on how Base44 behaves in production. Nothing in this document claims it works until the owner runs `BASE44_RUNTIME_VERIFICATION.md`.
- **[VERIFIED-LIVE]** observed on the production site by the owner.

## 1. Status of R1 to R8 (updated, phase 2)

| ID | Item | Status | What was done |
|---|---|---|---|
| R1 | Distributed public rate limiting | **Deferred by decision.** Exposure documented | Public limits stay per instance unless the runtime offers Deno KV (undocumented; the log line `[rate-limit] public limiter store=...` states which). No actor call or database operation was added to public requests. See sections 6 and 19. |
| R2 | AI expenditure protection | **Implemented, reconciled, strict by default** [MOCKED] | AI is metered only by an **atomic, shared** backend: the new QuotaCounter actor (or Deno KV if the runtime has it). The non-atomic entity ledger is no longer used unless `AI_QUOTA_MODE=best_effort`. Without the actor, AI answers 503 and the explorer is unaffected. See section 2. |
| R3 | Cache pollution protection | **Implemented** [MOCKED] | Unchanged from phase 1. |
| R4 | Ninja redirect refusal | **Implemented** [MOCKED] | Unchanged from phase 1. |
| R5 | Image proxy SSRF | **Implemented as far as the runtime allows; allowlist feasibility investigated (not implemented)** [MOCKED] | Lexical filter, IP-range classifier and per-hop guard; the resolved-address layer activates only if the runtime has a DNS API (undocumented). **Not complete SSRF protection.** Allowlist assessment in section 20. |
| R6 | Keep the public API | **Complete** | 16 functions retained, anonymous, unchanged shapes. |
| R7 | Security headers | **Complete** [VERIFIED-LIVE] | `X-Frame-Options: DENY` confirmed. Editor preview compatibility remains an owner check (N2). |
| R8 | Ninja quota protection | **Implemented, reviewed, improved** [MOCKED] | Governor v2: sliding minute window, cross-instance Retry-After, provider header reconciliation, backend chain. Limits unchanged: 450,000 per month, 50 per minute. See section 5. |

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
- **Fail closed:** if no atomic shared backend exists, or the backend throws, the AI functions answer `503 ai_unavailable` and the model is never called. This applies only to the two AI functions. Every other endpoint is unaffected [MOCKED].
- Existing authentication is unchanged: anonymous callers still receive 401.

### Is the global limit a hard ceiling? (revised in phase 2)

| Backend | Used when | Atomic and shared? | Global limit is |
|---|---|---|---|
| QuotaCounter actor (Durable Object) | the platform client has `asServiceRole.actors` and the actor is deployed | Yes, if the actor serializes as documented | a **hard ceiling** [MOCKED; runtime check 4.2 pending] |
| Deno KV | `Deno.openKv` exists. **Base44 does not document it**; it is used if present and never relied on | Yes | a hard ceiling if present |
| Entity ledger | **only** when the owner sets `AI_QUOTA_MODE=best_effort` | **No** | a **best-effort ceiling, not guaranteed** |
| none | otherwise | n/a | AI refuses with 503 (fail closed) |

The ledger works by reserve-then-verify (a row per reservation, granted only if it ranks inside the first `limit` rows by `(created_date, id)`). It cannot be a guaranteed ceiling: it needs read-your-writes consistency that is not verified, and an earlier row that is not yet visible lets two callers both rank inside the limit. It is retained only as an explicit, logged opt-in. The single-row read-modify-write counter is never used for AI (a test documents that it can overshoot).

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

### 2.1 Reconciliation with the original requirement (phase 2)

The phase 1 text said the global limit was "a hard ceiling with Deno KV, best effort with the entity ledger". Review of the platform showed that Deno KV is **undocumented** for Base44 functions, so phase 1 could in practice have metered AI with the **non-atomic ledger** and still allowed billable calls. That did not meet "reliable atomic reservations". Findings and fixes:

| Question | Finding | Fix |
|---|---|---|
| Did the code permit billable AI with only a non-atomic store? | **Yes.** `aiQuotaBackend` fell back to the entity ledger silently. | Strict mode is now the default. `aiQuotaBackend` returns the ledger only when `AI_QUOTA_MODE=best_effort`, and `reserveAiQuota` independently refuses any backend that is not `atomic && shared` unless the mode says otherwise (defence in depth) [MOCKED]. |
| Can concurrent requests exceed the global cap? | With the ledger, only if reads are not read-your-writes (an earlier row not yet visible could let two callers both rank inside the limit). With the actor: 40 simultaneous requests across 8 function instances grant exactly the limit [MOCKED]. | Atomic primitive: the **QuotaCounter actor** (`base44/actors/QuotaCounter`), a Durable Object that handles one event at a time. Reservation is check-and-increment with no `await` in between. The one assumption left to verify on Base44 is that serialization (runtime check 4.2). |
| Do refunds create races? | A refund only decrements a counter that the same request incremented, never below zero, on the same UTC-day key. 30 parallel requests with `global=5` leave exactly 5 global units and zero units on every refused user [MOCKED]. Refunds are not issued after the model call starts. | None needed; tests added. |
| Do all billable entry points use the same mechanism? | Server side: yes, the only `InvokeLLM` call is inside `aiEndpoint`, after `reserveAiQuota` (static test). Browser: [API-READ] the platform reports `core_integrations: backend_functions_only`, so the runtime rejects client-side Core integration calls. The browser exports in `src/api/integrations.js` are therefore inert. | Static tests; owner check B6 / A5. |

**Consequence for rollout.** With strict mode the AI functions answer `503 ai_unavailable` until the QuotaCounter actor is deployed and reachable. Ordinary explorer endpoints are unaffected. The frontend already shows its "AI features are not available right now" message for 503.

**Actor security.** Any client can call any callable method on any session it can name, so every method checks `context.identity.type === 'service'` and refuses everything else with 403; WebSocket connections are refused. Arguments are validated (key charset and length, integer ranges). Storage is bounded (5,000 keys per shard, expired keys dropped on write).

**Operating cost.** Actors are included in the app's plan (`actors: true`). Per AI request: three actor calls (user, IP, global), each a small RPC. Per Ninja request: one actor call, plus one every 25 requests for the monthly lease. Actor-call quotas on Base44 are [UNVERIFIED].

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

## 5. R8: X1 Ninja API quota protection (reviewed in phase 2)

**Provider facts** (public page `https://x1.ninja/developers`): Free plan 500,000 requests per month, 60 per minute, 1 key; quota **resets on the 1st of each month, UTC**; 429 means rate limit exceeded and carries `Retry-After`; 503 is an upstream failure with `Retry-After`; successful responses carry `X-RateLimit-Limit/Remaining/Reset`; keys that abuse or share the key can be revoked (fair use). No overage billing on the free plan.

### Application-enforced versus provider-enforced

| | Application-enforced (this code) | Provider-enforced (X1 Ninja) |
|---|---|---|
| Monthly | 450,000 (50,000 reserve), counted by us | 500,000, counted by them |
| Per minute | 50 (10 reserve), sliding window | 60, window type not published |
| Strength | Only as strong as the counter behind it: exact (`shared-atomic`) with the QuotaCounter actor, approximate with the entity counter, per instance with none | Authoritative |
| Effect when exceeded | We stop sending, serve cached or report `quota_exhausted` | 429 with Retry-After, or key revocation |
| Role | Prevents us from ever reaching the provider's limits | Backstop. We never rely on it, but we obey it (Retry-After, 401/403 pause, header reconciliation) |

### Review findings and changes

| Area | Finding | Change |
|---|---|---|
| Cross-instance concurrency | Phase 1 used a read-modify-write entity counter, which can lose increments. | Counters now live in the QuotaCounter actor (atomic) with the entity counter as a fallback. Chain with back-off: a failing backend is skipped for 60 s, so a missing actor is not hit on every request. 300 parallel reservations over 5 instances grant exactly 50 [MOCKED]. |
| Monthly UTC resets | Correct (cycle id from UTC month). | Re-verified with the actor: `x1ninja:month:2026-11` stops at 25, and `2026-12` starts at 00:00:30 UTC on the 1st [MOCKED]. |
| Minute-boundary bursts | A fixed window allows 50 at 12:00:59 and 50 at 12:01:00, which is 100 in two seconds. | **Sliding window approximation**: the previous minute's count weighs on the current one by the time remaining. 50 requests at the end of a minute allow at most 1 more in the next 0.6 s; capacity returns gradually. Over a 10-minute simulation no 60-second span exceeded the provider's 60 [MOCKED]. |
| Retry-After | The cooldown was per instance, so other instances kept sending after one got a 429. | The cooldown deadline is published to the shared backend and re-read at most every 2 s per instance: a 429 seen by one instance pauses the others [MOCKED]. Without a shared store it stays local (documented). |
| Pagination accounting | Each page reserves separately. | Unchanged and tested (3 pages = 3 units). |
| Retry accounting | Each retry reserves separately; at most 2 attempts; 429/503 are never retried in the request. | Unchanged and tested. |
| Cache fallback | Stale data is served flagged `stale`; with nothing cached, `quota_exhausted`. | Unchanged and tested. |
| Header reconciliation | Only `Remaining: 0` paused us. | `X-RateLimit-Limit` can **lower** our per-minute limit (never raise it); `Remaining` at 2 or less pauses until the reported reset; malformed headers are ignored; the last values are exposed in `state().provider`. Assumption: the provider's `Limit` header describes the per-minute window (its docs list only that rate); a different window would make us more conservative, never less. |
| Dedup, 60 s caching | Shared cache plus in-flight map. | Unchanged. |

The approved limits (450,000 per month, 50 per minute) are unchanged and remain configurable only downwards from the plan maximum. Whether the actor serializes as documented is the single runtime assumption (check 4.4 and A2).

## 6. R1: Distributed public rate limiting (investigation)

Findings [SRC]:

- The public limiter uses `getStore()`: Deno KV (`Deno.openKv`) if the runtime has it, otherwise a per-instance memory map. The RateLimit entity is **not** used for public limits (by design, to avoid a database operation on every public request).
- **Phase 2 and closure findings:** Base44 describes its backend runtime as Deno (with isolates called "Workers", a 128 MB memory cap and a 5-minute limit), and actors as Durable Objects [PLATFORM-DOC]. Whether `Deno.openKv` exists is **not documented**. Without it the public limiter is per instance. The expected log line is `store=per-instance-memory`; `store=shared-kv` would mean KV exists.
- A shared public limiter is now technically available through the QuotaCounter actor, but it costs an actor round trip on every public request, so it is **not** enabled. If check 4.5 shows the client address is spoofable or absent, the proportionate step is an actor-backed limiter only on the expensive endpoints (`getTokens`, `searchTokens`, `getImage`), which needs your approval.
- Client address: `cf-connecting-ip` only (`x-forwarded-for` is deliberately ignored). If the platform does not set it, every caller shares one `unknown` bucket at 20 times the limit. If the function origin can be reached without the edge in front, the header could be spoofed. [RUNTIME-UNVERIFIED]
- Base44 does not document a platform-native per-function rate limiter that I could find in the SDK; ask Base44 support.
- Database cost if implemented: one read plus one write per public request (about 2 operations), added latency on every call, and the 60-120 requests per minute dashboard polling would multiply it. Not justified without evidence.

**Added in this phase:** one constant diagnostic line per instance, `[rate-limit] public limiter store=shared-kv` or `store=per-instance-memory`, so the owner can read the answer from logs without any burst test. **Recommendation:** implement database-backed public limiting only if logs say `per-instance-memory` **and** abuse is observed; prefer a Base44 or edge-level limit if one exists. Procedure: `BASE44_RUNTIME_VERIFICATION.md`. No burst test was run against production.

## 7. R5: Image proxy SSRF (implemented as far as the runtime allows)

New module `base44/shared/ssrf.ts`; `safeHttpsUrl` now uses it; the image proxy and the token-metadata fetch go through a guarded fetch.

### Protections added [MOCKED], 174 test cases

| Threat | Protection |
|---|---|
| Trailing-dot hostnames (`localhost.`, `metadata.google.internal.`, `foo.lan.`) | One trailing dot is normalised before the checks; more than one is malformed and refused. This was the reported bypass. |
| Localhost variations | `localhost`, `*.localhost`, single-label names, `.local`, `.localdomain`, `.internal`, `.intranet`, `.corp`, `.home`, `.lan`, `.home.arpa`, `.arpa` (reverse DNS), `.test`, `.invalid`, `.onion`, `.ts.net`, `cluster.local`. |
| Alternative IP representations | The URL parser canonicalises decimal, hex, octal, short and integer IPv4 and IPv4-mapped IPv6. Every IP literal, public ones too, is refused, and a final numeric or `0x` label is refused. |
| Private IPv4/IPv6, link-local, metadata endpoints, IPv4-mapped IPv6 | `isPublicIp` classifies resolved addresses: 0/8, 10/8, 100.64/10 (CGNAT, Alibaba metadata), 127/8, 169.254/16 (AWS/GCP/Azure metadata), 172.16/12, 192.0.0/24, 192.0.2/24, 192.168/16, 198.18/15, TEST-NETs, multicast and reserved; IPv6 `::`, `::1`, mapped, compatible, NAT64, 6to4 and Teredo (judged by the IPv4 they carry), unique-local `fc00::/7` (AWS IPv6 metadata `fd00:ec2::254`), link-local, site-local, multicast, documentation. Only global unicast `2000::/3` is public. |
| Public hostnames that point at private addresses | **Lexical part:** wildcard-DNS services (`nip.io`, `sslip.io`, `xip.io`, `localtest.me`, `lvh.me`, and others) and names that embed an IPv4 address (`10.0.0.1.attacker.example`, `127-0-0-1.example`) are refused. **Resolved part:** `createGuardedFetch` resolves the name and refuses unless **every** A and AAAA answer is public, before the first request and before each redirect hop, and refuses when it cannot resolve. |
| Unsafe redirects | Redirects are followed by hand (at most 4); every target goes through the same filter and guard, so a redirect to an internal address, a non-https URL, another port, or one with credentials is refused and never requested. |
| Unsupported schemes, ports, credentials | https only, port 443 only, no userinfo. |
| Response handling | Image types only (SVG and HTML refused), magic-byte check, 1 MB cap, 6 s timeout, served with `CSP: default-src 'none'; sandbox`. Unchanged. |
| Legitimate images | Tests confirm XDEX assets, GitHub raw, IPFS gateways (`ipfs.io`, `cloudflare-ipfs.com`, `*.ipfs.dweb.link`, `pinata`, `nftstorage.link`), Arweave, CDNs, internationalised domains and hash-like subdomains still pass. `ipfs://` URIs were never supported (https only) and still are not; no new outbound host was added. |

### What the runtime does and does not allow (residual exposure)

Base44's documentation describes a "secure, isolated environment" and gives execution limits (5 minutes, 128 MB, 10,000 outgoing requests per call), but says **nothing about outbound network filtering, private-range blocking, DNS APIs or SSRF controls** [PLATFORM-DOC, searched this phase]. Consequences, stated plainly:

1. **The resolved-address check may be dormant.** It runs only if `Deno.resolveDns` exists (feature-detected). Whether it does on Base44 is **unknown**. Where it is absent, a public name that resolves to a private address is **not detected by our code** unless it matches the lexical rules above (wildcard-DNS services, embedded IPs).
2. **No connection pinning.** Even with a resolver, `fetch` resolves again when it connects, so DNS rebinding between our check and the connection cannot be prevented from code.
3. **Network isolation unverified.** Isolated function runtimes commonly cannot reach private ranges, which would make 1 and 2 low impact, but that is [UNVERIFIED]; it is question N8(5) for Base44. No live SSRF probe was made.
4. The URL still originates from on-chain metadata an attacker controls. Worst case without egress isolation: an https request on port 443 to an attacker-chosen host (possibly internal), whose body is returned only if it is a valid image of at most 1 MB.

**This is not complete SSRF protection and must not be described as such.** Section 20 assesses the restricted-allowlist architecture.

## 8. R6 and R7

- **R6:** `tests/backend/security.test.ts` asserts the 16 function directories exist (and nothing else), each exports `entry(...)`, and the three network functions answer anonymously with `success: true` and unchanged shapes. No mandatory authentication was added to any ordinary explorer endpoint.
- **R7:** `X-Frame-Options: DENY` independently confirmed on `https://x1space.xyz` by the owner (also `Strict-Transport-Security: max-age=31536000`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`). **Outstanding owner-side check:** confirm the Base44 editor preview still loads with the setting on. Nothing in Base44 settings was changed by this work.

## 9. Security improvements

- AI spend has a global, per-IP and per-user daily ceiling, reserved before each billable call, **strict by default** (atomic shared counters or no AI), fail closed, UTC reset.
- Atomic counters now exist on Base44 (QuotaCounter actor, service-role only), also used for X1 Ninja.
- The image proxy refuses trailing-dot, internal, wildcard-DNS and IP-embedding hostnames and guards every redirect hop (not complete SSRF protection, see section 7).
- Cache churn cannot force upstream snapshot rebuilds; image memory is bounded in bytes.
- X1 Ninja credentials cannot follow a redirect; all Ninja traffic is metered with sliding-window, cooldown shared across instances, and provider-header reconciliation.
- All five npm advisories cleared: three build-time-only by the `sucrase` lockfile update, two runtime ones by upgrading React Router to 7.18.5 (section 18). `npm audit`: 0 vulnerabilities.
- Fixed a latent defect: AI entries copied the default dependencies with a spread, freezing secret-backed settings at the first request. They now share the singleton (`depsWithClient`).
- Fixed a latent version defect: the function entries pinned `@base44/sdk@0.8.6`, older than the 0.8.62 the app depends on and that actor calls require. They now pin `0.8.62` (**owner-visible change to all ten entries that import the SDK**).

## 10. Files modified (cumulative)

New: `base44/shared/{quota,quotaCounter,ninjaQuota,ssrf}.ts`, `base44/actors/QuotaCounter/entry.ts`, `tests/backend/{security,security2}.test.ts`, `tests/backend/stubs/actors.ts`, `docs/upgrade/ssrf-url-filter-probe.txt`, and the four documents. Changed: `base44/shared/{ai,cache,entry,handlers,http,ninja,store,tokens,upstream,validate}.ts`; ten function entries (platform client factory; SDK pin 0.8.62); `tests/backend/{helpers,handlers,platform}.test.ts`; `vitest.config.js` (alias for the platform-only actor module); `package.json` and `package-lock.json` (`react-router-dom` ^7.18.5; `sucrase` 3.35.1). **No frontend source, design, entity schema, Base44 setting, or secret was changed.** `entityStore.ts` is unused in production (still unit tested).

## 11. Test results

See `SECURITY_REGRESSION_TESTS.md`. 398 tests pass (baseline 149; phase 1 added 75; phase 2 added 174). Lint 0 errors (same 5 pre-existing warnings), typecheck clean, build succeeds, **`npm audit`: 0 vulnerabilities (was 5)**. React Router 7 verified at browser level against 6.30.6 with identical results (`SECURITY_REGRESSION_TESTS.md` section 2b).

## 12. Performance implications

- Public endpoints: no new storage or actor call per request. The ten entries now construct the platform client (object creation only).
- AI calls: three actor calls (user, IP, global) per request, plus up to three refund calls on refusal; small compared with an LLM call.
- Ninja calls: one actor call per upstream request (cache misses only), plus a lease call per 25 requests and an occasional cooldown read. Failed backends are skipped for 60 s.
- Image proxy: the extra lexical checks are microseconds. A DNS lookup per uncached host only if the runtime has a DNS API.

## 13. Incremental operating costs

- X1 Ninja: $0 (free plan). Infrastructure: none added (actors are in the plan: `actors: true`). Actor invocation quotas on Base44 are [UNVERIFIED]; ask (N8).
- AI: only reduced (per-user default 25 to 10, global cap 500 per day). Worst-case estimate in section 2.

## 14. Outstanding vulnerabilities and risks

| # | Severity | Item |
|---|---|---|
| O1 | Medium | **AI is unavailable until the QuotaCounter actor is deployed and verified** (fail closed by design). The atomicity itself is documented platform behaviour, not yet observed (check 4.2). |
| O2 | Medium | If sign-up is open, many IPs and accounts can exhaust the daily global AI budget (availability, not spend). Restrict sign-up (N4). |
| O3 | Low | Public rate limits are per instance unless the runtime offers Deno KV (undocumented); client IP trust unverified (4.5). R1 is deferred by decision (section 19). |
| O4 | Low to Medium | **SSRF exposure remains** (section 7): the resolved-address layer may be dormant, no connection pinning is possible, egress isolation is undocumented. Allowlist assessed in section 20, not implemented. |
| O5 | Low | `InvokeLLM` output length and default model cannot be bounded from our code. |
| O6 | Low | Ninja application limits are exact only with the actor; provider limits are the backstop. |
| ~~O7~~ | Closed | react-router advisories: fixed by the 7.18.5 upgrade (section 18). |
| O8 | Info | Entity operators and `created_date` ordering (used only by the optional ledger) verified against SDK types only. |
| O9 | Info | Base44 editor preview with `X-Frame-Options: DENY` unconfirmed (N2). |
| O10 | Info | **`main` moved after the audited baseline:** `8eaf8de` (`base44-builder[bot]`, SDK `^0.8.63`) is one commit ahead of the branch's base. A simulated merge is conflict-free (not performed). Whether the app is GitHub-connected (API says `git_remote_source: s3`; the bot commits and earlier documents say synced) is to be confirmed (check N9); deployment is therefore drift-checked and has two paths (verification doc 3.5). |
| O11 | Medium (operational) | **Branch isolation is partial**: secrets, data, integrations, settings, the published version and (unlisted) actors are shared with production; merging deploys functions to main. Mitigated by the shared-resource table and secret handling in the verification document. |
| O12 | Low | Frontend `react-router-dom` 7 is verified by a browser script on a production build, not by a full signed-in regression of every page. |

## 15. Required Base44 settings and secrets

| Name | Required? | Recommended | Effect |
|---|---|---|---|
| `X1_NINJA_API_KEY` | already set | unchanged | Never printed or changed by this work. |
| `AI_QUOTA_MODE` | optional | **leave unset** (strict) | `best_effort` allows the non-atomic ledger (not a hard cap). |
| `AI_DAILY_QUOTA` | optional | `10` | Per user per UTC day. |
| `AI_IP_DAILY_QUOTA` | optional | `30` | Per IP per UTC day. |
| `AI_GLOBAL_DAILY_QUOTA` | optional | `500` (lower to fit credits) | All users per UTC day. |
| `X1_NINJA_MONTHLY_QUOTA` | optional | `450000` | Under the plan's 500,000. |
| `X1_NINJA_RATE_LIMIT_PER_MIN` | optional | `50` | Under the plan's 60. |
| `X1_NINJA_RESET_DAY` | optional | `1` | Provider cycle start (UTC). |

Required deployment items (not secrets): the `QuotaCounter` actor deployed; function entries on `@base44/sdk@0.8.62`; the existing `RateLimit` entity (no schema change). Settings: restrict sign-up to verified email; set an AI credit alert or cap; keep Block iframe embedding on; keep Core integrations backend-only.

## 16. Production readiness assessment (final)

**Source and mocked-test level: ready.** All gates pass: 398 tests, lint 0 errors, typecheck clean, build succeeds, `npm audit` 0 vulnerabilities, secret scan of the build output clean.

**Runtime level: not yet proven, and not yet deployable without owner action.** The QuotaCounter actor, the sliding-window governor against the real provider, the client-address behaviour, the actor's service-only access control and the branch deployment itself have never run on Base44. This is by design: nothing was deployed.

**Verdict: READY TO START BRANCH VERIFICATION; NOT YET READY TO MERGE TO PRODUCTION.**

### Exact production merge prerequisites

1. Owner review and explicit approval to merge `claude/x1space-security-hardening`.
2. Bring the hardening branch up to date with `main` (`8eaf8de`, conflict-free in simulation). Follow `BASE44_RUNTIME_VERIFICATION.md` section 3 exactly: protect the baseline (checkpoint), confirm the GitHub connection (N9), run the drift check, create the branch through the API (no AI credits), import it (path A) or write the 25 `base44/` files with `sandbox write --branch` (path B), verify the actor with the `403` probe.
3. Pass: A1 (`backend=actor`), A2 (`enforcement=shared-atomic`), A4 (anonymous endpoints 200), A5 (actor refuses non-service callers), N2 (editor preview with `X-Frame-Options: DENY`).
4. Pass 4.2 (parallel ceiling, at most 3 billable calls), 4.1 (Retry-After to 00:00 UTC) and 4.3 (persistence). If 4.2 fails, AI stays off (strict mode already keeps it off).
5. Confirm the sign-up policy (N4) and set the strictest AI credit limit the dashboard offers (3.11).
6. Remember that secrets, data and the published version are shared: only new secret names may change before the merge; `AI_DAILY_QUOTA=10` is set after it.
7. Merge (this deploys functions to main), re-run A4 on the published site, watch logs 15 minutes, then publish as a separate action.
8. Apply the React Router 7 change afterwards as its own branch.
9. Keep `SECURITY_ROLLBACK.md` and the rollback criteria (verification doc section 5) ready.

Decisions already made by the owner and implemented: SDK 0.8.6 to 0.8.62, the QuotaCounter actor, strict atomic AI quotas (AI stays unavailable without reliable atomic enforcement), existing Ninja limits, R3 to R8.

### Unresolved risks after this phase

| # | Risk | Severity | Owner action |
|---|---|---|---|
| 1 | Actor serialization, access control and branch behaviour unverified on Base44 | Medium | Section 3.6 and checks 4.1 to 4.3 |
| 2 | Public rate limiting is per instance (R1 deferred), client IP trust unverified | Low | 4.5; approve an actor-backed limiter for expensive endpoints only if needed |
| 3 | SSRF: not complete; egress isolation undocumented; DNS layer may be dormant | Low to Medium | Ask Base44 (N8); consider the allowlist (section 20) |
| 4 | Open sign-up would allow account farming against the daily AI budget (availability only) | Medium | N4 |
| 5 | AI output length and default model not controllable from code; no confirmed app-level credit cap | Low | 3.11, N8(4) |
| 6 | Branch shares secrets, data, integrations and (likely) actors with production; merging deploys functions | Medium (operational) | Follow 3.0 table |
| 7 | `main` has advanced by a Base44 bot commit (SDK ^0.8.63); GitHub connection status unconfirmed | Low | Section 3.3a and N9 |
| 8 | Frontend 128 MB function memory and large snapshot rebuild (pre-existing design) | Info | None required |

## 17. Rollback

See `SECURITY_ROLLBACK.md`. Baseline `374f05fc8b0e392723c7d3801fa23c3294ff916a`.

## 18. Dependency vulnerabilities (closed)

Baseline `npm audit`: 5 moderate, 0 high, 0 critical. Now: **0 vulnerabilities**. `npm audit fix --force` was not used.

| Package | Advisory | Exposure | Exploitability | Status |
|---|---|---|---|---|
| `glob` 10.5.0 (via `tailwindcss`, `sucrase`) | GHSA-3g3m-2fjr-6pw4: AbortSignal cancellation bypass allows post-timeout filesystem traversal | **Build time only**: Tailwind's compiler dependency. Not in the production bundle. | Needs an attacker-controlled glob and an abort signal at build. None. | **Fixed** (removed) |
| `minimatch` 9.0.9 (via `glob`) | GHSA-g3hv-75wg-m249: DoS through globparts amplification | Build time only | Needs a crafted glob pattern at build. None. | **Fixed** (removed). ESLint's own `minimatch@3.1.5` is outside the vulnerable range. |
| `sucrase` 3.35.0 (via `tailwindcss`) | Flagged only because it depended on `glob` | Build time only | As above | **Fixed**: `sucrase@3.35.1` (within the `^3.35.0` range Tailwind declares) replaces `glob` with `tinyglobby`. Lockfile only; `package.json` unchanged; **31 packages removed**; production bundle byte-identical; build, lint, typecheck and 398 tests unchanged. |
| `react-router` 6.30.6 | GHSA-wrjc-x8rr-h8h6: open redirect via a backslash in `<Link>`/`useNavigate` (bypass of CVE-2025-68470); GHSA-337j-9hxr-rhxg: constructor injection via `deserializeErrors()` in **SSR hydration** | **Production** (runtime dependency) | First: only if attacker-controlled text is passed as the start of a `to` target. Every navigation target in this app is a fixed page path from `createPageUrl(...)` (always starting with `/` and a known page name) followed by a query string, including the global search (`src/lib/x1/search.js`) and the shell, so the pattern was **not present**. Second: client-rendered SPA, no SSR hydration, **not applicable**. | **Fixed: upgraded to 7.18.5** |
| `react-router-dom` 6.30.6 | Same two advisories (it re-exports `react-router`) | Production | Same | **Fixed: upgraded to `^7.18.5`** |

### React Router 7.18.5: adopted

The advisory range covered all of 6.x, so no 6.x patch existed; the fix is a major version. It was adopted after verification (commit `cbb06c2`):

| Requirement | Result |
|---|---|
| Base44 build environment | The app's sandbox reports **Node v24.22.1, npm 10.9.9** [API-READ]. React Router 7.18.5 requires Node 20 or later; peer dependency `react >= 18` (the app uses 18). |
| Vercel | Default Node is 24 [PLATFORM-DOC], above the minimum. The SPA rewrite in `vercel.json` matches all 28 route shapes and excludes `/functions/*` and `/assets/*`. |
| Routes, direct navigation, refresh, URL parameters, search, history, error pages, signed-out auth surfaces, open-redirect probes | **Identical results** on 6.30.6 and 7.18.5 (30 direct routes, 7 parameter cases, 4 refresh cases, 4 search cases, history back/forward, 404 handling, 3 auth cases, 3 redirect probes). |
| Regression suite | 398 tests, lint, typecheck, build unchanged. |
| Dependency audit | **0 vulnerabilities.** |
| Not verified | Pages that need live RPC/XDEX data in the sandbox, and signed-in flows. Mitigation: re-run the router checks on the branch preview before the frontend change is merged (verification doc 3.12). `package.json` was changed by one line; no source file changed. |

If a problem appears after merging the frontend change, revert commit `cbb06c2` (two files).

## 19. R1 deferred: remaining distributed rate-limit exposure

Decision: R1 is deferred. No actor call and no database operation was added to any public request. Existing per-IP limits, response caching, request coalescing and upstream protection are unchanged (the full suite passes).

| Exposure | Detail | Bound |
|---|---|---|
| Per-instance counters | Public limits (20 to 120 requests per minute per IP per function, 600 for images) are counted in each instance's memory unless Deno KV exists. A caller whose requests land on several instances gets several allowances. | Each instance still enforces its own limit; the expensive paths are also protected by caching and coalescing per instance, and by upstream timeouts, size caps and 128 MB memory. |
| Client address trust | `cf-connecting-ip` only. If the platform does not set it, everyone shares one bucket at 20 times the limit; if a caller can set it, per-IP limiting can be bypassed. | Check 4.5 answers this. |
| Rotating IPs | Any per-IP limiter is defeated by many IPs; a shared store would not change that. | Caching limits upstream cost regardless. |
| X1 Ninja and AI | Not exposed: both are metered by the actor, not by the public limiter. | Atomic if check 4.2 passes. |

Implementing R1 later would add roughly one actor call per public request (latency and call-quota cost on every explorer view). A proportionate alternative needing approval: an actor-backed limiter only on `getTokens`, `searchTokens` and `getImage`, or a platform-level limit if Base44 offers one.

## 20. R5: restricted image-host allowlist, feasibility (investigation only; not implemented)

### 20.1 What legitimate images come from today

**Census of listed tokens.** One read-only `GET` of XDEX's public pool list (the same API the explorer already calls; a single request) returned the first 100 of 293 pools (34 percent of the list): **200 logo references on 9 hosts**. A paging parameter that would return the remaining pools was not identified, and no further requests were made, so this is a sample, not a full census.

| Host | Share of logos | Kind |
|---|---|---|
| `app.xdex.xyz` | 60% | XDEX's own asset host |
| `mint.degen.fyi` | 22% | IPFS gateway of a launchpad |
| `mint.xdex.xyz` | 10% | XDEX IPFS gateway (URL carries a Pinata gateway token query) |
| `mint.xendex.io` | 5% | IPFS gateway (URL carries a Pinata gateway token query) |
| `degen-fyi.s3.us-east-2.amazonaws.com`, `www.x1inscriptions.io`, `gateway.pinata.cloud`, `x1forge.xyz`, `ipfs.io` | 1% each | S3 bucket, project sites, public IPFS gateways |

About **38 percent** of logos are IPFS gateway URLs on several different hostnames, and about 2 percent are single-project websites. Source and test fixtures add: `raw.githubusercontent.com` (asset repositories), `cloudflare-ipfs.com`, `*.ipfs.dweb.link`, `nftstorage.link`, `arweave.net`. Gateway URLs carry a `?pinataGatewayToken=` query written by XDEX; an allowlist that matched whole URLs or dropped queries would break them (a hostname allowlist does not).

**Unlisted tokens** (metadata `image` fields on chain): not sampled, because that needs a heavy `getProgramAccounts` scan of the Metaplex program, which I did not run. Expect the usual long tail: IPFS and Arweave gateways, GitHub raw, S3/CDN buckets, imgur-style hosts and project domains. `ipfs://` and `ar://` URIs are **not** supported today (https only) and would need a gateway mapping.

### 20.2 Impact of an allowlist

| Aspect | Effect |
|---|---|
| Security | Removes the ability to choose an arbitrary host. Redirects would be re-checked against the same list. The remaining exposure shrinks to the allowlisted operators. |
| Existing listings | A hostname allowlist built from the census would cover 100% of the sampled XDEX logos with about 9 entries. Listed tokens with logos on other hosts would lose them (placeholder). |
| New listings | Every project that hosts its logo on a new domain or a new gateway subdomain (`mint.<launchpad>.io`) loses its logo until someone adds it. XDEX's own launchpad creates new gateway hostnames, so this needs ongoing maintenance and a clear owner. |
| Unlisted tokens | Most would show a placeholder unless their metadata uses a listed gateway. |
| Wildcards | `*.mypinata.cloud`, `*.ipfs.dweb.link` style patterns keep coverage but admit any account holder's subdomain (still a public host operated by the provider, not attacker DNS). |
| Operations | A list in code needs a deploy to change; a list in an entity or a secret avoids that but is data an operator must govern. |

### 20.3 Options

| Option | Security | UX / listings | Effort | Note |
|---|---|---|---|---|
| A. Strict hostname allowlist | Highest of the proxy options | Loses long-tail logos | Small | Needs a maintenance owner |
| B. Observe first, then enforce | Same as A after the observation window | None during observation | Small | **Recommended path:** add a log-only mode that records the **hostname** (never the full URL) of every image the proxy fetches and whether it would have been blocked, run it for a few weeks to build a real census, then enforce |
| C. Pre-fetch and store vetted logos for listed tokens | High | Listed tokens keep logos; others placeholder | Medium to large, storage and a refresh job | Needs file storage and an approval step |
| D. Keep today's filter, add DNS checks if the runtime gains them | Medium | No change | Already done | The feature-detected resolver activates automatically |

### 20.4 What Base44 documents about outbound isolation

Searched this phase (backend functions overview, CLI and security overview pages, skills repository): functions run in "a secure, isolated environment" on Deno; limits are 5 minutes, 128 MB and 10,000 outgoing requests per call. **No page documents egress filtering, private or link-local blocking, DNS resolution APIs, or SSRF controls.** The workspace "network location" setting limits who can sign in, not what functions can reach. So the platform's outbound isolation is **unconfirmed**, and the supported SSRF mechanisms are only the ones we build (filter, guard). No live SSRF probe or internal network probe was made. Questions for Base44 support: N8 (5) and (7) in the verification document.

### 20.5 Recommendation

Do **not** enforce an allowlist yet. Take option B (log-only hostnames, then decide with data) and ask Base44 the two outbound-isolation questions. If Base44 confirms private-range egress is blocked, keep the current filter. If it cannot, enforce option A with the hostnames from the observation window.
