// functions/getTokens.ts
// DEBUG VERSION - Extensive logging to find the issue

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
    console.log('═══════════════════════════════════');
    console.log('📊 STARTING TOKEN FETCH');
    console.log('═══════════════════════════════════');
    console.log(`Params: limit=${limit}, offset=${offset}, verifiedOnly=${verifiedOnly}`);

    // Fetch pools from XDEX
    const poolsRes = await fetch(
      `${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`,
      { signal: AbortSignal.timeout(15000) }
    );

    console.log('─── XDEX pool/list RESPONSE ───');
    console.log('Status:', poolsRes.status);
    
    const poolsData = await poolsRes.json();
    
    console.log('Response type:', typeof poolsData);
    console.log('Response starts with:', JSON.stringify(poolsData).slice(0, 300));
    console.log('success exists?', 'success' in poolsData, poolsData.success);
    console.log('data is array?', Array.isArray(poolsData?.data));
    console.log('number of pools:', poolsData?.data?.length ?? 'missing');
    console.log('First pool (if any):', poolsData?.data?.[0]?.pool_address ?? 'no pools');

    if (!poolsRes.ok) {
      throw new Error(`XDEX API error: ${poolsRes.status} ${poolsRes.statusText}`);
    }

    if (!poolsData.success || !Array.isArray(poolsData.data)) {
      console.error('❌ Invalid XDEX response format!');
      console.error('poolsData.success:', poolsData.success);
      console.error('Array.isArray(poolsData.data):', Array.isArray(poolsData.data));
      throw new Error('Invalid XDEX API response format');
    }

    const pools = poolsData.data;
    console.log(`✓ Fetched ${pools.length} pools from XDEX`);

    // Extract unique tokens
    const tokenMap = new Map();
    
    pools.forEach((pool, index) => {
      if (index === 0) {
        console.log('─── FIRST POOL STRUCTURE ───');
        console.log('token1_address:', pool.token1_address);
        console.log('token1_symbol:', pool.token1_symbol);
        console.log('token1_logo:', pool.token1_logo);
        console.log('token2_address:', pool.token2_address);
        console.log('token2_symbol:', pool.token2_symbol);
        console.log('token2_logo:', pool.token2_logo);
        console.log('tvl:', pool.tvl);
      }
      
      // Token 1
      const token1Mint = pool.token1_address;
      const token1Symbol = pool.token1_symbol;
      const token1Logo = pool.token1_logo;
      
      if (token1Mint && !tokenMap.has(token1Mint)) {
        const hasMetadata = token1Symbol && token1Symbol !== 'UNKNOWN';
        
        tokenMap.set(token1Mint, {
          mint: token1Mint,
          name: token1Symbol || 'Unknown Token',
          symbol: token1Symbol || 'UNKNOWN',
          logo_uri: token1Logo || null,
          decimals: 9,
          verified: hasMetadata,
          pool_count: 1,
          liquidity: pool.tvl || 0
        });
      } else if (token1Mint) {
        const token = tokenMap.get(token1Mint);
        token.pool_count = (token.pool_count || 0) + 1;
        token.liquidity = (token.liquidity || 0) + (pool.tvl || 0);
      }
      
      // Token 2
      const token2Mint = pool.token2_address;
      const token2Symbol = pool.token2_symbol;
      const token2Logo = pool.token2_logo;
      
      if (token2Mint && !tokenMap.has(token2Mint)) {
        const hasMetadata = token2Symbol && token2Symbol !== 'UNKNOWN';
        
        tokenMap.set(token2Mint, {
          mint: token2Mint,
          name: token2Symbol || 'Unknown Token',
          symbol: token2Symbol || 'UNKNOWN',
          logo_uri: token2Logo || null,
          decimals: 9,
          verified: hasMetadata,
          pool_count: 1,
          liquidity: pool.tvl || 0
        });
      } else if (token2Mint) {
        const token = tokenMap.get(token2Mint);
        token.pool_count = (token.pool_count || 0) + 1;
        token.liquidity = (token.liquidity || 0) + (pool.tvl || 0);
      }
    });

    let tokens = Array.from(tokenMap.values());
    console.log(`✓ Extracted ${tokens.length} unique tokens`);
    
    if (tokens.length > 0) {
      console.log('─── FIRST TOKEN ───');
      console.log(JSON.stringify(tokens[0], null, 2));
    }

    // Filter verified only if requested
    const verifiedCount = tokens.filter(t => t.verified).length;
    const discoveredCount = tokens.length - verifiedCount;
    
    console.log(`Verified: ${verifiedCount}, Discovered: ${discoveredCount}`);
    
    if (verifiedOnly) {
      tokens = tokens.filter(t => t.verified);
      console.log(`✓ Filtered to ${tokens.length} verified tokens`);
    }

    // Sort by liquidity
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
      liquidity: token.liquidity || 0,
      pool_count: token.pool_count || 0,
      created_at: new Date().toISOString(),
      first_verified_at: token.verified ? new Date().toISOString() : null,
      last_verified_at: token.verified ? new Date().toISOString() : null,
      price: '0.0000',
      market_cap: 0,
      price_change_24h: '0.00',
      volume_24h: 0,
      price_history: []
    }));

    // Apply pagination
    const paginatedTokens = enrichedTokens.slice(offset, offset + limit);

    console.log(`✅ RETURNING ${paginatedTokens.length} tokens (page ${Math.floor(offset / limit) + 1})`);
    console.log('═══════════════════════════════════');

    const response = {
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
    };

    console.log('Response structure:', {
      success: response.success,
      tokensCount: response.tokens.length,
      total: response.total,
      verified: response.verified,
      discovered: response.discovered
    });

    return new Response(JSON.stringify(response), { 
      headers: corsHeaders() 
    });

  } catch (error) {
    console.error('═══════════════════════════════════');
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    console.error('═══════════════════════════════════');
    
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
