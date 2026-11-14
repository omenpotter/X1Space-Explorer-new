// Input validation helpers shared by every backend function.

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isAddress(value: unknown): value is string {
  return typeof value === 'string' && BASE58.test(value);
}

/** Parse an integer query parameter and clamp it. Non-numeric input yields the default. */
export function clampInt(value: unknown, def: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Normalise a free-text search term: strip control characters, collapse spaces, cap length. */
export function cleanText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  // deno-lint-ignore no-control-regex
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], def: T): T {
  return (allowed as readonly string[]).includes(String(value)) ? (value as T) : def;
}

/** Only https URLs to public-looking hostnames. Used for anything the server or browser will load. */
export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  let u: URL;
  try {
    u = new URL(value.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== '443') return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes('.')) return null; // localhost, single-label internal names
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null; // IPv4 literal
  if (host.startsWith('[') || host.includes(':')) return null; // IPv6 literal
  if (/\.(local|internal|localhost|lan|home|corp|intranet)$/.test(host)) return null;
  return u.toString();
}

export function finiteOrNull(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}
