// Rate limiting backed by the shared store (persistent where the platform supports it).
import type { KVStore } from './store.ts';

export interface LimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * The client address as set by the platform edge. `x-forwarded-for` is deliberately
 * ignored because callers can spoof it to dodge limits.
 */
export function getClientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') || 'unknown';
}

/** Fixed-window limiter. Counter keys include the window index so they expire naturally. */
export async function rateLimit(
  store: KVStore,
  scope: string,
  id: string,
  limit: number,
  windowMs = 60_000,
  now: () => number = Date.now,
): Promise<LimitResult> {
  const t = now();
  const window = Math.floor(t / windowMs);
  const count = await store.incr(`rl:${scope}:${id}:${window}`, windowMs * 2);
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt: (window + 1) * windowMs,
  };
}

/**
 * Per-IP limit for anonymous endpoints. When the platform does not supply a client
 * address, every caller shares the "unknown" bucket, so that bucket gets a larger
 * allowance: it still bounds total load without letting one caller lock everyone out.
 */
export function limitByIp(
  store: KVStore,
  scope: string,
  req: Request,
  perMinute: number,
  now: () => number = Date.now,
): Promise<LimitResult> {
  const ip = getClientIp(req);
  const limit = ip === 'unknown' ? perMinute * 20 : perMinute;
  return rateLimit(store, scope, ip, limit, 60_000, now);
}
