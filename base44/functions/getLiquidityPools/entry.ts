// X1 Token Explorer - Get Liquidity Pools from XDEX API

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

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response(JSON.stringify({
      success: false,
      error: 'token parameter required'
    }), { 
      status: 400, 
      headers: corsHeaders() 
    });
  }

  try {
    console.log('🏊 Fetching pools for token:', token);

    const response = await fetch(
      `${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!response.ok) {
      throw new Error(`XDEX API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error('Failed to fetch pools from XDEX');
    }

    // Filter pools containing this token
    const relevantPools = data.data.filter(pool => 
      pool.token_a_mint === token || pool.token_b_mint === token
    );

    console.log(`✓ Found ${relevantPools.length} pools for this token`);

    // Format pool data
    const formattedPools = relevantPools.map(pool => {
      const isTokenA = pool.token_a_mint === token;
      const pairedToken = isTokenA ? {
        mint: pool.token_b_mint,
        symbol: pool.token_b_symbol,
        name: pool.token_b_name,
        image: pool.token_b_image
      } : {
        mint: pool.token_a_mint,
        symbol: pool.token_a_symbol,
        name: pool.token_a_name,
        image: pool.token_a_image
      };

      return {
        pool_address: pool.pool_address,
        pair_name: `${pool.token_a_symbol}/${pool.token_b_symbol}`,
        token_a: {
          mint: pool.token_a_mint,
          symbol: pool.token_a_symbol,
          name: pool.token_a_name,
          image: pool.token_a_image,
          decimals: pool.token_a_decimals
        },
        token_b: {
          mint: pool.token_b_mint,
          symbol: pool.token_b_symbol,
          name: pool.token_b_name,
          image: pool.token_b_image,
          decimals: pool.token_b_decimals
        },
        paired_token: pairedToken,
        liquidity: pool.liquidity || 0,
        liquidity_usd: pool.liquidity_usd || 0,
        volume_24h: pool.volume_24h || 0,
        volume_7d: pool.volume_7d || 0,
        fee_rate: pool.fee_rate || 0.003,
        apr: pool.apr || 0,
        dex_name: 'XDEX',
        url: `https://app.xdex.xyz/swap?pool=${pool.pool_address}`,
        created_at: pool.created_at || null
      };
    });

    // Sort by liquidity (highest first)
    formattedPools.sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));

    // Calculate total stats
    const totalLiquidity = formattedPools.reduce((sum, p) => sum + (p.liquidity || 0), 0);
    const totalVolume24h = formattedPools.reduce((sum, p) => sum + (p.volume_24h || 0), 0);

    console.log(`✅ Returning ${formattedPools.length} pools`);
    console.log(`   Total Liquidity: $${totalLiquidity.toLocaleString()}`);
    console.log(`   24h Volume: $${totalVolume24h.toLocaleString()}`);

    return new Response(JSON.stringify({
      success: true,
      pools: formattedPools,
      total: formattedPools.length,
      stats: {
        total_liquidity: totalLiquidity,
        total_volume_24h: totalVolume24h,
        avg_liquidity: formattedPools.length > 0 ? totalLiquidity / formattedPools.length : 0
      },
      source: 'XDEX',
      timestamp: new Date().toISOString()
    }), { 
      headers: corsHeaders() 
    });

  } catch (error) {
    console.error('❌ Pools fetch error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: error.message,
        timestamp: new Date().toISOString()
      },
      pools: []
    }), { 
      status: 500, 
      headers: corsHeaders() 
    });
  }
});
