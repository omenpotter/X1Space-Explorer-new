import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Scale, Search, SearchX, Server, Trophy } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { Freshness, Panel, StatCard } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, StatSkeleton, TableSkeleton } from '@/components/ds/States';
import { Button } from '@/components/ui/button';
import ExportButton from '@/components/common/ExportButton';
import ValidatorCard, { SKIP_RATE_HELP, VOTE_RATE_HELP, isNum, matchesValidator, stakeShare, useValidators } from '@/components/validators/ValidatorCard';
import StakeDistribution from '@/components/validators/StakeDistribution';
import { X1_CONFIG } from '@/lib/x1/config';
import { compact, integer, percent } from '@/lib/format';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

const PER_PAGE = 25;
const outlineBtn = 'border-line-strong bg-transparent text-ink-soft hover:bg-surface-3 hover:text-ink';
const selectClass = 'h-9 rounded-lg border border-line bg-surface-2 px-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/25';

// Column definitions. `cls` controls responsive visibility and must match the cells in ValidatorCard.
const COLUMNS = [
  { key: 'name', label: 'Validator', sort: 'name', cls: '' },
  { key: 'activatedStake', label: 'Stake', sort: 'activatedStake', cls: 'text-right', right: true },
  { key: 'commission', label: 'Commission', sort: 'commission', cls: 'hidden text-right md:table-cell', right: true },
  { key: 'voteRate', label: 'Vote rate', sort: 'voteRate', cls: 'hidden text-right sm:table-cell', right: true, help: VOTE_RATE_HELP },
  { key: 'skipRate', label: 'Skip rate', sort: 'skipRate', cls: 'hidden text-right lg:table-cell', right: true, help: SKIP_RATE_HELP },
  { key: 'version', label: 'Version', sort: 'version', cls: 'hidden xl:table-cell' },
  { key: 'status', label: 'Status', sort: null, cls: 'text-right', right: true },
];

/** Sort with missing values always last, whatever the direction. */
function compare(a, b, key, dir) {
  const text = key === 'name' || key === 'version';
  const x = a[key];
  const y = b[key];
  const xMissing = text ? !x : !isNum(x);
  const yMissing = text ? !y : !isNum(y);
  if (xMissing || yMissing) return xMissing === yMissing ? 0 : xMissing ? 1 : -1;
  const d = text ? String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' }) : x - y;
  return dir === 'asc' ? d : -d;
}

export default function Validators() {
  const [params, setParams] = useSearchParams();
  const urlSearch = params.get('search') || '';
  const { status, validators, error, loadedAt, refreshFailed, refreshing, reload } = useValidators(X1_CONFIG.polling.validatorsMs);

  const [query, setQuery] = useState(urlSearch);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'activatedStake', dir: 'desc' });
  const [page, setPage] = useState(1);

  // Follow the URL when the global search navigates here again with a new term.
  useEffect(() => { setQuery(urlSearch); setPage(1); }, [urlSearch]);

  const onSearch = (value) => {
    setQuery(value);
    setPage(1);
    const next = new URLSearchParams(params);
    if (value.trim()) next.set('search', value.trim());
    else next.delete('search');
    setParams(next, { replace: true });
  };

  const toggleSort = (key) => {
    setPage(1);
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'name' || key === 'commission' || key === 'skipRate' ? 'asc' : 'desc' }));
  };

  const stats = useMemo(() => {
    const active = validators.filter((v) => !v.delinquent);
    const totalStake = validators.reduce((s, v) => s + (isNum(v.activatedStake) ? v.activatedStake : 0), 0);
    const delinquentStake = validators.filter((v) => v.delinquent).reduce((s, v) => s + (isNum(v.activatedStake) ? v.activatedStake : 0), 0);
    const rates = active.map((v) => v.voteRate).filter(isNum);
    return {
      total: validators.length,
      active: active.length,
      delinquent: validators.length - active.length,
      totalStake,
      delinquentShare: totalStake > 0 ? (delinquentStake / totalStake) * 100 : null,
      avgVoteRate: rates.length ? rates.reduce((s, n) => s + n, 0) / rates.length : null,
      measured: rates.length,
      maxShare: Math.max(0, ...validators.map((v) => stakeShare(v) ?? 0)),
    };
  }, [validators]);

  const rows = useMemo(() => {
    const filtered = validators.filter((v) => {
      if (statusFilter === 'active' && v.delinquent) return false;
      if (statusFilter === 'delinquent' && !v.delinquent) return false;
      return matchesValidator(v, query);
    });
    return filtered.sort((a, b) => compare(a, b, sort.key, sort.dir));
  }, [validators, query, statusFilter, sort]);

  // Rank is always by stake across the whole set, independent of the current sort or filter.
  const rankOf = useMemo(() => {
    const m = new Map();
    [...validators].sort((a, b) => b.activatedStake - a.activatedStake).forEach((v, i) => m.set(v.votePubkey, i + 1));
    return m;
  }, [validators]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, totalPages);
  const pageRows = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const exportData = useMemo(() => rows.map((v) => ({
    name: v.name || '',
    votePubkey: v.votePubkey,
    identityPubkey: v.nodePubkey,
    stakeXNT: v.activatedStake,
    stakeSharePercent: v.stakePercent,
    commissionPercent: v.commission,
    voteRatePercent: isNum(v.voteRate) ? Number(v.voteRate.toFixed(2)) : '',
    skipRatePercent: isNum(v.skipRate) ? Number(v.skipRate.toFixed(2)) : '',
    version: v.version || '',
    status: v.delinquent ? 'delinquent' : 'active',
  })), [rows]);

  const clearFilters = () => { onSearch(''); setStatusFilter('all'); };

  return (
    <>
      <PageHeader
        icon={Server}
        title="Validators"
        description="Every vote account on X1 mainnet with its stake, commission and measured performance for the current epoch."
        meta={<Freshness at={loadedAt} stale={refreshFailed} source="X1 RPC · on-chain identity" onRefresh={() => reload(true)} refreshing={refreshing} />}
        actions={
          <>
            <Button asChild variant="outline" size="sm" className={outlineBtn}>
              <Link to={createPageUrl('Leaderboard')}><Trophy className="mr-2 h-4 w-4" aria-hidden="true" />Leaderboard</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className={outlineBtn}>
              <Link to={createPageUrl('ValidatorCompare')}><Scale className="mr-2 h-4 w-4" aria-hidden="true" />Compare</Link>
            </Button>
          </>
        }
      />

      {status === 'loading' && (
        <>
          <StatSkeleton />
          <Panel className="mt-6"><TableSkeleton rows={10} columns={6} /></Panel>
        </>
      )}

      {status === 'error' && (
        <Panel><ErrorState title="Validator data is unavailable" description={error} onRetry={() => reload()} /></Panel>
      )}

      {status === 'ready' && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Validators" value={integer(stats.total)} hint={`${integer(stats.active)} active · ${integer(stats.delinquent)} delinquent`} tone="brand" />
            <StatCard label="Total stake" value={`${compact(stats.totalStake)} XNT`} hint="Active stake across all vote accounts" />
            <StatCard
              label="Delinquent stake"
              value={stats.delinquentShare === null ? '—' : percent(stats.delinquentShare, 2)}
              hint={`${integer(stats.delinquent)} validator${stats.delinquent === 1 ? '' : 's'} not voting`}
              tone={stats.delinquentShare !== null && stats.delinquentShare > 5 ? 'warning' : 'default'}
            />
            <StatCard
              label="Average vote rate"
              value={stats.avgVoteRate === null ? '—' : percent(stats.avgVoteRate, 1)}
              hint={stats.avgVoteRate === null ? 'Cannot be measured yet this epoch' : `Mean of ${integer(stats.measured)} active validators, this epoch`}
            />
          </div>

          <StakeDistribution validators={validators} className="mb-6" />

          <Panel
            title="All validators"
            description={`${integer(rows.length)} of ${integer(stats.total)} shown`}
            actions={<ExportButton data={exportData} filename="x1_validators" />}
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <div className="relative min-w-0 flex-1 basis-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="Name, vote address or identity address"
                  aria-label="Search validators"
                  className="h-9 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/25"
                />
              </div>
              <select aria-label="Filter by status" className={selectClass} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="delinquent">Delinquent</option>
              </select>
              {/* Sorting stays reachable on narrow screens where sortable columns are hidden. */}
              <select aria-label="Sort validators" className={cn(selectClass, 'lg:hidden')} value={`${sort.key}:${sort.dir}`} onChange={(e) => { const [key, dir] = e.target.value.split(':'); setSort({ key, dir }); setPage(1); }}>
                <option value="activatedStake:desc">Stake, high to low</option>
                <option value="activatedStake:asc">Stake, low to high</option>
                <option value="name:asc">Name, A to Z</option>
                <option value="name:desc">Name, Z to A</option>
                <option value="commission:asc">Commission, low to high</option>
                <option value="commission:desc">Commission, high to low</option>
                <option value="voteRate:desc">Vote rate, high to low</option>
                <option value="voteRate:asc">Vote rate, low to high</option>
                <option value="skipRate:asc">Skip rate, low to high</option>
                <option value="skipRate:desc">Skip rate, high to low</option>
                <option value="version:desc">Version, newest first</option>
                <option value="version:asc">Version, oldest first</option>
              </select>
            </div>

            {rows.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title={stats.total === 0 ? 'The RPC returned no validators' : 'No validators match'}
                description={stats.total === 0 ? 'getVoteAccounts returned an empty list.' : 'Try a different name or address, or clear the filters.'}
                action={stats.total > 0 ? <Button variant="outline" size="sm" className={outlineBtn} onClick={clearFilters}>Clear filters</Button> : undefined}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">X1 validators with stake, commission, vote rate, skip rate, version and status</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="hidden w-12 sm:table-cell" title="Rank by stake">#</th>
                      {COLUMNS.map((c) => {
                        const active = sort.key === c.sort;
                        const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
                        return (
                          <th key={c.key} scope="col" className={c.cls} aria-sort={c.sort ? (active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}>
                            {c.sort ? (
                              <button type="button" onClick={() => toggleSort(c.sort)} title={c.help} className={cn('inline-flex items-center gap-1 rounded uppercase tracking-[0.08em] transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40', active && 'text-ink')}>
                                {c.label}
                                <Icon className="h-3 w-3" aria-hidden="true" />
                              </button>
                            ) : c.label}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((v) => (
                      <ValidatorCard key={v.votePubkey} validator={v} rank={rankOf.get(v.votePubkey)} maxShare={stats.maxShare} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {rows.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <p className="text-xs text-ink-muted tabular" aria-live="polite">
                  {integer((current - 1) * PER_PAGE + 1)}–{integer(Math.min(current * PER_PAGE, rows.length))} of {integer(rows.length)}
                </p>
                <nav className="flex items-center gap-2" aria-label="Pagination">
                  <Button variant="outline" size="sm" className={outlineBtn} onClick={() => setPage(current - 1)} disabled={current <= 1} aria-label="Previous page">
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <span className="text-xs text-ink-muted tabular">Page {current} of {totalPages}</span>
                  <Button variant="outline" size="sm" className={outlineBtn} onClick={() => setPage(current + 1)} disabled={current >= totalPages} aria-label="Next page">
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </nav>
              </div>
            )}
          </Panel>

          <p className="mt-4 text-xs text-ink-faint">
            {VOTE_RATE_HELP} {SKIP_RATE_HELP} A dash means the value cannot be measured yet (for skip rate: no leader slots yet this epoch).
            Names, websites and icons are self-published by operators on chain and are not verified. Rank (#) is by stake. The meter under each stake is relative to the largest validator.
          </p>
        </>
      )}
    </>
  );
}
