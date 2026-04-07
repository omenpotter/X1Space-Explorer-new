// X1 Token Explorer - Get Token Price from XDEX API

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
  const withHistory = url.searchParams.get('history') === 'true';

  if (!mint) {
    return new Response(JSON.stringify({
      success: false,
      error: 'mint parameter required'
    }), { 
      status: 400, 
      headers: corsHeaders() 
    });
  }

  try {
    console.log('💰 Fetching price for:', mint);

    // Fetch current price
    const priceRes = await fetch(
      `${XDEX_API}/api/token-price/price?network=${NETWORK}&address=${mint}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!priceRes.ok) {
      throw new Error(`XDEX API error: ${priceRes.status}`);
    }

    const priceData = await priceRes.json();

    if (!priceData.success || !priceData.data) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Price not found for this token'
      }), { 
        status: 404, 
        headers: corsHeaders() 
      });
    }

    const response = {
      success: true,
      data: {
        mint,
        price: priceData.data.price || 0,
        price_usd: priceData.data.price_usd || 0,
        price_change_24h: priceData.data.price_change_24h || 0,
        volume_24h: priceData.data.volume_24h || 0,
        market_cap: priceData.data.market_cap || 0,
        liquidity: priceData.data.liquidity || 0,
        source: 'XDEX',
        timestamp: new Date().toISOString()
      }
    };

    // Optionally fetch price history
    if (withHistory) {
      try {
        const historyRes = await fetch(
          `${XDEX_API}/api/xendex/chart/history?network=${NETWORK}&token=${mint}`,
          { signal: AbortSignal.timeout(10000) }
        );

        if (historyRes.ok) {
          const historyData = await historyRes.json();
          if (historyData.success && historyData.data) {
            response.data.history = historyData.data;
          }
        }
      } catch (e) {
        console.warn('History fetch failed:', e.message);
        response.data.history = [];
      }
    }

    console.log(`✅ Price: $${response.data.price}, Change: ${response.data.price_change_24h}%`);

    return new Response(JSON.stringify(response), { 
      headers: corsHeaders() 
    });

  } catch (error) {
    console.error('❌ Price fetch error:', error);
    
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
