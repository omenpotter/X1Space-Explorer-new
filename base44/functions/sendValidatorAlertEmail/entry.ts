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
        const { to, validatorName, alertType, message, timestamp } = await req.json();

        if (!to || !validatorName || !message) {
            return Response.json({
                error: {
                    code: 400,
                    message: 'Bad Request',
                    details: 'Parameters "to", "validatorName", and "message" are required',
                    timestamp: new Date().toISOString()
                }
            }, { status: 400 });
        }

        await base44.asServiceRole.integrations.Core.SendEmail({
            to,
            subject: `X1 Alert: ${validatorName}`,
            body: `
Alert Type: ${alertType}
Validator: ${validatorName}
Message: ${message}
Time: ${timestamp ? new Date(timestamp).toLocaleString() : new Date().toLocaleString()}

View details at X1.space
            `
        });

        return Response.json({ success: true, timestamp: new Date().toISOString() });
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