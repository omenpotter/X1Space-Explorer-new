// Guards for the model-backed functions: sign-in, per-user quota, strict input
// allowlists, and validation of everything the model returns.
import type { KVStore } from './store.ts';
import { type QuotaBackend, type Reservation, nextUtcMidnight, parseIntConfig, utcDay } from './quota.ts';
import { rateLimit } from './rateLimit.ts';
import { cleanText, isAddress } from './validate.ts';

export const AI_BODY_LIMIT = 16_000;
export const DEFAULT_DAILY_QUOTA = 10;
export const PER_MINUTE = 5;

export interface AiUser {
  id: string;
}

/** Resolve the signed-in user from the request, or null. Never throws. */
export async function requireUser(client: any): Promise<AiUser | null> {
  try {
    const u = await client.auth.me();
    const id = u?.id ?? u?.email;
    return id ? { id: String(id) } : null;
  } catch {
    return null;
  }
}

// ---------- Quotas (R2) ----------
//
// Three daily limits are reserved BEFORE the model is called, all keyed by UTC day so they reset at 00:00 UTC:
//   per user    AI_DAILY_QUOTA          (default 10)
//   per IP      AI_IP_DAILY_QUOTA       (default 30)   stops one source farming many accounts
//   global      AI_GLOBAL_DAILY_QUOTA   (default 500)  the spend ceiling for all callers together
// plus a short per-user burst limit (per minute). A reservation is never refunded once the model call starts,
// because the provider may bill a call that later fails.
//
// With an atomic backend (Deno KV) the global limit is a hard ceiling. With the entity ledger it is a best-effort
// ceiling (see quota.ts). With no reliable shared backend the AI functions refuse (fail closed); the rest of the
// explorer is unaffected because only these two functions call reserveAiQuota.

export const DEFAULT_IP_DAILY_QUOTA = 30;
export const DEFAULT_GLOBAL_DAILY_QUOTA = 500;

export interface AiQuotaConfig {
  perUser: number;
  perIp: number;
  global: number;
}

export function aiQuotaConfigFrom(get: (name: string) => string | undefined): AiQuotaConfig {
  return {
    perUser: parseIntConfig(get('AI_DAILY_QUOTA'), DEFAULT_DAILY_QUOTA, 1, 1000),
    perIp: parseIntConfig(get('AI_IP_DAILY_QUOTA'), DEFAULT_IP_DAILY_QUOTA, 1, 10_000),
    global: parseIntConfig(get('AI_GLOBAL_DAILY_QUOTA'), DEFAULT_GLOBAL_DAILY_QUOTA, 1, 100_000),
  };
}

export type AiReservation =
  | { ok: true }
  | { ok: false; status: 429 | 503; code: 'rate_limited' | 'daily_quota' | 'ai_capacity_reached' | 'ai_unavailable'; message: string; resetAt: number };

const BURST_WINDOW = 60_000;

/**
 * Reserve one AI request against the burst, per-user, per-IP and global limits, in that order (cheapest and most
 * specific first). Anything reserved earlier is returned if a later limit refuses. If the backend is missing or
 * throws, the request is refused.
 */
export async function reserveAiQuota(
  burstStore: KVStore,
  backend: QuotaBackend | null,
  user: AiUser,
  ip: string,
  cfg: AiQuotaConfig,
  now: () => number = Date.now,
): Promise<AiReservation> {
  const t = now();
  const resetAt = nextUtcMidnight(t);
  const burst = await rateLimit(burstStore, 'ai-min', user.id, PER_MINUTE, BURST_WINDOW, now);
  if (!burst.allowed) return { ok: false, status: 429, code: 'rate_limited', message: 'Too many AI requests. Try again in a minute.', resetAt: burst.resetAt };
  if (!backend) return { ok: false, status: 503, code: 'ai_unavailable', message: 'AI features are not available right now.', resetAt };

  const day = utcDay(t);
  const ttl = resetAt - t + 3_600_000; // outlives the day by an hour, then expires on its own
  const taken: { key: string; r: Reservation }[] = [];
  const give = async () => {
    for (const x of taken.reverse()) {
      try {
        await backend.release(x.key, x.r);
      } catch {
        // Best effort.
      }
    }
  };
  const plan: { key: string; limit: number; deny: AiReservation }[] = [
    {
      key: `ai-user:${user.id}:${day}`,
      limit: cfg.perUser,
      deny: { ok: false, status: 429, code: 'daily_quota', message: 'Daily AI limit reached. It resets at 00:00 UTC.', resetAt },
    },
  ];
  // An unknown address is shared by everyone behind the same proxy, so it gets no per-IP limit of its own.
  if (ip && ip !== 'unknown') {
    plan.push({
      key: `ai-ip:${ip}:${day}`,
      limit: cfg.perIp,
      deny: { ok: false, status: 429, code: 'daily_quota', message: 'Daily AI limit reached for this network. It resets at 00:00 UTC.', resetAt },
    });
  }
  plan.push({
    key: `ai-global:${day}`,
    limit: cfg.global,
    deny: { ok: false, status: 503, code: 'ai_capacity_reached', message: 'AI features have reached today\'s capacity. They reset at 00:00 UTC.', resetAt },
  });

  try {
    for (const step of plan) {
      const r = await backend.reserve(step.key, 1, step.limit, ttl);
      if (!r.granted) {
        await give();
        return step.deny;
      }
      taken.push({ key: step.key, r });
    }
  } catch {
    await give();
    return { ok: false, status: 503, code: 'ai_unavailable', message: 'AI features are not available right now.', resetAt };
  }
  return { ok: true };
}

/** Free text placed in a prompt: cleaned, capped, and JSON-quoted so it cannot close the data block. */
export function promptData(value: unknown, maxLen: number): string {
  return dataBlock(cleanText(value, maxLen));
}

/**
 * Serialise untrusted data for a prompt. Angle brackets are escaped so the data can never
 * contain the closing tag of the block it is placed in.
 */
export function dataBlock(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

const ACTIONS = ['search_token', 'get_token_details', 'search_validator', 'get_network_stats', 'get_network_history', 'clarify'] as const;
const METRICS = ['tps', 'slot', 'epoch', 'health'];

/** Reduce a model reply to the known shape. Anything unexpected is dropped, never passed through. */
export function validateSearchInterpretation(raw: any) {
  const action = ACTIONS.includes(raw?.action) ? raw.action as typeof ACTIONS[number] : 'clarify';
  const p = raw?.parameters && typeof raw.parameters === 'object' ? raw.parameters : {};
  const parameters: Record<string, string | number> = {};
  const name = cleanText(p.name, 64);
  const symbol = cleanText(p.symbol, 16);
  if (name) parameters.name = name;
  if (symbol) parameters.symbol = symbol;
  for (const key of ['mint', 'vote_account', 'identity_pubkey']) if (isAddress(p[key])) parameters[key] = p[key];
  if (METRICS.includes(p.metric)) parameters.metric = p.metric;
  const hours = Number(p.hours);
  if (Number.isFinite(hours)) parameters.hours = Math.min(168, Math.max(1, Math.round(hours)));
  const confidence = Number(raw?.confidence);
  const out: Record<string, unknown> = {
    action,
    parameters,
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
  };
  if (action === 'clarify') out.question = cleanText(raw?.question, 200) || 'What would you like to look up?';
  return out;
}

const strList = (v: unknown) => (Array.isArray(v) ? v.slice(0, 10).map((s) => cleanText(s, 300)).filter(Boolean) : []);

export function validateReadiness(raw: any) {
  const score = Number(raw?.readiness_score);
  return {
    readiness_score: Number.isFinite(score) ? Math.min(100, Math.max(0, Math.round(score))) : null,
    missing_requirements: strList(raw?.missing_requirements),
    red_flags: strList(raw?.red_flags),
    recommendations: strList(raw?.recommendations),
  };
}

export function validateText(raw: unknown, max = 8000): string {
  // deno-lint-ignore no-control-regex
  return (typeof raw === 'string' ? raw : '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max);
}

/** Token details the client may pass for analysis: fixed keys, bounded values. */
export function pickTokenDetails(v: any) {
  const o = v && typeof v === 'object' ? v : {};
  const num = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  return {
    name: cleanText(o.name, 64) || 'Unknown',
    symbol: cleanText(o.symbol, 16) || 'Unknown',
    total_supply: num(o.total_supply ?? o.supply),
    holder_count: num(o.holder_count ?? o.holders),
    has_metadata: !!(o.metadata || o.metadataSource),
  };
}

/** A flat form: at most 20 simple keys with short string values. Nested data is dropped. */
export function pickForm(v: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, val] of Object.entries(v).slice(0, 20)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(k)) continue;
    if (typeof val !== 'string' && typeof val !== 'number') continue;
    const s = cleanText(String(val), 1000);
    if (s) out[k] = s;
  }
  return out;
}
