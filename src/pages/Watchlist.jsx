import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Coins, ExternalLink, Plus, Search, Server, Star, Trash2, Wallet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shell/PageHeader';
import { TokenAvatar, ValidatorAvatar } from '@/components/ds/Avatar';
import { CopyButton, Freshness, Panel, Pill } from '@/components/ds/Primitives';
import { EmptyState, Skeleton, Unavailable } from '@/components/ds/States';
import X1Rpc from '@/components/x1/X1RpcService';
import { rpcCall } from '@/lib/x1/rpcClient';
import { api } from '@/lib/x1/api';
import { X1_CONFIG } from '@/lib/x1/config';
import { compact, integer, percent, shortAddress, timeAgo, usd } from '@/lib/format';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

const TOKEN_KEY = 'x1_token_watchlist';
const VALIDATOR_KEY = 'x1_watchlist';
const ADDRESS_KEY = 'x1_address_watchlist';
const MAX_ITEMS = 50;
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const LAMPORTS_PER_XNT = 1e9;

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const inputClass = 'h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/25';
const primaryButton = 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50';
const iconButton = 'rounded p-1.5 text-ink-faint transition-colors hover:bg-surface-3';

function readList(key, valid) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v.filter(valid) : [];
  } catch {
    return [];
  }
}

function writeList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Storage unavailable: the list still works for this visit.
  }
}

/** Runs `fn` over `items` a few at a time so a long list does not flood the data source. */
async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

function Change({ value }) {
  if (!isNum(value)) return <Unavailable reason="No 24h change available for this token" />;
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

function AddForm({ id, label, placeholder, buttonLabel, onAdd }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const submit = (e) => {
    e.preventDefault();
    const problem = onAdd(value.trim());
    setError(problem || null);
    if (!problem) setValue('');
  };
  return (
    <form onSubmit={submit} className="border-b border-line p-4" noValidate>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          maxLength={44}
          spellCheck={false}
          autoComplete="off"
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(inputClass, 'mono sm:max-w-lg')}
        />
        <button type="submit" disabled={!value.trim()} className={primaryButton}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {buttonLabel}
        </button>
      </div>
      {error && <p id={`${id}-error`} role="alert" className="mt-2 text-xs text-negative">{error}</p>}
    </form>
  );
}

/* ----------------------------- Tokens ----------------------------- */

function TokensTab() {
  const [mints, setMints] = useState(() => readList(TOKEN_KEY, (x) => typeof x === 'string'));
  const [entries, setEntries] = useState({});
  const [loadedAt, setLoadedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const mintsRef = useRef(mints);
  mintsRef.current = mints;

  const resolve = useCallback(async (list, background = false) => {
    if (list.length === 0) return;
    if (background) setRefreshing(true);
    const results = await inBatches(list.slice(0, MAX_ITEMS), 6, async (mint) => {
      if (!BASE58.test(mint)) return [mint, { status: 'invalid' }];
      try {
        const data = await api.token(mint);
        return [mint, { status: 'ready', token: data.token }];
      } catch (err) {
        return [mint, err?.status === 404 ? { status: 'missing' } : { status: 'error', message: err?.message }];
      }
    });
    setEntries((prev) => {
      const next = { ...prev };
      for (const [mint, entry] of results) {
        // A failed refresh keeps the last good values for that token and marks them stale.
        next[mint] = entry.status === 'error' && prev[mint]?.status === 'ready' ? { ...prev[mint], stale: true } : entry;
      }
      return next;
    });
    setStale(results.some(([, e]) => e.status === 'error'));
    setLoadedAt(Date.now());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    resolve(mintsRef.current);
    const id = setInterval(() => {
      if (!document.hidden) resolve(mintsRef.current, true);
    }, X1_CONFIG.polling.tokensMs);
    return () => clearInterval(id);
  }, [resolve]);

  const add = (mint) => {
    if (!BASE58.test(mint)) return 'Enter a valid mint address: 32 to 44 base58 characters.';
    if (mints.includes(mint)) return 'This token is already on your watchlist.';
    if (mints.length >= MAX_ITEMS) return `The watchlist holds up to ${MAX_ITEMS} tokens.`;
    const next = [...mints, mint];
    setMints(next);
    writeList(TOKEN_KEY, next);
    resolve([mint]);
    return null;
  };
  const remove = (mint) => {
    const next = mints.filter((m) => m !== mint);
    setMints(next);
    writeList(TOKEN_KEY, next);
  };

  return (
    <Panel
      title={`Tokens (${integer(mints.length)})`}
      description="Tokens you starred in the Token Explorer, with current market data where a DEX market exists."
      actions={mints.length > 0 ? <Freshness at={loadedAt} stale={stale} source="X1 RPC + XDEX" onRefresh={() => resolve(mints, true)} refreshing={refreshing} /> : null}
      bodyClassName="p-0"
    >
      <AddForm id="watch-token" label="Add a token by mint address" placeholder="Token mint address" buttonLabel="Add token" onAdd={add} />
      {mints.length === 0 ? (
        <EmptyState
          icon={Coins}
          title="No tokens on your watchlist"
          description="Star a token in the Token Explorer or add its mint address above."
          action={<Link to={createPageUrl('TokenExplorer')} className="text-sm font-medium text-brand hover:underline">Open Token Explorer</Link>}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <caption className="sr-only">Watched tokens</caption>
            <thead>
              <tr>
                <th scope="col">Token</th>
                <th scope="col" className="!text-right">Price</th>
                <th scope="col" className="hidden !text-right sm:table-cell">24h</th>
                <th scope="col" className="hidden !text-right md:table-cell">Liquidity</th>
                <th scope="col" className="hidden !text-right lg:table-cell">Market cap</th>
                <th scope="col" className="w-12"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {mints.map((mint) => {
                const entry = entries[mint] || { status: 'loading' };
                const t = entry.token;
                const noMarket = 'No DEX market for this token';
                const displayName = t ? t.name || t.symbol || 'Unnamed token' : shortAddress(mint, 6, 6);
                return (
                  <tr key={mint}>
                    <td>
                      <div className="flex max-w-[56vw] items-center gap-3 sm:max-w-none">
                        {entry.status === 'loading' ? <Skeleton className="h-8 w-8 rounded-full" /> : <TokenAvatar token={t || { mint }} size={32} />}
                        <span className="min-w-0">
                          {BASE58.test(mint) ? (
                            <Link to={`${createPageUrl('TokenExplorer')}?mint=${mint}`} className="flex items-center gap-2 rounded hover:text-brand">
                              <span className={cn('truncate font-medium text-ink', !t && 'mono')}>{displayName}</span>
                              {t?.symbol && t?.name && <span className="shrink-0 text-xs text-ink-muted">{t.symbol}</span>}
                            </Link>
                          ) : (
                            <span className="mono block truncate text-ink">{displayName}</span>
                          )}
                          <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-faint">
                            {t && <span className="mono">{shortAddress(mint, 6, 6)}</span>}
                            {entry.status === 'missing' && <Pill tone="warning">Not found</Pill>}
                            {entry.status === 'invalid' && <Pill tone="warning">Not a valid address</Pill>}
                            {entry.status === 'error' && <Pill tone="negative" title={entry.message}>Could not load</Pill>}
                            {entry.stale && <Pill tone="warning">Stale</Pill>}
                          </span>
                        </span>
                      </div>
                    </td>
                    {entry.status === 'loading' ? (
                      <td colSpan={4} className="text-right"><Skeleton className="ml-auto h-4 w-24" /></td>
                    ) : t ? (
                      <>
                        <td className="text-right tabular text-ink">{isNum(t.priceUsd) ? usd(t.priceUsd) : <Unavailable reason={noMarket} />}</td>
                        <td className="hidden text-right sm:table-cell"><Change value={t.priceChange24h} /></td>
                        <td className="hidden text-right tabular text-ink-soft md:table-cell">{isNum(t.liquidityUsd) ? usd(t.liquidityUsd) : <Unavailable reason={noMarket} />}</td>
                        <td className="hidden text-right tabular text-ink-soft lg:table-cell">{isNum(t.marketCapUsd) ? usd(t.marketCapUsd) : <Unavailable reason="Needs both a price and an on-chain supply" />}</td>
                      </>
                    ) : (
                      <>
                        <td className="text-right"><Unavailable reason="No data for this address" /></td>
                        <td className="hidden text-right sm:table-cell"><Unavailable reason="No data for this address" /></td>
                        <td className="hidden text-right md:table-cell"><Unavailable reason="No data for this address" /></td>
                        <td className="hidden text-right lg:table-cell"><Unavailable reason="No data for this address" /></td>
                      </>
                    )}
                    <td className="text-right">
                      <button type="button" onClick={() => remove(mint)} aria-label={`Remove ${t?.symbol || shortAddress(mint)} from watchlist`} className={cn(iconButton, 'hover:text-negative')}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* --------------------------- Validators --------------------------- */

function ValidatorsTab() {
  const [saved, setSaved] = useState(() => readList(VALIDATOR_KEY, (x) => x && typeof x.votePubkey === 'string'));
  const [state, setState] = useState({ status: 'loading', validators: [], loadedAt: null, stale: false });
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    try {
      const validators = await X1Rpc.getValidatorDetails();
      setState({ status: 'ready', validators: Array.isArray(validators) ? validators : [], loadedAt: Date.now(), stale: false });
    } catch {
      setState((s) => (s.status === 'ready' ? { ...s, stale: true } : { status: 'error', validators: [], loadedAt: null, stale: false }));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (!document.hidden) load(true);
    }, X1_CONFIG.polling.validatorsMs);
    return () => clearInterval(id);
  }, [load]);

  const byVote = useMemo(() => new Map(state.validators.map((v) => [v.votePubkey, v])), [state.validators]);
  const matches = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    const lower = q.toLowerCase();
    const watched = new Set(saved.map((s) => s.votePubkey));
    return state.validators
      .filter((v) => !watched.has(v.votePubkey) && ((v.name || '').toLowerCase().includes(lower) || v.votePubkey.includes(q) || (v.nodePubkey || '').includes(q)))
      .slice(0, 8);
  }, [query, state.validators, saved]);

  const update = (next) => {
    setSaved(next);
    writeList(VALIDATOR_KEY, next);
  };
  const add = (v) => {
    if (saved.length >= MAX_ITEMS || saved.some((s) => s.votePubkey === v.votePubkey)) return;
    update([...saved, { votePubkey: v.votePubkey, name: v.hasIdentity ? v.name : null, addedAt: new Date().toISOString() }]);
    setQuery('');
  };

  return (
    <Panel
      title={`Validators (${integer(saved.length)})`}
      description="Current stake, vote rate and commission for the validators you follow."
      actions={<Freshness at={state.loadedAt} stale={state.stale} source="X1 RPC" onRefresh={() => load(true)} refreshing={refreshing} />}
      bodyClassName="p-0"
    >
      <div className="border-b border-line p-4">
        <label htmlFor="watch-validator" className="mb-1.5 block text-xs font-medium text-ink-muted">Add a validator</label>
        <div className="relative sm:max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input
            id="watch-validator"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={64}
            autoComplete="off"
            disabled={state.status !== 'ready'}
            placeholder={state.status === 'loading' ? 'Loading validators…' : state.status === 'error' ? 'Validator list unavailable' : 'Search by name, vote account or identity'}
            className={cn(inputClass, 'pl-9 disabled:opacity-60')}
          />
        </div>
        {query.trim().length >= 2 && (
          matches.length === 0 ? (
            <p className="mt-2 text-xs text-ink-muted" role="status">No validators match, or the match is already on your watchlist.</p>
          ) : (
            <ul className="mt-2 grid gap-1 sm:max-w-lg" aria-label="Matching validators">
              {matches.map((v) => (
                <li key={v.votePubkey}>
                  <button type="button" onClick={() => add(v)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2">
                    <ValidatorAvatar validator={v} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{v.name || shortAddress(v.votePubkey, 6, 6)}</span>
                      <span className="block text-xs text-ink-muted">{compact(v.activatedStake)} XNT staked</span>
                    </span>
                    <Plus className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                    <span className="sr-only">Add to watchlist</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      {state.status === 'error' && saved.length > 0 && (
        <p role="status" className="border-b border-line bg-warning/10 px-4 py-3 text-sm text-ink-soft">
          Live validator data could not be loaded from the X1 RPC. Your saved validators are listed without current figures.
        </p>
      )}

      {saved.length === 0 ? (
        <EmptyState icon={Server} title="No validators on your watchlist" description="Search above to follow a validator's stake, vote rate and status." />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <caption className="sr-only">Watched validators</caption>
            <thead>
              <tr>
                <th scope="col">Validator</th>
                <th scope="col">Status</th>
                <th scope="col" className="!text-right">Stake</th>
                <th scope="col" className="hidden !text-right sm:table-cell">Vote rate</th>
                <th scope="col" className="hidden !text-right md:table-cell">Commission</th>
                <th scope="col" className="w-12"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {saved.map((item) => {
                const v = byVote.get(item.votePubkey);
                const name = v?.name || item.name || shortAddress(item.votePubkey, 6, 6);
                const reason = state.status === 'error' ? 'Live validator data is unavailable' : 'Not in the current validator set';
                return (
                  <tr key={item.votePubkey}>
                    <td>
                      <Link to={`${createPageUrl('ValidatorDetail')}?id=${item.votePubkey}`} className="flex max-w-[50vw] items-center gap-3 rounded hover:text-brand sm:max-w-none">
                        <ValidatorAvatar validator={v || { votePubkey: item.votePubkey }} size={32} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">{name}</span>
                          <span className="mono block text-xs text-ink-faint">{shortAddress(item.votePubkey, 6, 6)}</span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      {state.status === 'loading' ? <Skeleton className="h-4 w-16" />
                        : v ? <Pill tone={v.delinquent ? 'negative' : 'positive'}>{v.delinquent ? 'Delinquent' : 'Active'}</Pill>
                        : state.status === 'error' ? <Pill>Saved</Pill>
                        : <Pill tone="warning">Not in current set</Pill>}
                    </td>
                    <td className="text-right tabular text-ink">{v && isNum(v.activatedStake) ? `${compact(v.activatedStake)} XNT` : <Unavailable reason={reason} />}</td>
                    <td className="hidden text-right tabular text-ink-soft sm:table-cell">{v && isNum(v.voteRate) ? percent(v.voteRate, 1) : <Unavailable reason={v ? 'Vote rate is not available for this epoch yet' : reason} />}</td>
                    <td className="hidden text-right tabular text-ink-soft md:table-cell">{v && isNum(v.commission) ? percent(v.commission, 0) : <Unavailable reason={reason} />}</td>
                    <td className="text-right">
                      <button type="button" onClick={() => update(saved.filter((s) => s.votePubkey !== item.votePubkey))} aria-label={`Remove ${name} from watchlist`} className={cn(iconButton, 'hover:text-negative')}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-line px-4 py-3 text-xs text-ink-faint">Vote rate is the share of the maximum vote credits earned this epoch.</p>
    </Panel>
  );
}

/* --------------------------- Addresses ---------------------------- */

function AddressesTab() {
  const [saved, setSaved] = useState(() => readList(ADDRESS_KEY, (x) => x && typeof x.address === 'string'));
  const [data, setData] = useState({});
  const [loadedAt, setLoadedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const savedRef = useRef(saved);
  savedRef.current = saved;

  const fetchData = useCallback(async (list, background = false) => {
    const valid = list.filter((a) => BASE58.test(a.address)).slice(0, MAX_ITEMS);
    if (valid.length === 0) return;
    if (background) setRefreshing(true);
    const results = await inBatches(valid, 4, async ({ address }) => {
      const [balance, signatures] = await Promise.allSettled([
        X1Rpc.getBalance(address),
        rpcCall('getSignaturesForAddress', [address, { limit: 1 }]),
      ]);
      const lamports = balance.status === 'fulfilled' ? balance.value?.value : null;
      const latest = signatures.status === 'fulfilled' && Array.isArray(signatures.value) ? signatures.value[0] : undefined;
      return [address, {
        // null means the RPC did not answer; it is never shown as a zero balance.
        balance: isNum(lamports) ? lamports / LAMPORTS_PER_XNT : null,
        activity: signatures.status !== 'fulfilled' ? 'unknown' : latest ? 'found' : 'none',
        lastTx: isNum(latest?.blockTime) ? latest.blockTime * 1000 : null,
      }];
    });
    setData((prev) => ({ ...prev, ...Object.fromEntries(results) }));
    setLoadedAt(Date.now());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchData(savedRef.current);
    const id = setInterval(() => {
      if (!document.hidden) fetchData(savedRef.current, true);
    }, X1_CONFIG.polling.validatorsMs);
    return () => clearInterval(id);
  }, [fetchData]);

  const update = (next) => {
    setSaved(next);
    writeList(ADDRESS_KEY, next);
  };
  const add = (address) => {
    if (!BASE58.test(address)) return 'Enter a valid X1 address: 32 to 44 base58 characters.';
    if (saved.some((a) => a.address === address)) return 'This address is already on your watchlist.';
    if (saved.length >= MAX_ITEMS) return `The watchlist holds up to ${MAX_ITEMS} addresses.`;
    const entry = { address, label: '', addedAt: new Date().toISOString() };
    update([...saved, entry]);
    fetchData([entry]);
    return null;
  };

  return (
    <Panel
      title={`Addresses (${integer(saved.length)})`}
      description="Current XNT balance and most recent transaction for the addresses you follow."
      actions={saved.length > 0 ? <Freshness at={loadedAt} source="X1 RPC" onRefresh={() => fetchData(saved, true)} refreshing={refreshing} /> : null}
      bodyClassName="p-0"
    >
      <AddForm id="watch-address" label="Add an address" placeholder="X1 account address" buttonLabel="Add address" onAdd={add} />
      {saved.length === 0 ? (
        <EmptyState icon={Wallet} title="No addresses on your watchlist" description="Add an account address above to follow its balance and latest activity." />
      ) : (
        <ul className="divide-y divide-line/60">
          {saved.map((item) => {
            const valid = BASE58.test(item.address);
            const d = data[item.address];
            return (
              <li key={item.address} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="mono truncate text-sm text-ink" title={item.address}>{shortAddress(item.address, 8, 8)}</span>
                    <CopyButton value={item.address} label="Copy address" />
                    {!valid && <Pill tone="warning">Not a valid address</Pill>}
                  </div>
                  <input
                    value={item.label || ''}
                    onChange={(e) => update(saved.map((a) => (a.address === item.address ? { ...a, label: e.target.value } : a)))}
                    maxLength={40}
                    placeholder="Add a label"
                    aria-label={`Label for address ${shortAddress(item.address)}`}
                    className="mt-1 h-7 w-full max-w-xs rounded border border-transparent bg-transparent px-1 text-xs text-ink-soft placeholder:text-ink-faint hover:border-line focus:border-brand/50 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <dl className="flex gap-6 text-right text-sm">
                    <div>
                      <dt className="eyebrow">Balance</dt>
                      <dd className="mt-0.5 tabular text-ink">
                        {!valid ? <Unavailable reason="Not a valid address" /> : !d ? <Skeleton className="ml-auto h-4 w-20" /> : isNum(d.balance) ? `${compact(d.balance)} XNT` : <Unavailable reason="The X1 RPC did not return a balance" />}
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Last transaction</dt>
                      <dd className="mt-0.5 tabular text-ink-soft">
                        {!valid ? <Unavailable reason="Not a valid address" /> : !d ? <Skeleton className="ml-auto h-4 w-16" />
                          : d.activity === 'none' ? <span className="text-ink-muted">None found</span>
                          : d.activity === 'found' && d.lastTx ? timeAgo(d.lastTx)
                          : <Unavailable reason={d.activity === 'found' ? 'The latest transaction has no block time' : 'The X1 RPC did not return transaction history'} />}
                      </dd>
                    </div>
                  </dl>
                  <span className="flex shrink-0 items-center gap-1">
                    {valid && (
                      <Link to={`${createPageUrl('AddressLookup')}?address=${item.address}`} aria-label={`Open address ${shortAddress(item.address)}`} className={cn(iconButton, 'hover:text-brand')}>
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    )}
                    <button type="button" onClick={() => update(saved.filter((a) => a.address !== item.address))} aria-label={`Remove address ${shortAddress(item.address)} from watchlist`} className={cn(iconButton, 'hover:text-negative')}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export default function Watchlist() {
  return (
    <>
      <PageHeader
        icon={Star}
        title="Watchlist"
        description="Tokens, validators and addresses you follow. Your lists are stored only in this browser and are not sent to X1 Space."
      />
      <Tabs defaultValue="tokens">
        <TabsList className="mb-4 h-auto flex-wrap justify-start border border-line bg-surface-2">
          <TabsTrigger value="tokens" className="gap-1.5"><Coins className="h-4 w-4" aria-hidden="true" />Tokens</TabsTrigger>
          <TabsTrigger value="validators" className="gap-1.5"><Server className="h-4 w-4" aria-hidden="true" />Validators</TabsTrigger>
          <TabsTrigger value="addresses" className="gap-1.5"><Wallet className="h-4 w-4" aria-hidden="true" />Addresses</TabsTrigger>
        </TabsList>
        <TabsContent value="tokens" className="mt-0"><TokensTab /></TabsContent>
        <TabsContent value="validators" className="mt-0"><ValidatorsTab /></TabsContent>
        <TabsContent value="addresses" className="mt-0"><AddressesTab /></TabsContent>
      </Tabs>
    </>
  );
}
