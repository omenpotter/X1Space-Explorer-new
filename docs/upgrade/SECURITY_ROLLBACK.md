# Security Hardening Rollback

| | |
|---|---|
| Production baseline (rollback target) | `374f05fc8b0e392723c7d3801fa23c3294ff916a` (`origin/main`, merge of PR #3) |
| Hardening branch | `claude/x1space-security-hardening`: phase 1 `3c33045`, phase 2 `dcb3dff` and `b728682`, closure `cbb06c2` (react-router 7) and the final documentation commit |
| State of production | **Unchanged.** Nothing was merged, deployed or published. `main` is at the baseline. |

## 1. Before anything is merged: nothing to roll back

Production still runs the baseline. To abandon the work, do nothing, or delete the branch:

```bash
git push origin --delete claude/x1space-security-hardening
```

## 2. If the branch is merged and deployed, then must be reverted

Each step is independent. Choose the smallest that fixes the problem.

**Option A: configuration only (no code change, fastest).** Most behaviours are secret-tunable:

| Symptom | Action |
|---|---|
| AI refused too often | Raise `AI_DAILY_QUOTA`, `AI_IP_DAILY_QUOTA` or `AI_GLOBAL_DAILY_QUOTA`. |
| AI answers 503 (`ai_unavailable`) and the actor is confirmed deployed | Roll back (Option B or C). Do **not** set `AI_QUOTA_MODE=best_effort` as a quick fix: it removes the atomic guarantee. Set it only as a conscious decision. |
| Ninja data paused too early | Raise `X1_NINJA_MONTHLY_QUOTA` (max 500000) or `X1_NINJA_RATE_LIMIT_PER_MIN` (max 60). |
| Wrong provider cycle | Set `X1_NINJA_RESET_DAY`. |

Removing a secret returns that setting to its default.

**Option B: revert the merge on `main` (full code rollback).**

```bash
git checkout main && git pull
git revert -m 1 <merge-commit-sha>      # creates a new commit that undoes the merge
git push origin main
```

Then redeploy in Base44. If the work was merged by fast-forward or squash, revert the commit(s) range instead (`git revert 3c33045..<tip>`). **Reset to the baseline hash only with explicit owner approval, since it rewrites history:** `git reset --hard 374f05f` then `git push --force-with-lease`.

**Option C: Base44 version history.** Restore the previous published version from the Base44 dashboard. This does not touch git.

## 2b. Things the phase 2 changes add to a rollback

- **The `QuotaCounter` actor** (`base44/actors/QuotaCounter`) is new. Rolling back the code does not remove a deployed actor. It is harmless without callers (it refuses everything except service-role calls and all WebSocket connections), and can be deleted from the Base44 dashboard or CLI if desired. Its stored counters expire on their own.
- **SDK pin:** the ten function entries moved from `npm:@base44/sdk@0.8.6` to `npm:@base44/sdk@0.8.62`. A code rollback restores `0.8.6`. If a failure appears right after deployment and is not quota related, suspect this change first (rollback criterion 2 in the verification document).
- **`package-lock.json`:** `sucrase` 3.35.0 to 3.35.1 (removes `glob`/`minimatch` from the lockfile; build output byte-identical). Reverting the commit restores the old lockfile. `package.json` was not changed.
- **Image proxy:** the SSRF filter is stricter. If legitimate images stop loading (rollback criterion 5), revert `base44/shared/validate.ts` and `ssrf.ts` only, as a partial rollback, after capturing two failing URLs.
- **`react-router-dom` 7.18.5** (`package.json` one line, `package-lock.json`; commit `cbb06c2`) is a separate, independent commit. If anything misbehaves after the frontend change is deployed, `git revert cbb06c2` restores 6.30.6 and the two advisories return. It does not depend on, and is not depended on by, any backend change; apply and roll it back separately.
- **Rollback in Base44 is by branch deletion, checkpoint restore or publishing a checkpoint** (`BASE44_RUNTIME_VERIFICATION.md` section 3.13). If the app is GitHub-synced (check N9), a merge to GitHub `main` is also synced into Base44, so a git revert on `main` is a rollback there too, but it still needs Base44's own publish step; do not rely on git alone, and note that `main` also receives Base44 bot commits.
- **Shared resources:** secrets, data, settings and (unlisted) actors are shared between a Base44 branch and production. A rollback of code does not undo secret changes, an `ACTOR_TOKEN_SECRET`, or a deployed `QuotaCounter` actor; all are inert for the old code (verification doc 3.0).

## 3. Data and settings left behind (nothing to undo, nothing harmful)

- **`RateLimit` entity rows.** The new code reuses the existing entity and fields (no schema change). Rows with keys starting `ai-user:`, `ai-ip:`, `ai-global:`, `x1ninja:` expire within a day (AI) or about a month (Ninja cycle counter) and are cleaned up opportunistically. They are admin-only (RLS). The baseline code ignores them. To delete them early, an admin can remove rows whose `key` starts with those prefixes. **Do not do this in production without owner approval.**
- **Secrets.** No secret was created or changed by this work. Any of the optional secrets you add can simply be deleted.
- **Base44 settings.** None were changed. `Block iframe embedding` (owner setting) is independent of this branch.

## 4. What changes when rolled back

| Area | After rollback |
|---|---|
| AI limits | Back to 25 per user per day, per instance counters held in the entity, silent fallback to memory. No global cap, no strict mode. |
| Cache | FIFO, single 500-entry map. |
| X1 Ninja | Unmetered, redirects followed, 1 internal retry. |
| Image proxy | Previous filter (trailing-dot hostnames and wildcard-DNS names accepted again). |
| Frontend | Identical (no frontend change was made). |
| Public API (16 functions) | Identical. |

## 5. Verification after a rollback

```bash
npx vitest run     # at baseline: 149 tests pass
```

Then load `https://x1space.xyz`, open a token page, and confirm the network, validator and token pages show live data. If AI features were in use, sign in and try one search.
