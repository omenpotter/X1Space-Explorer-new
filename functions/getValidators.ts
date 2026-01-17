import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import pg from 'npm:pg';

const { Client } = pg;

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const url = new URL(req.url);
        
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
        const offset = parseInt(url.searchParams.get('offset') || '0');

        const client = new Client({
            user: Deno.env.get('X1_DB_USER'),
            password: Deno.env.get('X1_DB_PASSWORD'),
            host: Deno.env.get('X1_DB_HOST'),
            database: Deno.env.get('X1_DB_NAME'),
            port: 5432,
        });

        await client.connect();

        const result = await client.query(
            `SELECT * FROM validator_leaderboard 
             ORDER BY rank ASC 
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        const countResult = await client.query('SELECT COUNT(*) FROM validator_leaderboard');

        await client.end();

        return Response.json({
            validators: result.rows,
            total: parseInt(countResult.rows[0].count),
            updated_at: new Date().toISOString()
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