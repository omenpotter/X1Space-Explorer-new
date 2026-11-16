# Base44 preview: investigation and setup plan

Status: **investigation only.** No Base44 app was created, nothing was published or deployed, `main` and `x1space.xyz` were not touched, and no paid call was made. Account-level facts (your plan, workspace, existing apps) were not readable from here and are marked *unverified*.

Evidence: official Base44 documentation read on 2026-11-15 (links in section 3), plus measurements on the upgrade code.

## 1. Is a fully isolated Base44 preview possible?

**Yes, with a separate Base44 app.** Base44 has no automatic "branch preview" for an existing GitHub branch, and the in-app branch feature is not isolated (section 2). A new app created from the upgrade branch through the Base44 CLI gets its own backend, empty database, secrets, URL and visibility setting, and does not touch the production app.

**But the backend will probably not run on Base44 as written.** The docs describe a runtime that differs from what my functions assume (section 7). I expect a small, mechanical code change before any function deploys. Because that is a code change to the verified branch, it needs your approval and a re-run of the test suite.

## 2. Options evaluated

| Method | Isolated from production? | Tests backend + frontend together? | Verdict |
|---|---|---|---|
| **A. Import the branch into the production app** (editor: branch menu → *Import from GitHub*) | **No.** Branches share live data, secrets, integrations, settings, domains and the published version. | **No.** *"In an app imported from GitHub, backend changes always happen on main."* Signed-out visitors see the last *published* function version, not the branch's. | **Reject** |
| **B. Base Code** (`app.base44.com/base-code`, open a repo/branch in a cloud dev preview) | Yes (separate dev preview) | Not stated. Docs describe it for projects with their *own* database/auth; *"Connecting a repository doesn't add Base44 entities, login or the SDK."* Whether `base44/functions` would run is not documented. | Not recommended |
| **C. New app from a fresh checkout of the branch via the CLI** (`base44 link --create`, then `base44 deploy`) | **Yes**: new app ID, empty database, own secrets, own `*.base44.app` URL | **Yes**: entities, functions and site deploy together | **Recommended** |
| D. Remix of the production app (Apps API, beta) | Yes, but copies the *old* code; secret values are not copied; beta API; 10 requests/min | Would then need method C to deploy the new code anyway | Unnecessary |
| E. `base44 eject` | Separate app, but meant for apps built in the editor | Same as C with extra steps | Unnecessary |
| F. `base44 dev` (local backend) | Fully local, throwaway in-memory data | Functions run as local Deno processes, not on the real platform runtime; needs Deno installed and a linked app | Useful as a pre-check only |

Facts that keep method A and GitHub linking off the table:
- GitHub sync works **only through `main`** (default branch must be named `main`). Pushing the upgrade branch therefore did not and will not change the production app.
- Merging to `main` *does* sync into the production app: functions go to the editor's preview, and **Publish** is what makes them live. Entities and agents update in preview *and* production without a publish (this app has no entities).
- *Link GitHub repo* on a second app would make this same repository that app's "source of truth" and replace anything deployed with the repo's versions. **Do not link the preview app to this repository.**

## 3. Official documentation behind this

- Working with branches (shared vs per-branch parts, imported apps): https://docs.base44.com/Building-your-app/working-with-branches.md
- GitHub integration (main-only sync, Builder plan, publish rules, link warning): https://docs.base44.com/developers/app-code/local-development/github.md
- Base Code: https://docs.base44.com/Getting-Started/base-code.md
- Link an existing backend project (`base44 link`, new vs existing backend): https://docs.base44.com/developers/backend/overview/link-existing-project.md
- CLI `link`, `create`, `deploy`, `build`, `visibility`, `dev`, `secrets set`: https://docs.base44.com/developers/references/cli/commands/link.md (same folder for the others)
- Backend functions (handler format, limits, secrets, shared code, HTTP route): https://docs.base44.com/developers/backend/resources/backend-functions/overview.md
- Backend functions skill reference (Cloudflare Workers, "only accepted pattern"): https://docs.base44.com/developers/skills/base44-platform-backend-functions/references/web-spa.md
- Backend service pricing and credits: https://docs.base44.com/developers/backend/overview/pricing.md, https://docs.base44.com/Account-and-billing/Credits.md, https://docs.base44.com/Account-and-billing/Billing-and-plans.md
- Security scan (the source of the 15 findings): https://docs.base44.com/Setting-up-your-app/running-a-security-scan.md
- App visibility: https://docs.base44.com/Setting-up-your-app/Managing-access.md

## 4. Recommended method and exact steps (owner approval required for every step)

Prerequisites: Node 20.19+ (the sandbox has 22), a Base44 account that can create apps, and the Base44 CLI (`npm i -g base44@latest`; the CLI and backend service are in **beta**).

1. **Decide where the preview lives.** Same workspace as production means shared credits (section 9); a separate workspace isolates credits. Creating in a specific workspace: `--workspace <id>`.
2. **Make a fresh checkout in a new, empty directory** of the pushed branch (`git clone --branch claude/laughing-mayer-sgsved --single-branch <repo> x1space-preview`). Never reuse a directory that has a production `base44/.app.jsonc`.
3. `base44 login` (device code in your browser). Do not use a workspace API key for this; keep the session scoped to your own login.
4. `cd x1space-preview && base44 link --create --name "X1Space Preview"` (add `--workspace <id>` if separating). `link` refuses to run if the directory is already linked, which is a built-in guard. It writes `base44/.app.jsonc` (gitignored).
5. **Verify before anything else:** open `base44/.app.jsonc` and confirm the app ID is **not** the production app ID (compare with the ID in the production editor URL `app.base44.com/apps/<id>/…`).
6. **Set visibility to private before the first deploy:** set `"visibility": "private"` in `base44/config.jsonc` for the preview checkout only (not committed), or run `base44 visibility private`. Private needs a Starter plan or higher; on a Free plan the app is public. *Plan unverified.*
7. **Canary first:** deploy a single function, e.g. `base44 functions deploy getLPStats`, and call it. This tells us whether the handler format works (section 7) before deploying everything. If it does not, stop and request the code change.
8. `base44 deploy --yes --build` (builds with the preview's app ID injected, then pushes functions and the site). Note the printed *App URL*.
9. Run the checklist in section 8 against that URL; read function logs with `base44 logs`.
10. When finished, delete the preview app in its dashboard and remove the local checkout and `~/.base44` login if desired.

Hard rules for the whole session: never pass `--app-id` of production, never run `deploy` from a directory linked to production, never connect GitHub to the preview app, never copy production secrets (the upgrade needs none; every upstream is public).

## 5. Separate Base44 app needed? Can the branch be imported directly?

- **Separate app: yes.** In-app branches cannot isolate data/secrets and cannot test imported-app backends.
- **Direct import of the dev branch: not into a separate app.** The GitHub integration only syncs `main` and creating a new repository is what the editor does when connecting. The CLI flow (steps above) is the supported way to put branch code into a new app. The branch can also be opened in the production app as an in-app branch (*Import from GitHub*), which is exactly what we are avoiding.

## 6. Risks to production (and how this plan prevents them)

| Risk | Prevention |
|---|---|
| Running `base44 deploy` from a checkout linked to production **publishes immediately** (the command uploads the site and prints the live URL) | Fresh directory; `link --create`; verify app ID before deploy; never use `--app-id` of production |
| Linking the preview app to this GitHub repo makes the repo its source of truth and replaces deployed code | Do not connect GitHub to the preview app |
| In-app branch import shares live data, secrets, integrations | Not used |
| Workspace credits are shared by every app in a workspace | Budget in section 9; optionally a separate workspace |
| Later merge of the branch into `main` syncs into the production app | That is the release step, deliberately out of scope here; functions need *Publish* to go live, but the editor preview uses real data and secrets |
| Remote `main` already moved one commit (a Base44 bot commit touching `package.json`/`package-lock.json`) | Resolve at merge time; not part of the preview |
| Preview app publicly reachable | Private visibility (Starter+), short lifetime, delete afterwards |

Production domain `x1space.xyz`, its database and its secrets are not referenced by any step.

## 7. Backend compatibility (what the docs say versus what the code assumes)

The functions skill reference describes backend functions as HTTP handlers **on Cloudflare Workers**. Against that:

| Area | Code today | Documentation | Impact | Status |
|---|---|---|---|---|
| Handler format | `Deno.serve(handler)` in every entry file (as in the original repo) | *"`export default async function(req: Request): Promise<Response>` — the only accepted pattern."* Lint rejects *"wrong function structure"* | **Likely blocker.** Entries would need `export default`. The original functions used `Deno.serve`, so the platform may still accept it; only a deploy can tell | **Unverified, probable change** |
| Secrets | `env()` reads `Deno.env` / `process.env` | Read with `secrets.get()` from `base44:runtime`, **inside the handler**; a module-top-level read returns `undefined` | `X1_NINJA_API_KEY`, `ALLOWED_ORIGINS`, `AI_DAILY_QUOTA` would silently stay unset (safe failure: Ninja shows "not connected"). The AI entries also call `defaultDeps()` at module top level | **Unverified, probable change** |
| Persistent store | `Deno.openKv()` with memory fallback | Deno KV is not mentioned anywhere in the docs; the runtime is Workers | Rate limits and **per-user AI quotas fall back to per-isolate memory**: they reset on cold start and are not shared across instances. A persistent option would be a Base44 entity read through the SDK | **Limit likely; quota needs a persistent store before production** |
| Memory | no explicit limit | **128 MB per call**, `Worker exceeded memory limit` otherwise | Measured on the token index build: **+49 MB peak, +45 MB retained**. Fits, but with little headroom, and each function holds its own copy | **Must be measured on the preview** |
| Per-function copies of shared code | in-memory caches assumed shared | *"Each function is deployed with its own copy of the shared code"* | Seven token-related functions would each build their own ~15 MB index (extra RPC load, extra memory) | Design limit |
| Limits | — | 5 min run, 5 min CPU, 10,000 outgoing requests per call, ~6 concurrent connections | Index build 4.2 s; at most 4 parallel calls | OK |
| Route | client tries `/functions/<name>` then the SDK route | Direct HTTP at `https://<app-domain>/functions/<name>`; frontend guidance: *"Parameters only through the payload — URL parameters won't work"* (SDK `invoke`) | Our GET calls with query strings may not be forwarded. Handlers already accept POST bodies, so the client can switch to `invoke` | **Unverified, probable client change** |
| Anonymous access | public endpoints | Apps that do not require login: *"Anyone can call your backend functions, and that's expected"* | Matches the design | OK |
| Sign-in check in function | `auth.me()` wrapped, 401 otherwise | Documented pattern; signed-out `auth.me()` rejects with 401 | Matches | OK |
| Service role for AI | `asServiceRole.integrations.Core.InvokeLLM` after sign-in | Documented exception for Core integrations | Matches | OK |
| Initialisation | lazy, inside handler (except the AI entries) | Module-top-level `throw`/`await` = boot error | AI entries' top-level `defaultDeps()` should move inside the handler | Probable change |
| Binary response (`getImage`) | `Response` with bytes and cache headers | Not stated | Unverified | Test on preview |
| Outbound network | public RPC, XDEX, geojs.io, arbitrary https images | No outbound allowlist documented | Unverified | Test on preview |
| Language | TypeScript syntax in `.ts` files | Skill page says *"JavaScript, not TypeScript"*; docs also allow `entry.ts` | Original functions were TypeScript, so likely compiled; unverified | Canary will show |

The security scan behaviour matters for your 15 findings: for apps that do not require login the scan groups open functions as one **Low** item and acknowledgements *"stay acknowledged until the function's code changes."* Every function's code changed, so on a deployed app the 15 findings will reappear until re-acknowledged. The AI functions now verify the caller inside the function, which the docs list as an acceptable fix.

## 8. Preview verification checklist

**Canary and platform (do first)**
- [ ] Deploy `getLPStats` alone; it deploys and answers over `/functions/getLPStats` and through the SDK.
- [ ] Decide handler format / secrets / client-call changes from the result; re-run the repository tests after any change.
- [ ] Logs show no boot error and no `Worker exceeded memory limit` after calling `getTokens`, `getValidators`, `getTokenByMint` (cold and warm).
- [ ] `Deno.openKv` availability (expected: absent) → record whether limits persist across cold starts.

**Frontend (desktop 1440, tablet 820, mobile 390)**
- [ ] Dashboard, Network Health, Blocks, Block detail, Transactions, Transaction detail, Transaction Flow, Address Lookup
- [ ] Token Explorer: list, search, filters, pagination, token drawer (SPL token, Token-2022 token, a token with no pool), freshness and source badges
- [ ] Network Map: markers, filters, "not located" list, zoom/keyboard, no raw IPs in page source
- [ ] Validators, Validator detail, Leaderboard, Compare, Alerts, Staking Calculator
- [ ] LP Explorer, Whale Watcher, Portfolio, Watchlist, Custom Dashboard, API Docs, Search, Home redirect, 404
- [ ] Console free of errors; one `h1` per page; no horizontal scroll; keyboard navigation and mobile menu

**Backend and security (all 15 findings)**
- [ ] Each of the 15 functions: valid request, boundary inputs (bad mint, huge `limit`, negative `offset`, 5 KB search), unknown method, OPTIONS
- [ ] CORS: allowed from the preview origin; no `Access-Control-Allow-Origin` for another origin
- [ ] `smartSearch` and `tokenVerificationAssistant`: 401 signed out; works signed in (test account); 6th call in a minute → 429; oversize body → 413; (2–3 model calls only, each costs credits)
- [ ] Rate limits: confirm whether counters survive across cold starts (see section 7)
- [ ] `getImage`: validator icon, token logo, failing URL → 404 → fallback avatar in UI, `Content-Type` and `Cache-Control` present
- [ ] Response headers on the app (HSTS, `nosniff`, frame protections); CSP meta works with Base44's injected scripts
- [ ] No credentials in page source, bundle or any network request (re-run `tests/e2e/network.mjs` against the preview URL)
- [ ] Failure handling: stop an upstream (block a host in DevTools) → explicit error/stale states
- [ ] Run **Dashboard → Security → Run Security Scan** and compare against the 15 acknowledged findings

**Data accuracy**
- [ ] Mint counts vs RPC (SPL / Token-2022), decimals and supply for a sample, prices vs XDEX
- [ ] Validators: stake, commission, active/delinquent vs RPC; coordinates vs geojs; 44-ish unlocated listed separately
- [ ] Unknown values show a dash with a reason; freshness timestamps advance
- [ ] Logos: official icons load where reachable (the sandbox could fetch 41 of 262); deterministic fallbacks elsewhere

## 9. Costs

- **Backend service:** *"currently in beta and free to use."* No separate subscription.
- **Extra app:** Free plan allows up to 5 apps; Starter and above, unlimited. Whether you have a free slot is unverified.
- **Private visibility:** needs Starter or higher (price not read; see https://base44.com/pricing).
- **Function runs consume integration credits:** about **1 credit per 100 runs**, billed daily and shared by every app in the workspace. A verification session of roughly 3,000 function calls ≈ 30 credits; each model call (`smartSearch` etc.) ≈ 1+ credit. Free plan has 100 integration credits a month; Starter 2,000; Builder 10,000.
- **Production credit risk found during this review:** the Dashboard and Network Health pages poll the backend every 5 seconds (`getNetworkStats`) plus price and anomaly checks, about 19,000 runs per open tab per day ≈ **190 credits per tab per day**. That would exhaust a Builder plan with a few always-open tabs. This is a change to make before production (poll fast metrics directly from the RPC, as the original dashboard did, and keep backend calls to slow data).
- **X1 Ninja:** not activated; no paid endpoint is called. The preview works without any secret.

## 10. Feature support in a preview

| Category | Items |
|---|---|
| **Fully supported (no config)** | Frontend pages; RPC reads; token index from chain; XDEX data; geolocation; validator identities; image proxy (pending canary); security scan |
| **Needs configuration** | Handler/secrets/client changes (section 7); `X1_NINJA_API_KEY` secret (optional); a test user for sign-in tests; private visibility |
| **Needs a paid service** | Private visibility (Starter+); X1 Ninja Free-tier key is free but paid tiers are required for `/v1/search` and `/v1/stream/trades` (not used); more than 5 apps |
| **Needs production-like infrastructure** | Persistent shared rate limits/quotas across isolates; real traffic and credit consumption; custom domain `x1space.xyz` and its headers |
| **Cannot be verified until deployment** | Behaviour at production load; whether Base44's scanner clears the 15 findings after re-acknowledgement; GitHub-merge release path (`main` → editor preview → Publish) |

## 11. Owner decisions requested

1. Approve method C (new private app from a fresh checkout) and choose same workspace or a separate one.
2. Approve preparing the code changes in section 7 (handler format, secrets, client call style, quota store) on a new local commit, with the full test suite re-run, **before** any deploy. Not started.
3. Approve a canary deploy as step 7, performed by you (or by me with your Base44 login) in a new, empty directory.
4. Decide how to handle the credit-heavy polling before production.
