// Image proxy. The browser never supplies a URL: it names a validator identity or a
// token mint, and the server looks up the URL it already holds for that record.
import { type FetchLike } from './upstream.ts';
import { safeHttpsUrl } from './validate.ts';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];
const MAX_BYTES = 1_000_000;

export interface ProxiedImage {
  bytes: Uint8Array;
  contentType: string;
}

/** Fetch an image with scheme, host, redirect, type and size checks. Returns null on any failure. */
export async function fetchImage(fetchImpl: FetchLike, rawUrl: string): Promise<ProxiedImage | null> {
  let url = safeHttpsUrl(rawUrl);
  for (let hop = 0; hop < 4 && url; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6_000);
    try {
      const res = await fetchImpl(url, { redirect: 'manual', signal: controller.signal, headers: { Accept: 'image/*' } });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        try { await res.body?.cancel(); } catch { /* ignore */ }
        // Every redirect target is re-validated, so a redirect cannot reach an internal host.
        url = loc ? safeHttpsUrl(new URL(loc, url).toString()) : null;
        continue;
      }
      if (!res.ok) return null;
      const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!ALLOWED_TYPES.includes(type)) return null; // SVG and HTML are refused
      const declared = Number(res.headers.get('content-length') || '0');
      if (declared > MAX_BYTES) return null;
      const reader = res.body?.getReader();
      if (!reader) return null;
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
          try { await reader.cancel(); } catch { /* ignore */ }
          return null;
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        bytes.set(c, off);
        off += c.byteLength;
      }
      if (!looksLikeImage(bytes, type)) return null;
      return { bytes, contentType: type };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** Check magic bytes so a mislabelled response is not served as an image. */
function looksLikeImage(b: Uint8Array, type: string): boolean {
  const starts = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  const ascii = (off: number, s: string) => [...s].every((ch, i) => b[off + i] === ch.charCodeAt(0));
  switch (type) {
    case 'image/png': return starts(0x89, 0x50, 0x4e, 0x47);
    case 'image/jpeg': return starts(0xff, 0xd8, 0xff);
    case 'image/gif': return ascii(0, 'GIF8');
    case 'image/webp': return ascii(0, 'RIFF') && ascii(8, 'WEBP');
    case 'image/avif': return ascii(4, 'ftyp');
    default: return false;
  }
}

export function imageResponse(img: ProxiedImage): Response {
  return new Response(img.bytes as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': img.contentType,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export function imageNotFound(): Response {
  return new Response(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=600', 'X-Content-Type-Options': 'nosniff' } });
}
