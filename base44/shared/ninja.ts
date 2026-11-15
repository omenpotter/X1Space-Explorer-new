// X1 Ninja API client (Free-tier endpoints only). The key stays server-side:
// it is read from the environment, sent only in the Authorization header to
// api.x1.ninja, and never logged or returned.
//
// Response shapes follow the published reference at x1.ninja/developers. The sample
// there is "trimmed to key fields", so token address fields are read defensively and
// must be confirmed against a live keyed response before relying on per-token joins.
import { fetchJson, type FetchLike } from './upstream.ts';
import { finiteOrNull, isAddress } from './validate.ts';
import { cleanString } from './solana.ts';

const BASE = 'https://api.x1.ninja';

export interface NinjaToken {
  mint: string | null;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
}

export interface NinjaPool {
  address: string;
  base: NinjaToken;
  quote: NinjaToken;
  priceUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  txns24h: number | null;
  priceChange24h: number | null;
  holders: number | null;
}

function token(t: any): NinjaToken {
  const mint = [t?.address, t?.mint, t?.tokenAddress].find(isAddress) ?? null;
  return {
    mint,
    symbol: typeof t?.symbol === 'string' ? cleanString(t.symbol, 16) || null : null,
    name: typeof t?.name === 'string' ? cleanString(t.name, 64) || null : null,
    decimals: finiteOrNull(t?.decimals),
  };
}

export function normalizeNinjaPool(p: any): NinjaPool | null {
  if (!isAddress(p?.address)) return null;
  return {
    address: p.address,
    base: token(p.baseToken),
    quote: token(p.quoteToken),
    priceUsd: finiteOrNull(p.priceUsd),
    liquidityUsd: finiteOrNull(p.liquidity),
    marketCapUsd: finiteOrNull(p.marketCap),
    volume24hUsd: finiteOrNull(p.volume24h),
    txns24h: finiteOrNull(p.txns24h),
    priceChange24h: finiteOrNull(p.priceChange24h),
    holders: finiteOrNull(p.holders),
  };
}

export const NINJA_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1D'] as const;
export const NINJA_TRADE_TYPES = ['all', 'buys', 'sells', 'lp'] as const;

/**
 * `apiKey` may be a string or a function returning the key. A function is read on every use, so a key
 * added to the platform secrets takes effect without restarting the instance (secrets resolve per request).
 */
export function createNinja(fetchImpl: FetchLike, apiKey: string | undefined | (() => string | undefined)) {
  const key = () => (typeof apiKey === 'function' ? apiKey() : apiKey);
  // Only these fixed paths are ever requested; callers cannot supply a URL or path.
  const get = (path: string) =>
    fetchJson<any>(fetchImpl, `${BASE}${path}`, {
      source: 'x1ninja',
      timeoutMs: 10_000,
      retries: 1,
      headers: { Authorization: `Bearer ${key()}` },
    });

  return {
    get configured(): boolean {
      const k = key();
      return typeof k === 'string' && k.length > 0;
    },

    /** GET /v1/pools, paged. At most `maxPages` requests per refresh to respect the quota. */
    async listPools(maxPages = 3): Promise<{ pools: NinjaPool[]; xntPriceUsd: number | null; lastUpdated: number | null }> {
      if (!this.configured) throw new Error('x1ninja: not configured');
      const pools: NinjaPool[] = [];
      let xntPriceUsd: number | null = null;
      let lastUpdated: number | null = null;
      const limit = 500;
      for (let page = 0; page < maxPages; page++) {
        const d = await get(`/v1/pools?limit=${limit}&offset=${page * limit}`);
        if (!Array.isArray(d?.pools)) throw new Error('x1ninja: unexpected pools shape');
        if (page === 0) {
          xntPriceUsd = finiteOrNull(d.xntPriceUsd);
          lastUpdated = finiteOrNull(d.lastUpdated);
        }
        for (const raw of d.pools) {
          const p = normalizeNinjaPool(raw);
          if (p) pools.push(p);
        }
        const total = finiteOrNull(d.total) ?? 0;
        if (d.pools.length === 0 || (page + 1) * limit >= total) break;
      }
      return { pools, xntPriceUsd, lastUpdated };
    },

    /** GET /v1/pools/{address} */
    async getPool(address: string): Promise<NinjaPool | null> {
      if (!this.configured) throw new Error('x1ninja: not configured');
      try {
        const d = await get(`/v1/pools/${encodeURIComponent(address)}`);
        return normalizeNinjaPool(d?.pool);
      } catch (err: any) {
        if (err?.status === 404) return null;
        throw err;
      }
    },

    /** GET /v1/ohlcv/{address}. Candles are passed through after numeric validation. */
    async getOhlcv(address: string, tf: string, limit: number): Promise<{ candles: any[]; timeframe: string }> {
      if (!this.configured) throw new Error('x1ninja: not configured');
      const d = await get(`/v1/ohlcv/${encodeURIComponent(address)}?tf=${encodeURIComponent(tf)}&limit=${limit}`);
      const candles = Array.isArray(d?.ohlcv) ? d.ohlcv.slice(0, 300) : [];
      return { candles, timeframe: typeof d?.timeframe === 'string' ? d.timeframe : tf };
    },

    /** GET /v1/trades/{address} */
    async getTrades(address: string, type: string, limit: number): Promise<{ trades: any[] }> {
      if (!this.configured) throw new Error('x1ninja: not configured');
      const d = await get(`/v1/trades/${encodeURIComponent(address)}?type=${encodeURIComponent(type)}&limit=${limit}`);
      return { trades: Array.isArray(d?.trades) ? d.trades.slice(0, 200) : [] };
    },
  };
}

export type Ninja = ReturnType<typeof createNinja>;
