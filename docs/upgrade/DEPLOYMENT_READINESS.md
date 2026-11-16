# Deployment readiness

## Verdict

**Ready for a preview deployment and owner review. Not yet cleared for production.**

Every automated check I could run passes on commit `f4cab15` (lint, typecheck, build, 80 unit/contract tests, live smoke and accuracy tests, 95 + 38 browser checks including accessibility, credential audit). What blocks a production release is not code quality but things I cannot do or observe from the development sandbox.

## Must happen before production

| # | Item | Owner | Why it blocks |
|---|---|---|---|
| 1 | Revoke the OwlNet, FortiBlox and unidentified `X-API-Key` credentials and confirm the old database is gone | account owner | They were shipped in browser code for months; removal from source does not revoke them |
| 2 | Deploy to a **Base44 preview** and run the checks in the next section | owner / next session | Several protections depend on platform behaviour I could not observe |
| 3 | Decide on `react-router-dom` v7 (open-redirect advisory) or accept the risk in writing | owner | One moderate advisory remains in a direct dependency |

## Preview checklist (platform behaviour not observable from the sandbox)

- [ ] `/functions/getTokens`, `getValidators`, `getImage` respond from the preview origin (the client tries `/functions/<name>` first, then the SDK route).
- [ ] `getImage` returns binary images and `Cache-Control`.
- [ ] Calling `smartSearch` while signed out returns 401; signed in returns a result; a 6th call within a minute returns 429.
- [ ] Rate limits persist across cold starts (Deno KV) — otherwise they are per-instance.
- [ ] `cf-connecting-ip` is present (otherwise all anonymous callers share one larger bucket).
- [ ] Response headers (HSTS, `nosniff`, frame protections) are present; tighten CSP to the header version in `SECURITY.md` once the runtime hosts are known.
- [ ] Re-run the Base44 security scan and compare against the 15 acknowledged findings.
- [ ] Open Token Explorer, Network Map and Validators in a real browser; confirm validator logos load (only 41 of 262 could be fetched from the sandbox).
- [ ] If an X1 Ninja key is added: confirm field names in the live response, then enable and recheck request volume (target: a few calls per minute).

## What is already established

- Token data matches independent sources (mint counts per program, decimals, supply, prices, TVL).
- Every Network Map coordinate comes from a geolocation provider; 38 / 38 sampled positions matched an independent lookup; unlocated validators are listed, never guessed.
- No credential is present in the built bundle, in any browser request, or in any backend response.
- Every page renders without console errors at desktop, tablet and mobile widths, with one `h1`, no horizontal overflow, and no serious or critical axe violations on the audited pages.
- Failure paths (backend down, RPC down, location service down, icons failing, empty search) show explicit states, not fabricated values.

## Rollback

`ROLLBACK.md`. Nothing has been pushed or deployed; production is unchanged.

## Update: Base44 runtime compatibility (commit after `cfed931`)

- Backend entries now use the Workers pattern (default export, secrets via `secrets.get`), AI quotas persist in a `RateLimit` entity (memory fallback), and per-token endpoints no longer build the full index. Dashboard and Network Health read the public RPC directly; at most about 720 backend calls per open Dashboard tab per day.
- Re-verified locally: eslint, typecheck, build, 132 unit/contract tests, live smoke and accuracy, 95 + 38 browser checks, credential audit, bundle scan all pass.
- **Not verified on Base44**: no preview app has been deployed because the Base44 account limit was reached. Handler execution on the real runtime, persistent quotas, headers, the security scan and credit use remain untested. Production release still needs separate approval.

## Update: X1 View redesign (dashboard section)

New section `src/components/dashboard/X1View.jsx` (logic in `src/lib/x1/x1view.js`, tests in `tests/frontend/x1view.test.js` and `tests/e2e/x1view.mjs`); the only change to `Dashboard.jsx` is mounting it. Totals and slot counts are exact RPC performance samples, the vote count is exact, and the transfer / token-program / other split of non-vote transactions is estimated from the latest confirmed blocks and labelled as such. The original view's hard-coded fallback mix, random dot order and filler dots were not carried over. 10m tab shows 10m ago to 50m ago (five windows). Screenshots: `docs/upgrade/screenshots/x1view/`.
