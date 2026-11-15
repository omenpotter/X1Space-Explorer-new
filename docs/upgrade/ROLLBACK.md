# Rollback plan

Nothing in this upgrade has been pushed, merged or deployed. Production is unchanged.

## Where the work lives

| Item | Value |
|---|---|
| Development branch | `claude/laughing-mayer-sgsved` (local commits only) |
| Baseline commit | `acebc09` — "Uninstalled npm packages: pg" |
| Baseline tag | `backup/pre-upgrade-acebc09` (local tag) |
| `main` | untouched |

## Before deployment (nothing to undo)

Discard the upgrade entirely:

```bash
git checkout main
git branch -D claude/laughing-mayer-sgsved   # only if you want the work gone
```

Inspect the full change set against the baseline:

```bash
git diff --stat backup/pre-upgrade-acebc09..claude/laughing-mayer-sgsved
```

## After deployment (if a release misbehaves)

1. **Frontend + functions together.** Revert to the baseline commit and redeploy through the same path you normally use
   (Base44 publish, or Vercel redeploy of the previous deployment):

   ```bash
   git checkout -b rollback/pre-upgrade backup/pre-upgrade-acebc09
   ```

   The baseline still contains the old data pipeline, so Token Explorer will again show XDEX-only tokens and the Network
   Map will again use invented locations. Roll back only if the new release is worse.

2. **Individual layers can be reverted separately** because each was committed separately:

   | Layer | Revert by restoring these paths from the baseline |
   |---|---|
   | Backend functions | `base44/functions/**`, and delete `base44/shared/*` additions |
   | Token Explorer | `src/pages/TokenExplorer.jsx`, `src/components/x1/X1ApiClient.jsx`, `src/components/x1/lpApi.jsx` |
   | Network Map | `src/pages/NetworkMap.jsx`, `src/components/x1/ValidatorGraph.jsx` |
   | Design system and shell | `src/index.css`, `tailwind.config.js`, `src/Layout.jsx`, `src/App.jsx`, `src/globals.css`, `src/App.css` |

   Example: `git checkout backup/pre-upgrade-acebc09 -- base44/functions` then redeploy.
   Reverting only the backend while keeping the new frontend will break pages that expect the new response shapes, so
   revert backend and frontend together unless you have tested the combination.

3. **Data.** The upgrade stores no data of its own server side. Browser `localStorage` keys are unchanged
   (`x1_token_watchlist`, `x1_portfolio_wallets`, `x1_alerts`, `x1_alert_config`, `x1_whale_*`, `x1_dashboard_*`),
   so user settings survive a rollback in either direction.

4. **Configuration to undo manually.** If `X1_NINJA_API_KEY` was added to the platform settings, removing it makes the
   X1 Ninja source report "not connected" without any code change. `ALLOWED_ORIGINS`, `AI_DAILY_QUOTA` and
   `GEOLOCATION_DISABLED` are optional and can be deleted at any time.

## Staged rollout suggestion

Deploy to a Base44 preview first and run the checks in `docs/upgrade/DEPLOYMENT_READINESS.md` before pointing
`x1space.xyz` at it.
