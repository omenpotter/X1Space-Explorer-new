# Base44 Runtime Verification Procedure

Everything in `SECURITY_REGRESSION_TESTS.md` is mocked. This document is the **owner-run** procedure that turns the **[RUNTIME-UNVERIFIED]** items into facts. Until it has been run, do not describe the quota backends as "working".

**Rules for running it**

- Run it on a Base44 **preview or staging copy** of the branch `claude/x1space-security-hardening`, not on production. If Base44 only offers production, deploy during a quiet period with `SECURITY_ROLLBACK.md` ready.
- Steps marked **[needs approval]** send a small burst of requests or one billable AI call. They are listed so you can approve them explicitly. None changes production data other than `RateLimit` counter rows.
- Replace `<URL>` with the preview (or site) origin. Do not paste secrets or tokens anywhere except your own terminal.

## A. Zero-cost checks (read the logs)

Each instance logs these constant lines **once**. Open the function logs in the Base44 dashboard after one normal page view.

| Log line | Meaning | Next step |
|---|---|---|
| `[rate-limit] public limiter store=shared-kv` | Deno KV exists. Public limits are shared across instances. | R1 not needed. |
| `[rate-limit] public limiter store=per-instance-memory` | No KV. Public limits are per instance. | See C3/C4. Consider R1 only if abuse is observed. |
| `[ai-quota] backend=kv` | AI quota is atomic. The global limit is a hard ceiling. | Done. |
| `[ai-quota] backend=ledger` | AI quota is the best-effort entity ledger. | Run C6 and C7. |
| `[ai-quota] backend=none (AI refused)` | No reliable backend. AI features answer 503 (by design). Rest of the site is fine. | Ask Base44 about KV, or use the architecture in `FINAL_SECURITY_HARDENING.md` section 5. |
| `[x1ninja-quota] enforcement=shared-atomic` | Exact shared Ninja counters. | Done. |
| `[x1ninja-quota] enforcement=shared-best-effort` | Shared entity counter (small overshoot possible). | Acceptable; check C9. |
| `[x1ninja-quota] enforcement=per-instance` | Counters are per instance. | Compare with the provider dashboard (C9). |

The AI line appears only after a signed-in AI request reaches the model call (see C6).

## B. Settings checks

| ID | Check | How | Expected |
|---|---|---|---|
| C1 | Header `X-Frame-Options: DENY` | Already confirmed on production. | Done. |
| C2 | **Base44 editor preview with Block iframe embedding on** | Open the app in the Base44 editor and its preview. | Preview loads. If it shows a blocked-frame message, turn the setting off, note it, and ask Base44 whether the editor preview origin is exempt. |

## C. Controlled runtime tests

### C3. Is the client IP header trustworthy? **[needs approval]** (35 cheap cached requests)

```bash
for i in $(seq 1 35); do curl -s -o /dev/null -w "%{http_code}\n" \
  -H "CF-Connecting-IP: 198.51.100.$i" -H "X-Forwarded-For: 203.0.113.$i" \
  "<URL>/functions/detectAnomalies"; done | sort | uniq -c
```

The function allows 30 per minute per IP. A fixed one-minute window can split the run; if the result is odd, wait a minute and repeat.

| Result | Meaning |
|---|---|
| about 30 x `200` and about 5 x `429` | The edge overwrites `CF-Connecting-IP`, so a client cannot choose its own identity, and the limiter counts per source. Good. |
| 35 x `200` | Client-supplied headers are trusted **or** the platform sends no client IP, so the limiter can be bypassed by header rotation. **R1 or a platform limit is needed.** |

### C4. Is the public limiter shared across instances? (read-only, uses A)

Use the log line from section A. Do not attempt to prove cross-instance sharing with traffic alone: counters are per-minute and you cannot force a new instance.

### C5. Request path still works anonymously

```bash
curl -s -o /dev/null -w "%{http_code}\n" "<URL>/functions/getTokens?limit=1"
curl -s -o /dev/null -w "%{http_code}\n" "<URL>/functions/getNetworkStats"
```

Expect `200` for both. This confirms that adding the platform client to the ten function entries did not break anonymous callers (it is wrapped in a try/catch by design).

### C6. AI quota backend and Retry-After **[needs approval: one billable AI call]**

Set `AI_GLOBAL_DAILY_QUOTA=1` on the preview. Sign in to the app in a browser, then in the browser DevTools console run:

```js
const t = localStorage.getItem('base44_access_token');   // your own session token; do not share it
const id = localStorage.getItem('base44_app_id');
// Same route the app's SDK uses for AI functions (POST /api/apps/<appId>/functions/<name>).
const call = () => fetch('/api/apps/' + id + '/functions/smartSearch', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: JSON.stringify({ query: 'tps' }) }).then(async r => [r.status, r.headers.get('retry-after'), (await r.json()).error?.code]);
console.log(await call()); console.log(await call());
```

If your session is stored differently and these keys are empty, sign in again and check Application, Local Storage in DevTools for the keys starting with `base44_`. Expected: first `[200, null, undefined]` (one model call), second `[503, "<seconds>", "ai_capacity_reached"]`. The `Retry-After` value should be the seconds remaining until 00:00 UTC (check against `date -u`). The log line `[ai-quota] backend=...` should now be present.

### C7. Does the AI counter survive instance restarts? **[needs approval]** (no extra billing)

Continue from C6 after at least 20 minutes of no traffic (so the instance has been recycled). Run `await call()` again. Expected: still `503 ai_capacity_reached`. If it returns `200`, the counter is not persistent and AI quotas are per instance; **do not rely on the global cap**, and ask Base44 about Deno KV.

### C8. Parallel AI requests cannot exceed the cap **[needs approval: at most 3 billable calls]**

Set `AI_GLOBAL_DAILY_QUOTA=3` (use a new UTC day, or a quota value you have not used today, because counters are per UTC day). Then:

```js
const rs = await Promise.all(Array.from({ length: 12 }, call));
console.log(rs.filter(r => r[0] === 200).length, 'allowed of 12');
```

Expected: **3 or fewer** `200`s. The per-minute burst limit (5) also applies, so some `429 rate_limited` is normal. If more than 3 succeed, the entity ledger is not read-your-writes consistent: the global limit is only approximate; lower the quota or obtain Deno KV.

### C9. X1 Ninja usage matches expectations

1. Load the site normally for an hour. In the X1 Ninja dashboard (`https://x1.ninja`, "Manage your keys"), note requests used.
2. Expected order of magnitude: one pools request per minute per active instance (about 60 per hour per instance), plus candle or trade requests when those pages are opened. A number far above that means counters are per instance or caching is not working.
3. In the Base44 data view, open the `RateLimit` entity: you should see a row `x1ninja:month:<YYYY-MM>` whose `count` grows in steps of 25, and short-lived `x1ninja:min:<n>` rows that disappear.
4. **Provider reset:** on the 1st of next month (UTC) confirm the provider dashboard resets and that a new `x1ninja:month:` row begins.

### C10. Entity assumptions

In the Base44 data view confirm the `RateLimit` rows carry a `created_date` and that rows with an expired `expires_at` disappear over time. These are what the ledger and cleanup rely on (checked against the SDK types only).

### C11. Base44 support questions (no cost)

1. Is `Deno.openKv()` available in backend functions? Is it shared across all instances?
2. Do entity reads reflect a write made by the same request immediately?
3. Is `CF-Connecting-IP` always set and overwritten by the edge before a function runs?
4. Does the runtime expose `Deno.resolveDns`, and does it block private and link-local egress from `fetch`? (R5)
5. Is there a platform rate-limit or WAF feature for functions?
6. What default model does `InvokeLLM` use when `model` is omitted, does it cap output tokens, and does it retry internally?
7. Can an app-level credit cap be set for integrations?

## D. Result record

Copy this table into your notes and fill it in.

| ID | Date | Result | Decision |
|---|---|---|---|
| A: store / AI backend / Ninja enforcement log lines | | | |
| C2 editor preview | | | |
| C3 header spoofing | | | |
| C5 anonymous endpoints | | | |
| C6 Retry-After and backend | | | |
| C7 persistence | | | |
| C8 parallel ceiling | | | |
| C9 Ninja usage | | | |
| C10 entity assumptions | | | |
| C11 Base44 answers | | | |

## E. Decision guide

- Logs show `kv` and `shared-atomic` and C3 passes: everything is hard-enforced. Merge.
- Logs show `ledger` and C7 and C8 pass: AI cap is reliable enough for production; keep `AI_GLOBAL_DAILY_QUOTA` modest.
- C3 fails: request approval to implement R1 (entity-backed per-IP limiting for the expensive endpoints only) or use a platform limit.
- C7 or C8 fails, or backend is `none`: AI stays safe (it refuses), but plan the alternative architecture before enabling AI broadly.
