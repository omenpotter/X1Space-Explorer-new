// XDEX public API client. Field names follow the live responses observed on 2026-11-14.
import { fetchJson, type FetchLike } from './upstream.ts';
import { finiteOrNull, isAddress, safeHttpsUrl } from './validate.ts';
import { cleanString } from './solana.ts';

const XDEX = 'https://api.xdex.xyz';
const NETWORK = 'X1%20Mainnet';

export interface PoolSide {
  mint: string;
  symbol: string | null;
  logo: string | null;
  priceUsd: number | null;
  volumeUsd24h: number | null;
}

export interface XdexPool {
  address: string;
  lpMint: string | null;
  tvlUsd: number | null;
  txns24h: number | null;
  apr24h: number | null;
  lpHolders: number | null;
  createdAt: string | null;
  token1: PoolSide;
  token2: PoolSide;
}

export interface XdexTotals {
  volume24hUsd: number | null;
  tvlUsd: number | null;
  poolsCount: number | null;
  totalHolders: number | null;
  totalTx: number | null;
}

function side(p: any, n: 1 | 2): PoolSide | null {
  const mint = p?.[`token${n}_address`];
  if (!isAddress(mint)) return null;
  const sym = typeof p[`token${n}_symbol`] === 'string' ? cleanString(p[`token${n}_symbol`], 16) : '';
  return {
    mint,
    symbol: sym || null,
    logo: safeHttpsUrl(p[`token${n}_logo`]),
    priceUsd: finiteOrNull(p[`token${n}_price`]),
    volumeUsd24h: finiteOrNull(p[`token${n}_volume_usd_24h`]),
  };
}

export function normalizePool(p: any): XdexPool | null {
  if (!isAddress(p?.pool_address)) return null;
  const token1 = side(p, 1);
  const token2 = side(p, 2);
  if (!token1 || !token2) return null;
  return {
    address: p.pool_address,
    lpMint: isAddress(p.lp_mint) ? p.lp_mint : null,
    tvlUsd: finiteOrNull(p.tvl),
    txns24h: finiteOrNull(p.txns_24h),
    apr24h: finiteOrNull(p.apr_24h),
    lpHolders: finiteOrNull(p.lp_token_holder_count),
    createdAt: typeof p.createdAt === 'string' && !Number.isNaN(Date.parse(p.createdAt)) ? p.createdAt : null,
    token1,
    token2,
  };
}

export function createXdex(fetchImpl: FetchLike) {
  return {
    /** All pools. The API pages at 100 by default, so page explicitly until `total` is reached. */
    async listPools(): Promise<{ pools: XdexPool[]; totals: XdexTotals }> {
      const pools: XdexPool[] = [];
      let totals: XdexTotals = { volume24hUsd: null, tvlUsd: null, poolsCount: null, totalHolders: null, totalTx: null };
      const pageSize = 500;
      for (let page = 0; page < 10; page++) {
        const d = await fetchJson<any>(fetchImpl, `${XDEX}/api/xendex/pool/list?network=${NETWORK}&limit=${pageSize}&skip=${page * pageSize}`, {
          source: 'xdex',
          timeoutMs: 15_000,
        });
        if (!d?.success || !Array.isArray(d.data)) throw new Error('xdex: unexpected pool list shape');
        if (page === 0 && d.total_info) {
          totals = {
            volume24hUsd: finiteOrNull(d.total_info.volume_24h_usd),
            tvlUsd: finiteOrNull(d.total_info.tvl),
            poolsCount: finiteOrNull(d.total_info.pools_count),
            totalHolders: finiteOrNull(d.total_info.total_holders),
            totalTx: finiteOrNull(d.total_info.total_tx),
          };
        }
        for (const raw of d.data) {
          const p = normalizePool(raw);
          if (p) pools.push(p);
        }
        const total = finiteOrNull(d.total) ?? 0;
        if (d.data.length === 0 || (page + 1) * pageSize >= total) break;
      }
      return { pools, totals };
    },

    /** Single pool with the `alpha` analytics block (price changes, market cap). Null when unknown. */
    async getPool(address: string): Promise<any | null> {
      try {
        const d = await fetchJson<any>(fetchImpl, `${XDEX}/api/xendex/pool/${encodeURIComponent(address)}?network=${NETWORK}`, {
          source: 'xdex',
          timeoutMs: 10_000,
        });
        return d?.success && d.data ? d.data : null;
      } catch (err: any) {
        if (err?.status === 404) return null;
        throw err;
      }
    },

    /** Oracle price for one mint. Returns null when XDEX has no price. */
    async getPrice(mint: string): Promise<{ priceUsd: number; updatedAt: string | null; source: string | null } | null> {
      try {
        const d = await fetchJson<any>(fetchImpl, `${XDEX}/api/token-price/price?network=${NETWORK}&token_address=${encodeURIComponent(mint)}`, {
          source: 'xdex',
          timeoutMs: 8_000,
        });
        const price = finiteOrNull(d?.data?.price);
        if (!d?.success || price === null) return null;
        return {
          priceUsd: price,
          updatedAt: typeof d.data.updatedAt === 'string' ? d.data.updatedAt : null,
          source: typeof d.data.source === 'string' ? cleanString(d.data.source, 40) : null,
        };
      } catch (err: any) {
        if (err?.status === 404 || err?.status === 400) return null;
        throw err;
      }
    },
  };
}

export type Xdex = ReturnType<typeof createXdex>;
