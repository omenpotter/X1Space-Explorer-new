// Client for the app's own backend functions. Requests go through the Base44 SDK so the
// base URL is correct on production, preview and local builds alike (no hard-coded hosts).
import { base44 } from '@/api/base44Client';

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const inflight = new Map();

function toQuery(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

// Two routes can serve a backend function, depending on how the app is hosted:
//   1. `/functions/<name>` on the app's own origin (the route the site has always used), and
//   2. the SDK route (`<server>/api/functions/<name>`).
// The first one that answers with JSON is remembered for the rest of the visit.
const ROUTES = [
  { id: 'origin', fetch: (path, init) => fetch(`/functions${path}`, init), imageBase: '/functions' },
  { id: 'sdk', fetch: (path, init) => base44.functions.fetch(path, init), imageBase: null },
];
let activeRoute = null;

async function requestJson(route, path, signal) {
  const res = await route.fetch(path, { signal, headers: { Accept: 'application/json' } });
  let body = null;
  try {
    body = await res.json();
  } catch {
    // Not JSON: this route does not serve functions (for example an HTML fallback page).
    return { routed: false };
  }
  // A JSON error from our own handlers has the { success: false, error } shape.
  const ours = body && typeof body === 'object' && ('success' in body || 'error' in body);
  if (!res.ok && !ours) return { routed: false };
  return { routed: true, res, body };
}

/** GET a backend function. Identical concurrent requests share one network call. */
export async function apiGet(name, params, { timeoutMs = 20000 } = {}) {
  const path = `/${name}${toQuery(params)}`;
  let pending = inflight.get(path);
  if (!pending) {
    pending = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const candidates = activeRoute ? [activeRoute] : ROUTES;
        for (const route of candidates) {
          let out;
          try {
            out = await requestJson(route, path, controller.signal);
          } catch (err) {
            if (err?.name === 'AbortError') throw err;
            continue; // network failure on this route: try the next one
          }
          if (!out.routed) continue;
          activeRoute = route;
          if (!out.res.ok || out.body.success === false) {
            throw new ApiError(out.body?.error?.message || `Request failed (${out.res.status})`, out.res.status, out.body?.error?.code || 'request_failed');
          }
          return out.body;
        }
        throw new ApiError('The data service is not reachable.', 0, 'network');
      } catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(err?.name === 'AbortError' ? 'The request timed out.' : 'Could not reach the server.', 0, err?.name === 'AbortError' ? 'timeout' : 'network');
      } finally {
        clearTimeout(timer);
      }
    })().finally(() => inflight.delete(path));
    inflight.set(path, pending);
  }
  return pending;
}

/**
 * URL of the image proxy for a validator identity or token mint. The server looks the image up
 * itself; the browser never passes a URL. Returns null when only the SDK route is available,
 * because an <img> cannot use it (callers then show the generated avatar).
 */
export function proxiedImageUrl(kind, id) {
  const base = (activeRoute || ROUTES[0]).imageBase;
  return base ? `${base}/getImage?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}` : null;
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
  networkStats: () => apiGet('getNetworkStats'),
  networkHistory: (hours = 12) => apiGet('getNetworkHistory', { hours }),
  anomalies: () => apiGet('detectAnomalies'),
  validatorDirectory: () => apiGet('getValidators', undefined, { timeoutMs: 30000 }),
};

export default api;
