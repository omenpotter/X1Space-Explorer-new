// Guards for the model-backed functions: sign-in, per-user quota, strict input
// allowlists, and validation of everything the model returns.
import type { KVStore } from './store.ts';
import { rateLimit } from './rateLimit.ts';
import { cleanText, isAddress } from './validate.ts';

export const AI_BODY_LIMIT = 16_000;
export const DEFAULT_DAILY_QUOTA = 25;
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

export async function checkQuota(store: KVStore, user: AiUser, dailyLimit: number, now: () => number = Date.now) {
  const minute = await rateLimit(store, 'ai-min', user.id, PER_MINUTE, 60_000, now);
  if (!minute.allowed) return { allowed: false, reason: 'rate_limited' as const, resetAt: minute.resetAt, remaining: 0 };
  const day = await rateLimit(store, 'ai-day', user.id, dailyLimit, 24 * 3600_000, now);
  return { allowed: day.allowed, reason: 'daily_quota' as const, resetAt: day.resetAt, remaining: day.remaining };
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
