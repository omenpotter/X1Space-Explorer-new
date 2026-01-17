import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import pg from 'npm:pg';

const { Client } = pg;

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const url = new URL(req.url);
        
        const hours = Math.min(parseInt(url.searchParams.get('hours') || '24'), 168);
        const interval = url.searchParams.get('interval') || '5m';

        const client = new Client({
            user: Deno.env.get('X1_DB_USER'),
            password: Deno.env.get('X1_DB_PASSWORD'),
            host: Deno.env.get('X1_DB_HOST'),
            database: Deno.env.get('X1_DB_NAME'),
            port: 5432,
        });

        await client.connect();

        const intervalMap = {
            '5m': '5 minutes',
            '15m': '15 minutes',
            '1h': '1 hour',
            '6h': '6 hours',
            '1d': '1 day'
        };

        const pgInterval = intervalMap[interval] || '5 minutes';

        const result = await client.query(
            `SELECT 
                date_trunc('${interval === '5m' ? 'minute' : 'hour'}', timestamp) as time,
                AVG(tps)::numeric(10,2) as avg_tps,
                MAX(tps) as max_tps,
                AVG(slot_height)::bigint as avg_slot,
                AVG(epoch_progress)::numeric(5,2) as avg_epoch_progress
             FROM network_stats
             WHERE timestamp >= NOW() - INTERVAL '${hours} hours'
             GROUP BY time
             ORDER BY time DESC`
        );

        await client.end();

        return Response.json({
            data: result.rows,
            hours,
            interval
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