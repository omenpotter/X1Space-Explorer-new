// X1 Ninja API quota governor (R8). Every upstream request, including each page of a paginated listing and each
// retry, must call reserve() first. Free plan (published at x1.ninja/developers): 500,000 requests per month,
// 60 per minute, one key, quota resets on the 1st of each month UTC. Safety limits stay below that:
// 450,000 per month and 50 per minute by default, leaving 50,000 and 10 in reserve.
//
// APPLICATION-ENFORCED vs PROVIDER-ENFORCED
//   Application-enforced: the limits in this file. They stop us from sending, so they can only be as strong as the
//   counter behind them (see quota.ts). With the QuotaCounter actor the counters are atomic and shared; without it
//   they degrade, and state().enforcement says which is in force.
//   Provider-enforced: X1 Ninja's own limits (500,000/month, 60/min, key revocation under its fair-use policy). These
//   are the backstop. We never rely on them for correctness, but we do listen to them: a 429 or 503 with Retry-After
//   starts a cooldown, a rejected key (401/403) starts a longer one, and X-RateLimit-* headers can only make us more
//   cautious, never less.
// Exceeding the provider's limits costs availability of X1 Ninja data, never money (free plan, no overage billing).
//
// Kept separate from the AI quotas in ai.ts: different keys, different limits, different failure policy (a Ninja
// quota failure degrades data; an AI quota failure refuses the AI call).
import { cycleId, MemoryQuota, nextCycleStart, parseIntConfig, type QuotaBackend } from './quota.ts';

export interface NinjaLimits {
  /** Requests allowed per provider cycle. */
  monthly: number;
  /** Requests allowed per minute (sliding, see reserveMinute). */
  perMinute: number;
  /** Units taken from the shared monthly counter at a time, so most requests need no storage round trip. */
  leaseSize: number;
  /** Day of month (UTC) on which the provider cycle starts. */
  resetDay: number;
}

export const NINJA_PLAN = { monthly: 500_000, perMinute: 60 } as const;
export const NINJA_DEFAULTS: NinjaLimits = { monthly: 450_000, perMinute: 50, leaseSize: 25, resetDay: 1 };

/** Validated limits from the (optional) secrets. Values above the plan's own limits are clamped to the plan. */
export function ninjaLimitsFrom(get: (name: string) => string | undefined): NinjaLimits {
  return {
    monthly: parseIntConfig(get('X1_NINJA_MONTHLY_QUOTA'), NINJA_DEFAULTS.monthly, 1, NINJA_PLAN.monthly),
    perMinute: parseIntConfig(get('X1_NINJA_RATE_LIMIT_PER_MIN'), NINJA_DEFAULTS.perMinute, 1, NINJA_PLAN.perMinute),
    leaseSize: NINJA_DEFAULTS.leaseSize,
    resetDay: parseIntConfig(get('X1_NINJA_RESET_DAY'), NINJA_DEFAULTS.resetDay, 1, 28),
  };
}

export type Decision =
  | { ok: true }
  | { ok: false; reason: 'month' | 'minute' | 'cooldown'; retryAfterMs: number };

export type Enforcement = 'shared-atomic' | 'shared-best-effort' | 'per-instance';

const MAX_COOLDOWN_MS = 15 * 60_000;
const AUTH_COOLDOWN_MS = 5 * 60_000;
const SHARED_DOWN_MS = 60_000; // after a storage failure, do not retry that backend for a minute
const COOLDOWN_CHECK_MS = 2_000; // how often an instance re-reads the shared cooldown
const COOLDOWN_KEY = 'x1ninja:cooldown';
/** If the provider reports this few requests left, stop sending until it resets. */
const PROVIDER_LOW_WATER = 2;

export interface GovernorOptions {
  limits: () => NinjaLimits;
  /** Shared backends for the current request, in order of preference. Empty means none is available. */
  backends: () => Promise<QuotaBackend[]>;
  now?: () => number;
  /** Called whenever the enforcement strength in use changes (for one-time diagnostics). */
  onEnforcement?: (e: Enforcement) => void;
}

export class NinjaGovernor {
  private now: () => number;
  private local: MemoryQuota;
  private lease = { cycle: '', units: 0 };
  private cooldownUntil = 0;
  private cooldownReason: 'provider' | 'auth' = 'provider';
  private sharedCooldownCheckedAt = -Infinity;
  private prev = { minute: -1, used: 0 };
  private down = new Map<string, number>();
  private lastEnforcement: Enforcement = 'per-instance';
  private reported = false;
  private degraded = false;
  private provider: { limit: number | null; remaining: number | null; resetMs: number | null } = { limit: null, remaining: null, resetMs: null };

  constructor(private opts: GovernorOptions) {
    this.now = opts.now ?? Date.now;
    this.local = new MemoryQuota(this.now);
  }

  private setEnforcement(e: Enforcement) {
    if (e !== this.lastEnforcement || !this.reported) {
      this.lastEnforcement = e;
      this.reported = true;
      this.opts.onEnforcement?.(e);
    }
  }

  /** The best backend that is shared and not recently failed. */
  private async shared(): Promise<QuotaBackend | null> {
    let list: QuotaBackend[] = [];
    try {
      list = await this.opts.backends();
    } catch {
      this.degraded = true;
    }
    const t = this.now();
    for (const b of list) if (b.shared && (this.down.get(b.kind) ?? 0) <= t) return b;
    return null;
  }

  private fail(b: QuotaBackend) {
    this.down.set(b.kind, this.now() + SHARED_DOWN_MS);
    this.degraded = true;
  }

  /** Ask for permission to send one upstream request. */
  async reserve(): Promise<Decision> {
    const t = this.now();
    if (this.cooldownUntil > t) return { ok: false, reason: 'cooldown', retryAfterMs: this.cooldownUntil - t };
    const limits = this.opts.limits();
    const backend = await this.shared();

    // 0. A cooldown another instance started (a 429 there means a 429 for everyone on this key).
    if (backend?.used && t - this.sharedCooldownCheckedAt >= COOLDOWN_CHECK_MS) {
      this.sharedCooldownCheckedAt = t;
      try {
        const until = await backend.used(COOLDOWN_KEY);
        if (until > t) {
          this.cooldownUntil = Math.max(this.cooldownUntil, until);
          this.cooldownReason = 'provider';
          return { ok: false, reason: 'cooldown', retryAfterMs: until - t };
        }
      } catch {
        this.fail(backend);
      }
    }

    // 1. A monthly unit, from a local lease of the shared counter.
    const cycle = cycleId(t, limits.resetDay);
    if (this.lease.cycle !== cycle) this.lease = { cycle, units: 0 };
    if (this.lease.units <= 0 && !(await this.acquireLease(cycle, limits, t))) {
      return { ok: false, reason: 'month', retryAfterMs: Math.max(1000, nextCycleStart(t, limits.resetDay) - t) };
    }
    this.lease.units -= 1;

    // 2. The per-minute limit.
    const granted = await this.reserveMinute(t, limits.perMinute);
    if (!granted) {
      this.lease.units += 1; // the unit was not spent
      return { ok: false, reason: 'minute', retryAfterMs: (Math.floor(t / 60_000) + 1) * 60_000 - t };
    }
    return { ok: true };
  }

  private async acquireLease(cycle: string, limits: NinjaLimits, t: number): Promise<boolean> {
    const key = `x1ninja:month:${cycle}`;
    const ttl = Math.max(60_000, nextCycleStart(t, limits.resetDay) - t + 3 * 86_400_000);
    const backend = await this.shared();
    if (backend) {
      try {
        // Take a block; near the end of the quota fall back to single units so the last requests are still usable.
        for (const amount of [limits.leaseSize, 1]) {
          const r = await backend.reserve(key, amount, limits.monthly, ttl);
          this.setEnforcement(backend.atomic ? 'shared-atomic' : 'shared-best-effort');
          if (r.granted) {
            this.lease.units += amount;
            return true;
          }
        }
        return false;
      } catch {
        this.fail(backend); // storage failed: count this instance's own usage instead
      }
    }
    this.setEnforcement('per-instance');
    const r = await this.local.reserve(key, 1, limits.monthly, ttl);
    if (r.granted) this.lease.units += 1;
    return r.granted;
  }

  /**
   * Sliding window approximation. A plain fixed window lets 50 requests go at 12:00:59 and 50 more at 12:01:00, which
   * is 100 in two seconds; a provider that measures differently would answer 429. Here the previous minute's count
   * still weighs on the current one in proportion to how much of that minute is left.
   */
  private async reserveMinute(t: number, configured: number): Promise<boolean> {
    // The provider's reported limit can only lower ours (for example after a plan change).
    const limit = this.provider.limit && this.provider.limit > 0 ? Math.min(configured, this.provider.limit) : configured;
    const minute = Math.floor(t / 60_000);
    const frac = (t % 60_000) / 60_000;
    const curKey = `x1ninja:min:${minute}`;
    const prevKey = `x1ninja:min:${minute - 1}`;
    const backend = await this.shared();
    if (backend) {
      try {
        let prevUsed = 0;
        if (backend.used) {
          if (this.prev.minute !== minute) this.prev = { minute, used: await backend.used(prevKey) }; // final once the minute is over
          prevUsed = this.prev.used;
        }
        const effective = Math.max(0, limit - Math.ceil(prevUsed * (1 - frac)));
        if (effective === 0) return false;
        return (await backend.reserve(curKey, 1, effective, 120_000)).granted;
      } catch {
        this.fail(backend);
      }
    }
    let prevUsed = 0;
    prevUsed = await this.local.used(prevKey);
    const effective = Math.max(0, limit - Math.ceil(prevUsed * (1 - frac)));
    if (effective === 0) return false;
    return (await this.local.reserve(curKey, 1, effective, 120_000)).granted;
  }

  /**
   * Feed every upstream response back in. A 429 or 503 starts a cooldown that honours Retry-After, shared with other
   * instances; a 401 or 403 (rejected key) starts a longer one so a bad key is not retried against the quota;
   * X-RateLimit-* headers lower our limits or pause us, and never raise them.
   */
  observe(status: number, headers: Headers): void {
    const t = this.now();
    if (status === 429 || status === 503) {
      const retry = parseRetryAfterMs(headers.get('retry-after'), t) ?? 30_000;
      this.startCooldown(Math.min(Math.max(retry, 1000), MAX_COOLDOWN_MS), 'provider');
    } else if (status === 401 || status === 403) {
      this.startCooldown(AUTH_COOLDOWN_MS, 'auth');
    }
    const num = (h: string) => {
      const v = headers.get(h);
      return v !== null && /^\d+$/.test(v.trim()) ? parseInt(v, 10) : null;
    };
    const limit = num('x-ratelimit-limit');
    const remaining = num('x-ratelimit-remaining');
    const reset = parseResetMs(headers.get('x-ratelimit-reset'), t);
    if (limit !== null || remaining !== null) {
      this.provider = { limit: limit ?? this.provider.limit, remaining: remaining ?? this.provider.remaining, resetMs: reset ?? null };
    }
    if (status >= 200 && status < 300 && remaining !== null && remaining <= PROVIDER_LOW_WATER) {
      this.startCooldown(Math.min(Math.max(reset ?? 60_000, 1000), MAX_COOLDOWN_MS), 'provider');
    }
  }

  private startCooldown(ms: number, reason: 'provider' | 'auth') {
    const until = this.now() + ms;
    if (until > this.cooldownUntil) {
      this.cooldownUntil = until;
      this.cooldownReason = reason;
      void this.publishCooldown(until, ms);
    }
  }

  /** Tell the other instances. Best effort and never awaited by the request that triggered it. */
  private async publishCooldown(until: number, ms: number) {
    try {
      const b = await this.shared();
      if (b?.set) await b.set(COOLDOWN_KEY, until, Math.max(1000, ms));
    } catch {
      // Other instances will find out from their own 429.
    }
  }

  /** Non-secret snapshot for diagnostics and tests. */
  state() {
    const t = this.now();
    return {
      enforcement: this.lastEnforcement,
      degraded: this.degraded,
      cooldownMs: Math.max(0, this.cooldownUntil - t),
      cooldownReason: this.cooldownUntil > t ? this.cooldownReason : null,
      leaseUnits: this.lease.units,
      provider: { ...this.provider },
    };
  }
}

function parseRetryAfterMs(value: string | null, now: number): number | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (/^\d+$/.test(v)) return Math.min(parseInt(v, 10), 86_400) * 1000;
  const at = Date.parse(v);
  return Number.isFinite(at) ? Math.max(0, at - now) : undefined;
}

/** X-RateLimit-Reset may be seconds until reset, or an epoch in seconds or milliseconds. */
function parseResetMs(value: string | null, now: number): number | undefined {
  if (!value || !/^\d+$/.test(value.trim())) return undefined;
  const n = parseInt(value, 10);
  if (n > 1e12) return Math.max(0, n - now);
  if (n > 1e9) return Math.max(0, n * 1000 - now);
  return n * 1000;
}
