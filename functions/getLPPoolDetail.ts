// Get Specific LP Pool Details from XDEX

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
  const poolAddress = url.searchParams.get('pool');

  if (!poolAddress) {
    return new Response(JSON.stringify({
      success: false,
      error: 'pool parameter required'
    }), { 
      status: 400, 
      headers: corsHeaders() 
    });
  }

  try {
    console.log('🏊 Fetching pool details for:', poolAddress);

    // Fetch specific pool details from XDEX
    const response = await fetch(
      `${XDEX_API}/api/xendex/pool/${poolAddress}?network=${NETWORK}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) {
      // Try alternative: search in pool list
      console.log('Pool detail endpoint failed, searching pool list...');
      
      const listRes = await fetch(
        `${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (listRes.ok) {
        const listData = await listRes.json();
        if (listData.success && listData.data) {
          const pool = listData.data.find(p => p.pool_address === poolAddress);
          
          if (pool) {
            return new Response(JSON.stringify({
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
                liquidity_usd: pool.liquidity_usd || pool.liquidity || 0,
                volume_24h: pool.volume_24h || 0,
                volume_7d: pool.volume_7d || 0,
                fee_rate: pool.fee_rate || 0.003,
                apr: pool.apr || 0,
                dex_name: 'XDEX',
                url: `https://app.xdex.xyz/liquidity?pool=${poolAddress}`,
                source: 'pool_list'
              }
            }), { headers: corsHeaders() });
          }
        }
      }

      throw new Error(`Pool not found: ${poolAddress}`);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error('Invalid pool data from XDEX');
    }

    const pool = data.data;

    // Format pool data with complete metadata
    const formattedPool = {
      pool_address: poolAddress,
      pair_name: `${pool.token_a?.symbol || 'UNKNOWN'}/${pool.token_b?.symbol || 'UNKNOWN'}`,
      token_a: {
        mint: pool.token_a?.mint || pool.token_a_mint,
        symbol: pool.token_a?.symbol || 'UNKNOWN',
        name: pool.token_a?.name || 'Unknown Token',
        image: pool.token_a?.image || pool.token_a_image,
        decimals: pool.token_a?.decimals || 9
      },
      token_b: {
        mint: pool.token_b?.mint || pool.token_b_mint,
        symbol: pool.token_b?.symbol || 'UNKNOWN',
        name: pool.token_b?.name || 'Unknown Token',
        image: pool.token_b?.image || pool.token_b_image,
        decimals: pool.token_b?.decimals || 9
      },
      liquidity: pool.liquidity || 0,
      liquidity_usd: pool.liquidity_usd || pool.liquidity || 0,
      volume_24h: pool.volume_24h || 0,
      volume_7d: pool.volume_7d || 0,
      fee_rate: pool.fee_rate || 0.003,
      apr: pool.apr || 0,
      total_supply: pool.total_supply || null,
      reserve_a: pool.reserve_a || null,
      reserve_b: pool.reserve_b || null,
      dex_name: 'XDEX',
      url: `https://app.xdex.xyz/liquidity?pool=${poolAddress}`,
      created_at: pool.created_at || null,
      source: 'pool_detail'
    };

    console.log(`✅ Pool: ${formattedPool.pair_name}`);
    console.log(`   Liquidity: $${formattedPool.liquidity_usd.toLocaleString()}`);
    console.log(`   24h Volume: $${formattedPool.volume_24h.toLocaleString()}`);

    return new Response(JSON.stringify({
      success: true,
      pool: formattedPool,
      source: 'XDEX'
    }), { headers: corsHeaders() });

  } catch (error) {
    console.error('❌ Pool fetch error:', error);
    
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
