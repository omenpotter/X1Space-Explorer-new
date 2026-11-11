import { enforceRateLimit, corsHeaders } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders() });
    }

    const limited = enforceRateLimit(req, 10);
    if (limited) return limited;

    let payload: Record<string, unknown> = {};
    try {
        payload = await req.json();
    } catch {
        payload = {};
    }

    const mint = payload?.mint;

    if (!mint || typeof mint !== 'string') {
        return Response.json({
            error: {
                code: 400,
                message: 'Bad Request',
                details: 'Parameter "mint" is required',
                timestamp: new Date().toISOString()
            }
        }, { status: 400 });
    }

    // Token analysis previously read the verified_tokens table from the app's
    // Postgres database. That database has been decommissioned, so no analysis
    // data source remains.
    return Response.json({
        error: {
            code: 503,
            message: 'Token analysis unavailable',
            details: 'Token analysis data source is not configured',
            timestamp: new Date().toISOString()
        }
    }, { status: 503 });
});