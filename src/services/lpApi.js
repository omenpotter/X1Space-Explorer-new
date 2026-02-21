// LP API Service - Direct XDEX Integration (No Database)

const XDEX_API = 'https://api.xdex.xyz';
const NETWORK = 'X1%20Mainnet';

/**
 * Get LP statistics from XDEX
 */
export const getLPStats = async () => {
  try {
    console.log('📊 Fetching LP stats from XDEX...');
    
    const response = await fetch(
      `${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`,
      { 
        signal: AbortSignal.timeout(15000),
        mode: 'cors'
      }
    );

    if (!response.ok) {
      throw new Error(`XDEX API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error('Invalid XDEX response');
    }

    const pools = data.data;
    
    // Calculate stats
    const totalPools = pools.length;
    const totalLiquidity = pools.reduce((sum, p) => sum + (p.liquidity || 0), 0);
    const totalVolume24h = pools.reduce((sum, p) => sum + (p.volume_24h || 0), 0);
    
    const uniqueTokens = new Set();
    pools.forEach(p => {
      if (p.token_a_mint) uniqueTokens.add(p.token_a_mint);
      if (p.token_b_mint) uniqueTokens.add(p.token_b_mint);
    });

    return {
      success: true,
      stats: {
        total_pools: totalPools,
        total_liquidity_usd: totalLiquidity,
        total_volume_24h: totalVolume24h,
        unique_tokens: uniqueTokens.size,
        total_holders: 0,
        total_lp_supply: 0,
        avg_liquidity: totalPools > 0 ? totalLiquidity / totalPools : 0
      }
    };
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
    console.log(`📊 Fetching ${limit} LP tokens from XDEX...`);

    const response = await fetch(
      `${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`,
      { 
        signal: AbortSignal.timeout(15000),
        mode: 'cors'
      }
    );

    if (!response.ok) {
      throw new Error(`XDEX API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error('Invalid XDEX response');
    }

    // Format pools for frontend - include BOTH nested and flat formats
    const tokens = data.data.slice(0, limit).map(pool => ({
      lp_mint: pool.pool_address,
      pool_address: pool.pool_address,
      
      // Pair names (multiple formats for compatibility)
      pair_name: `${pool.token_a_symbol || 'UNKNOWN'}/${pool.token_b_symbol || 'UNKNOWN'}`,
      pair_symbol: `${pool.token_a_symbol || 'UNKNOWN'}/${pool.token_b_symbol || 'UNKNOWN'}`,
      
      // Nested format (XDEX standard)
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
      
      // Flat format (for backward compatibility)
      token_a_symbol: pool.token_a_symbol || 'UNKNOWN',
      token_b_symbol: pool.token_b_symbol || 'UNKNOWN',
      token_a_name: pool.token_a_name || 'Unknown Token',
      token_b_name: pool.token_b_name || 'Unknown Token',
      token_a_image: pool.token_a_image,
      token_b_image: pool.token_b_image,
      
      // Pool data
      liquidity: pool.liquidity || 0,
      liquidity_usd: pool.liquidity_usd || pool.liquidity || 0,
      volume_24h: pool.volume_24h || 0,
      volume_7d: pool.volume_7d || 0,
      fee_rate: pool.fee_rate || 0.003,
      apr: pool.apr || 0,
      
      // Database-style fields (for compatibility)
      holder_count: 0,
      total_supply: 0,
      decimals: 9,
      updated_at: new Date().toISOString(),
      created_at: pool.created_at || new Date().toISOString()
    }));

    console.log(`✅ Returning ${tokens.length} LP tokens`);

    return {
      success: true,
      tokens
    };

  } catch (error) {
    console.error('Failed to fetch LP tokens:', error);
    throw error;
  }
};

/**
 * Get top LP holders - Not available from XDEX
 */
export const getTopLPHolders = async (limit = 50) => {
  return {
    success: true,
    holders: []
  };
};

/**
 * Get LP events - Not available from XDEX
 */
export const getLPEvents = async (params = {}) => {
  return {
    success: true,
    events: []
  };
};

/**
 * Get LP event stats - Not available from XDEX
 */
export const getLPEventStats = async () => {
  return {
    success: true,
    stats: {
      total_events: 0,
      total_volume: 0,
      unique_users: 0,
      add_count: 0,
      remove_count: 0
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
