// Small key-value store used for rate limits, quotas and long-lived lookups.
// Uses Deno KV when the platform provides it (shared across instances and restarts),
// otherwise falls back to a bounded in-memory map (per instance).

export interface KVStore {
  readonly persistent: boolean;
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlMs: number): Promise<void>;
  /** Increment a counter and return its new value. The TTL is applied when the counter is created. */
  incr(key: string, ttlMs: number): Promise<number>;
}

export class MemoryStore implements KVStore {
  readonly persistent = false;
  private map = new Map<string, { value: unknown; expires: number }>();
  constructor(private maxEntries = 5000, private now: () => number = Date.now) {}

  private sweep() {
    if (this.map.size < this.maxEntries) return;
    const t = this.now();
    for (const [k, v] of this.map) if (v.expires <= t) this.map.delete(k);
    // Still full: drop the oldest insertions (Map keeps insertion order).
    while (this.map.size >= this.maxEntries) {
      const first = this.map.keys().next().value;
      if (first === undefined) break;
      this.map.delete(first);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.expires <= this.now()) {
      this.map.delete(key);
      return null;
    }
    return e.value as T;
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    this.sweep();
    this.map.delete(key);
    this.map.set(key, { value, expires: this.now() + ttlMs });
  }

  async incr(key: string, ttlMs: number): Promise<number> {
    const e = this.map.get(key);
    if (e && e.expires > this.now()) {
      e.value = (e.value as number) + 1;
      return e.value as number;
    }
    await this.set(key, 1, ttlMs);
    return 1;
  }
}

class DenoKvStore implements KVStore {
  readonly persistent = true;
  constructor(private kv: any) {}

  async get<T>(key: string): Promise<T | null> {
    const r = await this.kv.get(['x1space', key]);
    return (r?.value ?? null) as T | null;
  }

  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    await this.kv.set(['x1space', key], value, { expireIn: ttlMs });
  }

  async incr(key: string, ttlMs: number): Promise<number> {
    const k = ['x1space', key];
    for (let attempt = 0; attempt < 4; attempt++) {
      const cur = await this.kv.get(k);
      const next = (typeof cur.value === 'number' ? cur.value : 0) + 1;
      const op = this.kv.atomic().check(cur);
      // Keep the original expiry window: only set a TTL when the counter is created.
      if (cur.value === null) op.set(k, next, { expireIn: ttlMs });
      else op.set(k, next, { expireIn: ttlMs });
      const res = await op.commit();
      if (res.ok) return next;
    }
    // Contention: fail closed for limits by reporting a large count.
    return Number.MAX_SAFE_INTEGER;
  }
}

let kvPromise: Promise<any | null> | null = null;

/** The platform's Deno KV handle, or null when it is not offered. Never throws. */
export function getKv(): Promise<any | null> {
  if (!kvPromise) {
    kvPromise = (async () => {
      try {
        const g = globalThis as any;
        if (typeof g.Deno?.openKv === 'function') return await g.Deno.openKv();
      } catch {
        // KV not enabled on this platform.
      }
      return null;
    })();
  }
  return kvPromise;
}

let storePromise: Promise<KVStore> | null = null;

/** Returns the shared store. Never throws: falls back to memory when KV is unavailable. */
export function getStore(): Promise<KVStore> {
  if (!storePromise) {
    storePromise = (async () => {
      const kv = await getKv();
      return kv ? (new DenoKvStore(kv) as KVStore) : new MemoryStore();
    })();
  }
  return storePromise;
}
