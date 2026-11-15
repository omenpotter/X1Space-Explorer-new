import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ValidatorAvatar } from '@/components/ds/Avatar';
import { Panel } from '@/components/ds/Primitives';
import { integer, percent } from '@/lib/format';
import { ValidatorName, validatorUrl } from './ValidatorCard';

// One hue, stepped opacity: rank order is carried by position and the numbered legend, not by colour.
const OPACITY = [1, 0.88, 0.78, 0.68, 0.6, 0.52, 0.45, 0.38, 0.32, 0.26];

/**
 * Stake concentration computed from the live validator list: the ten largest validators,
 * everyone else, and how many validators together hold more than one third of the stake.
 */
export default function StakeDistribution({ validators, className }) {
  const { top, others, total, superminority } = useMemo(() => {
    const sorted = [...(validators || [])].filter((v) => Number.isFinite(v.activatedStake)).sort((a, b) => b.activatedStake - a.activatedStake);
    const sum = sorted.reduce((s, v) => s + v.activatedStake, 0);
    let acc = 0;
    let count = 0;
    for (const v of sorted) {
      acc += v.activatedStake;
      count += 1;
      if (acc > sum / 3) break;
    }
    return {
      top: sorted.slice(0, 10),
      others: { count: Math.max(0, sorted.length - 10), stake: sorted.slice(10).reduce((s, v) => s + v.activatedStake, 0) },
      total: sum,
      superminority: sum > 0 ? count : null,
    };
  }, [validators]);

  if (!(total > 0)) return null;
  const share = (stake) => (stake / total) * 100;

  return (
    <Panel
      title="Stake distribution"
      description={superminority ? `The ${integer(superminority)} largest validator${superminority === 1 ? '' : 's'} together hold more than one third of all active stake.` : undefined}
      className={className}
      bodyClassName="p-4"
    >
      <div className="flex h-3 w-full gap-px overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`Top ${top.length} validators hold ${percent(share(total - others.stake), 1)} of stake; ${integer(others.count)} others hold ${percent(share(others.stake), 1)}`}>
        {top.map((v, i) => (
          <span key={v.votePubkey} className="h-full bg-brand" style={{ width: `${share(v.activatedStake)}%`, opacity: OPACITY[i] }} />
        ))}
      </div>

      <ol className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-5">
        {top.map((v, i) => (
          <li key={v.votePubkey}>
            <Link to={validatorUrl(v)} className="flex items-center gap-2 rounded px-1 py-1 text-xs transition-colors hover:bg-surface-2">
              <span className="w-4 shrink-0 text-right tabular text-ink-faint">{i + 1}</span>
              <ValidatorAvatar validator={v} size={20} />
              <ValidatorName validator={v} className="min-w-0 flex-1 truncate text-ink-soft" />
              <span className="shrink-0 tabular text-ink">{percent(share(v.activatedStake), 1)}</span>
            </Link>
          </li>
        ))}
        {others.count > 0 && (
          <li className="flex items-center gap-2 px-1 py-1 text-xs">
            <span className="w-4 shrink-0" aria-hidden="true" />
            <span className="h-5 w-5 shrink-0 rounded-full border border-line bg-surface-3" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-ink-muted">{integer(others.count)} others</span>
            <span className="shrink-0 tabular text-ink">{percent(share(others.stake), 1)}</span>
          </li>
        )}
      </ol>
    </Panel>
  );
}
