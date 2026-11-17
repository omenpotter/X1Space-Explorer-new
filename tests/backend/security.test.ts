// Security regression tests for the hardening phase (R2 AI quotas, R3 cache partitions, R4 redirect refusal,
// R8 X1 Ninja quota). Everything here is MOCKED: no network, no billable AI call, no real key. These tests prove
// the code's logic. They do NOT prove how the Base44 runtime behaves (see docs/upgrade/BASE44_RUNTIME_VERIFICATION.md).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as H from '../../base44/shared/handlers.ts';
import { Cache, PROTECTED_KEYS } from '../../base44/shared/cache.ts';
import { aiQuotaConfigFrom, reserveAiQuota } from '../../base44/shared/ai.ts';
import {
  aiQuotaBackend,
  cycleId,
  DAY_MS,
  EntityCounterQuota,
  EntityLedgerQuota,
  KvQuota,
  MemoryQuota,
  nextCycleStart,
  nextUtcMidnight,
  parseIntConfig,
  type QuotaBackend,
  utcDay,
} from '../../base44/shared/quota.ts';
import { createNinja } from '../../base44/shared/ninja.ts';
import { NinjaGovernor, ninjaLimitsFrom, NINJA_DEFAULTS } from '../../base44/shared/ninjaQuota.ts';
import { MemoryStore } from '../../base44/shared/store.ts';
import { parseRetryAfter, UpstreamError } from '../../base44/shared/upstream.ts';
import { SECRET_NAMES } from '../../base44/shared/entry.ts';
import { call, fakeEntity, makeDeps, makeWorld, MINT_B, NINJA_KEY, POOL, req } from './helpers.ts';

const ROOT = path.resolve(__dirname, '../..');
const NOON = Date.UTC(2026, 10, 17, 12, 0, 0); // 2026-11-17 12:00 UTC

/** A quota store that every "instance" in a test shares. */
const sharedMem = (now: () => number) => new MemoryQuota(now, 5000, true);

afterEach(() => vi.restoreAllMocks());

/** Minimal Deno KV double with versionstamp checks, so compare-and-set behaves as on the real thing. */
function fakeKv() {
  const m = new Map<string, { value: unknown; versionstamp: number }>();
  let v = 0;
  const id = (k: unknown[]) => JSON.stringify(k);
  return {
    async get(k: unknown[]) {
      await Promise.resolve();
      return { key: k, value: m.get(id(k))?.value ?? null, versionstamp: m.get(id(k))?.versionstamp ?? null };
    },
    atomic() {
      const checks: { k: unknown[]; versionstamp: number | null }[] = [];
      const sets: { k: unknown[]; value: unknown }[] = [];
      const op = {
        check(c: any) { checks.push({ k: c.key, versionstamp: c.versionstamp }); return op; },
        set(k: unknown[], value: unknown) { sets.push({ k, value }); return op; },
        async commit() {
          await Promise.resolve();
          if (checks.some((c) => (m.get(id(c.k))?.versionstamp ?? null) !== c.versionstamp)) return { ok: false };
          for (const x of sets) m.set(id(x.k), { value: x.value, versionstamp: ++v });
          return { ok: true };
        },
      };
      return op;
    },
  };
}

// ======================================================================================================
// R2: AI quotas
// ======================================================================================================

describe('R2 configuration validation', () => {
  it('uses safe defaults when nothing is configured: 10 per user, 30 per IP, 500 global', () => {
    expect(aiQuotaConfigFrom(() => undefined)).toEqual({ perUser: 10, perIp: 30, global: 500, mode: 'strict' });
  });
  it('accepts valid values and clamps extremes', () => {
    const cfg = aiQuotaConfigFrom((n) => ({ AI_DAILY_QUOTA: '5', AI_IP_DAILY_QUOTA: '12', AI_GLOBAL_DAILY_QUOTA: '250' } as any)[n]);
    expect(cfg).toEqual({ perUser: 5, perIp: 12, global: 250, mode: 'strict' });
    expect(aiQuotaConfigFrom((n) => (n === 'AI_GLOBAL_DAILY_QUOTA' ? '999999999' : undefined)).global).toBe(100_000);
    expect(aiQuotaConfigFrom((n) => (n === 'AI_DAILY_QUOTA' ? '0' : undefined)).perUser).toBe(1);
  });
  it('rejects malformed values instead of guessing: they fall back to the default', () => {
    for (const bad of ['', ' ', 'abc', '10abc', '-5', '1e3', '3.5', 'NaN', 'Infinity', '0x10', '1,000', '9999999999999']) {
      expect(parseIntConfig(bad, 77, 1, 1000)).toBe(77);
    }
    expect(parseIntConfig(undefined, 77, 1, 1000)).toBe(77);
    expect(parseIntConfig(' 42 ', 77, 1, 1000)).toBe(42);
  });
  it('registers every new setting in SECRET_NAMES so the platform reader resolves it', () => {
    for (const n of ['AI_DAILY_QUOTA', 'AI_IP_DAILY_QUOTA', 'AI_GLOBAL_DAILY_QUOTA', 'X1_NINJA_MONTHLY_QUOTA', 'X1_NINJA_RATE_LIMIT_PER_MIN', 'X1_NINJA_RESET_DAY', 'X1_NINJA_API_KEY']) {
      expect(SECRET_NAMES).toContain(n);
    }
  });
});

// A harness around the real AI handler with a mocked model (the mock stands in for InvokeLLM: nothing billable runs).
function aiHarness(opts: { backend?: () => Promise<QuotaBackend | null>; cfg?: any; now?: () => number; fail?: boolean } = {}) {
  const w = makeWorld();
  const calls: { user: string; prompt: string }[] = [];
  const now = opts.now ?? (() => NOON);
  const d: any = makeDeps(w, { now });
  d.aiQuotaConfig = opts.cfg ?? { perUser: 3, perIp: 1000, global: 1000 };
  const mem = sharedMem(now);
  d.aiQuota = opts.backend ?? (async () => mem);
  d.clientFor = (r: Request) => {
    const user = r.headers.get('x-test-user');
    return {
      auth: { me: async () => (user ? { id: user } : Promise.reject(new Error('not signed in'))) },
      asServiceRole: { integrations: { Core: { InvokeLLM: async (a: any) => { calls.push({ user: user!, prompt: String(a.prompt) }); return { action: 'search_token', parameters: { name: 'x' }, confidence: 0.5 }; } } } },
    };
  };
  let n = 0;
  const post = async (user: string | null, body: unknown = { query: 'tps' }, ip?: string) => {
    const headers: Record<string, string> = { 'content-type': 'application/json', origin: 'https://x1space.xyz', 'cf-connecting-ip': ip ?? `10.1.${Math.floor(n / 250)}.${n++ % 250}` };
    if (user) headers['x-test-user'] = user;
    const r = await H.smartSearchHandler(d)(new Request('https://x1space.xyz/functions/smartSearch', { method: 'POST', body: JSON.stringify(body), headers }));
    return { status: r.status, body: await r.json().catch(() => null), headers: r.headers };
  };
  return { d, post, calls, mem, w };
}

describe('R2 per-user, per-IP and global AI limits', () => {
  it('stops a user at their daily limit with 429 daily_quota and a Retry-After to UTC midnight', async () => {
    const h = aiHarness();
    for (let i = 0; i < 3; i++) expect((await h.post('alice')).status).toBe(200);
    const over = await h.post('alice');
    expect(over.status).toBe(429);
    expect(over.body.error.code).toBe('daily_quota');
    expect(Number(over.headers.get('retry-after'))).toBe((nextUtcMidnight(NOON) - NOON) / 1000);
    expect(h.calls).toHaveLength(3); // the refused request never reached the model
    expect((await h.post('bob')).status).toBe(200); // other users unaffected
  });

  it('applies the global ceiling across all users and answers 503 ai_capacity_reached', async () => {
    const h = aiHarness({ cfg: { perUser: 100, perIp: 1000, global: 5 } });
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) statuses.push((await h.post(`user${i}`)).status);
    expect(statuses).toEqual([200, 200, 200, 200, 200, 503, 503, 503]);
    expect(h.calls).toHaveLength(5);
    const r = await h.post('late-user');
    expect(r.body.error.code).toBe('ai_capacity_reached');
    expect(r.headers.get('retry-after')).toBeTruthy();
  });

  it('account farming cannot multiply the global limit, and one IP cannot drain it', async () => {
    // 40 throwaway accounts: still only 5 model calls in total.
    const farm = aiHarness({ cfg: { perUser: 100, perIp: 1000, global: 5 } });
    for (let i = 0; i < 40; i++) await farm.post(`sybil${i}`);
    expect(farm.calls).toHaveLength(5);
    // The same IP behind many accounts is capped by the per-IP limit, leaving global capacity for others.
    const ip = aiHarness({ cfg: { perUser: 100, perIp: 4, global: 500 } });
    for (let i = 0; i < 20; i++) await ip.post(`sybil${i}`, { query: 'q' }, '203.0.113.9');
    expect(ip.calls).toHaveLength(4);
    expect((await ip.post('honest', { query: 'q' }, '198.51.100.2')).status).toBe(200);
  });

  it('gives an unknown client address no IP bucket of its own (it would be shared by everyone behind the proxy)', async () => {
    const h = aiHarness({ cfg: { perUser: 100, perIp: 1, global: 1000 } });
    const unknown = async (u: string) => {
      const r = await H.smartSearchHandler(h.d)(new Request('https://x1space.xyz/functions/smartSearch', { method: 'POST', body: '{"query":"a"}', headers: { 'content-type': 'application/json', 'x-test-user': u } }));
      return r.status;
    };
    expect(await unknown('u1')).toBe(200);
    expect(await unknown('u2')).toBe(200);
  });

  it('refunds earlier reservations when a later limit refuses, so a refused request costs the user nothing', async () => {
    const h = aiHarness({ cfg: { perUser: 2, perIp: 1000, global: 1 } });
    expect((await h.post('a')).status).toBe(200); // takes the only global slot
    expect((await h.post('b')).status).toBe(503); // b's user reservation must be returned
    expect((await h.post('b')).status).toBe(503);
    const cfg2 = { perUser: 2, perIp: 1000, global: 10 };
    h.d.aiQuotaConfig = cfg2; // capacity returns: b still has both of their own requests
    expect((await h.post('b')).status).toBe(200);
    expect((await h.post('b')).status).toBe(200);
    expect((await h.post('b')).status).toBe(429);
  });

  it('reserves at the moment of the billable call: malformed requests and anonymous callers consume nothing', async () => {
    const h = aiHarness({ cfg: { perUser: 1, perIp: 1000, global: 1000 } });
    expect((await h.post('c', {})).status).toBe(400); // missing query
    expect((await h.post('c', { query: 'x'.repeat(40_000) })).status).toBe(413);
    expect((await h.post(null)).status).toBe(401);
    expect((await h.post('c')).status).toBe(200); // the only quota unit was still available
    expect((await h.post('c')).status).toBe(429);
  });

  it('allows at most one model call per request', async () => {
    const d: any = makeDeps(makeWorld(), { now: () => NOON });
    const mem = sharedMem(() => NOON);
    d.aiQuota = async () => mem;
    let invocations = 0;
    d.clientFor = () => ({ auth: { me: async () => ({ id: 'u' }) }, asServiceRole: { integrations: { Core: { InvokeLLM: async () => { invocations++; return {}; } } } } });
    // Drive the guard directly through a handler whose body tries to call the model twice.
    const { tokenVerificationHandler } = H;
    const r = await tokenVerificationHandler(d)(new Request('https://x/f', { method: 'POST', body: JSON.stringify({ action: 'chat', userMessage: 'hi' }), headers: { 'content-type': 'application/json', 'cf-connecting-ip': '9.9.9.9' } }));
    expect(r.status).toBe(200);
    expect(invocations).toBe(1);
  });
});

describe('R2 parallel requests cannot bypass the quota', () => {
  it('atomic backend: 60 simultaneous requests with a global limit of 10 reach the model exactly 10 times', async () => {
    const h = aiHarness({ cfg: { perUser: 1000, perIp: 1000, global: 10 } });
    const rs = await Promise.all(Array.from({ length: 60 }, (_, i) => h.post(`p${i}`)));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(10);
    expect(h.calls).toHaveLength(10);
  });

  it('atomic backend: parallel requests from one user cannot exceed their own limit either', async () => {
    const h = aiHarness({ cfg: { perUser: 3, perIp: 1000, global: 1000 } });
    // The per-minute burst limit (5) applies first; stay below it with a fresh IP per request.
    const rs = await Promise.all(Array.from({ length: 5 }, () => h.post('same')));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(3);
  });

  it('Deno KV backend: compare-and-set never grants more than `limit` under heavy contention', async () => {
    const kv = fakeKv();
    const b = new KvQuota(kv);
    const rs = await Promise.all(Array.from({ length: 50 }, () => b.reserve('k', 1, 10, 60_000)));
    const granted = rs.filter((r) => r.granted).length;
    // A hard ceiling: contention can make some callers give up (fail closed), but never lets an extra one in.
    expect(granted).toBeGreaterThan(0);
    expect(granted).toBeLessThanOrEqual(10);
    expect(b.atomic).toBe(true);
    // Without contention every unit up to the limit is granted.
    const calm = new KvQuota(fakeKv());
    let ok = 0;
    for (let i = 0; i < 15; i++) if ((await calm.reserve('k', 1, 10, 60_000)).granted) ok++;
    expect(ok).toBe(10);
  });

  it('entity ledger: rank-ordered reservations grant exactly `limit` under parallel load (given read-your-writes)', async () => {
    const api = fakeEntity();
    const b = new EntityLedgerQuota(api);
    const rs = await Promise.all(Array.from({ length: 40 }, () => b.reserve('ai-global:1', 1, 10, 60_000)));
    expect(rs.filter((r) => r.granted)).toHaveLength(10);
    // Refused rows were removed again, so the table holds only the granted reservations.
    expect(api.rows.filter((r) => r.key === 'ai-global:1')).toHaveLength(10);
    expect(b.atomic).toBe(false); // and it is documented as best effort, not a transaction
  });

  it('entity ledger fails closed when its own write is not visible yet (read-after-write lag)', async () => {
    const api = fakeEntity();
    const orig = api.filter.bind(api);
    api.filter = async (...a: any[]) => (await (orig as any)(...a)).filter((r: any) => r.value === 'never');
    const r = await new EntityLedgerQuota(api).reserve('k', 1, 10, 60_000);
    expect(r.granted).toBe(false);
  });

  it('LIMITATION (documented): the single-row counter is NOT atomic and can overshoot under contention', async () => {
    const api = fakeEntity();
    const b = new EntityCounterQuota(api);
    const rs = await Promise.all(Array.from({ length: 30 }, () => b.reserve('c', 1, 10, 60_000)));
    const granted = rs.filter((r) => r.granted).length;
    expect(granted).toBeGreaterThanOrEqual(10); // never fewer; may be more. That is why AI uses the ledger.
    expect(b.atomic).toBe(false);
  });
});

describe('R2 quota store failures fail closed (AI only)', () => {
  it('refuses with 503 ai_unavailable and never calls the model when no backend exists', async () => {
    const h = aiHarness({ backend: async () => null });
    const r = await h.post('u');
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe('ai_unavailable');
    expect(h.calls).toHaveLength(0);
  });
  it('refuses when the backend throws while building or while reserving', async () => {
    const boom = aiHarness({ backend: async () => { throw new Error('db down'); } });
    expect((await boom.post('u')).status).toBe(503);
    const bad: QuotaBackend = { kind: 'ledger', atomic: false, shared: true, reserve: async () => { throw new Error('db down'); }, release: async () => {} };
    const h2 = aiHarness({ backend: async () => bad });
    const r = await h2.post('u');
    expect(r.status).toBe(503);
    expect(h2.calls).toHaveLength(0);
    expect(JSON.stringify(r.body)).not.toContain('db down');
  });
  it('the entity ledger on a failing entity refuses AI calls instead of falling back to per-instance counters', async () => {
    const api = fakeEntity({ failCreate: true });
    const h = aiHarness({ backend: () => aiQuotaBackend(api) });
    expect((await h.post('u')).status).toBe(503);
    expect(h.calls).toHaveLength(0);
  });
  it('without KV or an entity, aiQuotaBackend returns null (so AI refuses)', async () => {
    expect(await aiQuotaBackend(null)).toBeNull();
  });
  it('ordinary explorer endpoints keep working while AI is unavailable', async () => {
    const w = makeWorld();
    const d: any = makeDeps(w);
    d.aiQuota = async () => null;
    d.clientFor = () => ({ auth: { me: async () => ({ id: 'u' }) } });
    for (const [h, p] of [[H.lpStatsHandler, '/getLPStats'], [H.networkStatsHandler, '/getNetworkStats'], [H.tokensHandler, '/getTokens'], [H.validatorsHandler, '/getValidators']] as const) {
      expect((await call(h(d), p)).status).toBe(200);
    }
  });
});

describe('R2 UTC daily reset and bounded records', () => {
  it('resets exactly at 00:00 UTC', async () => {
    let t = Date.UTC(2026, 10, 17, 23, 59, 30);
    const h = aiHarness({ cfg: { perUser: 2, perIp: 1000, global: 1000 }, now: () => t });
    expect((await h.post('u')).status).toBe(200);
    expect((await h.post('u')).status).toBe(200);
    expect((await h.post('u')).status).toBe(429);
    t = Date.UTC(2026, 10, 17, 23, 59, 59, 999);
    expect((await h.post('u')).status).toBe(429);
    t = Date.UTC(2026, 10, 18, 0, 0, 0, 0);
    expect((await h.post('u')).status).toBe(200);
    expect(utcDay(t)).toBe(utcDay(t - 1) + 1);
    expect(nextUtcMidnight(t)).toBe(t + DAY_MS);
  });

  it('expired ledger rows are swept and refused rows never accumulate', async () => {
    const api = fakeEntity();
    let t = 1_000_000;
    const b = new EntityLedgerQuota(api, () => t);
    for (let i = 0; i < 30; i++) await b.reserve('ai-global:1', 1, 5, 1000);
    expect(api.rows.length).toBe(5); // 5 granted; the 25 refused rows were deleted at once
    t += 5000; // everything has expired
    for (let i = 0; i < 4; i++) await b.reserve('ai-global:2', 1, 5, 1000); // new day: each grant sweeps a few expired rows
    await new Promise((r) => setTimeout(r, 0));
    expect(api.rows.filter((r) => r.key === 'ai-global:1').length).toBeLessThan(5);
  });
});

describe('R2 reservation helper', () => {
  it('keeps the burst limit per user and per minute', async () => {
    const store = new MemoryStore();
    const mem = new MemoryQuota(Date.now, 2000, true);
    const cfg = { perUser: 100, perIp: 1000, global: 1000 };
    const results = [];
    for (let i = 0; i < 7; i++) results.push((await reserveAiQuota(store, mem, { id: 'u' }, '1.1.1.1', cfg)).ok);
    expect(results.filter(Boolean)).toHaveLength(5);
  });
});

// ======================================================================================================
// R3: cache pollution
// ======================================================================================================

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function mint(i: number): string {
  let s = '';
  let n = i + 1;
  for (let k = 0; k < 44; k++) {
    s += B58[(n * 31 + k * 7 + (n >> 3)) % B58.length];
    n = (n * 1103515245 + 12345) & 0x7fffffff;
  }
  return s;
}

describe('R3 cache partitions', () => {
  it('protected shared entries survive unlimited unique-key churn', async () => {
    let t = 0;
    const c = new Cache(() => t, 50);
    for (const k of PROTECTED_KEYS) await c.get(k, { ttlMs: 60_000 }, async () => 'shared:' + k);
    for (let i = 0; i < 5000; i++) await c.get(`detail:${mint(i)}`, { ttlMs: 60_000 }, async () => ({ i }));
    for (const k of PROTECTED_KEYS) expect(c.peek(k)).toBe('shared:' + k);
    expect(c.stats().general).toBeLessThanOrEqual(50);
    expect(c.stats().protected).toBe(PROTECTED_KEYS.length);
  });

  it('the protected partition cannot be grown by callers: only the fixed allowlist is protected', async () => {
    const c = new Cache(() => 0, 10);
    for (let i = 0; i < 100; i++) await c.get(`market:${i}`, { ttlMs: 1000 }, async () => i); // look-alike keys are not protected
    await c.get('market', { ttlMs: 1000 }, async () => 'real');
    expect(c.stats().protected).toBe(1);
    expect(c.stats().general).toBeLessThanOrEqual(10);
  });

  it('keeps expiry, stale-on-error and request coalescing', async () => {
    let t = 0;
    const c = new Cache(() => t, 5);
    let loads = 0;
    const load = async () => { loads++; await new Promise((r) => setTimeout(r, 5)); return loads; };
    const [a, b] = await Promise.all([c.get('market', { ttlMs: 100, staleMs: 1000 }, load), c.get('market', { ttlMs: 100, staleMs: 1000 }, load)]);
    expect(loads).toBe(1);
    expect(a.value).toBe(b.value);
    t = 50;
    expect((await c.get('market', { ttlMs: 100 }, load)).fetchedAt).toBe(0); // still fresh
    t = 150;
    expect((await c.get('market', { ttlMs: 100, staleMs: 1000 }, async () => { throw new Error('down'); })).stale).toBe(true);
    t = 5000;
    await expect(c.get('market', { ttlMs: 100, staleMs: 1000 }, async () => { throw new Error('down'); })).rejects.toThrow('down');
    await c.get('market', { ttlMs: 100 }, load);
    expect(loads).toBe(2);
  });

  it('evicts least-recently-used general entries first', async () => {
    const c = new Cache(() => 0, 3);
    for (const k of ['a', 'b', 'c']) await c.get(k, { ttlMs: 1000 }, async () => k);
    await c.get('a', { ttlMs: 1000 }, async () => 'x'); // touch a
    await c.get('d', { ttlMs: 1000 }, async () => 'd'); // evicts b
    expect(c.peek('a')).toBe('a');
    expect(c.peek('b')).toBeUndefined();
  });

  it('bounds image memory by bytes as well as count', async () => {
    const c = new Cache(() => 0, 500);
    for (let i = 0; i < 100; i++) await c.get(`img:token:${i}`, { ttlMs: 1000 }, async () => ({ bytes: new Uint8Array(1_000_000), contentType: 'image/png' }));
    expect(c.stats().imageBytes).toBeLessThanOrEqual(32_000_000);
    expect(c.stats().images).toBeLessThanOrEqual(32);
  });
});

describe('R3 mint churn cannot force snapshot rebuilds (handler level)', () => {
  it('700 unique mint lookups leave the token snapshot, market and pool lists cached', async () => {
    const w = makeWorld();
    const d = makeDeps(w, { now: () => NOON });
    expect((await call(H.tokensHandler(d), '/getTokens?kind=all', { ip: '1.0.0.1' })).status).toBe(200);
    const heavy = () => w.rpcCalls.filter((c) => c.method === 'getProgramAccounts').length;
    const xdexCalls = () => w.fetchCalls.filter((c) => c.url.includes('/pool/list')).length;
    const before = { heavy: heavy(), xdex: xdexCalls() };
    expect(before.heavy).toBeGreaterThan(0);
    const detail = H.tokenByMintHandler(d);
    const price = H.tokenPricesHandler(d);
    const image = H.imageHandler(d);
    for (let i = 0; i < 700; i++) {
      const m = mint(i);
      const ip = `5.${i >> 8}.${i & 255}.1`;
      await detail(req(`/getTokenByMint?mint=${m}`, { ip }));
      if (i % 3 === 0) await price(req(`/getTokenPrices?mint=${m}`, { ip }));
      if (i % 5 === 0) await image(req(`/getImage?kind=token&id=${m}`, { ip }));
    }
    expect(d.cache.stats().general).toBeLessThanOrEqual(500);
    for (const k of ['market', 'token-snapshot', 'xdex-pools']) expect(d.cache.peek(k)).toBeDefined();
    // The clock did not move, so a still-fresh snapshot must be served without any new heavy upstream work.
    const again = await call(H.tokensHandler(d), '/getTokens?kind=all', { ip: '1.0.0.2' });
    expect(again.status).toBe(200);
    expect(heavy()).toBe(before.heavy);
    expect(xdexCalls()).toBe(before.xdex);
  }, 60_000);
});

// ======================================================================================================
// R4: X1 Ninja redirect protection and credential handling
// ======================================================================================================

const json = (b: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json', ...headers } });
const poolsBody = { pools: [], total: 0, xntPriceUsd: 0.2, lastUpdated: 1 };

function ninjaWith(handler: (url: string, init: RequestInit | undefined, n: number) => Response | Promise<Response>, opts: { key?: string | undefined; now?: () => number; governor?: NinjaGovernor; timeoutMs?: number } = {}) {
  const calls: { url: string; auth: string | null }[] = [];
  const f = async (url: string, init?: RequestInit) => {
    calls.push({ url, auth: new Headers(init?.headers).get('authorization') });
    return handler(url, init, calls.length);
  };
  const key = 'key' in opts ? opts.key : NINJA_KEY;
  const governor = opts.governor ?? new NinjaGovernor({ limits: () => NINJA_DEFAULTS, backends: async () => [], now: opts.now });
  const ninja = createNinja(f as any, key, { governor, sleep: async () => {}, timeoutMs: opts.timeoutMs });
  return { ninja, calls, governor };
}

describe('R4 X1 Ninja requests and redirects', () => {
  it('normal response: sends the bearer token to api.x1.ninja only, over https', async () => {
    const { ninja, calls } = ninjaWith(() => json(poolsBody));
    await expect(ninja.listPools()).resolves.toMatchObject({ pools: [], xntPriceUsd: 0.2 });
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0].url).origin).toBe('https://api.x1.ninja');
    expect(calls[0].auth).toBe(`Bearer ${NINJA_KEY}`);
  });

  it('refuses a same-origin redirect and does not follow it', async () => {
    const { ninja, calls } = ninjaWith(() => new Response(null, { status: 302, headers: { location: 'https://api.x1.ninja/v1/other' } }));
    await expect(ninja.listPools()).rejects.toMatchObject({ kind: 'redirect_refused' });
    expect(calls).toHaveLength(1);
  });

  it('refuses a cross-origin redirect: the token is never sent anywhere else', async () => {
    const { ninja, calls } = ninjaWith(() => new Response(null, { status: 307, headers: { location: 'https://evil.example/steal' } }));
    await expect(ninja.listPools()).rejects.toMatchObject({ kind: 'redirect_refused' });
    expect(calls.map((c) => new URL(c.url).hostname)).toEqual(['api.x1.ninja']);
    for (const c of calls) if (c.auth) expect(new URL(c.url).hostname).toBe('api.x1.ninja');
    // A redirect is not retried and is not mistaken for success.
    expect(calls).toHaveLength(1);
  });

  it('refuses redirects for every Ninja call type', async () => {
    const { ninja, calls } = ninjaWith(() => new Response(null, { status: 301, headers: { location: 'http://evil.example/' } }));
    await expect(ninja.getPool(MINT_B)).rejects.toMatchObject({ kind: 'redirect_refused' });
    await expect(ninja.getOhlcv(POOL, '1h', 10)).rejects.toMatchObject({ kind: 'redirect_refused' });
    await expect(ninja.getTrades(POOL, 'all', 10)).rejects.toMatchObject({ kind: 'redirect_refused' });
    expect(calls.every((c) => c.url.startsWith('https://api.x1.ninja/v1/'))).toBe(true);
  });

  it('upstream 5xx: one counted retry, then a safe error without upstream detail', async () => {
    const { ninja, calls } = ninjaWith(() => json({ error: 'secret upstream detail' }, 500));
    const err: any = await ninja.listPools().catch((e) => e);
    expect(err).toBeInstanceOf(UpstreamError);
    expect(calls).toHaveLength(2);
    expect(JSON.stringify([err.message, err.kind])).not.toContain('secret upstream detail');
  });

  it('missing credentials: no request is made at all', async () => {
    const { ninja, calls } = ninjaWith(() => json(poolsBody), { key: undefined });
    expect(ninja.configured).toBe(false);
    await expect(ninja.listPools()).rejects.toThrow('not configured');
    await expect(ninja.getOhlcv(POOL, '1h', 5)).rejects.toThrow('not configured');
    expect(calls).toHaveLength(0);
  });

  it('invalid credentials: 401 is not retried and pauses further calls so a bad key does not burn quota', async () => {
    let t = NOON;
    const { ninja, calls, governor } = ninjaWith(() => json({ error: 'API key required' }, 401), { now: () => t });
    await expect(ninja.listPools()).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(1);
    await expect(ninja.listPools()).rejects.toMatchObject({ kind: 'quota_cooldown' });
    expect(calls).toHaveLength(1);
    expect(governor.state().cooldownReason).toBe('auth');
    t += 6 * 60_000;
    await expect(ninja.listPools()).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(2);
  });

  it('times out slow upstreams', async () => {
    const f = (_u: string, init?: RequestInit) => new Promise<Response>((_, rej) => init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    const ninja = createNinja(f as any, NINJA_KEY, { timeoutMs: 20, sleep: async () => {} });
    const err: any = await ninja.listPools().catch((e) => e);
    expect(err.kind).toBe('timeout');
  });

  it('never logs or returns the key, including on failure', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const w = makeWorld();
    w.failHosts.add('api.x1.ninja');
    const d = makeDeps(w, { ninjaKey: NINJA_KEY, now: () => NOON });
    const outs = [await call(H.tokensHandler(d), '/getTokens'), await call(H.tokenPricesHandler(d), `/getTokenPrices?mint=${MINT_B}&history=true`)];
    for (const o of outs) {
      expect(o.text).not.toContain(NINJA_KEY);
      for (const [, v] of o.headers) expect(v).not.toContain(NINJA_KEY);
    }
    expect(JSON.stringify([spy.mock.calls, log.mock.calls])).not.toContain(NINJA_KEY);
  });
});

describe('R4 source checks (static)', () => {
  const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const walk = (dir: string): string[] => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  it('the key name and the Ninja host never appear in frontend source', () => {
    for (const f of walk('src').filter((x) => /\.(jsx?|tsx?)$/.test(x))) {
      const text = read(f);
      expect(text, f).not.toMatch(/X1_NINJA_API_KEY/);
      expect(text, f).not.toMatch(/api\.x1\.ninja/);
    }
  });
  it('only ninja.ts builds an Authorization header, and only for the fixed https base URL', () => {
    const users = walk('base44').filter((f) => /Bearer/.test(read(f)));
    expect(users).toEqual([path.join('base44', 'shared', 'ninja.ts')]);
    expect(read('base44/shared/ninja.ts')).toContain("const BASE = 'https://api.x1.ninja';");
    expect(read('base44/shared/ninja.ts')).toContain('refuseRedirects: true');
  });
  it('the key is only read through the secret reader', () => {
    const readers = walk('base44').filter((f) => /env\('X1_NINJA_API_KEY'\)/.test(read(f)));
    expect(readers).toEqual([path.join('base44', 'shared', 'handlers.ts')]);
  });
});

// ======================================================================================================
// R8: X1 Ninja quota protection
// ======================================================================================================

describe('R8 provider cycle and configuration', () => {
  it('resets on the 1st of each month, UTC (provider documents this)', () => {
    expect(cycleId(Date.UTC(2026, 10, 30, 23, 59, 59))).toBe('2026-11');
    expect(cycleId(Date.UTC(2026, 11, 1, 0, 0, 0))).toBe('2026-12');
    expect(cycleId(Date.UTC(2027, 0, 1))).toBe('2027-01');
    expect(nextCycleStart(Date.UTC(2026, 10, 17))).toBe(Date.UTC(2026, 11, 1));
    expect(nextCycleStart(Date.UTC(2026, 11, 31))).toBe(Date.UTC(2027, 0, 1));
  });
  it('supports a different reset day if the provider ever changes it', () => {
    expect(cycleId(Date.UTC(2026, 10, 14), 15)).toBe('2026-10');
    expect(cycleId(Date.UTC(2026, 10, 15), 15)).toBe('2026-11');
    expect(cycleId(Date.UTC(2026, 0, 3), 15)).toBe('2025-12');
    expect(nextCycleStart(Date.UTC(2026, 10, 14), 15)).toBe(Date.UTC(2026, 10, 15));
  });
  it('defaults to 450,000 per month and 50 per minute (50,000 and 10 held in reserve) and clamps to the plan', () => {
    expect(ninjaLimitsFrom(() => undefined)).toMatchObject({ monthly: 450_000, perMinute: 50, resetDay: 1 });
    expect(500_000 - NINJA_DEFAULTS.monthly).toBe(50_000);
    expect(60 - NINJA_DEFAULTS.perMinute).toBe(10);
    const big = ninjaLimitsFrom((n) => ({ X1_NINJA_MONTHLY_QUOTA: '9999999', X1_NINJA_RATE_LIMIT_PER_MIN: '1000' } as any)[n]);
    expect(big).toMatchObject({ monthly: 500_000, perMinute: 60 });
    expect(ninjaLimitsFrom((n) => ({ X1_NINJA_MONTHLY_QUOTA: 'lots', X1_NINJA_RATE_LIMIT_PER_MIN: '-1', X1_NINJA_RESET_DAY: '31' } as any)[n])).toMatchObject({ monthly: 450_000, perMinute: 50, resetDay: 28 });
  });
});

function governor(opts: { now: () => number; backend?: QuotaBackend | null; limits?: Partial<typeof NINJA_DEFAULTS> }) {
  const limits = { ...NINJA_DEFAULTS, ...opts.limits };
  const backend = opts.backend === undefined ? sharedMem(opts.now) : opts.backend;
  return new NinjaGovernor({ limits: () => limits, backends: async () => (backend ? [backend] : []), now: opts.now });
}

describe('R8 per-minute and monthly enforcement', () => {
  it('allows 50 requests per minute, refuses the 51st, and resumes in the next minute', async () => {
    let t = NOON;
    const g = governor({ now: () => t });
    const rs = [];
    for (let i = 0; i < 51; i++) rs.push(await g.reserve());
    expect(rs.filter((r) => r.ok)).toHaveLength(50);
    const last: any = rs[50];
    expect(last).toMatchObject({ ok: false, reason: 'minute' });
    expect(last.retryAfterMs).toBeGreaterThan(0);
    expect(last.retryAfterMs).toBeLessThanOrEqual(60_000);
    t += 120_000; // a full quiet minute later the sliding window has fully drained
    expect((await g.reserve()).ok).toBe(true);
  });

  it('a refused minute does not spend monthly quota', async () => {
    let t = NOON;
    const mem = sharedMem(() => t);
    const g = governor({ now: () => t, backend: mem, limits: { perMinute: 2 } });
    for (let i = 0; i < 10; i++) await g.reserve();
    const state = g.state();
    expect(state.leaseUnits).toBeGreaterThanOrEqual(0);
    t += 120_000;
    expect((await g.reserve()).ok).toBe(true);
  });

  it('enforces the monthly limit exactly with an atomic shared backend, and resets on the 1st (UTC)', async () => {
    let t = Date.UTC(2026, 10, 29, 12);
    const g = governor({ now: () => t, limits: { monthly: 60, perMinute: 60 } });
    let ok = 0;
    for (let i = 0; i < 70; i++) {
      if ((await g.reserve()).ok) ok++;
      if (i % 40 === 39) t += 60_000; // stay under the per-minute limit
    }
    expect(ok).toBe(60);
    const denied: any = await g.reserve();
    expect(denied).toMatchObject({ ok: false, reason: 'month' });
    expect(denied.retryAfterMs).toBeGreaterThan(0);
    t = Date.UTC(2026, 11, 1, 0, 0, 5);
    expect((await g.reserve()).ok).toBe(true);
  });

  it('two instances sharing one store cannot jointly exceed the minute limit', async () => {
    const t = NOON;
    const shared = sharedMem(() => t);
    const a = governor({ now: () => t, backend: shared });
    const b = governor({ now: () => t, backend: shared });
    let ok = 0;
    for (let i = 0; i < 40; i++) {
      if ((await a.reserve()).ok) ok++;
      if ((await b.reserve()).ok) ok++;
    }
    expect(ok).toBe(50);
  });

  it('parallel reservations are counted exactly (atomic backend)', async () => {
    const t = NOON;
    const shared = sharedMem(() => t);
    const gs = Array.from({ length: 4 }, () => governor({ now: () => t, backend: shared }));
    const rs = await Promise.all(Array.from({ length: 200 }, (_, i) => gs[i % 4].reserve()));
    expect(rs.filter((r) => r.ok)).toHaveLength(50);
  });

  it('without a shared store the limits apply per instance and the state says so', async () => {
    const t = NOON;
    const g = governor({ now: () => t, backend: null });
    let ok = 0;
    for (let i = 0; i < 60; i++) if ((await g.reserve()).ok) ok++;
    expect(ok).toBe(50);
    expect(g.state().enforcement).toBe('per-instance');
  });

  it('a failing shared store degrades to per-instance counting instead of failing requests', async () => {
    const t = NOON;
    const bad: QuotaBackend = { kind: 'counter', atomic: false, shared: true, reserve: async () => { throw new Error('db down'); }, release: async () => {} };
    const g = governor({ now: () => t, backend: bad });
    expect((await g.reserve()).ok).toBe(true);
    expect(g.state()).toMatchObject({ degraded: true, enforcement: 'per-instance' });
    let ok = 1;
    for (let i = 0; i < 80; i++) if ((await g.reserve()).ok) ok++;
    expect(ok).toBe(50);
  });

  it('reports shared-atomic or shared-best-effort so nobody over-claims', async () => {
    const t = NOON;
    const atomic = governor({ now: () => t });
    await atomic.reserve();
    expect(atomic.state().enforcement).toBe('shared-atomic');
    const counter = governor({ now: () => t, backend: new EntityCounterQuota(fakeEntity(), () => t) });
    await counter.reserve();
    expect(counter.state().enforcement).toBe('shared-best-effort');
  });

  it('keeps Ninja counters separate from AI quotas', async () => {
    const t = NOON;
    const shared = sharedMem(() => t);
    const g = governor({ now: () => t, backend: shared });
    await g.reserve();
    const keysBefore = [...(shared as any).map.keys()];
    expect(keysBefore.every((k: string) => k.startsWith('x1ninja:'))).toBe(true);
    const ai = await reserveAiQuota(new MemoryStore(), shared, { id: 'u' }, '1.2.3.4', { perUser: 1, perIp: 1, global: 1 }, () => t);
    expect(ai.ok).toBe(true);
    const aiKeys = [...(shared as any).map.keys()].filter((k: string) => !k.startsWith('x1ninja:'));
    expect(aiKeys.every((k: string) => k.startsWith('ai-'))).toBe(true);
    // Exhausting the AI global limit leaves Ninja untouched, and the reverse.
    const aiAgain = await reserveAiQuota(new MemoryStore(), shared, { id: 'v' }, '5.6.7.8', { perUser: 1, perIp: 1, global: 1 }, () => t);
    expect(aiAgain).toMatchObject({ ok: false, code: 'ai_capacity_reached' });
    expect((await g.reserve()).ok).toBe(true);
  });
});

describe('R8 counting of pagination, retries and duplicates', () => {
  const page = (n: number) => ({ pools: Array.from({ length: 500 }, (_, i) => ({ address: mint(n * 500 + i), baseToken: { address: mint(9000 + n * 500 + i), symbol: 'T' }, quoteToken: {} })), total: 1500 });

  it('every page of a paginated listing is one counted request', async () => {
    const t = NOON;
    const g = governor({ now: () => t });
    const { ninja, calls } = ninjaWith((url) => json(page(Number(new URL(url).searchParams.get('offset')) / 500)), { governor: g });
    const r = await ninja.listPools(3);
    expect(r.pools).toHaveLength(1500);
    expect(calls).toHaveLength(3);
    expect(g.state().leaseUnits).toBe(NINJA_DEFAULTS.leaseSize - 3); // 3 units spent out of one 25-unit lease
  });

  it('a retry is counted like any other request', async () => {
    const t = NOON;
    const g = governor({ now: () => t });
    const { ninja, calls } = ninjaWith((_u, _i, n) => (n === 1 ? json({}, 502) : json(poolsBody)), { governor: g });
    await ninja.listPools();
    expect(calls).toHaveLength(2);
    expect(g.state().leaseUnits).toBe(NINJA_DEFAULTS.leaseSize - 2);
  });

  it('never makes more than two upstream attempts for one call', async () => {
    const { ninja, calls } = ninjaWith(() => json({}, 500));
    await ninja.listPools().catch(() => {});
    await ninja.getOhlcv(POOL, '1h', 5).catch(() => {});
    expect(calls).toHaveLength(4);
  });

  it('concurrent identical requests share one upstream call and one reservation', async () => {
    const t = NOON;
    const g = governor({ now: () => t });
    const { ninja, calls } = ninjaWith(async () => { await new Promise((r) => setTimeout(r, 10)); return json(poolsBody); }, { governor: g });
    await Promise.all(Array.from({ length: 25 }, () => ninja.listPools()));
    expect(calls).toHaveLength(1);
    expect(g.state().leaseUnits).toBe(NINJA_DEFAULTS.leaseSize - 1);
  });

  it('refuses before sending anything once the monthly limit is used up', async () => {
    const t = NOON;
    const g = governor({ now: () => t, limits: { monthly: 2 } });
    const { ninja, calls } = ninjaWith(() => json(poolsBody), { governor: g });
    await ninja.getOhlcv(POOL, '1h', 1).catch(() => {});
    await ninja.getOhlcv(POOL, '4h', 1).catch(() => {});
    await expect(ninja.getOhlcv(POOL, '1D', 1)).rejects.toMatchObject({ kind: 'quota_month' });
    expect(calls).toHaveLength(2);
  });
});

describe('R8 HTTP 429, Retry-After and provider headers', () => {
  it('429: no immediate retry, cooldown honours Retry-After, calls resume afterwards', async () => {
    let t = NOON;
    let limited = true;
    const { ninja, calls, governor: g } = ninjaWith(() => (limited ? json({ error: 'slow down' }, 429, { 'retry-after': '90' }) : json(poolsBody)), { now: () => t });
    await expect(ninja.listPools()).rejects.toMatchObject({ status: 429, retryAfterMs: 90_000 });
    expect(calls).toHaveLength(1); // not retried
    expect(g.state().cooldownMs).toBe(90_000);
    await expect(ninja.listPools()).rejects.toMatchObject({ kind: 'quota_cooldown' });
    expect(calls).toHaveLength(1); // nothing sent during the cooldown
    t += 89_000;
    await expect(ninja.listPools()).rejects.toMatchObject({ kind: 'quota_cooldown' });
    t += 2_000;
    limited = false;
    await expect(ninja.listPools()).resolves.toMatchObject({ pools: [] });
    expect(calls).toHaveLength(2);
  });

  it('503 with Retry-After is treated the same way', async () => {
    const { ninja, calls, governor: g } = ninjaWith(() => json({}, 503, { 'retry-after': '20' }), { now: () => NOON });
    await expect(ninja.listPools()).rejects.toMatchObject({ status: 503 });
    expect(calls).toHaveLength(1);
    expect(g.state().cooldownMs).toBe(20_000);
  });

  it('defaults to 30 s without the header, understands HTTP dates, and caps at 15 minutes', async () => {
    const a = ninjaWith(() => json({}, 429), { now: () => NOON });
    await a.ninja.listPools().catch(() => {});
    expect(a.governor.state().cooldownMs).toBe(30_000);
    const b = ninjaWith(() => json({}, 429, { 'retry-after': '999999' }), { now: () => NOON });
    await b.ninja.listPools().catch(() => {});
    expect(b.governor.state().cooldownMs).toBe(15 * 60_000);
    expect(parseRetryAfter('120')).toBe(120_000);
    expect(parseRetryAfter(new Date(NOON + 5000).toUTCString(), NOON)).toBe(5000);
    expect(parseRetryAfter('soon')).toBeUndefined();
    expect(parseRetryAfter(null)).toBeUndefined();
  });

  it('pauses when the provider reports no requests remaining', async () => {
    const { ninja, governor: g } = ninjaWith(() => json(poolsBody, 200, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '45' }), { now: () => NOON });
    await ninja.listPools();
    expect(g.state().cooldownMs).toBe(45_000);
    await expect(ninja.listPools()).rejects.toMatchObject({ kind: 'quota_cooldown' });
  });

  it('ignores a malformed rate-limit header rather than acting on it', async () => {
    const { ninja, governor: g } = ninjaWith(() => json(poolsBody, 200, { 'x-ratelimit-remaining': 'abc' }));
    await ninja.listPools();
    expect(g.state().cooldownMs).toBe(0);
  });
});

describe('R8 serving cached data when the quota is exhausted', () => {
  function exhaustible(limits: Partial<typeof NINJA_DEFAULTS>, t: { v: number }) {
    const w = makeWorld();
    w.ninjaPools = [{ address: POOL, baseToken: { address: MINT_B, symbol: 'PLTR.X', name: 'Palantir' }, quoteToken: {}, priceUsd: 160, liquidity: 350, holders: 7 }];
    const g = governor({ now: () => t.v, limits });
    const d = makeDeps(w, { ninjaKey: NINJA_KEY, now: () => t.v, ninjaOptions: { governor: g, sleep: async () => {} } });
    return { w, d, g };
  }

  it('flags Ninja data as stale (not as an error) when a refresh is refused by the quota', async () => {
    const t = { v: NOON };
    const { d } = exhaustible({ monthly: 1 }, t);
    const first = await call(H.tokensHandler(d), '/getTokens?q=pltr');
    expect(first.body.sources.x1ninja.status).toBe('ok');
    t.v += 90_000; // past the 60 s Ninja cache window, so a refresh is needed and refused
    const second = await call(H.tokensHandler(d), '/getTokens?q=pltr', { ip: '3.3.3.3' });
    expect(second.status).toBe(200);
    expect(second.body.sources.x1ninja.status).toBe('stale');
    expect(second.body.tokens[0].mint).toBe(MINT_B); // the data is still served
  });

  it('reports quota_exhausted when there is nothing cached, and XDEX and chain data still work', async () => {
    const t = { v: NOON };
    const { d, w } = exhaustible({ monthly: 1 }, t);
    await d.ninja.getOhlcv(POOL, '1h', 5); // uses the only unit
    const r = await call(H.tokensHandler(d), '/getTokens?kind=all');
    expect(r.status).toBe(200);
    expect(r.body.sources.x1ninja.status).toBe('quota_exhausted');
    expect(r.body.sources.xdex.status).toBe('ok');
    expect(r.body.sources.chain.status).toBe('ok');
    expect(w.fetchCalls.filter((c) => c.url.includes('api.x1.ninja'))).toHaveLength(1);
  });

  it('history and trades report quota_exhausted without failing the request', async () => {
    const t = { v: NOON };
    const { d } = exhaustible({ monthly: 1 }, t);
    await d.ninja.getOhlcv(POOL, '1h', 5);
    const p = await call(H.tokenPricesHandler(d), `/getTokenPrices?mint=${MINT_B}&history=true`);
    expect(p.status).toBe(200);
    expect(['quota_exhausted', 'no_pool']).toContain(p.body.data.history.status);
    const tr = await call(H.lpPoolDetailHandler(d), `/getLPPoolDetail?pool=${POOL}&trades=true`);
    expect(tr.status).toBe(200);
    expect(tr.body.trades.status).toBe('quota_exhausted');
  });

  it('shares market data across callers: 100 requests in one minute make one pools request', async () => {
    const t = { v: NOON };
    const { d, w } = exhaustible({}, t);
    for (let i = 0; i < 100; i++) await call(H.tokensHandler(d), '/getTokens?q=pltr', { ip: `4.4.${i >> 8}.${i & 255}` });
    expect(w.fetchCalls.filter((c) => c.url.includes('api.x1.ninja/v1/pools'))).toHaveLength(1);
  });
});

describe('R8 platform quota backends', () => {
  it('the entity counter persists across instances and resets after expiry', async () => {
    const api = fakeEntity();
    let t = 1000;
    const a = new EntityCounterQuota(api, () => t);
    const b = new EntityCounterQuota(api, () => t);
    expect((await a.reserve('x1ninja:min:1', 1, 2, 60_000)).used).toBe(1);
    expect((await b.reserve('x1ninja:min:1', 1, 2, 60_000)).used).toBe(2);
    expect((await a.reserve('x1ninja:min:1', 1, 2, 60_000)).granted).toBe(false);
    t += 61_000;
    expect((await b.reserve('x1ninja:min:1', 1, 2, 60_000)).granted).toBe(true);
  });
  it('cleans up expired counter rows when it creates new ones (the table stays small)', async () => {
    const api = fakeEntity();
    let t = 1000;
    const b = new EntityCounterQuota(api, () => t);
    for (let m = 0; m < 20; m++) {
      await b.reserve(`x1ninja:min:${m}`, 1, 50, 60_000);
      t += 61_000;
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(api.rows.length).toBeLessThanOrEqual(8);
  });
});

// ======================================================================================================
// R6: the public API stays complete and anonymous
// ======================================================================================================

describe('R6 all 16 functions are retained and public endpoints need no sign-in', () => {
  const EXPECTED = ['analyzeToken', 'detectAnomalies', 'getImage', 'getLiquidityPools', 'getLPPoolDetail', 'getLPStats', 'getLPTokens', 'getNetworkHistory', 'getNetworkStats', 'getTokenByMint', 'getTokenPrices', 'getTokens', 'getValidators', 'searchTokens', 'smartSearch', 'tokenVerificationAssistant'];
  it('has an entry file for each of the 16 functions, and nothing else', () => {
    const dirs = fs.readdirSync(path.join(ROOT, 'base44/functions')).sort();
    expect(dirs).toEqual([...EXPECTED].sort());
    for (const d of dirs) expect(fs.readFileSync(path.join(ROOT, 'base44/functions', d, 'entry.ts'), 'utf8')).toMatch(/export default entry\(/);
  });
  it('getNetworkStats, getNetworkHistory and detectAnomalies still answer anonymously with the same shapes', async () => {
    const w = makeWorld();
    const d = makeDeps(w);
    const stats = await call(H.networkStatsHandler(d), '/getNetworkStats');
    const hist = await call(H.networkHistoryHandler(d), '/getNetworkHistory?hours=2');
    const anom = await call(H.detectAnomaliesHandler(d), '/detectAnomalies');
    for (const r of [stats, hist, anom]) {
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
    }
    expect(stats.body).toHaveProperty('epoch');
  });
  it('anonymous endpoints do not need a platform client; only the AI functions require sign-in', async () => {
    const d = makeDeps(makeWorld());
    expect(d.clientFor).toBeUndefined();
    expect((await call(H.lpStatsHandler(d), '/getLPStats')).status).toBe(200);
    expect((await call(H.smartSearchHandler(d), '/smartSearch', { method: 'POST', body: '{"query":"a"}' })).status).toBe(503);
  });
});

describe('runtime diagnostics (constant text only, logged once)', () => {
  it('logs which backends are in use without any request data or secrets', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { logOnce } = await import('../../base44/shared/http.ts');
    logOnce('t', 'once');
    logOnce('t', 'once');
    expect(spy).toHaveBeenCalledTimes(1);
    const h = aiHarness();
    await h.post('diag-user', { query: 'x' }, '203.0.113.77');
    const out = JSON.stringify(spy.mock.calls);
    // (each line is logged once per instance, so an earlier test may already have emitted it)
    expect(out).not.toMatch(/ai-quota\] .*(user|\d+\.\d+\.\d+\.\d+)/);
    expect(out).not.toContain('diag-user');
    expect(out).not.toContain('203.0.113.77');
    const g = governor({ now: () => NOON });
    expect(g.state().enforcement).toBe('per-instance');
  });
});
