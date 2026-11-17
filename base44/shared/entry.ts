// Binds a request handler to the Base44 backend runtime (Cloudflare Workers).
//
// The platform accepts one pattern: `export default async function (req: Request): Promise<Response>`.
// Secrets come from `secrets.get()` of the platform module `base44:runtime`, and only inside a request.
// Each function entry imports that module and passes the getter here; this file stays importable under
// Node so the same wiring is unit-tested.
import { type SecretReader, useSecretReader } from './env.ts';

/** The secrets the shared code reads. All are optional; an unset secret simply leaves the default. */
export const SECRET_NAMES = [
  'X1_NINJA_API_KEY',
  'GEOLOCATION_DISABLED',
  'ALLOWED_ORIGINS',
  // AI spend limits (defaults: 10 per user, 30 per IP, 500 global per UTC day)
  'AI_DAILY_QUOTA',
  'AI_IP_DAILY_QUOTA',
  'AI_GLOBAL_DAILY_QUOTA',
  // X1 Ninja safety limits (defaults: 450,000 per month, 50 per minute, cycle starts on day 1 UTC)
  'X1_NINJA_MONTHLY_QUOTA',
  'X1_NINJA_RATE_LIMIT_PER_MIN',
  'X1_NINJA_RESET_DAY',
] as const;

export type SecretGetter = (name: string) => unknown | Promise<unknown>;
export type Handler = (req: Request) => Promise<Response>;

/** Resolve every known secret (sync or async getter) into a reader for the current request. */
export async function resolveSecrets(get: SecretGetter | null | undefined): Promise<SecretReader> {
  const values = new Map<string, string>();
  if (get) {
    await Promise.all(SECRET_NAMES.map(async (name) => {
      try {
        const v = await get(name);
        if (typeof v === 'string' && v.length > 0) values.set(name, v);
      } catch {
        // A secret that is not set is not an error.
      }
    }));
  }
  return (name) => values.get(name);
}

/**
 * Wrap a handler factory. The factory is built lazily on first request (never at module load, which
 * would turn any failure into a boot error), and the secret reader is installed before each call.
 * Secret values are never logged, and any failure becomes a generic 500.
 */
export function entry(factory: () => Handler, get: SecretGetter | null | undefined): Handler {
  let handler: Handler | null = null;
  return async (req) => {
    try {
      useSecretReader(await resolveSecrets(get));
      handler ??= factory();
      return await handler(req);
    } catch (e) {
      console.error('[function] unhandled error', e instanceof Error ? e.name : 'error');
      return new Response(JSON.stringify({ success: false, error: { status: 500, code: 'internal_error' } }), {
        status: 500,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }
  };
}
