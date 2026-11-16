// Live, read-only checks against public endpoints. Run with: LIVE=1 npx vitest run
// These make a handful of unauthenticated requests; they are not load tests.
import { describe, expect, it } from 'vitest';
import { Cache } from '../../base44/shared/cache.ts';
import { MemoryStore } from '../../base44/shared/store.ts';
import { createRpc } from '../../base44/shared/rpc.ts';
import { createXdex } from '../../base44/shared/xdex.ts';
import { createNinja } from '../../base44/shared/ninja.ts';
import * as H from '../../base44/shared/handlers.ts';
import { metaplexMetadataAddress } from '../../base44/shared/solana.ts';

const f = (u: string, i?: RequestInit) => fetch(u, i);
const store = new MemoryStore();
const deps: H.Deps = {
  fetch: f,
  rpc: createRpc(f),
  xdex: createXdex(f),
  ninja: createNinja(f, undefined),
  cache: new Cache(),
  store: async () => store,
  now: Date.now,
  geoEnabled: true,
  aiDailyQuota: 25,
};
const get = async (h: (r: Request) => Promise<Response>, qs = '') => {
  const res = await h(new Request('https://x1space.xyz/functions/x' + qs, { headers: { origin: 'https://x1space.xyz' } }));
  return { status: res.status, body: res.headers.get('content-type')?.includes('json') ? await res.json() : null, res };
};
const WXNT = 'So11111111111111111111111111111111111111112';
const PLTR = '2EPkJGy9C4CwdXFc7zpa4VxeansMRcRVdPnR52nBVZbW';
const log = (...a: unknown[]) => console.log(...a);

describe('live', () => {
  it('token index covers chain and market', async () => {
    const r = await get(H.tokensHandler(deps), '?limit=5');
    expect(r.status).toBe(200);
    log('indexed', r.body.indexed, 'fungible total', r.body.total, JSON.stringify(r.body.sources));
    log(r.body.tokens.map((t: any) => `${t.symbol} $${t.priceUsd} liq=${Math.round(t.liquidityUsd)} mc=${t.marketCapUsd && Math.round(t.marketCapUsd)} ${t.program} ${t.metadataSource}`).join('\n'));
    expect(r.body.indexed).toBeGreaterThan(20000);
    expect(r.body.sources.chain.status).toBe('ok');
    expect(r.body.sources.x1ninja.status).toBe('not_configured');
    const unlisted = await get(H.tokensHandler(deps), '?limit=3&sort=supply&kind=fungible&offset=400');
    log('unlisted sample', unlisted.body.tokens.map((t: any) => `${t.name}/${t.symbol} listed=${t.listed} price=${t.priceUsd}`));
    const all = await get(H.tokensHandler(deps), '?kind=all&limit=1');
    const nft = await get(H.tokensHandler(deps), '?kind=nft&limit=1');
    const lp = await get(H.tokensHandler(deps), '?kind=lp&limit=1');
    const named = await get(H.searchTokensHandler(deps), '?q=x1&limit=5');
    log('all', all.body.total, 'nft', nft.body.total, 'lp', lp.body.total, 'search x1', named.body.total, named.body.results.map((t: any) => t.name));
  });

  it('token detail, analysis, price, pools', async () => {
    const d = await get(H.tokenByMintHandler(deps), '?mint=' + PLTR);
    expect(d.status).toBe(200);
    const t = d.body.token;
    log(JSON.stringify({ ...t, largestHolders: t.largestHolders?.slice(0, 2), sources: undefined }, null, 1).slice(0, 1800));
    const a = await get(H.analyzeTokenHandler(deps), '?mint=' + PLTR);
    log(JSON.stringify(a.body.analysis));
    const p = await get(H.tokenPricesHandler(deps), '?mint=' + WXNT + '&history=true');
    log(JSON.stringify(p.body.data));
    expect(p.body.data.priceUsd).toBeGreaterThan(0);
    const pools = await get(H.liquidityPoolsHandler(deps), '?token=' + PLTR);
    expect(pools.body.count).toBeGreaterThan(0);
    const pd = await get(H.lpPoolDetailHandler(deps), '?pool=' + pools.body.pools[0].address + '&trades=true');
    log(JSON.stringify(pd.body).slice(0, 700));
    const st = await get(H.lpStatsHandler(deps));
    log(JSON.stringify(st.body.stats));
    const lpt = await get(H.lpTokensHandler(deps), '?limit=2');
    expect(lpt.body.count).toBeGreaterThan(100);
  });

  it('metaplex pda matches an on-chain account', async () => {
    const snap = await get(H.tokensHandler(deps), '?program=spl-token&limit=50&sort=liquidity');
    const t = snap.body.tokens.find((x: any) => x.metadataSource === 'metaplex');
    const pda = await metaplexMetadataAddress(t.mint);
    const acct = await deps.rpc<any>('getAccountInfo', [pda, { encoding: 'base64', dataSlice: { offset: 0, length: 1 } }]);
    log('metaplex token', t.symbol, t.mint, 'pda owner', acct?.value?.owner);
    expect(acct.value.owner).toBe('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
    const img = await H.imageHandler(deps)(new Request('https://x1space.xyz/functions/getImage?kind=token&id=' + t.mint));
    log('token image', img.status, img.headers.get('content-type'));
  });

  it('network + validators directory', async () => {
    const s = await get(H.networkStatsHandler(deps));
    log(JSON.stringify(s.body));
    const h = await get(H.networkHistoryHandler(deps), '?hours=999');
    log('history points', h.body.data.length, h.body.coveredHours, JSON.stringify(h.body.data.at(-1)));
    const an = await get(H.detectAnomaliesHandler(deps));
    log(JSON.stringify(an.body));
    const v = await get(H.validatorsHandler(deps));
    const ids = Object.keys(v.body.validators);
    const prec: Record<string, number> = {};
    for (const l of Object.values<any>(v.body.locations)) prec[l.precision] = (prec[l.precision] || 0) + 1;
    log('identities', ids.length, 'with icon', ids.filter((i) => v.body.validators[i].hasIcon).length, JSON.stringify(v.body.nodes), prec, JSON.stringify(v.body.providers.slice(0, 5)), JSON.stringify(v.body.sources));
    // No raw socket addresses may appear in the public payload.
    expect(JSON.stringify(v.body)).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+/);
    const withIcon = ids.filter((i) => v.body.validators[i].hasIcon).slice(0, 6);
    for (const id of withIcon) {
      const img = await H.imageHandler(deps)(new Request('https://x1space.xyz/functions/getImage?kind=validator&id=' + id));
      log('validator image', v.body.validators[id].name, img.status, img.headers.get('content-type'));
    }
  });
});
