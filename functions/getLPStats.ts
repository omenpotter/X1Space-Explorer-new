// functions/getLPStats.ts
// Get aggregated statistics from XDEX pools

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

  try {
    console.log('📊 Fetching LP stats from XDEX...');

    const res = await fetch(
      `${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`,
      { signal: AbortSignal.timeout(20000) }
    );

    if (!res.ok) {
      throw new Error(`XDEX API error: ${res.status}`);
    }

    const pools = await res.json();

    if (!Array.isArray(pools)) {
      throw new Error('Invalid response format');
    }

    console.log(`✓ Received ${pools.length} pools`);

    // Calculate stats
    const total_pools = pools.length;
    
    let total_lp_supply = 0n;
    let total_holders = 0;
    
    pools.forEach(pool => {
      const info = pool.pool_info || {};
      const supply = info.lpSupply || '0';
      
      // Parse hex supply
      try {
        total_lp_supply += BigInt(supply.startsWith('0x') ? supply : '0x' + supply);
      } catch (e) {
        // Skip invalid supply values
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
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
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
