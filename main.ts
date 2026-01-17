import pg from 'npm:pg';
const { Client } = pg;

// Database connection helper
async function getDbClient() {
  const client = new Client({
    user: Deno.env.get('X1_DB_USER') || 'x1user',
    password: Deno.env.get('X1_DB_PASSWORD') || 'password123',
    host: Deno.env.get('X1_DB_HOST') || '45.94.81.202',
    database: Deno.env.get('X1_DB_NAME') || 'x1_explorer',
    port: 5432,
  });
  await client.connect();
  return client;
}

// Handle CORS
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
  const path = url.pathname;

  try {
    // Route: GET /api/getTokens
    if (path === '/api/getTokens') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 500);
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const verifiedOnly = url.searchParams.get('verified_only') === 'true';

      const client = await getDbClient();

      let query = `
        SELECT 
          mint, name, symbol, decimals, total_supply, logo_uri,
          token_standard, created_by, created_at, first_verified_at,
          last_verified_at, verification_count, is_scam, scam_report_count,
          website, twitter, telegram, discord, description, metadata_uri
        FROM verified_tokens 
        WHERE 1=1
      `;

      const params = [];
      let paramCount = 1;

      if (verifiedOnly) {
        query += ` AND name != 'Unknown Token' AND symbol != 'UNKNOWN'`;
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);

      const result = await client.query(query, params);

      const countQuery = 'SELECT COUNT(*) FROM verified_tokens WHERE 1=1' + 
        (verifiedOnly ? ` AND name != 'Unknown Token' AND symbol != 'UNKNOWN'` : '');
      const countResult = await client.query(countQuery);

      await client.end();

      const tokens = result.rows.map(row => ({
        ...row,
        token_type: row.token_standard || 'SPL Token',
        price: '0.0000',
        market_cap: 0,
        price_change_24h: '0.00',
        price_history: []
      }));

      return new Response(JSON.stringify({
        success: true,
        tokens,
        total: parseInt(countResult.rows[0].count),
        page: Math.floor(offset / limit) + 1,
        limit,
        offset
      }), { headers: corsHeaders() });
    }

    // Health check
    if (path === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString()
      }), { headers: corsHeaders() });
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({
      error: 'Not found',
      path
    }), { 
      status: 404,
      headers: corsHeaders()
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    }), {
      status: 500,
      headers: corsHeaders()
    });
  }
});
