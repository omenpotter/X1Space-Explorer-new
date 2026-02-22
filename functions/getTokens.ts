// functions/getTokens.ts
// Extract tokens with PRICES from XDEX pools - WITH API KEY

const XDEX_API = 'https://api.xdex.xyz';
const NETWORK = 'X1%20Mainnet';
const XDEX_API_KEY = Deno.env.get('XDEX_API_KEY'); // Get from Base44 env vars

// Rate limiting - in-memory store
const rateLimits = new Map();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip) || { count: 0, reset: now + 60000 };
  
  // Reset if time window passed
  if (now > limit.reset) {
    limit.count = 0;
    limit.reset = now + 60000;
  }
  
  limit.count++;
  rateLimits.set(ip, limit);
  
  // 100 requests per minute per IP
  return limit.count <= 100;
}

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

  // Rate limiting check
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
             req.headers.get('cf-connecting-ip') || 
             'unknown';
  
  if (!checkRateLimit(ip)) {
    console.warn(`⚠️ Rate limit exceeded for IP: ${ip}`);
    return new Response(JSON.stringify({
      success: false,
      error: {
        code: 429,
        message: 'Rate limit exceeded. Please try again in a minute.',
        timestamp: new Date().toISOString()
      },
      tokens: [],
      total: 0,
      verified: 0,
      discovered: 0
    }), { 
      status: 429,
      headers: corsHeaders()
    });
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '500'), 1000);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const verifiedOnly = url.searchParams.get('verified_only') === 'true';

  try {
    console.log('📊 Fetching tokens from XDEX API...');
    
    // Build headers with API key if available
    const headers: Record<string, string> = {
      'User-Agent': 'X1Space-Explorer/1.0',
      'Accept': 'application/json'
    };
    
    // Add API key if configured
    if (XDEX_API_KEY) {
      headers['X-API-Key'] = XDEX_API_KEY;
      console.log('✓ Using XDEX API Key');
    } else {
      console.warn('⚠️ No XDEX_API_KEY found in environment variables');
    }

    // Fetch pools from XDEX
    const poolsRes = await fetch(
      `${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`,
      { 
        headers,
        signal: AbortSignal.timeout(15000) 
      }
    );

    if (!poolsRes.ok) {
      throw new Error(`XDEX API error: ${poolsRes.status} ${poolsRes.statusText}`);
    }

    const poolsData = await poolsRes.json();
    
    if (!poolsData.success || !Array.isArray(poolsData.data)) {
      throw new Error('Invalid XDEX API response format');
    }

    const pools = poolsData.data;
    console.log(`✓ Fetched ${pools.length} pools from XDEX`);

    // Extract unique tokens with PRICES
    const tokenMap = new Map();
    
    pools.forEach((pool) => {
      // Token 1
      const token1Mint = pool.token1_address;
      const token1Symbol = pool.token1_symbol;
      const token1Logo = pool.token1_logo;
      const token1Price = pool.token1_price || 0;
      
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
          liquidity: pool.tvl || 0,
          price: token1Price
        });
      } else if (token1Mint) {
        const token = tokenMap.get(token1Mint);
        token.pool_count = (token.pool_count || 0) + 1;
        token.liquidity = (token.liquidity || 0) + (pool.tvl || 0);
        if (token1Price > 0 && token.price === 0) {
          token.price = token1Price;
        }
      }
      
      // Token 2
      const token2Mint = pool.token2_address;
      const token2Symbol = pool.token2_symbol;
      const token2Logo = pool.token2_logo;
      const token2Price = pool.token2_price || 0;
      
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
          liquidity: pool.tvl || 0,
          price: token2Price
        });
      } else if (token2Mint) {
        const token = tokenMap.get(token2Mint);
        token.pool_count = (token.pool_count || 0) + 1;
        token.liquidity = (token.liquidity || 0) + (pool.tvl || 0);
        if (token2Price > 0 && token.price === 0) {
          token.price = token2Price;
        }
      }
    });

    let tokens = Array.from(tokenMap.values());
    console.log(`✓ Extracted ${tokens.length} unique tokens`);

    // Filter verified only if requested
    const verifiedCount = tokens.filter(t => t.verified).length;
    const discoveredCount = tokens.length - verifiedCount;
    
    if (verifiedOnly) {
      tokens = tokens.filter(t => t.verified);
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
      price: token.price ? token.price.toString() : '0.0000',
      market_cap: 0,
      price_change_24h: '0.00',
      volume_24h: 0,
      created_at: new Date().toISOString(),
      first_verified_at: token.verified ? new Date().toISOString() : null,
      last_verified_at: token.verified ? new Date().toISOString() : null,
      price_history: []
    }));

    // Apply pagination
    const paginatedTokens = enrichedTokens.slice(offset, offset + limit);

    console.log(`✅ Returning ${paginatedTokens.length} tokens (total: ${enrichedTokens.length})`);

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

    return new Response(JSON.stringify(response), { 
      headers: corsHeaders() 
    });

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    
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
