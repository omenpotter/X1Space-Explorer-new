// Shared rate-limiting and CORS helpers for backend functions.
// Used by LLM-invoking functions to prevent anonymous credit abuse.

const rateLimits = new Map<string, { count: number; reset: number }>();

export function checkRateLimit(ip: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip) || { count: 0, reset: now + windowMs };

  if (now > limit.reset) {
    limit.count = 0;
    limit.reset = now + windowMs;
  }

  limit.count++;
  rateLimits.set(ip, limit);

  return limit.count <= maxRequests;
}

export function getClientIp(req: Request): string {
  // cf-connecting-ip is set by the platform/Cloudflare and is not client-controllable.
  // Do NOT trust x-forwarded-for for rate-limit keying — callers can spoof it to bypass limits.
  return (
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

export function rateLimitedResponse(): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: 429,
        message: 'Rate limit exceeded. Please try again in a minute.',
        timestamp: new Date().toISOString(),
      },
    }),
    { status: 429, headers: corsHeaders() }
  );
}

// Enforce rate limiting for a request. Returns null if allowed, or a 429 Response if exceeded.
export function enforceRateLimit(req: Request, maxRequests = 10): Response | null {
  if (req.method === 'OPTIONS') return null;
  const ip = getClientIp(req);
  if (!checkRateLimit(ip, maxRequests)) {
    console.warn(`⚠️ Rate limit exceeded for IP: ${ip}`);
    return rateLimitedResponse();
  }
  return null;
}