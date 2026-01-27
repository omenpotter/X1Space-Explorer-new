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
        
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 5000);
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const verifiedParam = url.searchParams.get('verified_only') || url.searchParams.get('verified');
        const verifiedOnly = verifiedParam === 'true';
        const tokenStandard = url.searchParams.get('token_standard');

        console.log('📊 Fetching tokens from database...');
        console.log(`Params: limit=${limit}, offset=${offset}, verified=${verifiedParam}, verifiedOnly=${verifiedOnly}`);

        // Connect to PostgreSQL
        const client = new Client({
            user: Deno.env.get('X1_DB_USER') || 'x1user',
            password: Deno.env.get('X1_DB_PASSWORD') || 'password123',
            host: Deno.env.get('X1_DB_HOST') || '45.94.81.202',
            database: Deno.env.get('X1_DB_NAME') || 'x1_explorer',
            port: 5432,
        });

        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✓ Database connected successfully');

        // Build query using the VERIFIED COLUMN
        let query = `
            SELECT 
                mint, name, symbol, decimals, total_supply, logo_uri,
                token_standard, created_by, created_at, first_verified_at,
                last_verified_at, verification_count, is_scam, scam_report_count,
                website, twitter, telegram, discord, description, metadata_uri,
                price, market_cap, price_updated_at, price_change_24h, verified
            FROM verified_tokens 
            WHERE total_supply > 0
        `;
        
        const params = [];
        let paramCount = 1;

        // Use the verified column instead of name/symbol checks
        if (verifiedOnly) {
            query += ` AND verified = true`;
        }

        if (tokenStandard) {
            query += ` AND token_standard = $${paramCount}`;
            params.push(tokenStandard);
            paramCount++;
        }

        // Order by verified first, then by supply
        query += ` ORDER BY verified DESC, total_supply DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(limit, offset);

        console.log('🔍 Executing query...');
        const result = await client.query(query, params);
        console.log(`✓ Found ${result.rows.length} tokens`);

        // Get counts using the verified column
        const verifiedCountResult = await client.query(`
            SELECT COUNT(*) FROM verified_tokens 
            WHERE total_supply > 0 AND verified = true
        `);
        const verifiedCount = parseInt(verifiedCountResult.rows[0].count);

        const discoveredCountResult = await client.query(`
            SELECT COUNT(*) FROM verified_tokens 
            WHERE total_supply > 0 AND verified = false
        `);
        const discoveredCount = parseInt(discoveredCountResult.rows[0].count);

        // Count total with filters
        let countQuery = 'SELECT COUNT(*) FROM verified_tokens WHERE total_supply > 0';
        
        if (verifiedOnly) {
            countQuery += ` AND verified = true`;
        }
        
        if (tokenStandard) {
            countQuery += ` AND token_standard = '${tokenStandard}'`;
        }
        
        console.log('🔢 Counting total tokens...');
        const countResult = await client.query(countQuery);
        const total = parseInt(countResult.rows[0].count);
        console.log(`✅ Total: ${total}, Verified: ${verifiedCount}, Discovered: ${discoveredCount}`);

        await client.end();
        console.log('✓ Database connection closed');

        // Format response - Include verified field
        const tokens = result.rows.map(row => ({
            mint: row.mint,
            name: row.name || 'Unknown Token',
            symbol: row.symbol || 'UNKNOWN',
            logo_uri: row.logo_uri,
            decimals: parseInt(row.decimals) || 9,
            total_supply: parseFloat(row.total_supply) || 0,
            totalSupply: parseFloat(row.total_supply) || 0,
            price: parseFloat(row.price) || 0,
            market_cap: parseFloat(row.market_cap) || 0,
            price_updated_at: row.price_updated_at,
            token_type: row.token_standard || 'SPL Token',
            token_standard: row.token_standard,
            created_by: row.created_by,
            created_at: row.created_at,
            first_verified_at: row.first_verified_at,
            last_verified_at: row.last_verified_at,
            verification_count: parseInt(row.verification_count) || 0,
            verified: row.verified || false, // ✅ INCLUDE VERIFIED FIELD
            is_scam: row.is_scam || false,
            scam_report_count: parseInt(row.scam_report_count) || 0,
            website: row.website,
            twitter: row.twitter,
            telegram: row.telegram,
            discord: row.discord,
            description: row.description,
            metadata_uri: row.metadata_uri,
            price_change_24h: parseFloat(row.price_change_24h) || 0,
            mint_authority: null,
            freeze_authority: null,
            price_history: []
        }));

        console.log('✅ Returning', tokens.length, 'tokens');

        return new Response(JSON.stringify({
            success: true,
            tokens,
            total,
            verified: verifiedCount,
            discovered: discoveredCount,
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
