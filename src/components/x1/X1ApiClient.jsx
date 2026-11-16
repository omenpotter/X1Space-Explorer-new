// Compatibility layer over the backend token API (src/lib/x1/api.js).
// Values the backend does not know are passed through as null: nothing is defaulted to 0.
import { api } from '@/lib/x1/api';

function toLegacy(t) {
  return {
    mint: t.mint,
    name: t.name,
    symbol: t.symbol,
    logo_uri: t.logoUrl,
    decimals: t.decimals,
    total_supply: t.supply,
    token_type: t.program === 'token-2022' ? 'Token-2022' : t.program === 'spl-token' ? 'SPL Token' : null,
    kind: t.kind,
    listed: t.listed,
    price: t.priceUsd,
    price_change_24h: t.priceChange24h,
    market_cap: t.marketCapUsd,
    liquidity: t.liquidityUsd,
    volume_24h: t.volume24hUsd,
    pool_count: t.poolCount,
    holders: t.holders,
    metadata_source: t.metadataSource,
  };
}

/** Tokens that have a DEX market, highest liquidity first (used for prices and symbols). */
export async function listTokens(params = {}) {
  const { limit = 200, offset = 0 } = params;
  try {
    const data = await api.tokens({ listed: true, kind: 'all', sort: 'liquidity', limit: Math.min(limit, 200), offset });
    return {
      success: true,
      data: { tokens: data.tokens.map(toLegacy), total: data.total, sources: data.sources, fetchedAt: data.fetchedAt },
    };
  } catch (error) {
    return { success: false, error: error.message, data: { tokens: [], total: 0 } };
  }
}

export async function searchTokens(query, params = {}) {
  if (!query || query.trim().length < 2) return { success: false, data: { tokens: [], total: 0 } };
  try {
    const data = await api.searchTokens(query.trim(), params.limit || 20);
    return { success: true, data: { tokens: data.results.map(toLegacy), total: data.total } };
  } catch (error) {
    return { success: false, error: error.message, data: { tokens: [], total: 0 } };
  }
}

export async function getTokenDetails(mint) {
  try {
    const data = await api.token(mint);
    return { success: true, data: { token: { ...toLegacy(data.token), ...data.token } } };
  } catch (error) {
    return { success: false, error: error.message, data: null };
  }
}

export async function getLiquidityPools(mint) {
  try {
    const data = await api.tokenPools(mint);
    return { success: true, data: { pools: data.pools } };
  } catch (error) {
    return { success: false, error: error.message, data: { pools: [] } };
  }
}

// Live token streaming is not offered by the backend; kept as a no-op for existing callers.
export function subscribeToTokenUpdates() {
  return () => {};
}

export default { listTokens, searchTokens, getTokenDetails, getLiquidityPools, subscribeToTokenUpdates };
