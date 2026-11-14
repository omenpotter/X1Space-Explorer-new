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

/** GET a backend function. Identical concurrent requests share one network call. */
export async function apiGet(name, params, { timeoutMs = 20000 } = {}) {
  const path = `/${name}${toQuery(params)}`;
  let pending = inflight.get(path);
  if (!pending) {
    pending = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await base44.functions.fetch(path, { signal: controller.signal, headers: { Accept: 'application/json' } });
        let body = null;
        try {
          body = await res.json();
        } catch {
          // Not JSON: the function is missing or the host returned an HTML page.
        }
        if (!res.ok || !body || body.success === false) {
          throw new ApiError(body?.error?.message || `Request failed (${res.status})`, res.status, body?.error?.code || 'request_failed');
        }
        return body;
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

/** URL of the image proxy for a validator identity or token mint. The server looks the image up itself. */
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
  networkStats: () => apiGet('getNetworkStats'),
  networkHistory: (hours = 12) => apiGet('getNetworkHistory', { hours }),
  anomalies: () => apiGet('detectAnomalies'),
  validatorDirectory: () => apiGet('getValidators', undefined, { timeoutMs: 30000 }),
};

export default api;
