// Shared validator presentation: identity cell, status pill, metric cells, the table row
// used by the Validators page and the data hook every validator page loads through.
// Every value shown here comes from X1Rpc.getValidatorDetails(); missing values render as Unavailable.
import { memo, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { ValidatorAvatar } from '@/components/ds/Avatar';
import { Meter, Pill } from '@/components/ds/Primitives';
import { Unavailable } from '@/components/ds/States';
import X1Rpc from '@/components/x1/X1RpcService';
import { compact, integer, percent, shortAddress } from '@/lib/format';
import { safeUrl } from '@/lib/safeUrl';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

export const VOTE_RATE_HELP = 'Vote rate: share of the maximum vote credits earned this epoch.';
export const SKIP_RATE_HELP = 'Skip rate: share of assigned leader slots this epoch in which no block was produced.';

export const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

/** stakePercent arrives as a string ("1.23"); returns a number or null. */
export function stakeShare(v) {
  const n = parseFloat(v?.stakePercent);
  return Number.isFinite(n) ? n : null;
}

export function validatorUrl(v) {
  return `${createPageUrl('ValidatorDetail')}?id=${encodeURIComponent(v.votePubkey)}`;
}

/** Case-insensitive match on name, vote address and identity address. */
export function matchesValidator(v, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  return (
    String(v.name || '').toLowerCase().includes(q) ||
    String(v.votePubkey || '').toLowerCase().includes(q) ||
    String(v.nodePubkey || '').toLowerCase().includes(q)
  );
}

/** Returns a safe external href for a self-published website, or null. */
export function websiteHref(v) {
  if (!v?.website) return null;
  const href = safeUrl(v.website);
  return /^https?:\/\//i.test(href) ? href : null;
}

/**
 * Loads the validator list (plus the raw epochCredits series from getVoteAccounts and the
 * current epoch) and optionally polls. A failed background refresh keeps the last good data.
 */
export function useValidators(pollMs = 0) {
  const [state, setState] = useState({ status: 'loading', validators: [], epoch: null, error: null, loadedAt: null, refreshFailed: false });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setState((s) => (s.status === 'error' ? { ...s, status: 'loading', error: null } : s));
    try {
      const [list, voteAccounts, epochInfo] = await Promise.all([
        X1Rpc.getValidatorDetails(),
        X1Rpc.getVoteAccounts().catch(() => null),
        X1Rpc.getEpochInfo().catch(() => null),
      ]);
      const credits = new Map();
      if (voteAccounts) {
        for (const a of [...(voteAccounts.current || []), ...(voteAccounts.delinquent || [])]) {
          credits.set(a.votePubkey, Array.isArray(a.epochCredits) ? a.epochCredits : []);
        }
      }
      const validators = (Array.isArray(list) ? list : []).map((v) => ({ ...v, epochCredits: credits.get(v.votePubkey) || null }));
      setState({ status: 'ready', validators, epoch: isNum(epochInfo?.epoch) ? epochInfo.epoch : null, error: null, loadedAt: Date.now(), refreshFailed: false });
    } catch (err) {
      console.error('Failed to load validators:', err);
      setState((s) => (s.status === 'ready' && s.validators.length
        ? { ...s, refreshFailed: true }
        : { status: 'error', validators: [], epoch: null, error: err?.message || 'The X1 RPC did not respond.', loadedAt: null, refreshFailed: false }));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!pollMs) return undefined;
    const id = setInterval(() => {
      if (!document.hidden) load(true);
    }, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  return { ...state, refreshing, reload: load };
}

export function StatusPill({ validator, className }) {
  return validator?.delinquent
    ? <Pill tone="negative" className={className} title="Not voting recently: the cluster reports this vote account as delinquent">Delinquent</Pill>
    : <Pill tone="positive" className={className}>Active</Pill>;
}

/** Name as text. Without a published identity the name is a shortened address, so it is set in mono. */
export function ValidatorName({ validator, className }) {
  const name = validator?.name || shortAddress(validator?.votePubkey);
  return <span className={cn(!validator?.hasIdentity && 'mono', className)} title={validator?.hasIdentity ? undefined : 'No on-chain identity published'}>{name}</span>;
}

/** Avatar, name and shortened vote address. Not a link: wrap it where navigation is wanted. */
export function ValidatorIdentity({ validator, size = 32, sub, className }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-3', className)}>
      <ValidatorAvatar validator={validator} size={size} />
      <span className="min-w-0">
        <ValidatorName validator={validator} className="block truncate text-sm font-medium text-ink" />
        <span className="block truncate text-xs text-ink-muted">{sub ?? <span className="mono">{shortAddress(validator?.votePubkey, 6, 4)}</span>}</span>
      </span>
    </span>
  );
}

const voteTone = (n) => (n >= 95 ? 'text-ink' : n >= 80 ? 'text-warning' : 'text-negative');
const skipTone = (n) => (n < 5 ? 'text-ink' : n < 15 ? 'text-warning' : 'text-negative');

export function VoteRateValue({ validator, digits = 1, className }) {
  const n = validator?.voteRate ?? validator?.uptime;
  if (!isNum(n)) return <Unavailable reason="Vote rate cannot be measured yet this epoch" className={className} />;
  return <span className={cn('tabular', voteTone(n), className)} title={VOTE_RATE_HELP}>{percent(n, digits)}</span>;
}

export function SkipRateValue({ validator, digits = 1, className }) {
  const n = validator?.skipRate;
  if (!isNum(n)) return <Unavailable reason="No leader slots yet this epoch" className={className} />;
  return (
    <span
      className={cn('tabular', skipTone(n), className)}
      title={isNum(validator.leaderSlots) && isNum(validator.blocksProduced) ? `${integer(validator.blocksProduced)} blocks produced in ${integer(validator.leaderSlots)} leader slots this epoch` : SKIP_RATE_HELP}
    >
      {percent(n, digits)}
    </span>
  );
}

export function CommissionValue({ validator, className }) {
  return isNum(validator?.commission)
    ? <span className={cn('tabular', className)}>{validator.commission}%</span>
    : <Unavailable reason="Commission not reported" className={className} />;
}

export function VersionValue({ validator, className }) {
  return validator?.version
    ? <span className={cn('mono', className)}>{validator.version}</span>
    : <Unavailable reason="Node is not visible in gossip, so its software version is unknown" className={className} />;
}

/** Table row for the Validators page. Column visibility must match the header in Validators.jsx. */
const ValidatorCard = memo(function ValidatorCard({ validator: v, rank, maxShare }) {
  const share = stakeShare(v);
  const site = websiteHref(v);
  return (
    <tr>
      <td className="hidden w-12 text-ink-faint tabular sm:table-cell">{rank}</td>
      <td className="max-w-[240px]">
        <div className="flex items-center gap-2">
          <Link to={validatorUrl(v)} className="min-w-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
            <ValidatorIdentity validator={v} />
          </Link>
          {site && (
            <a href={site} target="_blank" rel="noopener noreferrer" aria-label={`Website published by ${v.name} (opens in a new tab)`} className="hidden shrink-0 rounded p-1 text-ink-faint transition-colors hover:text-ink sm:inline-flex">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      </td>
      <td className="text-right">
        <span className="block whitespace-nowrap tabular text-ink">{compact(v.activatedStake)} <span className="text-ink-muted">XNT</span></span>
        <span className="mt-1 flex items-center justify-end gap-2">
          <Meter value={share ?? 0} max={maxShare || 100} label={`${v.name} share of total stake`} className="hidden w-16 sm:block" />
          <span className="text-xs tabular text-ink-muted">{share === null ? <Unavailable reason="Stake share unknown" /> : percent(share, 2)}</span>
        </span>
      </td>
      <td className="hidden text-right md:table-cell"><CommissionValue validator={v} /></td>
      <td className="hidden text-right sm:table-cell"><VoteRateValue validator={v} /></td>
      <td className="hidden text-right lg:table-cell"><SkipRateValue validator={v} /></td>
      <td className="hidden text-xs text-ink-soft xl:table-cell"><VersionValue validator={v} /></td>
      <td className="text-right"><StatusPill validator={v} /></td>
    </tr>
  );
});

export default ValidatorCard;
