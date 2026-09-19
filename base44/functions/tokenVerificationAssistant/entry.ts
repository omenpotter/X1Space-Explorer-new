import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { enforceRateLimit, corsHeaders } from '../../shared/rateLimit.ts';

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders() });
    }

    const limited = enforceRateLimit(req, 10);
    if (limited) return limited;

    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        const { action } = payload;

        if (!action) {
            return Response.json({
                error: {
                    code: 400,
                    message: 'Bad Request',
                    details: 'Parameter "action" is required',
                    timestamp: new Date().toISOString()
                }
            }, { status: 400 });
        }

        let result;

        if (action === 'analyze') {
            const { tokenMint, tokenDetails } = payload;
            if (!tokenMint) {
                return Response.json({
                    error: { code: 400, message: 'Bad Request', details: 'Parameter "tokenMint" is required', timestamp: new Date().toISOString() }
                }, { status: 400 });
            }

            const prompt = `Analyze this X1 blockchain token and provide a verification readiness assessment:

Token Details:
- Mint: ${tokenMint}
- Name: ${tokenDetails?.name || 'Unknown'}
- Symbol: ${tokenDetails?.symbol || 'Unknown'}
- Total Supply: ${tokenDetails?.total_supply || 0}
- Holders: ${tokenDetails?.holder_count || 0}
- Has Metadata: ${tokenDetails?.metadata ? 'Yes' : 'No'}

Provide:
1. Verification readiness score (0-100)
2. Missing requirements for verification
3. Potential red flags or concerns
4. Recommendations for improving chances of verification

Format as JSON with keys: readiness_score, missing_requirements (array), red_flags (array), recommendations (array)`;

            result = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt,
                response_json_schema: {
                    type: 'object',
                    properties: {
                        readiness_score: { type: 'number' },
                        missing_requirements: { type: 'array', items: { type: 'string' } },
                        red_flags: { type: 'array', items: { type: 'string' } },
                        recommendations: { type: 'array', items: { type: 'string' } }
                    }
                }
            });
        } else if (action === 'chat') {
            const { tokenMint, verificationForm, tokenAnalysis, userMessage } = payload;
            if (!userMessage) {
                return Response.json({
                    error: { code: 400, message: 'Bad Request', details: 'Parameter "userMessage" is required', timestamp: new Date().toISOString() }
                }, { status: 400 });
            }

            const prompt = `You are an AI assistant helping with X1Space token verification.
Current token: ${tokenMint || 'N/A'}
Verification form data: ${JSON.stringify(verificationForm || {})}
Previous analysis: ${JSON.stringify(tokenAnalysis || {})}

User query: ${userMessage}

Provide helpful, specific guidance on token verification. If they ask about documentation, explain what's needed (whitepaper, tokenomics, smart contract verification). If they need help formatting, provide templates. If they mention concerns, address them with factual information.`;

            const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt,
                add_context_from_internet: false
            });
            result = { response };
        } else if (action === 'generate') {
            const { verificationForm, tokenAnalysis } = payload;

            const prompt = `Generate a professional X1Space token verification request based on this information:

${JSON.stringify(verificationForm || {}, null, 2)}

Analysis: ${JSON.stringify(tokenAnalysis || {})}

Create a well-formatted verification request that includes:
1. Token overview
2. Project description
3. Team information (if available)
4. Tokenomics summary
5. Use case and utility
6. Community and social proof
7. Technical details
8. Roadmap (if applicable)

Make it professional, concise, and compelling. Format with markdown.`;

            const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt,
                add_context_from_internet: false
            });
            result = { response };
        } else {
            return Response.json({
                error: { code: 400, message: 'Bad Request', details: `Unknown action: ${action}`, timestamp: new Date().toISOString() }
            }, { status: 400 });
        }

        return Response.json({ result, timestamp: new Date().toISOString() });
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