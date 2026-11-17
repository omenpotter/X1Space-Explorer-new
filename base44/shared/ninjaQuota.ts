// X1 Ninja API quota governor (R8). Every upstream request, including each page of a paginated listing and each
// retry, must call reserve() first. Free plan (published at x1.ninja/developers): 500,000 requests per month,
// 60 per minute, one key, quota resets on the 1st of each month UTC. Safety limits stay below that:
// 450,000 per month and 50 per minute by default, leaving 50,000 and 10 in reserve.
//
// This is separate from the AI quotas in ai.ts: different keys, different limits, different failure policy.
//
// Enforcement strength depends on the backend the platform allows (see quota.ts):
//   kv (atomic)        every instance shares one exact counter.
//   counter (entity)   shared, but read-modify-write: an overshoot of a few requests is possible under contention.
//   memory             this instance only. The monthly limit is then per instance and resets on a cold start.
// The provider enforces its own limits as well; exceeding them costs availability of X1 Ninja data (it answers 429
// or revokes the key), never money, because the free plan has no overage billing.
import { cycleId, MemoryQuota, nextCycleStart, parseIntConfig, type QuotaBackend } from './quota.ts';

export interface NinjaLimits {
  /** Requests allowed per provider cycle. */
  monthly: number;
  /** Requests allowed per minute. */
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

export interface GovernorOptions {
  limits: () => NinjaLimits;
  /** Shared backend for the current request, or null when none is available. */
  backend: () => Promise<QuotaBackend | null>;
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
  private lastEnforcement: Enforcement = 'per-instance';
  private setEnforcement(e: Enforcement) {
    if (e !== this.lastEnforcement || !this.reported) {
      this.lastEnforcement = e;
      this.reported = true;
      this.opts.onEnforcement?.(e);
    }
  }
  private reported = false;
  private degraded = false;

  constructor(private opts: GovernorOptions) {
    this.now = opts.now ?? Date.now;
    this.local = new MemoryQuota(this.now);
  }

  /** Ask for permission to send one upstream request. Cheap when nothing is wrong: a local lease plus one minute counter. */
  async reserve(): Promise<Decision> {
    const t = this.now();
    if (this.cooldownUntil > t) return { ok: false, reason: 'cooldown', retryAfterMs: this.cooldownUntil - t };
    const limits = this.opts.limits();

    // 1. Monthly unit, from a local lease of the shared counter.
    const cycle = cycleId(t, limits.resetDay);
    if (this.lease.cycle !== cycle) this.lease = { cycle, units: 0 };
    if (this.lease.units <= 0) {
      const got = await this.acquireLease(cycle, limits, t);
      if (!got) return { ok: false, reason: 'month', retryAfterMs: Math.max(1000, nextCycleStart(t, limits.resetDay) - t) };
    }
    this.lease.units -= 1;

    // 2. Per-minute counter, shared where possible.
    const minute = Math.floor(t / 60_000);
    const granted = await this.reserveMinute(`x1ninja:min:${minute}`, limits.perMinute);
    if (!granted) {
      this.lease.units += 1; // the unit was not spent
      return { ok: false, reason: 'minute', retryAfterMs: (minute + 1) * 60_000 - t };
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
          if (r.granted) {
            this.lease.units += amount;
            this.setEnforcement(backend.atomic ? 'shared-atomic' : 'shared-best-effort');
            return true;
          }
          if (amount === 1) {
            this.setEnforcement(backend.atomic ? 'shared-atomic' : 'shared-best-effort');
            return false;
          }
        }
      } catch {
        this.degraded = true; // storage failed: count this instance's own usage instead
      }
    }
    this.setEnforcement('per-instance');
    const r = await this.local.reserve(key, 1, limits.monthly, ttl);
    if (r.granted) this.lease.units += 1;
    return r.granted;
  }

  private async reserveMinute(key: string, limit: number): Promise<boolean> {
    const backend = await this.shared();
    if (backend) {
      try {
        return (await backend.reserve(key, 1, limit, 120_000)).granted;
      } catch {
        this.degraded = true;
      }
    }
    return (await this.local.reserve(key, 1, limit, 120_000)).granted;
  }

  private async shared(): Promise<QuotaBackend | null> {
    try {
      const b = await this.opts.backend();
      return b && b.shared ? b : null;
    } catch {
      this.degraded = true;
      return null;
    }
  }

  /**
   * Feed every upstream response back in. A 429 or 503 starts a cooldown that honours Retry-After; a 401 or 403
   * (rejected key) starts a longer one so a bad key is not retried against the quota; a success that reports no
   * remaining requests pauses until the provider's reset.
   */
  observe(status: number, headers: Headers): void {
    const t = this.now();
    if (status === 429 || status === 503) {
      const retry = parseRetryAfterMs(headers.get('retry-after'), t) ?? 30_000;
      this.startCooldown(Math.min(Math.max(retry, 1000), MAX_COOLDOWN_MS), 'provider');
    } else if (status === 401 || status === 403) {
      this.startCooldown(AUTH_COOLDOWN_MS, 'auth');
    } else if (status >= 200 && status < 300) {
      const remaining = headers.get('x-ratelimit-remaining');
      if (remaining !== null && /^\d+$/.test(remaining.trim()) && parseInt(remaining, 10) === 0) {
        const reset = parseResetMs(headers.get('x-ratelimit-reset'), t) ?? 60_000;
        this.startCooldown(Math.min(Math.max(reset, 1000), MAX_COOLDOWN_MS), 'provider');
      }
    }
  }

  private startCooldown(ms: number, reason: 'provider' | 'auth') {
    const until = this.now() + ms;
    if (until > this.cooldownUntil) {
      this.cooldownUntil = until;
      this.cooldownReason = reason;
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
