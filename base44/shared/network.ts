// Live network statistics computed from RPC. Nothing is stored or estimated:
// when a value cannot be measured it is returned as null.
import type { Cache } from './cache.ts';
import type { RpcCall } from './rpc.ts';

interface Ctx {
  rpc: RpcCall;
  cache: Cache;
}

function tpsOf(s: any): { tps: number; userTps: number | null; slotSeconds: number | null } | null {
  const secs = Number(s?.samplePeriodSecs);
  const tx = Number(s?.numTransactions);
  if (!(secs > 0) || !Number.isFinite(tx)) return null;
  const nonVote = Number(s?.numNonVoteTransactions);
  const slots = Number(s?.numSlots);
  return {
    tps: tx / secs,
    userTps: Number.isFinite(nonVote) ? nonVote / secs : null,
    slotSeconds: slots > 0 ? secs / slots : null,
  };
}

export async function getNetworkStats(ctx: Ctx) {
  const r = await ctx.cache.get('network-stats', { ttlMs: 5_000, staleMs: 60_000 }, async () => {
    const [epoch, samples, votes, supply] = await Promise.all([
      ctx.rpc<any>('getEpochInfo'),
      ctx.rpc<any[]>('getRecentPerformanceSamples', [5]).catch(() => null),
      ctx.rpc<any>('getVoteAccounts').catch(() => null),
      ctx.cache.get('supply', { ttlMs: 10 * 60_000, staleMs: 3600_000 }, () => ctx.rpc<any>('getSupply', [{ excludeNonCirculatingAccountsList: true }]))
        .then((x) => x.value).catch(() => null),
    ]);
    const perf = (samples ?? []).map(tpsOf).filter(Boolean) as NonNullable<ReturnType<typeof tpsOf>>[];
    const avg = (f: (p: typeof perf[number]) => number | null) => {
      const xs = perf.map(f).filter((x): x is number => x !== null);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    };
    const cur = votes?.current ?? [];
    const del = votes?.delinquent ?? [];
    const stake = (l: any[]) => l.reduce((s, v) => s + (Number(v.activatedStake) || 0), 0);
    const activeStake = stake(cur);
    const delinquentStake = stake(del);
    return {
      slot: epoch.absoluteSlot,
      blockHeight: epoch.blockHeight,
      epoch: epoch.epoch,
      slotIndex: epoch.slotIndex,
      slotsInEpoch: epoch.slotsInEpoch,
      epochProgress: epoch.slotsInEpoch > 0 ? epoch.slotIndex / epoch.slotsInEpoch : null,
      transactionCount: epoch.transactionCount ?? null,
      tps: avg((p) => p.tps),
      userTps: avg((p) => p.userTps),
      slotTimeSeconds: avg((p) => p.slotSeconds),
      validators: votes ? { active: cur.length, delinquent: del.length } : null,
      stake: votes ? {
        activeXnt: activeStake / 1e9,
        delinquentXnt: delinquentStake / 1e9,
        delinquentShare: activeStake + delinquentStake > 0 ? delinquentStake / (activeStake + delinquentStake) : null,
      } : null,
      supply: supply?.value ? { totalXnt: supply.value.total / 1e9, circulatingXnt: supply.value.circulating / 1e9 } : null,
      source: 'X1 RPC',
    };
  });
  return { ...r.value, fetchedAt: new Date(r.fetchedAt).toISOString(), stale: r.stale };
}

/** Recent performance history. The RPC keeps roughly 12 hours of one-minute samples. */
export async function getNetworkHistory(ctx: Ctx, hours: number) {
  const r = await ctx.cache.get('perf-samples', { ttlMs: 60_000, staleMs: 10 * 60_000 }, () => ctx.rpc<any[]>('getRecentPerformanceSamples', [720]));
  const samples = Array.isArray(r.value) ? r.value : [];
  const wanted = Math.min(samples.length, Math.max(1, Math.round(hours * 60)));
  // Samples arrive newest first. Timestamps are derived from the sample period.
  let t = r.fetchedAt;
  const points = [];
  for (let i = 0; i < wanted; i++) {
    const s = samples[i];
    const p = tpsOf(s);
    if (!p) continue;
    points.push({ time: new Date(t).toISOString(), slot: s.slot, tps: p.tps, userTps: p.userTps, slotTimeSeconds: p.slotSeconds });
    t -= Number(s.samplePeriodSecs) * 1000;
  }
  points.reverse();
  return {
    data: points,
    requestedHours: hours,
    coveredHours: points.length / 60,
    note: 'History comes from the RPC node performance samples, which cover roughly the last 12 hours.',
    source: 'X1 RPC getRecentPerformanceSamples',
    fetchedAt: new Date(r.fetchedAt).toISOString(),
    stale: r.stale,
  };
}

/** Threshold checks on live values. Reports only what is measured right now. */
export async function detectAnomalies(ctx: Ctx) {
  const s = await getNetworkStats(ctx);
  const issues: { severity: 'Low' | 'Medium' | 'High'; metric: string; message: string }[] = [];
  const share = s.stake?.delinquentShare;
  if (share !== null && share !== undefined) {
    if (share >= 0.2) issues.push({ severity: 'High', metric: 'delinquent_stake', message: `${(share * 100).toFixed(1)}% of stake is delinquent.` });
    else if (share >= 0.1) issues.push({ severity: 'Medium', metric: 'delinquent_stake', message: `${(share * 100).toFixed(1)}% of stake is delinquent.` });
  }
  if (s.slotTimeSeconds !== null && s.slotTimeSeconds > 0.8) {
    issues.push({ severity: s.slotTimeSeconds > 1.5 ? 'High' : 'Medium', metric: 'slot_time', message: `Average slot time is ${s.slotTimeSeconds.toFixed(2)}s (target about 0.4s).` });
  }
  if (s.tps !== null && s.tps < 1) issues.push({ severity: 'High', metric: 'tps', message: 'Almost no transactions are being processed.' });
  const order = { High: 3, Medium: 2, Low: 1 };
  issues.sort((a, b) => order[b.severity] - order[a.severity]);
  return {
    action: issues.length ? 'alert' : 'ok',
    severity: issues[0]?.severity ?? null,
    message: issues[0]?.message ?? 'No anomalies detected in live network metrics.',
    issues,
    checked: ['delinquent_stake', 'slot_time', 'tps'],
    method: 'Fixed thresholds on live RPC values. No historical baseline is available.',
    fetchedAt: s.fetchedAt,
  };
}
