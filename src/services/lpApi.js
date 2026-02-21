// LP API Service - XDEX Integration
// Complete with pool detail fetching

import API_CONFIG from '@/config/api.config';

const API_BASE_URL = API_CONFIG.baseURL;
const XDEX_API = API_CONFIG.xdex.apiUrl;
const NETWORK = API_CONFIG.xdex.network;

/**
 * Get LP statistics from XDEX
 */
export const getLPStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/functions/getLPStats`, {
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch LP stats:', error);
    throw error;
  }
};

/**
 * Get LP tokens (pools) from XDEX
 */
export const getLPTokens = async (limit = 100) => {
  try {
    const response = await fetch(`${API_BASE_URL}/functions/getLPTokens?limit=${limit}`, {
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch LP tokens:', error);
    throw error;
  }
};

/**
 * Get specific LP pool details by address
 */
export const getLPToken = async (poolAddress) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/functions/getLPPoolDetail?pool=${poolAddress}`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error?.message || 'Failed to fetch pool');
    }
    
    return data;
  } catch (error) {
    console.error('Failed to fetch LP pool:', error);
    
    // Fallback: Try to get from pool list
    try {
      const listResponse = await fetch(
        `${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`,
        { signal: AbortSignal.timeout(10000) }
      );
      
      if (listResponse.ok) {
        const listData = await listResponse.json();
        if (listData.success && listData.data) {
          const pool = listData.data.find(p => p.pool_address === poolAddress);
          
          if (pool) {
            return {
              success: true,
              pool: {
                pool_address: pool.pool_address,
                pair_name: `${pool.token_a_symbol || 'UNKNOWN'}/${pool.token_b_symbol || 'UNKNOWN'}`,
                token_a: {
                  mint: pool.token_a_mint,
                  symbol: pool.token_a_symbol || 'UNKNOWN',
                  name: pool.token_a_name || 'Unknown Token',
                  image: pool.token_a_image,
                  decimals: pool.token_a_decimals || 9
                },
                token_b: {
                  mint: pool.token_b_mint,
                  symbol: pool.token_b_symbol || 'UNKNOWN',
                  name: pool.token_b_name || 'Unknown Token',
                  image: pool.token_b_image,
                  decimals: pool.token_b_decimals || 9
                },
                liquidity: pool.liquidity || 0,
                volume_24h: pool.volume_24h || 0
              }
            };
          }
        }
      }
    } catch (fallbackError) {
      console.warn('Fallback also failed:', fallbackError);
    }
    
    throw error;
  }
};

/**
 * Get top LP holders - Not available from XDEX, return empty
 */
export const getTopLPHolders = async (limit = 50) => {
  console.warn('Top LP holders not available from XDEX API');
  return {
    success: true,
    holders: []
  };
};

/**
 * Get holder positions - Not available from XDEX
 */
export const getHolderPositions = async (address) => {
  console.warn('Holder positions not available from XDEX API');
  return {
    success: true,
    positions: []
  };
};

/**
 * Get LP events - Not available from XDEX
 */
export const getLPEvents = async (params = {}) => {
  console.warn('LP events not available from XDEX API');
  return {
    success: true,
    events: []
  };
};

/**
 * Get LP token events
 */
export const getLPTokenEvents = async (mint, limit = 50) => {
  console.warn('LP token events not available from XDEX API');
  return {
    success: true,
    events: []
  };
};

/**
 * Get LP event stats
 */
export const getLPEventStats = async () => {
  console.warn('LP event stats not available from XDEX API');
  return {
    success: true,
    stats: {
      total_events: 0,
      total_volume: 0,
      unique_users: 0
    }
  };
};

/**
 * Format LP amount with decimals
 */
export const formatLPAmount = (amount, decimals = 9) => {
  const value = Number(amount) / Math.pow(10, decimals);
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
  return value.toFixed(2);
};

/**
 * Format event timestamp
 */
export const formatEventTime = (timestamp) => {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
};
