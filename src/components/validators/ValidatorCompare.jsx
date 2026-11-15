// Side-by-side comparison of 2-4 validators using only measured fields from the X1 RPC.
// The one per-validator history the RPC provides is epochCredits (credits earned per epoch,
// roughly the last five epochs); it is charted as returned and never extended or smoothed.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { Panel } from '@/components/ds/Primitives';
import { Unavailable } from '@/components/ds/States';
import { Button } from '@/components/ui/button';
import {
  CommissionValue, SkipRateValue, StatusPill, ValidatorIdentity, VersionValue, VoteRateValue,
  isNum, stakeShare, validatorUrl,
} from '@/components/validators/ValidatorCard';
import { creditsPerEpoch } from '@/components/validators/PerformanceChart';
import { compact, integer, percent } from '@/lib/format';
import { cn } from '@/lib/utils';

const SERIES = [
  { bar: 'bg-brand', dot: 'bg-brand' },
  { bar: 'bg-violet', dot: 'bg-violet' },
  { bar: 'bg-warning', dot: 'bg-warning' },
  { bar: 'bg-positive', dot: 'bg-positive' },
];

/** Index of the best value among those that are numbers, or -1 when fewer than two can be compared. */
function bestIndex(values, higherIsBetter) {
  const nums = values.filter(isNum);
  if (nums.length < 2) return -1;
  const target = higherIsBetter ? Math.max(...nums) : Math.min(...nums);
  if (nums.every((n) => n === target)) return -1;
  return values.findIndex((n) => n === target);
}

const ROWS = [
  { key: 'status', label: 'Status', render: (v) => <StatusPill validator={v} /> },
  { key: 'stake', label: 'Active stake', pick: (v) => v.activatedStake, better: true, render: (v) => (isNum(v.activatedStake) ? <span className="tabular">{compact(v.activatedStake)} XNT</span> : <Unavailable />) },
  { key: 'share', label: 'Share of total stake', pick: (v) => stakeShare(v), better: true, render: (v) => (stakeShare(v) === null ? <Unavailable /> : <span className="tabular">{percent(stakeShare(v), 2)}</span>) },
  { key: 'commission', label: 'Commission', pick: (v) => v.commission, better: false, render: (v) => <CommissionValue validator={v} /> },
  { key: 'voteRate', label: 'Vote rate (this epoch)', pick: (v) => v.voteRate, better: true, render: (v) => <VoteRateValue validator={v} /> },
  { key: 'skipRate', label: 'Skip rate (this epoch)', pick: (v) => v.skipRate, better: false, render: (v) => <SkipRateValue validator={v} /> },
  { key: 'leaderSlots', label: 'Leader slots (this epoch)', pick: (v) => v.leaderSlots, better: true, render: (v) => (isNum(v.leaderSlots) ? <span className="tabular">{integer(v.leaderSlots)}</span> : <Unavailable reason="No leader slot data this epoch" />) },
  { key: 'blocks', label: 'Blocks produced (this epoch)', pick: (v) => v.blocksProduced, better: true, render: (v) => (isNum(v.blocksProduced) ? <span className="tabular">{integer(v.blocksProduced)}</span> : <Unavailable reason="No block production data this epoch" />) },
  { key: 'lag', label: 'Last-vote lag', pick: (v) => v.voteLag, better: false, render: (v) => (isNum(v.voteLag) ? <span className="tabular">{integer(v.voteLag)} slots</span> : <Unavailable reason="Last vote slot unknown" />) },
  { key: 'version', label: 'Software version', render: (v) => <VersionValue validator={v} /> },
  { key: 'country', label: 'Country', render: (v) => (v.location?.country ? <span>{v.location.country}</span> : <Unavailable reason="The node address could not be resolved to a location" />) },
];

function CreditsChart({ validators, epoch }) {
  const { epochs, byValidator } = useMemo(() => {
    const per = validators.map((v) => creditsPerEpoch(v.epochCredits, epoch));
    const set = new Set();
    per.forEach((rows) => rows.forEach((r) => set.add(r.epoch)));
    return { epochs: [...set].sort((a, b) => a - b), byValidator: per.map((rows) => new Map(rows.map((r) => [r.epoch, r]))) };
  }, [validators, epoch]);

  const max = Math.max(0, ...byValidator.flatMap((m) => [...m.values()].map((r) => r.earned)));
  if (epochs.length === 0 || max === 0) {
    return <p className="px-4 py-8 text-center text-sm text-ink-muted">The RPC returned no epoch credit history for these validators.</p>;
  }

  return (
    <figure className="p-4">
      <div className="flex items-end gap-3 sm:gap-6" style={{ height: 180 }} aria-hidden="true">
        {epochs.map((e) => (
          <div key={e} className="flex h-full min-w-0 flex-1 items-end justify-center gap-1">
            {validators.map((v, i) => {
              const r = byValidator[i].get(e);
              return r ? (
                <div key={v.votePubkey} className={cn('w-full max-w-[28px] rounded-t', SERIES[i].bar, r.inProgress && 'opacity-50')} style={{ height: `${Math.max(2, (r.earned / max) * 100)}%` }} />
              ) : <div key={v.votePubkey} className="w-full max-w-[28px]" />;
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 sm:gap-6" aria-hidden="true">
        {epochs.map((e) => <span key={e} className="flex-1 text-center text-[11px] tabular text-ink-muted">Epoch {e}{e === epoch ? ' (in progress)' : ''}</span>)}
      </div>
      <figcaption className="mt-3 text-xs text-ink-muted">
        Vote credits earned per epoch, as returned by getVoteAccounts (about the last five epochs). The current epoch is partial. This is the only per-validator history the RPC provides.
      </figcaption>
      <div className="mt-3 overflow-x-auto">
        <table className="data-table">
          <caption className="sr-only">Vote credits earned per epoch for each compared validator</caption>
          <thead>
            <tr>
              <th scope="col">Epoch</th>
              {validators.map((v, i) => (
                <th key={v.votePubkey} scope="col" className="text-right">
                  <span className="inline-flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', SERIES[i].dot)} aria-hidden="true" />{v.name || v.votePubkey.slice(0, 6)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {epochs.map((e) => (
              <tr key={e}>
                <th scope="row" className="tabular">{e}{e === epoch ? ' (in progress)' : ''}</th>
                {validators.map((v, i) => {
                  const r = byValidator[i].get(e);
                  return <td key={v.votePubkey} className="text-right tabular">{r ? integer(r.earned) : <Unavailable reason="Epoch not returned by the RPC" />}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

export default function ValidatorCompare({ validators, epoch = null, onRemove }) {
  const best = useMemo(() => {
    const out = {};
    ROWS.forEach((row) => { if (row.pick) out[row.key] = bestIndex(validators.map(row.pick), row.better); });
    return out;
  }, [validators]);

  return (
    <div className="space-y-6">
      <Panel title="Side by side" description="Measured on-chain values for the current epoch. The best value in a row is marked when at least two validators have it.">
        <div className="overflow-x-auto">
          <table className="data-table">
            <caption className="sr-only">Comparison of {validators.length} validators</caption>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                {validators.map((v, i) => (
                  <th key={v.votePubkey} scope="col" className="min-w-[160px] normal-case tracking-normal">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={validatorUrl(v)} className="min-w-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
                        <ValidatorIdentity validator={v} size={28} />
                      </Link>
                      {onRemove && (
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-ink-muted hover:bg-surface-3 hover:text-ink" onClick={() => onRemove(v.votePubkey)} aria-label={`Remove ${v.name || v.votePubkey} from comparison`}>
                          <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                    <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-ink-muted"><span className={cn('h-2 w-2 rounded-full', SERIES[i].dot)} aria-hidden="true" />Series {i + 1}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="whitespace-nowrap text-xs font-normal text-ink-muted">{row.label}</th>
                  {validators.map((v, i) => (
                    <td key={v.votePubkey}>
                      <span className="inline-flex items-center gap-2">
                        {row.render(v)}
                        {best[row.key] === i && <span className="rounded-full border border-brand/25 bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand">Best</span>}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Vote credits by epoch" description="Credits earned per epoch from getVoteAccounts">
        <CreditsChart validators={validators} epoch={epoch} />
      </Panel>
    </div>
  );
}
