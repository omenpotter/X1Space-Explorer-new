import { useMemo } from 'react';
import { Activity, Boxes, Network, Server, ShieldCheck, Timer, Zap } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { Freshness, Meter, Panel, Pill, StatCard } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, Skeleton, StatSkeleton, Unavailable } from '@/components/ds/States';
import usePolling from '@/components/dashboard/usePolling';
import OptimizedChart from '@/components/x1/OptimizedChart';
import X1Rpc from '@/components/x1/X1RpcService';
import { api } from '@/lib/x1/api';
import { X1_CONFIG } from '@/lib/x1/config';
import { compact, integer, percent } from '@/lib/format';

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

// Fast data (throughput, slot, stake online) and slow data (validator set, nodes, history) poll separately.
async function loadSlow() {
  const [validators, nodes, production, history] = await Promise.allSettled([
    X1Rpc.getValidatorDetails(),
    X1Rpc.getClusterNodes(),
    X1Rpc.getBlockProduction(),
    api.networkHistory(12),
  ]);
  if ([validators, nodes, production, history].every((r) => r.status === 'rejected')) throw new Error('No data source responded.');
  const val = (r) => (r.status === 'fulfilled' ? r.value : null);
  return { validators: val(validators), nodes: val(nodes), production: val(production), history: val(history) };
}

function blockProduction(p) {
  const by = p?.value?.byIdentity;
  if (!by) return null;
  let leader = 0;
  let produced = 0;
  for (const [l, b] of Object.values(by)) {
    leader += l;
    produced += b;
  }
  return { leader, produced, skipped: leader - produced, skipRate: leader > 0 ? ((leader - produced) / leader) * 100 : null };
}

/** Rows of label / count / share bar. */
function Distribution({ rows, total, unit = 'validators', formatCount = integer }) {
  if (!rows.length || !(total > 0)) return <p className="p-4 text-sm text-ink-muted">No data.</p>;
  return (
    <ul className="space-y-3 p-4">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-ink-soft" title={r.label}>{r.label}</span>
            <span className="shrink-0 tabular text-ink">
              {formatCount(r.value)} {unit}
              <span className="ml-2 text-xs text-ink-muted">{percent((r.value / total) * 100, 1)}</span>
            </span>
          </div>
          <Meter value={r.value} max={total} label={`${r.label}: ${percent((r.value / total) * 100, 1)}`} />
        </li>
      ))}
    </ul>
  );
}

const STATUS = {
  pass: { tone: 'positive', label: 'Within range' },
  warn: { tone: 'warning', label: 'Watch' },
  fail: { tone: 'negative', label: 'Outside range' },
};

export default function NetworkHealth() {
  const fast = usePolling(() => api.networkStats(), X1_CONFIG.polling.dashboardMs);
  const slow = usePolling(loadSlow, X1_CONFIG.polling.validatorsMs);
  const s = fast.data;
  const validators = slow.data?.validators;
  const nodes = slow.data?.nodes;
  const production = useMemo(() => blockProduction(slow.data?.production), [slow.data]);
  const history = slow.data?.history;

  const points = useMemo(() => (history?.data || []).map((p) => ({
    time: new Date(p.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    tps: p.tps,
    userTps: p.userTps,
    slotTime: p.slotTimeSeconds,
  })), [history]);

  const dist = useMemo(() => {
    if (!validators) return null;
    const counts = (keyOf) => {
      const m = new Map();
      for (const v of validators) m.set(keyOf(v), (m.get(keyOf(v)) || 0) + 1);
      return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    };
    const buckets = [['99% or higher', (r) => r >= 99], ['95% to 99%', (r) => r >= 95 && r < 99], ['90% to 95%', (r) => r >= 90 && r < 95], ['Below 90%', (r) => r < 90]];
    const measured = validators.filter((v) => isNum(v.voteRate));
    const voteRows = buckets.map(([label, test]) => ({ label, value: measured.filter((v) => test(v.voteRate)).length }));
    const commissionBuckets = [['0%', (c) => c === 0], ['1% to 5%', (c) => c > 0 && c <= 5], ['6% to 10%', (c) => c > 5 && c <= 10], ['Above 10%', (c) => c > 10]];
    const withCommission = validators.filter((v) => isNum(v.commission) && isNum(v.activatedStake));
    const commissionRows = commissionBuckets.map(([label, test]) => ({ label, value: withCommission.filter((v) => test(v.commission)).reduce((sum, v) => sum + v.activatedStake, 0) }));
    return {
      status: counts((v) => (v.delinquent ? 'Delinquent' : 'Active')),
      version: counts((v) => v.version || 'Version not reported').slice(0, 8),
      voteRows, measured: measured.length,
      commissionRows, commissionTotal: commissionRows.reduce((sum, r) => sum + r.value, 0),
    };
  }, [validators]);

  const stakeOnline = s?.stake && s.stake.activeXnt + s.stake.delinquentXnt > 0 ? (s.stake.activeXnt / (s.stake.activeXnt + s.stake.delinquentXnt)) * 100 : null;

  // Every check states its measured input and its thresholds. There is deliberately no combined score.
  const checks = [
    {
      name: 'Stake online',
      value: isNum(stakeOnline) ? percent(stakeOnline, 2) : null,
      rule: 'Within range at 90% or more; watch below 90%; outside range below 66.7% (the BFT supermajority).',
      status: !isNum(stakeOnline) ? null : stakeOnline >= 90 ? 'pass' : stakeOnline >= 66.7 ? 'warn' : 'fail',
      source: 'getVoteAccounts: active stake / (active + delinquent stake)',
    },
    {
      name: 'Average slot time',
      value: isNum(s?.slotTimeSeconds) ? `${s.slotTimeSeconds.toFixed(2)} s` : null,
      rule: 'Within range up to 0.8 s; watch up to 1.5 s; outside range above 1.5 s (target is about 0.4 s).',
      status: !isNum(s?.slotTimeSeconds) ? null : s.slotTimeSeconds <= 0.8 ? 'pass' : s.slotTimeSeconds <= 1.5 ? 'warn' : 'fail',
      source: 'getRecentPerformanceSamples: sample period / slots, last 5 samples',
    },
    {
      name: 'Throughput',
      value: isNum(s?.tps) ? `${integer(s.tps)} TPS` : null,
      rule: 'Within range at 1 TPS or more; outside range below 1 TPS (effectively stalled).',
      status: !isNum(s?.tps) ? null : s.tps >= 1 ? 'pass' : 'fail',
      source: 'getRecentPerformanceSamples: transactions / sample period, last 5 samples',
    },
    {
      name: 'Skipped leader slots (this epoch)',
      value: isNum(production?.skipRate) ? percent(production.skipRate, 2) : null,
      rule: 'Within range up to 5%; watch up to 10%; outside range above 10%.',
      status: !isNum(production?.skipRate) ? null : production.skipRate <= 5 ? 'pass' : production.skipRate <= 10 ? 'warn' : 'fail',
      source: 'getBlockProduction: (leader slots - blocks produced) / leader slots',
    },
  ];

  const refresh = () => { fast.reload(); slow.reload(); };

  return (
    <>
      <PageHeader
        icon={Activity}
        title="Network Health"
        description="Measured indicators from the X1 RPC, each with its source and threshold. No combined health score is shown."
        meta={<Freshness at={fast.loadedAt} source="X1 RPC" stale={fast.stale} onRefresh={refresh} refreshing={fast.refreshing || slow.refreshing} />}
      />

      <section aria-label="Headline indicators" className="mb-6">
        {fast.status === 'loading' && <StatSkeleton count={6} />}
        {fast.status === 'error' && <div className="panel"><ErrorState title="Network statistics are unavailable" description={fast.error?.message} onRetry={fast.reload} /></div>}
        {s && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="TPS" icon={Zap} tone="brand" value={isNum(s.tps) ? integer(s.tps) : <Unavailable />} hint={isNum(s.userTps) ? `${integer(s.userTps)} user (non-vote)` : undefined} />
            <StatCard label="Slot time" icon={Timer} value={isNum(s.slotTimeSeconds) ? `${s.slotTimeSeconds.toFixed(2)} s` : <Unavailable />} />
            <StatCard label="Active validators" icon={Server} value={s.validators ? integer(s.validators.active) : <Unavailable />} hint={s.validators ? `${integer(s.validators.delinquent)} delinquent` : undefined} />
            <StatCard label="Stake online" icon={ShieldCheck} value={isNum(stakeOnline) ? percent(stakeOnline, 2) : <Unavailable />} hint={s.stake ? `${compact(s.stake.delinquentXnt)} XNT delinquent` : undefined} />
            <StatCard
              label="Skipped slots"
              icon={Boxes}
              value={slow.status === 'loading' ? <Skeleton className="h-6 w-16" /> : isNum(production?.skipRate) ? percent(production.skipRate, 2) : <Unavailable reason="Block production unavailable" />}
              hint="This epoch so far"
            />
            <StatCard label="Cluster nodes" icon={Network} value={slow.status === 'loading' ? <Skeleton className="h-6 w-16" /> : nodes ? integer(nodes.length) : <Unavailable reason="Cluster nodes unavailable" />} hint="Seen in gossip" />
          </div>
        )}
      </section>

      <Panel
        className="mb-6"
        title="Threshold checks"
        description="Each row compares one measured value with a fixed range chosen by this explorer. These are indicators, not a verdict on network health."
      >
        <div className="overflow-x-auto">
          <table className="data-table">
            <caption className="sr-only">Threshold checks on live network values</caption>
            <thead>
              <tr>
                <th scope="col">Check</th>
                <th scope="col" className="text-right">Measured</th>
                <th scope="col">Result</th>
                <th scope="col" className="hidden md:table-cell">Range and source</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.name}>
                  <td className="text-ink">{c.name}</td>
                  <td className="text-right tabular text-ink">{c.value ?? <Unavailable reason="Could not be measured right now" />}</td>
                  <td>{c.status ? <Pill tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Pill> : <Pill>Not measured</Pill>}</td>
                  <td className="hidden text-xs text-ink-muted md:table-cell">
                    <p>{c.rule}</p>
                    <p className="mt-0.5 text-ink-faint">{c.source}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel
          title="Throughput history"
          description={history ? `${history.note} Showing ${history.coveredHours.toFixed(1)} hours of one-minute samples.` : 'The RPC node keeps roughly the last 12 hours of one-minute samples.'}
          bodyClassName="p-4"
        >
          <div className="h-64">
            {slow.status === 'loading' && <Skeleton className="h-full w-full" />}
            {slow.status !== 'loading' && !history && <ErrorState title="History is unavailable" onRetry={slow.reload} className="py-8" />}
            {history && points.length === 0 && <EmptyState icon={Activity} title="No samples returned" />}
            {history && points.length > 0 && (
              <OptimizedChart
                data={points}
                series={[{ key: 'tps', name: 'Total TPS', color: 'hsl(var(--brand))' }, { key: 'userTps', name: 'User TPS (non-vote)', color: 'hsl(var(--violet))' }]}
                yLabel="TPS"
                ariaLabel="Line chart of total and user transactions per second over the last hours"
              />
            )}
          </div>
        </Panel>

        <Panel title="Slot time history" description="Seconds per slot from the same samples (target about 0.4 s)." bodyClassName="p-4">
          <div className="h-64">
            {slow.status === 'loading' && <Skeleton className="h-full w-full" />}
            {slow.status !== 'loading' && !history && <ErrorState title="History is unavailable" onRetry={slow.reload} className="py-8" />}
            {history && points.length > 0 && (
              <OptimizedChart
                data={points}
                series={[{ key: 'slotTime', name: 'Slot time (s)', color: 'hsl(var(--brand))' }]}
                formatValue={(v) => (isNum(v) ? v.toFixed(2) : '—')}
                yLabel="Seconds"
                ariaLabel="Line chart of average slot time over the last hours"
              />
            )}
          </div>
        </Panel>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <Panel title="Block production" description="Current epoch so far (getBlockProduction)">
          {slow.status === 'loading' ? <Skeleton className="m-4 h-24" /> : !production ? <p className="p-4 text-sm text-ink-muted"><Unavailable reason="Block production unavailable" /> Not available right now.</p> : (
            <dl className="divide-y divide-line/60 text-sm">
              <div className="flex justify-between px-4 py-3"><dt className="text-ink-muted">Leader slots</dt><dd className="tabular text-ink">{integer(production.leader)}</dd></div>
              <div className="flex justify-between px-4 py-3"><dt className="text-ink-muted">Blocks produced</dt><dd className="tabular text-positive">{integer(production.produced)}</dd></div>
              <div className="flex justify-between px-4 py-3"><dt className="text-ink-muted">Skipped</dt><dd className="tabular text-ink">{integer(production.skipped)}</dd></div>
            </dl>
          )}
        </Panel>
        <Panel title="Node infrastructure" description="Cluster nodes seen in gossip (getClusterNodes)">
          {slow.status === 'loading' ? <Skeleton className="m-4 h-24" /> : !nodes ? <p className="p-4 text-sm text-ink-muted">Not available right now.</p> : (
            <dl className="divide-y divide-line/60 text-sm">
              <div className="flex justify-between px-4 py-3"><dt className="text-ink-muted">Total nodes</dt><dd className="tabular text-ink">{integer(nodes.length)}</dd></div>
              <div className="flex justify-between px-4 py-3"><dt className="text-ink-muted">Advertising an RPC address</dt><dd className="tabular text-ink">{integer(nodes.filter((n) => n.rpc).length)}</dd></div>
              <div className="flex justify-between px-4 py-3"><dt className="text-ink-muted">Advertising a TPU address</dt><dd className="tabular text-ink">{integer(nodes.filter((n) => n.tpu).length)}</dd></div>
            </dl>
          )}
        </Panel>
        <Panel title="Stake" description="Vote accounts (getVoteAccounts)">
          {fast.status === 'loading' ? <Skeleton className="m-4 h-24" /> : !s?.stake ? <p className="p-4 text-sm text-ink-muted">Not available right now.</p> : (
            <dl className="divide-y divide-line/60 text-sm">
              <div className="flex justify-between px-4 py-3"><dt className="text-ink-muted">Active</dt><dd className="tabular text-ink">{compact(s.stake.activeXnt)} XNT</dd></div>
              <div className="flex justify-between px-4 py-3"><dt className="text-ink-muted">Delinquent</dt><dd className="tabular text-ink">{compact(s.stake.delinquentXnt)} XNT</dd></div>
              <div className="flex justify-between px-4 py-3"><dt className="text-ink-muted">Delinquent share</dt><dd className="tabular text-ink">{isNum(s.stake.delinquentShare) ? percent(s.stake.delinquentShare * 100, 2) : <Unavailable />}</dd></div>
            </dl>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="Validator status">
          {slow.status === 'loading' ? <Skeleton className="m-4 h-24" /> : dist ? <Distribution rows={dist.status} total={validators.length} /> : <p className="p-4 text-sm text-ink-muted">Validator data unavailable.</p>}
        </Panel>
        <Panel title="Software versions" description="As reported by each validator">
          {slow.status === 'loading' ? <Skeleton className="m-4 h-24" /> : dist ? <Distribution rows={dist.version} total={validators.length} /> : <p className="p-4 text-sm text-ink-muted">Validator data unavailable.</p>}
        </Panel>
        <Panel title="Vote rate" description={dist ? `Share of maximum vote credits this epoch, ${integer(dist.measured)} measured validators` : 'Share of maximum vote credits this epoch'}>
          {slow.status === 'loading' ? <Skeleton className="m-4 h-24" /> : dist ? <Distribution rows={dist.voteRows} total={dist.measured} /> : <p className="p-4 text-sm text-ink-muted">Validator data unavailable.</p>}
        </Panel>
        <Panel title="Stake by commission" description="XNT staked, grouped by validator commission">
          {slow.status === 'loading' ? <Skeleton className="m-4 h-24" /> : dist ? <Distribution rows={dist.commissionRows} total={dist.commissionTotal} unit="XNT" formatCount={compact} /> : <p className="p-4 text-sm text-ink-muted">Validator data unavailable.</p>}
        </Panel>
      </div>
    </>
  );
}
