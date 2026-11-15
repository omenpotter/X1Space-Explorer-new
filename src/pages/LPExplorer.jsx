import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Droplets, ExternalLink, Search, X } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { TokenAvatar } from '@/components/ds/Avatar';
import { CopyButton, Freshness, Panel, StatCard } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, Skeleton, TableSkeleton, Unavailable } from '@/components/ds/States';
import { api } from '@/lib/x1/api';
import { X1_CONFIG } from '@/lib/x1/config';
import { integer, percent, shortAddress, usd } from '@/lib/format';
import { cn } from '@/lib/utils';

const POOL_LIMIT = 500;
const PAGE_SIZE = 50;

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

/** Accepts an ISO string, epoch seconds or epoch milliseconds. Returns ms or null. */
function toTime(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? (value < 1e12 ? value * 1000 : value) : null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

const COLUMNS = [
  { key: 'tvlUsd', label: 'TVL', className: '', get: (p) => p.tvlUsd },
  { key: 'txns24h', label: '24h txns', className: 'hidden sm:table-cell', get: (p) => p.txns24h },
  { key: 'apr24h', label: '24h fee APR (XDEX)', className: 'hidden md:table-cell', get: (p) => p.apr24h },
  { key: 'lpHolders', label: 'LP holders', className: 'hidden lg:table-cell', get: (p) => p.lpHolders },
  { key: 'createdAt', label: 'Created', className: 'hidden xl:table-cell', get: (p) => toTime(p.createdAt) },
];

function tokenOf(t) {
  return { mint: t?.mint, symbol: t?.symbol, name: t?.symbol, logoUrl: t?.logo };
}

function pairLabel(p) {
  if (p.pair) return p.pair;
  const a = p.token1?.symbol;
  const b = p.token2?.symbol;
  return a || b ? `${a || '?'}/${b || '?'}` : 'Unnamed pair';
}

function Stat({ loading, value, format, reason }) {
  if (loading) return <Skeleton className="h-7 w-24" />;
  return isNum(value) ? format(value) : <Unavailable reason={reason} />;
}

export default function LPExplorer() {
  const [state, setState] = useState({ status: 'loading', pools: [], meta: null, stats: null, statsMeta: null, error: null, refreshFailed: false });
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'tvlUsd', dir: 'desc' });
  const [page, setPage] = useState(0);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setState((s) => ({ ...s, status: 'loading', error: null }));
    const [poolsRes, statsRes] = await Promise.allSettled([api.pools({ limit: POOL_LIMIT, offset: 0 }), api.poolStats()]);
    setState((s) => {
      if (poolsRes.status === 'rejected') {
        // A failed background refresh keeps the last good data on screen and marks it stale.
        if (background && s.status === 'ready') return { ...s, refreshFailed: true };
        return { status: 'error', pools: [], meta: null, stats: null, statsMeta: null, error: poolsRes.reason?.message || 'The pool list could not be loaded.', refreshFailed: false };
      }
      const data = poolsRes.value;
      const statsOk = statsRes.status === 'fulfilled';
      return {
        status: 'ready',
        pools: Array.isArray(data.pools) ? data.pools : [],
        meta: { stale: !!data.stale, fetchedAt: data.fetchedAt, count: data.count },
        // Stats that fail to refresh keep their last value; on first load they stay unknown.
        stats: statsOk ? statsRes.value.stats || null : s.stats,
        statsMeta: statsOk ? { stale: !!statsRes.value.stale, failed: false } : { stale: true, failed: true },
        error: null,
        refreshFailed: false,
      };
    });
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (!document.hidden) load(true);
    }, X1_CONFIG.polling.tokensMs);
    return () => clearInterval(id);
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? state.pools.filter((p) =>
          [p.pair, p.token1?.symbol, p.token2?.symbol].some((v) => typeof v === 'string' && v.toLowerCase().includes(q)) ||
          // Addresses are case-sensitive, so they are matched exactly as typed.
          [p.address, p.lpMint, p.token1?.mint, p.token2?.mint].some((v) => typeof v === 'string' && v.includes(search.trim())))
      : state.pools;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const column = COLUMNS.find((c) => c.key === sort.key);
    return [...rows].sort((a, b) => {
      if (sort.key === 'pair') return dir * pairLabel(a).localeCompare(pairLabel(b));
      const av = column?.get(a);
      const bv = column?.get(b);
      // Unknown values always sort last, whichever direction is chosen.
      if (!isNum(av) && !isNum(bv)) return 0;
      if (!isNum(av)) return 1;
      if (!isNum(bv)) return -1;
      return dir * (av - bv);
    });
  }, [state.pools, search, sort]);

  useEffect(() => {
    setPage(0);
  }, [search, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const sortBy = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  const ariaSort = (key) => (sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
  const arrow = (key) => sort.key === key && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />);

  const stats = state.stats;
  const statsLoading = state.status === 'loading';
  const statsReason = state.statsMeta?.failed ? 'XDEX pool statistics could not be loaded' : 'Not reported by XDEX';
  const stale = state.refreshFailed || !!state.meta?.stale || !!state.statsMeta?.stale;

  return (
    <>
      <PageHeader
        icon={Droplets}
        title="Liquidity Pools"
        description="Liquidity pools on X1 mainnet as reported by XDEX: value locked, activity and fee yield for each pair."
        meta={<Freshness at={state.meta?.fetchedAt} stale={stale} source="XDEX" onRefresh={() => load(true)} refreshing={refreshing} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total value locked" tone="brand" value={<Stat loading={statsLoading} value={stats?.tvlUsd} format={usd} reason={statsReason} />} hint="XDEX, all pools" />
        <StatCard label="Volume 24h" value={<Stat loading={statsLoading} value={stats?.volume24hUsd} format={usd} reason={statsReason} />} hint="XDEX, all pools" />
        <StatCard
          label="Pools listed"
          value={<Stat loading={statsLoading} value={stats?.poolsCount ?? (state.status === 'ready' ? state.pools.length : null)} format={integer} reason={statsReason} />}
          hint={state.status === 'ready' ? `${integer(state.pools.length)} shown here (largest by TVL)` : undefined}
        />
        <StatCard label="LP holders" value={<Stat loading={statsLoading} value={stats?.totalHolders} format={integer} reason={statsReason} />} hint="LP token accounts, all pools" />
      </div>

      <Panel bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={64}
              placeholder="Search pair, token or address"
              aria-label="Search pools by pair, token symbol or address"
              className="h-9 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-8 text-sm text-ink placeholder:text-ink-faint focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/25"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-ink">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          {state.status === 'ready' && (
            <p className="text-xs text-ink-muted" aria-live="polite">
              {search.trim() ? `${integer(filtered.length)} of ${integer(state.pools.length)} pools` : `${integer(state.pools.length)} pools`}
            </p>
          )}
        </div>

        {state.status === 'loading' && <TableSkeleton rows={10} columns={5} />}
        {state.status === 'error' && <ErrorState title="Pool data is unavailable" description={state.error} onRetry={() => load()} />}
        {state.status === 'ready' && state.pools.length === 0 && (
          <EmptyState icon={Droplets} title="No pools reported" description="XDEX did not report any liquidity pools on X1 mainnet." />
        )}
        {state.status === 'ready' && state.pools.length > 0 && filtered.length === 0 && (
          <EmptyState title="No pools match" description={`Nothing matches "${search.trim()}". Search covers pair names, token symbols and exact pool, LP mint or token addresses.`} />
        )}

        {state.status === 'ready' && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">XDEX liquidity pools on X1 mainnet, sorted by {sort.key}, {sort.dir === 'desc' ? 'descending' : 'ascending'}</caption>
              <thead>
                <tr>
                  <th scope="col" aria-sort={ariaSort('pair')}>
                    <button type="button" onClick={() => sortBy('pair')} className="inline-flex items-center gap-1 uppercase tracking-[0.08em] hover:text-ink">
                      Pool {arrow('pair')}
                    </button>
                  </th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} scope="col" className={cn('!text-right', c.className)} aria-sort={ariaSort(c.key)}>
                      <button type="button" onClick={() => sortBy(c.key)} className="inline-flex items-center gap-1 uppercase tracking-[0.08em] hover:text-ink">
                        {c.label} {arrow(c.key)}
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="!text-right">Links</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const created = toTime(p.createdAt);
                  const label = pairLabel(p);
                  const canTrade = p.token1?.mint && p.token2?.mint;
                  return (
                    <tr key={p.address}>
                      <td>
                        <div className="flex max-w-[58vw] items-center gap-3 sm:max-w-none">
                          <span className="flex shrink-0 -space-x-2">
                            <TokenAvatar token={tokenOf(p.token1)} size={28} />
                            <TokenAvatar token={tokenOf(p.token2)} size={28} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">{label}</span>
                            <span className="flex items-center gap-1 text-xs text-ink-faint">
                              <span className="mono">{shortAddress(p.address, 6, 6)}</span>
                              {p.address && <CopyButton value={p.address} label={`Copy ${label} pool address`} />}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="text-right tabular text-ink">{isNum(p.tvlUsd) ? usd(p.tvlUsd) : <Unavailable reason="TVL not reported by XDEX" />}</td>
                      <td className="hidden text-right tabular text-ink-soft sm:table-cell">{isNum(p.txns24h) ? integer(p.txns24h) : <Unavailable reason="24h transaction count not reported by XDEX" />}</td>
                      <td className="hidden text-right tabular text-ink-soft md:table-cell">{isNum(p.apr24h) ? percent(p.apr24h) : <Unavailable reason="24h fee APR not reported by XDEX" />}</td>
                      <td className="hidden text-right tabular text-ink-soft lg:table-cell">{isNum(p.lpHolders) ? integer(p.lpHolders) : <Unavailable reason="LP holder count not reported by XDEX" />}</td>
                      <td className="hidden text-right tabular text-ink-muted xl:table-cell">
                        {created ? <time dateTime={new Date(created).toISOString()}>{new Date(created).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</time> : <Unavailable reason="Creation date not reported by XDEX" />}
                      </td>
                      <td className="text-right">
                        <span className="inline-flex items-center justify-end gap-1">
                          <a
                            href={`${X1_CONFIG.explorerUrl}/address/${p.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`View ${label} pool on X1 Explorer`}
                            className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-ink-soft transition-colors hover:bg-surface-3 hover:text-ink"
                          >
                            <span className="hidden sm:inline">Explorer</span>
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                          {canTrade && (
                            <a
                              href={`${X1_CONFIG.xdexSwapUrl}?inputMint=${encodeURIComponent(p.token1.mint)}&outputMint=${encodeURIComponent(p.token2.mint)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Trade ${label} on XDEX`}
                              className="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand/10 px-2 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand/20"
                            >
                              XDEX
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {state.status === 'ready' && filtered.length > PAGE_SIZE && (
          <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-ink-muted">
            <span>
              {integer(current * PAGE_SIZE + 1)}–{integer(Math.min(filtered.length, (current + 1) * PAGE_SIZE))} of {integer(filtered.length)}
            </span>
            <span className="flex items-center gap-2">
              <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded-md border border-line px-2.5 py-1.5 text-ink transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40">
                Previous
              </button>
              <span aria-current="page">Page {current + 1} of {integer(pages)}</span>
              <button type="button" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)} className="rounded-md border border-line px-2.5 py-1.5 text-ink transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40">
                Next
              </button>
            </span>
          </nav>
        )}
      </Panel>

      <p className="mt-4 text-xs text-ink-faint">
        All figures are reported by XDEX and are not recalculated by X1 Space. The 24h fee APR annualises the trading fees a pool earned over the last 24 hours;
        it is a snapshot, not a forecast. The list holds the {integer(POOL_LIMIT)} largest pools by value locked. Per-pool trade history is not connected.
      </p>
    </>
  );
}
