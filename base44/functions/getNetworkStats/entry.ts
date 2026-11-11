Deno.serve(async () => {
    // Network stats were served from the network_stats table in the app's Postgres
    // database. That database has been decommissioned.
    return Response.json({
        error: {
            code: 503,
            message: 'No network stats available',
            details: 'Network stats data source is not configured',
            timestamp: new Date().toISOString()
        }
    }, { status: 503 });
});