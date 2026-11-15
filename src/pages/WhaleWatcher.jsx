import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUp, Fish, Pause, Play, Search } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { CopyButton, Freshness, Panel, Pill, StatCard } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, Skeleton, TableSkeleton, Unavailable } from '@/components/ds/States';
import { rpcCall } from '@/lib/x1/rpcClient';
import { api } from '@/lib/x1/api';
import { X1_CONFIG } from '@/lib/x1/config';
import { compact, integer, shortAddress, timeAgo, usd } from '@/lib/format';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

const SETTINGS_KEY = 'x1_whale_settings';
const VOTE_PROGRAM = 'Vote111111111111111111111111111111111111111';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const STAKE_PROGRAM = 'Stake11111111111111111111111111111111111111';
const LAMPORTS_PER_XNT = 1e9;

// Work bounds: how many blocks are read per poll and how many transfers are kept in memory.
const INITIAL_BLOCKS = 24;
const BLOCKS_PER_POLL = 16;
const BLOCK_CONCURRENCY = 4;
const MAX_KEPT = 300;
// Candidates at or above this size are kept so the threshold can be lowered without rescanning.
const DETECT_FLOOR_XNT = 100;
const PRESETS = [1000, 10000, 50000, 100000, 500000];
const DEFAULT_MIN = 10000;
const POLL_MS = Math.max(X1_CONFIG.polling.transactionsMs, 5000);

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const inputClass = 'h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/25';
const chipClass = 'inline-flex h-8 items-center rounded-lg border px-3 text-xs font-medium transition-colors';
const TYPE_FILTERS = [
  { id: 'all', label: 'All types' },
  { id: 'transfer', label: 'Transfers' },
  { id: 'stake', label: 'Stake program' },
];

function readSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const min = Number(s?.minAmount);
    return {
      minAmount: Number.isFinite(min) && min >= DETECT_FLOOR_XNT && min <= 1e12 ? min : DEFAULT_MIN,
      filterType: TYPE_FILTERS.some((t) => t.id === s?.filterType) ? s.filterType : 'all',
    };
  } catch {
    return { minAmount: DEFAULT_MIN, filterType: 'all' };
  }
}

function writeSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage unavailable: settings last for this visit only.
  }
}

/** Reads transfers out of one block. Amounts come from the pre/post lamport balances in the block's metadata. */
function extractTransfers(block, slot) {
  const found = [];
  for (const tx of block?.transactions || []) {
    const meta = tx?.meta;
    const message = tx?.transaction?.message;
    if (!meta || meta.err || !message) continue; // failed transactions moved no funds
    const keys = [...(message.accountKeys || []), ...(meta.loadedAddresses?.writable || []), ...(meta.loadedAddresses?.readonly || [])]
      .map((k) => (typeof k === 'string' ? k : k?.pubkey));
    const programs = (message.instructions || []).map((ix) => keys[ix.programIdIndex]);
    if (programs.includes(VOTE_PROGRAM)) continue;
    const isStake = programs.includes(STAKE_PROGRAM);
    if (!isStake && !programs.includes(SYSTEM_PROGRAM)) continue;
    const pre = meta.preBalances || [];
    const post = meta.postBalances || [];
    let sender = null;
    let receiver = null;
    for (let i = 0; i < Math.min(pre.length, post.length, keys.length); i++) {
      const delta = (post[i] - pre[i]) / LAMPORTS_PER_XNT;
      if (!Number.isFinite(delta)) continue;
      if (delta < 0 && (!sender || delta < sender.delta)) sender = { address: keys[i], delta };
      if (delta > 0 && (!receiver || delta > receiver.delta)) receiver = { address: keys[i], delta };
    }
    if (!sender || !receiver || sender.address === receiver.address) continue;
    // The receiver's gain is the amount that arrived; the sender's loss also includes the fee.
    const amount = receiver.delta;
    if (amount < DETECT_FLOOR_XNT) continue;
    const signature = tx.transaction?.signatures?.[0];
    if (typeof signature !== 'string') continue;
    found.push({
      id: signature,
      signature,
      from: sender.address,
      to: receiver.address,
      amount,
      type: isStake ? 'stake' : 'transfer',
      slot,
      timestamp: isNum(block.blockTime) ? block.blockTime * 1000 : null,
    });
  }
  return found;
}

async function readBlock(slot) {
  try {
    const block = await rpcCall('getBlock', [slot, { encoding: 'json', transactionDetails: 'full', rewards: false, maxSupportedTransactionVersion: 0 }]);
    return block ? { slot, block } : null;
  } catch {
    return null; // a block that cannot be read is skipped, never invented
  }
}

/** @param {{ label?: any, field?: any, sort?: any, onSort?: any, className?: any, [key: string]: any }} props */
function SortButton({ label, field, sort, onSort, className }) {
  const active = sort.field === field;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={className}>
      <button type="button" onClick={() => onSort(field)} className={cn('inline-flex items-center gap-1 rounded hover:text-ink', active && 'text-ink')}>
        {label}
        {active && (sort.dir === 'asc' ? <ArrowUp className="h-3 w-3 text-brand" aria-hidden="true" /> : <ArrowDown className="h-3 w-3 text-brand" aria-hidden="true" />)}
      </button>
    </th>
  );
}

/** @param {{ address?: any, [key: string]: any }} props */
function Party({ address }) {
  return (
    <span className="flex items-center gap-1">
      <Link to={`${createPageUrl('AddressLookup')}?address=${address}`} className="mono rounded text-xs text-ink-soft hover:text-brand" title={address}>
        {shortAddress(address, 6, 6)}
      </Link>
    </span>
  );
}

export default function WhaleWatcher() {
  const [settings, setSettings] = useState(readSettings);
  const [customValue, setCustomValue] = useState('');
  const [customError, setCustomError] = useState(null);
  const [live, setLive] = useState(true);
  const [filterAddress, setFilterAddress] = useState('');
  const [sort, setSort] = useState({ field: 'slot', dir: 'desc' });
  const [scan, setScan] = useState({ status: 'loading', transfers: [], blocks: 0, fromSlot: null, toSlot: null, loadedAt: null, stale: false, error: null });
  const [xntPrice, setXntPrice] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const mounted = useRef(true);
  const busy = useRef(false);
  const lastSlot = useRef(null);

  const poll = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    try {
      const head = await rpcCall('getSlot');
      if (!isNum(head)) throw new Error('The RPC returned no current slot.');
      const first = lastSlot.current === null ? head - INITIAL_BLOCKS + 1 : Math.max(lastSlot.current + 1, head - BLOCKS_PER_POLL + 1);
      if (first > head) {
        if (mounted.current) setScan((s) => ({ ...s, status: 'ready', loadedAt: Date.now(), stale: false }));
        return;
      }
      // getBlocks lists only slots that have a block, so skipped slots cost no request.
      const slots = await rpcCall('getBlocks', [first, head]);
      const list = Array.isArray(slots) ? slots.slice(-(lastSlot.current === null ? INITIAL_BLOCKS : BLOCKS_PER_POLL)) : [];
      const results = [];
      for (let i = 0; i < list.length; i += BLOCK_CONCURRENCY) {
        if (!mounted.current) return;
        results.push(...(await Promise.all(list.slice(i, i + BLOCK_CONCURRENCY).map(readBlock))));
      }
      if (!mounted.current) return;
      const read = results.filter(Boolean);
      const fresh = read.flatMap(({ slot, block }) => extractTransfers(block, slot));
      lastSlot.current = head;
      setScan((s) => {
        const known = new Set(s.transfers.map((t) => t.id));
        const merged = [...fresh.filter((t) => !known.has(t.id)), ...s.transfers].sort((a, b) => b.slot - a.slot).slice(0, MAX_KEPT);
        return {
          status: 'ready',
          transfers: merged,
          blocks: s.blocks + read.length,
          fromSlot: s.fromSlot ?? (read[0]?.slot ?? first),
          toSlot: head,
          loadedAt: Date.now(),
          stale: false,
          error: null,
        };
      });
    } catch (err) {
      if (!mounted.current) return;
      // Keep the last good transfers and mark them stale.
      setScan((s) => (s.status === 'ready' ? { ...s, stale: true } : { ...s, status: 'error', error: err?.message || 'The X1 RPC did not respond.' }));
    } finally {
      busy.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!live) return undefined;
    poll();
    const id = setInterval(() => {
      if (!document.hidden) poll();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [live, poll]);

  useEffect(() => {
    let cancelled = false;
    const load = () => api.tokenPrice(X1_CONFIG.nativeMint)
      .then((res) => { if (!cancelled) setXntPrice(isNum(res?.data?.priceUsd) ? res.data.priceUsd : null); })
      .catch(() => { if (!cancelled) setXntPrice((p) => p); });
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, X1_CONFIG.polling.tokensMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const update = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    writeSettings(next);
  };

  const submitCustom = (e) => {
    e.preventDefault();
    const value = Number(customValue.replace(/,/g, ''));
    if (!Number.isFinite(value) || value < DETECT_FLOOR_XNT || value > 1e12) {
      setCustomError(`Enter an amount between ${integer(DETECT_FLOOR_XNT)} and 1,000,000,000,000 XNT.`);
      return;
    }
    setCustomError(null);
    setCustomValue('');
    update({ minAmount: value });
  };

  const onSort = (field) => setSort((s) => (s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'desc' }));

  const rows = useMemo(() => {
    const addr = filterAddress.trim();
    const filtered = scan.transfers.filter((t) => {
      if (t.amount < settings.minAmount) return false;
      if (settings.filterType !== 'all' && t.type !== settings.filterType) return false;
      if (addr.length >= 8 && !t.from.includes(addr) && !t.to.includes(addr)) return false;
      return true;
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => dir * ((a[sort.field] ?? 0) - (b[sort.field] ?? 0)));
  }, [scan.transfers, settings, filterAddress, sort]);

  const volume = rows.reduce((s, t) => s + t.amount, 0);
  const largest = rows.reduce((m, t) => Math.max(m, t.amount), 0);
  const withUsd = (xnt) => (isNum(xntPrice) ? usd(xnt * xntPrice) : null);
  const ready = scan.status === 'ready';

  return (
    <>
      <PageHeader
        icon={Fish}
        title="Whale Watcher"
        description="Large native XNT movements found in recent X1 blocks. Amounts are read from on-chain balance changes; nothing is simulated."
        meta={<Freshness at={scan.loadedAt} stale={scan.stale} source="X1 RPC" onRefresh={live ? () => poll() : undefined} refreshing={refreshing} />}
        actions={(
          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            aria-pressed={live}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong px-3 text-sm text-ink-soft transition-colors hover:bg-surface-3"
          >
            {live ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            {live ? 'Pause scanning' : 'Resume scanning'}
          </button>
        )}
      />

      <div className="space-y-6">
        <section aria-label="Scan summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Large transfers" value={ready ? integer(rows.length) : <Skeleton className="h-7 w-16" />} hint={`At or above ${compact(settings.minAmount)} XNT`} />
          <StatCard label="Volume" tone="brand" value={ready ? `${compact(volume)} XNT` : <Skeleton className="h-7 w-24" />} hint={ready ? (withUsd(volume) ?? 'USD value unavailable: no XNT price') : undefined} />
          <StatCard label="Largest" value={ready ? (rows.length ? `${compact(largest)} XNT` : <Unavailable reason="No transfers in range" />) : <Skeleton className="h-7 w-24" />} hint={ready && rows.length ? (withUsd(largest) ?? 'USD value unavailable: no XNT price') : undefined} />
          <StatCard
            label="Blocks scanned"
            value={ready ? integer(scan.blocks) : <Skeleton className="h-7 w-16" />}
            hint={ready && isNum(scan.fromSlot) ? `Slots ${integer(scan.fromSlot)} to ${integer(scan.toSlot)}` : undefined}
          />
        </section>

        <Panel title="Filters" description={`Saved in this browser. Transfers of ${integer(DETECT_FLOOR_XNT)} XNT or more are kept in memory, so you can lower the threshold without rescanning.`}>
          <div className="space-y-5 p-4">
            <div>
              <p id="min-label" className="mb-2 text-xs font-medium text-ink-muted">Minimum amount</p>
              <div role="group" aria-labelledby="min-label" className="flex flex-wrap items-center gap-2">
                {[...new Set([...PRESETS, settings.minAmount])].sort((a, b) => a - b).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => update({ minAmount: val })}
                    aria-pressed={settings.minAmount === val}
                    className={cn(chipClass, settings.minAmount === val ? 'border-brand/40 bg-brand/10 text-brand' : 'border-line-strong text-ink-muted hover:bg-surface-3')}
                  >
                    {compact(val)}+ XNT
                  </button>
                ))}
                <form onSubmit={submitCustom} className="flex items-center gap-2" noValidate>
                  <label htmlFor="ww-custom" className="sr-only">Custom minimum amount in XNT</label>
                  <input id="ww-custom" inputMode="decimal" value={customValue} onChange={(e) => { setCustomValue(e.target.value); setCustomError(null); }} placeholder="Custom XNT" maxLength={16} aria-invalid={!!customError} aria-describedby={customError ? 'ww-custom-error' : undefined} className={cn(inputClass, 'h-8 w-32')} />
                  <button type="submit" disabled={!customValue.trim()} className={cn(chipClass, 'border-line-strong text-ink-soft hover:bg-surface-3 disabled:opacity-50')}>Set</button>
                </form>
              </div>
              {customError && <p id="ww-custom-error" role="alert" className="mt-2 text-xs text-negative">{customError}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p id="type-label" className="mb-2 text-xs font-medium text-ink-muted">Type</p>
                <div role="group" aria-labelledby="type-label" className="flex flex-wrap gap-2">
                  {TYPE_FILTERS.map((t) => (
                    <button key={t.id} type="button" onClick={() => update({ filterType: t.id })} aria-pressed={settings.filterType === t.id} className={cn(chipClass, settings.filterType === t.id ? 'border-brand/40 bg-brand/10 text-brand' : 'border-line-strong text-ink-muted hover:bg-surface-3')}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="ww-address" className="mb-2 block text-xs font-medium text-ink-muted">Filter by address (8 or more characters)</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                  <input id="ww-address" value={filterAddress} onChange={(e) => setFilterAddress(e.target.value)} maxLength={44} spellCheck={false} autoComplete="off" placeholder="Sender or receiver address" className={cn(inputClass, 'mono pl-9')} />
                </div>
                {filterAddress.trim().length > 0 && filterAddress.trim().length < 8 && !BASE58.test(filterAddress.trim()) && (
                  <p className="mt-1.5 text-xs text-ink-faint">Keep typing: the filter starts at 8 characters.</p>
                )}
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Large transfers"
          description={ready ? `Scanning the latest blocks: ${integer(scan.blocks)} blocks read since you opened this page, ${integer(BLOCKS_PER_POLL)} or fewer per update, every ${Math.round(POLL_MS / 1000)}s while this tab is visible.` : undefined}
          bodyClassName="p-0"
        >
          {scan.status === 'loading' ? (
            <TableSkeleton rows={6} columns={5} />
          ) : scan.status === 'error' ? (
            <ErrorState title="Could not scan recent blocks" description={`${scan.error} Nothing is shown rather than estimated transfers.`} onRetry={() => poll()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Fish}
              title="No large transfers in the scanned blocks"
              description={`None of the ${integer(scan.blocks)} blocks scanned so far moved ${compact(settings.minAmount)} XNT or more${settings.filterType !== 'all' || filterAddress.trim().length >= 8 ? ' with these filters' : ''}. ${live ? 'New blocks are scanned automatically.' : 'Scanning is paused.'}`}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <caption className="sr-only">Large XNT transfers found in recent blocks</caption>
                <thead>
                  <tr>
                    <th scope="col">Type</th>
                    <SortButton label="Amount" field="amount" sort={sort} onSort={onSort} />
                    <th scope="col">From</th>
                    <th scope="col" className="hidden sm:table-cell"><span className="sr-only">To</span></th>
                    <SortButton label="Slot" field="slot" sort={sort} onSort={onSort} className="hidden md:table-cell" />
                    <SortButton label="Time" field="timestamp" sort={sort} onSort={onSort} className="hidden lg:table-cell" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id}>
                      <td><Pill tone={t.type === 'stake' ? 'violet' : 'brand'}>{t.type === 'stake' ? 'Stake program' : 'Transfer'}</Pill></td>
                      <td>
                        <Link to={`${createPageUrl('TransactionDetail')}?sig=${t.signature}`} className="block rounded tabular font-medium text-ink hover:text-brand">
                          {compact(t.amount)} XNT
                        </Link>
                        {withUsd(t.amount) && <span className="block text-xs text-ink-muted tabular">{withUsd(t.amount)}</span>}
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <Party address={t.from} />
                          <span className="flex items-center gap-1 text-ink-faint sm:hidden"><ArrowRight className="h-3 w-3" aria-hidden="true" /><span className="sr-only">to</span><Party address={t.to} /></span>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell">
                        <span className="flex items-center gap-2"><ArrowRight className="h-3.5 w-3.5 text-ink-faint" aria-hidden="true" /><Party address={t.to} /><CopyButton value={t.to} label="Copy receiving address" /></span>
                      </td>
                      <td className="hidden tabular text-ink-muted md:table-cell">{integer(t.slot)}</td>
                      <td className="hidden text-ink-muted lg:table-cell">{t.timestamp ? timeAgo(t.timestamp) : <Unavailable reason="This block has no timestamp" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-line px-4 py-3 text-xs text-ink-faint">
            Only successful, non-vote transactions with a system or stake program instruction are considered. The amount is the largest balance increase in the transaction and the sender is the account with the largest decrease; complex transactions (swaps, multi-party payments) can be summarised imperfectly. {isNum(xntPrice) ? 'USD values use the current XNT market price.' : 'No XNT price is available, so amounts are shown in XNT only.'}
          </p>
        </Panel>
      </div>
    </>
  );
}
