import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import pg from 'npm:pg';

const { Client } = pg;

Deno.serve(async (req) => {
    // Handle CORS preflight
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

        /// Connect to PostgreSQL - Using environment variables
       const client = new Client({
    user: Deno.env.get('X1_DB_USER') || 'x1user',
    password: Deno.env.get('X1_DB_PASSWORD') || 'password123',
    host: Deno.env.get('X1_DB_HOST') || '45.94.81.202',
    database: Deno.env.get('X1_DB_NAME') || 'x1_explorer',
    port: 5432,
});

        console.log('🔌 Connecting to database...');
        console.log('Host: 127.0.0.1, Database: x1_explorer, User: x1user');

        await client.connect();
        console.log('✓ Database connected successfully');

        // Build query - matches your exact schema
        let query = `
            SELECT 
                mint,
                name,
                symbol,
                decimals,
                total_supply,
                logo_uri,
                token_standard,
                created_by,
                created_at,
                first_verified_at,
                last_verified_at,
                verification_count,
                is_scam,
                scam_report_count,
                website,
                twitter,
                telegram,
                discord,
                description,
                metadata_uri
            FROM verified_tokens 
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 1;

        // Only show tokens with actual names (not "Unknown Token")
        if (verifiedOnly) {
            query += ` AND name != 'Unknown Token' AND symbol != 'UNKNOWN'`;
        }

        if (tokenStandard) {
            query += ` AND token_standard = $${paramCount}`;
            params.push(tokenStandard);
            paramCount++;
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(limit, offset);

        console.log('🔍 Executing query...');
        const result = await client.query(query, params);
        console.log(`✓ Found ${result.rows.length} tokens`);

        // Count total
        let countQuery = 'SELECT COUNT(*) FROM verified_tokens WHERE 1=1';
        
        if (verifiedOnly) {
            countQuery += ` AND name != 'Unknown Token' AND symbol != 'UNKNOWN'`;
        }
        
        if (tokenStandard) {
            countQuery += ` AND token_standard = '${tokenStandard}'`;
        }
        
        console.log('🔢 Counting total tokens...');
        const countResult = await client.query(countQuery);
        const total = parseInt(countResult.rows[0].count);
        console.log(`✓ Total tokens: ${total}`);

        await client.end();
        console.log('✓ Database connection closed');

        // Format response
        const tokens = result.rows.map(row => ({
            mint: row.mint,
            name: row.name || 'Unknown Token',
            symbol: row.symbol || 'UNKNOWN',
            logo_uri: row.logo_uri,
            decimals: row.decimals || 9,
            total_supply: row.total_supply || 0,
            token_type: row.token_standard || 'SPL Token',
            token_standard: row.token_standard,
            created_by: row.created_by,
            created_at: row.created_at,
            first_verified_at: row.first_verified_at,
            last_verified_at: row.last_verified_at,
            verification_count: row.verification_count || 0,
            is_scam: row.is_scam || false,
            scam_report_count: row.scam_report_count || 0,
            website: row.website,
            twitter: row.twitter,
            telegram: row.telegram,
            discord: row.discord,
            description: row.description,
            metadata_uri: row.metadata_uri,
            // Add default values for UI
            price: '0.0000',
            market_cap: 0,
            price_change_24h: '0.00',
            mint_authority: null,
            freeze_authority: null,
            price_history: []
        }));

        console.log('✅ Returning response with', tokens.length, 'tokens');

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
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
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
