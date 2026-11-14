// Bounded, safe outbound HTTP: timeouts, limited retries with backoff, size caps.

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class UpstreamError extends Error {
  name = 'UpstreamError';
  constructor(public source: string, public status: number, public kind: string) {
    super(`${source} ${kind}`);
  }
}

export interface FetchJsonOptions {
  source: string;
  timeoutMs?: number;
  retries?: number; // extra attempts after the first; capped at 2
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  maxBytes?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function readCapped(res: Response, maxBytes: number, source: string): Promise<string> {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw new UpstreamError(source, 502, 'response_too_large');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export async function fetchJson<T = any>(fetchImpl: FetchLike, url: string, opts: FetchJsonOptions): Promise<T> {
  const retries = Math.min(2, Math.max(0, opts.retries ?? 1));
  const sleep = opts.sleep ?? defaultSleep;
  let lastErr: UpstreamError = new UpstreamError(opts.source, 502, 'failed');
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
    try {
      const res = await fetchImpl(url, {
        method: opts.method || 'GET',
        headers: { Accept: 'application/json', ...(opts.headers || {}) },
        body: opts.body,
        signal: controller.signal,
      });
      if (res.ok) {
        const text = await readCapped(res, opts.maxBytes ?? 8_000_000, opts.source);
        try {
          return JSON.parse(text) as T;
        } catch {
          throw new UpstreamError(opts.source, 502, 'invalid_json');
        }
      }
      try { await res.body?.cancel(); } catch { /* ignore */ }
      lastErr = new UpstreamError(opts.source, res.status, res.status === 429 ? 'rate_limited' : 'http_error');
      // Only retry transient failures. Auth and client errors are final.
      if (res.status !== 429 && res.status < 500) throw lastErr;
      if (attempt < retries) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 3000)
          : 300 * 2 ** attempt + Math.floor(Math.random() * 150);
        await sleep(wait);
      }
    } catch (err) {
      if (err instanceof UpstreamError) {
        if (err.kind !== 'http_error' && err.kind !== 'rate_limited') throw err;
        if (err.status !== 429 && err.status < 500) throw err;
        lastErr = err;
      } else {
        lastErr = new UpstreamError(opts.source, 504, (err as any)?.name === 'AbortError' ? 'timeout' : 'network');
        if (attempt < retries) await sleep(300 * 2 ** attempt);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}
