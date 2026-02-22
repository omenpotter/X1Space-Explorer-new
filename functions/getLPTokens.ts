// functions/getLPTokens.ts
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
      tokens: [],
      count: 0
    }), {
      status: 429,
      headers: corsHeaders(),
    });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '500'), 500);

  try {
    console.log(`📊 Fetching pools from XDEX (limit: ${limit})...`);
    
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
    console.log('Has success key:', pools?.success);

    // Handle both plain array and {success: true, data: [...]}
    if (!Array.isArray(pools)) {
      if (pools.success && Array.isArray(pools.data)) {
        pools = pools.data;
      } else {
        console.error('Unexpected format:', JSON.stringify(pools).slice(0, 200));
        throw new Error('Unexpected format from XDEX');
      }
    }

    console.log(`✓ Received ${pools.length} pools from XDEX`);

    // Filter and sort
    const sorted = pools
      .filter(p => (p.tvl || 0) > 0)
      .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
      .slice(0, limit);

    console.log(`✓ Filtered to ${sorted.length} pools with TVL`);

    // Format tokens
    const tokens = sorted.map((pool, index) => {
      const info = pool.pool_info || {};

      // Handle lpSupply: string (hex) or BigInt-like object
      let lpSupplyRaw = info.lpSupply;
      if (lpSupplyRaw && typeof lpSupplyRaw === 'object' && lpSupplyRaw.words) {
        // Convert BigInt-like to hex string
        lpSupplyRaw = '0x' + lpSupplyRaw.words.map((w: number) => w.toString(16).padStart(8, '0')).join('');
      }

      const token = {
        lp_mint: info.lpMint || pool.pool_address || '',
        pool_address: pool.pool_address || '',
        token_a_symbol: pool.token1_symbol || 'UNKNOWN',
        token_b_symbol: pool.token2_symbol || 'UNKNOWN',
        pair_symbol: `${pool.token1_symbol || 'UNKNOWN'}/${pool.token2_symbol || 'UNKNOWN'}`,
        token_a_logo: pool.token1_logo || null,
        token_b_logo: pool.token2_logo || null,
        token_a_mint: pool.token1_address || info.token0Mint || '',
        token_b_mint: pool.token2_address || info.token1Mint || '',
        holder_count: pool.lp_token_holder_count || 0,
        total_supply: lpSupplyRaw || '0',
        decimals: info.lpMintDecimals || 9,
        updated_at: pool.updatedAt || null,
        created_at: pool.createdAt || null,
        liquidity_usd: pool.tvl || 0,
        fee_rate: pool.fee_rate || 0.003,
        volume_24h: pool.volume_24h || 0,
      };

      // Log first token for debugging
      if (index === 0) {
        console.log('Sample token:', JSON.stringify(token, null, 2));
      }

      return token;
    });

    console.log(`✅ Returning ${tokens.length} formatted tokens`);

    return new Response(JSON.stringify({
      success: true,
      tokens,
      count: tokens.length,
      total_scanned: pools.length,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: corsHeaders()
    });

  } catch (err) {
    console.error('❌ Error:', err);
    console.error('Error stack:', err.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: err.message || 'Internal error',
      tokens: [],
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: corsHeaders()
    });
  }
});
