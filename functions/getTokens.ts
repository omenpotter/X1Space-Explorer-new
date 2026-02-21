// functions/getTokens.ts
// MINIMAL TEST - Just return hardcoded data to verify function works

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

Deno.serve(async (req) => {
  console.log('🔴 FUNCTION CALLED!');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('→ Returning CORS preflight');
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    console.log('→ Returning test data');
    
    // Return hardcoded test data
    const testTokens = [
      {
        mint: "So11111111111111111111111111111111111111112",
        name: "WXNT",
        symbol: "WXNT",
        logo_uri: "https://app.xdex.xyz/assets/images/tokens/x1.webp",
        decimals: 9,
        total_supply: 0,
        token_type: 'SPL Token',
        verification_count: 1,
        is_scam: false,
        liquidity: 5000,
        pool_count: 10,
        price: '0.5672',
        market_cap: 0,
        price_change_24h: '0.00',
        volume_24h: 0,
        created_at: new Date().toISOString(),
        first_verified_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
        price_history: []
      },
      {
        mint: "XNMbEwZFFBKQhqyW3taa8cAUp1xBUHfyzRFJQvZET4m",
        name: "XNM",
        symbol: "XNM",
        logo_uri: "https://explorer.xenblocks.io/tokens/xnm.png",
        decimals: 9,
        total_supply: 0,
        token_type: 'SPL Token',
        verification_count: 1,
        is_scam: false,
        liquidity: 750,
        pool_count: 5,
        price: '0.0018',
        market_cap: 0,
        price_change_24h: '0.00',
        volume_24h: 0,
        created_at: new Date().toISOString(),
        first_verified_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
        price_history: []
      },
      {
        mint: "DQ6sApYPMJ8LwpvyUjthL7amykNBJ3fx5jZi2koN7vHb",
        name: "XENCAT",
        symbol: "XENCAT",
        logo_uri: "https://raw.githubusercontent.com/Commoneffort/xencat-light-client/main/metadata/xencat-logo.jpg",
        decimals: 6,
        total_supply: 0,
        token_type: 'SPL Token',
        verification_count: 1,
        is_scam: false,
        liquidity: 395,
        pool_count: 3,
        price: '0.0001',
        market_cap: 0,
        price_change_24h: '0.00',
        volume_24h: 0,
        created_at: new Date().toISOString(),
        first_verified_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
        price_history: []
      }
    ];

    const response = {
      success: true,
      tokens: testTokens,
      total: testTokens.length,
      verified: testTokens.length,
      discovered: 0,
      page: 1,
      limit: 100,
      offset: 0,
      source: 'TEST DATA',
      timestamp: new Date().toISOString()
    };

    console.log('✅ Returning', testTokens.length, 'test tokens');
    
    return new Response(JSON.stringify(response), { 
      headers: corsHeaders() 
    });

  } catch (error) {
    console.error('❌ ERROR:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 500,
        message: error.message,
        timestamp: new Date().toISOString()
      },
      tokens: [],
      total: 0,
      verified: 0,
      discovered: 0
    }), { 
      status: 500,
      headers: corsHeaders()
    });
  }
});
