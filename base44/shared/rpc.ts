// Server-side JSON-RPC client for X1 mainnet with ordered failover.
import { fetchJson, type FetchLike, UpstreamError } from './upstream.ts';

// The same endpoints the explorer already used. The first is authoritative.
export const RPC_ENDPOINTS = ['https://rpc.mainnet.x1.xyz', 'https://rpc.x1galaxy.io/'];

export type RpcCall = <T = any>(method: string, params?: unknown[], opts?: { timeoutMs?: number; maxBytes?: number }) => Promise<T>;

export function createRpc(fetchImpl: FetchLike, endpoints: string[] = RPC_ENDPOINTS): RpcCall {
  let preferred = 0;
  let id = 0;
  return async (method, params = [], opts = {}) => {
    let lastErr: unknown = new UpstreamError('rpc', 502, 'failed');
    for (let i = 0; i < endpoints.length; i++) {
      const idx = (preferred + i) % endpoints.length;
      try {
        const data = await fetchJson<any>(fetchImpl, endpoints[idx], {
          source: 'rpc',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
          timeoutMs: opts.timeoutMs ?? 12_000,
          maxBytes: opts.maxBytes ?? 24_000_000,
          retries: 0,
        });
        if (data?.error) {
          lastErr = new UpstreamError('rpc', 502, 'rpc_error');
          continue;
        }
        preferred = idx;
        return data.result;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  };
}
