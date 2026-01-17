import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import pg from 'npm:pg';

const { Client } = pg;

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const client = new Client({
            user: Deno.env.get('X1_DB_USER'),
            password: Deno.env.get('X1_DB_PASSWORD'),
            host: Deno.env.get('X1_DB_HOST'),
            database: Deno.env.get('X1_DB_NAME'),
            port: 5432,
        });

        await client.connect();

        const currentResult = await client.query(
            'SELECT * FROM network_stats ORDER BY timestamp DESC LIMIT 1'
        );

        const hourAgoResult = await client.query(
            `SELECT AVG(tps)::numeric(10,2) as avg_tps,
                    AVG(slot_height)::bigint as avg_slot,
                    AVG(epoch_progress)::numeric(5,2) as avg_epoch_progress
             FROM network_stats 
             WHERE timestamp >= NOW() - INTERVAL '1 hour'`
        );

        const dayAgoResult = await client.query(
            `SELECT AVG(tps)::numeric(10,2) as avg_tps,
                    AVG(slot_height)::bigint as avg_slot,
                    AVG(epoch_progress)::numeric(5,2) as avg_epoch_progress
             FROM network_stats 
             WHERE timestamp >= NOW() - INTERVAL '24 hours'`
        );

        await client.end();

        if (currentResult.rows.length === 0) {
            return Response.json({
                action: 'status',
                message: 'No network data available',
                timestamp: new Date().toISOString()
            });
        }

        const current = currentResult.rows[0];
        const hourAvg = hourAgoResult.rows[0];
        const dayAvg = dayAgoResult.rows[0];

        const aiAnalysis = await base44.integrations.Core.InvokeLLM({
            prompt: `Examine the X1 network statistics and identify any significant anomalies:

Current Stats:
- TPS: ${current.tps}
- Slot Height: ${current.slot_height}
- Epoch Progress: ${current.epoch_progress}%

1-Hour Average:
- TPS: ${hourAvg.avg_tps}
- Slot Height: ${hourAvg.avg_slot}
- Epoch Progress: ${hourAvg.avg_epoch_progress}%

24-Hour Average:
- TPS: ${dayAvg.avg_tps}
- Slot Height: ${dayAvg.avg_slot}
- Epoch Progress: ${dayAvg.avg_epoch_progress}%

A significant deviation is >20% change from the average.

If an anomaly is detected, respond with:
{
  "action": "alert",
  "type": "network_anomaly",
  "metric": "TPS|Slot|Epoch",
  "deviation": "-30%",
  "cause": "Potential explanation",
  "severity": "Low|Medium|High"
}

If no anomaly:
{
  "action": "status",
  "message": "Network operating within normal parameters"
}`,
            response_json_schema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    type: { type: "string" },
                    metric: { type: "string" },
                    deviation: { type: "string" },
                    cause: { type: "string" },
                    severity: { type: "string" },
                    message: { type: "string" }
                },
                required: ["action"]
            }
        });

        return Response.json({
            ...aiAnalysis,
            current_stats: current,
            timestamp: new Date().toISOString()
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