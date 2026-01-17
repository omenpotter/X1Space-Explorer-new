import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        const { query } = payload;

        if (!query) {
            return Response.json({
                error: {
                    code: 400,
                    message: 'Bad Request',
                    details: 'Parameter "query" is required',
                    timestamp: new Date().toISOString()
                }
            }, { status: 400 });
        }

        const aiResponse = await base44.integrations.Core.InvokeLLM({
            prompt: `You are an AI assistant for the X1 Blockchain Explorer. Your task is to interpret the user's query and determine the most relevant action.

User Query: "${query}"

Available actions:
1. "search_token" - If user wants to find a token by name or symbol
2. "get_token_details" - If user provides a specific token mint address (44-character base58 string)
3. "search_validator" - If user wants validator information
4. "get_network_stats" - If user asks about network health, TPS, current slot, epoch
5. "get_network_history" - If user asks for historical network data or trends
6. "clarify" - If the query is unclear or ambiguous

Extract parameters:
- For tokens: name, symbol, or mint address
- For validators: vote_account or identity_pubkey
- For network: metric type (tps, slot, epoch, health)
- For history: time range (hours)

Respond ONLY with a JSON object in this exact format:
{
  "action": "action_name",
  "parameters": {...},
  "confidence": 0.0-1.0
}

If you need clarification, use:
{
  "action": "clarify",
  "question": "What specific information are you looking for?"
}`,
            response_json_schema: {
                type: "object",
                properties: {
                    action: { type: "string" },
                    parameters: { type: "object" },
                    confidence: { type: "number" },
                    question: { type: "string" }
                },
                required: ["action"]
            }
        });

        return Response.json({
            query,
            interpretation: aiResponse,
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