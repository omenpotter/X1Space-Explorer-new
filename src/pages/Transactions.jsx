import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Pause, Play, Receipt, XCircle } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { CopyButton, Freshness, Panel, Pill, StatCard } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, StatSkeleton, TableSkeleton } from '@/components/ds/States';
import { Button } from '@/components/ui/button';
import { TX_TYPES, classifyPrograms, formatXnt } from '@/components/transactions/ProgramDecoder';
import { rpcCall } from '@/lib/x1/rpcClient';
import { X1_CONFIG } from '@/lib/x1/config';
import { DASH, integer, percent, shortAddress, timeAgo } from '@/lib/format';
import { createPageUrl } from '@/utils';

// How many of the latest blocks to read on each refresh, and the most rows kept from them.
const BLOCKS_PER_REFRESH = 3;
const MAX_ROWS = 100;

const FILTERS = ['all', 'vote', 'stake', 'token', 'system', 'other'];

/** Read the newest blocks and flatten their transactions. Skipped slots are ignored. */
async function fetchRecentTransactions() {
  const slot = await rpcCall('getSlot');
  const slots = Array.from({ length: BLOCKS_PER_REFRESH }, (_, i) => slot - i);
  const settled = await Promise.allSettled(
    slots.map((s) => rpcCall('getBlock', [s, { encoding: 'json', transactionDetails: 'full', rewards: false, maxSupportedTransactionVersion: 0 }])),
  );
  const blocks = settled.map((r, i) => ({ slot: slots[i], block: r.status === 'fulfilled' ? r.value : null }));
  const ok = blocks.filter((b) => b.block);
  if (ok.length === 0) {
    const reason = settled.find((r) => r.status === 'rejected')?.reason;
    throw new Error(reason?.message || 'No block could be read from the RPC.');
  }

  const txs = [];
  for (const { slot: s, block } of ok) {
    for (const tx of block.transactions || []) {
      const message = tx?.transaction?.message || {};
      const keys = (message.accountKeys || []).map((k) => (typeof k === 'string' ? k : k?.pubkey || null));
      const loaded = (tx?.meta?.loadedAddresses?.writable?.length || 0) + (tx?.meta?.loadedAddresses?.readonly?.length || 0);
      const programIds = [...new Set((message.instructions || []).map((ix) => keys[ix?.programIdIndex]).filter(Boolean))];
      const signature = tx?.transaction?.signatures?.[0];
      if (!signature) continue;
      txs.push({
        signature,
        slot: s,
        blockTime: Number.isFinite(block.blockTime) ? block.blockTime : null,
        success: tx.meta ? !tx.meta.err : null,
        feeLamports: Number.isFinite(tx?.meta?.fee) ? tx.meta.fee : null,
        accountCount: keys.length + loaded,
        type: classifyPrograms(programIds),
      });
    }
  }
  return { slot, blocksRead: ok.length, blocksRequested: slots.length, txs: txs.slice(0, MAX_ROWS), truncated: txs.length > MAX_ROWS, at: Date.now() };
}

export default function Transactions() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null, stale: false });
  const [live, setLive] = useState(true);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchRecentTransactions();
      if (mounted.current) setState({ status: 'ready', data, error: null, stale: false });
    } catch (err) {
      // Keep the last good data and mark it stale; only show the error state when there is nothing to show.
      if (mounted.current) setState((prev) => (prev.data ? { ...prev, stale: true, error: err?.message } : { status: 'error', data: null, error: err?.message || 'The X1 RPC did not respond.', stale: false }));
    } finally {
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
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => {
      if (!document.hidden) refresh();
    }, X1_CONFIG.polling.transactionsMs);
    return () => clearInterval(id);
  }, [live, refresh]);

  const data = state.data;
  const counts = useMemo(() => {
    const c = { all: 0 };
    for (const tx of data?.txs || []) {
      c.all += 1;
      c[tx.type] = (c[tx.type] || 0) + 1;
    }
    return c;
  }, [data]);
  const rows = useMemo(() => (data?.txs || []).filter((tx) => filter === 'all' || tx.type === filter), [data, filter]);
  const failed = useMemo(() => (data?.txs || []).filter((tx) => tx.success === false).length, [data]);

  const retry = () => {
    setState({ status: 'loading', data: null, error: null, stale: false });
    refresh();
  };

  return (
    <>
      <PageHeader
        icon={Receipt}
        title="Transactions"
        description="Transactions in the most recent confirmed blocks. This is a rolling sample of the newest blocks, not a searchable history. Open a transaction for the full decoded view."
        meta={<Freshness at={data?.at} source="X1 RPC" stale={state.stale} onRefresh={refresh} refreshing={refreshing} />}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLive((v) => !v)}
            aria-pressed={live}
            className="border-line-strong bg-transparent text-ink hover:bg-surface-3"
          >
            {live ? <Pause className="mr-2 h-4 w-4" aria-hidden="true" /> : <Play className="mr-2 h-4 w-4" aria-hidden="true" />}
            {live ? 'Pause updates' : 'Resume updates'}
          </Button>
        }
      />

      {state.status === 'loading' && (
        <div className="space-y-6">
          <StatSkeleton count={4} />
          <Panel><TableSkeleton rows={10} columns={6} /></Panel>
        </div>
      )}

      {state.status === 'error' && (
        <Panel>
          <ErrorState title="Transactions could not be loaded" description={state.error} onRetry={retry} />
        </Panel>
      )}

      {data && (
        <div className="space-y-6">
          {state.stale && (
            <p role="status" className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
              The last refresh failed{state.error ? ` (${state.error})` : ''}. Showing the previous results.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Latest slot" value={integer(data.slot)} hint="Newest slot read this refresh" />
            <StatCard label="Blocks sampled" value={`${data.blocksRead} of ${data.blocksRequested}`} hint={data.blocksRead < data.blocksRequested ? 'Skipped slots have no block' : 'Latest slots'} />
            <StatCard label="Transactions in sample" value={integer(data.txs.length)} hint={data.truncated ? `Capped at ${MAX_ROWS}` : 'Across the sampled blocks'} tone="brand" />
            <StatCard label="Failed in sample" value={integer(failed)} hint={data.txs.length ? `${percent((failed / data.txs.length) * 100, 1)} of the sample` : DASH} tone={failed ? 'warning' : 'default'} />
          </div>

          <Panel
            title="Transactions in the most recent confirmed blocks"
            description={`Newest ${data.blocksRead} block${data.blocksRead === 1 ? '' : 's'} with transactions. Type is derived from the programs each transaction invokes. ${live ? `Updates every ${X1_CONFIG.polling.transactionsMs / 1000}s.` : 'Updates are paused.'}`}
          >
            <div role="group" aria-label="Filter by transaction type" className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filter === f ? 'border-brand/40 bg-brand/10 text-brand' : 'border-line-strong text-ink-muted hover:bg-surface-3 hover:text-ink'}`}
                >
                  {f === 'all' ? 'All' : TX_TYPES[f].label}
                  <span className="tabular ml-1.5 text-ink-faint">{integer(counts[f] || 0)}</span>
                </button>
              ))}
            </div>

            {rows.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={data.txs.length === 0 ? 'No transactions in the sampled blocks' : 'No transactions of this type in the sample'}
                description={data.txs.length === 0 ? 'The newest blocks contained no transactions. This updates as new blocks arrive.' : 'Choose another type, or wait for the next refresh.'}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">Transactions in the most recent confirmed blocks, newest block first</caption>
                  <thead>
                    <tr>
                      <th scope="col">Signature</th>
                      <th scope="col">Type</th>
                      <th scope="col">Status</th>
                      <th scope="col">Slot</th>
                      <th scope="col" className="hidden text-right md:table-cell">Fee (XNT)</th>
                      <th scope="col" className="hidden text-right lg:table-cell">Accounts</th>
                      <th scope="col" className="text-right">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((tx) => {
                      const type = TX_TYPES[tx.type];
                      return (
                        <tr key={tx.signature}>
                          <td>
                            <span className="inline-flex items-center gap-1">
                              <Link to={`${createPageUrl('TransactionDetail')}?sig=${encodeURIComponent(tx.signature)}`} title={tx.signature} className="mono text-brand hover:underline">
                                {shortAddress(tx.signature, 8, 6)}
                              </Link>
                              <CopyButton value={tx.signature} label="Copy signature" />
                            </span>
                          </td>
                          <td><Pill tone={type.tone} title={type.title}>{type.label}</Pill></td>
                          <td>
                            {tx.success === null ? <Pill>Unknown</Pill> : tx.success ? <Pill tone="positive" icon={CheckCircle2}>Success</Pill> : <Pill tone="negative" icon={XCircle}>Failed</Pill>}
                          </td>
                          <td>
                            <Link to={`${createPageUrl('BlockDetail')}?slot=${tx.slot}`} className="mono tabular text-ink-soft hover:text-brand">{integer(tx.slot)}</Link>
                          </td>
                          <td className="tabular hidden text-right md:table-cell">{formatXnt(tx.feeLamports)}</td>
                          <td className="tabular hidden text-right lg:table-cell">{integer(tx.accountCount)}</td>
                          <td className="tabular text-right text-ink-muted">{tx.blockTime ? timeAgo(tx.blockTime * 1000) : DASH}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
