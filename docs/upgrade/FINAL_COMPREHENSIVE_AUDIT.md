# X1 Space Explorer: final pre-production audit

Branch `claude/laughing-mayer-sgsved`, audited from X1 View commit `fb30f05` plus the remediation commit that carries this report.
Audit date: 2026-11-16. Everything below was run in the development sandbox against live X1 mainnet data. Nothing was deployed, `main`, production Base44, `x1space.xyz`, validator servers and production databases were not touched, and no paid service was used.

## Verdict: CONDITIONAL

**The code is ready for a production release. The release is not cleared** until the owner completes the actions in section 10 and the two checks that cannot run from here are done on real infrastructure:

| Blocked check | Why | Status |
|---|---|---|
| Base44 runtime behaviour (handler execution on the Workers runtime, persistent AI quotas, `cf-connecting-ip`, security scan, credit use) | The Base44 account limit was reached and the Base44 tools are disconnected. No preview app could be deployed | **BLOCKED** |
| Vercel preview (live headers, routing, `/functions/*` handling) | The Vercel connection fails with a proxy 403 and no preview URL is known | **BLOCKED** |

Nothing in this report claims either of those passed.

Findings: 0 Critical, 3 High (2 fixed, 1 owner action), 8 Medium (4 fixed, 3 open, 1 blocked), 5 Low (3 fixed, 2 open), 6 Informational. Full register in section 9.

## 1. What was run (all against this branch, final build)

| Suite | Result |
|---|---|
| ESLint | 0 errors (5 existing warnings, unused catch variables) |
| Typecheck | 0 errors |
| Production build | passes; no source maps; no credential pattern in `dist` |
| Unit and contract tests | **149 pass** (backend 94, frontend 55) |
| Live smoke and live accuracy (real RPC and XDEX) | **4 + 7 pass** |
| Browser suite (20 pages x 3 sizes, token explorer, network map, failure paths, accessibility) | **95 pass / 0 fail** |
| Detail routes and invalid input (blocks, transactions, validators, addresses, search, 404) | **38 pass / 0 fail** |
| X1 View (both tabs, live data, refresh, keyboard, accessibility, 3 sizes) | **17 pass / 0 fail** |
| Keyboard audit (6 pages, 25 Tab stops each, skip link) | **7 pass / 0 fail** |
| SEO metadata (titles, canonical, robots, robots.txt, sitemap) | **9 pass / 0 fail** |
| Network and credential audit (every browser request, 9 pages) | pass; only expected hosts contacted |
| Performance and RPC cost | measured, see section 7 |

Reproduce everything with `scripts/verify-all.sh` (log in `docs/upgrade/verify-log.txt`).

## 2. Visual and UX audit

I opened the screenshots myself instead of relying on the automated pass. I inspected about two dozen images personally: Dashboard (desktop, mobile, 1280 full page), Token Explorer (tablet), Network Map (desktop), Validators (desktop, mobile), Liquidity Pools (tablet), Network Health (desktop), Whale Watcher (mobile), Custom Dashboard (desktop), Transaction Flow (tablet), Blocks (mobile), Transactions (tablet), Address Lookup (desktop), Leaderboard (desktop), Staking Calculator (mobile, before and after the fix), API Docs (tablet), Portfolio Tracker (mobile), Validator Alerts (desktop) and the X1 View captures (1m desktop, 10m mobile, full page). The other principal-page captures (66 files are in `docs/upgrade/screenshots/after/`) are covered by automated checks only: one `h1`, no horizontal overflow, no page errors, application shell present, no error panel, no serious or critical axe violation.

What the inspection found:

* **F-02 (High, fixed):** Staking Calculator showed "Staking inputs are unavailable. Y.getInflationRate is not a function". See section 9.
* **F-05 (Medium, fixed):** Custom Dashboard "TPS History" hid its axis and auto-scaled, so a flat 927 to 931 TPS looked like violent spikes.
* **F-09 (Low, fixed):** the Dashboard "Recent blocks" table was clipped at 1280 px ("14s ag"). It now fits.
* **F-10 (Low, fixed):** Custom Dashboard showed "about 760 min"; now "12h 40m".
* Everything else inspected was aligned, readable and consistent with the design system. Contrast, spacing, typography, loading, empty and error states were as designed.

**X1 View (approved design).** Verified visually and by test: dark-glass container with cyan/violet border, luminous active tab, 80-dot glowing matrices, category legend (Vote, Transfer, Token/Program, Other), LIVE badge and XNT price. 1m tab shows Now, 1m ago to 9m ago; 10m tab shows 10m ago to 50m ago. At 1440 px all ten cards fit; below that the row scrolls inside itself and is keyboard-focusable. Latest block activity is a separate, unchanged section. I did not have your visual reference image in this session, so conformance to it is judged from your written description; please compare `docs/upgrade/screenshots/x1view/`.

## 3. Functionality

Covered by the suites above (route list in `tests/e2e/run.mjs`, edge cases in `detail.mjs`): every route at desktop, tablet and mobile; global search and the Search page (token, address, signature, slot, validator, nonsense); block, transaction, validator and address detail with real identifiers; invalid and malformed identifiers (rejected before any lookup); empty and unknown results (no demo data shown); token explorer filters, sorting, kind and program filters, pagination, detail panel; network map markers, filters, no-geolocation state; liquidity pools search and sort; compare, leaderboard, alerts, watchlist and portfolio pages; failure paths (backend down, RPC down, location service down, logo images failing) which all show explicit states; recovery after a failed refresh keeps the last good data and flags it stale.

Not testable here: sign-in-gated AI features against the real platform (unit-tested with a mocked client only).

## 4. Blockchain data accuracy

| Figure | Check | Result |
|---|---|---|
| Mint counts per program (SPL, Token-2022) | independent `getProgramAccounts` count | equal |
| Decimals, supply, authorities (sampled) | `getAccountInfo` | equal |
| Token prices, pool TVL totals | XDEX price endpoint and summary | agree (XNT $0.1875 in the app, $0.1838 from the deepest pool read separately minutes earlier; the app uses a different XDEX field and the price moves) |
| Validators: 337 active, 49 delinquent, stake 1.009B active and 78.83K delinquent, epoch 445, supply 1.09B total and 42.91M circulating, 103.93B transactions | independent RPC read | equal to the dashboard |
| Network Map positions | independent geojs lookup of each node | 38 of 38 sampled equal; unlocated validators are listed, not guessed |
| **X1 View 1m**: totals and slot counts of all 10 cards | RPC samples the page itself received | **10 of 10 exact** |
| **X1 View 10m**: totals and slots of all 5 windows | sum of ten samples each | **5 of 5 exact** |
| X1 View refresh | new sample request within 18 s | confirmed |

**Exact versus estimated.** Exact: slot, epoch, TPS, validator and stake figures, supply, X1 View totals, slot counts and **vote counts** (total minus the RPC's non-vote count), token mint counts, supply, decimals, authorities, pool TVL. Estimated and labelled on screen: the transfer, token/program and other split of non-vote transactions in X1 View (the RPC gives no per-minute split, so the mix of the latest ten classified blocks is applied). Not shown when unknown: market cap without supply or price, holders and candles without a key, validator positions that could not be resolved.

**Fabrication check.** The original X1 View used a hard-coded 70/12/9/9 fallback mix, random dot shuffling, filler dots and random "pending" transactions. None of that exists in the current code (unit tests assert that no split is produced when no data exists). X1 Ninja is not configured, so no Ninja-sourced value appears. Only 1 of 262 validator icons could be loaded from the sandbox; the rest are generated avatars, labelled as such.

One caveat: the secondary RPC `rpc.x1galaxy.io` was unreachable from the sandbox, so the failover endpoint's data could not be compared. **Informational, unverified.**

## 5. Security audit

Reviewed: all frontend and backend code, the git history, dependencies, headers and configuration.

| Area | Result |
|---|---|
| Secrets in the current tree and `dist` | none (specific provider patterns, generic key, private-key and JWT patterns all clear) |
| Secrets in git history | **found** (F-01): key material for OwlNet, FortiBlox and an unidentified `X-API-Key` exists in two historical commits, including the original commit that is in `main`'s history. Values were not printed. Not revoked by me |
| XSS | no `innerHTML` or `eval` in app code; the only `dangerouslySetInnerHTML` is in the unused shadcn chart style helper, fed only by developer config (F-14, informational); external links go through `safeUrl` and use `rel="noopener noreferrer"` |
| Open redirects | all navigation targets are internal paths; user input is only ever placed in the query string; the OAuth consent page rebuilds its query from `ctx` alone |
| SSRF | image proxy accepts only `kind` plus an address and re-validates every redirect. **F-03 (Medium, fixed):** the token-metadata fetch followed redirects blindly, so a creator-supplied public URL could have bounced the backend to an internal one. Redirects are now followed by hand, at most three, and every hop must be public https. Tested |
| Injection | every parameter validated or clamped before any upstream call; AI prompts quote and escape user text; response bodies bounded |
| CORS and CSRF | origin allow-list (x1space.xyz, `*.base44.app`, localhost); no cookies or credentials are used by the public endpoints, and AI endpoints need a bearer token, so CSRF does not apply |
| AuthN and AuthZ | `smartSearch` and `tokenVerificationAssistant` return 401 signed out (unit-tested with a mocked client; **real platform behaviour BLOCKED**) |
| Rate limits and abuse | per-IP and per-user limits on every function; AI daily quota in a persistent `RateLimit` entity with memory fallback (cross-instance persistence unit-tested; **real runtime BLOCKED**) |
| Error messages and logging | stable error codes only; no stack traces or upstream bodies; no secret logged |
| Dependencies | `npm audit`: 5 moderate, 0 high, 0 critical (react-router and react-router-dom open-redirect advisory, plus three build-time glob and minimatch advisories). Upgrading react-router-dom to v7 is a breaking change and needs the owner's decision (F-06) |
| Headers (`vercel.json`) | nosniff, frame deny, HSTS, referrer policy, permissions policy, COOP and frame-ancestors; meta CSP in `index.html`. **Live delivery BLOCKED** (no preview) |

**The 15 Base44 findings** (one per backend function, matrix in `SECURITY.md`): code-level fixes are done and tested for all 15 (validation, clamped inputs, shared cached upstreams, origin-restricted CORS, no response logging, no raw errors, AI sign-in and quota). Re-confirmed in this audit by running the backend tests (94 pass), the credential audit and the SSRF fix. What still **requires the real Base44 runtime**: whether the scanner clears each finding, that the default-export entries and `secrets.get` run on Workers, that quotas persist across instances, that `cf-connecting-ip` is present, and credit use. These stay **BLOCKED**, not passed.

## 6. Accessibility and SEO

* axe (WCAG 2 A and AA) has no serious or critical violation on every audited page and on the X1 View. A scrollable region that was not keyboard-focusable on the Dashboard was fixed earlier in this branch (X1 View row).
* Keyboard: 25 Tab presses on Dashboard, Token Explorer, Validators, Network Map, Blocks and Search each reach 23 to 25 distinct stops with a visible focus indicator on every one; no trap; skip link is the first stop and works. X1 View tabs now follow the ARIA pattern (arrow keys, Home, End).
* **F-04 (Medium, fixed): SEO.** There was no `robots.txt`, no sitemap and no canonical link, and every route shared the home page's title. Added per-route title, canonical and robots (`src/lib/pageMeta.js`), `public/robots.txt` and `public/sitemap.xml` (12 list pages). Personal, transient and per-entity pages (watchlist, portfolio, alerts, custom dashboard, search, address, transaction, block, flow, compare, OAuth) are `noindex`; unknown routes are `noindex, nofollow`. Verified in the built app: 9 of 9 checks.
* Low (F-12, open): no `og:image`, `twitter:card` or `og:url`. Needs an approved image.

## 7. Performance and cost

Measured on the final build, local network, so load timings show rendering cost only, not production latency.

| Page | Ready (ms) | LCP (ms) | RPC calls / min, tab visible | Backend calls / min | JS heap (MB) |
|---|---|---|---|---|---|
| Dashboard | 315 | 344 | **72** (was 189) | 0 | 14 |
| Network Health | 413 | 328 | 24 | 0 | 10 |
| Token Explorer | 214 | 228 | 5 | 0 to 1 | 6 |
| Network Map | 288 | 252 | 5 | 0 | 7 |
| Validators | 314 | 308 | 5 | 0 | 6 |
| Blocks | 207 | 236 | **89** (was 340) | 0 | 8 |
| Liquidity Pools | 289 | 300 | 5 | 0 | 6 |

* **Hidden tab:** Dashboard and Network Health made **0 RPC calls per minute** while hidden.
* **Backend credit cost:** polling pages made 0 backend function calls per minute (price every 120 s at most), so an open Dashboard is about 720 calls a day at worst (about 7 credits).
* **F-07 (High, fixed): RPC and bandwidth.** A full block is about 400 KB of JSON and the block polls read 10 to 20 new blocks every 4 s: roughly 60 MB per minute per open tab (about 3.6 GB an hour) from the public RPC and the visitor's connection. Polling is now 15 s for blocks and transactions (about a quarter). Remaining cost is still large by design (about 15 MB/min on the Dashboard, about 30 MB/min on Blocks); removing it needs a backend or indexer that summarises blocks, which is a new feature and needs approval (F-08, open).
* **F-08a (Medium, fixed): bundle.** A forced manual chunk made the entry import the 781 KB PDF-export chunk (jsPDF, html2canvas), so every page downloaded it. Now loaded only when exporting. Initial load: **1,359 KB raw, 384 KB gzip** across 17 files (was about 2,140 KB raw). Total build 2.5 MB.
* Backend memory (Node measurement, not Workers): JS heap 20 MB after building the full 25.9k-token index, about 60 MB above baseline process memory at peak while parsing; per-token endpoints stay under 15 MB. Base44's limit is 128 MB, so there is margin, but this must be confirmed on the real runtime. Mint scan refresh downloads about 15 MB from the RPC every 10 minutes per warm instance.
* Vercel: the app is a static SPA; hosting cost is bandwidth only. Base44: credits per function run (about 1 credit per 100 runs, workspace-shared), not measured live.

## 8. Deployment and infrastructure

* **Branch integrity:** `origin/claude/laughing-mayer-sgsved` equals local HEAD before this commit (`fb30f05`); 29 commits ahead of the original base `acebc09`; `main` is at `b86f10a` (a Base44 bot commit) and was not touched. No tracked `.env` files. Base44 GitHub sync follows `main` only, so pushing this branch cannot deploy production.
* **Production isolation:** production Base44 app, `x1space.xyz`, production databases and validator servers were only ever read. The preview Base44 app created earlier (`6af9834498b6cacfe3be37dc`) is unpublished with no secrets.
* **F-11 (Medium, open): Vercel routing.** `vercel.json` rewrites everything except `/functions/*` to the SPA, and the frontend calls `/functions/getImage` for logos. Vercel serves no backend functions, so on a Vercel origin logos fall back to generated avatars unless a rewrite to the Base44 app's function URL is configured (needs the owner's app domain), and the SDK route needs `VITE_BASE44_APP_ID` and `VITE_BASE44_BACKEND_URL` set. Without them the app shows explicit error states, not fake data (the build prints this warning).
* **Environment separation:** no secret is needed by the preview or the frontend; the backend reads optional `X1_NINJA_API_KEY`, `GEOLOCATION_DISABLED`, `AI_DAILY_QUOTA` and `ALLOWED_ORIGINS` through `secrets.get`, all unset by default (X1 Ninja off).
* **Rollback:** `docs/upgrade/ROLLBACK.md` is current; production has never been changed, so rollback of this work is "do not merge".
* **Potential deployment failures:** the Base44 backend handler format is the largest unverified risk (documented, code adapted, untested on the platform); Vercel `/functions` routing (F-11); Base44 plan or limit.

## 9. Findings register

| ID | Sev | Finding | Evidence | Remediation | Status |
|---|---|---|---|---|---|
| F-01 | **High** | Provider API keys and a database credential exist in public git history (original commit in `main`'s history). Removing them from the tree does not revoke them | `git log -G` finds 2 commits; tip of `main` and this branch are clean | Owner must revoke OwlNet, FortiBlox and the unidentified `X-API-Key`, and confirm the old database is gone. I did not rotate anything | **OPEN, owner action** |
| F-02 | **High** | Staking Calculator was broken: `getInflationRate` was never added to the RPC service's default export, so the page showed an error panel with a leaked internal message. The render check had counted an error panel as rendered | Seen in the Staking Calculator mobile screenshot | Added to the export; new unit test fails if any `X1Rpc.<method>` used in `src` is missing (verified it fails without the fix); the browser suite now fails when a page shows an error panel on a healthy backend. Screenshot re-inspected | **FIXED, verified** |
| F-07 | **High** | Block polling cost about 60 MB per minute per tab | 400 KB per block measured, 10 to 20 blocks per 4 s poll | Interval 15 s; Dashboard RPC calls 189 to 72 per minute, Blocks 340 to 89 | **FIXED** (residual F-08) |
| F-03 | Medium | SSRF via redirect in the token-metadata fetch | Code review: default redirect following | Manual redirects, max 3, every hop validated as public https; 2 new tests | **FIXED, verified** |
| F-04 | Medium | No robots.txt, sitemap or canonical; all routes shared one title | Inspection of `index.html` and `public/` | Per-route meta, robots.txt, sitemap; `seo.mjs` 9 of 9 | **FIXED, verified** |
| F-05 | Medium | Custom Dashboard TPS chart hid its axis and auto-scaled, exaggerating noise | Screenshot | Axis starts at 0, range caption added | **FIXED, verified** |
| F-08a | Medium | 781 KB PDF-export chunk loaded on every page | Entry imported the chunk | Removed the forced manual chunk; initial load 1,359 KB raw | **FIXED, verified** |
| F-06 | Medium | `react-router-dom` 6.30.6: open-redirect advisory (moderate) | `npm audit` | None applied: v7 is a breaking change. Exposure is low because the app only places input in query strings, but the owner should decide | **OPEN, owner decision** |
| F-11 | Medium | Vercel has no `/functions/*`; logos fall back to avatars; env vars required for the SDK route | `vercel.json`, `api.js` | Needs the Base44 app domain for a rewrite and two Vercel env vars | **OPEN, owner action** |
| F-08 | Medium | Block data is heavy by design (about 15 MB per minute on the Dashboard) | Measured | Needs a backend or indexer that summarises blocks: new feature | **OPEN, needs approval** |
| F-13 | Medium | Base44 runtime behaviour and Vercel live preview cannot be verified | Account limit; Vercel proxy 403 | Deploy the preview when access is restored and run the checklist in `BASE44_PREVIEW_PLAN.md` | **BLOCKED** |
| F-09 | Low | Recent blocks table clipped its Time column at 1280 px | Screenshot | Tighter padding, mix bar shown from 1536 px | **FIXED, verified** |
| F-10 | Low | "about 760 min" epoch ETA | Screenshot | Shown as hours and minutes | **FIXED** |
| F-15 | Low | X1 View tabs lacked arrow-key navigation | Manual keyboard review | ARIA tabs pattern, tests | **FIXED, verified** |
| F-12 | Low | No og:image, twitter:card, og:url | `index.html` | Needs an approved image | **OPEN** |
| F-16 | Low | Meta CSP allows inline scripts and any https script host (platform injects its own assets) | `index.html` | Tighter header CSP in `SECURITY.md`, enable once preview hosts are known | **OPEN** (blocked on preview) |
| F-14 | Info | Unused chart style helper uses `dangerouslySetInnerHTML` with developer-supplied config | `ui/chart.jsx` | None needed | Informational |
| F-17 | Info | CORS also allows any `*.base44.app` origin (public read-only data) | `http.ts` | Acceptable; rate limits apply | Informational |
| F-18 | Info | Secondary RPC `rpc.x1galaxy.io` unreachable from the sandbox; failover data unverified | Live call | Re-test from real infrastructure | Informational |
| F-19 | Info | Token Explorer says 133 XDEX pools, Liquidity Pools shows "1,467 pools listed, 133 shown here": different measures, both labelled | Screenshots | None | Informational |
| F-20 | Info | Top ten validators by stake are all X1 Labs nodes (5.7% each) | Validators page | Data, not a defect | Informational |
| F-21 | Info | Only 1 of 262 validator icons loadable from the sandbox; rest are labelled generated avatars | Browser test | Confirm on a real network | Informational |

## 10. Owner actions and approvals

1. **Revoke** the OwlNet, FortiBlox and unidentified `X-API-Key` credentials and confirm the old database is gone (F-01).
2. Decide on the react-router v7 upgrade or accept the advisory in writing (F-06).
3. Raise or reset the Base44 limit, or name a workspace, so the preview can be deployed and checked (F-13). Visibility "private" needs a Starter plan or higher; I will not purchase anything.
4. Provide the Base44 app domain and set `VITE_BASE44_APP_ID` and `VITE_BASE44_BACKEND_URL` on Vercel, with a `/functions/*` rewrite (F-11), then open the Vercel preview for the live header and routing check.
5. Approve or decline an indexer for block summaries (F-08) and an og:image (F-12).
6. Production release remains subject to your separate explicit approval.

## 11. Evidence files

`docs/upgrade/verify-log.txt`, `e2e-results.json`, `detail-results.json`, `x1view-results.json`, `keyboard-results.json`, `seo-results.json`, `perf-results.json`, `network-audit.json`, `live-*` logs; screenshots in `docs/upgrade/screenshots/after/` (20 pages x desktop, tablet and mobile plus states) and `docs/upgrade/screenshots/x1view/`; security record `SECURITY.md`; preview plan `BASE44_PREVIEW_PLAN.md`; rollback `ROLLBACK.md`.
