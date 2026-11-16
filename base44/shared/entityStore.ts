// Persistent counters backed by a Base44 entity ("RateLimit"), for limits that must survive cold starts and
// be shared across instances, such as per-user AI quotas. Base44 backend functions run on isolates with no
// shared memory, so an in-memory counter alone would let a caller get a fresh allowance on every new instance.
//
// Counting is read-modify-write and therefore not atomic: two simultaneous requests can both read the same
// count. That can under-count by a request or two, never over-count, and it is acceptable for quotas.
import type { KVStore } from './store.ts';
import { MemoryStore } from './store.ts';

export interface EntityApi {
  filter(query: Record<string, unknown>, sort?: string, limit?: number): Promise<any[]>;
  create(data: Record<string, unknown>): Promise<any>;
  update(id: string, data: Record<string, unknown>): Promise<any>;
  delete?(id: string): Promise<any>;
}

export class EntityStore implements KVStore {
  readonly persistent = true;
  constructor(private api: EntityApi, private now: () => number = Date.now, private random: () => number = Math.random) {}

  private async find(key: string): Promise<any | null> {
    const rows = await this.api.filter({ key }, undefined, 1);
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const row = await this.find(key);
    if (!row || !(row.expires_at > this.now())) return null;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    const data = { key, value: JSON.stringify(value), count: 0, expires_at: this.now() + ttlMs };
    const row = await this.find(key);
    if (row) await this.api.update(row.id, data);
    else await this.create(data);
  }

  async incr(key: string, ttlMs: number): Promise<number> {
    const t = this.now();
    const row = await this.find(key);
    if (row && row.expires_at > t) {
      const next = (Number(row.count) || 0) + 1;
      await this.api.update(row.id, { count: next });
      return next;
    }
    if (row) {
      await this.api.update(row.id, { count: 1, expires_at: t + ttlMs });
      return 1;
    }
    await this.create({ key, value: '', count: 1, expires_at: t + ttlMs });
    return 1;
  }

  private async create(data: Record<string, unknown>) {
    await this.api.create(data);
    // Keep the table small: now and then remove a few expired rows.
    if (this.api.delete && this.random() < 0.05) {
      try {
        const old = await this.api.filter({ expires_at: { $lt: this.now() } }, undefined, 5);
        for (const r of old ?? []) await this.api.delete(r.id);
      } catch {
        // Cleanup is best effort.
      }
    }
  }
}

/**
 * Uses the persistent store and falls back to per-instance memory if it fails (entity missing, database
 * unavailable). A failure is reported through `onFallback` once, never with request data.
 */
export class FallbackStore implements KVStore {
  private failed = false;
  constructor(
    private primary: KVStore,
    private secondary: KVStore = new MemoryStore(),
    private onFallback: (err: unknown) => void = () => {},
  ) {}
  get persistent(): boolean {
    return !this.failed && this.primary.persistent;
  }
  private async run<T>(f: (s: KVStore) => Promise<T>): Promise<T> {
    if (!this.failed) {
      try {
        return await f(this.primary);
      } catch (err) {
        this.failed = true;
        this.onFallback(err);
      }
    }
    return f(this.secondary);
  }
  get<T = unknown>(key: string) {
    return this.run((s) => s.get<T>(key));
  }
  set(key: string, value: unknown, ttlMs: number) {
    return this.run((s) => s.set(key, value, ttlMs));
  }
  incr(key: string, ttlMs: number) {
    return this.run((s) => s.incr(key, ttlMs));
  }
}
