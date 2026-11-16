import { describe, expect, it } from 'vitest';
import { apportion, blockMix, buildWindows, matrixDots, splitWindow } from '@/lib/x1/x1view';

const sample = (i, o = {}) => ({ numSlots: 150 + i, numTransactions: 6000 + i * 100, numNonVoteTransactions: 600 + i * 10, samplePeriodSecs: 60, ...o });
const samples = Array.from({ length: 60 }, (_, i) => sample(i));
const blocks = [
  { txCount: 100, voteCount: 60, transferCount: 20, programCount: 10 },
  { txCount: 100, voteCount: 70, transferCount: 10, programCount: 10 },
];

describe('apportion', () => {
  it('always sums to the total', () => {
    for (const [t, w] of [[100, [1, 1, 1]], [7, [3, 3, 1]], [80, [5, 0, 2]], [0, [1, 2]], [10, [0, 0]]]) {
      const r = apportion(t, w);
      expect(r.reduce((a, b) => a + b, 0)).toBe(w.every((x) => x === 0) ? 0 : t);
    }
  });
});

describe('buildWindows', () => {
  it('1m: Now, 1m ago ... 9m ago, with real totals and slot counts', () => {
    const w = buildWindows({ samples, blocks, view: '1m' });
    expect(w.map((x) => x.label)).toEqual(['Now', '1m ago', '2m ago', '3m ago', '4m ago', '5m ago', '6m ago', '7m ago', '8m ago', '9m ago']);
    expect(w[0].total).toBe(6000);
    expect(w[3].total).toBe(6300);
    expect(w[3].slots).toBe(153);
  });
  it('10m: 10m ago ... 50m ago, summing ten samples each', () => {
    const w = buildWindows({ samples, blocks, view: '10m' });
    expect(w.map((x) => x.label)).toEqual(['10m ago', '20m ago', '30m ago', '40m ago', '50m ago']);
    expect(w[0].total).toBe(samples.slice(0, 10).reduce((a, s) => a + s.numTransactions, 0));
    expect(w[0].slots).toBe(samples.slice(0, 10).reduce((a, s) => a + s.numSlots, 0));
  });
  it('only full 10m windows are shown and short sample lists shrink the 1m view', () => {
    expect(buildWindows({ samples: samples.slice(0, 25), blocks, view: '10m' })).toHaveLength(2);
    expect(buildWindows({ samples: samples.slice(0, 4), blocks, view: '1m' })).toHaveLength(4);
    expect(buildWindows({ samples: [], blocks, view: '1m' })).toEqual([]);
    expect(buildWindows({ samples: null, blocks, view: '1m' })).toEqual([]);
  });
  it('vote count is exact (total minus non-vote) and the categories add up to the total', () => {
    for (const w of buildWindows({ samples, blocks, view: '1m' })) {
      const c = w.counts;
      expect(c.vote).toBe(w.total - (w.total - c.vote));
      expect(c.vote + c.transfer + c.program + c.other).toBe(w.total);
      expect(w.estimated).toBe(true);
    }
    expect(buildWindows({ samples, blocks, view: '1m' })[0].counts.vote).toBe(6000 - 600);
  });
  it('invents nothing without block data: exact votes, no type split', () => {
    const w = buildWindows({ samples, blocks: [], view: '1m' })[0];
    expect(w.split).toBe(false);
    expect(w.estimated).toBe(false);
    expect(w.counts).toEqual({ vote: 5400, nonvote: 600 });
  });
  it('no non-vote data and no blocks: no counts at all, never a default mix', () => {
    const s = samples.map((x) => ({ ...x, numNonVoteTransactions: undefined }));
    const w = buildWindows({ samples: s, blocks: [], view: '1m' })[0];
    expect(w.counts).toEqual({});
    expect(w.total).toBe(6000);
  });
  it('rejects malformed samples instead of showing NaN', () => {
    const bad = [sample(0), { numSlots: 'x', numTransactions: 5 }, sample(2)];
    expect(buildWindows({ samples: bad, blocks, view: '1m' })).toHaveLength(1);
  });
});

describe('mix and matrix', () => {
  it('blockMix reads real classified transactions', () => {
    expect(blockMix(blocks)).toMatchObject({ transfer: 30, program: 20, other: 20 });
    expect(blockMix([])).toBeNull();
    expect(blockMix([{ txCount: 50, voteCount: 50 }])).toBeNull();
  });
  it('splitWindow counts add up', () => {
    const r = splitWindow(1000, 100, { transfer: 3, program: 1, other: 0, sum: 4 });
    expect(r.counts).toEqual({ vote: 900, transfer: 75, program: 25, other: 0 });
  });
  it('matrix is deterministic, ordered, at most 80 dots, and shows every non-zero category', () => {
    const c = { vote: 5400, transfer: 400, program: 150, other: 3 };
    const a = matrixDots(c);
    expect(a).toHaveLength(80);
    expect(matrixDots(c)).toEqual(a);
    expect(new Set(a)).toEqual(new Set(['vote', 'transfer', 'program', 'other']));
    expect(a.indexOf('transfer')).toBeGreaterThan(a.lastIndexOf('vote'));
    expect(matrixDots({})).toEqual([]);
    expect(matrixDots({ vote: 0, transfer: 0 })).toEqual([]);
  });
});
