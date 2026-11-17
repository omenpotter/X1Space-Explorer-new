// In-process cache with request coalescing, stale-on-error and partitioned memory bounds.
// One instance serves many concurrent callers with a single upstream request.
//
// Partitions (R3). Keys that an anonymous caller can multiply (one per mint, pool, or image) must never push out
// the shared datasets that every endpoint depends on, because rebuilding those is the expensive upstream work:
//   protected  a fixed allowlist of shared keys. Never evicted by other keys. Bounded by the size of the allowlist,
//              so it cannot grow however many distinct keys callers invent.
//   image      `img:` entries hold image bytes (up to 1 MB each), so they are bounded by bytes as well as count.
//   default    everything else (per-mint detail, price, row, metadata). LRU eviction at `maxEntries`.

export interface Cached<T> {
  value: T;
  fetchedAt: number;
  stale: boolean;
}

/** Shared datasets built once per instance and read by many endpoints. A fixed list: callers cannot add to it. */
export const PROTECTED_KEYS: readonly string[] = [
  'market',
  'token-snapshot',
  'xdex-pools',
  'ninja-pools',
  'validator-identities',
  'network-stats',
  'perf-samples',
  'supply',
];

const IMAGE_PREFIX = 'img:';
const IMAGE_MAX_ENTRIES = 128;
const IMAGE_MAX_BYTES = 32_000_000;

interface Entry {
  value: unknown;
  fetchedAt: number;
  size: number;
}

class Partition {
  entries = new Map<string, Entry>();
  bytes = 0;
  constructor(public maxEntries: number, public maxBytes = Infinity) {}

  get(key: string): Entry | undefined {
    const e = this.entries.get(key);
    if (e) {
      // Most recently used goes last, so the first key is the least recently used.
      this.entries.delete(key);
      this.entries.set(key, e);
    }
    return e;
  }

  set(key: string, e: Entry) {
    const old = this.entries.get(key);
    if (old) {
      this.bytes -= old.size;
      this.entries.delete(key);
    }
    while (this.entries.size >= this.maxEntries || (this.entries.size > 0 && this.bytes + e.size > this.maxBytes)) {
      const first = this.entries.keys().next().value;
      if (first === undefined) break;
      this.bytes -= this.entries.get(first)!.size;
      this.entries.delete(first);
    }
    this.entries.set(key, e);
    this.bytes += e.size;
  }

  clear() {
    this.entries.clear();
    this.bytes = 0;
  }
}

function sizeOf(value: unknown): number {
  const b = (value as { bytes?: { byteLength?: number } } | null)?.bytes;
  return typeof b?.byteLength === 'number' ? b.byteLength : 0;
}

export class Cache {
  private protectedKeys: Set<string>;
  private shared: Partition;
  private images = new Partition(IMAGE_MAX_ENTRIES, IMAGE_MAX_BYTES);
  private general: Partition;
  private inflight = new Map<string, Promise<unknown>>();

  constructor(private now: () => number = Date.now, maxEntries = 500, protectedKeys: readonly string[] = PROTECTED_KEYS) {
    this.protectedKeys = new Set(protectedKeys);
    this.shared = new Partition(Math.max(1, this.protectedKeys.size));
    this.general = new Partition(maxEntries);
  }

  private partition(key: string): Partition {
    if (this.protectedKeys.has(key)) return this.shared;
    return key.startsWith(IMAGE_PREFIX) ? this.images : this.general;
  }

  /**
   * Return a fresh value (younger than ttlMs), otherwise load one. Concurrent callers share
   * the same load. If loading fails and a value younger than staleMs exists, it is returned
   * flagged as stale instead of failing.
   */
  async get<T>(key: string, opts: { ttlMs: number; staleMs?: number }, loader: () => Promise<T>): Promise<Cached<T>> {
    const part = this.partition(key);
    const hit = part.get(key);
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
      part.set(key, { value, fetchedAt, size: sizeOf(value) });
      return { value, fetchedAt, stale: false };
    } catch (err) {
      const staleMs = opts.staleMs ?? 0;
      // Re-read: a concurrent caller may have refreshed the entry while this load was failing.
      const last = part.entries.get(key) ?? hit;
      if (last && this.now() - last.fetchedAt < staleMs) {
        return { value: last.value as T, fetchedAt: last.fetchedAt, stale: true };
      }
      throw err;
    }
  }

  peek<T>(key: string): T | undefined {
    return this.partition(key).entries.get(key)?.value as T | undefined;
  }

  clear() {
    this.shared.clear();
    this.images.clear();
    this.general.clear();
    this.inflight.clear();
  }

  /** Sizes per partition, for tests and diagnostics. */
  stats() {
    return {
      protected: this.shared.entries.size,
      images: this.images.entries.size,
      imageBytes: this.images.bytes,
      general: this.general.entries.size,
    };
  }
}
