import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Search, Trash2, Wallet } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { TokenAvatar } from '@/components/ds/Avatar';
import { CopyButton, Freshness, Panel, Pill, StatCard } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, Skeleton, Unavailable } from '@/components/ds/States';
import { rpcCall } from '@/lib/x1/rpcClient';
import { api } from '@/lib/x1/api';
import { X1_CONFIG } from '@/lib/x1/config';
import { integer, shortAddress, usd } from '@/lib/format';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'x1_portfolio_wallets';
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_WALLETS = 10;
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const LAMPORTS_PER_XNT = 1e9;
const NATIVE_KEY = 'native';

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const inputClass = 'h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/25';
const primaryButton = 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50';
const ghostButton = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line-strong px-3 text-sm text-ink-soft transition-colors hover:bg-surface-3 disabled:opacity-50';

function readWallets() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];
    for (const w of raw) {
      if (!w || typeof w.address !== 'string' || !BASE58.test(w.address) || seen.has(w.address)) continue;
      seen.add(w.address);
      out.push({ address: w.address, label: typeof w.label === 'string' ? w.label.slice(0, 40) : '' });
      if (out.length >= MAX_WALLETS) break;
    }
    return out;
  } catch {
    return [];
  }
}

function writeWallets(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable: the list still works for this visit.
  }
}

function formatAmount(n) {
  if (!isNum(n)) return null;
  return n.toLocaleString('en-US', { maximumFractionDigits: n >= 1000 ? 2 : 6 });
}

/** Reads one wallet from the RPC. Each call can fail on its own; a missing part is reported, never zeroed. */
async function fetchWallet(address) {
  const tokenQuery = (programId) => rpcCall('getTokenAccountsByOwner', [address, { programId }, { encoding: 'jsonParsed' }]);
  const [balance, legacy, token2022] = await Promise.allSettled([
    rpcCall('getBalance', [address]),
    tokenQuery(TOKEN_PROGRAM),
    tokenQuery(TOKEN_2022_PROGRAM),
  ]);
  if (balance.status === 'rejected' && legacy.status === 'rejected' && token2022.status === 'rejected') {
    return { failed: true, message: balance.reason?.message || 'The X1 RPC did not respond.' };
  }
  const lamports = balance.status === 'fulfilled' ? balance.value?.value : null;
  const byMint = new Map();
  for (const res of [legacy, token2022]) {
    if (res.status !== 'fulfilled') continue;
    for (const account of res.value?.value || []) {
      const info = account?.account?.data?.parsed?.info;
      const mint = info?.mint;
      const amount = Number(info?.tokenAmount?.uiAmountString ?? info?.tokenAmount?.uiAmount);
      if (typeof mint !== 'string' || !Number.isFinite(amount) || amount <= 0) continue;
      byMint.set(mint, (byMint.get(mint) || 0) + amount);
    }
  }
  return {
    failed: false,
    native: isNum(lamports) ? lamports / LAMPORTS_PER_XNT : null,
    tokens: [...byMint].map(([mint, amount]) => ({ mint, amount })),
    partial: balance.status === 'rejected' || legacy.status === 'rejected' || token2022.status === 'rejected',
  };
}

/** @param {{ label?: any, sortKey?: any, sort?: any, onSort?: any, align?: any, className?: any, [key: string]: any }} props */
function SortHeader({ label, sortKey, sort, onSort, align = 'left', className }) {
  const active = sort.key === sortKey;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn(align === 'right' && '!text-right', className)}>
      <button type="button" onClick={() => onSort(sortKey)} className={cn('inline-flex items-center gap-1 rounded hover:text-ink', active && 'text-ink')}>
        {label}
        {active && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3 text-brand" aria-hidden="true" /> : <ArrowDown className="h-3 w-3 text-brand" aria-hidden="true" />)}
      </button>
    </th>
  );
}

/** @param {{ wallet?: any, entry?: any, holdings?: any, hide?: any, sort?: any, onSort?: any, query?: any, onRemove?: any, onRetry?: any, [key: string]: any }} props */
function WalletPanel({ wallet, entry, holdings, hide, sort, onSort, query, onRemove, onRetry }) {
  const hidden = '••••';
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? holdings.filter((h) => `${h.symbol} ${h.name} ${h.mint}`.toLowerCase().includes(q)) : holdings;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const key = { token: (h) => h.symbol.toLowerCase(), balance: (h) => h.amount, price: (h) => h.priceUsd, value: (h) => h.value }[sort.key];
    return [...filtered].sort((a, b) => {
      const av = key(a);
      const bv = key(b);
      // Unknown values always sort last, whatever the direction.
      if (av === null || av === undefined) return bv === null || bv === undefined ? 0 : 1;
      if (bv === null || bv === undefined) return -1;
      return typeof av === 'string' ? dir * av.localeCompare(bv) : dir * (av - bv);
    });
  }, [holdings, sort, query]);

  const priced = holdings.filter((h) => h.value !== null);
  const total = priced.reduce((s, h) => s + h.value, 0);
  const title = wallet.label || shortAddress(wallet.address, 6, 6);

  return (
    <Panel
      title={title}
      actions={(
        <button type="button" onClick={onRemove} aria-label={`Remove wallet ${title}`} className="rounded p-1.5 text-ink-faint transition-colors hover:bg-surface-3 hover:text-negative">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      bodyClassName="p-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-1">
          <span className="mono truncate text-xs text-ink-muted" title={wallet.address}>{shortAddress(wallet.address, 10, 10)}</span>
          <CopyButton value={wallet.address} label="Copy wallet address" />
        </div>
        {entry?.data && (
          <div className="text-right">
            <p className="eyebrow">Value of priced holdings</p>
            <p className="tabular text-lg font-semibold text-brand">{priced.length > 0 ? (hide ? hidden : usd(total)) : <Unavailable reason="None of this wallet's holdings has a price" />}</p>
          </div>
        )}
      </div>

      {!entry ? (
        <div className="space-y-3 p-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-2/3" /></div>
      ) : entry.failed && !entry.data ? (
        <ErrorState title="Could not read this wallet" description={`${entry.message || 'The X1 RPC did not respond.'} Nothing is shown rather than a zero balance.`} onRetry={onRetry} className="py-10" />
      ) : (
        <>
          {(entry.stale || entry.data.partial) && (
            <p role="status" className="border-b border-line bg-warning/10 px-4 py-2.5 text-xs text-ink-soft">
              {entry.stale ? 'The latest refresh failed, so these are the last values that loaded.' : 'Part of this wallet could not be read from the RPC (balance or one token program). Holdings below may be incomplete.'}
            </p>
          )}
          {rows.length === 0 ? (
            <EmptyState icon={Wallet} title={holdings.length === 0 ? 'No holdings found' : 'No holdings match your search'} description={holdings.length === 0 ? 'This wallet has no XNT and no token balances on X1.' : undefined} className="py-10" />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <caption className="sr-only">Holdings of wallet {title}</caption>
                <thead>
                  <tr>
                    <SortHeader label="Token" sortKey="token" sort={sort} onSort={onSort} />
                    <SortHeader label="Balance" sortKey="balance" sort={sort} onSort={onSort} align="right" />
                    <SortHeader label="Price" sortKey="price" sort={sort} onSort={onSort} align="right" className="hidden sm:table-cell" />
                    <SortHeader label="Value" sortKey="value" sort={sort} onSort={onSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((h) => (
                    <tr key={h.mint}>
                      <td>
                        <div className="flex max-w-[44vw] items-center gap-3 sm:max-w-none">
                          <TokenAvatar token={{ mint: h.mint === NATIVE_KEY ? X1_CONFIG.nativeMint : h.mint, symbol: h.symbol, name: h.name, logoUrl: h.logoUrl }} size={28} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">{h.symbol}</span>
                            <span className="block truncate text-xs text-ink-muted">{h.name}</span>
                          </span>
                          {h.known === false && <Pill tone="warning" className="shrink-0">Unlisted</Pill>}
                        </div>
                      </td>
                      <td className="text-right tabular text-ink">{hide ? hidden : formatAmount(h.amount)}</td>
                      <td className="hidden text-right tabular text-ink-soft sm:table-cell">{h.priceUsd !== null ? usd(h.priceUsd) : <Unavailable reason="No price for this token" />}</td>
                      <td className="text-right tabular text-ink">
                        {h.value !== null ? (hide ? hidden : usd(h.value)) : <Unavailable reason="Unavailable: no price for this token, so it is left out of totals" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

export default function PortfolioTracker() {
  const [wallets, setWallets] = useState(readWallets);
  const [newWallet, setNewWallet] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [formError, setFormError] = useState(null);
  const [hide, setHide] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'value', dir: 'desc' });
  const [entries, setEntries] = useState({}); // address -> { data, failed, stale, message }
  const [prices, setPrices] = useState({ status: 'loading', byMint: new Map(), native: null, at: null, stale: false });
  const [loadedAt, setLoadedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const walletsRef = useRef(wallets);
  walletsRef.current = wallets;
  const mounted = useRef(true);

  const loadPrices = useCallback(async () => {
    const [list, native] = await Promise.allSettled([
      api.tokens({ listed: 'true', kind: 'all', limit: 200 }),
      api.tokenPrice(X1_CONFIG.nativeMint),
    ]);
    if (!mounted.current) return;
    setPrices((prev) => {
      if (list.status === 'rejected' && native.status === 'rejected') {
        return prev.status === 'ready' ? { ...prev, stale: true } : { ...prev, status: 'error', stale: false };
      }
      const byMint = list.status === 'fulfilled' && Array.isArray(list.value?.tokens)
        ? new Map(list.value.tokens.filter((t) => t && typeof t.mint === 'string').map((t) => [t.mint, t]))
        : prev.byMint;
      const nativePrice = native.status === 'fulfilled' ? native.value?.data?.priceUsd : null;
      return {
        status: 'ready',
        byMint,
        native: isNum(nativePrice) ? nativePrice : native.status === 'fulfilled' ? null : prev.native,
        at: Date.now(),
        stale: list.status === 'rejected' || native.status === 'rejected',
      };
    });
  }, []);

  const loadWallets = useCallback(async (list, background = false) => {
    if (list.length === 0) return;
    if (background) setRefreshing(true);
    // Wallets are read one after another so a long list never floods the RPC.
    for (const { address } of list) {
      let result;
      try {
        result = await fetchWallet(address);
      } catch (err) {
        result = { failed: true, message: err?.message };
      }
      if (!mounted.current) return;
      setEntries((prev) => {
        const old = prev[address];
        if (result.failed) {
          // A failed refresh keeps the last good data and marks it stale.
          return { ...prev, [address]: old?.data ? { ...old, stale: true } : { failed: true, message: result.message } };
        }
        return { ...prev, [address]: { data: result, failed: false, stale: false } };
      });
    }
    if (mounted.current) {
      setLoadedAt(Date.now());
      setRefreshing(false);
    }
  }, []);

  const refreshAll = useCallback((background = true) => {
    loadPrices();
    loadWallets(walletsRef.current, background);
  }, [loadPrices, loadWallets]);

  useEffect(() => {
    mounted.current = true;
    refreshAll(false);
    const id = setInterval(() => {
      if (!document.hidden) refreshAll(true);
    }, X1_CONFIG.polling.tokensMs);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [refreshAll]);

  const addWallet = (e) => {
    e.preventDefault();
    const address = newWallet.trim();
    if (!BASE58.test(address)) return setFormError('This is not a valid X1 address. Addresses are 32 to 44 characters of base58 (letters and digits, without 0, O, I or l).');
    if (wallets.some((w) => w.address === address)) return setFormError('This wallet is already in your portfolio.');
    if (wallets.length >= MAX_WALLETS) return setFormError(`You can track up to ${MAX_WALLETS} wallets.`);
    const entry = { address, label: newLabel.trim().slice(0, 40) };
    const next = [...wallets, entry];
    setWallets(next);
    writeWallets(next);
    setNewWallet('');
    setNewLabel('');
    setFormError(null);
    loadWallets([entry]);
    return undefined;
  };

  const removeWallet = (address) => {
    const next = wallets.filter((w) => w.address !== address);
    setWallets(next);
    writeWallets(next);
    setEntries((prev) => {
      const copy = { ...prev };
      delete copy[address];
      return copy;
    });
  };

  const onSort = useCallback((key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'token' ? 'asc' : 'desc' }));
  }, []);

  /** Joins raw balances with prices. A holding without a price keeps its amount and has value null. */
  const holdingsFor = useCallback((data) => {
    if (!data) return [];
    const out = [];
    if (isNum(data.native) && data.native > 0) {
      const price = isNum(prices.native) ? prices.native : null;
      out.push({ mint: NATIVE_KEY, symbol: 'XNT', name: 'X1 native token', logoUrl: null, amount: data.native, priceUsd: price, value: price !== null ? data.native * price : null, known: true });
    }
    for (const t of data.tokens) {
      const info = prices.byMint.get(t.mint);
      let price = isNum(info?.priceUsd) ? info.priceUsd : null;
      if (price === null && t.mint === X1_CONFIG.nativeMint && isNum(prices.native)) price = prices.native;
      out.push({
        mint: t.mint,
        symbol: info?.symbol || shortAddress(t.mint, 4, 4),
        name: info?.name || 'Unlisted token',
        logoUrl: info?.logoUrl || null,
        amount: t.amount,
        priceUsd: price,
        value: price !== null ? t.amount * price : null,
        known: !!info,
      });
    }
    return out;
  }, [prices]);

  const summary = useMemo(() => {
    let total = 0;
    let pricedCount = 0;
    let unpriced = 0;
    let ready = 0;
    for (const w of wallets) {
      const data = entries[w.address]?.data;
      if (!data) continue;
      ready += 1;
      for (const h of holdingsFor(data)) {
        if (h.value !== null) {
          total += h.value;
          pricedCount += 1;
        } else {
          unpriced += 1;
        }
      }
    }
    return { total, pricedCount, unpriced, ready };
  }, [wallets, entries, holdingsFor]);

  const loadingWallets = wallets.length > 0 && summary.ready === 0 && wallets.some((w) => !entries[w.address]);

  return (
    <>
      <PageHeader
        icon={Wallet}
        title="Portfolio Tracker"
        description="Track XNT and token balances for wallets you add. Balances are read live from the X1 RPC. Wallet addresses are stored only in this browser and are never sent to X1 Space."
        meta={wallets.length > 0 ? <Freshness at={loadedAt} stale={prices.stale || Object.values(entries).some((e) => e?.stale)} source="X1 RPC + XDEX prices" onRefresh={() => refreshAll(true)} refreshing={refreshing} /> : null}
        actions={wallets.length > 0 ? (
          <button type="button" onClick={() => setHide((h) => !h)} aria-pressed={hide} className={ghostButton}>
            {hide ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            {hide ? 'Show balances' : 'Hide balances'}
          </button>
        ) : null}
      />

      <div className="space-y-6">
        <Panel title="Add a wallet" description={`Up to ${MAX_WALLETS} wallets. Only the public address is needed.`}>
          <form onSubmit={addWallet} noValidate className="p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
              <div>
                <label htmlFor="pf-address" className="mb-1.5 block text-xs font-medium text-ink-muted">Wallet address</label>
                <input
                  id="pf-address"
                  value={newWallet}
                  onChange={(e) => { setNewWallet(e.target.value); setFormError(null); }}
                  maxLength={44}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="X1 wallet address"
                  aria-invalid={!!formError}
                  aria-describedby={formError ? 'pf-error' : undefined}
                  className={cn(inputClass, 'mono')}
                />
              </div>
              <div>
                <label htmlFor="pf-label" className="mb-1.5 block text-xs font-medium text-ink-muted">Label (optional)</label>
                <input id="pf-label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} maxLength={40} autoComplete="off" placeholder="e.g. Main wallet" className={inputClass} />
              </div>
              <button type="submit" disabled={!newWallet.trim()} className={primaryButton}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add wallet
              </button>
            </div>
            {formError && <p id="pf-error" role="alert" className="mt-2 text-xs text-negative">{formError}</p>}
          </form>
        </Panel>

        {wallets.length === 0 ? (
          <Panel>
            <EmptyState icon={Wallet} title="No wallets added yet" description="Add a wallet address above to see its XNT and token balances." />
          </Panel>
        ) : (
          <>
            <section aria-label="Portfolio summary" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <StatCard
                label="Value of priced holdings"
                tone="brand"
                value={loadingWallets ? <Skeleton className="h-7 w-28" /> : summary.ready === 0 ? <Unavailable reason="No wallet has loaded yet" /> : summary.pricedCount === 0 ? <Unavailable reason="None of the holdings has a price" /> : hide ? '••••' : usd(summary.total)}
                hint="Holdings without a price are left out of this total."
                className="col-span-2 lg:col-span-1"
              />
              <StatCard label="Wallets" value={integer(wallets.length)} hint={summary.ready < wallets.length ? `${integer(summary.ready)} loaded` : undefined} />
              <StatCard
                label="Holdings without a price"
                value={summary.ready === 0 ? <Unavailable reason="No wallet has loaded yet" /> : integer(summary.unpriced)}
                hint={prices.status === 'error' ? 'Price data could not be loaded.' : 'Shown with their amount; value Unavailable.'}
                tone={summary.unpriced > 0 ? 'warning' : 'default'}
              />
            </section>

            {prices.status === 'error' && (
              <p role="status" className="rounded-lg border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-ink-soft">
                Token prices could not be loaded, so every holding shows its amount with an unavailable value. Prices are retried automatically.
              </p>
            )}

            <div className="relative sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={64}
                aria-label="Search holdings by symbol, name or mint"
                placeholder="Search holdings"
                className={cn(inputClass, 'pl-9')}
              />
            </div>

            {wallets.map((w) => {
              const entry = entries[w.address];
              return (
                <WalletPanel
                  key={w.address}
                  wallet={w}
                  entry={entry}
                  holdings={holdingsFor(entry?.data)}
                  hide={hide}
                  sort={sort}
                  onSort={onSort}
                  query={query}
                  onRemove={() => removeWallet(w.address)}
                  onRetry={() => loadWallets([w], true)}
                />
              );
            })}
            <p className="text-xs text-ink-faint">
              Value of priced holdings uses XDEX market prices for listed tokens and the XNT price for native XNT. A price reflects a DEX market, not a guaranteed sale value. Staked XNT is not included.
            </p>
          </>
        )}
      </div>
    </>
  );
}
