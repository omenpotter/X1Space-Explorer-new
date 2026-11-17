# Security Hardening Rollback

| | |
|---|---|
| Production baseline (rollback target) | `374f05fc8b0e392723c7d3801fa23c3294ff916a` (`origin/main`, merge of PR #3) |
| Hardening branch | `claude/x1space-security-hardening`, implementation commit `3c3304535176b581755b94af930937dcf14b693b` |
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

## 3. Data and settings left behind (nothing to undo, nothing harmful)

- **`RateLimit` entity rows.** The new code reuses the existing entity and fields (no schema change). Rows with keys starting `ai-user:`, `ai-ip:`, `ai-global:`, `x1ninja:` expire within a day (AI) or about a month (Ninja cycle counter) and are cleaned up opportunistically. They are admin-only (RLS). The baseline code ignores them. To delete them early, an admin can remove rows whose `key` starts with those prefixes. **Do not do this in production without owner approval.**
- **Secrets.** No secret was created or changed by this work. Any of the optional secrets you add can simply be deleted.
- **Base44 settings.** None were changed. `Block iframe embedding` (owner setting) is independent of this branch.

## 4. What changes when rolled back

| Area | After rollback |
|---|---|
| AI limits | Back to 25 per user per day, per instance counters held in the entity, silent fallback to memory. No global cap. |
| Cache | FIFO, single 500-entry map. |
| X1 Ninja | Unmetered, redirects followed, 1 internal retry. |
| Frontend | Identical (no frontend change was made). |
| Public API (16 functions) | Identical. |

## 5. Verification after a rollback

```bash
npx vitest run     # at baseline: 149 tests pass
```

Then load `https://x1space.xyz`, open a token page, and confirm the network, validator and token pages show live data. If AI features were in use, sign in and try one search.
