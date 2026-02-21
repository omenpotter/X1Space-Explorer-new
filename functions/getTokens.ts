// X1 Token Explorer - Get Tokens from XDEX API
// Replaces PostgreSQL database with XDEX API integration

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
  // Handle CORS preflight
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

    // Fetch all pools from XDEX to extract token list
    const poolsRes = await fetch(
      `${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!poolsRes.ok) {
      throw new Error(`XDEX API error: ${poolsRes.status} ${poolsRes.statusText}`);
    }

    const poolsData = await poolsRes.json();
    
    if (!poolsData.success || !poolsData.data) {
      throw new Error('Invalid XDEX API response');
    }

    console.log(`✓ Fetched ${poolsData.data.length} pools from XDEX`);

    // Extract unique tokens from all pools
    const tokenMap = new Map();
    
    poolsData.data.forEach(pool => {
      // Add token A if not already in map
      if (pool.token_a_mint && !tokenMap.has(pool.token_a_mint)) {
        const hasMetadata = pool.token_a_name && 
                           pool.token_a_name !== 'Unknown Token' && 
                           pool.token_a_symbol && 
                           pool.token_a_symbol !== 'UNKNOWN';
        
        tokenMap.set(pool.token_a_mint, {
          mint: pool.token_a_mint,
          name: pool.token_a_name || 'Unknown Token',
          symbol: pool.token_a_symbol || 'UNKNOWN',
          logo_uri: pool.token_a_image || null,
          decimals: pool.token_a_decimals || 9,
          verified: hasMetadata,
          pool_count: 1
        });
      } else if (pool.token_a_mint) {
        const token = tokenMap.get(pool.token_a_mint);
        token.pool_count = (token.pool_count || 0) + 1;
      }
      
      // Add token B if not already in map
      if (pool.token_b_mint && !tokenMap.has(pool.token_b_mint)) {
        const hasMetadata = pool.token_b_name && 
                           pool.token_b_name !== 'Unknown Token' && 
                           pool.token_b_symbol && 
                           pool.token_b_symbol !== 'UNKNOWN';
        
        tokenMap.set(pool.token_b_mint, {
          mint: pool.token_b_mint,
          name: pool.token_b_name || 'Unknown Token',
          symbol: pool.token_b_symbol || 'UNKNOWN',
          logo_uri: pool.token_b_image || null,
          decimals: pool.token_b_decimals || 9,
          verified: hasMetadata,
          pool_count: 1
        });
      } else if (pool.token_b_mint) {
        const token = tokenMap.get(pool.token_b_mint);
        token.pool_count = (token.pool_count || 0) + 1;
      }
    });

    let tokens = Array.from(tokenMap.values());
    console.log(`✓ Extracted ${tokens.length} unique tokens`);

    // Filter verified only if requested
    if (verifiedOnly) {
      tokens = tokens.filter(t => t.verified);
      console.log(`✓ Filtered to ${tokens.length} verified tokens`);
    }

    // Sort by pool count (more pools = more popular)
    tokens.sort((a, b) => (b.pool_count || 0) - (a.pool_count || 0));

    // Fetch prices for top tokens (batch request)
    const topTokens = tokens.slice(0, 100);
    const tokenAddresses = topTokens.map(t => t.mint).join(',');
    
    let priceMap = {};
    if (tokenAddresses) {
      try {
        console.log('💰 Fetching prices for top 100 tokens...');
        const pricesRes = await fetch(
          `${XDEX_API}/api/token-price/prices?network=${NETWORK}&token_addresses=${tokenAddresses}`,
          { signal: AbortSignal.timeout(10000) }
        );
        
        if (pricesRes.ok) {
          const pricesData = await pricesRes.json();
          if (pricesData.success && pricesData.data) {
            priceMap = pricesData.data;
            console.log(`✓ Fetched prices for ${Object.keys(priceMap).length} tokens`);
          }
        }
      } catch (e) {
        console.warn('⚠️ Price fetch failed:', e.message);
      }
    }

    // Enrich tokens with price data and format for frontend
    const enrichedTokens = tokens.map(token => {
      const priceInfo = priceMap[token.mint] || {};
      
      return {
        mint: token.mint,
        name: token.name,
        symbol: token.symbol,
        logo_uri: token.logo_uri,
        decimals: token.decimals,
        total_supply: 0, // Not available from XDEX API
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
        price: priceInfo.price?.toString() || '0.0000',
        market_cap: priceInfo.market_cap || 0,
        price_change_24h: priceInfo.price_change_24h?.toString() || '0.00',
        volume_24h: priceInfo.volume_24h || 0,
        liquidity: priceInfo.liquidity || 0,
        created_at: new Date().toISOString(),
        first_verified_at: token.verified ? new Date().toISOString() : null,
        last_verified_at: token.verified ? new Date().toISOString() : null,
        price_history: []
      };
    });

    // Apply pagination
    const paginatedTokens = enrichedTokens.slice(offset, offset + limit);

    console.log(`✅ Returning ${paginatedTokens.length} tokens (page ${Math.floor(offset / limit) + 1})`);

    return new Response(JSON.stringify({
      success: true,
      tokens: paginatedTokens,
      total: enrichedTokens.length,
      page: Math.floor(offset / limit) + 1,
      limit,
      offset,
      source: 'XDEX API',
      timestamp: new Date().toISOString()
    }), { headers: corsHeaders() });

  } catch (error) {
    console.error('❌ XDEX API error:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 500,
        message: 'Failed to fetch tokens from XDEX API',
        details: error.message,
        timestamp: new Date().toISOString()
      }
    }), { 
      status: 500,
      headers: corsHeaders()
    });
  }
});
