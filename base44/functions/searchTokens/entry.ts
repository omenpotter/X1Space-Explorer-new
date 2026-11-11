Deno.serve(async (req) => {
    const url = new URL(req.url);

    const name = url.searchParams.get('name');
    const symbol = url.searchParams.get('symbol');

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

    // Token search previously queried the verified_tokens table in the app's
    // Postgres database. That database has been decommissioned.
    return Response.json({
        results: [],
        count: 0,
        query: { name, symbol }
    });
});