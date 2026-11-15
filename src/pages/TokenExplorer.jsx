import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Coins, ExternalLink, Search, ShieldAlert, ShieldCheck, Star, X } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import PageHeader from '@/components/shell/PageHeader';
import { TokenAvatar } from '@/components/ds/Avatar';
import { CopyButton, Freshness, Meter, Panel, Pill, StatCard } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, Skeleton, TableSkeleton, Unavailable } from '@/components/ds/States';
import { api } from '@/lib/x1/api';
import { X1_CONFIG } from '@/lib/x1/config';
import { compact, integer, percent, shortAddress, usd } from '@/lib/format';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;
const KINDS = [
  { value: 'fungible', label: 'Tokens' },
  { value: 'nft', label: 'NFTs' },
  { value: 'lp', label: 'LP tokens' },
  { value: 'all', label: 'All mints' },
];
const PROGRAMS = [
  { value: 'all', label: 'All programs' },
  { value: 'spl-token', label: 'SPL Token' },
  { value: 'token-2022', label: 'Token-2022' },
];
const COLUMNS = [
  { key: 'price', label: 'Price', className: '' },
  { key: 'change', label: '24h', className: 'hidden md:table-cell' },
  { key: 'liquidity', label: 'Liquidity', className: 'hidden sm:table-cell' },
  { key: 'volume', label: 'Volume 24h', className: 'hidden lg:table-cell' },
  { key: 'marketCap', label: 'Market cap', className: 'hidden md:table-cell' },
  { key: 'supply', label: 'Supply', className: 'hidden xl:table-cell' },
];
const SOURCE_LABEL = { chain: 'On-chain index', xdex: 'XDEX', x1ninja: 'X1 Ninja' };
const SOURCE_TEXT = {
  ok: ['positive', 'live'],
  stale: ['warning', 'stale'],
  error: ['negative', 'unavailable'],
  not_configured: ['neutral', 'not connected'],
};

function readWatchlist() {
  try {
    const v = JSON.parse(localStorage.getItem('x1_token_watchlist') || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function Change({ value, reason }) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return <Unavailable reason={reason} />;
  const up = value > 0;
  const flat = value === 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 tabular', flat ? 'text-ink-muted' : up ? 'text-positive' : 'text-negative')}>
      {!flat && (up ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />)}
      {percent(Math.abs(value))}
      <span className="sr-only">{flat ? 'no change' : up ? 'up' : 'down'}</span>
    </span>
  );
}

function ProgramPill({ program }) {
  if (program === 'token-2022') return <Pill tone="violet">Token-2022</Pill>;
  if (program === 'spl-token') return <Pill>SPL</Pill>;
  return null;
}

function SourcePills({ sources }) {
  if (!sources) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {Object.entries(SOURCE_LABEL).map(([key, label]) => {
        const s = sources[key];
        if (!s) return null;
        const [tone, text] = SOURCE_TEXT[s.status] || SOURCE_TEXT.error;
        const title = key === 'x1ninja' && s.status === 'not_configured'
          ? 'X1 Ninja market data (24h change, holder counts, candles) is not connected. It needs a server-side API key.'
          : `${label}: ${text}`;
        return (
          <Pill key={key} tone={tone} title={title}>
            {label}: {text}
          </Pill>
        );
      })}
    </div>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{children}</dd>
    </div>
  );
}

function AddressValue({ value }) {
  if (value === undefined) return <Unavailable reason="Could not be read from chain" />;
  if (value === null) return <span className="text-ink-muted">None</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <a href={`${X1_CONFIG.explorerUrl}/address/${value}`} target="_blank" rel="noopener noreferrer" className="mono text-brand hover:underline">
        {shortAddress(value, 6, 6)}
      </a>
      <CopyButton value={value} label="Copy address" />
    </span>
  );
}

function TokenDetail({ mint, onClose }) {
  const [state, setState] = useState({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const [detail, analysis] = await Promise.all([api.token(mint), api.tokenAnalysis(mint).catch(() => null)]);
      setState({ status: 'ready', token: detail.token, analysis: analysis?.analysis || null, stale: detail.stale });
    } catch (err) {
      setState({ status: err.status === 404 ? 'missing' : 'error', message: err.message });
    }
  }, [mint]);

  useEffect(() => {
    load();
  }, [load]);

  const t = state.token;
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto border-line bg-surface-1 p-0 sm:max-w-xl">
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface-1/95 px-5 py-4 backdrop-blur">
          {t ? <TokenAvatar token={t} size={40} /> : <Skeleton className="h-10 w-10 rounded-full" />}
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate font-display text-lg font-semibold text-ink">
              {t ? t.name || t.symbol || 'Unnamed token' : 'Token details'}
            </SheetTitle>
            <SheetDescription className="flex items-center gap-1 text-xs text-ink-muted">
              <span className="mono">{shortAddress(mint, 8, 8)}</span>
              <CopyButton value={mint} label="Copy mint address" />
            </SheetDescription>
          </div>
        </div>

        {state.status === 'loading' && (
          <div className="space-y-4 p-5" role="status" aria-label="Loading token">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}
        {state.status === 'missing' && <EmptyState title="No token at this address" description="This address is not a token mint on X1 mainnet." />}
        {state.status === 'error' && <ErrorState description={state.message} onRetry={load} />}

        {state.status === 'ready' && (
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-center gap-1.5">
              {t.symbol && <Pill tone="brand">{t.symbol}</Pill>}
              <ProgramPill program={t.program} />
              {t.listed ? <Pill tone="positive">Listed on a DEX</Pill> : <Pill>No DEX market</Pill>}
              {t.kind === 'nft' && <Pill>NFT-like (supply 1, 0 decimals)</Pill>}
              {t.kind === 'lp' && <Pill>Liquidity pool token</Pill>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-line bg-surface-2 p-3">
                <p className="eyebrow">Price</p>
                <p className="mt-1 font-display text-xl font-semibold tabular">{t.priceUsd === null ? <Unavailable reason="No DEX market for this token" /> : usd(t.priceUsd)}</p>
                <p className="mt-1 text-xs"><Change value={t.priceChange24h} reason="No 24h change available for this token" /> <span className="text-ink-faint">24h</span></p>
              </div>
              <div className="rounded-lg border border-line bg-surface-2 p-3">
                <p className="eyebrow">Market cap</p>
                <p className="mt-1 font-display text-xl font-semibold tabular">{t.marketCapUsd === null ? <Unavailable reason="Needs both a price and an on-chain supply" /> : usd(t.marketCapUsd)}</p>
                <p className="mt-1 text-xs text-ink-faint">{t.marketCapSource === 'supply x price' ? 'Total supply × price' : t.marketCapSource === 'x1ninja' ? 'Reported by X1 Ninja' : 'Not available'}</p>
              </div>
            </div>

            {t.description && <p className="text-sm leading-relaxed text-ink-soft">{t.description}</p>}

            <section aria-labelledby="td-onchain">
              <h3 id="td-onchain" className="eyebrow mb-1">On-chain facts</h3>
              <dl className="divide-y divide-line/60">
                <DetailRow label="Total supply">{t.supply === null ? <Unavailable reason="Supply could not be read from chain" /> : <span className="tabular">{compact(t.supply)}{t.symbol ? ` ${t.symbol}` : ''}</span>}</DetailRow>
                <DetailRow label="Decimals">{t.decimals ?? <Unavailable />}</DetailRow>
                <DetailRow label="Mint authority"><AddressValue value={t.mintAuthority} /></DetailRow>
                <DetailRow label="Freeze authority"><AddressValue value={t.freezeAuthority} /></DetailRow>
                {t.extensions?.length > 0 && <DetailRow label="Token-2022 extensions"><span className="text-xs">{t.extensions.join(', ')}</span></DetailRow>}
                <DetailRow label="Name and symbol source">{{ 'token-2022': 'Token-2022 metadata', metaplex: 'Metaplex metadata', xdex: 'XDEX listing', x1ninja: 'X1 Ninja listing' }[t.metadataSource] || <span className="text-ink-muted">None published</span>}</DetailRow>
              </dl>
            </section>

            <section aria-labelledby="td-market">
              <h3 id="td-market" className="eyebrow mb-1">Market</h3>
              <dl className="divide-y divide-line/60">
                <DetailRow label="Pool liquidity (TVL)">{t.liquidityUsd === null ? <Unavailable reason="No DEX pool" /> : usd(t.liquidityUsd)}</DetailRow>
                <DetailRow label="Volume 24h">{t.volume24hUsd === null ? <Unavailable reason="No DEX pool" /> : usd(t.volume24hUsd)}</DetailRow>
                <DetailRow label="Holders">{t.holders === null ? <Unavailable reason="Holder counts need X1 Ninja market data, which is not connected" /> : integer(t.holders)}</DetailRow>
                {t.priceChanges && (
                  <DetailRow label="Price change">
                    <span className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs">
                      {[['5m', 'm5'], ['1h', 'h1'], ['6h', 'h6'], ['24h', 'h24']].map(([label, key]) => (
                        <span key={key}><span className="text-ink-faint">{label} </span><Change value={t.priceChanges[key]} /></span>
                      ))}
                    </span>
                  </DetailRow>
                )}
              </dl>
            </section>

            {state.analysis && (
              <section aria-labelledby="td-risk" className="rounded-lg border border-line bg-surface-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 id="td-risk" className="flex items-center gap-2 text-sm font-medium text-ink">
                    {state.analysis.risk_level === 'Low' ? <ShieldCheck className="h-4 w-4 text-positive" aria-hidden="true" /> : <ShieldAlert className="h-4 w-4 text-warning" aria-hidden="true" />}
                    Risk review
                  </h3>
                  <Pill tone={state.analysis.risk_level === 'Low' ? 'positive' : state.analysis.risk_level === 'Medium' ? 'warning' : 'negative'}>
                    {state.analysis.risk_level} risk · {state.analysis.health_score}/10
                  </Pill>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {state.analysis.findings.map((f, i) => (
                    <li key={i} className="flex gap-2 text-ink-soft">
                      <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', f.level === 'risk' ? 'bg-negative' : f.level === 'warn' ? 'bg-warning' : 'bg-positive')} aria-hidden="true" />
                      <span><span className="sr-only">{f.level}: </span>{f.text}</span>
                    </li>
                  ))}
                </ul>
                {state.analysis.not_assessed?.length > 0 && <p className="mt-2 text-xs text-ink-faint">Not assessed: {state.analysis.not_assessed.join(', ')}.</p>}
                <p className="mt-3 text-xs text-ink-faint">{state.analysis.method}</p>
              </section>
            )}

            {Array.isArray(t.largestHolders) && t.largestHolders.length > 0 && (
              <section aria-labelledby="td-holders">
                <h3 id="td-holders" className="eyebrow mb-2">Largest token accounts</h3>
                <ol className="space-y-2">
                  {t.largestHolders.map((h, i) => (
                    <li key={h.address} className="text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">
                          <span className="w-4 text-xs text-ink-faint">{i + 1}</span>
                          <a href={`${X1_CONFIG.explorerUrl}/address/${h.address}`} target="_blank" rel="noopener noreferrer" className="mono text-ink-soft hover:text-brand">{shortAddress(h.address, 6, 6)}</a>
                        </span>
                        <span className="tabular text-ink-muted">{compact(h.amount)}{h.share !== null && <span className="ml-2 text-ink">{percent(h.share * 100, 1)}</span>}</span>
                      </div>
                      {h.share !== null && <Meter value={h.share * 100} tone={h.share > 0.5 ? 'negative' : h.share > 0.2 ? 'warning' : 'brand'} label={`Share held by account ${i + 1}`} className="mt-1.5" />}
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-ink-faint">Token accounts, not people: pools, vaults and exchanges appear here too.</p>
              </section>
            )}

            {t.pools?.length > 0 && (
              <section aria-labelledby="td-pools">
                <h3 id="td-pools" className="eyebrow mb-2">Liquidity pools (XDEX)</h3>
                <ul className="divide-y divide-line/60 rounded-lg border border-line">
                  {t.pools.map((p) => (
                    <li key={p.address} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <span>
                        <span className="font-medium text-ink">{t.symbol || '?'}/{p.pairedSymbol || '?'}</span>
                        <span className="mono ml-2 text-xs text-ink-faint">{shortAddress(p.address)}</span>
                      </span>
                      <span className="tabular text-ink-muted">{p.tvlUsd === null ? <Unavailable /> : `${usd(p.tvlUsd)} TVL`}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <a href={`${X1_CONFIG.explorerUrl}/address/${mint}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-3">
                X1 Explorer <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              {t.listed && (
                <a href={`${X1_CONFIG.xdexSwapUrl}?inputMint=${X1_CONFIG.nativeMint}&outputMint=${mint}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-strong">
                  Trade on XDEX <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
            <Freshness at={t.fetchedAt} stale={state.stale} source="X1 RPC + XDEX" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function TokenExplorer() {
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(params.get('q') || '');
  const [query, setQuery] = useState({
    q: params.get('q') || '',
    kind: 'fungible',
    program: 'all',
    listed: false,
    sort: 'liquidity',
    dir: 'desc',
    page: 0,
  });
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [refreshing, setRefreshing] = useState(false);
  const [watchlist, setWatchlist] = useState(readWatchlist);
  const selected = params.get('mint');
  const requestId = useRef(0);

  const load = useCallback(async (q, { background = false } = {}) => {
    const id = ++requestId.current;
    if (background) setRefreshing(true);
    else setState((s) => ({ ...s, status: s.data ? 'updating' : 'loading' }));
    try {
      const data = await api.tokens({
        q: q.q, kind: q.kind, program: q.program, listed: q.listed ? 'true' : undefined,
        sort: q.sort, dir: q.dir, limit: PAGE_SIZE, offset: q.page * PAGE_SIZE,
      });
      if (id === requestId.current) setState({ status: 'ready', data, error: null });
    } catch (err) {
      // A failed background refresh keeps the last good data on screen and marks it stale.
      if (id === requestId.current) setState((s) => ({ status: s.data && background ? 'ready' : 'error', data: background ? s.data : null, error: err.message, refreshFailed: background }));
    } finally {
      if (id === requestId.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(query);
  }, [query, load]);

  // Refresh in the background while the tab is visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) load(query, { background: true });
    }, X1_CONFIG.polling.tokensMs);
    return () => clearInterval(id);
  }, [query, load]);

  // Debounced search.
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery((q) => (q.q === input.trim() ? q : { ...q, q: input.trim(), page: 0 }));
    }, 300);
    return () => clearTimeout(id);
  }, [input]);

  const update = (patch) => setQuery((q) => ({ ...q, page: 0, ...patch }));
  const sortBy = (key) => setQuery((q) => ({ ...q, page: 0, sort: key, dir: q.sort === key && q.dir === 'desc' ? 'asc' : 'desc' }));
  const openToken = (mint) => {
    const next = new URLSearchParams(params);
    if (mint) next.set('mint', mint);
    else next.delete('mint');
    setParams(next, { replace: !mint });
  };
  const toggleWatch = (mint) => {
    setWatchlist((w) => {
      const next = w.includes(mint) ? w.filter((m) => m !== mint) : [...w, mint];
      try {
        localStorage.setItem('x1_token_watchlist', JSON.stringify(next));
      } catch {
        // Storage unavailable: the star still works for this visit.
      }
      return next;
    });
  };

  const data = state.data;
  const summary = data?.summary;
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const ninjaOff = data?.sources?.x1ninja?.status !== 'ok';
  const changeReason = ninjaOff ? '24h change needs X1 Ninja market data, which is not connected' : 'No 24h change reported for this token';
  const anyStale = useMemo(() => !!data && (state.refreshFailed || Object.values(data.sources || {}).some((s) => s.status === 'stale')), [data, state.refreshFailed]);

  return (
    <>
      <PageHeader
        icon={Coins}
        title="Token Explorer"
        description="Every token mint on X1 mainnet, discovered on chain (SPL Token and Token-2022). Market data is shown only for tokens that trade on a DEX."
        meta={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Freshness at={data?.fetchedAt} stale={anyStale} onRefresh={() => load(query, { background: true })} refreshing={refreshing} />
            <SourcePills sources={data?.sources} />
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Token mints indexed" value={data ? integer(data.indexed) : <Skeleton className="h-7 w-24" />} hint={summary ? `${integer(summary.fungible)} fungible · ${integer(summary.nft)} NFT-like` : undefined} tone="brand" />
        <StatCard label="Listed on a DEX" value={summary ? integer(summary.listed) : <Skeleton className="h-7 w-16" />} hint={summary?.pools != null ? `${integer(summary.pools)} XDEX pools` : undefined} />
        <StatCard label="Total pool liquidity" value={summary ? usd(summary.tvlUsd) : <Skeleton className="h-7 w-24" />} hint="XDEX, all pools" />
        <StatCard label="DEX volume 24h" value={summary ? usd(summary.volume24hUsd) : <Skeleton className="h-7 w-24" />} hint="XDEX, all pools" />
      </div>

      <Panel bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={64}
              placeholder="Search name, symbol or mint address"
              aria-label="Search tokens by name, symbol or mint address"
              className="h-9 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-8 text-sm text-ink placeholder:text-ink-faint focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/25"
            />
            {input && (
              <button type="button" onClick={() => setInput('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-ink">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Token type" className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
              {KINDS.map((k) => (
                <button key={k.value} type="button" aria-pressed={query.kind === k.value} onClick={() => update({ kind: k.value })} className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors', query.kind === k.value ? 'bg-surface-3 text-ink' : 'text-ink-muted hover:text-ink')}>
                  {k.label}
                </button>
              ))}
            </div>
            <select value={query.program} onChange={(e) => update({ program: e.target.value })} aria-label="Token program" className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand/25">
              {PROGRAMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 text-xs text-ink-soft">
              <input type="checkbox" checked={query.listed} onChange={(e) => update({ listed: e.target.checked })} className="h-3.5 w-3.5 accent-[hsl(var(--brand))]" />
              With a market only
            </label>
          </div>
        </div>

        {state.status === 'loading' && <TableSkeleton rows={10} columns={6} />}
        {state.status === 'error' && <ErrorState description={state.error} onRetry={() => load(query)} />}
        {data && state.status !== 'error' && total === 0 && (
          <EmptyState
            title="No tokens match"
            description={query.q ? `Nothing matches "${query.q}" with the current filters. Search covers on-chain names, symbols and mint addresses.` : 'No tokens match the current filters.'}
          />
        )}

        {data && state.status !== 'error' && total > 0 && (
          <div className={cn('overflow-x-auto transition-opacity', state.status === 'updating' && 'opacity-60')} aria-busy={state.status === 'updating'}>
            <table className="data-table">
              <caption className="sr-only">Tokens on X1 mainnet, sorted by {query.sort}, {query.dir === 'desc' ? 'descending' : 'ascending'}</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-10 !px-2"><span className="sr-only">Watchlist</span></th>
                  <th scope="col" aria-sort={query.sort === 'name' ? (query.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" onClick={() => sortBy('name')} className="inline-flex items-center gap-1 uppercase tracking-[0.08em] hover:text-ink">
                      Token {query.sort === 'name' && (query.dir === 'asc' ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />)}
                    </button>
                  </th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} scope="col" className={cn('!text-right', c.className)} aria-sort={query.sort === c.key ? (query.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => sortBy(c.key)} className="inline-flex items-center gap-1 uppercase tracking-[0.08em] hover:text-ink">
                        {c.label} {query.sort === c.key && (query.dir === 'asc' ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.tokens.map((t) => {
                  const watched = watchlist.includes(t.mint);
                  const noMarket = 'No DEX market for this token';
                  return (
                    <tr key={t.mint} className="cursor-pointer" onClick={() => openToken(t.mint)}>
                      <td className="!px-2">
                        <button type="button" aria-pressed={watched} aria-label={watched ? `Remove ${t.symbol || 'token'} from watchlist` : `Add ${t.symbol || 'token'} to watchlist`} onClick={(e) => { e.stopPropagation(); toggleWatch(t.mint); }} className="rounded p-1.5 text-ink-faint transition-colors hover:text-warning">
                          <Star className={cn('h-4 w-4', watched && 'fill-warning text-warning')} aria-hidden="true" />
                        </button>
                      </td>
                      <td>
                        <button type="button" onClick={(e) => { e.stopPropagation(); openToken(t.mint); }} className="flex max-w-[52vw] items-center gap-3 rounded text-left sm:max-w-none">
                          <TokenAvatar token={t} size={32} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-medium text-ink">{t.name || t.symbol || <span className="text-ink-muted">Unnamed token</span>}</span>
                              {t.symbol && t.name && <span className="shrink-0 text-xs text-ink-muted">{t.symbol}</span>}
                              <span className="hidden shrink-0 sm:inline"><ProgramPill program={t.program} /></span>
                            </span>
                            <span className="mono block text-xs text-ink-faint">{shortAddress(t.mint, 6, 6)}</span>
                          </span>
                        </button>
                      </td>
                      <td className="text-right tabular text-ink">{t.priceUsd === null ? <Unavailable reason={noMarket} /> : usd(t.priceUsd)}</td>
                      <td className="hidden text-right md:table-cell">{t.priceUsd === null ? <Unavailable reason={noMarket} /> : <Change value={t.priceChange24h} reason={changeReason} />}</td>
                      <td className="hidden text-right tabular text-ink-soft sm:table-cell">{t.liquidityUsd === null ? <Unavailable reason={noMarket} /> : usd(t.liquidityUsd)}</td>
                      <td className="hidden text-right tabular text-ink-soft lg:table-cell">{t.volume24hUsd === null ? <Unavailable reason={noMarket} /> : usd(t.volume24hUsd)}</td>
                      <td className="hidden text-right tabular text-ink-soft md:table-cell">{t.marketCapUsd === null ? <Unavailable reason="Needs both a price and an on-chain supply" /> : usd(t.marketCapUsd)}</td>
                      <td className="hidden text-right tabular text-ink-muted xl:table-cell">{t.supply === null ? <Unavailable reason="Supply not available" /> : compact(t.supply)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && total > 0 && state.status !== 'error' && (
          <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-ink-muted">
            <span>
              {integer(query.page * PAGE_SIZE + 1)}–{integer(Math.min(total, (query.page + 1) * PAGE_SIZE))} of {integer(total)}
            </span>
            <span className="flex items-center gap-2">
              <button type="button" disabled={query.page === 0} onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))} className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-ink transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40">
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> Previous
              </button>
              <span aria-current="page">Page {query.page + 1} of {integer(pages)}</span>
              <button type="button" disabled={query.page + 1 >= pages} onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))} className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-ink transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40">
                Next <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          </nav>
        )}
      </Panel>

      <p className="mt-4 text-xs text-ink-faint">
        Names and symbols are published by token creators and are not verified by X1 Space. Liquidity is the combined value of the XDEX pools a token trades in.
        Market cap is total on-chain supply multiplied by the latest pool price.
      </p>

      {selected && <TokenDetail key={selected} mint={selected} onClose={() => openToken(null)} />}
    </>
  );
}
