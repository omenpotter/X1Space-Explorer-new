# X1 Space upgrade — final report

Branch `claude/laughing-mayer-sgsved` (local only; nothing pushed, merged or deployed). Baseline `acebc09`, tag `backup/pre-upgrade-acebc09`.
The code under test is commit `f4cab15`; later commits only add logs, screenshots and documents.

## 1. Test results (commit f4cab15, run 2026-11-15)

| Check | Result |
|---|---|
| ESLint | 0 errors, 5 warnings (unused `catch (e)` variables in two platform files) |
| Typecheck (`tsc` over all pages/components) | **0 errors** (baseline: 487) |
| Production build | passes, no source maps |
| Unit, contract, security regression (80 tests, mocked) | 80 / 80 pass |
| Live smoke against real RPC / XDEX / geojs | 4 / 4 pass |
| Live accuracy against independent sources | 7 / 7 pass |
| Browser suite (Chromium, live data) | **95 / 95 pass**: 60 page renders (20 pages × desktop/tablet/mobile), Token Explorer, Network Map, validator logos, shell/keyboard, 8 axe accessibility audits, performance |
| Detail routes and edge inputs | **38 / 38 pass** (block, transaction, validator, address, flow, compare, search, Home redirect, 404, 6 axe audits) |
| Network and credential audit | pass: 461 requests, only RPC + 2 image hosts, no credential in any request or backend response |
| Bundle credential scan | none found; 0 source maps |
| `npm audit` | 15 vulnerabilities (9 high) → **5 moderate**, 0 high/critical (see section 9) |

Raw logs: `verify-log.txt`, `e2e-results.json`, `detail-results.json`, `network-audit.json`, `accuracy-results.txt`, `icon-audit.json`. Re-run with `scripts/verify-all.sh`.

Mocked versus live: the 80 unit tests use mocks. The smoke, accuracy and browser tests ran against the live X1 RPC, XDEX and geojs.io. X1 Ninja was **only mocked** (no key available).

## 2. Problems found while verifying, and fixed

- Page overflow at tablet/mobile widths (positioned scroll containers; shrinkable grid children; wrapping panel headers).
- The mobile menu button could not be tapped: an empty toast container covered the top bar and swallowed taps.
- Low-contrast caption text (raised `ink-faint`).
- A far-future block slot said "RPC network error" instead of "not found": the client let a failed fallback endpoint overwrite the node's real answer.
- Invalid markup on the validator profile (`<p>` inside a `<dl>`).
- Dashboard recent-blocks table was clipped at 1440 px.

## 3. Typecheck diagnostics (933 at last count → 0), classified

| Class | Count | Verdict | Resolution |
|---|---|---|---|
| Missing required prop (TS2741/2739) on my shared components | 617 | **Real typing gap**: optional props declared without types | JSDoc prop types on 119 components |
| shadcn `forwardRef` without props/ref types | ~110 | Tooling gap in vendored code | explicit `any` props/ref on 39 ui files |
| `useState({status})` shape inferred too narrow | ~120 | Real typing gap | state typed as `Record<string, any>` |
| d3-geo, topojson-client untyped | 72 | Tooling | `@types/d3-geo`, `@types/topojson-client` |
| `import.meta.env` | 2 | Config | `vite/client` types |
| `Map` used as `localStorage` stand-in | 3 | Latent bug in platform file (Node-only path) | small storage shim |
| `PromiseSettledResult.value`, not-callable tuple, header typing | 4 | Genuine type errors, no runtime effect | narrowed / annotated |
| "Identifier expected" | 2 | Comments containing `@` parsed as JSDoc tags | comments reworded |

Caveat: the prop and state types are deliberately loose (`any`, `Record<string, any>`), so the check catches missing names and wrong call shapes but not wrong value types.

## 4. Backend security matrix (15 Base44 findings)

Full per-function table: `SECURITY.md`. Summary:

| # | Function | Original concern | Change | Tests | Remaining risk |
|---|---|---|---|---|---|
| 1 | analyzeToken | dead stub | rule-based review of on-chain facts | unit + live | heuristic |
| 2 | detectAnomalies | stub, polled every 5 min | live threshold checks | unit + live | no history baseline |
| 3 | getLPPoolDetail | no limit/validation, amplification | validated, cached | unit + live | trades need Ninja key |
| 4 | getLPStats | private limiter, logging | shared limiter + cache | unit + live | none |
| 5 | getLPTokens | unclamped `limit` | clamped, cached | unit + live | none |
| 6 | getLiquidityPools | wrong field names, no validation | fixed, validated | unit + live | none |
| 7 | getNetworkHistory | stub | RPC samples, ≤12 h | unit + live | RPC retention |
| 8 | getNetworkStats | stub, 503 without CORS | live from RPC | unit + live | none |
| 9 | getTokenByMint | wrong fields/params, no limit | rebuilt on chain + pools | unit + live | creator URLs fetched (guarded) |
| 10 | getTokenPrices | wrong param | corrected, cached | unit + live | candles need Ninja key |
| 11 | getTokens | fabricated fields, unclamped paging | on-chain index + market | unit + live | ~15 MB index refresh / 10 min |
| 12 | getValidators | stub | identities + locations | unit + live | sends public node IPs to geojs.io |
| 13 | searchTokens | stub, parameter mismatch | real search | unit + live | none |
| 14 | smartSearch | anonymous model spend, prompt injection | sign-in, quotas, caps, output validation | unit (mocked client) | **platform behaviour unverified** |
| 15 | tokenVerificationAssistant | same, plus arbitrary objects in prompt | same + field allowlist | unit (mocked client) | **platform behaviour unverified** |

Whether Base44's own scanner clears these findings cannot be confirmed from here: the finding details were never supplied and a re-scan has to be run on the platform.

## 5. Credential rotation (owner action — not done)

I have **no way to revoke or confirm revocation**; these remain open until the providers confirm:

| Credential | Status |
|---|---|
| OwlNet RPC API key | ☐ revoke |
| FortiBlox bearer token | ☐ revoke (value also appeared in an earlier session transcript) |
| Unidentified `X-API-Key` | ☐ identify provider, revoke |
| Historical database password | ☐ confirm database destroyed, or rotate |

Git history still contains them (3 commits mention the FortiBlox prefix); history was not rewritten. Details and checklist: `SECURITY.md` §4.

## 6. Token Explorer

- **Source of tokens:** on-chain discovery of SPL Token and Token-2022 mints (5 RPC calls per refresh), merged with XDEX market data and, when a key exists, X1 Ninja.
- **Verified live:** 25,918 mints indexed (3,775 fungible, 22,013 NFT-like, 130 pool LP tokens); counts equal direct `getProgramAccounts` per program (23,807 SPL, 2,111 Token-2022); decimals and supply match `getAccountInfo` for 15 sampled tokens; the non-pool tokens sampled (185) show real on-chain names (184) and null market fields; listed prices equal the XDEX oracle exactly; served TVL equals the XDEX summary; the index timestamp was 8 s old.
- **Before:** 76 tokens, every price `$0.0000`, market cap `$0.00`, "verified" ticks meaning only "has a symbol", fabricated creation dates (see `screenshots/before`).
- **Removed fabricated values:** zeros for market cap, volume and change; `verified`; `is_scam`; creation dates.
- **X1 Ninja:** integration built (Free endpoints only, server-side `Authorization: Bearer`, cached, one request per minute per instance, 401 not retried) and tested **with mocks only**. Needs `X1_NINJA_API_KEY` in the platform settings. Until then the UI says "X1 Ninja: not connected" and shows holders / 24h change / candles as unavailable. Field names for Ninja token addresses are unconfirmed against a live keyed response.

## 7. Network Map

- Old map placed validators by array index into a hard-coded city list with random jitter. Removed.
- New: self-contained SVG world map (no tile server), positions from geojs.io lookups of each node's gossip address, cached 7 days, rounded to 0.1°, marked city-level (solid) or country-level (dashed). No IP address reaches the browser (test asserts this).
- **Verified live:** 38 of 38 sampled positions equal an independent geojs lookup; 344 of 388 validators located (197 city-level, 147 country-level); no coordinates at 0,0.
- **The 44 unlocated validators** are all delinquent nodes absent from gossip, so no address exists to look up. They are listed under "Not located" and never placed on the map (tested, including with the location service down).
- **Root cause of the old map not displaying could not be proven** (the old tile server is blocked in this sandbox). The page was replaced rather than patched.

## 8. Validator logos and identity

- Names, websites and icons come from the operators' on-chain validator-info accounts (identity key must have signed). Emoji and the hard-coded validator list were removed.
- On cluster: 376 identities; 264 publish an icon URL; 262 pass validation (2 rejected: non-https or private host).
- Icons load through the image proxy (identifier only, https only, redirects re-checked, raster types with magic-byte check, ≤ 1 MB).
- **Sandbox limit:** only 41 of 262 icons were fetchable from here (3 hosts reachable; 40 hosts blocked by the sandbox egress allowlist), so the other 221 are **not verified**. Of the reachable hosts, 4 of 45 URLs were genuinely broken. Fallback behaviour is tested: a deterministic gradient-and-initials avatar, stable across reloads, shown whenever there is no icon or it fails.

## 9. Remaining dependency advisories (5 moderate, dev-time or accepted)

- `react-router` / `react-router-dom`: open redirect with backslashes in `<Link>`/`navigate()`; fixed only in v7 (major). The app passes only its own constant paths with encoded query strings. Upgrade deferred.
- `glob`, `minimatch`, `sucrase`: build-time chain from Tailwind; not in the shipped bundle.
- Removed: unused `react-quill` (quill XSS); upgraded `vitest` to 5.x.

## 10. Design and pages

One design system (tokens, shell with sidebar/search/live slot, shared header, states, tables); 24 routed pages migrated; fabricated metrics removed (list in `PROGRESS.md`). Before/after screenshots: `docs/upgrade/screenshots/{before,after}` (7 before, ~70 after). Route-level code splitting; landing page FCP 232–280 ms on a local build, 592 KB JS.
Not tested: light theme (removed; one dark theme), real devices, screen readers (axe only), real-user performance.

## 11. Remaining external dependencies and limitations

1. Credentials above must be revoked by their owners.
2. A **Base44 preview deployment** is needed to confirm: Deno KV for shared limits, `cf-connecting-ip`, `auth.me()` in functions, binary responses from `getImage`, and that the `/functions/*` route works for the new function names.
3. Hosting is unconfirmed (Base44 vs Vercel); `vercel.json` headers apply only if Vercel serves the site. CSP is a baseline `<meta>` policy; the stricter header version needs the Base44 runtime hosts.
4. X1 Ninja key (optional but needed for holders, 24h change on non-XDEX tokens, candles).
5. Token index refresh pulls ~15 MB from the RPC per warm instance every 10 minutes; if the RPC rate-limits, results stay stale but flagged.
6. The 5 ESLint warnings; the 5 moderate advisories.

## 12. Rollback

See `ROLLBACK.md`. Local tag `backup/pre-upgrade-acebc09`; `main` is untouched.

## 13. Deployment readiness

See `DEPLOYMENT_READINESS.md`.
