import { describe, expect, it, vi } from 'vitest';
import { clampInt, cleanText, isAddress, oneOf, safeHttpsUrl } from '../../base44/shared/validate.ts';
import { MemoryStore } from '../../base44/shared/store.ts';
import { limitByIp, rateLimit } from '../../base44/shared/rateLimit.ts';
import { Cache } from '../../base44/shared/cache.ts';
import { fetchJson, UpstreamError } from '../../base44/shared/upstream.ts';
import { base58Decode, base58Encode, decodeMetaplexMetadata, isOnCurve, metaplexMetadataAddress } from '../../base44/shared/solana.ts';
import { corsHeaders, readJsonBody } from '../../base44/shared/http.ts';

describe('validate', () => {
  it('accepts only base58 addresses of plausible length', () => {
    expect(isAddress('So11111111111111111111111111111111111111112')).toBe(true);
    for (const bad of ['', 'abc', '0OIl' + 'a'.repeat(40), 'a'.repeat(45), "x' OR 1=1--", '../../etc/passwd', null, 42, {}]) {
      expect(isAddress(bad)).toBe(false);
    }
  });
  it('clamps integers and rejects non-numbers', () => {
    expect(clampInt('abc', 50, 1, 200)).toBe(50);
    expect(clampInt('-5', 50, 1, 200)).toBe(1);
    expect(clampInt('99999', 50, 1, 200)).toBe(200);
    expect(clampInt('12.9', 50, 1, 200)).toBe(12);
    expect(clampInt(undefined, 0, 0, 10)).toBe(0);
    expect(clampInt('Infinity', 7, 0, 10)).toBe(7);
  });
  it('cleans free text', () => {
    expect(cleanText('  a\u0000b\n\tc  ', 10)).toBe('a b c');
    expect(cleanText('x'.repeat(500), 64)).toHaveLength(64);
    expect(cleanText({ toString: () => 'x' }, 10)).toBe('');
  });
  it('restricts enums', () => {
    expect(oneOf('price', ['price', 'name'] as const, 'name')).toBe('price');
    expect(oneOf('__proto__', ['price', 'name'] as const, 'name')).toBe('name');
  });
  it('only allows public https URLs', () => {
    expect(safeHttpsUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
    for (const bad of [
      'http://example.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'file:///etc/passwd',
      'https://localhost/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://169.254.169.254/latest/meta-data',
      'https://[::1]/x', 'https://intranet/x', 'https://db.internal/x', 'https://user:pw@example.com/x',
      'https://example.com:8443/x', 'not a url', '', null, 'https://' + 'a'.repeat(3000) + '.com',
    ]) {
      expect(safeHttpsUrl(bad)).toBeNull();
    }
  });
});

describe('rate limiting', () => {
  it('allows up to the limit per window and resets afterwards', async () => {
    let t = 1_000_000;
    const store = new MemoryStore(100, () => t);
    for (let i = 0; i < 3; i++) expect((await rateLimit(store, 's', 'ip', 3, 60_000, () => t)).allowed).toBe(true);
    const blocked = await rateLimit(store, 's', 'ip', 3, 60_000, () => t);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect((await rateLimit(store, 's', 'other', 3, 60_000, () => t)).allowed).toBe(true);
    t += 61_000;
    expect((await rateLimit(store, 's', 'ip', 3, 60_000, () => t)).allowed).toBe(true);
  });
  it('ignores spoofable x-forwarded-for and gives the shared unknown bucket more room', async () => {
    const store = new MemoryStore();
    const spoof = (n: number) => new Request('https://x/', { headers: { 'x-forwarded-for': `1.2.3.${n}` } });
    let last;
    for (let i = 0; i < 41; i++) last = await limitByIp(store, 's', spoof(i), 2);
    expect(last!.limit).toBe(40); // one shared bucket, not 41 separate ones
    expect(last!.allowed).toBe(false);
    const real = new Request('https://x/', { headers: { 'cf-connecting-ip': '9.9.9.9' } });
    expect((await limitByIp(store, 's', real, 2)).limit).toBe(2);
  });
  it('bounds memory', async () => {
    const store = new MemoryStore(50);
    for (let i = 0; i < 500; i++) await store.incr('k' + i, 60_000);
    expect((store as any).map.size).toBeLessThanOrEqual(50);
  });
});

describe('cache', () => {
  it('coalesces concurrent loads into one upstream call', async () => {
    const cache = new Cache();
    const loader = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return 42;
    });
    const results = await Promise.all(Array.from({ length: 25 }, () => cache.get('k', { ttlMs: 1000 }, loader)));
    expect(loader).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.value === 42 && !r.stale)).toBe(true);
  });
  it('serves a stale value when the source fails, and fails when nothing usable exists', async () => {
    let t = 0;
    const cache = new Cache(() => t);
    await cache.get('k', { ttlMs: 10, staleMs: 100 }, async () => 'good');
    t = 50;
    const r = await cache.get('k', { ttlMs: 10, staleMs: 100 }, async () => {
      throw new Error('down');
    });
    expect(r).toMatchObject({ value: 'good', stale: true, fetchedAt: 0 });
    t = 500;
    await expect(cache.get('k', { ttlMs: 10, staleMs: 100 }, async () => {
      throw new Error('down');
    })).rejects.toThrow();
  });
});

describe('upstream', () => {
  const noSleep = async () => {};
  it('retries transient failures a bounded number of times', async () => {
    const f = vi.fn(async () => new Response('secret', { status: 503 }));
    await expect(fetchJson(f as any, 'https://a/', { source: 's', retries: 9, sleep: noSleep })).rejects.toMatchObject({ status: 503 });
    expect(f).toHaveBeenCalledTimes(3); // capped at 2 retries
  });
  it('does not retry client or auth errors', async () => {
    const f = vi.fn(async () => new Response('{"error":"bad key"}', { status: 401 }));
    await expect(fetchJson(f as any, 'https://a/', { source: 's', sleep: noSleep })).rejects.toBeInstanceOf(UpstreamError);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('recovers on retry and never puts the upstream body in the error', async () => {
    let n = 0;
    const f = async () => (n++ === 0 ? new Response('internal-host-10.0.0.1', { status: 500 }) : new Response('{"ok":true}'));
    expect(await fetchJson(f as any, 'https://a/', { source: 's', sleep: noSleep })).toEqual({ ok: true });
    const g = async () => new Response('internal-host-10.0.0.1', { status: 500 });
    const err = await fetchJson(g as any, 'https://a/', { source: 's', retries: 0 }).catch((e) => e);
    expect(String(err.message)).not.toContain('10.0.0.1');
  });
  it('rejects oversized and malformed responses', async () => {
    const big = async () => new Response('x'.repeat(5000));
    await expect(fetchJson(big as any, 'https://a/', { source: 's', maxBytes: 100, retries: 0 })).rejects.toMatchObject({ kind: 'response_too_large' });
    const html = async () => new Response('<html>');
    await expect(fetchJson(html as any, 'https://a/', { source: 's', retries: 0 })).rejects.toMatchObject({ kind: 'invalid_json' });
  });
  it('times out', async () => {
    const hang = (_u: string, init?: RequestInit) => new Promise<Response>((_, rej) => init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' }))));
    await expect(fetchJson(hang as any, 'https://a/', { source: 's', timeoutMs: 20, retries: 0 })).rejects.toMatchObject({ kind: 'timeout' });
  });
});

describe('solana primitives', () => {
  it('round-trips base58', () => {
    const a = 'So11111111111111111111111111111111111111112';
    expect(base58Encode(base58Decode(a))).toBe(a);
    expect(base58Decode('11111111111111111111111111111111')).toHaveLength(32);
    expect(() => base58Decode('0OIl')).toThrow();
  });
  it('derives Metaplex metadata addresses (known vectors, one confirmed on X1 mainnet)', async () => {
    expect(await metaplexMetadataAddress('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')).toBe('5x38Kp4hvdomTCnCrAny4UtMUt5rQBdB6px2K1Ui45Wq');
    expect(await metaplexMetadataAddress('pXNTyoqQsskHdZ7Q1rnP25FEyHHjissbs7n6RRN2nP5')).toBe('9eX4K7ti5xvW7kRavTLFwcUEjNWmG6K5YSZiCkYLmBUh');
  });
  it('knows curve points from non-points', () => {
    expect(isOnCurve(base58Decode('So11111111111111111111111111111111111111112'))).toBe(true);
    expect(isOnCurve(base58Decode('5x38Kp4hvdomTCnCrAny4UtMUt5rQBdB6px2K1Ui45Wq'))).toBe(false);
  });
  it('decodes metadata defensively', () => {
    expect(decodeMetaplexMetadata(new Uint8Array(10))).toBeNull();
    const bad = new Uint8Array(80);
    new DataView(bad.buffer).setUint32(65, 0xffffffff, true); // absurd length
    expect(decodeMetaplexMetadata(bad)).toBeNull();
  });
});

describe('http', () => {
  it('echoes only known origins', () => {
    const h = (origin?: string) => corsHeaders(new Request('https://x/', { headers: origin ? { origin } : {} }));
    expect(h('https://x1space.xyz')['Access-Control-Allow-Origin']).toBe('https://x1space.xyz');
    expect(h('https://my-app.base44.app')['Access-Control-Allow-Origin']).toBe('https://my-app.base44.app');
    expect(h('http://localhost:5173')['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    for (const o of ['https://evil.example', 'https://x1space.xyz.evil.example', 'https://evilbase44.app', 'http://x1space.xyz', 'null']) {
      expect(h(o)['Access-Control-Allow-Origin']).toBeUndefined();
    }
    expect(h()['Access-Control-Allow-Origin']).toBeUndefined();
    expect(h('https://x1space.xyz')['Access-Control-Allow-Methods']).not.toMatch(/DELETE|PUT/);
  });
  it('caps request bodies even when content-length lies', async () => {
    const big = new Request('https://x/', { method: 'POST', body: JSON.stringify({ a: 'x'.repeat(5000) }) });
    await expect(readJsonBody(big, 1000)).rejects.toMatchObject({ status: 413 });
    const lying = new Request('https://x/', { method: 'POST', body: 'x'.repeat(5000), headers: { 'content-length': '10' } });
    await expect(readJsonBody(lying, 1000)).rejects.toMatchObject({ status: 413 });
    for (const body of ['[1,2]', '"str"', 'null', '{bad']) {
      await expect(readJsonBody(new Request('https://x/', { method: 'POST', body }), 1000)).rejects.toMatchObject({ status: 400 });
    }
  });
});
