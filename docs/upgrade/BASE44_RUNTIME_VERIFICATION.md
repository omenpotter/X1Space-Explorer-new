# Base44 Runtime Verification and Branch Deployment Procedure (revision 3)

Everything in `SECURITY_REGRESSION_TESTS.md` is **mocked**. This document is the owner-run procedure that turns the remaining runtime assumptions into facts, using the **existing** Base44 app. It does not assume a second app can be created.

Evidence labels: **[PLATFORM-DOC]** stated in Base44's published documentation or SDK; **[API-READ]** returned by a read-only Base44 API call made during this phase; **[UNVERIFIED]** nothing so far proves it.

## 0. What was learned about the existing Base44 environment (read-only)

Read-only calls made this phase (no change to the app, its settings, secrets or data):

| Fact | Source | Consequence |
|---|---|---|
| App `X1Space Explorer` is a Vite SPA, backend runtime `current`, actors entitlement `true`, workflows `false` | [API-READ] `GET /api/apps/{id}/agent-profile` | Actors can be deployed; this is how atomic quotas are built. |
| `core_integrations: backend_functions_only`: "the runtime rejects the call from client code" | [API-READ] same call | A browser cannot call `integrations.Core.InvokeLLM` directly. Server-side AI is the only billable path. Still verify (check B6). |
| The app has exactly one branch, `main`; the platform offers branches (create, sync from main, merge, delete) and a draft preview URL | [API-READ] `GET branches`, catalog | A branch can be used instead of a new app. **No branch was created.** Whether creating one counts against the app limit is [UNVERIFIED]. |
| The Base44 API reports the app's code source as `git_remote_source: s3`, **but** this repository's `main` receives commits from `base44-builder[bot]` (the newest, `8eaf8de` "Update base44 packages", bumped `@base44/sdk` to `^0.8.63` after the audited baseline), and earlier project documents record main-only GitHub sync | [API-READ] `list_user_apps`; `git log origin/main`; `docs/upgrade/BASE44_PREVIEW_PLAN.md` | **Which of the two is true must be confirmed in the dashboard's GitHub panel (check N9).** The procedure below works either way: section 3.5 gives a GitHub-import path and a sandbox-write path. |
| The backend runtime is described as **Deno** ("Deno-powered serverless functions"; logs include "Deno Deploy" system entries), while limits are phrased in terms of **Workers** ("Worker exceeded memory limit", 128 MB, 5 minutes, 10,000 outgoing requests per call) and actors are **Durable Objects**. **Whether Deno KV and `Deno.resolveDns` exist is not documented.** | [PLATFORM-DOC] Base44 backend-functions overview, CLI `logs` reference, skills repository | *Correction to revision 2, which said KV cannot exist.* Nothing in the design depends on KV or DNS: atomic counters come from the actor, and both KV and the resolver are feature-detected. The log line `[rate-limit] public limiter store=...` states the truth for the public limiter. |
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
| N8 | Ask Base44 support (no cost) | (1) Does the function see the real client IP in `cf-connecting-ip`, set by the platform edge and not by the caller? (2) Are Durable Object method calls serialized per instance across `await` points on storage? (3) Is there a platform rate limiter for functions? (4) What is `InvokeLLM`'s default model, output cap and internal retry behaviour? (5) Can private and link-local egress from `fetch` be assumed blocked? (6) Does a branch count toward the app limit? | Answers close risks O3, O5 and the R5 residual. |
| N9 | GitHub connection | Dashboard (top-right GitHub icon): is `omenpotter/X1Space-Explorer-new` shown as connected, and which branch syncs (should be `main` only)? | Decides section 3.5 path A versus B. Also confirm `main` is `8eaf8de` or later and that the hardening branch is 1 commit behind it (3.3a). |

## 2. What requires the branch to be deployed

These need the QuotaCounter actor and the new function code to exist on Base44, so they cannot be checked before section 3.

| ID | Check | How | Expected / meaning |
|---|---|---|---|
| A1 | Actor deployed and reachable | After section 3, in the function logs of `smartSearch`, look for `[ai-quota] backend=actor`. | `actor` means atomic shared counters are in use. `none (AI refused)` means the actor is missing or unreachable: AI answers 503 (by design). |
| A2 | Quota backend per function | Logs: `[x1ninja-quota] enforcement=shared-atomic` after a token page load; `[rate-limit] public limiter store=per-instance-memory` (expected unless the runtime offers Deno KV). | `shared-atomic` means the Ninja limits are exact across instances. `per-instance` means the actor call fails: investigate before relying on the monthly cap. |
| A3 | Branch vs published | Run A1 to A2 as a signed-in editor on the branch preview (section 3). | The branch's function version runs for you while visitors still get the last published version. |
| A4 | Anonymous endpoints unaffected | `curl -s -o /dev/null -w "%{http_code}\n" "<URL>/functions/getTokens?limit=1"` and `.../getNetworkStats` | `200`. Confirms adding the platform client to ten entries did not break anonymous callers. |
| A5 | Actor refuses non-service callers | The `curl` probe in section 3.6 with your own user token. | `403` closes the risk "anyone can read or reset counters"; `200` is a stop-ship failure. |
| A6 | Retry-After and UTC reset | Section 4.1 | Header equals the seconds to 00:00 UTC. |
| A7 | Atomic ceiling under parallel load **(billable, needs your approval)** | Section 4.2 | At most `AI_GLOBAL_DAILY_QUOTA` model calls. |
| A8 | Persistence across instance restarts | Section 4.3 | Counter survives idle recycling. |
| A9 | Ninja usage matches expectation | Section 4.4 | Provider dashboard count is consistent with the governor. |
| A10 | Client IP trust **(small burst, needs your approval)** | Section 4.5 | Limiter keys on the edge-set address. |
| A11 | Sign-up policy effect | N4 | See decision table. |

## 3. Deploying the hardened branch to a Base44 branch preview, step by step

Everything in this section is an **owner action**. Nothing was run by Claude. `<APP_ID>` is your app id (Base44 dashboard, or `base44 branches list`). Do not paste tokens into chats or commit them.

### 3.0 What is shared with production, and what is not

**Do not assume a Base44 branch is isolated from production.** From Base44's "Working with branches" page [PLATFORM-DOC] and the checks in this phase:

| Item | On a branch | Consequence for this deployment |
|---|---|---|
| App code, preview, version history | **Own copy** | The branch is where the hardened `base44/` files go. |
| Backend functions you change | **Own copy**, but only **signed-in editors** get the branch version; visitors and app users keep getting the last **published** version | Public traffic is not affected by the branch's functions. Test while signed in as an editor. |
| **Actors** | **Not listed in Base44's branch table: treat as shared with production** | The `QuotaCounter` actor is new and additive. Production code does not call it, and it refuses everyone except the service role and all WebSocket connections, so it is inert for production. Its counters (`ai-*`, `x1ninja:*`) are shared, which is correct for accounting. |
| **Secrets** (`X1_NINJA_API_KEY`, all `AI_*`, `X1_NINJA_*`) | **Shared** | A secret changed "for the test" changes production. The **old production code reads only `AI_DAILY_QUOTA`** (and `X1_NINJA_API_KEY`, `GEOLOCATION_DISABLED`, `ALLOWED_ORIGINS`). It ignores `AI_GLOBAL_DAILY_QUOTA`, `AI_IP_DAILY_QUOTA`, `AI_QUOTA_MODE` and every `X1_NINJA_*` limit, so **setting only those new names is safe before merge**. **Do not change `AI_DAILY_QUOTA` until after the merge.** |
| `ACTOR_TOKEN_SECRET` | Shared, created by Base44 the first time any actor is deployed | Do not create, read or overwrite it (Base44 warns that changing it rotates actor keys). Its appearance in the secrets list is expected. |
| **Data and entity records**, including `RateLimit` | **Shared (live data)** | The new code stores counters in the actor, not in `RateLimit`, and needs no entity or schema change. |
| Entity schemas | Branch can add; removals and permission changes happen on main | Do not change any entity. |
| Integrations, workflows, connectors | **Shared** | The AI model integration and the X1 Ninja connectivity are production's. |
| Settings (sign-up policy, iframe protection), domains, **published version** | **Shared** | A branch preview does not publish. **Merging does not publish either** ("you publish from main after merging"), which gives two separate gates, but Base44 says merging **deploys backend functions to main**: treat the merge as potentially production-affecting. |
| Test data | One set shared by main and every branch | Not used by this work. |
| Branch preview URL | Opens for whoever the app's visibility allows | The app is public, so the link is openable. Only signed-in editors get the branch's function versions (above). |

### 3.1 Preconditions (check before starting)

1. **Builder plan or higher.** Reaching the sandbox from outside the editor otherwise fails with `PREMIUM_REQUIRED` [PLATFORM-DOC].
2. Base44 CLI installed and `base44 login` completed with the `sandbox:write` permission (log in again if a write is refused).
3. A clean local checkout of this repository on branch `claude/x1space-security-hardening` and Node 20 or later.
4. **Credits:** creating a branch from the editor's "Create new branch" box sends a chat message that **starts the builder AI and uses credits** (your AI usage limit is exhausted). The API call in step 2 sets `branch_name`, and Base44 states that `prompt` "only names the branch... isn't sent to the AI", so use the API, not the chat box.
5. A personal API key for the App Management API (Base44 account settings), kept in an environment variable `BASE44_TOKEN`.

### 3.2 Step 0: protect the production baseline

```bash
export APP_ID=<APP_ID>
base44 branches list --app-id $APP_ID --json            # expect only: main (active)
base44 sandbox checkpoint --app-id $APP_ID               # restore point of main in version history
base44 secrets list --app-id $APP_ID                      # NAMES only; save them. Never print values.
base44 functions list --app-id $APP_ID                     # save: 16 functions expected
```
Also note the current published version in the editor (version history) and the date.

### 3.3 Step 1: confirm main still equals the audited baseline (drift check)

**3.3a The hardening branch is one commit behind `main`.** `main` is now `8eaf8de` (a `base44-builder[bot]` commit that only changes `@base44/sdk` from `^0.8.62` to `^0.8.63` in `package.json` and `package-lock.json`). A **simulated merge** of that commit into the hardening branch (temporary worktree, never pushed) is **conflict-free** (both package files auto-merge). Nothing was merged. Before you import or merge anything, bring the branch up to date with `main` (in Base44: branch menu, "Update from main"; or in git, as a deliberate step you approve). The ten function entries pin `npm:@base44/sdk@0.8.62`, which still satisfies the actor requirement (0.8.62 or later); aligning them to 0.8.63 is optional.

**3.3b Drift check of the files the hardening replaces.** The bot commit touched only `package.json` and the lockfile, so the 25 `base44/` files should still equal the audited baseline. Prove it before overwriting anything in the branch:

```bash
cd <your checkout>
git fetch origin && git checkout claude/x1space-security-hardening
BASE=374f05fc8b0e392723c7d3801fa23c3294ff916a   # audited baseline; the bot's 8eaf8de does not touch base44/
for f in $(git diff --name-only --diff-filter=M $BASE HEAD -- base44); do
  remote=$(base44 sandbox read "$f" --app-id $APP_ID --json | python3 -c 'import json,sys;print(json.load(sys.stdin)["content"])' | sha256sum | cut -d' ' -f1)
  local_=$(git show $BASE:"$f" | sha256sum | cut -d' ' -f1)
  [ "$remote" = "$local_" ] && echo "same   $f" || echo "DIFFERS $f"
done
```
If **any** file says `DIFFERS`, stop: production has drifted from the audited baseline. Do not overwrite it. Send the list to Claude to merge deliberately. (If the JSON field name differs in your CLI version, use `base44 sandbox read <file> --app-id $APP_ID` and compare by eye or with `diff`.) The 20 modified files are the ten function entries and ten shared modules (`ai, cache, entry, handlers, http, ninja, store, tokens, upstream, validate` under `base44/shared/`).

### 3.4 Step 2: create the branch (no AI credits)

```bash
curl -sS -X POST "https://app.base44.com/api/apps/$APP_ID/branches" \
  -H "Authorization: Bearer $BASE44_TOKEN" -H "Content-Type: application/json" \
  -d '{"branch_name":"security hardening"}'
base44 branches list --app-id $APP_ID --json
```
The name is at most three words, in English, and cannot be renamed. Use the exact name `base44 branches list` prints in the next steps (shown here as `<BRANCH>`). The endpoint is limited to 30 requests per minute. Branches are created only from `main`. A branch you create this way is **permanent until you delete it** (deleting discards its changes).

### 3.5 Step 3: import the hardened files into the branch

Two paths. Decide with check N9 (is the app connected to `omenpotter/X1Space-Explorer-new`?).

**Path A: "Import from GitHub" (only if N9 shows the repository connected).** Base44 documents it for connected apps: editor, branch menu, **Import from GitHub**, search for `claude/x1space-security-hardening`, **Import**. It creates a Base44 branch that tracks that GitHub branch. Cautions:
1. It imports the **whole branch**, including the frontend React Router 7 change (`cbb06c2`); the branch preview then tests both changes together, which is acceptable but means a failure needs one more step to attribute.
2. Update the branch from `main` first (3.3a) so it contains the bot's SDK bump.
3. Base44 notes that for an app **imported** from GitHub "backend changes always happen on main". If, after the import, the Code tab shows the new functions or the actor on `main` rather than on the branch, or Base44 says backend changes apply to main, **stop and use path B**: that would put the new functions on main before the checks.
4. After import, the branch's function copies, the actor and the checks in section 4 must be verified exactly as in path B (3.6).
5. Never use "Connect to GitHub" or "Link GitHub repo" for this repository on a second app: linking makes the repository the source of truth and replaces deployed entities and functions.

**Path B: sandbox writes (works whether or not GitHub is connected).** Use this if the app is not connected, if path A puts backend changes on main, or if you want to test the backend change alone. `base44 sandbox write --branch` writes straight into the branch. Do **not** run `base44 deploy`, `functions deploy`, `entities push` or any other push command against this app: the sandbox page forbids it, and `deploy` fully syncs entities (**it removes remote entities that are not in your local folder; this repository contains only `RateLimit`**) while `functions deploy --force` deletes remote functions.

For path B, only the `base44/` folder is needed for the runtime checks (no frontend file changed in the backend hardening). Files to write (25):

```bash
BASE=374f05fc8b0e392723c7d3801fa23c3294ff916a
cd <your checkout>
# new files (no --overwrite)
for f in base44/actors/QuotaCounter/entry.ts base44/shared/ninjaQuota.ts base44/shared/quota.ts base44/shared/quotaCounter.ts base44/shared/ssrf.ts; do
  base44 sandbox write "$f" --app-id $APP_ID --branch "<BRANCH>" < "$f"
done
# modified files (Step 1 must have reported "same" for every one)
for f in $(git diff --name-only --diff-filter=M $BASE HEAD -- base44); do
  base44 sandbox write "$f" --app-id $APP_ID --branch "<BRANCH>" --overwrite < "$f"
done
base44 sandbox checkpoint --app-id $APP_ID --branch "<BRANCH>"
```
Each `write` commits to the branch immediately; "creating `base44/functions/<name>/entry.ts` is all it takes to add that function". The warning above about push commands applies.

The frontend `react-router-dom` 7 upgrade (commit `cbb06c2`) is **not** needed for these checks and is not part of this step. Apply it separately (section 3.12).

### 3.6 Step 4: register and verify the QuotaCounter actor

1. After the writes, wait for the branch build to settle (`GET /api/apps/$APP_ID` shows `status.state` `ready` for the branch, or check the editor).
2. **Does writing the file deploy the actor on a branch?** Base44's builder documentation says writing an actor file deploys it, but its branch table does not mention actors. Test it, do not assume. Call a method with **your own signed-in user's token** (an ordinary caller, not the service role). The platform's actor-call route is the one the SDK uses:
```bash
TOKEN=<your own session token from localStorage base44_access_token, never shared>
curl -sS -o /dev/null -w "%{http_code}\n" -X POST \
  "https://app.base44.com/api/apps/$APP_ID/actors/QuotaCounter/rooms/probe/requests" \
  -H "Authorization: Bearer $TOKEN" -H "X-App-Id: $APP_ID" -H "Content-Type: application/json" \
  -d '{"method":"used","args":{"key":"probe"}}'
```
| Result | Meaning |
|---|---|
| `403` | **Actor exists and correctly refuses a non-service caller.** This is the pass. |
| `404` | The actor is not deployed (or the method list is not live). Go to 3.6.3. |
| `200` with `{"used":0}` | **FAIL, stop:** a non-service caller was served. Do not proceed; send this to Claude. |
| `401` or another code | Token or route problem; recheck the route against Base44's actor-call API reference. |
3. **If 404**, deploy the actor explicitly: `cd <your checkout> && base44 actors deploy QuotaCounter --app-id $APP_ID`. This command has no `--branch` option, so it deploys to the app (shared). It is additive and inert (see 3.0), but it creates `ACTOR_TOKEN_SECRET` the first time, and "Deploying doesn't remove remote actors." It requires a local project (`base44/config.jsonc` is present). Then repeat the probe.
4. Confirm in function logs (3.8) that `smartSearch` or a token page shows `[ai-quota] backend=actor` / `[x1ninja-quota] enforcement=shared-atomic`.

### 3.7 Step 5: secrets and defaults

| Name | Action before merge | Value |
|---|---|---|
| `X1_NINJA_API_KEY` | Already present: confirm it is listed (never open it) | existing |
| `AI_GLOBAL_DAILY_QUOTA` | Set (new name, ignored by production code) | `500`; use `3` **only** while running check 4.2, then restore `500` |
| `AI_IP_DAILY_QUOTA` | Optional (new name) | `30` |
| `AI_QUOTA_MODE` | **Leave unset** | strict |
| `X1_NINJA_MONTHLY_QUOTA`, `X1_NINJA_RATE_LIMIT_PER_MIN`, `X1_NINJA_RESET_DAY` | Leave unset (defaults are 450000, 50, 1) | defaults |
| `AI_DAILY_QUOTA` | **Do not change until after the merge** (production code reads it) | after merge: `10` |

Set with `base44 secrets set AI_GLOBAL_DAILY_QUOTA=500 --app-id $APP_ID` (secret values are shared by branch and production).

### 3.8 Step 6: reading the logs

Dashboard, Code tab, the function's **Logs**: "on a branch they run the branch's version". CLI: `base44 logs --function getTokens,smartSearch --since 30m --app-id $APP_ID --env preview` (`preview` is the draft, `prod` the published app; confirm which one reflects the branch in your account by checking for a line that only the new code prints, such as `[rate-limit] public limiter store=...`). Expected lines are in section 1.

### 3.9 Step 7: X1 Ninja connectivity

Signed in as an editor, open `<branch preview>/tokens` (or any token page). The "X1 Ninja" pill should read OK; the logs should show `[x1ninja-quota] enforcement=shared-atomic`. In the X1 Ninja dashboard note "requests this month" before and after (expect a handful). If the pill says unavailable, check the key is present and not revoked.

### 3.10 Step 8: editor compatibility and sign-up

1. Open the app in the Base44 editor, switch to the branch, open **Preview**. It must load with `X-Frame-Options: DENY` enabled (checks N2). If it fails, turn off "Block iframe embedding", record the failure and ask Base44 if the editor origin can be exempted.
2. Dashboard, access/authentication: record whether anyone can register, whether email verification is required, and whether registration can be restricted (N4). Recommended: verified email.

### 3.11 Step 9: AI expenditure cap (what is supported)

Base44's platform API lists workspace credit-limit settings (`default_credit_limit`, per-member `credit_limit`), so a **workspace or member credit limit** appears to be supported; an **app-level cap** is [UNVERIFIED]. In the dashboard, billing/usage, look for credit limits or usage alerts and set the strictest option that exists. The application-level cap is `AI_GLOBAL_DAILY_QUOTA` (hard ceiling only if check 4.2 passes). Record what you find in the result table.

### 3.12 Step 10: controlled tests, merge and the frontend upgrade

1. Run section 4 (marked **[approval]** items only with your explicit go-ahead). All on the branch preview, signed in as an editor.
2. If every check passes: merge the branch in the editor ("Merge to main"). **Merging deploys backend functions to main** (Base44 branch documentation), so treat it as the production change. Then set `AI_DAILY_QUOTA=10`.
3. Immediately re-run A4 (anonymous endpoints return 200) against the **published** site and watch the logs for 15 minutes. Publish only when satisfied; the merge and the publish are separate actions.
4. The `react-router-dom` 7.18.5 upgrade (`package.json` and `package-lock.json`, commit `cbb06c2`) is a frontend change with no runtime dependency on the above. Apply it afterwards on its own branch the same way (write the two files, let the branch build, run the router checks, merge). Base44's sandbox reports Node v24.22.1 and npm 10.9.9, which satisfies React Router 7's Node 20 requirement.

### 3.13 Restoring the production baseline

| Situation | Action |
|---|---|
| Branch not yet merged and a check failed | Delete the branch (editor "More actions, Delete", or `DELETE /api/apps/$APP_ID/branches/<id>`). It is permanent and removes only the branch. Production is untouched. Optionally `base44 actors delete QuotaCounter --app-id $APP_ID` and delete the new secrets (`AI_GLOBAL_DAILY_QUOTA`, `AI_IP_DAILY_QUOTA`). |
| Merged, problem found before publishing | Restore the checkpoint from step 0 in version history. Because merging deployed functions to main, also confirm functions with `base44 functions list` / the function code view. If any function still shows new code, restore the checkpoint again or `POST /api/apps/$APP_ID/deploy` with that `checkpoint_id` after checking. |
| Published, problem found | Publish the step-0 checkpoint (`POST /api/apps/$APP_ID/deploy` with `{"checkpoint_id": ...}` or the editor's version history, Restore, then Publish). The actor and new secrets are inert for the old code and may stay. |
| After any rollback | Run A4 against the public site, and confirm the 16 functions are listed. |

## 4. Controlled post-deployment checks

All use the branch preview, signed in as an editor. None writes anything except `RateLimit` entity rows and actor storage. Steps marked **[approval]** are billable or burst-like and must not run without your explicit go-ahead. No production burst test is part of this document.

### 4.1 Retry-After and global cap  **[approval: one billable AI call]**
Set `AI_GLOBAL_DAILY_QUOTA=1` (a new name, ignored by production code; secrets are shared, so restore it to `500` afterwards). Sign in, then in DevTools:
```js
const t = localStorage.getItem('base44_access_token');   // your own token; never share it
const id = localStorage.getItem('base44_app_id');
const call = () => fetch('/api/apps/' + id + '/functions/smartSearch', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: JSON.stringify({ query: 'tps' }) }).then(async r => [r.status, r.headers.get('retry-after'), (await r.json()).error?.code]);
console.log(await call()); console.log(await call());
```
Expected: `[200, null, undefined]` then `[503, "<seconds>", "ai_capacity_reached"]`; `<seconds>` equals the time left until 00:00 UTC (`date -u`). If the keys above are empty, find the `base44_` keys under Application, Local Storage.

### 4.2 Parallel ceiling  **[approval: at most 3 billable calls]**
Use a fresh UTC day or a new quota value. Set `AI_GLOBAL_DAILY_QUOTA=3` (new name; restore `500` afterwards), then:
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

Roll back (section 3.13, or `SECURITY_ROLLBACK.md`) immediately if any of these happens after deployment:
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
