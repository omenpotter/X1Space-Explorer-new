// Validator identity (on-chain validator-info config accounts) and approximate
// node locations. Raw IP addresses never leave this module.
import type { Cache } from './cache.ts';
import type { RpcCall } from './rpc.ts';
import type { KVStore } from './store.ts';
import { type FetchLike, fetchJson } from './upstream.ts';
import { cleanString } from './solana.ts';
import { isAddress, safeHttpsUrl } from './validate.ts';

export interface ValidatorIdentity {
  name: string | null;
  website: string | null;
  details: string | null;
  iconUrl: string | null; // internal only: the browser gets `hasIcon` and loads through the image proxy
}

const CONFIG_PROGRAM = 'Config1111111111111111111111111111111111111';

/** identity pubkey -> published validator info. Self-published by operators, so treated as untrusted text. */
export async function fetchIdentities(rpc: RpcCall): Promise<Map<string, ValidatorIdentity>> {
  const accounts = await rpc<any[]>('getProgramAccounts', [CONFIG_PROGRAM, { encoding: 'jsonParsed' }], { timeoutMs: 20_000, maxBytes: 16_000_000 });
  if (!Array.isArray(accounts)) throw new Error('config: unexpected shape');
  const out = new Map<string, ValidatorIdentity>();
  for (const a of accounts) {
    const parsed = a?.account?.data?.parsed;
    if (parsed?.type !== 'validatorInfo') continue;
    const keys = parsed.info?.keys;
    // keys[0] is the validator-info marker; keys[1] is the identity, which must have signed.
    const idKey = Array.isArray(keys) ? keys[1] : null;
    if (!idKey?.signer || !isAddress(idKey.pubkey)) continue;
    const cd = parsed.info?.configData || {};
    const name = typeof cd.name === 'string' ? cleanString(cd.name, 60) : '';
    out.set(idKey.pubkey, {
      name: name || null,
      website: safeHttpsUrl(cd.website),
      details: typeof cd.details === 'string' ? cleanString(cd.details, 300) || null : null,
      iconUrl: safeHttpsUrl(cd.iconUrl),
    });
  }
  return out;
}

export interface NodeLocation {
  country: string | null;
  countryCode: string | null;
  /** Two-letter continent code from the provider (NA, SA, EU, AF, AS, OC, AN), when known. */
  continent: string | null;
  lat: number;
  lon: number;
  /** 'city' when the provider reports a tight radius, otherwise 'country' (a country centroid). */
  precision: 'city' | 'country';
}

interface GeoRecord {
  loc: NodeLocation | null;
  provider: string | null;
}

const GEO_URL = 'https://get.geojs.io/v1/ip/geo.json?ip=';
const GEO_TTL = 7 * 24 * 3600_000;

function publicIpv4(addr: unknown): string | null {
  if (typeof addr !== 'string') return null;
  const ip = addr.split(':')[0];
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return null;
  // Skip private, loopback, link-local, CGNAT and multicast ranges.
  if (a === 10 || a === 127 || a === 0 || a >= 224) return null;
  if (a === 172 && b >= 16 && b <= 31) return null;
  if (a === 192 && b === 168) return null;
  if (a === 169 && b === 254) return null;
  if (a === 100 && b >= 64 && b <= 127) return null;
  return ip;
}

function toRecord(g: any): GeoRecord {
  const lat = Number(g?.latitude);
  const lon = Number(g?.longitude);
  const provider = typeof g?.organization_name === 'string' ? cleanString(g.organization_name, 60) || null : null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return { loc: null, provider };
  const accuracy = Number(g?.accuracy);
  return {
    provider,
    loc: {
      country: typeof g.country === 'string' ? cleanString(g.country, 60) : null,
      countryCode: typeof g.country_code === 'string' ? cleanString(g.country_code, 2).toUpperCase() : null,
      continent: typeof g.continent_code === 'string' && /^[A-Za-z]{2}$/.test(g.continent_code) ? g.continent_code.toUpperCase() : null,
      // One decimal place (about 11 km): enough for a map, not enough to pinpoint a site.
      lat: Math.round(lat * 10) / 10,
      lon: Math.round(lon * 10) / 10,
      precision: Number.isFinite(accuracy) && accuracy <= 200 ? 'city' : 'country',
    },
  };
}

/** Resolve IPs through the geolocation provider, using the shared store as a 7-day cache. */
export async function geolocate(fetchImpl: FetchLike, store: KVStore, ips: string[]): Promise<Map<string, GeoRecord>> {
  const out = new Map<string, GeoRecord>();
  const missing: string[] = [];
  await Promise.all(ips.map(async (ip) => {
    const hit = await store.get<GeoRecord>(`geo:${ip}`).catch(() => null);
    if (hit) out.set(ip, hit);
    else missing.push(ip);
  }));
  for (let i = 0; i < missing.length && i < 600; i += 100) {
    const batch = missing.slice(i, i + 100);
    let rows: any[];
    try {
      const r = await fetchJson<any>(fetchImpl, GEO_URL + batch.join(','), { source: 'geojs', timeoutMs: 12_000, retries: 1, maxBytes: 2_000_000 });
      rows = Array.isArray(r) ? r : [r];
    } catch {
      continue; // leave this batch unresolved; it is retried on the next refresh
    }
    for (const g of rows) {
      if (typeof g?.ip !== 'string' || !batch.includes(g.ip)) continue;
      const rec = toRecord(g);
      out.set(g.ip, rec);
      await store.set(`geo:${g.ip}`, rec, GEO_TTL).catch(() => {});
    }
  }
  return out;
}

export interface Directory {
  validators: Record<string, { name: string | null; website: string | null; details: string | null; hasIcon: boolean }>;
  locations: Record<string, NodeLocation>;
  providers: { name: string; nodes: number }[];
  nodes: { total: number; located: number; unlocated: number };
  sources: Record<string, { status: 'ok' | 'error'; fetchedAt: string | null }>;
  fetchedAt: string;
}

export interface DirectoryCtx {
  rpc: RpcCall;
  fetch: FetchLike;
  cache: Cache;
  store: KVStore;
  geoEnabled: boolean;
}

export async function getIdentities(ctx: Pick<DirectoryCtx, 'rpc' | 'cache'>) {
  return ctx.cache.get('validator-identities', { ttlMs: 10 * 60_000, staleMs: 6 * 3600_000 }, () => fetchIdentities(ctx.rpc));
}

export async function getDirectory(ctx: DirectoryCtx): Promise<Directory> {
  const r = await ctx.cache.get('validator-directory', { ttlMs: 5 * 60_000, staleMs: 6 * 3600_000 }, async () => {
    const [idents, nodes, votes] = await Promise.all([
      getIdentities(ctx).then((x) => x.value).catch(() => null),
      ctx.rpc<any[]>('getClusterNodes').catch(() => null),
      ctx.rpc<any>('getVoteAccounts').catch(() => null),
    ]);
    if (!idents && !nodes) throw new Error('directory: no source available');

    // Only publish identities that actually run on this cluster.
    const relevant = new Set<string>();
    for (const n of nodes ?? []) if (isAddress(n?.pubkey)) relevant.add(n.pubkey);
    for (const v of [...(votes?.current ?? []), ...(votes?.delinquent ?? [])]) if (isAddress(v?.nodePubkey)) relevant.add(v.nodePubkey);

    const validators: Directory['validators'] = {};
    for (const id of relevant) {
      const i = idents?.get(id);
      if (i) validators[id] = { name: i.name, website: i.website, details: i.details, hasIcon: !!i.iconUrl };
    }

    const ipById = new Map<string, string>();
    for (const n of nodes ?? []) {
      const ip = publicIpv4(n?.gossip);
      if (ip && isAddress(n?.pubkey)) ipById.set(n.pubkey, ip);
    }
    const locations: Directory['locations'] = {};
    const providerCount = new Map<string, number>();
    let geoOk = false;
    if (ctx.geoEnabled && ipById.size > 0) {
      const geo = await geolocate(ctx.fetch, ctx.store, [...new Set(ipById.values())]);
      geoOk = geo.size > 0;
      for (const [id, ip] of ipById) {
        const rec = geo.get(ip);
        if (rec?.loc) locations[id] = rec.loc;
        if (rec?.provider) providerCount.set(rec.provider, (providerCount.get(rec.provider) ?? 0) + 1);
      }
    }
    const located = Object.keys(locations).length;
    const total = (nodes ?? []).length;
    return {
      validators,
      locations,
      providers: [...providerCount.entries()].map(([name, n]) => ({ name, nodes: n })).sort((a, b) => b.nodes - a.nodes).slice(0, 25),
      nodes: { total, located, unlocated: total - located },
      sources: {
        identity: { status: idents ? 'ok' : 'error', fetchedAt: idents ? new Date().toISOString() : null },
        cluster: { status: nodes ? 'ok' : 'error', fetchedAt: nodes ? new Date().toISOString() : null },
        geolocation: { status: geoOk ? 'ok' : 'error', fetchedAt: geoOk ? new Date().toISOString() : null },
      },
      fetchedAt: new Date().toISOString(),
    } as Directory;
  });
  return r.value;
}
