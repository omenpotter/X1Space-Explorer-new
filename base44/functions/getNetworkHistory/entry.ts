Deno.serve(async (req) => {
    const url = new URL(req.url);

    const hours = Math.min(parseInt(url.searchParams.get('hours') || '24'), 168);
    const interval = url.searchParams.get('interval') || '5m';

    // History was aggregated from the network_stats table in the app's Postgres
    // database. That database has been decommissioned, so no history is returned.
    return Response.json({
        data: [],
        hours,
        interval
    });
});