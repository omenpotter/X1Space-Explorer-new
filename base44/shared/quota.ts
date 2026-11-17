// Quota reservation backends and configuration helpers, shared by the AI guard (ai.ts) and the X1 Ninja
// governor (ninjaQuota.ts).
//
// Three backends, with different guarantees. Callers must never describe a non-atomic backend as a hard ceiling:
//
//   actor    A Base44 actor (a Cloudflare Durable Object): one single-threaded instance per shard, called from backend
//            functions through `asServiceRole.actors`. Atomic and shared by every function instance. This is the
//            supported atomic primitive on Base44 (see quotaCounter.ts and base44/actors/QuotaCounter).
//   kv       Deno KV compare-and-set. Atomic and shared, but Base44 backend functions run on Cloudflare Workers, which
//            has no Deno KV, so this only applies if the runtime ever changes or in Deno-based local tooling.
//   ledger   Reserve-then-verify on the RateLimit entity: every reservation is its own row, and a reservation is
//            granted only if its row ranks inside the first `limit` rows of the window. Parallel requests are
//            ranked by one total order, so they cannot both take the last slot, provided the entity reads its
//            own writes. Best effort, not a transaction.
//   counter  Read-modify-write on one RateLimit row. Concurrent writers can lose an increment (under-count), so
//            this is only suitable where a small overshoot is acceptable (X1 Ninja leases).
//   memory   One instance only. Atomic inside the instance, resets on cold start, shared with nobody.
import { getKv } from './store.ts';
import { ActorQuota } from './quotaCounter.ts';

export interface Reservation {
  granted: boolean;
  /** Units consumed in the window after this call, including this reservation when granted. */
  used: number;
  limit: number;
  /** Opaque handle used by release(). */
  ref?: string;
}

export interface QuotaBackend {
  readonly kind: 'actor' | 'kv' | 'ledger' | 'counter' | 'memory';
  /** True only when the reservation is a real atomic compare-and-set. */
  readonly atomic: boolean;
  /** True when every backend instance (every isolate) sees the same counters. */
  readonly shared: boolean;
  reserve(key: string, amount: number, limit: number, ttlMs: number): Promise<Reservation>;
  /** Give a reservation back (best effort). */
  release(key: string, r: Reservation, amount?: number): Promise<void>;
  /** Current value of a counter in its live window (0 when absent or expired). Optional. */
  used?(key: string): Promise<number>;
  /** Store a plain value (for example a cooldown deadline) that expires after `ttlMs`. Optional. */
  set?(key: string, value: number, ttlMs: number): Promise<void>;
}

/** Strict enforcement requires reservations that are both atomic and shared by every instance. */
export const isStrictBackend = (b: QuotaBackend | null | undefined): b is QuotaBackend => !!b && b.atomic && b.shared;

// ---------- Time and configuration ----------

export const DAY_MS = 86_400_000;

/** UTC day number since the epoch. Quotas keyed by it reset exactly at 00:00 UTC. */
export function utcDay(now: number): number {
  return Math.floor(now / DAY_MS);
}

export function nextUtcMidnight(now: number): number {
  return (utcDay(now) + 1) * DAY_MS;
}

/**
 * Strict integer configuration: digits only, clamped to [min, max]. Anything else (empty, "10abc", "-5",
 * "1e3", "NaN", decimals) yields the default, so a typo cannot silently disable or explode a limit.
 */
export function parseIntConfig(raw: unknown, def: number, min: number, max: number): number {
  if (typeof raw !== 'string' || !/^\s*\d{1,9}\s*$/.test(raw)) return def;
  return Math.min(max, Math.max(min, parseInt(raw, 10)));
}

/**
 * The provider's monthly quota resets on the 1st of each month, UTC. `resetDay` (1-28) lets the owner shift the
 * boundary if the provider ever changes it. Returns an id such as "2026-11" naming the cycle that `now` is in.
 */
export function cycleId(now: number, resetDay = 1): string {
  const d = new Date(now);
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth();
  if (d.getUTCDate() < resetDay) {
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Start of the cycle after the one `now` is in, in epoch ms (UTC). */
export function nextCycleStart(now: number, resetDay = 1): number {
  const d = new Date(now);
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth();
  if (d.getUTCDate() >= resetDay) m += 1;
  if (m > 11) {
    m = 0;
    y += 1;
  }
  return Date.UTC(y, m, resetDay);
}

// ---------- Memory ----------

export class MemoryQuota implements QuotaBackend {
  readonly kind = 'memory' as const;
  readonly atomic = true; // JavaScript runs one task at a time and reserve() has no await between read and write
  /** False in production (one instance). Tests pass true to stand in for a store every instance shares. */
  readonly shared: boolean;
  private map = new Map<string, { used: number; expires: number }>();
  constructor(private now: () => number = Date.now, private maxKeys = 2000, shared = false) {
    this.shared = shared;
  }

  private sweep() {
    if (this.map.size < this.maxKeys) return;
    const t = this.now();
    for (const [k, v] of this.map) if (v.expires <= t) this.map.delete(k);
    while (this.map.size >= this.maxKeys) {
      const first = this.map.keys().next().value;
      if (first === undefined) break;
      this.map.delete(first);
    }
  }

  async reserve(key: string, amount: number, limit: number, ttlMs: number): Promise<Reservation> {
    const t = this.now();
    let e = this.map.get(key);
    if (!e || e.expires <= t) {
      this.sweep();
      e = { used: 0, expires: t + ttlMs };
      this.map.set(key, e);
    }
    if (e.used + amount > limit) return { granted: false, used: e.used, limit };
    e.used += amount;
    return { granted: true, used: e.used, limit };
  }

  async release(key: string, _r: Reservation, amount = 1): Promise<void> {
    const e = this.map.get(key);
    if (e) e.used = Math.max(0, e.used - amount);
  }

  async used(key: string): Promise<number> {
    const e = this.map.get(key);
    return e && e.expires > this.now() ? e.used : 0;
  }

  async set(key: string, value: number, ttlMs: number): Promise<void> {
    this.sweep();
    this.map.set(key, { used: value, expires: this.now() + ttlMs });
  }
}

// ---------- Deno KV (atomic) ----------

export class KvQuota implements QuotaBackend {
  readonly kind = 'kv' as const;
  readonly atomic = true;
  readonly shared = true;
  constructor(private kv: any) {}

  async reserve(key: string, amount: number, limit: number, ttlMs: number): Promise<Reservation> {
    const k = ['x1space', 'quota', key];
    for (let attempt = 0; attempt < 6; attempt++) {
      const cur = await this.kv.get(k);
      const used = typeof cur.value === 'number' ? cur.value : 0;
      if (used + amount > limit) return { granted: false, used, limit };
      const res = await this.kv.atomic().check(cur).set(k, used + amount, { expireIn: ttlMs }).commit();
      if (res.ok) return { granted: true, used: used + amount, limit };
    }
    // Contention that does not resolve: refuse rather than risk exceeding the limit.
    return { granted: false, used: limit, limit };
  }

  async used(key: string): Promise<number> {
    const cur = await this.kv.get(['x1space', 'quota', key]);
    return typeof cur.value === 'number' ? cur.value : 0;
  }

  async set(key: string, value: number, ttlMs: number): Promise<void> {
    await this.kv.set(['x1space', 'quota', key], value, { expireIn: ttlMs });
  }

  async release(key: string, _r: Reservation, amount = 1): Promise<void> {
    const k = ['x1space', 'quota', key];
    for (let attempt = 0; attempt < 4; attempt++) {
      const cur = await this.kv.get(k);
      if (typeof cur.value !== 'number' || cur.value <= 0) return;
      const res = await this.kv.atomic().check(cur).set(k, Math.max(0, cur.value - amount), { expireIn: 24 * 3600_000 }).commit();
      if (res.ok) return;
    }
  }
}

// ---------- Entity access ----------

export interface EntityApi {
  filter(query: Record<string, unknown>, sort?: string, limit?: number): Promise<any[]>;
  create(data: Record<string, unknown>): Promise<any>;
  update(id: string, data: Record<string, unknown>): Promise<any>;
  delete?(id: string): Promise<any>;
}

/** Remove a few expired rows. Called whenever a row is created, so the table stays bounded. */
async function sweepExpired(api: EntityApi, now: number, max = 5): Promise<void> {
  if (!api.delete) return;
  try {
    const old = await api.filter({ expires_at: { $lt: now } }, undefined, max);
    for (const r of old ?? []) await api.delete(r.id);
  } catch {
    // Cleanup is best effort.
  }
}

/** Pseudo-random token that does not need crypto strength: it only has to be unique per reservation. */
function nonce(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

// ---------- Entity ledger (reserve-then-verify) ----------

/** How many rows past `limit` are read, so rows that share a timestamp at the boundary are ordered exactly. */
const LEDGER_SLACK = 5;

export class EntityLedgerQuota implements QuotaBackend {
  readonly kind = 'ledger' as const;
  readonly atomic = false;
  readonly shared = true;
  constructor(private api: EntityApi, private now: () => number = Date.now) {}

  async reserve(key: string, amount: number, limit: number, ttlMs: number): Promise<Reservation> {
    if (amount !== 1) throw new Error('ledger reserves one unit at a time');
    const mine = nonce();
    // Append first. A create is a single write, so concurrent reservations never overwrite each other.
    await this.api.create({ key, value: mine, count: 1, expires_at: this.now() + ttlMs });
    let rows: any[] = [];
    let rank = -1;
    try {
      rows = await this.api.filter({ key }, 'created_date', limit + LEDGER_SLACK);
      rows = (Array.isArray(rows) ? rows : []).slice().sort((a, b) => {
        const ta = String(a.created_date ?? '');
        const tb = String(b.created_date ?? '');
        return ta < tb ? -1 : ta > tb ? 1 : String(a.id) < String(b.id) ? -1 : 1;
      });
      rank = rows.findIndex((r) => r.value === mine);
    } catch (err) {
      await this.dropByValue(key, mine);
      throw err;
    }
    // Not visible (read-after-write lag) or outside the first `limit` rows: refuse and remove the row.
    if (rank < 0 || rank >= limit) {
      if (!(await this.drop(rows[rank]?.id))) await this.dropByValue(key, mine);
      return { granted: false, used: Math.min(limit, rows.length), limit };
    }
    void sweepExpired(this.api, this.now());
    return { granted: true, used: rank + 1, limit, ref: rows[rank].id ?? mine };
  }

  private async drop(id: unknown): Promise<boolean> {
    if (!id || !this.api.delete) return false;
    try {
      await this.api.delete(String(id));
      return true;
    } catch {
      return false;
    }
  }

  private async dropByValue(key: string, value: string): Promise<void> {
    try {
      const rows = await this.api.filter({ key, value }, undefined, 1);
      if (rows?.[0]) await this.drop(rows[0].id);
    } catch {
      // Best effort. A stray row ranks after the limit and expires, so it cannot grant extra quota.
    }
  }

  async release(key: string, r: Reservation): Promise<void> {
    if (!r.ref) return;
    if (!(await this.drop(r.ref))) await this.dropByValue(key, r.ref);
  }
}

// ---------- Entity counter (read-modify-write) ----------

export class EntityCounterQuota implements QuotaBackend {
  readonly kind = 'counter' as const;
  readonly atomic = false;
  readonly shared = true;
  constructor(private api: EntityApi, private now: () => number = Date.now) {}

  private async find(key: string): Promise<any | null> {
    const rows = await this.api.filter({ key }, undefined, 1);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async reserve(key: string, amount: number, limit: number, ttlMs: number): Promise<Reservation> {
    const t = this.now();
    const row = await this.find(key);
    const live = row && row.expires_at > t;
    const used = live ? Number(row.count) || 0 : 0;
    if (used + amount > limit) return { granted: false, used, limit };
    if (row && live) await this.api.update(row.id, { count: used + amount });
    else if (row) await this.api.update(row.id, { count: amount, expires_at: t + ttlMs });
    else {
      await this.api.create({ key, value: '', count: amount, expires_at: t + ttlMs });
      void sweepExpired(this.api, t);
    }
    return { granted: true, used: used + amount, limit };
  }

  async used(key: string): Promise<number> {
    const row = await this.find(key);
    return row && row.expires_at > this.now() ? Number(row.count) || 0 : 0;
  }

  async set(key: string, value: number, ttlMs: number): Promise<void> {
    const row = await this.find(key);
    const data = { count: value, expires_at: this.now() + ttlMs };
    if (row) await this.api.update(row.id, data);
    else await this.api.create({ key, value: '', ...data });
  }

  async release(key: string, _r: Reservation, amount = 1): Promise<void> {
    const row = await this.find(key);
    if (row && row.expires_at > this.now()) await this.api.update(row.id, { count: Math.max(0, (Number(row.count) || 0) - amount) });
  }
}

// ---------- Selection ----------

/** The KV backend when the platform has Deno KV, otherwise null. */
export async function kvBackend(): Promise<QuotaBackend | null> {
  const kv = await getKv();
  return kv ? new KvQuota(kv) : null;
}

export type AiQuotaMode = 'strict' | 'best_effort';

/** `AI_QUOTA_MODE`: only the exact text `best_effort` weakens enforcement. Anything else, including typos, is strict. */
export function parseAiQuotaMode(raw: unknown): AiQuotaMode {
  return typeof raw === 'string' && raw.trim().toLowerCase() === 'best_effort' ? 'best_effort' : 'strict';
}

/**
 * Backend for billable AI quotas.
 *   strict (default)  only an atomic, shared backend qualifies: the QuotaCounter actor, or Deno KV. Otherwise null,
 *                     and the AI functions refuse. The entity ledger is NEVER used silently.
 *   best_effort       the owner has explicitly accepted a non-atomic ceiling: the entity ledger may be used last.
 * `client` is the request's platform client (service role).
 */
export async function aiQuotaBackend(client: any, mode: AiQuotaMode = 'strict', now: () => number = Date.now): Promise<QuotaBackend | null> {
  const actors = client?.asServiceRole?.actors;
  if (actors && typeof actors.QuotaCounter === 'function') return new ActorQuota(actors);
  const kv = await kvBackend();
  if (kv) return kv;
  const entity = client?.asServiceRole?.entities?.RateLimit;
  return mode === 'best_effort' && entity ? new EntityLedgerQuota(entity, now) : null;
}
