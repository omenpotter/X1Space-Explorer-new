// Get LP Tokens (Pools) from XDEX with Complete Metadata

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

async function fetchPoolDetails(poolAddress) {
  try {
    const response = await fetch(
      `${XDEX_API}/api/xendex/pool/${poolAddress}?network=${NETWORK}`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (response.ok) {
      const data = await response.json();
      return data.success ? data.data : null;
    }
    return null;
  } catch (error) {
    console.warn(`Failed to fetch pool ${poolAddress}:`, error.message);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

  try {
    console.log(`📊 Fetching ${limit} LP tokens from XDEX...`);

    // First, get the pool list
    const listRes = await fetch(
      `${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!listRes.ok) {
      throw new Error(`XDEX API error: ${listRes.status}`);
    }

    const listData = await listRes.json();

    if (!listData.success || !listData.data) {
      throw new Error('Invalid XDEX response');
    }

    console.log(`✓ Found ${listData.data.length} pools in list`);

    // Take top pools by liquidity and fetch details for each
    const topPools = listData.data
      .sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0))
      .slice(0, limit);

    // Fetch detailed info for each pool (in batches to avoid timeout)
    const batchSize = 10;
    const tokens = [];

    for (let i = 0; i < topPools.length; i += batchSize) {
      const batch = topPools.slice(i, i + batchSize);
      const detailsPromises = batch.map(pool => fetchPoolDetails(pool.pool_address));
      const details = await Promise.all(detailsPromises);

      // Combine list data with detailed data
      batch.forEach((pool, index) => {
        const detail = details[index];
        
        // Use detailed data if available, otherwise fall back to list data
        const tokenA = detail?.token_a || {
          mint: pool.token_a_mint,
          symbol: pool.token_a_symbol || 'UNKNOWN',
          name: pool.token_a_name || 'Unknown Token',
          image: pool.token_a_image || null,
          decimals: pool.token_a_decimals || 9
        };

        const tokenB = detail?.token_b || {
          mint: pool.token_b_mint,
          symbol: pool.token_b_symbol || 'UNKNOWN',
          name: pool.token_b_name || 'Unknown Token',
          image: pool.token_b_image || null,
          decimals: pool.token_b_decimals || 9
        };

        tokens.push({
          lp_mint: pool.pool_address,
          pool_address: pool.pool_address,
          pair_name: `${tokenA.symbol}/${tokenB.symbol}`,
          token_a: {
            mint: tokenA.mint,
            symbol: tokenA.symbol,
            name: tokenA.name,
            image: tokenA.image,
            decimals: tokenA.decimals
          },
          token_b: {
            mint: tokenB.mint,
            symbol: tokenB.symbol,
            name: tokenB.name,
            image: tokenB.image,
            decimals: tokenB.decimals
          },
          liquidity: detail?.liquidity || pool.liquidity || 0,
          liquidity_usd: detail?.liquidity_usd || pool.liquidity_usd || pool.liquidity || 0,
          volume_24h: detail?.volume_24h || pool.volume_24h || 0,
          volume_7d: detail?.volume_7d || pool.volume_7d || 0,
          fee_rate: detail?.fee_rate || pool.fee_rate || 0.003,
          apr: detail?.apr || pool.apr || 0,
          created_at: detail?.created_at || pool.created_at || null,
          // Additional fields from detailed response
          total_supply: detail?.total_supply || null,
          reserve_a: detail?.reserve_a || null,
          reserve_b: detail?.reserve_b || null
        });
      });

      console.log(`✓ Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(topPools.length / batchSize)}`);
    }

    console.log(`✅ Returning ${tokens.length} LP tokens with complete metadata`);

    return new Response(JSON.stringify({
      success: true,
      tokens,
      total: tokens.length,
      source: 'XDEX',
      timestamp: new Date().toISOString()
    }), { headers: corsHeaders() });

  } catch (error) {
    console.error('❌ LP tokens fetch error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: error.message,
        timestamp: new Date().toISOString()
      },
      tokens: []
    }), { 
      status: 500, 
      headers: corsHeaders() 
    });
  }
});
