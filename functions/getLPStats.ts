// functions/getLPStats.ts
// Fetch LP stats from XDEX - WITH API KEY

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
      total_pools: 0,
      total_tvl: 0,
      total_holders: 0
    }), {
      status: 429,
      headers: corsHeaders(),
    });
  }

  try {
    console.log('📊 Fetching LP stats from XDEX');
    
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

    const pools = data.data;

    // Calculate aggregate stats
    const totalPools = pools.length;
    const totalTVL = pools.reduce((sum: number, pool: any) => sum + (pool.tvl || 0), 0);
    const totalHolders = pools.reduce((sum: number, pool: any) => sum + (pool.lp_token_holder_count || 0), 0);

    const stats = {
      total_pools: totalPools,
      total_tvl: totalTVL,
      total_holders: totalHolders,
      avg_tvl_per_pool: totalPools > 0 ? totalTVL / totalPools : 0,
      updated_at: new Date().toISOString(),
    };

    console.log(`✅ Stats: ${totalPools} pools, $${totalTVL.toFixed(2)} TVL`);

    return new Response(JSON.stringify(stats), {
      headers: corsHeaders(),
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    return new Response(JSON.stringify({
      error: error.message,
      total_pools: 0,
      total_tvl: 0,
      total_holders: 0,
    }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
});
