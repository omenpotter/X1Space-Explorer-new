import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import pg from 'npm:pg';

const { Client } = pg;

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        const { mint } = payload;

        if (!mint) {
            return Response.json({
                error: {
                    code: 400,
                    message: 'Bad Request',
                    details: 'Parameter "mint" is required',
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

        const result = await client.query(
            'SELECT * FROM verified_tokens WHERE mint = $1',
            [mint]
        );

        await client.end();

        if (result.rows.length === 0) {
            return Response.json({
                error: {
                    code: 404,
                    message: 'Token not found',
                    details: `Token with mint "${mint}" not found in database`,
                    timestamp: new Date().toISOString()
                }
            }, { status: 404 });
        }

        return Response.json(result.rows[0]);

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