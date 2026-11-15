// Composition of confirmed blocks by transaction type.
// Everything here is drawn from the counts of real transactions in each block:
// no placeholder distributions, no random ordering. X1 has no public mempool, so
// nothing in this file represents pending transactions.
import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { integer, timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

export const TX_TYPES = [
  { key: 'vote', label: 'Vote', description: 'Validator vote transactions', bar: 'bg-violet' },
  { key: 'system', label: 'System', description: 'Transactions that call the System program (transfers, account creation)', bar: 'bg-positive' },
  { key: 'program', label: 'Other programs', description: 'Transactions that call any other program', bar: 'bg-warning' },
  { key: 'other', label: 'Unclassified', description: 'Transactions with no readable instructions', bar: 'bg-ink-faint' },
];

/** Exact per-type counts for a block summary from X1Rpc.getRecentBlocks(). Null when the block has no count. */
export function txBreakdown(block) {
  const total = block?.txCount;
  if (typeof total !== 'number' || !Number.isFinite(total)) return null;
  const vote = block.voteCount || 0;
  const system = block.transferCount || 0;
  const program = block.programCount || 0;
  return { total, vote, system, program, other: Math.max(0, total - vote - system - program) };
}

/** Stacked proportion bar. Segment widths are the real shares; the text alternative carries the counts. */
export const CompositionBar = memo(function CompositionBar({ breakdown, className }) {
  if (!breakdown || breakdown.total <= 0) {
    return <div className={cn('h-1.5 w-full rounded-full bg-surface-3', className)} role="img" aria-label="No transactions" />;
  }
  const parts = TX_TYPES.filter((t) => breakdown[t.key] > 0);
  const label = parts.map((t) => `${integer(breakdown[t.key])} ${t.label.toLowerCase()}`).join(', ');
  return (
    <div role="img" aria-label={`Transaction types: ${label}`} title={label} className={cn('flex h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      {parts.map((t) => (
        <span key={t.key} className={t.bar} style={{ width: `${(breakdown[t.key] / breakdown.total) * 100}%` }} />
      ))}
    </div>
  );
});

export const TxTypeLegend = memo(function TxTypeLegend({ className }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted', className)} aria-label="Transaction type legend">
      {TX_TYPES.slice(0, 3).map((t) => (
        <li key={t.key} className="flex items-center gap-1.5" title={t.description}>
          <span className={cn('h-2.5 w-2.5 rounded-sm', t.bar)} aria-hidden="true" />
          {t.label}
        </li>
      ))}
    </ul>
  );
});

export const BlockCompositionCard = memo(function BlockCompositionCard({ block }) {
  const b = txBreakdown(block);
  return (
    <li className="w-[152px] shrink-0">
      <Link
        to={`${createPageUrl('BlockDetail')}?slot=${block.slot}`}
        className="block rounded-lg border border-line bg-surface-2 p-3 transition-colors hover:border-line-strong hover:bg-surface-3"
        aria-label={`Block at slot ${integer(block.slot)}, ${b ? integer(b.total) : 'unknown number of'} transactions`}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="mono text-xs text-brand">{integer(block.slot)}</span>
          <span className="text-[11px] text-ink-faint">{block.blockTime ? timeAgo(block.blockTime * 1000) : ''}</span>
        </div>
        <p className="mt-2 font-display text-xl font-semibold tabular leading-none text-ink">{b ? integer(b.total) : '—'}</p>
        <p className="mt-1 text-[11px] text-ink-muted">transactions</p>
        <CompositionBar breakdown={b} className="mt-3" />
        {b && (
          <dl className="mt-2 space-y-0.5 text-[11px]">
            {TX_TYPES.filter((t) => t.key !== 'other' || b.other > 0).map((t) => (
              <div key={t.key} className="flex justify-between gap-2">
                <dt className="truncate text-ink-muted">{t.label}</dt>
                <dd className="tabular text-ink-soft">{integer(b[t.key])}</dd>
              </div>
            ))}
          </dl>
        )}
      </Link>
    </li>
  );
});

/** Horizontal strip of the latest confirmed blocks. Scrolls inside its own container on narrow screens. */
const BlockActivityStrip = memo(function BlockActivityStrip({ blocks, limit = 10 }) {
  if (!blocks?.length) return null;
  return (
    <ul className="flex gap-2 overflow-x-auto pb-2" aria-label="Latest confirmed blocks">
      {blocks.slice(0, limit).map((block) => (
        <BlockCompositionCard key={block.slot} block={block} />
      ))}
    </ul>
  );
});

export default BlockActivityStrip;
