import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/x1/rpcClient', () => ({ rpcCall: vi.fn(), getRpcEndpoints: () => [] }));
import { rpcCall } from '@/lib/x1/rpcClient';
import { getLiveAnomalies, getLiveNetworkHistory, getLiveNetworkStats } from '@/lib/x1/liveStats';

// Same payloads as tests/backend/helpers.ts makeRpc.
const PAYLOADS = {
  getVoteAccounts: () => ({
    current: [{ votePubkey: 'V1', nodePubkey: 'N1', activatedStake: 9e9, commission: 5 }],
    delinquent: [{ votePubkey: 'V2', nodePubkey: 'N2', activatedStake: 1e9, commission: 10 }],
  }),
  getEpochInfo: () => ({ absoluteSlot: 100, blockHeight: 90, epoch: 4, slotIndex: 50, slotsInEpoch: 200, transactionCount: 1000 }),
  getRecentPerformanceSamples: (params) =>
    Array.from({ length: Math.min(params[0], 30) }, (_, i) => ({ slot: 100 - i, numSlots: 150, numTransactions: 6000, numNonVoteTransactions: 600, samplePeriodSecs: 60 })),
  getSupply: () => ({ value: { total: 1e18, circulating: 5e17 } }),
};

/** @param {string[]} [failing] RPC methods that reject */
function mockRpc(failing = []) {
  rpcCall.mockImplementation(async (method, params = []) => {
    if (failing.includes(method)) throw new Error('rpc down');
    return PAYLOADS[method](params);
  });
}

beforeEach(() => {
  rpcCall.mockReset();
});

describe('live network stats', () => {
  it('computes the same values as the backend from RPC', async () => {
    mockRpc();
    const r = await getLiveNetworkStats();
    expect(r).toMatchObject({
      slot: 100, blockHeight: 90, epoch: 4, slotIndex: 50, slotsInEpoch: 200, epochProgress: 0.25, transactionCount: 1000,
      tps: 100, userTps: 10, slotTimeSeconds: 0.4, validators: { active: 1, delinquent: 1 },
      supply: { totalXnt: 1e9, circulatingXnt: 5e8 }, source: 'X1 RPC', stale: false,
    });
    expect(r.stake.activeXnt).toBe(9);
    expect(r.stake.delinquentXnt).toBe(1);
    expect(r.stake.delinquentShare).toBeCloseTo(0.1, 6);
    expect(Number.isNaN(Date.parse(r.fetchedAt))).toBe(false);
  });

  it('returns nulls, not zeros, when optional sources fail', async () => {
    mockRpc(['getRecentPerformanceSamples', 'getVoteAccounts', 'getSupply']);
    const r = await getLiveNetworkStats();
    expect(r).toMatchObject({ slot: 100, tps: null, userTps: null, slotTimeSeconds: null, validators: null, stake: null, supply: null });
  });

  it('throws when getEpochInfo fails', async () => {
    mockRpc(['getEpochInfo']);
    await expect(getLiveNetworkStats()).rejects.toThrow();
  });

  it('caches the slow calls through rpcCall keys so a 5 second poll does not refetch them', async () => {
    mockRpc();
    await getLiveNetworkStats();
    const slow = Object.fromEntries(rpcCall.mock.calls.filter((c) => ['getVoteAccounts', 'getSupply'].includes(c[0])).map((c) => [c[0], [c[2], c[3]]]));
    expect(slow.getVoteAccounts).toEqual(['live:voteAccounts', 'medium']);
    expect(slow.getSupply).toEqual(['live:supply', 'long']);
    const fast = rpcCall.mock.calls.find((c) => c[0] === 'getEpochInfo');
    expect(fast[3]).toBe('short');
  });
});

describe('live network history', () => {
  it('returns recent samples oldest first, bounded to what the RPC holds', async () => {
    mockRpc();
    const r = await getLiveNetworkHistory(12);
    expect(r.data).toHaveLength(30);
    expect(r.data[0]).toMatchObject({ slot: 71, tps: 100, userTps: 10, slotTimeSeconds: 0.4 });
    expect(Date.parse(r.data[0].time)).toBeLessThan(Date.parse(r.data.at(-1).time));
    expect(r).toMatchObject({ requestedHours: 12, coveredHours: 0.5, stale: false, source: 'X1 RPC getRecentPerformanceSamples' });
    expect((await getLiveNetworkHistory(0.1)).data).toHaveLength(6);
  });
  it('throws when the RPC fails', async () => {
    mockRpc(['getRecentPerformanceSamples']);
    await expect(getLiveNetworkHistory(12)).rejects.toThrow();
  });
});

describe('live anomalies', () => {
  it('flags delinquent stake from thresholds only', async () => {
    mockRpc();
    const r = await getLiveAnomalies();
    expect(r).toMatchObject({ action: 'alert', severity: 'Medium', checked: ['delinquent_stake', 'slot_time', 'tps'] });
    expect(r.issues).toHaveLength(1);
    expect(r.issues[0].metric).toBe('delinquent_stake');
    expect(r.issues[0].message).toBe('10.0% of stake is delinquent.');
  });
  it('reports ok when nothing is measured as wrong', async () => {
    mockRpc(['getVoteAccounts']);
    const r = await getLiveAnomalies();
    expect(r).toMatchObject({ action: 'ok', severity: null, issues: [] });
  });
  it('raises slot time and tps issues, highest severity first', async () => {
    rpcCall.mockImplementation(async (method, params = []) => {
      if (method === 'getRecentPerformanceSamples') return [{ slot: 1, numSlots: 10, numTransactions: 30, numNonVoteTransactions: 3, samplePeriodSecs: 60 }];
      return PAYLOADS[method](params);
    });
    const r = await getLiveAnomalies();
    expect(r.severity).toBe('High');
    expect(r.issues.map((i) => i.metric)).toEqual(['slot_time', 'tps', 'delinquent_stake']);
  });
  it('throws when getEpochInfo fails', async () => {
    mockRpc(['getEpochInfo']);
    await expect(getLiveAnomalies()).rejects.toThrow();
  });
});
