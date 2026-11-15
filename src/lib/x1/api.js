// Client for the app's own backend functions. Requests go through the Base44 SDK so the
// base URL is correct on production, preview and local builds alike (no hard-coded hosts).
import { base44 } from '@/api/base44Client';
import { getLiveAnomalies, getLiveNetworkHistory, getLiveNetworkStats } from './liveStats';

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const inflight = new Map();

function cleanParams(params) {
  const out = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

function toQuery(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// ---------- shared response cache ----------
// Every backend function run costs workspace credits, so identical calls are answered from a
// memory + localStorage cache shared by all tabs. Failed responses are never stored.
const CACHE_PREFIX = 'x1c:';
const DEFAULT_TTL_MS = {
  getTokens: 30000,
  getTokenByMint: 30000,
  getTokenPrices: 120000,
  getLPTokens: 60000,
  getLPStats: 60000,
  getLPPoolDetail: 60000,
  getValidators: 300000,
  analyzeToken: 60000,
  searchTokens: 30000,
};
const memoryCache = new Map();

function cacheKey(name, params) {
  const sorted = Object.keys(params).sort().map((k) => [k, params[k]]);
  return `${name}?${JSON.stringify(sorted)}`;
}

function readCache(key, ttlMs) {
  const now = Date.now();
  const fresh = (e) => e && typeof e === 'object' && Number.isFinite(e.t) && e.body && typeof e.body === 'object' && e.t <= now + 1000 && now - e.t < ttlMs;
  const mem = memoryCache.get(key);
  if (fresh(mem)) return mem.body;
  memoryCache.delete(key);
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_PREFIX + key);
    if (raw) {
      const entry = JSON.parse(raw);
      if (fresh(entry)) {
        memoryCache.set(key, entry);
        return entry.body;
      }
    }
  } catch {
    // Unavailable or malformed storage: behave as a cache miss.
  }
  return null;
}

function writeCache(key, body) {
  const entry = { t: Date.now(), body };
  memoryCache.set(key, entry);
  try {
    globalThis.localStorage?.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Quota or privacy mode: the memory copy still serves this tab.
  }
}

/** Drop every cached response (memory and this app's localStorage entries). */
export function clearApiCache() {
  memoryCache.clear();
  try {
    const ls = globalThis.localStorage;
    if (!ls) return;
    const keys = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => ls.removeItem(k));
  } catch {
    // ignore
  }
}

// ---------- transport ----------
// Two routes can serve a backend function:
//   1. the SDK (`base44.functions.invoke`, POST with a JSON payload: the documented way), and
//   2. a direct GET of `/functions/<name>` on the app's own origin.
// The SDK is tried first; the direct route is the fallback when the SDK route is unreachable or
// does not answer with JSON. The route that last worked is remembered for the rest of the visit.
const isOurs = (body) => !!body && typeof body === 'object' && ('success' in body || 'error' in body);
const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError' });

function failure(status, body) {
  return new ApiError(body?.error?.message || `Request failed (${status})`, status, body?.error?.code || 'request_failed');
}

async function viaSdk(name, params, signal) {
  let aborted;
  const abortPromise = new Promise((_, reject) => {
    aborted = () => reject(abortError());
    if (signal.aborted) aborted();
    else signal.addEventListener('abort', aborted, { once: true });
  });
  try {
    const res = await Promise.race([base44.functions.invoke(name, params), abortPromise]);
    const body = res?.data;
    if (!isOurs(body)) return { routed: false };
    if (body.success === false) throw failure(res?.status ?? 500, body);
    return { routed: true, body };
  } catch (err) {
    if (err instanceof ApiError || err?.name === 'AbortError') throw err;
    const status = err?.response?.status ?? err?.status;
    const data = err?.response?.data ?? err?.data;
    // A JSON error from our own handlers is a real answer; anything else means this route is not serving functions.
    if (status && isOurs(data)) throw failure(status, data);
    return { routed: false };
  } finally {
    signal.removeEventListener?.('abort', aborted);
  }
}

async function viaOrigin(name, params, signal) {
  const res = await fetch(`/functions/${name}${toQuery(params)}`, { signal, headers: { Accept: 'application/json' } });
  let body = null;
  try {
    body = await res.json();
  } catch {
    return { routed: false };
  }
  if (!res.ok && !isOurs(body)) return { routed: false };
  if (!res.ok || body?.success === false) throw failure(res.status, body);
  return { routed: true, body };
}

const ROUTES = { sdk: viaSdk, origin: viaOrigin };
let activeRoute = null;

async function transport(name, params, signal) {
  const order = activeRoute === 'origin' ? ['origin', 'sdk'] : ['sdk', 'origin'];
  for (const id of order) {
    let out;
    try {
      out = await ROUTES[id](name, params, signal);
    } catch (err) {
      if (err instanceof ApiError || err?.name === 'AbortError') throw err;
      continue; // network failure on this route: try the next one
    }
    if (!out.routed) continue;
    activeRoute = id;
    return out.body;
  }
  throw new ApiError('The data service is not reachable.', 0, 'network');
}

/**
 * Call a backend function. Identical concurrent requests share one network call, and successful
 * responses are cached for `ttlMs` (per-function default) in memory and localStorage.
 * @param {string} name
 * @param {Record<string, any>} [params]
 * @param {{ timeoutMs?: number, ttlMs?: number, force?: boolean }} [opts]
 */
export async function apiGet(name, params, { timeoutMs = 20000, ttlMs, force = false } = {}) {
  const clean = cleanParams(params);
  const key = cacheKey(name, clean);
  const ttl = ttlMs ?? DEFAULT_TTL_MS[name] ?? 0;
  if (ttl > 0 && !force) {
    const hit = readCache(key, ttl);
    if (hit) return hit;
  }
  let pending = inflight.get(key);
  if (!pending) {
    pending = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const body = await transport(name, clean, controller.signal);
        if (ttl > 0) writeCache(key, body);
        return body;
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(err?.name === 'AbortError' ? 'The request timed out.' : 'Could not reach the server.', 0, err?.name === 'AbortError' ? 'timeout' : 'network');
      } finally {
        clearTimeout(timer);
      }
    })().finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return pending;
}

/**
 * URL of the image proxy for a validator identity or token mint. The server looks the image up
 * itself; the browser never passes a URL. An <img> cannot use the SDK, so this is always the
 * direct GET route.
 */
export function proxiedImageUrl(kind, id) {
  return `/functions/getImage?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`;
}

export const api = {
  tokens: (params) => apiGet('getTokens', params),
  searchTokens: (q, limit = 20) => apiGet('searchTokens', { q, limit }),
  token: (mint) => apiGet('getTokenByMint', { mint }),
  tokenAnalysis: (mint) => apiGet('analyzeToken', { mint }),
  tokenPrice: (mint, opts = {}) => apiGet('getTokenPrices', { mint, ...opts }),
  tokenPools: (mint) => apiGet('getLiquidityPools', { token: mint }),
  pools: (params) => apiGet('getLPTokens', params),
  poolStats: () => apiGet('getLPStats'),
  pool: (address, opts = {}) => apiGet('getLPPoolDetail', { pool: address, ...opts }),
  // Computed in the browser from the public RPC: no backend function runs.
  networkStats: () => getLiveNetworkStats(),
  networkHistory: (hours = 12) => getLiveNetworkHistory(hours),
  anomalies: () => getLiveAnomalies(),
  validatorDirectory: () => apiGet('getValidators', undefined, { timeoutMs: 30000 }),
};

export default api;
