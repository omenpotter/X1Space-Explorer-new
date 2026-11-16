// In-process cache with request coalescing and stale-on-error.
// One instance serves many concurrent callers with a single upstream request.

export interface Cached<T> {
  value: T;
  fetchedAt: number;
  stale: boolean;
}

export class Cache {
  private entries = new Map<string, { value: unknown; fetchedAt: number }>();
  private inflight = new Map<string, Promise<unknown>>();
  constructor(private now: () => number = Date.now, private maxEntries = 500) {}

  /**
   * Return a fresh value (younger than ttlMs), otherwise load one. Concurrent callers share
   * the same load. If loading fails and a value younger than staleMs exists, it is returned
   * flagged as stale instead of failing.
   */
  async get<T>(key: string, opts: { ttlMs: number; staleMs?: number }, loader: () => Promise<T>): Promise<Cached<T>> {
    const hit = this.entries.get(key);
    const t = this.now();
    if (hit && t - hit.fetchedAt < opts.ttlMs) {
      return { value: hit.value as T, fetchedAt: hit.fetchedAt, stale: false };
    }
    let p = this.inflight.get(key) as Promise<T> | undefined;
    if (!p) {
      p = loader().finally(() => this.inflight.delete(key));
      this.inflight.set(key, p);
    }
    try {
      const value = await p;
      const fetchedAt = this.now();
      if (this.entries.size >= this.maxEntries && !this.entries.has(key)) {
        const first = this.entries.keys().next().value;
        if (first !== undefined) this.entries.delete(first);
      }
      this.entries.set(key, { value, fetchedAt });
      return { value, fetchedAt, stale: false };
    } catch (err) {
      const staleMs = opts.staleMs ?? 0;
      if (hit && this.now() - hit.fetchedAt < staleMs) {
        return { value: hit.value as T, fetchedAt: hit.fetchedAt, stale: true };
      }
      throw err;
    }
  }

  peek<T>(key: string): T | undefined {
    return this.entries.get(key)?.value as T | undefined;
  }

  clear() {
    this.entries.clear();
    this.inflight.clear();
  }
}
