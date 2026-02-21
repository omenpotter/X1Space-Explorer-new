// functions/getTokens.ts
// Fixed version - handles XDEX's plain array response

const XDEX_API = 'https://api.xdex.xyz';
const NETWORK = 'X1%20Mainnet';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const verifiedOnly = url.searchParams.get('verified_only') === 'true';

  try {
    console.log('📊 Fetching tokens from XDEX API...');
    console.log(`Params: limit=${limit}, offset=${offset}, verifiedOnly=${verifiedOnly}`);

    // Fetch all pools from XDEX
    const poolsRes = await fetch(
      `${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!poolsRes.ok) {
      throw new Error(`XDEX API error: ${poolsRes.status} ${poolsRes.statusText}`);
    }

    let pools = await poolsRes.json();
    
    // XDEX returns plain array (not {success, data})
    if (!Array.isArray(pools)) {
      if (pools.success && Array.isArray(pools.data)) {
        pools = pools.data;
      } else {
        throw new Error('Invalid XDEX API response format');
      }
    }

    console.log(`✓ Fetched ${pools.length} pools from XDEX`);

    // Extract unique tokens from all pools
    const tokenMap = new Map();
    
    pools.forEach(pool => {
      // Token A (using XDEX field names: token1_symbol, token1_address, etc.)
      const tokenAMint = pool.token1_address || pool.token_a_mint;
      const tokenASymbol = pool.token1_symbol || pool.token_a_symbol;
      const tokenAName = pool.token1_name || pool.token_a_name;
      const tokenAImage = pool.token1_logo || pool.token_a_image;
      
      if (tokenAMint && !tokenMap.has(tokenAMint)) {
        const hasMetadata = tokenAName && 
                           tokenAName !== 'Unknown Token' && 
                           tokenASymbol && 
                           tokenASymbol !== 'UNKNOWN';
        
        tokenMap.set(tokenAMint, {
          mint: tokenAMint,
          name: tokenAName || 'Unknown Token',
          symbol: tokenASymbol || 'UNKNOWN',
          logo_uri: tokenAImage || null,
          decimals: 9,
          verified: hasMetadata,
          pool_count: 1,
          liquidity: pool.tvl || 0
        });
      } else if (tokenAMint) {
        const token = tokenMap.get(tokenAMint);
        token.pool_count = (token.pool_count || 0) + 1;
        token.liquidity = (token.liquidity || 0) + (pool.tvl || 0);
      }
      
      // Token B
      const tokenBMint = pool.token2_address || pool.token_b_mint;
      const tokenBSymbol = pool.token2_symbol || pool.token_b_symbol;
      const tokenBName = pool.token2_name || pool.token_b_name;
      const tokenBImage = pool.token2_logo || pool.token_b_image;
      
      if (tokenBMint && !tokenMap.has(tokenBMint)) {
        const hasMetadata = tokenBName && 
                           tokenBName !== 'Unknown Token' && 
                           tokenBSymbol && 
                           tokenBSymbol !== 'UNKNOWN';
        
        tokenMap.set(tokenBMint, {
          mint: tokenBMint,
          name: tokenBName || 'Unknown Token',
          symbol: tokenBSymbol || 'UNKNOWN',
          logo_uri: tokenBImage || null,
          decimals: 9,
          verified: hasMetadata,
          pool_count: 1,
          liquidity: pool.tvl || 0
        });
      } else if (tokenBMint) {
        const token = tokenMap.get(tokenBMint);
        token.pool_count = (token.pool_count || 0) + 1;
        token.liquidity = (token.liquidity || 0) + (pool.tvl || 0);
      }
    });

    let tokens = Array.from(tokenMap.values());
    console.log(`✓ Extracted ${tokens.length} unique tokens`);

    // Filter verified only if requested
    const verifiedCount = tokens.filter(t => t.verified).length;
    const discoveredCount = tokens.length - verifiedCount;
    
    if (verifiedOnly) {
      tokens = tokens.filter(t => t.verified);
      console.log(`✓ Filtered to ${tokens.length} verified tokens`);
    }

    // Sort by liquidity (more liquidity = more important)
    tokens.sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));

    // Format for frontend
    const enrichedTokens = tokens.map(token => ({
      mint: token.mint,
      name: token.name,
      symbol: token.symbol,
      logo_uri: token.logo_uri,
      decimals: token.decimals,
      total_supply: 0,
      token_type: 'SPL Token',
      token_standard: 'SPL Token',
      verification_count: token.verified ? 1 : 0,
      is_scam: false,
      website: null,
      twitter: null,
      telegram: null,
      discord: null,
      description: null,
      metadata_uri: null,
      price: '0.0000',
      market_cap: 0,
      price_change_24h: '0.00',
      volume_24h: 0,
      liquidity: token.liquidity || 0,
      pool_count: token.pool_count || 0,
      created_at: new Date().toISOString(),
      first_verified_at: token.verified ? new Date().toISOString() : null,
      last_verified_at: token.verified ? new Date().toISOString() : null,
      price_history: []
    }));

    // Apply pagination
    const paginatedTokens = enrichedTokens.slice(offset, offset + limit);

    console.log(`✅ Returning ${paginatedTokens.length} tokens (page ${Math.floor(offset / limit) + 1})`);

    return new Response(JSON.stringify({
      success: true,
      tokens: paginatedTokens,
      total: enrichedTokens.length,
      verified: verifiedCount,
      discovered: discoveredCount,
      page: Math.floor(offset / limit) + 1,
      limit,
      offset,
      source: 'XDEX API',
      timestamp: new Date().toISOString()
    }), { headers: corsHeaders() });

  } catch (error) {
    console.error('❌ Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 500,
        message: 'Failed to fetch tokens from XDEX API',
        details: error.message,
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
