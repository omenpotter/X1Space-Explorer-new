// Server-side request forgery (SSRF) defences for URLs that come from untrusted data (token metadata, validator
// icons). Three layers, from strongest guarantee to weakest:
//
//   1. Lexical: hostnameVerdict() refuses names that are internal, reserved, IP-like, or on a wildcard-DNS service.
//      Always on. Works on the canonical hostname the WHATWG URL parser produces (it already turns decimal, hex,
//      octal and short IPv4 forms and IPv4-mapped IPv6 into canonical text).
//   2. Resolved-address: when the runtime can resolve DNS (`Deno.resolveDns`), every A/AAAA answer must be a public
//      address (isPublicIp), checked before the first request and before every redirect hop. NOT available on
//      (so it is a no-op wherever the runtime offers no resolver). Base44's documentation calls its backend runtime
//      "Deno" but also describes isolates as "Workers"; whether `Deno.resolveDns` exists there is UNVERIFIED, and this
//      layer activates only if it does.
//   3. Network: the platform must refuse private and link-local destinations itself. Not verifiable from code.
//
// What cannot be done from code: pin the connection to the address that was checked. `fetch` resolves the name again,
// so a DNS-rebinding attacker who answers differently the second time defeats layer 2. This module therefore reduces
// the exposure; it does not eliminate SSRF, and callers must not claim it does.
import { type FetchLike, UpstreamError } from './upstream.ts';

// ---------- Hostnames ----------

/** Top-level and special-use names that never identify a public host. */
const PRIVATE_SUFFIXES = [
  'local', 'localhost', 'localdomain', 'internal', 'intranet', 'private', 'corp', 'home', 'lan', 'home.arpa',
  'arpa', 'test', 'invalid', 'onion', 'ts.net', 'cluster.local',
];

/** Public wildcard-DNS services that map `<ip>.<service>` to that IP. Their purpose is to point a public name at a private address. */
const REBINDING_SERVICES = [
  'nip.io', 'sslip.io', 'xip.io', 'localtest.me', 'lvh.me', 'vcap.me', 'lacolhost.com', 'local.gd', 'traefik.me',
  '1u.ms', 'nip.direct', 'fbi.com', 'burpcollaborator.net', 'oastify.com', 'interact.sh', 'requestbin.net',
];

const matchesSuffix = (host: string, suffix: string) => host === suffix || host.endsWith('.' + suffix);

/**
 * Why a hostname must not be fetched, or null when it looks like an ordinary public DNS name.
 * `hostname` is `new URL(...).hostname` (already lowercase and IDNA-normalised).
 */
export function hostnameVerdict(hostname: string): string | null {
  let h = hostname.toLowerCase();
  if (h.startsWith('[') || h.includes(':')) return 'ipv6_literal';
  // One trailing dot is the legal absolute form of the same name ("localhost." is "localhost"). More is malformed.
  if (h.endsWith('.')) h = h.slice(0, -1);
  if (!h || h.endsWith('.') || h.startsWith('.') || h.includes('..')) return 'malformed';
  if (h.length > 253) return 'too_long';
  if (!h.includes('.')) return 'single_label';
  const labels = h.split('.');
  if (labels.some((l) => l.length === 0 || l.length > 63 || !/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/.test(l))) return 'bad_label';
  // IPv4 in any form: after canonicalisation it is four numeric labels; a numeric or hex final label is also an IP form.
  if (/^\d+$/.test(labels[labels.length - 1]) || /^0x[0-9a-f]*$/.test(labels[labels.length - 1])) return 'ip_literal';
  if (PRIVATE_SUFFIXES.some((s) => matchesSuffix(h, s))) return 'private_suffix';
  if (REBINDING_SERVICES.some((s) => matchesSuffix(h, s))) return 'rebinding_service';
  // A name that spells out an IPv4 address ("10.0.0.1.attacker.example") is how rebinding names are usually built.
  for (let i = 0; i + 3 < labels.length; i++) {
    if (labels.slice(i, i + 4).every((l) => /^\d{1,3}$/.test(l) && Number(l) <= 255)) return 'embedded_ip';
  }
  // Hyphenated form used by the same services ("127-0-0-1.example").
  if (labels.some((l) => /^(\d{1,3}-){3}\d{1,3}$/.test(l))) return 'embedded_ip';
  return null;
}

// ---------- IP addresses ----------

export function parseIPv4(s: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  return o.every((n) => n <= 255) ? o : null;
}

/** Expand an IPv6 address (including `::` and a dotted IPv4 tail) to eight 16-bit groups, or null. */
export function parseIPv6(input: string): number[] | null {
  let s = input.trim().toLowerCase();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);
  if (!s.includes(':')) return null;
  const tail = s.slice(s.lastIndexOf(':') + 1);
  if (tail.includes('.')) {
    const v4 = parseIPv4(tail);
    if (!v4) return null;
    s = s.slice(0, s.lastIndexOf(':') + 1) + ((v4[0] << 8) | v4[1]).toString(16) + ':' + ((v4[2] << 8) | v4[3]).toString(16);
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string) => (part === '' ? [] : part.split(':'));
  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/** True when an IPv4 address is a normal public unicast address. */
export function isPublicIPv4(o: number[]): boolean {
  const [a, b, c] = o;
  if (a === 0 || a === 10 || a === 127) return false; // "this network", private, loopback
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT (also Alibaba metadata 100.100.100.200)
  if (a === 169 && b === 254) return false; // link-local, including cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // IETF protocol assignments, TEST-NET-1
  if (a === 192 && b === 88 && c === 99) return false; // 6to4 relay anycast (deprecated)
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return false; // TEST-NET-3
  if (a >= 224) return false; // multicast, reserved, broadcast
  return true;
}

/** True when an IPv6 address is public unicast. IPv4-embedding forms are judged by the IPv4 address they carry. */
export function isPublicIPv6(g: number[]): boolean {
  const embedded = (hi: number, lo: number) => [hi >> 8, hi & 255, lo >> 8, lo & 255];
  const allZero = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);
  if (allZero(0, 8)) return false; // ::
  if (allZero(0, 7) && g[7] === 1) return false; // ::1
  if (allZero(0, 5) && g[5] === 0xffff) return isPublicIPv4(embedded(g[6], g[7])); // ::ffff:a.b.c.d (IPv4-mapped)
  if (allZero(0, 6)) return isPublicIPv4(embedded(g[6], g[7])); // ::a.b.c.d (IPv4-compatible, deprecated)
  if (g[0] === 0x64 && g[1] === 0xff9b && allZero(2, 6)) return isPublicIPv4(embedded(g[6], g[7])); // 64:ff9b::/96 NAT64
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 1) return false; // 64:ff9b:1::/48 local-use NAT64
  if (g[0] === 0x2002) return isPublicIPv4(embedded(g[1], g[2])); // 6to4 carries an IPv4 address
  if (g[0] === 0x2001 && g[1] === 0) return false; // Teredo
  if (g[0] === 0x2001 && g[1] === 0xdb8) return false; // documentation
  if ((g[0] & 0xfe00) === 0xfc00) return false; // unique local fc00::/7 (includes AWS metadata fd00:ec2::254)
  if ((g[0] & 0xffc0) === 0xfe80) return false; // link-local
  if ((g[0] & 0xffc0) === 0xfec0) return false; // site-local (deprecated)
  if ((g[0] & 0xff00) === 0xff00) return false; // multicast
  if (g[0] === 0x100 && allZero(1, 4)) return false; // discard-only 100::/64
  return (g[0] & 0xe000) === 0x2000; // only global unicast 2000::/3 is public
}

/** True for a public address in any textual form (IPv4 dotted, IPv6 with or without brackets). */
export function isPublicIp(address: string): boolean {
  const v4 = parseIPv4(address.trim());
  if (v4) return isPublicIPv4(v4);
  const v6 = parseIPv6(address);
  return v6 ? isPublicIPv6(v6) : false; // anything unparseable is refused
}

// ---------- Resolver and guarded fetch ----------

/** Resolves a hostname to every address it points to. Rejects when the name does not resolve. */
export type Resolver = (hostname: string) => Promise<string[]>;

/** A resolver backed by `Deno.resolveDns`, or null where the runtime has none (checked at runtime, never assumed). */
export function runtimeResolver(): Resolver | null {
  const dns = (globalThis as any).Deno?.resolveDns;
  if (typeof dns !== 'function') return null;
  return async (host) => {
    const [a, aaaa] = await Promise.allSettled([dns.call((globalThis as any).Deno, host, 'A'), dns.call((globalThis as any).Deno, host, 'AAAA')]);
    const out: string[] = [];
    for (const r of [a, aaaa]) if (r.status === 'fulfilled' && Array.isArray(r.value)) out.push(...r.value.map(String));
    if (out.length === 0) throw new Error('no address');
    return out;
  };
}

export interface GuardOptions {
  /** Address resolver. Omit to rely on the lexical checks (and the platform) alone. */
  resolve?: Resolver | null;
  /** Validates the URL itself (scheme, port, hostname). */
  validateUrl: (url: string) => string | null;
  now?: () => number;
  /** How long a resolution result may be reused. Short: a stale answer weakens the rebinding check. */
  cacheMs?: number;
}

/**
 * Wrap a fetch so that every request, including every redirect hop (callers follow redirects by hand through this
 * function), passes the URL validator and, when a resolver exists, resolves only to public addresses. A refusal
 * throws before any network request is made.
 */
export function createGuardedFetch(inner: FetchLike, opts: GuardOptions): FetchLike {
  const now = opts.now ?? Date.now;
  const cacheMs = opts.cacheMs ?? 30_000;
  const seen = new Map<string, number>(); // hostname -> time a public resolution was last confirmed
  return async (input, init) => {
    const url = opts.validateUrl(input);
    if (!url) throw new UpstreamError('ssrf', 403, 'url_refused');
    const resolve = opts.resolve;
    if (resolve) {
      const host = new URL(url).hostname.replace(/\.$/, '');
      const t = now();
      if (!((seen.get(host) ?? -Infinity) > t - cacheMs)) {
        let addrs: string[];
        try {
          addrs = await resolve(host);
        } catch {
          throw new UpstreamError('ssrf', 403, 'resolve_failed'); // cannot prove it is public: refuse
        }
        if (addrs.length === 0 || !addrs.every(isPublicIp)) throw new UpstreamError('ssrf', 403, 'private_address');
        if (seen.size > 500) seen.clear();
        seen.set(host, t);
      }
    }
    return inner(url, init);
  };
}
