import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Boxes, Pause, Play } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { Freshness, Panel, Pill } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, TableSkeleton, Unavailable } from '@/components/ds/States';
import { Button } from '@/components/ui/button';
import usePolling from '@/components/dashboard/usePolling';
import { CompositionBar, TxTypeLegend, txBreakdown } from '@/components/x1/MempoolViz';
import X1Rpc from '@/components/x1/X1RpcService';
import { X1_CONFIG } from '@/lib/x1/config';
import { integer, shortAddress, timeAgo } from '@/lib/format';
import { createPageUrl } from '@/utils';

const BLOCK_COUNT = 20;
const VOTE_PROGRAM = 'Vote111111111111111111111111111111111111111';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const outlineBtn = 'border-line-strong bg-transparent text-ink-soft hover:bg-surface-3 hover:text-ink';

function summarize(slot, block) {
  const txs = Array.isArray(block.transactions) ? block.transactions : [];
  let voteCount = 0;
  let transferCount = 0;
  let programCount = 0;
  for (const tx of txs) {
    const msg = tx?.transaction?.message;
    const keys = msg?.accountKeys || [];
    const ixs = msg?.instructions || [];
    const ids = ixs.map((ix) => keys[ix.programIdIndex]);
    if (ids.includes(VOTE_PROGRAM)) voteCount += 1;
    else if (ids.includes(SYSTEM_PROGRAM)) transferCount += 1;
    else if (ixs.length > 0) programCount += 1;
  }
  // The block leader is the identity that received the transaction-fee reward.
  const feeReward = (block.rewards || []).find((r) => r?.rewardType === 'Fee');
  return {
    slot,
    blockhash: block.blockhash,
    blockTime: block.blockTime,
    txCount: txs.length,
    voteCount,
    transferCount,
    programCount,
    leader: feeReward?.pubkey || null,
  };
}

async function loadBlocks() {
  const current = await X1Rpc.getSlot();
  const results = await Promise.allSettled(
    Array.from({ length: BLOCK_COUNT }, (_, i) => X1Rpc.getBlock(current - i, { transactionDetails: 'full' }).then((b) => (b ? summarize(current - i, b) : null))),
  );
  const rows = results.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []));
  const failed = results.filter((r) => r.status === 'rejected').length;
  // Every request failing means the RPC is unreachable; a slot with no block is simply skipped.
  if (failed === results.length) throw new Error('The X1 RPC did not respond.');
  return { currentSlot: current, rows, unavailable: results.length - rows.length };
}

export default function Blocks() {
  const navigate = useNavigate();
  const [paused, setPaused] = useState(false);
  const [slotInput, setSlotInput] = useState('');
  const { data, error, status, stale, loadedAt, refreshing, reload } = usePolling(loadBlocks, X1_CONFIG.polling.blocksMs, { paused });

  const rows = data?.rows || [];

  const goToSlot = (e) => {
    e.preventDefault();
    const n = Number(slotInput.trim().replace(/,/g, ''));
    if (Number.isSafeInteger(n) && n >= 0) navigate(`${createPageUrl('BlockDetail')}?slot=${n}`);
  };
  const validSlot = /^\d[\d,]*$/.test(slotInput.trim());

  return (
    <>
      <PageHeader
        icon={Boxes}
        title="Blocks"
        description={`The latest ${BLOCK_COUNT} slots on X1 mainnet. Slots that produced no block are skipped and not listed.`}
        meta={
          <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
            <Freshness at={loadedAt} source="X1 RPC" stale={stale} onRefresh={reload} refreshing={refreshing} />
            {paused && <Pill tone="warning">Updates paused</Pill>}
          </span>
        }
        actions={
          <>
            <form onSubmit={goToSlot} className="flex items-center gap-2" role="search" aria-label="Go to a slot">
              <label htmlFor="slot-input" className="sr-only">Slot number</label>
              <input
                id="slot-input"
                inputMode="numeric"
                value={slotInput}
                onChange={(e) => setSlotInput(e.target.value)}
                placeholder="Go to slot"
                className="h-9 w-32 rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/25"
              />
              <Button type="submit" variant="outline" size="sm" disabled={!validSlot} className={outlineBtn}>Go</Button>
            </form>
            <Button type="button" variant="outline" size="sm" onClick={() => setPaused((p) => !p)} aria-pressed={paused} className={outlineBtn}>
              {paused ? <Play className="mr-2 h-4 w-4" aria-hidden="true" /> : <Pause className="mr-2 h-4 w-4" aria-hidden="true" />}
              {paused ? 'Resume' : 'Pause'}
            </Button>
          </>
        }
      />

      <Panel
        title="Latest blocks"
        description={data ? `Current slot ${integer(data.currentSlot)}${data.unavailable ? ` · ${data.unavailable} of the last ${BLOCK_COUNT} slots had no block (skipped or not available from the RPC)` : ''}` : undefined}
      >
        {status === 'loading' && <TableSkeleton rows={10} columns={5} />}
        {status === 'error' && <ErrorState title="Blocks are unavailable" description={error?.message} onRetry={reload} />}
        {status === 'ready' && rows.length === 0 && (
          <EmptyState icon={Boxes} title="No blocks returned" description="The RPC returned no block for the most recent slots." />
        )}
        {status === 'ready' && rows.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <caption className="sr-only">Latest confirmed blocks</caption>
                <thead>
                  <tr>
                    <th scope="col">Slot</th>
                    <th scope="col">Time</th>
                    <th scope="col" className="text-right">Transactions</th>
                    <th scope="col" className="hidden md:table-cell">Composition (vote / system / other)</th>
                    <th scope="col" className="hidden lg:table-cell">Leader</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((block) => {
                    const b = txBreakdown(block);
                    return (
                      <tr key={block.slot}>
                        <td>
                          <Link to={`${createPageUrl('BlockDetail')}?slot=${block.slot}`} className="mono text-brand hover:underline">
                            {integer(block.slot)}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap text-ink-muted">
                          {block.blockTime ? (
                            <time dateTime={new Date(block.blockTime * 1000).toISOString()} title={new Date(block.blockTime * 1000).toLocaleString()}>
                              {timeAgo(block.blockTime * 1000)}
                            </time>
                          ) : (
                            <Unavailable reason="Block time not reported by the RPC" />
                          )}
                        </td>
                        <td className="text-right tabular text-ink">{b ? integer(b.total) : <Unavailable />}</td>
                        <td className="hidden md:table-cell">
                          {b ? (
                            <div className="flex min-w-[200px] items-center gap-3">
                              <CompositionBar breakdown={b} className="max-w-[140px]" />
                              <span className="whitespace-nowrap text-xs tabular text-ink-muted">
                                {integer(b.vote)} / {integer(b.system)} / {integer(b.program + b.other)}
                              </span>
                            </div>
                          ) : (
                            <Unavailable />
                          )}
                        </td>
                        <td className="hidden lg:table-cell">
                          {block.leader ? <span className="mono text-ink-muted" title={block.leader}>{shortAddress(block.leader, 6, 6)}</span> : <Unavailable reason="The block reported no fee reward, so the leader is unknown" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TxTypeLegend className="px-4 py-3" />
          </>
        )}
      </Panel>
    </>
  );
}
