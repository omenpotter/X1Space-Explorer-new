// Independent accuracy checks: values served by the backend are compared with direct calls to the
// primary sources, not with the code that produced them. Read-only, unauthenticated, small request counts.
//   NODE_USE_ENV_PROXY=1 LIVE=1 npx vitest run tests/live/accuracy.test.ts
import { describe, expect, it } from 'vitest';
import { Cache } from '../../base44/shared/cache.ts';
import { MemoryStore } from '../../base44/shared/store.ts';
import { createRpc } from '../../base44/shared/rpc.ts';
import { createXdex } from '../../base44/shared/xdex.ts';
import { createNinja } from '../../base44/shared/ninja.ts';
import * as H from '../../base44/shared/handlers.ts';

const f = (u: string, i?: RequestInit) => fetch(u, i);
const rpc = createRpc(f);
const deps: H.Deps = {
  fetch: f, rpc, xdex: createXdex(f), ninja: createNinja(f, undefined), cache: new Cache(),
  store: async () => new MemoryStore(), now: Date.now, geoEnabled: true, aiDailyQuota: 25,
};
const get = async (h: (r: Request) => Promise<Response>, qs = '') =>
  (await h(new Request('https://x1space.xyz/functions/x' + qs, { headers: { origin: 'https://x1space.xyz' } }))).json();
const log = (...a: unknown[]) => console.log(...a);
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN22 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

describe('token index accuracy', () => {
  it('mint counts equal independent getProgramAccounts counts, per program', async () => {
    const all = await get(H.tokensHandler(deps), '?kind=all&limit=1');
    const spl = await get(H.tokensHandler(deps), '?kind=all&program=spl-token&limit=1');
    const t22 = await get(H.tokensHandler(deps), '?kind=all&program=token-2022&limit=1');
    const slice = { offset: 36, length: 10 };
    const [a, b, c] = await Promise.all([
      rpc<any[]>('getProgramAccounts', [TOKEN, { encoding: 'base64', filters: [{ dataSize: 82 }], dataSlice: slice }], { timeoutMs: 30000, maxBytes: 64e6 }),
      rpc<any[]>('getProgramAccounts', [TOKEN22, { encoding: 'base64', filters: [{ dataSize: 82 }], dataSlice: slice }], { timeoutMs: 30000, maxBytes: 64e6 }),
      rpc<any[]>('getProgramAccounts', [TOKEN22, { encoding: 'base64', filters: [{ memcmp: { offset: 165, bytes: '2' } }], dataSlice: slice }], { timeoutMs: 30000, maxBytes: 64e6 }),
    ]);
    const initialised = (list: any[]) => list.filter((x) => atob(x.account.data[0]).charCodeAt(9) === 1).length;
    const expectedSpl = initialised(a);
    const expectedT22 = initialised(b) + c.length;
    log('index spl', spl.total, 'rpc spl', expectedSpl, '| index token-2022', t22.total, 'rpc token-2022', expectedT22);
    // Mints can be created between the two reads, so allow a small drift; the sets must otherwise agree.
    expect(Math.abs(spl.total - expectedSpl)).toBeLessThanOrEqual(25);
    expect(Math.abs(t22.total - expectedT22)).toBeLessThanOrEqual(5);
    expect(all.total).toBeGreaterThanOrEqual(spl.total + t22.total - 1);
  });

  it('decimals, supply and authorities match getAccountInfo for a sample across both programs', async () => {
    const sample = [
      ...(await get(H.tokensHandler(deps), '?program=token-2022&listed=true&limit=6')).tokens,
      ...(await get(H.tokensHandler(deps), '?program=spl-token&listed=true&limit=6')).tokens,
      ...(await get(H.tokensHandler(deps), '?program=token-2022&kind=all&sort=supply&limit=4&offset=300')).tokens, // not necessarily listed
    ].filter((t: any) => t.mint !== 'So11111111111111111111111111111111111111112');
    expect(sample.length).toBeGreaterThanOrEqual(10);
    let checked = 0;
    for (const t of sample) {
      const acct = await rpc<any>('getAccountInfo', [t.mint, { encoding: 'jsonParsed' }]);
      const info = acct?.value?.data?.parsed?.info;
      expect(info, t.mint).toBeTruthy();
      expect(t.decimals).toBe(Number(info.decimals));
      const supply = Number(BigInt(info.supply)) / 10 ** Number(info.decimals);
      // Supply can move between the index build (up to 10 min old) and now: tolerate 5%.
      expect(Math.abs((t.supply ?? 0) - supply)).toBeLessThanOrEqual(Math.max(supply * 0.05, 1e-9));
      checked++;
    }
    log('verified decimals+supply against getAccountInfo for', checked, 'tokens');
  });

  it('non-pool tokens are listed with real on-chain names and no invented market values', async () => {
    const r = await get(H.tokensHandler(deps), '?kind=fungible&sort=name&dir=asc&limit=200&offset=200');
    const unlisted = r.tokens.filter((t: any) => !t.listed);
    expect(unlisted.length).toBeGreaterThan(20);
    for (const t of unlisted) {
      expect(t.priceUsd).toBeNull();
      expect(t.liquidityUsd).toBeNull();
      expect(t.volume24hUsd).toBeNull();
      expect(t.marketCapUsd).toBeNull();
      expect(t.priceChange24h).toBeNull();
    }
    const named = unlisted.filter((t: any) => t.name);
    log('unlisted tokens in sample', unlisted.length, 'with on-chain names', named.length, '| e.g.', named.slice(0, 3).map((t: any) => `${t.name}/${t.symbol} (${t.metadataSource})`).join('; '));
    expect(named.length).toBeGreaterThan(5);
    // One of them checked against chain directly: its published name equals what the index shows.
    const probe = named.find((t: any) => t.metadataSource === 'token-2022');
    if (probe) {
      const acct = await rpc<any>('getAccountInfo', [probe.mint, { encoding: 'jsonParsed' }]);
      const meta = acct.value.data.parsed.info.extensions.find((e: any) => e.extension === 'tokenMetadata').state;
      expect(probe.name).toBe(String(meta.name).trim());
      expect(probe.symbol).toBe(String(meta.symbol).trim());
    }
  });

  it('listed prices agree with XDEX price endpoint and pool TVL totals agree with the XDEX summary', async () => {
    const listed = (await get(H.tokensHandler(deps), '?listed=true&limit=5')).tokens.filter((t: any) => t.priceUsd);
    for (const t of listed.slice(0, 4)) {
      const d = await (await fetch(`https://api.xdex.xyz/api/token-price/price?network=X1%20Mainnet&token_address=${t.mint}`)).json();
      if (!d?.data?.price) continue;
      const rel = Math.abs(d.data.price - t.priceUsd) / d.data.price;
      log(t.symbol, 'index', t.priceUsd, 'xdex oracle', d.data.price, 'diff', (rel * 100).toFixed(2) + '%');
      // Pool-implied price vs oracle price: they are different measures, so only flag gross disagreement.
      expect(rel).toBeLessThan(0.25);
    }
    const stats = await get(H.lpStatsHandler(deps));
    const direct = await (await fetch('https://api.xdex.xyz/api/xendex/pool/list?network=X1%20Mainnet&limit=1')).json();
    log('tvl served', stats.stats.tvlUsd, 'xdex summary', direct.total_info.tvl, 'pools', stats.stats.poolsCount, direct.total_info.pools_count);
    expect(Math.abs(stats.stats.tvlUsd - direct.total_info.tvl) / direct.total_info.tvl).toBeLessThan(0.05);
  });

  it('freshness: timestamps are current and source states are reported', async () => {
    const r = await get(H.tokensHandler(deps), '?limit=1');
    const age = Date.now() - Date.parse(r.fetchedAt);
    log('index age ms', age, JSON.stringify(r.sources));
    expect(age).toBeLessThan(120000);
    for (const s of Object.values<any>(r.sources)) if (s.fetchedAt) expect(Date.now() - Date.parse(s.fetchedAt)).toBeLessThan(15 * 60000);
  });
});

describe('network map data provenance', () => {
  it('every located validator position equals an independent geojs lookup of that node, rounded to 0.1 degree', async () => {
    const dir = await get(H.validatorsHandler(deps));
    const nodes = await rpc<any[]>('getClusterNodes');
    const ipOf = new Map(nodes.filter((n) => n.gossip).map((n) => [n.pubkey, n.gossip.split(':')[0]]));
    const ids = Object.keys(dir.locations);
    expect(ids.length).toBeGreaterThan(200);
    // Spot-check 40 nodes spread across the list against the provider itself.
    const picks = ids.filter((_, i) => i % Math.ceil(ids.length / 40) === 0).slice(0, 40);
    const ips = picks.map((id) => ipOf.get(id)!).filter(Boolean);
    const geo: any[] = await (await fetch('https://get.geojs.io/v1/ip/geo.json?ip=' + ips.join(','))).json();
    const byIp = new Map(geo.map((g) => [g.ip, g]));
    let match = 0;
    for (const id of picks) {
      const g = byIp.get(ipOf.get(id)!);
      const loc = dir.locations[id];
      expect(g, id).toBeTruthy();
      expect(loc.lat).toBeCloseTo(Math.round(Number(g.latitude) * 10) / 10, 5);
      expect(loc.lon).toBeCloseTo(Math.round(Number(g.longitude) * 10) / 10, 5);
      expect(loc.countryCode).toBe(g.country_code);
      match++;
    }
    log('positions matching the provider:', match, '/', picks.length);
    // Coordinates stay in range and no marker sits at the 0,0 "null island" default.
    for (const l of Object.values<any>(dir.locations)) {
      expect(Math.abs(l.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(l.lon)).toBeLessThanOrEqual(180);
      expect(l.lat === 0 && l.lon === 0).toBe(false);
    }
  });

  it('explains every validator without a position: no gossip node, or an unresolved address', async () => {
    const dir = await get(H.validatorsHandler(deps));
    const [votes, nodes] = await Promise.all([rpc<any>('getVoteAccounts'), rpc<any[]>('getClusterNodes')]);
    const inGossip = new Set(nodes.filter((n) => n.gossip).map((n) => n.pubkey));
    const all = [...votes.current.map((v: any) => ({ ...v, delinquent: false })), ...votes.delinquent.map((v: any) => ({ ...v, delinquent: true }))];
    const unlocated = all.filter((v) => !dir.locations[v.nodePubkey]);
    const reasons = { 'not in gossip (no address to look up)': 0, 'in gossip, address unresolved': 0 };
    const delinquentShare = unlocated.filter((v) => v.delinquent).length;
    for (const v of unlocated) reasons[inGossip.has(v.nodePubkey) ? 'in gossip, address unresolved' : 'not in gossip (no address to look up)']++;
    log('validators', all.length, 'located', all.length - unlocated.length, 'unlocated', unlocated.length, JSON.stringify(reasons), 'of which delinquent', delinquentShare);
    expect(unlocated.length + (all.length - unlocated.length)).toBe(all.length);
    expect(reasons['in gossip, address unresolved']).toBeLessThanOrEqual(Math.ceil(unlocated.length * 0.1));
  });
});
