// Unified JSON-RPC client for the browser: one timeout, ordered failover with a
// short cooldown for failing endpoints, in-flight request de-duplication and an
// optional TTL cache. Every RPC call in the app goes through here.
import { X1_CONFIG } from './config';
import { getCached, setCache } from '@/components/x1/RpcCache';

const endpoints = X1_CONFIG.rpcEndpoints;
const cooldownUntil = new Array(endpoints.length).fill(0);
const inflight = new Map();
let preferred = 0;
let nextId = 1;

export class RpcError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = 'RpcError';
    this.kind = kind; // 'rpc' (node returned an error) | 'network' | 'timeout'
  }
}

async function post(endpoint, method, params, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
      signal: controller.signal,
    });
    if (!res.ok) throw new RpcError(`RPC HTTP ${res.status}`, 'network');
    const data = await res.json();
    if (data.error) throw new RpcError(data.error.message || 'RPC error', 'rpc');
    return data.result;
  } catch (err) {
    if (err instanceof RpcError) throw err;
    throw new RpcError(err?.name === 'AbortError' ? 'RPC request timed out' : 'RPC network error', err?.name === 'AbortError' ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
}

async function withFailover(method, params, timeoutMs) {
  let lastError = new RpcError('All RPC endpoints failed', 'network');
  // A node's own JSON-RPC answer (for example "Block not available for slot N") is the real
  // result of the request. If other endpoints are merely unreachable, report that answer
  // instead of the later network failure.
  let nodeError = null;
  const now = Date.now();
  // Endpoints in cooldown are tried last rather than skipped, so a full outage still gets a retry.
  const order = endpoints.map((_, i) => (preferred + i) % endpoints.length)
    .sort((a, b) => (cooldownUntil[a] > now ? 1 : 0) - (cooldownUntil[b] > now ? 1 : 0));
  for (const idx of order) {
    try {
      const result = await post(endpoints[idx], method, params, timeoutMs);
      preferred = idx;
      cooldownUntil[idx] = 0;
      return result;
    } catch (err) {
      lastError = err;
      if (err.kind === 'rpc' && !nodeError) nodeError = err;
      // A node-level error (bad params, unsupported method) will not improve on another attempt
      // against the same node, but another endpoint may support it, so keep going.
      if (err.kind !== 'rpc') cooldownUntil[idx] = Date.now() + 15000;
    }
  }
  throw nodeError || lastError;
}

/**
 * @param {string} method
 * @param {any[]} [params]
 * @param {string|null} [cacheKey]  cache the result under this key
 * @param {'short'|'medium'|'long'} [cacheDuration]
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function rpcCall(method, params = [], cacheKey = null, cacheDuration = 'short', opts = {}) {
  if (cacheKey) {
    const cached = getCached(cacheKey);
    if (cached !== null && cached !== undefined) return cached;
  }
  const key = method + ':' + JSON.stringify(params);
  let pending = inflight.get(key);
  if (!pending) {
    pending = withFailover(method, params, opts.timeoutMs ?? X1_CONFIG.rpcTimeoutMs).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  const result = await pending;
  if (cacheKey) setCache(cacheKey, result, cacheDuration);
  return result;
}

export function getRpcEndpoints() {
  return [...endpoints];
}

export default { rpcCall, getRpcEndpoints };
