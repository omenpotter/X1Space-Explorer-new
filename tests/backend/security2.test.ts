// Second round of security regression tests: R5 (SSRF), R2 strict mode and the QuotaCounter actor, R8 governor v2.
// MOCKED: no network, no billable AI call, no real key, no Base44 runtime. See docs/upgrade/SECURITY_REGRESSION_TESTS.md.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as H from '../../base44/shared/handlers.ts';
import { aiQuotaConfigFrom, reserveAiQuota } from '../../base44/shared/ai.ts';
import { fetchImage } from '../../base44/shared/image.ts';
import { ActorQuota, BookError, CounterBook, shardFor } from '../../base44/shared/quotaCounter.ts';
import {
  aiQuotaBackend,
  EntityCounterQuota,
  EntityLedgerQuota,
  isStrictBackend,
  KvQuota,
  MemoryQuota,
  parseAiQuotaMode,
  type QuotaBackend,
} from '../../base44/shared/quota.ts';
import { NinjaGovernor, NINJA_DEFAULTS } from '../../base44/shared/ninjaQuota.ts';
import {
  createGuardedFetch,
  hostnameVerdict,
  isPublicIp,
  parseIPv6,
  runtimeResolver,
} from '../../base44/shared/ssrf.ts';
import { safeHttpsUrl } from '../../base44/shared/validate.ts';
import { MemoryStore } from '../../base44/shared/store.ts';
import QuotaCounter from '../../base44/actors/QuotaCounter/entry.ts';
import { fakeEntity, makeDeps, makeWorld } from './helpers.ts';

const ROOT = path.resolve(__dirname, '../..');
const NOON = Date.UTC(2026, 10, 17, 12, 0, 0);
const tick = () => new Promise((r) => setTimeout(r, 0));

// ======================================================================================================
// R5: SSRF
// ======================================================================================================

describe('R5 hostname filter', () => {
  const BLOCKED: [string, string][] = [
    ['https://localhost/a', 'single label'],
    ['https://localhost./a', 'trailing dot (the reported bypass)'],
    ['https://LOCALHOST./a', 'trailing dot, upper case'],
    ['https://foo.localhost/a', 'localhost subdomain'],
    ['https://foo.localhost./a', 'localhost subdomain, trailing dot'],
    ['https://metadata.google.internal/a', 'GCP metadata name'],
    ['https://metadata.google.internal./a', 'GCP metadata name, trailing dot'],
    ['https://printer.lan./a', '.lan trailing dot'],
    ['https://host.local/a', '.local (mDNS)'],
    ['https://nas.home.arpa/a', 'home.arpa'],
    ['https://1.0.0.127.in-addr.arpa/a', 'reverse DNS name'],
    ['https://svc.cluster.local/a', 'Kubernetes service'],
    ['https://x.corp/a', '.corp'],
    ['https://x.intranet/a', '.intranet'],
    ['https://127.0.0.1/a', 'loopback'],
    ['https://127.1/a', 'short IPv4'],
    ['https://0x7f.0.0.1/a', 'hex IPv4'],
    ['https://0177.0.0.1/a', 'octal IPv4'],
    ['https://2130706433/a', 'decimal IPv4'],
    ['https://017700000001/a', 'octal integer IPv4'],
    ['https://0x7f000001/a', 'hex integer IPv4'],
    ['https://10.0.0.1/a', 'RFC1918'],
    ['https://172.16.0.1/a', 'RFC1918'],
    ['https://192.168.1.1/a', 'RFC1918'],
    ['https://169.254.169.254/a', 'cloud metadata'],
    ['https://100.100.100.200/a', 'Alibaba metadata'],
    ['https://100.64.0.1/a', 'CGNAT'],
    ['https://0.0.0.0/a', 'unspecified'],
    ['https://8.8.8.8/a', 'public IPv4 literal (literals are refused outright)'],
    ['https://[::1]/a', 'IPv6 loopback'],
    ['https://[::ffff:127.0.0.1]/a', 'IPv4-mapped loopback'],
    ['https://[::ffff:169.254.169.254]/a', 'IPv4-mapped metadata'],
    ['https://[fd00:ec2::254]/a', 'AWS IPv6 metadata'],
    ['https://[fe80::1]/a', 'link-local IPv6'],
    ['https://[2001:db8::1]/a', 'documentation IPv6'],
    ['https://127.0.0.1.nip.io/a', 'wildcard DNS'],
    ['https://169.254.169.254.nip.io/a', 'wildcard DNS to metadata'],
    ['https://anything.sslip.io/a', 'wildcard DNS'],
    ['https://anything.localtest.me/a', 'rebinding helper domain'],
    ['https://10.0.0.1.attacker-example.com/a', 'name embeds an IPv4 address'],
    ['https://127-0-0-1.attacker-example.com/a', 'hyphenated embedded IPv4'],
    ['https://evil.com@10.0.0.1/a', 'userinfo trick'],
    ['https://user:pw@example.com/a', 'credentials'],
    ['https://example.com:8443/a', 'non-443 port'],
    ['http://example.com/a', 'plain http'],
    ['ftp://example.com/a', 'ftp'],
    ['file:///etc/passwd', 'file'],
    ['gopher://example.com/', 'gopher'],
    ['data:image/png;base64,AAAA', 'data URL'],
    ['https://example.com../a', 'double trailing dot'],
    ['https://a..b.example.com/a', 'empty label'],
    ['https://-bad.example.com/a', 'label starts with hyphen'],
  ];
  for (const [url, why] of BLOCKED) it(`refuses ${url} (${why})`, () => expect(safeHttpsUrl(url)).toBeNull());

  const ALLOWED = [
    'https://app.xdex.xyz/assets/images/tokens/x1.webp',
    'https://raw.githubusercontent.com/x1-labs/assets/main/tokens/pltr-x/logo.png',
    'https://ipfs.io/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    'https://cloudflare-ipfs.com/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/logo.png',
    'https://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi.ipfs.dweb.link/meta.json',
    'https://gateway.pinata.cloud/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
    'https://nftstorage.link/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    'https://arweave.net/Yz2pJ0n7r4mQ1QyFq8a5q0uYbYk9gIeW0m2sKz6Gj1o',
    'https://example.com/meta.json',
    'https://example.com./meta.json', // an absolute public name is fine; it is normalised, not refused
    'https://img.example.com/logo.png',
    'https://xn--r8jz45g.jp/a', // internationalised domain
    'https://cdn.jsdelivr.net/gh/x/y@1/logo.svg',
    'https://a1b2c3d4.cloudfront.net/logo.png',
    'https://7f3a9c12.cdn.example.org/logo.png', // hash-like label must not be mistaken for an IP
  ];
  for (const url of ALLOWED) it(`still allows ${url}`, () => expect(safeHttpsUrl(url)).not.toBeNull());

  it('hostnameVerdict explains the refusal', () => {
    expect(hostnameVerdict('localhost.')).toBe('single_label');
    expect(hostnameVerdict('metadata.google.internal.')).toBe('private_suffix');
    expect(hostnameVerdict('127.0.0.1.nip.io')).toBe('rebinding_service');
    expect(hostnameVerdict('example.com')).toBeNull();
  });
});

describe('R5 IP classification (used for resolved addresses)', () => {
  const PRIVATE = [
    '0.0.0.0', '10.1.2.3', '127.0.0.1', '127.255.255.255', '100.64.0.1', '100.127.255.255', '169.254.169.254', '172.16.0.1', '172.31.255.255',
    '192.0.0.192', '192.0.2.1', '192.168.0.1', '198.18.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '240.0.0.1', '255.255.255.255',
    '::', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '::ffff:a9fe:a9fe', '::127.0.0.1', '64:ff9b::7f00:1', '64:ff9b::a9fe:a9fe', '2002:7f00:1::', '2002:a9fe:a9fe::1',
    'fc00::1', 'fd00:ec2::254', 'fe80::1', 'fe80::1%eth0', 'fec0::1', 'ff02::1', '2001:db8::1', '2001:0:4136:e378:8000:63bf:3fff:fdd2', '100::1', '[::1]', 'not-an-ip', '1.2.3', '999.1.1.1',
  ];
  for (const ip of PRIVATE) it(`${ip} is not public`, () => expect(isPublicIp(ip)).toBe(false));
  const PUBLIC = ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.255.255', '172.32.0.1', '100.63.255.255', '100.128.0.1', '2606:4700:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8', '64:ff9b::808:808', '2002:808:808::1'];
  for (const ip of PUBLIC) it(`${ip} is public`, () => expect(isPublicIp(ip)).toBe(true));
  it('parses IPv6 forms', () => {
    expect(parseIPv6('::1')).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(parseIPv6('::ffff:1.2.3.4')).toEqual([0, 0, 0, 0, 0, 0xffff, 0x102, 0x304]);
    expect(parseIPv6('1:2:3:4:5:6:7:8')).toHaveLength(8);
    expect(parseIPv6('1::2::3')).toBeNull();
    expect(parseIPv6('12345::1')).toBeNull();
    expect(parseIPv6('example.com')).toBeNull();
  });
});

describe('R5 guarded fetch (resolved-address layer)', () => {
  const mk = (map: Record<string, string[] | Error>, calls: string[] = [], resolved: string[] = []) =>
    createGuardedFetch(
      async (u) => { calls.push(u); return new Response('ok'); },
      {
        validateUrl: safeHttpsUrl,
        now: () => NOON,
        resolve: async (h) => {
          resolved.push(h);
          const v = map[h];
          if (v instanceof Error) throw v;
          if (!v) throw new Error('nxdomain');
          return v;
        },
      },
    );

  it('lets a public name through', async () => {
    const calls: string[] = [];
    await mk({ 'cdn.example.org': ['93.184.216.34', '2606:4700:4700::1111'] }, calls)('https://cdn.example.org/a.png');
    expect(calls).toEqual(['https://cdn.example.org/a.png']);
  });
  it('refuses a public name that resolves to a private, loopback, link-local or metadata address, before any request', async () => {
    for (const bad of ['10.0.0.5', '127.0.0.1', '169.254.169.254', '::1', 'fd00:ec2::254', '::ffff:10.0.0.1', '100.100.100.200']) {
      const calls: string[] = [];
      await expect(mk({ 'evil.example.org': [bad] }, calls)('https://evil.example.org/x')).rejects.toMatchObject({ kind: 'private_address' });
      expect(calls).toHaveLength(0);
    }
  });
  it('refuses when ANY answer is private (a mixed answer is how rebinding is staged)', async () => {
    const calls: string[] = [];
    await expect(mk({ 'mixed.example.org': ['93.184.216.34', '10.0.0.5'] }, calls)('https://mixed.example.org/')).rejects.toMatchObject({ kind: 'private_address' });
    expect(calls).toHaveLength(0);
  });
  it('refuses when the name does not resolve (it cannot be proven public)', async () => {
    const calls: string[] = [];
    await expect(mk({}, calls)('https://nowhere.example.org/')).rejects.toMatchObject({ kind: 'resolve_failed' });
    expect(calls).toHaveLength(0);
  });
  it('refuses URLs the lexical filter refuses without resolving them at all', async () => {
    const resolved: string[] = [];
    await expect(mk({}, [], resolved)('https://localhost./x')).rejects.toMatchObject({ kind: 'url_refused' });
    await expect(mk({}, [], resolved)('http://example.com/x')).rejects.toMatchObject({ kind: 'url_refused' });
    expect(resolved).toHaveLength(0);
  });
  it('checks every redirect hop, because each hop is a fresh request through the guard', async () => {
    const calls: string[] = [];
    const resolved: string[] = [];
    const g = createGuardedFetch(
      async (u) => {
        calls.push(u);
        return u.includes('first.example.org') ? new Response(null, { status: 302, headers: { location: 'https://second.example.org/b.png' } }) : new Response('x');
      },
      { validateUrl: safeHttpsUrl, now: () => NOON, resolve: async (h) => { resolved.push(h); return h === 'second.example.org' ? ['10.0.0.9'] : ['93.184.216.34']; } },
    );
    expect(await fetchImage(g, 'https://first.example.org/a.png')).toBeNull();
    expect(resolved).toEqual(['first.example.org', 'second.example.org']);
    expect(calls).toEqual(['https://first.example.org/a.png']); // the second hop was never requested
  });
  it('is dormant where the runtime has no DNS API (Cloudflare Workers): documented residual exposure', () => {
    expect(runtimeResolver()).toBeNull(); // Node has no Deno.resolveDns, exactly like Workers
  });
});

describe('R5 image proxy end to end (mocked fetch)', () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const png = () => new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } });
  const redirect = (to: string) => new Response(null, { status: 302, headers: { location: to } });
  const run = (first: string, table: Record<string, () => Response>, calls: string[] = []) =>
    fetchImage(async (u) => { calls.push(u); return (table[u] ?? (() => new Response('no', { status: 404 })))(); }, first);

  it('serves a normal image and an IPFS gateway image', async () => {
    expect((await run('https://app.xdex.xyz/a.png', { 'https://app.xdex.xyz/a.png': png }))?.contentType).toBe('image/png');
    expect((await run('https://ipfs.io/ipfs/QmX', { 'https://ipfs.io/ipfs/QmX': png }))?.contentType).toBe('image/png');
  });
  it('follows a public redirect', async () => {
    expect(await run('https://a.example.org/1', { 'https://a.example.org/1': () => redirect('https://b.example.org/2.png'), 'https://b.example.org/2.png': png })).not.toBeNull();
  });
  it('refuses redirects to internal destinations, however they are spelled, and never requests them', async () => {
    for (const target of ['http://169.254.169.254/latest/meta-data', 'https://localhost./x', 'https://127.0.0.1.nip.io/x', 'https://[::ffff:7f00:1]/x', 'https://2130706433/x', 'https://metadata.google.internal./x', 'file:///etc/passwd', 'https://a.example.org:8443/x', 'https://u:p@a.example.org/x']) {
      const calls: string[] = [];
      expect(await run('https://a.example.org/1', { 'https://a.example.org/1': () => redirect(target) }, calls)).toBeNull();
      expect(calls).toEqual(['https://a.example.org/1']);
    }
  });
  it('stops redirect loops and long chains', async () => {
    const calls: string[] = [];
    expect(await run('https://a.example.org/1', { 'https://a.example.org/1': () => redirect('https://a.example.org/1') }, calls)).toBeNull();
    expect(calls.length).toBeLessThanOrEqual(4);
  });
  it('refuses SVG, HTML, mislabelled bytes and oversized bodies', async () => {
    const t = (body: BodyInit, type: string) => run('https://a.example.org/1', { 'https://a.example.org/1': () => new Response(body, { headers: { 'content-type': type } }) });
    expect(await t('<svg onload=alert(1)>', 'image/svg+xml')).toBeNull();
    expect(await t('<html>', 'text/html')).toBeNull();
    expect(await t(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 'image/png')).toBeNull();
    expect(await t(new Uint8Array(1_000_001).fill(0), 'image/png')).toBeNull();
  });
  it('an attacker-controlled image URL on a trailing-dot host is refused by the handler path, with no request made to it', async () => {
    const w = makeWorld();
    w.images['https://localhost./x.png'] = png;
    const d: any = makeDeps(w);
    const guarded = createGuardedFetch(d.fetch, { validateUrl: safeHttpsUrl });
    d.untrustedFetch = guarded;
    const img = await fetchImage(guarded, 'https://localhost./x.png');
    expect(img).toBeNull();
    expect(w.fetchCalls.some((c) => c.url.includes('localhost'))).toBe(false);
  });
});

// ======================================================================================================
// R2: strict mode, the QuotaCounter actor, and the single enforcement path
// ======================================================================================================

/** A fake `asServiceRole.actors` module: one CounterBook per shard, called with the service identity. */
function fakeActors(opts: { fail?: boolean } = {}) {
  const books = new Map<string, CounterBook>();
  const calls: string[] = [];
  const book = (shard: string) => {
    let b = books.get(shard);
    if (!b) {
      const store = new Map<string, unknown>();
      b = new CounterBook({ load: async () => store.get('book') as any, save: async (s) => { store.set('book', JSON.parse(JSON.stringify(s))); }, now: () => NOON });
      books.set(shard, b);
    }
    return b;
  };
  const module = {
    QuotaCounter: (shard: string) => {
      const b = book(shard);
      const wrap = (name: 'reserve' | 'release' | 'used' | 'set') => async (a: unknown) => {
        calls.push(`${shard}.${name}`);
        if (opts.fail) throw new Error('actor not deployed');
        return (b as any)[name](a);
      };
      return { reserve: wrap('reserve'), release: wrap('release'), used: wrap('used'), set: wrap('set') };
    },
  };
  return { module, calls, books };
}

describe('R2 strict mode (no silent fallback to weaker enforcement)', () => {
  const entity = fakeEntity();
  it('parses AI_QUOTA_MODE: only the exact text best_effort weakens enforcement', () => {
    expect(parseAiQuotaMode(undefined)).toBe('strict');
    for (const v of ['strict', 'STRICT', 'besteffort', 'best-effort', 'true', '1', '', 'best_effort ', 'BEST_EFFORT']) {
      expect(parseAiQuotaMode(v)).toBe(v.trim().toLowerCase() === 'best_effort' ? 'best_effort' : 'strict');
    }
    expect(aiQuotaConfigFrom(() => undefined).mode).toBe('strict');
    expect(aiQuotaConfigFrom((n) => (n === 'AI_QUOTA_MODE' ? 'oops' : undefined)).mode).toBe('strict');
  });
  it('selects the atomic actor when the platform client has actors', async () => {
    const b = await aiQuotaBackend({ asServiceRole: { actors: fakeActors().module, entities: { RateLimit: entity } } });
    expect(b?.kind).toBe('actor');
    expect(isStrictBackend(b)).toBe(true);
  });
  it('strict mode with only the entity store returns NO backend (AI refuses)', async () => {
    expect(await aiQuotaBackend({ asServiceRole: { entities: { RateLimit: entity } } }, 'strict')).toBeNull();
    expect(await aiQuotaBackend({ asServiceRole: { entities: { RateLimit: entity } } })).toBeNull(); // default is strict
    expect(await aiQuotaBackend(null)).toBeNull();
  });
  it('the non-atomic ledger is reachable only through the explicit best_effort opt-in', async () => {
    const b = await aiQuotaBackend({ asServiceRole: { entities: { RateLimit: entity } } }, 'best_effort');
    expect(b?.kind).toBe('ledger');
    expect(isStrictBackend(b)).toBe(false);
  });
  it('reserveAiQuota refuses a non-strict backend even if a caller hands it one (defence in depth)', async () => {
    const cfg = { perUser: 5, perIp: 50, global: 50 };
    const ledger = new EntityLedgerQuota(fakeEntity());
    const counter = new EntityCounterQuota(fakeEntity());
    const perInstance = new MemoryQuota(() => NOON); // atomic but not shared
    for (const b of [ledger, counter, perInstance]) {
      const r = await reserveAiQuota(new MemoryStore(), b, { id: 'u' }, '1.1.1.1', cfg, () => NOON);
      expect(r).toMatchObject({ ok: false, status: 503, code: 'ai_unavailable' });
    }
    expect(await reserveAiQuota(new MemoryStore(), ledger, { id: 'u' }, '1.1.1.1', { ...cfg, mode: 'best_effort' }, () => NOON)).toMatchObject({ ok: true });
    expect(await reserveAiQuota(new MemoryStore(), new ActorQuota(fakeActors().module), { id: 'u' }, '1.1.1.1', cfg, () => NOON)).toMatchObject({ ok: true });
  });
  it('a refusal in strict mode writes nothing to the store and never reaches the model', async () => {
    const api = fakeEntity();
    let model = 0;
    const d: any = { ...makeDeps(makeWorld(), { now: () => NOON }), aiQuotaConfig: { perUser: 5, perIp: 50, global: 50 }, aiQuota: (c: any, m: any) => aiQuotaBackend(c, m) };
    d.clientFor = () => ({ auth: { me: async () => ({ id: 'u' }) }, asServiceRole: { entities: { RateLimit: api }, integrations: { Core: { InvokeLLM: async () => { model++; return {}; } } } } });
    const r = await H.smartSearchHandler(d)(new Request('https://x/f', { method: 'POST', body: '{"query":"a"}', headers: { 'content-type': 'application/json' } }));
    expect(r.status).toBe(503);
    expect(model).toBe(0);
    expect(api.rows).toHaveLength(0);
  });
  it('an unreachable or undeployed actor fails closed', async () => {
    const d: any = { ...makeDeps(makeWorld(), { now: () => NOON }), aiQuotaConfig: { perUser: 5, perIp: 50, global: 50 }, aiQuota: (c: any, m: any) => aiQuotaBackend(c, m) };
    let model = 0;
    d.clientFor = () => ({ auth: { me: async () => ({ id: 'u' }) }, asServiceRole: { actors: fakeActors({ fail: true }).module, integrations: { Core: { InvokeLLM: async () => { model++; return {}; } } } } });
    const r = await H.smartSearchHandler(d)(new Request('https://x/f', { method: 'POST', body: '{"query":"a"}', headers: { 'content-type': 'application/json' } }));
    expect(r.status).toBe(503);
    expect(model).toBe(0);
  });
});

describe('R2 atomic reservation through the actor', () => {
  const clientFor = (actors: any) => ({ asServiceRole: { actors } });
  it('40 simultaneous requests across 8 separate function instances take exactly `global` units', async () => {
    const { module } = fakeActors();
    const instances = Array.from({ length: 8 }, () => new ActorQuota(module)); // each function instance has its own client
    const cfg = { perUser: 100, perIp: 1000, global: 7 };
    const rs = await Promise.all(Array.from({ length: 40 }, (_, i) => reserveAiQuota(new MemoryStore(), instances[i % 8], { id: `user${i}` }, `9.9.${i}.1`, cfg, () => NOON)));
    expect(rs.filter((r) => r.ok)).toHaveLength(7);
    expect(rs.filter((r) => !r.ok && (r as any).code === 'ai_capacity_reached')).toHaveLength(33);
  });
  it('refunds do not leak or double-spend: refused callers end with zero reserved, the global counter is exact', async () => {
    const { module, books } = fakeActors();
    const q = new ActorQuota(module);
    const cfg = { perUser: 3, perIp: 1000, global: 5 };
    const rs = await Promise.all(Array.from({ length: 30 }, (_, i) => reserveAiQuota(new MemoryStore(), q, { id: `u${i}` }, `8.8.${i}.1`, cfg, () => NOON)));
    expect(rs.filter((r) => r.ok)).toHaveLength(5);
    const winners = rs.map((r, i) => [r.ok, i] as const).filter(([ok]) => ok).map(([, i]) => `u${i}`);
    const day = Math.floor(NOON / 86_400_000);
    expect(await q.used(`ai-global:${day}`)).toBe(5);
    for (let i = 0; i < 30; i++) expect(await q.used(`ai-user:u${i}:${day}`)).toBe(winners.includes(`u${i}`) ? 1 : 0);
    expect(books.size).toBeGreaterThan(1); // keys are spread over shards
  });
  it('after a refund the unit really is available again', async () => {
    const { module } = fakeActors();
    const q = new ActorQuota(module);
    const r1 = await q.reserve('k', 1, 1, 60_000);
    expect(r1.granted).toBe(true);
    expect((await q.reserve('k', 1, 1, 60_000)).granted).toBe(false);
    await q.release('k', r1);
    expect((await q.reserve('k', 1, 1, 60_000)).granted).toBe(true);
    await q.release('k', r1, 5); // a surplus refund can never push the counter below zero
    await q.release('k', r1, 5);
    expect(await q.used('k')).toBe(0);
  });
  it('shards: ninja and global keys have fixed shards, user keys spread over 16', () => {
    expect(shardFor('x1ninja:min:1')).toBe('x1ninja');
    expect(shardFor('ai-global:20000')).toBe('ai-global');
    const shards = new Set(Array.from({ length: 400 }, (_, i) => shardFor(`ai-user:u${i}:20000`)));
    expect(shards.size).toBeGreaterThan(8);
    expect(shards.size).toBeLessThanOrEqual(16);
    expect(shardFor('ai-user:abc:1')).toBe(shardFor('ai-user:abc:1'));
  });
  it('selects the actor over entity storage and does not need the entity at all', async () => {
    const { module, calls } = fakeActors();
    const b = await aiQuotaBackend(clientFor(module));
    expect((await reserveAiQuota(new MemoryStore(), b, { id: 'u' }, '1.2.3.4', { perUser: 2, perIp: 2, global: 2 }, () => NOON)).ok).toBe(true);
    expect(calls.length).toBe(3); // user, ip, global
  });
});

describe('QuotaCounter actor and CounterBook', () => {
  const svc = { identity: { type: 'service' } };
  const anon = { identity: { type: 'anonymous', anonymousId: 'a' } };
  const user = { identity: { type: 'authenticated', userId: 'u' } };
  const args = (o: object = {}) => ({ key: 'k', amount: 1, limit: 10, ttlMs: 60_000, ...o });

  it('lists exactly its four methods as callable and refuses WebSocket connections', async () => {
    expect((QuotaCounter as any).callable).toEqual(['reserve', 'release', 'used', 'set']);
    const a: any = new QuotaCounter();
    let rejected: unknown[] = [];
    await a.handleConnect({ reject: (...x: unknown[]) => { rejected = x; } });
    expect(rejected[0]).toBe(4003);
  });
  it('only the service role may call a method: anonymous, signed-in and missing identities get 403', async () => {
    const a: any = new QuotaCounter();
    for (const m of ['reserve', 'release', 'used', 'set'] as const) {
      for (const ctx of [anon, user, undefined, {}, { identity: { type: 'Service' } }, { identity: { type: 'service ' } }]) {
        await expect(Promise.resolve().then(() => a[m](args({ value: 1 }), ctx))).rejects.toMatchObject({ status: 403 });
      }
    }
    expect(await a.reserve(args(), svc)).toMatchObject({ granted: true });
  });
  it('a refused anonymous call cannot change the counter', async () => {
    const a: any = new QuotaCounter();
    await a.reserve(args({ limit: 1 }), svc);
    await expect(Promise.resolve().then(() => a.release(args(), anon))).rejects.toMatchObject({ status: 403 });
    await expect(Promise.resolve().then(() => a.set(args({ value: 0 }), anon))).rejects.toMatchObject({ status: 403 });
    expect(await a.used({ key: 'k' }, svc)).toEqual({ used: 1 });
  });
  it('is atomic: 60 simultaneous calls on a cold instance grant exactly the limit (including the first-load race)', async () => {
    const a: any = new QuotaCounter();
    const rs = await Promise.all(Array.from({ length: 60 }, () => a.reserve(args({ limit: 10 }), svc)));
    expect(rs.filter((r: any) => r.granted)).toHaveLength(10);
    expect(Math.max(...rs.map((r: any) => r.used))).toBe(10);
  });
  it('survives hibernation: a fresh instance over the same storage keeps the count', async () => {
    const a: any = new QuotaCounter();
    for (let i = 0; i < 4; i++) await a.reserve(args(), svc);
    const b: any = new QuotaCounter();
    b.storage = a.storage; // same durable storage, new in-memory instance
    expect(await b.used({ key: 'k' }, svc)).toEqual({ used: 4 });
    expect((await b.reserve(args({ limit: 5 }), svc)).granted).toBe(true);
    expect((await b.reserve(args({ limit: 5 }), svc)).granted).toBe(false);
  });
  it('validates every argument, with 400 for malformed input', async () => {
    const a: any = new QuotaCounter();
    const bad = [{ key: '' }, { key: 'x'.repeat(201) }, { key: 'a b' }, { key: 'a/b' }, { amount: 0 }, { amount: 1.5 }, { amount: '1' }, { amount: -1 }, { limit: 0 }, { limit: Infinity }, { limit: NaN }, { limit: 2e9 }, { ttlMs: 10 }, { ttlMs: 1e12 }, { ttlMs: '60000' }];
    for (const o of bad) await expect(Promise.resolve().then(() => a.reserve({ ...args(), ...o }, svc))).rejects.toMatchObject({ status: 400 });
    await expect(Promise.resolve().then(() => a.reserve(undefined, svc))).rejects.toMatchObject({ status: 400 });
    await expect(Promise.resolve().then(() => a.reserve('not an object', svc))).rejects.toMatchObject({ status: 400 });
  });
  it('expires on its own (UTC day boundary) and keeps the book bounded', async () => {
    let t = Date.UTC(2026, 10, 17, 23, 59, 0);
    const store = new Map<string, unknown>();
    const book = new CounterBook({ load: async () => store.get('b') as any, save: async (s) => { store.set('b', s); }, now: () => t });
    const ttl = Date.UTC(2026, 10, 18) - t + 3_600_000;
    expect((await book.reserve({ key: 'ai-global:1', amount: 1, limit: 1, ttlMs: ttl })).granted).toBe(true);
    expect((await book.reserve({ key: 'ai-global:1', amount: 1, limit: 1, ttlMs: ttl })).granted).toBe(false);
    t = Date.UTC(2026, 10, 18, 1, 0, 1); // one hour after midnight: the entry is gone
    expect((await book.reserve({ key: 'ai-global:1', amount: 1, limit: 1, ttlMs: ttl })).granted).toBe(true);
    for (let i = 0; i < 300; i++) await book.reserve({ key: `ai-user:${i}:1`, amount: 1, limit: 1, ttlMs: 1000 });
    t += 5000;
    await book.reserve({ key: 'z', amount: 1, limit: 1, ttlMs: 1000 });
    expect(((store.get('b') as any[]) ?? []).length).toBeLessThan(5); // expired entries are not persisted
  });
  it('a storage failure surfaces as an error (fail closed), and the book recovers on the next call', async () => {
    let failing = true;
    const book = new CounterBook({ load: async () => { if (failing) throw new Error('storage down'); return []; }, save: async () => {} });
    await expect(book.reserve(args())).rejects.toThrow('storage down');
    failing = false;
    expect((await book.reserve(args())).granted).toBe(true);
    expect(new BookError(400, 'x').status).toBe(400);
  });
  it('set/used carry a deadline value', async () => {
    const a: any = new QuotaCounter();
    await a.set({ key: 'x1ninja:cooldown', value: NOON + 60_000, ttlMs: 60_000 }, svc);
    expect(await a.used({ key: 'x1ninja:cooldown' }, svc)).toEqual({ used: NOON + 60_000 });
  });
});

describe('R2 all billable AI entry points share one enforcement path (static)', () => {
  const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const walk = (dir: string): string[] => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  it('the only server-side model call is inside aiEndpoint, after reserveAiQuota', () => {
    const files = walk('base44').filter((f) => /\.ts$/.test(f) && /InvokeLLM\s*\(/.test(read(f)));
    expect(files).toEqual([path.join('base44', 'shared', 'handlers.ts')]);
    const h = read('base44/shared/handlers.ts');
    expect(h.match(/InvokeLLM\s*\(/g)).toHaveLength(1);
    expect(h.indexOf('reserveAiQuota(store')).toBeGreaterThan(-1);
    expect(h.indexOf('reserveAiQuota(store')).toBeLessThan(h.indexOf('InvokeLLM('));
    expect(h.match(/aiEndpoint\(\s*'/g)).toHaveLength(2); // smartSearch and tokenVerificationAssistant
  });
  it('every other model-capable integration is absent from backend code, and the browser has no billable call', () => {
    for (const f of walk('base44').filter((x) => /\.ts$/.test(x))) {
      const t = read(f);
      expect(t, f).not.toMatch(/GenerateImage\s*\(|SendEmail\s*\(|SendSMS\s*\(|ExtractDataFromUploadedFile\s*\(/);
    }
    for (const f of walk('src').filter((x) => /\.(jsx?|tsx?)$/.test(x) && !x.endsWith(path.join('api', 'integrations.js')))) {
      expect(read(f), f).not.toMatch(/InvokeLLM|integrations\.Core/);
    }
  });
  it('only the two AI function entries use the AI endpoint, and both obtain the client the same way', () => {
    const uses = ['smartSearch', 'tokenVerificationAssistant'].map((n) => read(`base44/functions/${n}/entry.ts`));
    for (const u of uses) expect(u).toMatch(/depsWithClient\(/);
    for (const n of fs.readdirSync(path.join(ROOT, 'base44/functions')).filter((x) => !['smartSearch', 'tokenVerificationAssistant'].includes(x))) {
      expect(read(`base44/functions/${n}/entry.ts`), n).not.toMatch(/smartSearchHandler|tokenVerificationHandler/);
    }
  });
});

// ======================================================================================================
// R8: governor v2
// ======================================================================================================

function sharedGov(t: { v: number }, backends: QuotaBackend[], limits: Partial<typeof NINJA_DEFAULTS> = {}) {
  return new NinjaGovernor({ limits: () => ({ ...NINJA_DEFAULTS, ...limits }), backends: async () => backends, now: () => t.v });
}
const sharedMem = (t: { v: number }) => new MemoryQuota(() => t.v, 5000, true);

describe('R8 minute boundary (sliding window)', () => {
  it('50 requests at the end of a minute do NOT allow another 50 immediately after the boundary', async () => {
    const t = { v: Date.UTC(2026, 10, 17, 12, 0, 59, 500) };
    const g = sharedGov(t, [sharedMem(t)]);
    let first = 0;
    for (let i = 0; i < 60; i++) if ((await g.reserve()).ok) first++;
    expect(first).toBe(50);
    t.v = Date.UTC(2026, 10, 17, 12, 1, 0, 100); // 0.6 s later, next minute
    let burst = 0;
    for (let i = 0; i < 60; i++) if ((await g.reserve()).ok) burst++;
    expect(burst).toBeLessThanOrEqual(1); // a fixed window would allow 50 here: 100 requests in 0.6 s
  });
  it('capacity returns gradually through the minute and fully after it', async () => {
    const t = { v: Date.UTC(2026, 10, 17, 12, 0, 30) };
    const mem = sharedMem(t);
    const g = sharedGov(t, [mem]);
    for (let i = 0; i < 50; i++) await g.reserve();
    t.v = Date.UTC(2026, 10, 17, 12, 1, 30); // halfway into the next minute
    let half = 0;
    for (let i = 0; i < 60; i++) if ((await g.reserve()).ok) half++;
    expect(half).toBe(25); // 50 - ceil(50 * 0.5)
    t.v = Date.UTC(2026, 10, 17, 12, 3, 0);
    expect((await g.reserve()).ok).toBe(true);
  });
  it('any 60-second span never carries more than the configured 50 (with a steady 1 request per second, and a worst-case burst)', async () => {
    const t = { v: Date.UTC(2026, 10, 17, 12, 0, 0) };
    const g = sharedGov(t, [sharedMem(t)]);
    const sent: number[] = [];
    for (let s = 0; s < 600; s++) {
      t.v = Date.UTC(2026, 10, 17, 12, 0, 0) + s * 1000;
      for (let k = 0; k < 3; k++) if ((await g.reserve()).ok) sent.push(t.v); // three attempts per second
    }
    let worst = 0;
    for (let i = 0; i < sent.length; i++) {
      const inWindow = sent.filter((x) => x >= sent[i] && x < sent[i] + 60_000).length;
      worst = Math.max(worst, inWindow);
    }
    expect(worst).toBeLessThanOrEqual(60); // never above the provider's own 60 per minute
    expect(worst).toBeLessThanOrEqual(75);
  });
});

describe('R8 cross-instance Retry-After', () => {
  it('a 429 seen by one instance pauses the others, without them sending anything', async () => {
    const t = { v: NOON };
    const mem = sharedMem(t);
    const a = sharedGov(t, [mem]);
    const b = sharedGov(t, [mem]);
    expect((await b.reserve()).ok).toBe(true); // b is healthy
    t.v += 3000; // beyond b's cooldown re-check interval
    a.observe(429, new Headers({ 'retry-after': '90' }));
    await tick();
    const rb: any = await b.reserve();
    expect(rb).toMatchObject({ ok: false, reason: 'cooldown' });
    expect(rb.retryAfterMs).toBeGreaterThan(80_000);
    expect(rb.retryAfterMs).toBeLessThanOrEqual(90_000);
    t.v += 91_000;
    expect((await b.reserve()).ok).toBe(true);
  });
  it('without a shared store the cooldown stays local', async () => {
    const t = { v: NOON };
    const a = sharedGov(t, []);
    const b = sharedGov(t, []);
    a.observe(429, new Headers({ 'retry-after': '60' }));
    expect((await a.reserve()).ok).toBe(false);
    expect((await b.reserve()).ok).toBe(true); // b cannot know: the provider's 429 is its backstop
  });
});

describe('R8 upstream header reconciliation', () => {
  it('a lower provider limit lowers ours; a higher one never raises it', async () => {
    const t = { v: NOON };
    const low = sharedGov(t, [sharedMem(t)]);
    low.observe(200, new Headers({ 'x-ratelimit-limit': '20', 'x-ratelimit-remaining': '19' }));
    let ok = 0;
    for (let i = 0; i < 40; i++) if ((await low.reserve()).ok) ok++;
    expect(ok).toBe(20);
    const t2 = { v: NOON };
    const high = sharedGov(t2, [sharedMem(t2)]);
    high.observe(200, new Headers({ 'x-ratelimit-limit': '600', 'x-ratelimit-remaining': '599' }));
    let ok2 = 0;
    for (let i = 0; i < 80; i++) if ((await high.reserve()).ok) ok2++;
    expect(ok2).toBe(50);
  });
  it('pauses when the provider is nearly out, until its reset, and records what it reported', async () => {
    const t = { v: NOON };
    const g = sharedGov(t, []);
    g.observe(200, new Headers({ 'x-ratelimit-limit': '60', 'x-ratelimit-remaining': '2', 'x-ratelimit-reset': '40' }));
    expect(g.state().cooldownMs).toBe(40_000);
    expect(g.state().provider).toMatchObject({ limit: 60, remaining: 2 });
    expect((await g.reserve()).ok).toBe(false);
    g.observe(200, new Headers({ 'x-ratelimit-remaining': '30' }));
    expect(g.state().provider.remaining).toBe(30);
  });
  it('ignores malformed headers and non-numeric values', () => {
    const t = { v: NOON };
    const g = sharedGov(t, []);
    g.observe(200, new Headers({ 'x-ratelimit-limit': 'many', 'x-ratelimit-remaining': '-1', 'x-ratelimit-reset': 'soon' }));
    expect(g.state().cooldownMs).toBe(0);
    expect(g.state().provider).toEqual({ limit: null, remaining: null, resetMs: null });
  });
});

describe('R8 backend chain and degradation', () => {
  const failing = (kind: any): QuotaBackend & { n: number } => {
    const b: any = { kind, atomic: true, shared: true, n: 0, reserve: async () => { b.n++; throw new Error('down'); }, release: async () => {}, used: async () => { b.n++; throw new Error('down'); } };
    return b;
  };
  it('falls through to the next backend when the first fails, and stops retrying the failed one for a minute', async () => {
    const t = { v: NOON };
    const first = failing('actor');
    const second = new EntityCounterQuota(fakeEntity(), () => t.v);
    const g = sharedGov(t, [first, second]);
    for (let i = 0; i < 10; i++) expect((await g.reserve()).ok).toBe(true);
    const after = first.n;
    expect(after).toBeGreaterThan(0);
    expect(after).toBeLessThan(5); // not hammered on every request
    expect(g.state()).toMatchObject({ degraded: true, enforcement: 'shared-best-effort' });
    t.v += 61_000;
    await g.reserve();
    expect(first.n).toBeGreaterThan(after); // retried once the back-off is over
  });
  it('with every backend failing it counts per instance and keeps serving', async () => {
    const t = { v: NOON };
    const g = sharedGov(t, [failing('actor'), failing('counter')]);
    let ok = 0;
    for (let i = 0; i < 70; i++) if ((await g.reserve()).ok) ok++;
    expect(ok).toBe(50);
    expect(g.state().enforcement).toBe('per-instance');
  });
  it('an actor-backed governor is atomic across instances', async () => {
    const t = { v: NOON };
    const { module } = fakeActors();
    const gs = Array.from({ length: 5 }, () => sharedGov(t, [new ActorQuota(module)]));
    const rs = await Promise.all(Array.from({ length: 300 }, (_, i) => gs[i % 5].reserve()));
    expect(rs.filter((r) => r.ok)).toHaveLength(50);
    expect(gs[0].state().enforcement).toBe('shared-atomic');
  });
  it('Deno KV compare-and-set is still honoured as a backend', async () => {
    const kv = new Map<string, any>();
    const fake = {
      async get(k: unknown[]) { const e = kv.get(JSON.stringify(k)); return { key: k, value: e?.value ?? null, versionstamp: e?.v ?? null }; },
      atomic() { const c: any[] = []; const sets: any[] = []; const op: any = { check(x: any) { c.push(x); return op; }, set(k: unknown[], v: unknown) { sets.push([k, v]); return op; }, async commit() { if (c.some((x) => (kv.get(JSON.stringify(x.key))?.v ?? null) !== x.versionstamp)) return { ok: false }; for (const [k, v] of sets) kv.set(JSON.stringify(k), { value: v, v: Math.random() }); return { ok: true }; } }; return op; },
      async set(k: unknown[], v: unknown) { kv.set(JSON.stringify(k), { value: v, v: Math.random() }); },
    };
    const t = { v: NOON };
    const g = sharedGov(t, [new KvQuota(fake)]);
    let ok = 0;
    for (let i = 0; i < 60; i++) if ((await g.reserve()).ok) ok++;
    expect(ok).toBe(50);
  });
});

describe('R8 monthly reset and pagination, re-checked with the actor backend', () => {
  it('monthly counter is keyed by UTC cycle and starts fresh on the 1st', async () => {
    const t = { v: Date.UTC(2026, 10, 30, 23, 58) };
    const { module } = fakeActors();
    const q = new ActorQuota(module);
    const g = sharedGov(t, [q], { monthly: 25, perMinute: 60 });
    let ok = 0;
    for (let i = 0; i < 30; i++) if ((await g.reserve()).ok) ok++;
    expect(ok).toBe(25);
    expect(await q.used('x1ninja:month:2026-11')).toBe(25);
    t.v = Date.UTC(2026, 11, 1, 0, 0, 30);
    const r = await g.reserve();
    expect(r.ok).toBe(true);
    expect(await q.used('x1ninja:month:2026-12')).toBe(NINJA_DEFAULTS.leaseSize > 25 ? 25 : NINJA_DEFAULTS.leaseSize);
  });
});

describe('ops', () => {
  it('the function entries that pull the platform client use an SDK version that supports actors (0.8.62+)', () => {
    for (const n of fs.readdirSync(path.join(ROOT, 'base44/functions'))) {
      const m = /npm:@base44\/sdk@(\d+)\.(\d+)\.(\d+)/.exec(fs.readFileSync(path.join(ROOT, 'base44/functions', n, 'entry.ts'), 'utf8'));
      if (!m) continue;
      const [maj, min, pat] = [Number(m[1]), Number(m[2]), Number(m[3])];
      expect(maj > 0 || min > 8 || (min === 8 && pat >= 62), `${n} pins @base44/sdk@${m[1]}.${m[2]}.${m[3]}`).toBe(true);
    }
  });
});
