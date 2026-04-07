// X1 Token Explorer - Get Token Details from XDEX API

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
  const mint = url.searchParams.get('mint');

  if (!mint) {
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 400,
        message: 'mint parameter is required'
      }
    }), { 
      status: 400, 
      headers: corsHeaders() 
    });
  }

  try {
    console.log('🔍 Fetching token details for:', mint);

    // Fetch token info from pools and price data in parallel
    const [poolsRes, priceRes] = await Promise.allSettled([
      fetch(`${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`, {
        signal: AbortSignal.timeout(10000)
      }),
      fetch(`${XDEX_API}/api/token-price/price?network=${NETWORK}&address=${mint}`, {
        signal: AbortSignal.timeout(10000)
      })
    ]);

    // Extract token info from pools
    let tokenInfo = null;
    let pools = [];
    
    if (poolsRes.status === 'fulfilled' && poolsRes.value.ok) {
      const poolsData = await poolsRes.value.json();
      
      if (poolsData.success && poolsData.data) {
        for (const pool of poolsData.data) {
          // Check if token is in this pool
          const isTokenA = pool.token_a_mint === mint;
          const isTokenB = pool.token_b_mint === mint;
          
          if (isTokenA || isTokenB) {
            // Store pool info
            pools.push({
              pool_address: pool.pool_address,
              pair_name: `${pool.token_a_symbol}/${pool.token_b_symbol}`,
              token_a: {
                mint: pool.token_a_mint,
                symbol: pool.token_a_symbol,
                name: pool.token_a_name
              },
              token_b: {
                mint: pool.token_b_mint,
                symbol: pool.token_b_symbol,
                name: pool.token_b_name
              },
              liquidity: pool.liquidity || 0,
              volume_24h: pool.volume_24h || 0,
              url: `https://app.xdex.xyz/swap?pool=${pool.pool_address}`
            });
            
            // Extract token metadata if not yet found
            if (!tokenInfo) {
              if (isTokenA) {
                tokenInfo = {
                  mint: pool.token_a_mint,
                  name: pool.token_a_name || 'Unknown Token',
                  symbol: pool.token_a_symbol || 'UNKNOWN',
                  logo_uri: pool.token_a_image,
                  decimals: pool.token_a_decimals || 9
                };
              } else {
                tokenInfo = {
                  mint: pool.token_b_mint,
                  name: pool.token_b_name || 'Unknown Token',
                  symbol: pool.token_b_symbol || 'UNKNOWN',
                  logo_uri: pool.token_b_image,
                  decimals: pool.token_b_decimals || 9
                };
              }
            }
          }
        }
      }
    }

    if (!tokenInfo) {
      return new Response(JSON.stringify({
        success: false,
        error: {
          code: 404,
          message: 'Token not found in XDEX pools',
          hint: 'This token may not have any liquidity pools on XDEX'
        }
      }), { 
        status: 404, 
        headers: corsHeaders() 
      });
    }

    console.log(`✓ Found token in ${pools.length} pools`);

    // Add price data
    let priceData = {
      price: 0,
      price_usd: 0,
      price_change_24h: 0,
      volume_24h: 0,
      market_cap: 0,
      liquidity: 0
    };

    if (priceRes.status === 'fulfilled' && priceRes.value.ok) {
      const priceJson = await priceRes.value.json();
      if (priceJson.success && priceJson.data) {
        priceData = {
          price: priceJson.data.price || 0,
          price_usd: priceJson.data.price_usd || 0,
          price_change_24h: priceJson.data.price_change_24h || 0,
          volume_24h: priceJson.data.volume_24h || 0,
          market_cap: priceJson.data.market_cap || 0,
          liquidity: priceJson.data.liquidity || 0
        };
        console.log('✓ Fetched price data');
      }
    }

    const response = {
      success: true,
      token: {
        ...tokenInfo,
        ...priceData,
        pools,
        pool_count: pools.length,
        total_liquidity: pools.reduce((sum, p) => sum + (p.liquidity || 0), 0),
        verified: !!(tokenInfo.name && tokenInfo.name !== 'Unknown Token'),
        source: 'XDEX'
      }
    };

    console.log('✅ Returning token details');

    return new Response(JSON.stringify(response), { 
      headers: corsHeaders() 
    });

  } catch (error) {
    console.error('❌ Token fetch error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 500,
        message: 'Failed to fetch token details',
        details: error.message
      }
    }), { 
      status: 500, 
      headers: corsHeaders() 
    });
  }
});
