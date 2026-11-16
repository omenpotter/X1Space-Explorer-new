# Page migration brief (read fully before editing)

Repo: /home/user/X1Space-Explorer-new (React 18 + Vite, JSX, Tailwind, shadcn/ui). Other workers edit OTHER files at the same time.
Edit ONLY the files in your list. Do not commit/push/install packages. Do not edit package.json, base44/, src/components/ui|shell|ds, src/lib, src/pages.config.js, src/Layout.jsx.

Read first: docs/upgrade/DESIGN_SYSTEM.md (binding contract), then the finished reference pages src/pages/TokenExplorer.jsx, src/pages/NetworkMap.jsx, src/pages/Validators.jsx and src/pages/ValidatorDetail.jsx, plus src/components/ds/Primitives.jsx, ds/States.jsx, ds/Avatar.jsx, shell/PageHeader.jsx, src/lib/format.js, src/lib/x1/config.js, src/lib/x1/api.js.

Every page must:
1. Drop its own site header/logo/nav/back-link/footer/`min-h-screen`/page background. Return a fragment starting with `<PageHeader title=… />` (exactly one h1). The AppShell already provides nav, search, footer. Use Panel/StatCard/Pill/Freshness/data-table, tokens only (no `bg-[#…]`, `text-gray-*`, `text-white` for body text, `border-white/*`). Responsive from 360px, keyboard reachable, aria labels on icon buttons, table captions.
2. Show only real data. Remove every Math.random-driven number, hard-coded statistic, demo row, fake delay, default price, unlabelled estimate. Missing is not zero: use `<Unavailable reason/>` or DASH from `@/lib/format`; guard `.toFixed` on null.
3. Have loading (skeleton), empty, error (with retry) states; a failed background refresh keeps last good data and marks it stale via `<Freshness stale/>`.
4. Poll with `X1_CONFIG.polling.*`, skip when `document.hidden`, clear on unmount.
5. RPC only through `X1Rpc.*` (@/components/x1/X1RpcService) or `rpcCall` (@/lib/x1/rpcClient); backend data only through `api.*` (@/lib/x1/api). No direct `fetch('https://rpc…')`. No console.log noise.
6. Validators: `<ValidatorAvatar validator={v}/>`; `v.uptime`/`v.voteRate` is the vote-credit rate (label "Vote rate"); `v.skipRate`, `v.version` may be null. No emoji icons.
7. Untrusted strings render as text only; external links via `safeUrl` with rel="noopener noreferrer".
8. localStorage reads are wrapped in try/catch and shape-validated.

Verify: `npx eslint <your files>` (no errors), `npx vite build --outDir /tmp/claude-0/build-<yourname> --emptyOutDir` (the build may fail on files that are not yours: say so, do not edit them), and `grep -n "Math.random\|bg-\[#\|text-gray-\|min-h-screen" <your files>` empty.
Report concisely: per file what changed, every fabricated value removed and what replaced it, anything unresolved, eslint/build results.

Current MempoolViz API (src/components/x1/MempoolViz.jsx, already rewritten, do not edit): `TX_TYPES`, `txBreakdown(block)`, `CompositionBar({breakdown})`, `TxTypeLegend()`, `BlockCompositionCard({block})`, default export `BlockActivityStrip({blocks, limit})`. Blocks.jsx/Dashboard.jsx still import the OLD names (MempoolBlockViz, MempoolAggregatedViz, MempoolLegend, default MempoolViz with other props): update them to the new API.
