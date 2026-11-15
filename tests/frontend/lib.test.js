import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compact, DASH, hashHue, initials, integer, percent, shortAddress, timeAgo, usd } from '@/lib/format';
import { classifyQuery } from '@/lib/x1/search';
import { safeUrl } from '@/lib/safeUrl';

describe('format: missing values are never shown as zero', () => {
  it('renders a dash for null, undefined, NaN and non-numbers', () => {
    for (const f of [compact, integer, usd, percent]) {
      for (const v of [null, undefined, NaN, Infinity, '12', {}]) expect(f(v)).toBe(DASH);
    }
    expect(shortAddress(null)).toBe(DASH);
    expect(timeAgo(null)).toBe(DASH);
    expect(timeAgo('not a date')).toBe(DASH);
  });
  it('formats real values', () => {
    expect(compact(1234567)).toBe('1.23M');
    expect(compact(0)).toBe('0');
    expect(integer(1234567.8)).toBe('1,234,568');
    expect(usd(0)).toBe('$0.00');
    expect(usd(164.6)).toBe('$164.60');
    expect(usd(0.1949)).toBe('$0.1949');
    expect(usd(0.0000164994)).toBe('$0.00001650');
    expect(usd(2_500_000)).toBe('$2.50M');
    expect(percent(11.1127)).toBe('11.11%');
    expect(percent(-4.4, 1, { sign: true })).toBe('-4.4%');
    expect(percent(4.4, 1, { sign: true })).toBe('+4.4%');
    expect(shortAddress('So11111111111111111111111111111111111111112')).toBe('So11…1112');
    expect(timeAgo(1000, 31_000)).toBe('30s ago');
    expect(timeAgo(1000, 1000 + 3 * 3600_000)).toBe('3h ago');
  });
  it('generated avatars are deterministic and never empty', () => {
    expect(hashHue('abc')).toBe(hashHue('abc'));
    expect(hashHue('abc')).not.toBe(hashHue('abd'));
    expect(hashHue('abc')).toBeGreaterThanOrEqual(0);
    expect(hashHue('abc')).toBeLessThan(360);
    expect(initials('X1 Labs')).toBe('XL');
    expect(initials('Vanguard')).toBe('VA');
    expect(initials('', 'Gv5kyH')).toBe('GV');
    expect(initials('<script>', 'ab')).toBe('SC');
  });
});

describe('search classification', () => {
  const types = (q) => classifyQuery(q).map((o) => o.type);
  it('routes each kind of query', () => {
    expect(types('93254957')).toEqual(['block']);
    expect(types('So11111111111111111111111111111111111111112')).toEqual(['address', 'token', 'validator']);
    expect(types('5'.repeat(88))).toEqual(['transaction']);
    expect(types('pltr')).toEqual(['token-search', 'validator-search']);
    expect(types('')).toEqual([]);
    expect(types('a')).toEqual([]);
  });
  it('encodes free text and never builds a URL from it', () => {
    const opts = classifyQuery('a&b=<script>');
    for (const o of opts) {
      expect(o.to.startsWith('/')).toBe(true);
      expect(o.to).not.toContain('<');
      expect(o.to).not.toContain('&b=');
    }
    expect(classifyQuery('javascript:alert(1)').every((o) => o.to.startsWith('/'))).toBe(true);
  });
});

describe('safeUrl', () => {
  it('blocks script and data schemes', () => {
    for (const bad of ['javascript:alert(1)', ' JaVaScRiPt:alert(1)', 'data:text/html,<script>', 'vbscript:x']) expect(safeUrl(bad)).toBe('#');
    expect(safeUrl('https://x1.xyz')).toBe('https://x1.xyz');
  });
});

describe('rpc client', () => {
  let rpc;
  let calls;
  let behaviour;
  beforeEach(async () => {
    vi.resetModules();
    calls = [];
    behaviour = {};
    vi.stubGlobal('fetch', async (url, init) => {
      calls.push(url);
      const b = behaviour[url];
      if (b === 'down') throw new TypeError('network');
      if (b === 'hang') return new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' }))));
      if (b === 'rpc-error') return new Response(JSON.stringify({ error: { message: 'Method not found' } }));
      await new Promise((r) => setTimeout(r, 5));
      return new Response(JSON.stringify({ result: { ok: url } }));
    });
    rpc = await import('@/lib/x1/rpcClient');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('uses the primary endpoint and de-duplicates identical concurrent calls', async () => {
    const [a, b, c] = await Promise.all([rpc.rpcCall('getSlot'), rpc.rpcCall('getSlot'), rpc.rpcCall('getSlot')]);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
    expect(calls).toEqual(['https://rpc.mainnet.x1.xyz']);
  });
  it('fails over, then prefers the endpoint that worked', async () => {
    behaviour['https://rpc.mainnet.x1.xyz'] = 'down';
    const r = await rpc.rpcCall('getSlot');
    expect(r.ok).toBe('https://rpc.x1galaxy.io/');
    calls.length = 0;
    await rpc.rpcCall('getEpochInfo');
    expect(calls).toEqual(['https://rpc.x1galaxy.io/']);
  });
  it('times out instead of hanging, and reports a typed error when all endpoints fail', async () => {
    behaviour['https://rpc.mainnet.x1.xyz'] = 'hang';
    behaviour['https://rpc.x1galaxy.io/'] = 'down';
    const err = await rpc.rpcCall('getSlot', [], null, 'short', { timeoutMs: 30 }).catch((e) => e);
    expect(err.name).toBe('RpcError');
    expect(['network', 'timeout']).toContain(err.kind);
    expect(calls).toHaveLength(2);
  });
  it('surfaces node errors without retry storms', async () => {
    behaviour['https://rpc.mainnet.x1.xyz'] = 'rpc-error';
    behaviour['https://rpc.x1galaxy.io/'] = 'rpc-error';
    await expect(rpc.rpcCall('nope')).rejects.toMatchObject({ kind: 'rpc' });
    expect(calls).toHaveLength(2);
  });
  it('caches by key when asked', async () => {
    await rpc.rpcCall('getVersion', [], 'v', 'long');
    await rpc.rpcCall('getVersion', [], 'v', 'long');
    expect(calls).toHaveLength(1);
  });
  it('only ever contacts the configured endpoints', () => {
    expect(rpc.getRpcEndpoints()).toEqual(['https://rpc.mainnet.x1.xyz', 'https://rpc.x1galaxy.io/']);
  });
});
