import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Scale, Search, SearchX, Star, Trophy } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { Freshness, Panel, StatCard } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, StatSkeleton, TableSkeleton } from '@/components/ds/States';
import { Button } from '@/components/ui/button';
import { CommissionValue, SkipRateValue, StatusPill, ValidatorIdentity, VoteRateValue, isNum, matchesValidator, stakeShare, useValidators, validatorUrl } from '@/components/validators/ValidatorCard';
import { X1_CONFIG } from '@/lib/x1/config';
import { compact, integer, percent } from '@/lib/format';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

const outlineBtn = 'border-line-strong bg-transparent text-ink-soft hover:bg-surface-3 hover:text-ink';
const selectClass = 'h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/25';
const FOLLOW_KEY = 'x1space-followed-validators';
const TOP_N = 50;

// Each metric defines which validators qualify, the direction and the plain-language basis.
const METRICS = {
  stake: {
    label: 'Stake, high to low',
    value: (v) => (isNum(v.activatedStake) ? v.activatedStake : null),
    dir: 'desc',
    basis: 'Ranked by active stake (XNT delegated to the validator), highest first.',
    missing: 'have no stake figure',
  },
  commission: {
    label: 'Commission, low to high',
    value: (v) => (isNum(v.commission) ? v.commission : null),
    dir: 'asc',
    basis: 'Ranked by commission, lowest first. Commission is the share of staking rewards the validator keeps. Ties are broken by higher stake.',
    missing: 'report no commission',
  },
  voteRate: {
    label: 'Vote rate, high to low',
    value: (v) => (isNum(v.voteRate) ? v.voteRate : null),
    dir: 'desc',
    basis: 'Ranked by vote rate: the share of the maximum vote credits earned so far this epoch, highest first. Ties are broken by higher stake.',
    missing: 'have no measurable vote rate yet this epoch',
  },
  skipRate: {
    label: 'Skip rate, low to high',
    value: (v) => (isNum(v.skipRate) ? v.skipRate : null),
    dir: 'asc',
    basis: 'Ranked by skip rate: the share of assigned leader slots this epoch in which no block was produced, lowest first. Only validators that have had leader slots this epoch are ranked. Ties are broken by more leader slots, then higher stake. Few leader slots make a rate noisy, so check the leader slot count.',
    missing: 'have had no leader slots this epoch',
  },
};

/** Reads followed vote addresses from localStorage; anything that is not an array of strings is dropped. */
function readFollowed() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FOLLOW_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string' && x.length > 0 && x.length < 100).slice(0, 500) : [];
  } catch {
    return [];
  }
}

export default function Leaderboard() {
  const { status, validators, error, loadedAt, refreshFailed, refreshing, reload } = useValidators(X1_CONFIG.polling.validatorsMs);
  const [metric, setMetric] = useState('stake');
  const [includeDelinquent, setIncludeDelinquent] = useState(false);
  const [followedOnly, setFollowedOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [followed, setFollowed] = useState(readFollowed);

  useEffect(() => {
    try {
      localStorage.setItem(FOLLOW_KEY, JSON.stringify(followed));
    } catch {
      // Storage unavailable: following lasts for this visit only.
    }
  }, [followed]);

  const toggleFollow = useCallback((id) => {
    setFollowed((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const m = METRICS[metric];

  const { ranked, excluded, pool } = useMemo(() => {
    const poolList = validators.filter((v) => includeDelinquent || !v.delinquent);
    const withMetric = poolList.filter((v) => m.value(v) !== null);
    withMetric.sort((a, b) => {
      const d = m.value(a) - m.value(b);
      if (d !== 0) return m.dir === 'asc' ? d : -d;
      if (metric === 'skipRate' && (b.leaderSlots || 0) !== (a.leaderSlots || 0)) return (b.leaderSlots || 0) - (a.leaderSlots || 0);
      return (b.activatedStake || 0) - (a.activatedStake || 0);
    });
    return { ranked: withMetric, excluded: poolList.length - withMetric.length, pool: poolList.length };
  }, [validators, includeDelinquent, m, metric]);

  const rows = useMemo(() => {
    const withRank = ranked.map((v, i) => ({ v, rank: i + 1 }));
    const filtered = withRank.filter(({ v }) => (!followedOnly || followed.includes(v.votePubkey)) && matchesValidator(v, query));
    return query || followedOnly ? filtered : filtered.slice(0, TOP_N);
  }, [ranked, followedOnly, followed, query]);

  const compareHref = `${createPageUrl('ValidatorCompare')}?ids=${rows.slice(0, 3).map(({ v }) => encodeURIComponent(v.votePubkey)).join(',')}`;
  const leader = ranked[0];

  return (
    <>
      <PageHeader
        icon={Trophy}
        title="Validator leaderboard"
        description="Rank X1 validators by a measured on-chain metric. Pick the metric: there is no combined score."
        meta={<Freshness at={loadedAt} stale={refreshFailed} source="X1 RPC" onRefresh={() => reload(true)} refreshing={refreshing} />}
        back={{ label: 'Validators', to: createPageUrl('Validators') }}
        actions={rows.length >= 2 ? (
          <Button asChild variant="outline" size="sm" className={outlineBtn}>
            <Link to={compareHref}><Scale className="mr-2 h-4 w-4" aria-hidden="true" />Compare top 3 shown</Link>
          </Button>
        ) : null}
      />

      {status === 'loading' && (
        <>
          <StatSkeleton count={3} />
          <Panel className="mt-6"><TableSkeleton rows={10} columns={6} /></Panel>
        </>
      )}

      {status === 'error' && <Panel><ErrorState title="Validator data is unavailable" description={error} onRetry={() => reload()} /></Panel>}

      {status === 'ready' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard label="Ranked" value={integer(ranked.length)} hint={`of ${integer(pool)} ${includeDelinquent ? 'validators' : 'active validators'}`} tone="brand" />
            <StatCard label="Not ranked" value={integer(excluded)} hint={excluded ? `Validators that ${m.missing}` : 'Every validator has this metric'} />
            <StatCard label="Leader" value={leader ? (leader.name || '—') : '—'} hint={leader ? `${m.label.split(',')[0]}: ${metric === 'stake' ? `${compact(leader.activatedStake)} XNT` : `${m.value(leader).toFixed(metric === 'commission' ? 0 : 2)}%`}` : 'No ranked validators'} className="col-span-2 lg:col-span-1" />
          </div>

          <Panel title="Ranking basis" bodyClassName="px-4 pb-4 pt-3">
            <p className="text-sm text-ink-soft">{m.basis}</p>
            <p className="mt-2 text-xs text-ink-muted">
              Only validators that have this metric are ranked; validators without it are left out rather than counted as zero. Delinquent validators are {includeDelinquent ? 'included' : 'excluded'}. Values are for the current epoch and refresh every {Math.round(X1_CONFIG.polling.validatorsMs / 1000)} seconds.
            </p>
          </Panel>

          <Panel title={`Top validators by ${m.label.split(',')[0].toLowerCase()}`} description={`${integer(rows.length)} shown`}>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <div className="relative min-w-0 flex-1 basis-48">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or address" aria-label="Search the leaderboard" className="h-9 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/25" />
              </div>
              <select aria-label="Rank by" className={selectClass} value={metric} onChange={(e) => setMetric(e.target.value)}>
                {Object.entries(METRICS).map(([k, x]) => <option key={k} value={k}>{x.label}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input type="checkbox" checked={includeDelinquent} onChange={(e) => setIncludeDelinquent(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                Include delinquent
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input type="checkbox" checked={followedOnly} onChange={(e) => setFollowedOnly(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                Followed only
              </label>
            </div>

            {rows.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title={ranked.length === 0 ? 'No validator has this metric yet' : followedOnly && followed.length === 0 ? 'You are not following anyone' : 'No validators match'}
                description={ranked.length === 0 ? `Validators that ${m.missing} are not ranked. Try another metric.` : 'Try a different search or clear the filters.'}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">Validators ranked by {m.label.toLowerCase()}</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="w-12">Rank</th>
                      <th scope="col">Validator</th>
                      <th scope="col" className="text-right">Stake</th>
                      <th scope="col" className="hidden text-right md:table-cell">Commission</th>
                      <th scope="col" className="hidden text-right sm:table-cell">Vote rate</th>
                      <th scope="col" className="hidden text-right lg:table-cell">Skip rate</th>
                      <th scope="col" className="hidden text-right xl:table-cell">Leader slots</th>
                      <th scope="col" className="text-right">Status</th>
                      <th scope="col" className="w-10"><span className="sr-only">Follow</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ v, rank }) => {
                      const isFollowed = followed.includes(v.votePubkey);
                      const share = stakeShare(v);
                      return (
                        <tr key={v.votePubkey}>
                          <td className="tabular text-ink-soft">{rank}</td>
                          <td className="max-w-[240px]">
                            <Link to={validatorUrl(v)} className="block min-w-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"><ValidatorIdentity validator={v} /></Link>
                          </td>
                          <td className="text-right">
                            <span className="block whitespace-nowrap tabular text-ink">{compact(v.activatedStake)} <span className="text-ink-muted">XNT</span></span>
                            <span className="text-xs tabular text-ink-muted">{share === null ? DASH_SHARE : percent(share, 2)}</span>
                          </td>
                          <td className="hidden text-right md:table-cell"><CommissionValue validator={v} /></td>
                          <td className="hidden text-right sm:table-cell"><VoteRateValue validator={v} /></td>
                          <td className="hidden text-right lg:table-cell"><SkipRateValue validator={v} /></td>
                          <td className="hidden text-right tabular text-ink-soft xl:table-cell">{isNum(v.leaderSlots) ? integer(v.leaderSlots) : '—'}</td>
                          <td className="text-right"><StatusPill validator={v} /></td>
                          <td>
                            <button type="button" onClick={() => toggleFollow(v.votePubkey)} aria-pressed={isFollowed} aria-label={`${isFollowed ? 'Unfollow' : 'Follow'} ${v.name || v.votePubkey}`} className="rounded p-1 text-ink-faint transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
                              <Star className={cn('h-4 w-4', isFollowed && 'fill-warning text-warning')} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!query && !followedOnly && ranked.length > TOP_N && (
              <p className="border-t border-line px-4 py-3 text-xs text-ink-muted">Showing the top {TOP_N} of {integer(ranked.length)}. Search by name or address to find a validator further down.</p>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}

const DASH_SHARE = '—';
