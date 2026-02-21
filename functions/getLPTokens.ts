// Get LP Tokens (Pools) from XDEX

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
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

  try {
    console.log(`📊 Fetching ${limit} LP tokens from XDEX...`);

    const response = await fetch(
      `${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!response.ok) {
      throw new Error(`XDEX API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error('Invalid XDEX response');
    }

    // Format pools as LP tokens
    const tokens = data.data.slice(0, limit).map(pool => ({
      lp_mint: pool.pool_address,
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
      liquidity: pool.liquidity || 0,
      liquidity_usd: pool.liquidity_usd || pool.liquidity || 0,
      volume_24h: pool.volume_24h || 0,
      volume_7d: pool.volume_7d || 0,
      fee_rate: pool.fee_rate || 0.003,
      apr: pool.apr || 0,
      created_at: pool.created_at || null
    }));

    console.log(`✅ Returning ${tokens.length} LP tokens`);

    return new Response(JSON.stringify({
      success: true,
      tokens,
      total: tokens.length,
      source: 'XDEX'
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
