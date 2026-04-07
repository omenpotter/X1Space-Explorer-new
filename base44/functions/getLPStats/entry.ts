// functions/getLPStats.ts
// Fixed version with robust error handling - WITH RATE LIMITING

const XDEX_API = 'https://api.xdex.xyz';
const NETWORK = 'X1%20Mainnet';

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
      success: false,
      error: 'Rate limit exceeded. Please try again in a minute.',
      stats: {
        total_pools: 0,
        total_holders: 0,
        total_lp_supply: '0'
      }
    }), {
      status: 429,
      headers: corsHeaders(),
    });
  }

  try {
    console.log('📊 Fetching LP stats from XDEX...');
    
    const res = await fetch(
      `${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`,
      { signal: AbortSignal.timeout(20000) }
    );

    if (!res.ok) {
      throw new Error(`XDEX failed: ${res.status}`);
    }

    let pools = await res.json();
    
    console.log('Raw response type:', typeof pools);
    console.log('Is array:', Array.isArray(pools));

    // Handle both plain array and {success: true, data: [...]}
    if (!Array.isArray(pools)) {
      if (pools.success && Array.isArray(pools.data)) {
        pools = pools.data;
      } else {
        console.error('Unexpected format:', JSON.stringify(pools).slice(0, 200));
        throw new Error('Unexpected format from XDEX');
      }
    }

    console.log(`✓ Received ${pools.length} pools`);

    // Calculate stats
    const total_pools = pools.length;
    let total_lp_supply = 0n;
    let total_holders = 0;

    pools.forEach((pool, index) => {
      const info = pool.pool_info || {};
      let supply = info.lpSupply;

      // Handle BigInt-like object
      if (supply && typeof supply === 'object' && supply.words) {
        const hexStr = '0x' + supply.words.map((w: number) => w.toString(16).padStart(8, '0')).join('');
        try {
          total_lp_supply += BigInt(hexStr);
        } catch (e) {
          console.warn(`Failed to parse supply for pool ${index}:`, e);
        }
      } else if (supply && typeof supply === 'string') {
        // Handle hex string
        try {
          const hexStr = supply.startsWith('0x') ? supply : '0x' + supply;
          total_lp_supply += BigInt(hexStr);
        } catch (e) {
          console.warn(`Failed to parse supply for pool ${index}:`, e);
        }
      }

      total_holders += pool.lp_token_holder_count || 0;
    });

    const stats = {
      total_pools,
      total_holders,
      total_lp_supply: total_lp_supply.toString(),
      last_updated: new Date().toISOString()
    };

    console.log('✅ Stats calculated:', stats);

    return new Response(JSON.stringify({
      success: true,
      stats
    }), {
      status: 200,
      headers: corsHeaders()
    });

  } catch (err) {
    console.error('❌ Stats error:', err);
    console.error('Error stack:', err.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Internal error',
      stats: {
        total_pools: 0,
        total_holders: 0,
        total_lp_supply: '0'
      }
    }), {
      status: 500,
      headers: corsHeaders()
    });
  }
});
