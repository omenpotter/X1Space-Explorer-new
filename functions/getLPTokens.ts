// functions/getLPTokens.ts
// Backend proxy for XDEX pool data with correct response format

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
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '500'), 500);

  try {
    console.log(`📊 Fetching up to ${limit} pools from XDEX...`);

    const res = await fetch(
      `${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`,
      { signal: AbortSignal.timeout(20000) }
    );

    if (!res.ok) {
      throw new Error(`XDEX pool/list failed: ${res.status} ${res.statusText}`);
    }

    const pools = await res.json();

    // XDEX returns a plain array (not {success, data})
    if (!Array.isArray(pools)) {
      throw new Error('Unexpected response format from XDEX pool/list');
    }

    console.log(`✓ Received ${pools.length} pools from XDEX`);

    // Filter and sort by TVL
    const sorted = pools
      .filter(p => (p.tvl || 0) > 0)
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, limit);

    // Format tokens with correct field mappings
    const tokens = sorted.map(pool => {
      const info = pool.pool_info || {};

      return {
        lp_mint: info.lpMint || pool.pool_address || '',
        pool_address: pool.pool_address || '',
        
        // Token pair symbols
        token_a_symbol: pool.token1_symbol || 'UNKNOWN',
        token_b_symbol: pool.token2_symbol || 'UNKNOWN',
        pair_symbol: `${pool.token1_symbol || 'UNKNOWN'}/${pool.token2_symbol || 'UNKNOWN'}`,
        
        // Token addresses
        token_a_mint: pool.token1_address || info.token0Mint || '',
        token_b_mint: pool.token2_address || info.token1Mint || '',
        
        // Token logos
        token_a_logo: pool.token1_logo || null,
        token_b_logo: pool.token2_logo || null,
        
        // Pool data
        holder_count: pool.lp_token_holder_count || 0,
        total_supply: info.lpSupply || '0',
        decimals: info.lpMintDecimals || 9,
        liquidity_usd: pool.tvl || 0,
        volume_24h: pool.volume_24h || 0,
        fee_rate: pool.fee_rate || 0.003,
        
        // Timestamps
        updated_at: pool.updatedAt || null,
        created_at: pool.createdAt || null,
      };
    });

    console.log(`✅ Returning ${tokens.length} formatted pools`);

    return new Response(JSON.stringify({
      success: true,
      tokens,
      count: tokens.length,
      total_pools_scanned: pools.length,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: corsHeaders()
    });

  } catch (err) {
    console.error('❌ LP proxy error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Internal error',
      tokens: []
    }), {
      status: 500,
      headers: corsHeaders()
    });
  }
});
