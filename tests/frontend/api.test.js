import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/api/base44Client', () => ({ base44: { functions: { invoke } } }));
vi.mock('@/lib/x1/rpcClient', () => ({ rpcCall: vi.fn(), getRpcEndpoints: () => [] }));

import { rpcCall } from '@/lib/x1/rpcClient';
import { ApiError, api, apiGet, clearApiCache, proxiedImageUrl } from '@/lib/x1/api';

const ok = (body) => ({ status: 200, data: body });
const httpError = (status, data) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
const jsonResponse = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

function makeStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    get length() { return store.size; },
    key: (i) => [...store.keys()][i] ?? null,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
  };
}

let storage;
const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  storage = makeStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('fetch', fetchMock);
  invoke.mockReset();
  fetchMock.mockReset();
  clearApiCache();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('apiGet transport', () => {
  it('calls the SDK first with the params as the POST payload', async () => {
    invoke.mockResolvedValue(ok({ success: true, tokens: [] }));
    const body = await apiGet('getTokens', { limit: 5, q: 'x', empty: '', none: undefined });
    expect(body).toEqual({ success: true, tokens: [] });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('getTokens', { limit: 5, q: 'x' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps SDK error bodies to ApiError', async () => {
    invoke.mockRejectedValueOnce(httpError(401, { success: false, error: { code: 'unauthorized', message: 'Sign in required' } }));
    const e1 = await apiGet('detectThing').catch((e) => e);
    expect(e1).toBeInstanceOf(ApiError);
    expect(e1).toMatchObject({ status: 401, code: 'unauthorized', message: 'Sign in required' });
    invoke.mockRejectedValueOnce(httpError(429, { error: { code: 'rate_limited', message: 'Slow down' } }));
    const e2 = await apiGet('detectThing2').catch((e) => e);
    expect(e2).toMatchObject({ status: 429, code: 'rate_limited', message: 'Slow down' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps a success:false body returned with a 2xx status', async () => {
    invoke.mockResolvedValue(ok({ success: false, error: { code: 'bad', message: 'nope' } }));
    await expect(apiGet('fnA')).rejects.toMatchObject({ name: 'ApiError', code: 'bad', message: 'nope' });
  });

  it('falls back to the direct GET when the SDK route has a network error', async () => {
    invoke.mockRejectedValue(new Error('Network Error'));
    fetchMock.mockResolvedValue(jsonResponse({ success: true, v: 1 }));
    const body = await apiGet('fnB', { a: 1 });
    expect(body).toEqual({ success: true, v: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/functions/fnB?a=1');
  });

  it('falls back on a 404 or non-JSON answer from the SDK route', async () => {
    invoke.mockRejectedValueOnce(httpError(404, '<html></html>'));
    fetchMock.mockResolvedValue(jsonResponse({ success: true, v: 2 }));
    expect(await apiGet('fnC')).toEqual({ success: true, v: 2 });
    invoke.mockResolvedValueOnce({ status: 200, data: '<html></html>' });
    expect(await apiGet('fnD')).toEqual({ success: true, v: 2 });
  });

  it('reports a network ApiError when both routes fail', async () => {
    invoke.mockRejectedValue(new Error('Network Error'));
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(apiGet('fnE')).rejects.toMatchObject({ name: 'ApiError', status: 0, code: 'network' });
  });

  it('shares one call between concurrent identical requests', async () => {
    let release;
    invoke.mockImplementation(() => new Promise((r) => { release = () => r(ok({ success: true })); }));
    const a = apiGet('fnF', { x: 1, y: 2 });
    const b = apiGet('fnF', { y: 2, x: 1 });
    await vi.advanceTimersByTimeAsync(0);
    release();
    await Promise.all([a, b]);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('times out slow requests', async () => {
    invoke.mockImplementation(() => new Promise(() => {}));
    const p = apiGet('fnG', undefined, { timeoutMs: 1000 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(1001);
    expect(await p).toMatchObject({ name: 'ApiError', code: 'timeout' });
  });
});

describe('apiGet cache', () => {
  it('serves a repeat call within the TTL and refetches after it', async () => {
    invoke.mockResolvedValue(ok({ success: true, n: 1 }));
    await apiGet('getTokens', { limit: 1 });
    vi.advanceTimersByTime(29_000);
    await apiGet('getTokens', { limit: 1 });
    expect(invoke).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2_000);
    await apiGet('getTokens', { limit: 1 });
    expect(invoke).toHaveBeenCalledTimes(2);
    await apiGet('getTokens', { limit: 2 }); // different params: different entry
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it('uses the per-function default TTL and none for other functions', async () => {
    invoke.mockResolvedValue(ok({ success: true }));
    await apiGet('getValidators');
    await apiGet('someOtherFn');
    vi.advanceTimersByTime(200_000);
    await apiGet('getValidators');
    await apiGet('someOtherFn');
    expect(invoke.mock.calls.filter((c) => c[0] === 'getValidators')).toHaveLength(1);
    expect(invoke.mock.calls.filter((c) => c[0] === 'someOtherFn')).toHaveLength(2);
  });

  it('honours ttlMs and force', async () => {
    invoke.mockResolvedValue(ok({ success: true }));
    await apiGet('fnH', {}, { ttlMs: 5000 });
    await apiGet('fnH', {}, { ttlMs: 5000 });
    expect(invoke).toHaveBeenCalledTimes(1);
    await apiGet('fnH', {}, { ttlMs: 5000, force: true });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('shares entries through localStorage (another tab) under the x1c: prefix', async () => {
    invoke.mockResolvedValue(ok({ success: true, n: 7 }));
    await apiGet('getTokens', { limit: 3 });
    const keys = [...storage.store.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0].startsWith('x1c:')).toBe(true);
    const entry = JSON.parse(storage.store.get(keys[0]));
    expect(entry).toMatchObject({ t: Date.now(), body: { n: 7 } });
    // A second tab has an empty memory cache but the same localStorage.
    invoke.mockClear();
    vi.resetModules();
    const fresh = await import('@/lib/x1/api');
    expect(await fresh.apiGet('getTokens', { limit: 3 })).toEqual({ success: true, n: 7 });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('ignores corrupt, malformed and expired localStorage entries', async () => {
    invoke.mockResolvedValue(ok({ success: true, fresh: true }));
    const key = (p) => `x1c:getTokens?${JSON.stringify([['limit', p]])}`;
    storage.store.set(key(1), '{not json');
    storage.store.set(key(2), JSON.stringify({ t: 'x', body: {} }));
    storage.store.set(key(3), JSON.stringify({ t: Date.now() - 60_000, body: { old: true } }));
    storage.store.set(key(4), JSON.stringify({ t: Date.now() }));
    for (const p of [1, 2, 3, 4]) expect(await apiGet('getTokens', { limit: p })).toEqual({ success: true, fresh: true });
    expect(invoke).toHaveBeenCalledTimes(4);
  });

  it('works when localStorage throws', async () => {
    const boom = () => { throw new Error('denied'); };
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom, key: boom, length: 0 });
    invoke.mockResolvedValue(ok({ success: true }));
    await apiGet('getTokens', { limit: 9 });
    await apiGet('getTokens', { limit: 9 });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('never caches failed responses', async () => {
    invoke.mockRejectedValueOnce(httpError(500, { success: false, error: { code: 'internal_error', message: 'x' } }));
    await expect(apiGet('getTokens', { limit: 4 })).rejects.toBeInstanceOf(ApiError);
    expect(storage.store.size).toBe(0);
    invoke.mockResolvedValueOnce(ok({ success: false, error: { code: 'bad', message: 'y' } }));
    await expect(apiGet('getTokens', { limit: 4 })).rejects.toBeInstanceOf(ApiError);
    expect(storage.store.size).toBe(0);
    invoke.mockResolvedValueOnce(ok({ success: true }));
    await apiGet('getTokens', { limit: 4 });
    expect(invoke).toHaveBeenCalledTimes(3);
  });
});

describe('network functions run in the browser', () => {
  it('api.networkStats / networkHistory / anomalies make no backend or /functions calls', async () => {
    rpcCall.mockImplementation(async (method, params = []) => {
      if (method === 'getEpochInfo') return { absoluteSlot: 1, blockHeight: 1, epoch: 1, slotIndex: 1, slotsInEpoch: 4, transactionCount: 1 };
      if (method === 'getRecentPerformanceSamples') return [{ slot: 1, numSlots: 150, numTransactions: 6000, numNonVoteTransactions: 600, samplePeriodSecs: 60 }];
      if (method === 'getVoteAccounts') return { current: [], delinquent: [] };
      return { value: { total: 2e9, circulating: 1e9 } };
    });
    const stats = await api.networkStats();
    expect(stats.epochProgress).toBe(0.25);
    expect((await api.networkHistory(1)).data).toHaveLength(1);
    expect((await api.anomalies()).action).toBe('ok');
    expect(invoke).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('proxiedImageUrl', () => {
  it('is always the direct image GET route', () => {
    expect(proxiedImageUrl('token', 'a b')).toBe('/functions/getImage?kind=token&id=a%20b');
  });
});
