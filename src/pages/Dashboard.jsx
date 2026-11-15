import { useMemo } from 'react';
import { Activity, Boxes, Clock, Coins, Layers, Server, Timer, Zap } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { Freshness, Meter, Panel, StatCard } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, Skeleton, StatSkeleton, Unavailable } from '@/components/ds/States';
import NetworkAnomalyAlert from '@/components/ai/NetworkAnomalyAlert';
import QuickLinks from '@/components/dashboard/QuickLinks';
import RecentBlocksTable from '@/components/dashboard/RecentBlocksTable';
import usePolling from '@/components/dashboard/usePolling';
import OptimizedChart from '@/components/x1/OptimizedChart';
import BlockActivityStrip, { TxTypeLegend } from '@/components/x1/MempoolViz';
import X1Rpc from '@/components/x1/X1RpcService';
import { api } from '@/lib/x1/api';
import { X1_CONFIG } from '@/lib/x1/config';
import { compact, integer, percent, timeAgo, usd } from '@/lib/format';
import { cn } from '@/lib/utils';

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const PRICE_POLL_MS = 60 * 1000;
const CHART_POLL_MS = 60 * 1000;
const CHART_SAMPLES = 60;

function formatDuration(seconds) {
  if (!isNum(seconds) || seconds < 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function EpochCard({ stats }) {
  const progress = isNum(stats.epochProgress) ? stats.epochProgress * 100 : null;
  const remainingSlots = isNum(stats.slotsInEpoch) && isNum(stats.slotIndex) ? stats.slotsInEpoch - stats.slotIndex : null;
  const eta = remainingSlots !== null && isNum(stats.slotTimeSeconds) ? formatDuration(remainingSlots * stats.slotTimeSeconds) : null;
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">Epoch</p>
        <Layers className="h-4 w-4 text-ink-faint" aria-hidden="true" />
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tabular leading-none text-ink">{integer(stats.epoch)}</p>
      <Meter value={progress ?? undefined} label={`Epoch ${stats.epoch} progress`} className="mt-3" />
      <p className="mt-2 text-xs text-ink-muted">
        {progress !== null ? `${percent(progress, 1)} complete` : <Unavailable reason="Epoch progress not reported" />}
        {eta ? ` · about ${eta} left at the current slot time` : ''}
      </p>
    </div>
  );
}

function PriceCard({ price }) {
  const { status, data, loadedAt } = price;
  const priceUsd = data?.data?.priceUsd;
  let value;
  let hint;
  if (status === 'loading') {
    value = <Skeleton className="h-6 w-24" />;
  } else if (!isNum(priceUsd)) {
    value = <Unavailable reason="No XNT price could be fetched from the price service" />;
    hint = 'Price service unavailable';
  } else {
    value = usd(priceUsd);
    const d = data.data;
    const when = d.priceUpdatedAt || loadedAt;
    hint = `${d.priceSource || 'Unknown source'}${when ? ` · updated ${timeAgo(when)}` : ''}`;
  }
  return <StatCard label="XNT price" icon={Coins} value={value} hint={hint} />;
}

export default function Dashboard() {
  const stats = usePolling(() => api.networkStats(), X1_CONFIG.polling.dashboardMs);
  const price = usePolling(() => api.tokenPrice(X1_CONFIG.nativeMint), PRICE_POLL_MS);
  const blocks = usePolling(() => X1Rpc.getRecentBlocks(10), X1_CONFIG.polling.blocksMs);
  const samples = usePolling(() => X1Rpc.getRecentPerformanceSamples(CHART_SAMPLES), CHART_POLL_MS);

  const s = stats.data;

  const chart = useMemo(() => {
    const list = Array.isArray(samples.data) ? samples.data : [];
    // The RPC returns newest first with no timestamps: derive them from the fetch time and each sample's period.
    let t = samples.loadedAt || 0;
    const points = [];
    for (const smp of list) {
      const secs = Number(smp?.samplePeriodSecs);
      const tx = Number(smp?.numTransactions);
      if (secs > 0 && Number.isFinite(tx)) {
        const nonVote = Number(smp?.numNonVoteTransactions);
        points.push({
          time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          tps: tx / secs,
          userTps: Number.isFinite(nonVote) ? nonVote / secs : null,
        });
      }
      t -= secs * 1000;
    }
    return points.reverse();
  }, [samples.data, samples.loadedAt]);

  const hasUserTps = chart.some((p) => p.userTps !== null);
  const series = [
    { key: 'tps', name: 'Total TPS', color: 'hsl(var(--brand))' },
    ...(hasUserTps ? [{ key: 'userTps', name: 'User TPS (non-vote)', color: 'hsl(var(--violet))' }] : []),
  ];

  const refreshAll = () => { stats.reload(); price.reload(); blocks.reload(); samples.reload(); };
  const anyRefreshing = stats.refreshing || blocks.refreshing || samples.refreshing;

  return (
    <>
      <PageHeader
        icon={Zap}
        title="X1 Network Overview"
        description="Live state of the X1 mainnet: slot, epoch, throughput, validators and the latest confirmed blocks."
        meta={<Freshness at={stats.loadedAt} source="X1 RPC" stale={stats.stale} onRefresh={refreshAll} refreshing={anyRefreshing} />}
      />

      <NetworkAnomalyAlert />

      <section aria-label="Network statistics" className="mb-6">
        {stats.status === 'loading' && <StatSkeleton count={8} />}
        {stats.status === 'error' && (
          <div className="panel">
            <ErrorState title="Network statistics are unavailable" description={stats.error?.message} onRetry={stats.reload} />
          </div>
        )}
        {s && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Slot" icon={Boxes} value={integer(s.slot)} hint={isNum(s.blockHeight) ? `Block height ${integer(s.blockHeight)}` : undefined} />
            <EpochCard stats={s} />
            <StatCard
              label="TPS"
              icon={Activity}
              tone="brand"
              value={isNum(s.tps) ? integer(s.tps) : <Unavailable reason="Performance samples unavailable" />}
              hint={isNum(s.userTps) ? `${integer(s.userTps)} user TPS (non-vote)` : 'Average of the last 5 one-minute samples'}
            />
            <PriceCard price={price} />
            <StatCard
              label="Active validators"
              icon={Server}
              value={s.validators ? integer(s.validators.active) : <Unavailable reason="Vote accounts unavailable" />}
              hint={s.validators ? `${integer(s.validators.delinquent)} delinquent` : undefined}
              tone={s.validators && s.validators.delinquent > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Total stake"
              icon={Coins}
              value={s.stake ? `${compact(s.stake.activeXnt + s.stake.delinquentXnt)} XNT` : <Unavailable reason="Vote accounts unavailable" />}
              hint={s.stake && isNum(s.stake.delinquentShare) ? `${percent(s.stake.delinquentShare * 100, 2)} delinquent` : undefined}
            />
            <StatCard
              label="Slot time"
              icon={Timer}
              value={isNum(s.slotTimeSeconds) ? `${s.slotTimeSeconds.toFixed(2)} s` : <Unavailable reason="Performance samples unavailable" />}
              hint="Average over recent samples"
            />
            <StatCard
              label="Transactions"
              icon={Clock}
              value={isNum(s.transactionCount) ? compact(s.transactionCount) : <Unavailable reason="Not reported by the RPC" />}
              hint="Total processed on chain"
            />
          </div>
        )}
      </section>

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
        <Panel
          className="xl:col-span-3"
          title="Transactions per second"
          description={`One point per minute over the last hour, from RPC performance samples${samples.stale ? ' (stale)' : ''}.`}
          bodyClassName="p-4"
        >
          <div className="h-64">
            {samples.status === 'loading' && <Skeleton className="h-full w-full" />}
            {samples.status === 'error' && <ErrorState title="TPS history is unavailable" description={samples.error?.message} onRetry={samples.reload} className="py-8" />}
            {samples.status === 'ready' && chart.length === 0 && <EmptyState icon={Activity} title="No samples returned" description="The RPC node returned no performance samples." />}
            {samples.status === 'ready' && chart.length > 0 && (
              <OptimizedChart data={chart} series={series} formatValue={(v) => (isNum(v) ? integer(v) : '—')} yLabel="TPS" ariaLabel={`Line chart of transactions per second over the last ${chart.length} minutes`} />
            )}
          </div>
        </Panel>

        <RecentBlocksTable
          className={cn('xl:col-span-2')}
          blocks={blocks.data}
          status={blocks.status}
          error={blocks.error?.message}
          onRetry={blocks.reload}
          limit={6}
        />
      </div>

      <Panel
        className="mb-6"
        title="Latest block activity"
        description="Transactions in the most recent confirmed blocks, split by type."
        actions={<TxTypeLegend className="hidden md:flex" />}
        bodyClassName="p-4"
      >
        {blocks.status === 'loading' && <Skeleton className="h-36 w-full" />}
        {blocks.status === 'error' && !blocks.data && <ErrorState title="Block activity is unavailable" description={blocks.error?.message} onRetry={blocks.reload} className="py-8" />}
        {blocks.status === 'ready' && (blocks.data?.length ? <BlockActivityStrip blocks={blocks.data} limit={10} /> : <EmptyState icon={Boxes} title="No blocks returned" />)}
      </Panel>

      <QuickLinks />
    </>
  );
}
