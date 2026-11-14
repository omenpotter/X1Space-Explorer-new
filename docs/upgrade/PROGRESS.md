# X1 Space upgrade — checklist and progress log

Branch: `claude/laughing-mayer-sgsved` · Baseline: `acebc09` (local tag `backup/pre-upgrade-acebc09`) · `main` untouched.
Rules: no push / merge / deploy, no secrets printed, no paid endpoints, no credential rotation.

## Baseline (2026-11-14)
- `npm ci` ok · `vite build` ok (single 1.31 MB JS chunk) · `eslint` 136 errors / 60 warnings · `tsc` 487 errors (pre-existing, shadcn JSX typing) · `npm audit --omit=dev` 15 (9 high, 6 moderate)
- No test suite existed.
- Deployment: Base44-hosted app (Deno functions in `base44/functions`, `@base44/vite-plugin`); `vercel.json` points at a non-existent `functions/` dir.

## Live facts verified (public, unauthenticated)
- RPC `rpc.mainnet.x1.xyz`: solana-core 4.0.4; 372 gossip nodes; 339 current + 50 delinquent vote accounts.
- `getProgramAccounts` works: 23,805 SPL mints, 98 + 2,011 Token-2022 mints (~1 s, 5.8 MB with dataSlice).
- Token-2022 `tokenMetadata` is returned by `jsonParsed`; Metaplex program is deployed.
- Validator-info config accounts: 2,921 (name 2,911 · website 2,065 · iconUrl 706); `keys[1]` = identity.
- XDEX pool list: 132 pools, default page 100 (old code missed 32); fields are `token1_*`/`token2_*`.
- XDEX price endpoint needs `token_address` (old code sent `address` -> always failed); chart endpoint needs from/to params.
- X1 Ninja: 401 without key; accepts `Authorization: Bearer`. Documented shape: `{pools[],total,...}`.
- geojs batch geolocation works keyless (lat/lon strings, may be "nil").

## Checklist
- [ ] S1 AI functions: auth, caps, schema validation, per-user quota
- [ ] S2 stub functions restored or removed after caller check
- [ ] S3 shared validation, rate limit store, cache + coalescing, CORS, logging
- [ ] M1 fabricated metrics removed, URL fallback fixed
- [ ] M2 design system + app shell, all pages migrated
- [ ] M3 validator identity + logos + fallback avatars
- [ ] M4 network map with real geolocation
- [ ] M5 token pipeline (on-chain discovery, metadata, XDEX, X1 Ninja)
- [ ] M6 unified RPC client, code splitting, security headers, image proxy
- [ ] Tests: unit, contract, security regression, browser
- [ ] Final report + rotation checklist

## Log
- [done] Backend rewritten: `base44/shared/*` + 16 thin function entries (15 existing + `getImage`). Commit ab88577.
- [done] Live smoke (`NODE_USE_ENV_PROXY=1 LIVE=1 npx vitest run`): 25,912 mints indexed, 3,771 fungible, 132 pools, 377 identities (263 icons), 373/373 nodes located (216 city-level, 157 country-level). Ninja = not_configured (no key).
- [done] 67 backend unit/contract/security tests passing (`npx vitest run`).
- [next] Frontend data layer -> design system/app shell -> TokenExplorer, NetworkMap, Validators -> remaining pages -> browser tests -> report.
