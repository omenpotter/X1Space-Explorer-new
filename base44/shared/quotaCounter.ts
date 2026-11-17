// Atomic counters held by the QuotaCounter actor (base44/actors/QuotaCounter), and the client that calls it.
//
// An actor is a Durable Object (Base44 documents actors as such): one live instance per session id, and an instance handles one event at a
// time. CounterBook relies on exactly that: after its state is loaded, a reservation reads the counter, compares it
// with the limit and writes it back WITHOUT any `await` in between, so two callers can never both take the last unit.
// If the platform ever ran an instance's handlers concurrently across an await, that guarantee would not hold; that is
// the one assumption to confirm at runtime (BASE44_RUNTIME_VERIFICATION.md, check C7).
import type { QuotaBackend, Reservation } from './quota.ts';

export interface BookEntry {
  used: number;
  exp: number;
}
export type BookState = [string, BookEntry][];

export interface BookIo {
  load: () => Promise<BookState | null | undefined>;
  save: (state: BookState) => Promise<void>;
  now?: () => number;
}

const MAX_KEYS = 5000;
const KEY_RE = /^[A-Za-z0-9:_.@=+-]{1,200}$/;
const MAX_TTL_MS = 45 * 86_400_000;

export class BookError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function intIn(v: unknown, min: number, max: number, name: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < min || v > max) throw new BookError(400, `bad ${name}`);
  return v;
}

function keyOf(v: unknown): string {
  if (typeof v !== 'string' || !KEY_RE.test(v)) throw new BookError(400, 'bad key');
  return v;
}

export class CounterBook {
  private map: Map<string, BookEntry> | null = null;
  private loading: Promise<void> | null = null;
  private saving: Promise<void> = Promise.resolve();
  private now: () => number;

  constructor(private io: BookIo) {
    this.now = io.now ?? Date.now;
  }

  /** Load persisted state once. Every caller waits for the same load, so none can mutate a half-loaded book. */
  ensure(): Promise<void> {
    this.loading ??= (async () => {
      const saved = await this.io.load();
      this.map = new Map(Array.isArray(saved) ? saved : []);
    })().catch((e) => {
      this.loading = null; // let the next call retry
      throw e;
    });
    return this.loading;
  }

  private snapshot(): BookState {
    const t = this.now();
    return [...this.map!].filter(([, e]) => e.exp > t);
  }

  /** Queue a write of the latest state. Writes are chained so an older snapshot can never land after a newer one. */
  private persist(): Promise<void> {
    this.saving = this.saving.catch(() => {}).then(() => this.io.save(this.snapshot()));
    return this.saving;
  }

  private live(key: string, t: number): BookEntry | undefined {
    const e = this.map!.get(key);
    if (e && e.exp <= t) {
      this.map!.delete(key);
      return undefined;
    }
    return e;
  }

  private sweep(t: number) {
    let n = 0;
    for (const [k, e] of this.map!) {
      if (e.exp <= t) {
        this.map!.delete(k);
        if (++n >= 200) break;
      }
    }
  }

  async reserve(args: any): Promise<{ granted: boolean; used: number; limit: number }> {
    const key = keyOf(args?.key);
    const amount = intIn(args?.amount, 1, 1_000_000, 'amount');
    const limit = intIn(args?.limit, 1, 1_000_000_000, 'limit');
    const ttlMs = intIn(args?.ttlMs, 1000, MAX_TTL_MS, 'ttlMs');
    await this.ensure();
    // ---- atomic section: no await until the result is decided and stored ----
    const t = this.now();
    this.sweep(t);
    let e = this.live(key, t);
    if (!e && this.map!.size >= MAX_KEYS) return { granted: false, used: limit, limit };
    const used = e?.used ?? 0;
    if (used + amount > limit) return { granted: false, used, limit };
    if (!e) {
      e = { used: 0, exp: t + ttlMs };
      this.map!.set(key, e);
    }
    e.used = used + amount;
    const result = { granted: true, used: e.used, limit };
    // ---- end atomic section ----
    await this.persist();
    return result;
  }

  async release(args: any): Promise<{ used: number }> {
    const key = keyOf(args?.key);
    const amount = intIn(args?.amount ?? 1, 1, 1_000_000, 'amount');
    await this.ensure();
    const e = this.live(key, this.now());
    if (!e) return { used: 0 };
    e.used = Math.max(0, e.used - amount);
    const used = e.used;
    await this.persist();
    return { used };
  }

  async used(args: any): Promise<{ used: number }> {
    const key = keyOf(args?.key);
    await this.ensure();
    return { used: this.live(key, this.now())?.used ?? 0 };
  }

  /** Store a plain value (a deadline, for example) that expires on its own. */
  async set(args: any): Promise<{ used: number }> {
    const key = keyOf(args?.key);
    const value = intIn(args?.value, 0, Number.MAX_SAFE_INTEGER, 'value');
    const ttlMs = intIn(args?.ttlMs, 1000, MAX_TTL_MS, 'ttlMs');
    await this.ensure();
    const t = this.now();
    this.sweep(t);
    if (!this.live(key, t) && this.map!.size >= MAX_KEYS) throw new BookError(507, 'full');
    this.map!.set(key, { used: value, exp: t + ttlMs });
    await this.persist();
    return { used: value };
  }
}

// ---------- Client side ----------

/** Names of the shards (actor sessions). Keys of one kind share a shard so related counters live together. */
export function shardFor(key: string): string {
  if (key.startsWith('x1ninja:')) return 'x1ninja'; // a handful of keys, low traffic
  if (key.startsWith('ai-global:')) return 'ai-global'; // one key per day
  // Per-user and per-IP keys spread over 16 shards, so no single instance holds every user.
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193) >>> 0;
  return `ai-${key.split(':')[0]}-${h % 16}`;
}

/** Calls the QuotaCounter actor through `client.asServiceRole.actors`. Atomic and shared, if the actor behaves as documented. */
export class ActorQuota implements QuotaBackend {
  readonly kind = 'actor' as const;
  readonly atomic = true;
  readonly shared = true;
  constructor(private actors: any) {}

  private shard(key: string): any {
    return this.actors.QuotaCounter(shardFor(key));
  }

  async reserve(key: string, amount: number, limit: number, ttlMs: number): Promise<Reservation> {
    const r = await this.shard(key).reserve({ key, amount, limit, ttlMs });
    if (typeof r?.granted !== 'boolean' || typeof r.used !== 'number') throw new Error('quota actor: unexpected reply');
    return { granted: r.granted, used: r.used, limit };
  }

  async release(key: string, _r: Reservation, amount = 1): Promise<void> {
    await this.shard(key).release({ key, amount });
  }

  async used(key: string): Promise<number> {
    const r = await this.shard(key).used({ key });
    if (typeof r?.used !== 'number') throw new Error('quota actor: unexpected reply');
    return r.used;
  }

  async set(key: string, value: number, ttlMs: number): Promise<void> {
    await this.shard(key).set({ key, value, ttlMs });
  }
}
