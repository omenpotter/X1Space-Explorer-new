# X1 Space design system and page rules

This is the contract every routed page follows. Reference implementations:
`src/pages/TokenExplorer.jsx` and `src/pages/NetworkMap.jsx`.

## Direction

A blockchain intelligence terminal with fintech polish: dense, calm, exact. One dark theme.
Cyan (`brand`) is the only accent and is used sparingly: active navigation, primary actions, key figures.
No glow effects, no decorative animation, no gradients on text.

## Tokens (Tailwind classes)

| Purpose | Classes |
|---|---|
| Page background | `bg-canvas` (already applied by the shell: pages do not set it) |
| Card / panel | `panel` (class) or `<Panel>`; nested surfaces `bg-surface-2`, hover/active `bg-surface-3` |
| Borders | `border-line`, emphasised `border-line-strong` |
| Text | `text-ink` (primary), `text-ink-soft`, `text-ink-muted` (labels), `text-ink-faint` (captions only) |
| Accent | `text-brand`, `bg-brand text-brand-ink` (primary button), `bg-brand/10` (tint) |
| Status | `text-positive`, `text-negative`, `text-warning`, `text-violet` (Token-2022) |
| Fonts | body `font-sans` (Inter), headings `font-display` (Space Grotesk), addresses/hashes `mono` class |
| Small caps label | `eyebrow` class |
| Tables | `<table className="data-table">` inside `<div className="overflow-x-auto">` |
| Numbers | add `tabular` so digits align |

Do not use raw hex colours (`bg-[#...]`), `text-gray-*`, `text-white` on body copy, or `border-white/*`.
`text-white` is acceptable only on coloured buttons.

## Shell

`src/Layout.jsx` wraps every page in `AppShell` (sidebar, top bar with global search and live slot, footer).
Therefore a page must NOT render: its own site header or logo, a "back to dashboard" link, a nav bar,
a footer, `min-h-screen`, or a full-page background. A page returns a fragment:

```jsx
<>
  <PageHeader icon={Icon} title="…" description="…" meta={<Freshness … />} actions={…} />
  …content…
</>
```

Detail pages pass `back={{ label: 'Validators', to: createPageUrl('Validators') }}` to `PageHeader`.
Exactly one `<h1>` per page (the one inside `PageHeader`). Section titles are `<h2>`.

## Shared components

- `@/components/shell/PageHeader` — title, description, `meta`, `actions`, `back`, `badge`.
- `@/components/ds/Primitives` — `Panel`, `StatCard`, `Pill`, `Freshness`, `CopyButton`, `Meter`.
- `@/components/ds/States` — `Skeleton`, `TableSkeleton`, `StatSkeleton`, `EmptyState`, `ErrorState`, `Unavailable`.
- `@/components/ds/Avatar` — `ValidatorAvatar` (official on-chain icon via proxy, generated fallback), `TokenAvatar`, `GeneratedAvatar`.
- `@/lib/format` — `compact`, `integer`, `usd`, `percent`, `shortAddress`, `timeAgo`, `DASH`. All return an em dash for missing values.
- `@/components/ui/*` — shadcn primitives (Button, Sheet, Tabs, Select, Tooltip…), already themed through CSS variables.

## Data rules (non-negotiable)

1. **No invented numbers.** No `Math.random()` in anything a user reads as data, no hard-coded statistics,
   no "example" rows, no artificial delays, no default prices. A layout seed (e.g. particle positions) is fine;
   a metric is not.
2. **Missing is not zero.** When a value is unknown render `<Unavailable reason="…" />` (or `DASH` from
   `@/lib/format`), never `0`, `0.00` or `N/A` styled as data. Guard every `.toFixed()` / arithmetic on values that can be `null`.
3. **Every data view has four states:** loading (skeleton, not a full-page spinner), ready, empty (`EmptyState`),
   error (`ErrorState` with retry). A failed background refresh keeps the last good data and marks it stale.
4. **Freshness.** Views that poll show `<Freshness at={…} source="X1 RPC" onRefresh={…} />`.
5. **Polling.** Use the intervals in `X1_CONFIG.polling` (`@/lib/x1/config`), skip a tick when `document.hidden`,
   clear intervals on unmount.
6. **One RPC client.** Never `fetch('https://rpc…')` directly. Use `X1Rpc.*` from `@/components/x1/X1RpcService`
   or `rpcCall(method, params)` from `@/lib/x1/rpcClient` (timeout, failover, de-duplication built in).
7. **Backend data** comes from `api.*` in `@/lib/x1/api` (tokens, pools, network stats, validator directory).
8. **Untrusted text** (validator names, token names, memo text) is rendered as text only. External links go through
   `safeUrl()` from `@/lib/safeUrl` and carry `target="_blank" rel="noopener noreferrer"`.

## Validator data shape (from `X1Rpc.getValidatorDetails()`)

`votePubkey, nodePubkey, name, hasIdentity, website, details, hasIcon, location, activatedStake (XNT),
stakePercent (string), commission, lastVote, voteLag, rootSlot, credits, creditsThisEpoch, creditsPrevEpoch,
version (string|null), delinquent, voteRate (0-100|null), uptime (alias of voteRate), skipRate (number|null),
leaderSlots (number|null), blocksProduced (number|null)`.

- `voteRate` is the share of the maximum vote credits earned this epoch. Label it **"Vote rate"**
  (it is not uptime; rename any "Uptime" label that shows this field).
- `skipRate` is `null` when the validator had no leader slots yet this epoch: show `Unavailable`, not 0%.
- `validator.icon` (emoji) no longer exists: use `<ValidatorAvatar validator={v} size={…} />`.
- There is no per-validator history series available from the RPC beyond `epochCredits`. Do not synthesise one.

## Accessibility

- Icon-only buttons need `aria-label`; decorative icons `aria-hidden="true"`.
- Status never relies on colour alone: pair it with text or an icon (`Pill`).
- Interactive rows are reachable by keyboard (a real `<a>`/`<button>` inside the row).
- Tables have a `<caption className="sr-only">` and `scope="col"` on headers.
- Form controls have a visible label or `aria-label`.
- Layouts work from 360 px wide: wrap toolbars, hide secondary table columns with `hidden md:table-cell`,
  never rely on horizontal page scroll (tables may scroll inside `overflow-x-auto`).
