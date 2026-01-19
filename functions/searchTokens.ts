import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import pg from 'npm:pg';

const { Client } = pg;

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const url = new URL(req.url);
        
        const name = url.searchParams.get('name');
        const symbol = url.searchParams.get('symbol');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

        if (!name && !symbol) {
            return Response.json({
                error: {
                    code: 400,
                    message: 'Bad Request',
                    details: 'At least one search parameter (name or symbol) is required',
                    timestamp: new Date().toISOString()
                }
            }, { status: 400 });
        }

        const client = new Client({
            user: Deno.env.get('X1_DB_USER'),
            password: Deno.env.get('X1_DB_PASSWORD'),
            host: Deno.env.get('X1_DB_HOST'),
            database: Deno.env.get('X1_DB_NAME'),
            port: 5432,
        });

        await client.connect();

        // Filter tokens with supply > 0
        let query = 'SELECT * FROM verified_tokens WHERE total_supply > 0 AND (';
        const params = [];
        const conditions = [];
        let paramCount = 1;

        if (name) {
            conditions.push(`name ILIKE $${paramCount}`);
            params.push(`%${name}%`);
            paramCount++;
        }

        if (symbol) {
            conditions.push(`symbol ILIKE $${paramCount}`);
            params.push(`%${symbol}%`);
            paramCount++;
        }

        query += conditions.join(' OR ');
        query += `) ORDER BY total_supply DESC LIMIT $${paramCount}`;
        params.push(limit);

        const result = await client.query(query, params);

        await client.end();

        // Format results - Convert types
        const formattedResults = result.rows.map(token => ({
            ...token,
            decimals: parseInt(token.decimals) || 9,
            total_supply: parseFloat(token.total_supply) || 0,
            totalSupply: parseFloat(token.total_supply) || 0,
            verification_count: parseInt(token.verification_count) || 0,
            scam_report_count: parseInt(token.scam_report_count) || 0,
            is_scam: token.is_scam || false
        }));

        return Response.json({
            results: formattedResults,
            count: formattedResults.length,
            query: { name, symbol }
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
