import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Boxes, ChevronLeft, ChevronRight, SearchX } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { CopyButton, Panel, Pill, StatCard } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, Skeleton, StatSkeleton, Unavailable } from '@/components/ds/States';
import { Button } from '@/components/ui/button';
import usePolling from '@/components/dashboard/usePolling';
import { CompositionBar, TX_TYPES } from '@/components/x1/MempoolViz';
import X1Rpc from '@/components/x1/X1RpcService';
import { integer, shortAddress } from '@/lib/format';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

const VOTE_PROGRAM = 'Vote111111111111111111111111111111111111111';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const MAX_CELLS = 3000;
const LIST_LIMIT = 25;
const outlineBtn = 'border-line-strong bg-transparent text-ink-soft hover:bg-surface-3 hover:text-ink';

function parseSlot(raw) {
  if (!raw || !/^\d{1,16}$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return Number.isSafeInteger(n) ? n : null;
}

function classify(tx) {
  const msg = tx?.transaction?.message;
  const keys = msg?.accountKeys || [];
  const ixs = msg?.instructions || [];
  const ids = ixs.map((ix) => keys[ix.programIdIndex]);
  if (ids.includes(VOTE_PROGRAM)) return 'vote';
  if (ids.includes(SYSTEM_PROGRAM)) return 'system';
  if (ixs.length > 0) return 'program';
  return 'other';
}

async function loadBlock(slot) {
  if (slot === null) return { kind: 'invalid' };
  let raw;
  try {
    raw = await X1Rpc.getBlock(slot, { transactionDetails: 'full' });
  } catch (err) {
    // A node-level error means the node answered but has no block for this slot (skipped, not yet produced or pruned).
    if (err?.kind === 'rpc') return { kind: 'missing', message: err.message };
    throw err;
  }
  if (!raw) return { kind: 'missing', message: null };
  const txs = Array.isArray(raw.transactions) ? raw.transactions : [];
  const items = txs.map((tx) => ({
    type: classify(tx),
    failed: !!tx?.meta?.err,
    signature: tx?.transaction?.signatures?.[0] || null,
    fee: Number(tx?.meta?.fee) || 0,
  }));
  const counts = { total: items.length, vote: 0, system: 0, program: 0, other: 0 };
  let failed = 0;
  let fees = 0;
  for (const it of items) {
    counts[it.type] += 1;
    if (it.failed) failed += 1;
    fees += it.fee;
  }
  return {
    kind: 'ok',
    block: {
      slot,
      blockhash: raw.blockhash,
      previousBlockhash: raw.previousBlockhash,
      parentSlot: raw.parentSlot,
      blockTime: raw.blockTime,
      blockHeight: raw.blockHeight,
      leader: (raw.rewards || []).find((r) => r?.rewardType === 'Fee')?.pubkey || null,
    },
    items,
    counts,
    failed,
    feesXnt: fees / 1e9,
  };
}

const CELL_COLOR = Object.fromEntries(TX_TYPES.map((t) => [t.key, t.bar]));

/** @param {{ items?: any, counts?: any, failed?: any, [key: string]: any }} props */
function TxCells({ items, counts, failed }) {
  const shown = items.slice(0, MAX_CELLS);
  const summary = `${integer(counts.total)} transactions: ${TX_TYPES.map((t) => `${integer(counts[t.key])} ${t.label.toLowerCase()}`).join(', ')}; ${integer(failed)} failed.`;
  return (
    <div>
      <div role="img" aria-label={summary} className="flex flex-wrap gap-[3px]">
        {shown.map((it, i) => (
          <span key={i} className={cn('h-2.5 w-2.5 rounded-[2px]', it.failed ? 'bg-negative' : CELL_COLOR[it.type])} />
        ))}
      </div>
      {items.length > MAX_CELLS && <p className="mt-2 text-xs text-ink-muted">Showing the first {integer(MAX_CELLS)} of {integer(items.length)} transactions.</p>}
      <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted" aria-label="Legend">
        {TX_TYPES.filter((t) => counts[t.key] > 0).map((t) => (
          <li key={t.key} className="flex items-center gap-1.5" title={t.description}>
            <span className={cn('h-2.5 w-2.5 rounded-sm', t.bar)} aria-hidden="true" />
            {t.label} ({integer(counts[t.key])})
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-negative" aria-hidden="true" />
          Failed ({integer(failed)})
        </li>
      </ul>
    </div>
  );
}

/** @param {{ label?: any, children?: any, [key: string]: any }} props */
function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

export default function BlockDetail() {
  const [params] = useSearchParams();
  const rawSlot = params.get('slot');
  const slot = useMemo(() => parseSlot(rawSlot), [rawSlot]);
  const { data, status, error, reload } = usePolling(() => loadBlock(slot), 0, { deps: [slot] });

  const slotUrl = (n) => `${createPageUrl('BlockDetail')}?slot=${n}`;
  const nav = slot !== null && (
    <>
      {slot > 0 && (
        <Button asChild variant="outline" size="sm" className={outlineBtn}>
          <Link to={slotUrl(slot - 1)}><ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />Previous slot</Link>
        </Button>
      )}
      <Button asChild variant="outline" size="sm" className={outlineBtn}>
        <Link to={slotUrl(slot + 1)}>Next slot<ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" /></Link>
      </Button>
    </>
  );

  const header = (extra) => (
    <PageHeader
      icon={Boxes}
      title={slot !== null ? `Block ${integer(slot)}` : 'Block'}
      description={slot !== null ? 'Confirmed block contents read from the X1 RPC.' : undefined}
      back={{ label: 'Blocks', to: createPageUrl('Blocks') }}
      badge={extra}
      actions={nav || undefined}
    />
  );

  if (slot === null) {
    return (
      <>
        {header()}
        <Panel>
          <EmptyState
            icon={SearchX}
            title={rawSlot ? 'Invalid slot number' : 'No slot specified'}
            description="Open a block from the Blocks page, or use a link of the form ?slot=123456 with a non-negative whole number."
            action={<Button asChild variant="outline" size="sm" className={outlineBtn}><Link to={createPageUrl('Blocks')}>Go to Blocks</Link></Button>}
          />
        </Panel>
      </>
    );
  }

  if (status === 'loading') {
    return (
      <>
        {header()}
        <StatSkeleton count={4} />
        <Skeleton className="mt-6 h-48 w-full" />
      </>
    );
  }

  if (status === 'error') {
    return (
      <>
        {header()}
        <Panel><ErrorState title="Could not load this block" description={error?.message} onRetry={reload} /></Panel>
      </>
    );
  }

  if (data.kind === 'missing') {
    return (
      <>
        {header()}
        <Panel>
          <EmptyState
            icon={SearchX}
            title={`No block at slot ${integer(slot)}`}
            description={`The slot may have been skipped by its leader, may not be produced yet, or may be older than the RPC node keeps.${data.message ? ` RPC message: ${data.message}` : ''} Try the previous or next slot.`}
          />
        </Panel>
      </>
    );
  }

  const { block, items, counts, failed, feesXnt } = data;
  const breakdown = { total: counts.total, vote: counts.vote, system: counts.system, program: counts.program, other: counts.other };

  return (
    <>
      {header(failed > 0 ? <Pill tone="warning">{integer(failed)} failed</Pill> : undefined)}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Transactions" value={integer(counts.total)} />
        <StatCard label="Successful" tone="positive" value={integer(counts.total - failed)} />
        <StatCard label="Failed" tone={failed > 0 ? 'negative' : 'default'} value={integer(failed)} />
        <StatCard label="Fees paid" value={`${feesXnt.toFixed(6)} XNT`} hint="Sum of transaction fees in this block" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Panel title="Transactions in this block" description="One square per transaction, in block order.">
            <div className="p-4">
              {counts.total === 0 ? (
                <p className="text-sm text-ink-muted">This block contains no transactions.</p>
              ) : (
                <>
                  <CompositionBar breakdown={breakdown} className="mb-4" />
                  <TxCells items={items} counts={counts} failed={failed} />
                </>
              )}
            </div>
          </Panel>

          {counts.total > 0 && (
            <Panel title={`First ${Math.min(LIST_LIMIT, items.length)} transactions`}>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">Transactions in block {integer(slot)}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Signature</th>
                      <th scope="col">Type</th>
                      <th scope="col" className="text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, LIST_LIMIT).map((it, i) => (
                      <tr key={it.signature || i}>
                        <td>
                          {it.signature ? (
                            <Link to={`${createPageUrl('TransactionDetail')}?sig=${encodeURIComponent(it.signature)}`} className="mono text-brand hover:underline" title={it.signature}>
                              {shortAddress(it.signature, 10, 8)}
                            </Link>
                          ) : (
                            <Unavailable />
                          )}
                        </td>
                        <td className="text-ink-soft">{TX_TYPES.find((t) => t.key === it.type)?.label}</td>
                        <td className="text-right"><Pill tone={it.failed ? 'negative' : 'positive'}>{it.failed ? 'Failed' : 'Success'}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>

        <Panel title="Block overview" className="lg:col-span-2">
          <dl className="divide-y divide-line/60">
            <Row label="Slot"><span className="mono">{integer(block.slot)}</span></Row>
            <Row label="Block height">{block.blockHeight != null ? <span className="mono">{integer(block.blockHeight)}</span> : <Unavailable />}</Row>
            <Row label="Time">
              {block.blockTime ? <time dateTime={new Date(block.blockTime * 1000).toISOString()}>{new Date(block.blockTime * 1000).toLocaleString()}</time> : <Unavailable reason="Block time not reported by the RPC" />}
            </Row>
            <Row label="Blockhash">
              <span className="flex items-center gap-1">
                <span className="mono break-all text-xs" title={block.blockhash}>{shortAddress(block.blockhash, 10, 10)}</span>
                {block.blockhash && <CopyButton value={block.blockhash} label="Copy blockhash" />}
              </span>
            </Row>
            <Row label="Previous blockhash">
              <span className="mono text-xs" title={block.previousBlockhash}>{shortAddress(block.previousBlockhash, 10, 10)}</span>
            </Row>
            <Row label="Parent slot">
              {block.parentSlot != null ? <Link to={slotUrl(block.parentSlot)} className="mono text-brand hover:underline">{integer(block.parentSlot)}</Link> : <Unavailable />}
            </Row>
            <Row label="Leader">
              {block.leader ? <span className="mono text-xs" title={block.leader}>{shortAddress(block.leader, 8, 8)}</span> : <Unavailable reason="The block reported no fee reward, so the leader is unknown" />}
            </Row>
          </dl>
        </Panel>
      </div>
    </>
  );
}
