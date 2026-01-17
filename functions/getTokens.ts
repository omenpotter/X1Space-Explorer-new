import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import pg from 'npm:pg';

const { Client } = pg;

Deno.serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }

    try {
        const url = new URL(req.url);
        
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 500);
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const verifiedOnly = url.searchParams.get('verified_only') === 'true';
        const tokenStandard = url.searchParams.get('token_standard');

        console.log('📊 Fetching tokens from database...');
        console.log(`Params: limit=${limit}, offset=${offset}, verifiedOnly=${verifiedOnly}`);

        // Connect to PostgreSQL
        const client = new Client({
            user: Deno.env.get('X1_DB_USER'),
            password: Deno.env.get('X1_DB_PASSWORD'),
            host: Deno.env.get('X1_DB_HOST'),
            database: Deno.env.get('X1_DB_NAME'),
            port: parseInt(Deno.env.get('X1_DB_PORT') || '5432'),
        });

        await client.connect();
        console.log('✓ Database connected');

        // Build query
        let query = `
            SELECT 
                mint,
                name,
                symbol,
                decimals,
                total_supply,
                logo_uri,
                token_standard as token_type,
                mint_authority,
                freeze_authority,
                first_verified_at as created_at,
                website,
                twitter,
                telegram,
                discord,
                description,
                metadata
            FROM verified_tokens 
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 1;

        if (verifiedOnly) {
            query += ` AND name IS NOT NULL AND symbol IS NOT NULL`;
        }

        if (tokenStandard) {
            query += ` AND token_standard = $${paramCount}`;
            params.push(tokenStandard);
            paramCount++;
        }

        query += ` ORDER BY first_verified_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(limit, offset);

        console.log('🔍 Executing query:', query);
        const result = await client.query(query, params);
        console.log(`✓ Found ${result.rows.length} tokens`);

        // Count total
        const countQuery = 'SELECT COUNT(*) FROM verified_tokens WHERE 1=1' + 
            (verifiedOnly ? ' AND name IS NOT NULL AND symbol IS NOT NULL' : '') +
            (tokenStandard ? ` AND token_standard = '${tokenStandard}'` : '');
        
        const countResult = await client.query(countQuery);
        const total = parseInt(countResult.rows[0].count);

        await client.end();

        // Format response
        const tokens = result.rows.map(row => ({
            mint: row.mint,
            name: row.name || 'Unknown Token',
            symbol: row.symbol || 'UNKNOWN',
            logo_uri: row.logo_uri,
            decimals: row.decimals || 9,
            total_supply: row.total_supply || 0,
            token_type: row.token_type || 'SPL Token',
            mint_authority: row.mint_authority,
            freeze_authority: row.freeze_authority,
            created_at: row.created_at,
            website: row.website,
            twitter: row.twitter,
            telegram: row.telegram,
            discord: row.discord,
            description: row.description,
            // Add default values for UI
            price: '0.0000',
            market_cap: 0,
            price_change_24h: '0.00',
            verification_count: 1, // Mark as verified
            is_scam: false,
            price_history: []
        }));

        return new Response(JSON.stringify({
            success: true,
            tokens,
            total,
            page: Math.floor(offset / limit) + 1,
            limit,
            offset
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });

    } catch (error) {
        console.error('❌ Database error:', error);
        
        return new Response(JSON.stringify({
            success: false,
            error: {
                code: 500,
                message: 'Database query failed',
                details: error.message,
                timestamp: new Date().toISOString()
            }
        }), { 
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            }
        });
    }
});
