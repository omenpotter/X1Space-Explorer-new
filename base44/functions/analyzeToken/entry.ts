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

        const tokenResult = await client.query(
            'SELECT * FROM verified_tokens WHERE mint = $1',
            [mint]
        );

        await client.end();

        if (tokenResult.rows.length === 0) {
            return Response.json({
                error: {
                    code: 404,
                    message: 'Token not found',
                    details: `Token with mint "${mint}" not found`,
                    timestamp: new Date().toISOString()
                }
            }, { status: 404 });
        }

        const token = tokenResult.rows[0];

        const aiAnalysis = await base44.integrations.Core.InvokeLLM({
            prompt: `Analyze this X1 blockchain token and provide a health score and risk assessment:

Token Data:
- Mint: ${token.mint}
- Name: ${token.name || 'Unknown'}
- Symbol: ${token.symbol || 'Unknown'}
- Decimals: ${token.decimals}
- Token Standard: ${token.token_standard}
- Verification Count: ${token.verification_count || 0}
- Created: ${token.created_at}
- Metadata URI: ${token.metadata_uri ? 'Available' : 'Missing'}

Based on this data, assign:
1. Health Score (1-10, where 10 is excellent)
2. Risk Level (Low, Medium, or High)
3. Key factors (3-5 bullet points)

Consider:
- Metadata completeness (name, symbol, URI)
- Token standard (Token-2022 is newer/more advanced)
- Verification status
- Age of the token

Respond with a JSON object.`,
            add_context_from_internet: true,
            response_json_schema: {
                type: "object",
                properties: {
                    health_score: { type: "number" },
                    risk_level: { type: "string" },
                    summary: { 
                        type: "array",
                        items: { type: "string" }
                    }
                },
                required: ["health_score", "risk_level", "summary"]
            }
        });

        return Response.json({
            token: {
                mint: token.mint,
                name: token.name,
                symbol: token.symbol
            },
            analysis: aiAnalysis,
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