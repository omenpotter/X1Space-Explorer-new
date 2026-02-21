// Get LP (Liquidity Pool) Statistics from XDEX

const XDEX_API = 'https://api.xdex.xyz';
const NETWORK = 'X1%20Mainnet';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    console.log('📊 Fetching LP stats from XDEX...');

    // Fetch all pools
    const poolsRes = await fetch(
      `${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!poolsRes.ok) {
      throw new Error(`XDEX API error: ${poolsRes.status}`);
    }

    const poolsData = await poolsRes.json();

    if (!poolsData.success || !poolsData.data) {
      throw new Error('Invalid XDEX response');
    }

    const pools = poolsData.data;
    console.log(`✓ Fetched ${pools.length} pools`);

    // Calculate statistics
    const totalPools = pools.length;
    const totalLiquidity = pools.reduce((sum, p) => sum + (p.liquidity || 0), 0);
    const totalVolume24h = pools.reduce((sum, p) => sum + (p.volume_24h || 0), 0);
    
    // Count unique tokens
    const uniqueTokens = new Set();
    pools.forEach(p => {
      if (p.token_a_mint) uniqueTokens.add(p.token_a_mint);
      if (p.token_b_mint) uniqueTokens.add(p.token_b_mint);
    });

    // Top pools by liquidity
    const topPools = pools
      .sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0))
      .slice(0, 10)
      .map(pool => ({
        pool_address: pool.pool_address,
        pair_name: `${pool.token_a_symbol}/${pool.token_b_symbol}`,
        liquidity: pool.liquidity || 0,
        volume_24h: pool.volume_24h || 0,
        token_a_symbol: pool.token_a_symbol,
        token_b_symbol: pool.token_b_symbol
      }));

    const stats = {
      total_pools: totalPools,
      total_liquidity_usd: totalLiquidity,
      total_volume_24h: totalVolume24h,
      unique_tokens: uniqueTokens.size,
      avg_liquidity: totalPools > 0 ? totalLiquidity / totalPools : 0,
      top_pools: topPools,
      last_updated: new Date().toISOString()
    };

    console.log('✅ LP Stats:', {
      pools: stats.total_pools,
      liquidity: `$${stats.total_liquidity_usd.toLocaleString()}`,
      volume: `$${stats.total_volume_24h.toLocaleString()}`
    });

    return new Response(JSON.stringify({
      success: true,
      stats,
      source: 'XDEX'
    }), { headers: corsHeaders() });

  } catch (error) {
    console.error('❌ LP stats error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    }), { 
      status: 500, 
      headers: corsHeaders() 
    });
  }
});
