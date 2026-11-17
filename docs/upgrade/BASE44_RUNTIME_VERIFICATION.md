# Base44 Runtime Verification Procedure (revision 2)

Everything in `SECURITY_REGRESSION_TESTS.md` is **mocked**. This document is the owner-run procedure that turns the remaining runtime assumptions into facts, using the **existing** Base44 app. It does not assume a second app can be created.

Evidence labels: **[PLATFORM-DOC]** stated in Base44's published documentation or SDK; **[API-READ]** returned by a read-only Base44 API call made during this phase; **[UNVERIFIED]** nothing so far proves it.

## 0. What was learned about the existing Base44 environment (read-only)

Read-only calls made this phase (no change to the app, its settings, secrets or data):

| Fact | Source | Consequence |
|---|---|---|
| App `X1Space Explorer` is a Vite SPA, backend runtime `current`, actors entitlement `true`, workflows `false` | [API-READ] `GET /api/apps/{id}/agent-profile` | Actors can be deployed; this is how atomic quotas are built. |
| `core_integrations: backend_functions_only`: "the runtime rejects the call from client code" | [API-READ] same call | A browser cannot call `integrations.Core.InvokeLLM` directly. Server-side AI is the only billable path. Still verify (check B6). |
| The app has exactly one branch, `main`; the platform offers branches (create, sync from main, merge, delete) and a draft preview URL | [API-READ] `GET branches`, catalog | A branch can be used instead of a new app. **No branch was created.** Whether creating one counts against the app limit is [UNVERIFIED]. |
| The app's code is stored by Base44 (`git_remote_source: s3`), not linked to this GitHub repository | [API-READ] `list_user_apps` | This repository is a development copy. Getting the branch's files into Base44 is a separate, explicit step (section 3). |
| Backend functions run in a **Cloudflare Worker** ("a Worker holds 6 connections", `waitUntil`) and actors are **Durable Objects** | [PLATFORM-DOC] Base44 skills repository, backend-functions and actors references | **`Deno.openKv` does not exist here**, so the public rate limiter is per instance by construction, and the old plan of metering AI with Deno KV is impossible. |
| Server code can call an actor method with `base44.asServiceRole.actors.<Name>(<session>).<method>(args)`; the actor sees identity `service`; any client can call any callable method, so the actor must check identity; methods need `@base44/sdk` 0.8.62 or later | [PLATFORM-DOC] actors reference and SDK type definitions | The QuotaCounter actor does exactly this. The ten function entries now pin `@base44/sdk@0.8.62` (they pinned `0.8.6`, which is older than 0.8.62). |
| In the editor, a draft version of functions and actors runs for editors, while everyone else gets the published one | [PLATFORM-DOC] SDK comments (`functionsVersion`) | Draft code can be exercised without publishing. Confirm in check A3. |
| Backend function logs are readable per function (`GET /api/apps/{id}/functions-mgmt/{function}/logs`), and secrets can be listed and set | [API-READ] catalog | Log lines can be read from the dashboard or the API. Do not read secret values. |
| `prevent_iframe_embedding` exists as a security setting | [API-READ] catalog | Matches the header you confirmed live. |

## 1. What can be checked now (no deployment of the branch)

| ID | Check | How | Expected / meaning |
|---|---|---|---|
| N1 | `X-Frame-Options: DENY` live | Already confirmed by you. | Done. |
| N2 | Base44 editor preview with Block iframe embedding on | Open the app in the Base44 editor and its preview. | Preview loads. If blocked, turn the setting off, note it, and ask Base44 whether the editor origin is exempt. This is the only remaining header item. |
| N3 | Which secrets exist | Dashboard, Secrets page: confirm `X1_NINJA_API_KEY` is listed (never open or copy its value). | Present. |
| N4 | Sign-up policy | Dashboard, app settings, access/authentication. Record whether anyone can register, whether email verification is required, and whether registration can be restricted. | Decides the account-farming exposure (risk O2). Recommended: verified email required. |
| N5 | Current X1 Ninja connectivity | Open `https://x1space.xyz/tokens` (or any token page) and look at the source pill "X1 Ninja". Also in the X1 Ninja dashboard confirm the key is active and note "requests this month". | Pill shows OK. If "not configured" or error, the key or connectivity needs attention before anything else. |
| N6 | Baseline function logs | Read the logs of `getTokens` after a page view. | Establish what normal looks like. The new diagnostic lines do not exist yet. |
| N7 | AI credit cap | Dashboard, billing/usage: look for an integration-credit limit or alert. | Set one if offered. Max AI use is bounded by `AI_GLOBAL_DAILY_QUOTA` once enforcement is verified. |
| N8 | Ask Base44 support (no cost) | (1) Does the Worker see the real client IP in `cf-connecting-ip`, set by the edge and not by the caller? (2) Are Durable Object method calls serialized per instance across `await` points on storage? (3) Is there a platform rate limiter for functions? (4) What is `InvokeLLM`'s default model, output cap and internal retry behaviour? (5) Can private and link-local egress from `fetch` be assumed blocked? (6) Does a branch count toward the app limit? | Answers close risks O3, O5 and the R5 residual. |

## 2. What requires the branch to be deployed

These need the QuotaCounter actor and the new function code to exist on Base44, so they cannot be checked before section 3.

| ID | Check | How | Expected / meaning |
|---|---|---|---|
| A1 | Actor deployed and reachable | After section 3, in the function logs of `smartSearch`, look for `[ai-quota] backend=actor`. | `actor` means atomic shared counters are in use. `none (AI refused)` means the actor is missing or unreachable: AI answers 503 (by design). |
| A2 | Quota backend per function | Logs: `[x1ninja-quota] enforcement=shared-atomic` after a token page load; `[rate-limit] public limiter store=per-instance-memory` (expected on Workers). | `shared-atomic` means the Ninja limits are exact across instances. `per-instance` means the actor call fails: investigate before relying on the monthly cap. |
| A3 | Draft vs published | Run A1 to A2 as an editor on the draft/preview first (see 3.2). | Logs appear for the draft while the public site still runs the old code. |
| A4 | Anonymous endpoints unaffected | `curl -s -o /dev/null -w "%{http_code}\n" "<URL>/functions/getTokens?limit=1"` and `.../getNetworkStats` | `200`. Confirms adding the platform client to ten entries did not break anonymous callers. |
| A5 | Actor refuses non-service callers | In the signed-out site, DevTools console cannot reach `QuotaCounter` unless the SDK is exposed; instead rely on the unit tests, and ask Base44 to confirm that a browser call to a method returns 403 when identity is not `service`. Optionally, as an editor with the actor deployed, call `base44.actors.QuotaCounter("probe").used({key:"probe"})` from a throwaway page: expected `403`. | `403` closes risk "anyone can read or reset counters". |
| A6 | Retry-After and UTC reset | Section 4.1 | Header equals the seconds to 00:00 UTC. |
| A7 | Atomic ceiling under parallel load **(billable, needs your approval)** | Section 4.2 | At most `AI_GLOBAL_DAILY_QUOTA` model calls. |
| A8 | Persistence across instance restarts | Section 4.3 | Counter survives idle recycling. |
| A9 | Ninja usage matches expectation | Section 4.4 | Provider dashboard count is consistent with the governor. |
| A10 | Client IP trust **(small burst, needs your approval)** | Section 4.5 | Limiter keys on the edge-set address. |
| A11 | Sign-up policy effect | N4 | See decision table. |

## 3. Getting the branch onto Base44 safely

Nothing here has been run. The goal is to avoid publishing to production until the checks pass.

### 3.1 Option 1 (preferred): a Base44 branch of the existing app
1. In the Base44 editor use **Branches, Create branch** (platform API: `POST /api/apps/{app_id}/branches`). It branches from `main`; it is not "create a new app". If Base44 refuses because of a plan limit, use option 2.
2. With the Base44 CLI from a local checkout of `claude/x1space-security-hardening`, push to that branch (`base44 ... --branch <name>`; confirm the exact command with `base44 --help`, the Base44 tools describe `--branch` as the way to target a branch).
3. Open the branch's preview. Run section 2 against the **branch preview URL**. The public site is untouched.
4. Delete the branch if the checks fail (`DELETE .../branches/{id}`): nothing was merged.

### 3.2 Option 2: draft changes on `main`, not published
1. Apply the branch's files to the app's code (editor "Code" view, or the CLI), **without clicking Publish/Deploy**. Per the SDK, editors get the draft function and actor versions while visitors keep the published ones.
2. Test as an editor through the preview URL (`GET /api/apps/{app_id}/sandbox/preview-url`).
3. If a check fails, restore the last checkpoint in the editor (version history) and nothing public has changed.
4. Caution: if Base44 auto-publishes functions as soon as files are written, this option publishes. The agent-profile statement for functions is "a function deploys automatically once its file is written". **Prefer option 1** unless Base44 confirms drafts stay unpublished.

### 3.3 Required before testing
- Secrets (all optional; recommended values in section 6).
- The `QuotaCounter` actor deployed (actors are deployed separately from functions; if the actor does not appear, use the Base44 CLI actors deploy command, see the Base44 CLI reference "actors-deploy").
- The `RateLimit` entity exists already (admin-only). **No schema change was made**, and the new code does not need one.

## 4. Controlled post-deployment checks

All use the branch preview (or draft). None writes anything except `RateLimit` entity rows and actor storage. Steps marked **[approval]** are billable or burst-like and must not run without your explicit go-ahead. No production burst test is part of this document.

### 4.1 Retry-After and global cap  **[approval: one billable AI call]**
Set `AI_GLOBAL_DAILY_QUOTA=1` on the preview. Sign in, then in DevTools:
```js
const t = localStorage.getItem('base44_access_token');   // your own token; never share it
const id = localStorage.getItem('base44_app_id');
const call = () => fetch('/api/apps/' + id + '/functions/smartSearch', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: JSON.stringify({ query: 'tps' }) }).then(async r => [r.status, r.headers.get('retry-after'), (await r.json()).error?.code]);
console.log(await call()); console.log(await call());
```
Expected: `[200, null, undefined]` then `[503, "<seconds>", "ai_capacity_reached"]`; `<seconds>` equals the time left until 00:00 UTC (`date -u`). If the keys above are empty, find the `base44_` keys under Application, Local Storage.

### 4.2 Parallel ceiling  **[approval: at most 3 billable calls]**
Use a fresh UTC day or a new quota value. Set `AI_GLOBAL_DAILY_QUOTA=3`, then:
```js
const rs = await Promise.all(Array.from({ length: 12 }, call));
console.log(rs.filter(r => r[0] === 200).length, 'allowed of 12');
```
Expected: **3 or fewer** `200`s (some `429 rate_limited` is normal: burst limit 5 per minute). More than 3 means actor calls are not serialized as documented: **stop, do not merge**, and AI must stay disabled (strict mode does not help if the primitive is not atomic).

### 4.3 Persistence  **[approval, no extra billing]**
Continue from 4.1 after 20 or more idle minutes. `await call()` must still return `503 ai_capacity_reached`. A `200` means the counter is not durable.

### 4.4 X1 Ninja accounting
After an hour of normal use, compare the X1 Ninja dashboard "requests this month" with expectation: about 60 pool requests per hour per active instance plus candle/trade requests, never above 50 per minute. In function logs expect `enforcement=shared-atomic`. If the number is far higher, caching or the governor is not working.

### 4.5 Client IP and limiter  **[approval: 35 cheap cached requests]**
```bash
for i in $(seq 1 35); do curl -s -o /dev/null -w "%{http_code}\n" \
  -H "CF-Connecting-IP: 198.51.100.$i" -H "X-Forwarded-For: 203.0.113.$i" \
  "<URL>/functions/detectAnomalies"; done | sort | uniq -c
```
Roughly 30 `200` and 5 `429`: the edge sets the address and the (per-instance) limiter counts per source. 35 `200`s: the header is client-controlled or absent, so the public limiter can be bypassed (risk O3); ask Base44 about a platform limit.

### 4.6 Editor preview and anonymous traffic
Reconfirm N2 and A4 on the final deployment.

## 5. Immediate rollback criteria

Roll back (section 3.1 step 4, or `SECURITY_ROLLBACK.md`) immediately if any of these happens after deployment:
1. Any public page or function that returned `200` before now returns 5xx for anonymous callers (`getTokens`, `getTokenPrices`, `getImage`, `getNetworkStats`).
2. Function logs show repeated `[function] unhandled error` or boot errors after the SDK pin change.
3. 4.2 returns more `200`s than the configured global quota.
4. The X1 Ninja dashboard shows more than 20 percent above the governor's expected rate for two consecutive hours, or the key is revoked.
5. Images stop loading broadly (the SSRF filter is too strict for a real host): collect two failing URLs first.
6. AI returns 503 for signed-in users after the actor is confirmed deployed and A1 says `backend=actor` (then the actor call is failing: roll back, do not switch to `best_effort` without a decision).
7. The Base44 editor preview breaks (N2) and cannot be fixed by the setting.

Not a rollback trigger: AI answers `503 ai_unavailable` **before** the actor is deployed. That is the intended fail-closed behaviour.

## 6. Required settings and secrets

| Name | Recommended | Meaning |
|---|---|---|
| `X1_NINJA_API_KEY` | existing | Never read or printed by this work. |
| `AI_QUOTA_MODE` | leave **unset** (strict) | `strict`: AI runs only with atomic shared counters. `best_effort` accepts the non-atomic entity ledger (not a hard ceiling). Use only by explicit decision. |
| `AI_DAILY_QUOTA` | `10` | Per signed-in user per UTC day. |
| `AI_IP_DAILY_QUOTA` | `30` | Per IP per UTC day. |
| `AI_GLOBAL_DAILY_QUOTA` | `500`, or lower for the credit budget | All users, per UTC day. |
| `X1_NINJA_MONTHLY_QUOTA` | `450000` | Application limit under the provider's 500,000. |
| `X1_NINJA_RATE_LIMIT_PER_MIN` | `50` | Application limit under the provider's 60. |
| `X1_NINJA_RESET_DAY` | `1` | Provider cycle starts the 1st (UTC). |

Settings: restrict sign-up to verified email (N4), set an AI credit alert or cap (N7), keep Block iframe embedding on, and **do not** change `Core integrations` away from backend-only.

## 7. Decision guide

- A1 `actor`, 4.2 and 4.3 pass: strict AI enforcement is proven. Merge.
- A1 `none`: deploy/redeploy the actor (3.3). Do not merge until it says `actor`, or decide explicitly that AI stays off.
- 4.2 fails: do not merge with AI enabled. Fallback architecture: one backend function that is the only AI caller, running AI jobs from a queue entity with a daily cap enforced by a single writer.
- 4.5 shows spoofable headers: request approval for an actor-backed limiter on the expensive public endpoints, or a platform limit.

## 8. Result record

| ID | Date | Result | Decision |
|---|---|---|---|
| N2 editor preview | | | |
| N4 sign-up policy | | | |
| N5 Ninja connectivity | | | |
| N8 Base44 answers | | | |
| A1 backend=actor | | | |
| A2 enforcement / limiter store | | | |
| A4 anonymous endpoints | | | |
| A5 actor refuses non-service | | | |
| 4.1 Retry-After and cap | | | |
| 4.2 parallel ceiling | | | |
| 4.3 persistence | | | |
| 4.4 Ninja accounting | | | |
| 4.5 client IP | | | |
