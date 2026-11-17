// HTTP helpers: CORS, JSON responses, safe errors, bounded body reads.
import { env } from './env.ts';
import type { LimitResult } from './rateLimit.ts';

const DEFAULT_ORIGINS = ['https://x1space.xyz', 'https://www.x1space.xyz'];

function originAllowed(origin: string): boolean {
  const extra = (env('ALLOWED_ORIGINS') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (DEFAULT_ORIGINS.includes(origin) || extra.includes(origin)) return true;
  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    return false;
  }
  if (u.protocol === 'https:' && (u.hostname === 'base44.app' || u.hostname.endsWith('.base44.app'))) return true;
  if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
  return false;
}

/**
 * CORS headers. Only known site origins are echoed back; other origins get no
 * Access-Control-Allow-Origin header, so browsers on other sites cannot read responses.
 * (CORS is not access control: server-to-server callers are bounded by rate limits instead.)
 */
export function corsHeaders(req: Request, methods = 'GET, OPTIONS'): Record<string, string> {
  const h: Record<string, string> = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
  };
  const origin = req.headers.get('origin');
  if (origin && originAllowed(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export function json(
  req: Request,
  body: unknown,
  init: { status?: number; cacheSeconds?: number; methods?: string; headers?: Record<string, string> } = {},
): Response {
  const headers: Record<string, string> = {
    ...BASE_HEADERS,
    ...corsHeaders(req, init.methods),
    'Cache-Control': init.cacheSeconds ? `public, max-age=${init.cacheSeconds}` : 'no-store',
    ...(init.headers || {}),
  };
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

const MESSAGES: Record<number, string> = {
  400: 'Bad request',
  401: 'Sign in required',
  403: 'Not allowed',
  404: 'Not found',
  405: 'Method not allowed',
  413: 'Request too large',
  429: 'Too many requests',
  500: 'Internal error',
  502: 'Upstream data source failed',
  503: 'Service unavailable',
};

/** Error responses carry a stable code and a short message only: never stack traces or upstream bodies. */
export function fail(
  req: Request,
  status: number,
  code: string,
  detail?: string,
  init: { methods?: string; headers?: Record<string, string> } = {},
): Response {
  return json(req, {
    success: false,
    error: { status, code, message: detail || MESSAGES[status] || 'Error' },
    timestamp: new Date().toISOString(),
  }, { status, ...init });
}

export function tooMany(req: Request, r: LimitResult, methods?: string): Response {
  const retry = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000));
  return fail(req, 429, 'rate_limited', 'Too many requests. Try again shortly.', {
    methods,
    headers: { 'Retry-After': String(retry) },
  });
}

export function preflight(req: Request, methods = 'GET, OPTIONS'): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req, methods) });
}

export class BodyError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

/** Read a JSON object body with a hard byte cap. Rejects non-objects. */
export async function readJsonBody(req: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get('content-length') || '0');
  if (declared > maxBytes) throw new BodyError(413, 'body_too_large');
  let text = '';
  if (req.body) {
    const reader = req.body.getReader();
    const decoder = new TextDecoder();
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch { /* ignore */ }
        throw new BodyError(413, 'body_too_large');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  }
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new BodyError(400, 'invalid_json');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new BodyError(400, 'invalid_json');
  return parsed as Record<string, unknown>;
}

/** Log an internal failure without request data, secrets or upstream bodies. */
export function logError(scope: string, err: unknown): void {
  const e = err as any;
  const kind = e?.name || 'Error';
  const status = typeof e?.status === 'number' ? ` status=${e.status}` : '';
  console.error(`[${scope}] ${kind}${status}`);
}

const logged = new Set<string>();

/**
 * Log a fixed diagnostic line once per instance, for example which storage backend a limiter ended up using.
 * Only constant words go in `msg`: never request data, identifiers or secrets.
 */
export function logOnce(scope: string, msg: string): void {
  const line = `[${scope}] ${msg}`;
  if (logged.has(line)) return;
  logged.add(line);
  console.error(line);
}
