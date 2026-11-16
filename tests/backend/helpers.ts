// Test doubles for the backend handlers. No network access is used anywhere in tests/backend.
import { Cache } from '../../base44/shared/cache.ts';
import { MemoryStore } from '../../base44/shared/store.ts';
import { createNinja } from '../../base44/shared/ninja.ts';
import { createXdex } from '../../base44/shared/xdex.ts';
import type { Deps } from '../../base44/shared/handlers.ts';
import { base58Decode, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, METAPLEX_PROGRAM } from '../../base44/shared/solana.ts';

export const MINT_A = 'So11111111111111111111111111111111111111112'; // native, listed
export const MINT_B = '2EPkJGy9C4CwdXFc7zpa4VxeansMRcRVdPnR52nBVZbW'; // token-2022 with metadata, listed
export const MINT_C = 'pXNTyoqQsskHdZ7Q1rnP25FEyHHjissbs7n6RRN2nP5'; // spl with metaplex name, not listed
export const MINT_NFT = 'FZLRLpkBiFKnLcqssjzAA5ycrfqUWvgxcbNYNe6Hu25P';
export const POOL = '13EhJs5rPcbhrjUBQP6wcxJMqvUrpVLszmu2S32w1VmG';
export const LP_MINT = '71Tac3Fq6CY3fFPz6q4Xcw7VZvLcUG7t4K6QuEPiRy5k';
export const IDENTITY = '2skZy1HiefFby6a8raendfWGKGRmpcDiwvuPj1v7atch';
export const IDENTITY_2 = 'Gv5kyHCneaRKNJPgyPreoiYnBVBm2XYqt981zYykcSSU';
export const NINJA_KEY = 'x1_test_key_do_not_leak';

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

function mintSlice(supply: bigint, decimals: number): string {
  const b = new Uint8Array(10);
  let s = supply;
  for (let i = 0; i < 8; i++) {
    b[i] = Number(s & 0xffn);
    s >>= 8n;
  }
  b[8] = decimals;
  b[9] = 1;
  return b64(b);
}

function metaplexSlice(mint: string, name: string, symbol: string): string {
  const enc = new TextEncoder();
  const out = new Uint8Array(86);
  out.set(base58Decode(mint), 0);
  const view = new DataView(out.buffer);
  view.setUint32(32, 32, true);
  out.set(enc.encode(name), 36); // padded with NULs, as on chain
  view.setUint32(68, 10, true);
  out.set(enc.encode(symbol), 72);
  return b64(out);
}

export const xdexPoolRaw = {
  pool_address: POOL,
  lp_mint: LP_MINT,
  apr_24h: 2.78,
  lp_token_holder_count: 2,
  token1_address: MINT_A,
  token1_symbol: 'WXNT',
  token1_logo: 'https://app.xdex.xyz/assets/images/tokens/x1.webp',
  token1_price: 0.2,
  token1_volume_usd_24h: 10,
  token2_address: MINT_B,
  token2_symbol: 'PLTR.X',
  token2_logo: 'https://raw.githubusercontent.com/x1-labs/assets/main/tokens/pltr-x/logo.png',
  token2_price: 160,
  token2_volume_usd_24h: 8,
  tvl: 350,
  txns_24h: 1,
  createdAt: '2026-09-17T16:21:36.754Z',
};

export interface World {
  rpcCalls: { method: string; params: any[] }[];
  fetchCalls: { url: string; init?: RequestInit }[];
  failRpc: Set<string>;
  failHosts: Set<string>;
  ninjaPools: any[];
  geo: Record<string, any>;
  images: Record<string, () => Response>;
}

export function makeWorld(): World {
  return { rpcCalls: [], fetchCalls: [], failRpc: new Set(), failHosts: new Set(), ninjaPools: [], geo: {}, images: {} };
}

const jsonRes = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export function makeFetch(w: World) {
  return async (url: string, init?: RequestInit): Promise<Response> => {
    w.fetchCalls.push({ url, init });
    const u = new URL(url);
    if (w.failHosts.has(u.hostname)) return jsonRes({ error: 'secret upstream detail' }, 500);
    if (u.hostname === 'api.xdex.xyz') {
      if (u.pathname === '/api/xendex/pool/list') {
        return jsonRes({ success: true, total: 1, data: [xdexPoolRaw], total_info: { volume_24h_usd: 18, tvl: 350, pools_count: 1, total_holders: 2, total_tx: 5 } });
      }
      if (u.pathname.startsWith('/api/xendex/pool/')) {
        return jsonRes({ success: true, data: { ...xdexPoolRaw, alpha: { mint: MINT_B, price_change_5m: 0, price_change_1h: 0, price_change_6h: 0, price_change_24h: 11.1, mcap: 183, fdv: 183 } } });
      }
      if (u.pathname === '/api/token-price/price') {
        if (u.searchParams.get('token_address') === MINT_A) return jsonRes({ success: true, data: { price: 0.21, updatedAt: '2026-11-14T17:42:58.510Z', source: 'oracle.x1.xyz' } });
        return jsonRes({ success: false, message: 'not found' });
      }
    }
    if (u.hostname === 'api.x1.ninja') {
      const auth = new Headers(init?.headers).get('authorization');
      if (auth !== `Bearer ${NINJA_KEY}`) return jsonRes({ error: 'API key required' }, 401);
      if (u.pathname === '/v1/pools') return jsonRes({ pools: w.ninjaPools, total: w.ninjaPools.length, xntPriceUsd: 0.2, lastUpdated: 1793788369954 });
      if (u.pathname.startsWith('/v1/ohlcv/')) return jsonRes({ ohlcv: [{ t: 1, o: 1, h: 2, l: 1, c: 2, v: 5 }], timeframe: u.searchParams.get('tf') });
      if (u.pathname.startsWith('/v1/trades/')) return jsonRes({ trades: [{ type: 'buy', usd: 5 }], total: 1 });
      return jsonRes({ error: 'not found' }, 404);
    }
    if (u.hostname === 'get.geojs.io') {
      const ips = (u.searchParams.get('ip') || '').split(',');
      return jsonRes(ips.map((ip) => ({ ip, ...(w.geo[ip] ?? { latitude: 'nil', longitude: 'nil' }) })));
    }
    if (w.images[url]) return w.images[url]();
    return new Response('not found', { status: 404 });
  };
}

export function makeRpc(w: World) {
  return async (method: string, params: any[] = []): Promise<any> => {
    w.rpcCalls.push({ method, params });
    if (w.failRpc.has(method)) throw new Error('rpc down');
    switch (method) {
      case 'getProgramAccounts': {
        const [program, cfg] = params;
        if (program === TOKEN_PROGRAM) {
          return [
            { pubkey: MINT_A, account: { data: [mintSlice(0n, 9), 'base64'] } },
            { pubkey: MINT_C, account: { data: [mintSlice(5_000_000_000n, 6), 'base64'] } },
            { pubkey: MINT_NFT, account: { data: [mintSlice(1n, 0), 'base64'] } },
            { pubkey: LP_MINT, account: { data: [mintSlice(1000n, 9), 'base64'] } },
          ];
        }
        if (program === TOKEN_2022_PROGRAM) {
          if (cfg.encoding === 'base64') return [];
          return [{
            pubkey: MINT_B,
            account: { data: { parsed: { type: 'mint', info: { decimals: 8, supply: '111293134', mintAuthority: IDENTITY, freezeAuthority: null, extensions: [{ extension: 'tokenMetadata', state: { name: 'Palantir xStock', symbol: 'PLTR.X', uri: 'https://example.com/meta.json' } }] } } } },
          }];
        }
        if (program === METAPLEX_PROGRAM) return [{ pubkey: 'x', account: { data: [metaplexSlice(MINT_C, 'Pooled XNT', 'pXNT'), 'base64'] } }];
        // Config program: validator info
        return [
          { account: { data: { parsed: { type: 'validatorInfo', info: { keys: [{ pubkey: 'Va1idator1nfo111111111111111111111111111111', signer: false }, { pubkey: IDENTITY, signer: true }], configData: { name: 'Node <b>One</b>', website: 'javascript:alert(1)', iconUrl: 'https://img.example.com/logo.png', details: 'd' } } } } } },
          { account: { data: { parsed: { type: 'validatorInfo', info: { keys: [{ pubkey: 'Va1idator1nfo111111111111111111111111111111', signer: false }, { pubkey: IDENTITY_2, signer: true }], configData: { name: 'Node Two', website: 'https://two.example.com', iconUrl: 'http://10.0.0.5/logo.png' } } } } } },
          { account: { data: { parsed: { type: 'stakeConfig', info: {} } } } },
        ];
      }
      case 'getClusterNodes':
        return [
          { pubkey: IDENTITY, gossip: '203.0.113.10:8001', rpc: '203.0.113.10:8899', version: '4.0.4' },
          { pubkey: IDENTITY_2, gossip: '10.0.0.5:8001', version: '4.0.4' },
        ];
      case 'getVoteAccounts':
        return {
          current: [{ votePubkey: MINT_NFT, nodePubkey: IDENTITY, activatedStake: 9e9, commission: 5 }],
          delinquent: [{ votePubkey: LP_MINT, nodePubkey: IDENTITY_2, activatedStake: 1e9, commission: 10 }],
        };
      case 'getEpochInfo':
        return { absoluteSlot: 100, blockHeight: 90, epoch: 4, slotIndex: 50, slotsInEpoch: 200, transactionCount: 1000 };
      case 'getRecentPerformanceSamples':
        return Array.from({ length: Math.min(params[0], 30) }, (_, i) => ({ slot: 100 - i, numSlots: 150, numTransactions: 6000, numNonVoteTransactions: 600, samplePeriodSecs: 60 }));
      case 'getSupply':
        return { value: { total: 1e18, circulating: 5e17 } };
      case 'getAccountInfo': {
        const [addr, cfg] = params;
        if (cfg.encoding === 'jsonParsed') {
          if (addr === MINT_B) return { value: { data: { parsed: { type: 'mint', info: { decimals: 8, supply: '111293134', mintAuthority: IDENTITY, freezeAuthority: null, extensions: [{ extension: 'tokenMetadata', state: { uri: 'https://example.com/meta.json' } }] } } } } };
          if (addr === MINT_C) return { value: { data: { parsed: { type: 'mint', info: { decimals: 6, supply: '5000000000', mintAuthority: null, freezeAuthority: null } } } } };
          return { value: null };
        }
        return { value: null };
      }
      case 'getTokenLargestAccounts':
        return { value: [{ address: IDENTITY, uiAmount: 1.0, uiAmountString: '1.0' }] };
      default:
        throw new Error('unexpected rpc ' + method);
    }
  };
}

export function makeDeps(w: World, opts: { ninjaKey?: string; now?: () => number; clientFor?: Deps['clientFor'] } = {}): Deps & { store_: MemoryStore } {
  const f = makeFetch(w);
  const now = opts.now ?? Date.now;
  const store = new MemoryStore(5000, now);
  return {
    fetch: f,
    rpc: makeRpc(w) as any,
    xdex: createXdex(f),
    ninja: createNinja(f, opts.ninjaKey),
    cache: new Cache(now),
    store: async () => store,
    store_: store,
    now,
    geoEnabled: true,
    aiDailyQuota: 3,
    clientFor: opts.clientFor,
  };
}

export function req(path: string, init: RequestInit & { ip?: string; origin?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.ip) headers.set('cf-connecting-ip', init.ip);
  headers.set('origin', init.origin ?? 'https://x1space.xyz');
  return new Request('https://x1space.xyz/functions' + path, { ...init, headers });
}

export async function call(h: (r: Request) => Promise<Response>, path: string, init: Parameters<typeof req>[1] = {}) {
  const res = await h(req(path, init));
  const text = await res.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch { /* non-JSON */ }
  return { status: res.status, body, text, headers: res.headers };
}
