Deno.serve(async () => {
    // The validator leaderboard was served from the validator_leaderboard table in
    // the app's Postgres database. That database has been decommissioned. Live
    // validator data is served by the X1 RPC endpoints instead.
    return Response.json({
        validators: [],
        total: 0,
        updated_at: new Date().toISOString()
    });
});