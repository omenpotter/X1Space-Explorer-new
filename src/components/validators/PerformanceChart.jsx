import { useMemo } from 'react';
import { EmptyState } from '@/components/ds/States';
import { compact, integer } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Turns the raw `epochCredits` series from getVoteAccounts ([epoch, credits, previousCredits])
 * into credits earned per epoch. Nothing is interpolated: epochs the RPC does not return are absent.
 */
export function creditsPerEpoch(epochCredits, currentEpoch) {
  if (!Array.isArray(epochCredits)) return [];
  return epochCredits
    .filter((e) => Array.isArray(e) && e.length >= 3 && e.every((n) => Number.isFinite(Number(n))))
    .map(([epoch, credits, previous]) => ({
      epoch: Number(epoch),
      earned: Math.max(0, Number(credits) - Number(previous)),
      inProgress: currentEpoch !== null && currentEpoch !== undefined && Number(epoch) === currentEpoch,
    }));
}

/**
 * Bar chart of vote credits earned per epoch. This is the only per-validator history
 * the RPC provides (about the last five epochs).
 */
/** @param {{ epochCredits?: any, currentEpoch?: any, height?: any, className?: any, [key: string]: any }} props */
export default function PerformanceChart({ epochCredits, currentEpoch, height = 180, className }) {
  const rows = useMemo(() => creditsPerEpoch(epochCredits, currentEpoch), [epochCredits, currentEpoch]);
  const max = Math.max(0, ...rows.map((r) => r.earned));

  if (rows.length === 0 || max === 0) {
    return <EmptyState title="No epoch credit history" description="The RPC did not return vote credits for this validator, so there is nothing to chart." className={cn('py-10', className)} />;
  }

  return (
    <figure className={className}>
      <div className="flex items-end gap-2 sm:gap-4" style={{ height }} aria-hidden="true">
        {rows.map((r) => (
          <div key={r.epoch} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-[11px] tabular text-ink-soft">{compact(r.earned, 1)}</span>
            <div
              className={cn('w-full max-w-[72px] rounded-t', r.inProgress ? 'border border-b-0 border-dashed border-brand bg-brand/20' : 'bg-brand/80')}
              style={{ height: `${Math.max(2, (r.earned / max) * 100)}%`, maxHeight: 'calc(100% - 22px)' }}
              title={`Epoch ${r.epoch}: ${integer(r.earned)} credits${r.inProgress ? ' so far (epoch in progress)' : ''}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 border-t border-line pt-2 sm:gap-4" aria-hidden="true">
        {rows.map((r) => (
          <span key={r.epoch} className="min-w-0 flex-1 truncate text-center text-[11px] tabular text-ink-muted">
            {r.epoch}{r.inProgress ? '*' : ''}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 text-xs text-ink-faint">
        Vote credits earned per epoch, from the validator's vote account (<span className="mono">epochCredits</span>). The RPC keeps only the most recent epochs.
        {rows.some((r) => r.inProgress) && ' * Current epoch, still in progress, so its bar is lower by construction.'}
      </figcaption>
      <table className="sr-only">
        <caption>Vote credits earned per epoch</caption>
        <thead><tr><th scope="col">Epoch</th><th scope="col">Credits earned</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.epoch}><td>{r.epoch}{r.inProgress ? ' (in progress)' : ''}</td><td>{integer(r.earned)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
