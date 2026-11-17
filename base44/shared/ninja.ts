// X1 Ninja API client (Free-tier endpoints only). The key stays server-side:
// it is read from the environment, sent only in the Authorization header to
// api.x1.ninja, and never logged or returned.
//
// Response shapes follow the published reference at x1.ninja/developers. The sample
// there is "trimmed to key fields", so token address fields are read defensively and
// must be confirmed against a live keyed response before relying on per-token joins.
import { fetchJson, type FetchLike, UpstreamError } from './upstream.ts';
import { type Decision, NINJA_DEFAULTS, NinjaGovernor } from './ninjaQuota.ts';
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

export interface NinjaOptions {
  /** Quota governor. Defaults to a per-instance one with the default safety limits, so no client is ever unmetered. */
  governor?: NinjaGovernor;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** Transport failures and 5xx other than 503 are retried once. 429 and 503 start a cooldown instead (see NinjaGovernor). */
function retryable(err: unknown): boolean {
  if (!(err instanceof UpstreamError)) return false;
  if (err.kind.startsWith('quota_') || err.kind === 'redirect_refused') return false;
  if (err.status === 429 || err.status === 503) return false;
  return err.status >= 500;
}

/**
 * `apiKey` may be a string or a function returning the key. A function is read on every use, so a key
 * added to the platform secrets takes effect without restarting the instance (secrets resolve per request).
 *
 * Every upstream request, each page and each retry included, reserves quota from the governor first. Concurrent
 * identical requests share one upstream call. Redirects are refused, so the bearer token can only reach BASE.
 */
export function createNinja(fetchImpl: FetchLike, apiKey: string | undefined | (() => string | undefined), options: NinjaOptions = {}) {
  const key = () => (typeof apiKey === 'function' ? apiKey() : apiKey);
  const governor = options.governor ?? new NinjaGovernor({ limits: () => NINJA_DEFAULTS, backends: async () => [] });
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const inflight = new Map<string, Promise<any>>();
  const baseOrigin = new URL(BASE).origin;

  async function attempt(path: string): Promise<any> {
    for (let n = 0; n < 2; n++) {
      const decision = await governor.reserve();
      if (!decision.ok) {
        const denied = decision as Extract<Decision, { ok: false }>;
        throw new UpstreamError('x1ninja', 429, `quota_${denied.reason}`, denied.retryAfterMs);
      }
      try {
        return await fetchJson<any>(fetchImpl, `${BASE}${path}`, {
          source: 'x1ninja',
          timeoutMs: options.timeoutMs ?? 10_000,
          retries: 0, // retries are made here so each one is counted against the quota
          refuseRedirects: true,
          headers: { Authorization: `Bearer ${key()}` },
          onResponse: (status, headers) => governor.observe(status, headers),
        });
      } catch (err) {
        if (n === 0 && retryable(err)) {
          await sleep(300 + Math.floor(Math.random() * 150));
          continue;
        }
        throw err;
      }
    }
    throw new UpstreamError('x1ninja', 502, 'failed');
  }

  // Only these fixed paths are ever requested; callers cannot supply a URL or path.
  const get = (path: string): Promise<any> => {
    if (!path.startsWith('/v1/') || new URL(`${BASE}${path}`).origin !== baseOrigin) throw new Error('x1ninja: refused path');
    let p = inflight.get(path);
    if (!p) {
      p = attempt(path).finally(() => inflight.delete(path));
      inflight.set(path, p);
    }
    return p;
  };

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
