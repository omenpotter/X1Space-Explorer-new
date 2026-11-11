import { enforceRateLimit, corsHeaders } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders() });
    }

    const limited = enforceRateLimit(req, 10);
    if (limited) return limited;

    // Anomaly detection previously compared live metrics against the network_stats
    // table in the app's Postgres database. That database has been decommissioned,
    // so there is no baseline to compare against.
    return Response.json({
        action: 'status',
        message: 'Network anomaly monitoring is not configured',
        timestamp: new Date().toISOString()
    });
});