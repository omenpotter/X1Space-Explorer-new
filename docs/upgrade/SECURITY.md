# Security remediation record

Scope: the 15 backend functions flagged in the Base44 security interface, plus frontend/backend hardening.
Status words used below:

- **Tested** — covered by automated tests in `tests/backend` (mocked dependencies, no network).
- **Live-checked** — exercised against the real public endpoint from the development sandbox on 2026-11-14.
- **Unverified on platform** — depends on Base44 hosting behaviour that could not be observed from here.

The Base44 findings themselves were never supplied in detail, so this record maps each function to the
risks found in its code. Whether Base44's scanner clears its findings can only be confirmed by re-running
the scan after deployment.

## 1. Remediation matrix

All functions now share one implementation path (`base44/shared/handlers.ts`): method check, origin-restricted
CORS, per-client rate limit, input validation before any upstream call, cached and coalesced upstream requests,
bounded retries, and error responses that carry only a code and a short message.

| # | Function | Original concern (from code review) | Change | Access | Tests | Remaining risk |
|---|---|---|---|---|---|---|
| 1 | analyzeToken | Dead stub (always 503); UI called it for nothing | Restored as a rule-based review of on-chain facts (authorities, holder concentration, liquidity). No model call. Mint validated; 20 req/min/IP; cached 30 s | Public | Tested, live-checked | Review is heuristic and says so in its output |
| 2 | detectAnomalies | Stub; polled every 5 min by every tab | Restored: fixed thresholds on live RPC values (delinquent stake, slot time, TPS). 30 req/min/IP; cached | Public | Tested, live-checked | No historical baseline exists, so only threshold checks are possible |
| 3 | getLPPoolDetail | No rate limit, no validation, full pool list fetched per request | Pool address validated; served from the shared cached pool list; optional trades via X1 Ninja | Public | Tested, live-checked (trades: mocked) | Trades inactive until a Ninja key is set |
| 4 | getLPStats | Private limiter copy; logged upstream responses; full list per request | Shared limiter and cache; no response logging | Public | Tested, live-checked | — |
| 5 | getLPTokens | `limit` not clamped (NaN/negative) | `limit` 1–500 and `offset` clamped; shared cache | Public | Tested, live-checked | — |
| 6 | getLiquidityPools | No limit/validation; read fields that do not exist in the XDEX response (`token_a_mint`) so it never matched | Mint validated; uses the live field names (`token1_address`); shared cache | Public | Tested, live-checked | — |
| 7 | getNetworkHistory | Stub returning `[]`; `hours` unparsed | Restored from RPC performance samples; `hours` clamped to 1–12 (what the RPC holds) | Public | Tested, live-checked | History limited to ~12 h by the RPC |
| 8 | getNetworkStats | Stub returning 503 without CORS headers | Restored from live RPC; values are `null` when a source fails | Public | Tested, live-checked | — |
| 9 | getTokenByMint | No limit/validation; wrong XDEX field names and wrong price parameter (`address` instead of `token_address`), so detail and price never worked | Mint validated; chain facts + pools + price changes; cached 30 s | Public | Tested, live-checked | Off-chain metadata JSON is fetched from creator-supplied URLs (https only, public hosts only, 128 KB cap, 5 s timeout) |
| 10 | getTokenPrices | No limit; wrong price parameter; chart endpoint called with missing parameters | Corrected parameter; candles via X1 Ninja when configured, otherwise reported as `not_configured` | Public | Tested, live-checked (candles: mocked) | Candles inactive until a Ninja key is set |
| 11 | getTokens | Fabricated fields; unclamped pagination; only first 100 of 132 pools read; full upstream fetch per request | On-chain index + market merge; `limit` 1–200, `offset` ≥ 0, enum-checked sort/filter; one upstream round per cache window regardless of visitors | Public | Tested, live-checked | Index refresh downloads ~15 MB from the RPC every 10 min per warm instance |
| 12 | getValidators | Stub returning `[]` | Restored: on-chain identity directory + approximate locations. No IP addresses in the response | Public | Tested, live-checked | Sends node gossip IPs (already public on chain) to geojs.io for lookup |
| 13 | searchTokens | Stub; client sent `q` but function required `name`/`symbol` (always 400) | Searches the token index; accepts `q` (and legacy names); 2–64 chars; max 50 results | Public | Tested, live-checked | — |
| 14 | smartSearch | **Anonymous callers could spend model credits** through the service role; raw query interpolated into the prompt; no size cap | Sign-in required (401 otherwise); per-user quota (5/min, 25/day by default) plus per-IP guard; body ≤ 16 KB, query ≤ 300 chars; user text JSON-quoted with `<`/`>` escaped inside a data block; model reply reduced to an allowlisted shape | **Authenticated** | Tested (platform client mocked) | Unverified on platform: `auth.me()` behaviour and quota persistence |
| 15 | tokenVerificationAssistant | Same as 14, with arbitrary nested objects serialised into the prompt | Same guards; form fields allowlisted (≤ 20 flat keys, ≤ 1000 chars each); prior analysis re-validated; outputs bounded | **Authenticated** | Tested (platform client mocked) | Same as 14 |
| + | getImage (new) | Browser loaded logos straight from arbitrary third-party URLs (visitor IP disclosure) | Proxy that accepts only `kind` + an address; the server looks up the URL itself. https only, redirects re-validated, raster types only (magic bytes checked), ≤ 1 MB, 6 s timeout | Public | Tested, live-checked for allowed hosts | Unverified on platform: binary responses from Base44 functions |

### Cross-cutting changes

| Area | Before | After |
|---|---|---|
| CORS | `Access-Control-Allow-Origin: *` everywhere, `PUT`/`DELETE` advertised | Origin echoed only for `x1space.xyz`, `*.base44.app`, localhost and `ALLOWED_ORIGINS`; methods limited to those used |
| Rate limiting | Per-instance `Map`, three private copies, 8 functions with none | One store-backed limiter on every function. Uses Deno KV when the platform provides it (shared and persistent), otherwise bounded memory |
| Client address | `cf-connecting-ip` or a shared `unknown` bucket at the normal limit | Same header (spoofable `x-forwarded-for` still ignored); the shared `unknown` bucket gets 20× the per-client limit so one caller cannot lock everyone out |
| Upstream load | One full XDEX list fetch per visitor request | Cached 45 s with in-flight coalescing: 30 concurrent visitors cause one upstream call (tested) |
| Errors | Mostly masked; some functions logged upstream bodies and stacks | Code + short message only; logs record scope and error class, never request data or upstream bodies |
| Secrets | None in current tree | Unchanged. The only secret read is `X1_NINJA_API_KEY`, sent solely in the `Authorization` header to `api.x1.ninja` (tested) |
| SSRF | None found | Still none: no endpoint accepts a URL or host. Server-fetched URLs from chain data pass `safeHttpsUrl` (https, public hostname, no IP literals, no credentials, default port) |

## 2. Platform items that need confirmation after a preview deployment

1. **Persistent rate-limit store.** `Deno.openKv()` is used when available. If Base44 does not offer it, limits
   and AI quotas are per instance and reset on cold start. Confirm by calling an AI function 6 times within a minute
   across cold starts.
2. **`cf-connecting-ip`.** If the platform does not set it, all anonymous callers share one (larger) bucket.
3. **`auth.me()` inside functions** returns the signed-in user for requests made through the SDK.
4. **New function `getImage`** is picked up from `base44/functions/getImage/entry.ts` like the others and may return binary bodies.
5. **Response headers.** `vercel.json` sets HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`
   and `frame-ancestors`, but only applies if the site is served by Vercel. On Base44 hosting these headers are
   controlled by the platform.

## 3. Content security policy

`index.html` ships a baseline policy by `<meta>` (https-only resources, `object-src 'none'`, `base-uri 'self'`,
`form-action 'self'`, `frame-src 'none'`). Script and image hosts are left open because Base44 injects runtime
scripts whose hosts could not be observed here. Once a preview shows which hosts those are, switch to this
stricter response header:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' <base44 runtime hosts> https://va.vercel-scripts.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://app.xdex.xyz https://raw.githubusercontent.com;
  font-src 'self';
  connect-src 'self' https://rpc.mainnet.x1.xyz https://rpc.x1galaxy.io <base44 api host>;
  object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

## 4. Credential rotation checklist

Git history (commits between 2026-02-22 and 2026-11-11) contains credentials that were shipped in browser code.
They were removed from the source on 2026-11-11, which does **not** revoke them. Values are deliberately not
reproduced here. Nothing below has been done by this upgrade; each line needs the account owner.

| # | Credential (redacted) | Where it appeared | Action for the owner | Done / confirmed by provider |
|---|---|---|---|---|
| 1 | OwlNet RPC API key (`rpc.owlnet.dev/?api-key=…`) | `src/components/x1/X1RpcService.jsx`, `ValidatorNames.jsx`, `PortfolioTracker.jsx` (history) | Revoke the key in the OwlNet account; issue a new one only if still needed and keep it server-side | ☐ |
| 2 | FortiBlox bearer token (`Bearer fbx_…`) for `nexus.fortiblox.com/rpc` | `X1RpcService.jsx` (history) | Revoke in the FortiBlox dashboard; review usage logs for the exposure window | ☐ |
| 3 | `X-API-Key` header value (provider not identifiable from the code) | `X1RpcService.jsx` auth-header map (history) | Identify the provider from account records for that endpoint; revoke and reissue | ☐ |
| 4 | Database password fallback (`X1_DB_PASSWORD` defaulting to a weak literal) | deleted `main.ts` (history) | Confirm the Postgres instance is destroyed; if it still exists, rotate the password and restrict network access | ☐ |
| 5 | Base44 function secrets | Base44 settings | Remove `X1_DB_*` variables if the database is gone | ☐ |

After rotation: check each provider's usage logs for February–November 2026. Rewriting git history is optional and was
not done; it only helps once the keys are revoked, and it requires every clone to be re-synced.

Note: during the earlier read-only audit, one history-inspection command printed the FortiBlox token into that
session's transcript. Treat the transcript as sensitive until item 2 is done.

## 5. Dependencies

`npm audit --omit=dev` before and after is recorded in `docs/upgrade/TEST_RESULTS.md`.
