// functions/getLPTokens.ts
// Fetch LP tokens from XDEX - WITH API KEY

const XDEX_API = 'https://api.xdex.xyz';
const NETWORK = 'X1%20Mainnet';
const XDEX_API_KEY = Deno.env.get('XDEX_API_KEY');

// Rate limiting - in-memory store
const rateLimits = new Map();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip) || { count: 0, reset: now + 60000 };
  
  if (now > limit.reset) {
    limit.count = 0;
    limit.reset = now + 60000;
  }
  
  limit.count++;
  rateLimits.set(ip, limit);
  
  return limit.count <= 100; // 100 requests per minute per IP
}

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

  // Rate limiting check
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             req.headers.get('cf-connecting-ip') || 
             'unknown';
  
  if (!checkRateLimit(ip)) {
    console.warn(`⚠️ Rate limit exceeded for IP: ${ip}`);
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded. Please try again in a minute.',
      pools: []
    }), {
      status: 429,
      headers: corsHeaders(),
    });
  }

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') || '100');

  try {
    console.log(`📊 Fetching LP tokens from XDEX (limit: ${limit})`);
    
    // Build headers with API key
    const headers: Record<string, string> = {
      'User-Agent': 'X1Space-Explorer/1.0',
      'Accept': 'application/json'
    };
    
    if (XDEX_API_KEY) {
      headers['X-API-Key'] = XDEX_API_KEY;
      console.log('✓ Using XDEX API Key');
    }

    const response = await fetch(
      `${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`,
      { 
        headers,
        signal: AbortSignal.timeout(10000) 
      }
    );

    if (!response.ok) {
      throw new Error(`XDEX API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !Array.isArray(data.data)) {
      throw new Error('Invalid XDEX response');
    }

    const pools = data.data.slice(0, limit).map((pool: any) => ({
      pool_address: pool.pool_address,
      lp_mint: pool.lp_mint,
      token_a_mint: pool.token1_address,
      token_b_mint: pool.token2_address,
      token_a_symbol: pool.token1_symbol,
      token_b_symbol: pool.token2_symbol,
      token_a_image: pool.token1_logo,
      token_b_image: pool.token2_logo,
      tvl: pool.tvl || 0,
      lp_token_holder_count: pool.lp_token_holder_count || 0,
      updated_at: new Date().toISOString(),
    }));

    console.log(`✅ Returning ${pools.length} LP tokens`);

    return new Response(JSON.stringify(pools), {
      headers: corsHeaders(),
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    return new Response(JSON.stringify({
      error: error.message,
      pools: []
    }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
});
