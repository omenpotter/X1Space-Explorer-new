import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import pg from 'npm:pg';

const { Client } = pg;

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const url = new URL(req.url);
        
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const verifiedOnly = url.searchParams.get('verified_only') === 'true';
        const tokenStandard = url.searchParams.get('token_standard');

        const client = new Client({
            user: Deno.env.get('X1_DB_USER'),
            password: Deno.env.get('X1_DB_PASSWORD'),
            host: Deno.env.get('X1_DB_HOST'),
            database: Deno.env.get('X1_DB_NAME'),
            port: 5432,
        });

        await client.connect();

        let query = 'SELECT * FROM verified_tokens WHERE 1=1';
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

        const result = await client.query(query, params);

        const countQuery = 'SELECT COUNT(*) FROM verified_tokens WHERE 1=1' + 
            (verifiedOnly ? ' AND name IS NOT NULL AND symbol IS NOT NULL' : '') +
            (tokenStandard ? ` AND token_standard = '${tokenStandard}'` : '');
        const countResult = await client.query(countQuery);

        await client.end();

        return Response.json({
            tokens: result.rows,
            total: parseInt(countResult.rows[0].count),
            page: Math.floor(offset / limit) + 1,
            limit,
            offset
        });

    } catch (error) {
        return Response.json({
            error: {
                code: 500,
                message: 'Internal server error',
                details: error.message,
                timestamp: new Date().toISOString()
            }
        }, { status: 500 });
    }
});