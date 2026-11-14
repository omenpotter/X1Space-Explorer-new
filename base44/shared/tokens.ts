// Token index: on-chain mint discovery (SPL Token + Token-2022), on-chain metadata,
// and DEX market data (XDEX, optionally X1 Ninja). Each layer is independent: a token
// with no pool is still listed, and a failed source is reported rather than hidden.
import type { Cache } from './cache.ts';
import type { RpcCall } from './rpc.ts';
import type { Xdex, XdexPool, XdexTotals } from './xdex.ts';
import type { Ninja, NinjaPool } from './ninja.ts';
import {
  base64Decode,
  cleanString,
  decodeMetaplexMetadata,
  decodeMintSlice,
  metaplexMetadataAddress,
  METAPLEX_PROGRAM,
  TOKEN_2022_PROGRAM,
  TOKEN_PROGRAM,
} from './solana.ts';
import { base58Encode } from './solana.ts';
import { isAddress, safeHttpsUrl } from './validate.ts';
import { type FetchLike, fetchJson } from './upstream.ts';

export const NATIVE_MINT = 'So11111111111111111111111111111111111111112';

export interface TokenCtx {
  rpc: RpcCall;
  xdex: Xdex;
  ninja: Ninja;
  cache: Cache;
  fetch: FetchLike;
}

export type TokenKind = 'fungible' | 'nft' | 'lp';

export interface TokenRow {
  mint: string;
  program: 'spl-token' | 'token-2022' | null;
  kind: TokenKind;
  decimals: number | null;
  supply: number | null;
  name: string | null;
  symbol: string | null;
  metadataSource: 'token-2022' | 'metaplex' | 'xdex' | 'x1ninja' | null;
  logoUrl: string | null;
  listed: boolean;
  poolCount: number;
  priceUsd: number | null;
  priceChange24h: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  marketCapUsd: number | null;
  marketCapSource: 'supply x price' | 'x1ninja' | null;
  holders: number | null;
}

export interface SourceStatus {
  status: 'ok' | 'stale' | 'error' | 'not_configured';
  fetchedAt: string | null;
  count?: number;
}

export interface Snapshot {
  tokens: TokenRow[];
  byMint: Map<string, TokenRow>;
  poolsByMint: Map<string, XdexPool[]>;
  ninjaByMint: Map<string, NinjaPool[]>;
  xdexTotals: XdexTotals | null;
  summary: { fungible: number; nft: number; lp: number; listed: number; token2022: number; pools: number | null; tvlUsd: number | null; volume24hUsd: number | null };
  sources: { chain: SourceStatus; xdex: SourceStatus; x1ninja: SourceStatus };
  builtAt: string;
}

interface ChainMint {
  program: 'spl-token' | 'token-2022';
  decimals: number;
  supplyRaw: bigint;
  name: string | null;
  symbol: string | null;
  metadataSource: 'token-2022' | 'metaplex' | null;
}

const iso = (t: number | null | undefined) => (t ? new Date(t).toISOString() : null);

/** Discover every mint and its on-chain metadata. Five RPC calls, cached by the caller. */
export async function discoverMints(rpc: RpcCall): Promise<Map<string, ChainMint>> {
  const slice = { offset: 36, length: 10 };
  const big = { timeoutMs: 30_000, maxBytes: 64_000_000 };
  const [spl, t22plain, t22ext, mpx] = await Promise.all([
    rpc<any[]>('getProgramAccounts', [TOKEN_PROGRAM, { encoding: 'base64', filters: [{ dataSize: 82 }], dataSlice: slice }], big),
    rpc<any[]>('getProgramAccounts', [TOKEN_2022_PROGRAM, { encoding: 'base64', filters: [{ dataSize: 82 }], dataSlice: slice }], big),
    // Token-2022 mints with extensions carry account type 1 at byte 165.
    rpc<any[]>('getProgramAccounts', [TOKEN_2022_PROGRAM, { encoding: 'jsonParsed', filters: [{ memcmp: { offset: 165, bytes: '2' } }] }], big),
    // Metaplex metadata accounts (key = 4): slice = mint + name + symbol. Optional layer.
    rpc<any[]>('getProgramAccounts', [METAPLEX_PROGRAM, { encoding: 'base64', filters: [{ memcmp: { offset: 0, bytes: '5' } }], dataSlice: { offset: 33, length: 86 } }], big)
      .catch(() => [] as any[]),
  ]);
  if (!Array.isArray(spl) || !Array.isArray(t22plain) || !Array.isArray(t22ext)) throw new Error('chain: unexpected shape');

  const mints = new Map<string, ChainMint>();
  const addSlice = (list: any[], program: ChainMint['program']) => {
    for (const a of list) {
      const d = decodeMintSlice(a?.account?.data?.[0] ?? '');
      if (!d || !d.initialized || !isAddress(a.pubkey)) continue;
      mints.set(a.pubkey, { program, decimals: d.decimals, supplyRaw: d.supply, name: null, symbol: null, metadataSource: null });
    }
  };
  addSlice(spl, 'spl-token');
  addSlice(t22plain, 'token-2022');

  for (const a of t22ext) {
    const info = a?.account?.data?.parsed?.info;
    if (a?.account?.data?.parsed?.type !== 'mint' || !info || !isAddress(a.pubkey)) continue;
    let supplyRaw = 0n;
    try {
      supplyRaw = BigInt(info.supply ?? '0');
    } catch { /* keep 0 */ }
    const meta = (info.extensions || []).find((e: any) => e?.extension === 'tokenMetadata')?.state;
    const name = typeof meta?.name === 'string' ? cleanString(meta.name, 64) : '';
    const symbol = typeof meta?.symbol === 'string' ? cleanString(meta.symbol, 16) : '';
    mints.set(a.pubkey, {
      program: 'token-2022',
      decimals: Number(info.decimals) || 0,
      supplyRaw,
      name: name || null,
      symbol: symbol || null,
      metadataSource: name || symbol ? 'token-2022' : null,
    });
  }

  for (const a of mpx) {
    try {
      const b = base64Decode(a?.account?.data?.[0] ?? '');
      if (b.length < 40) continue;
      const mint = base58Encode(b.subarray(0, 32));
      const m = mints.get(mint);
      if (!m || m.metadataSource) continue;
      // Re-use the Metaplex decoder by rebuilding the expected prefix (key + update authority).
      const full = new Uint8Array(33 + b.length);
      full.set(b, 33);
      const dec = decodeMetaplexMetadataPrefix(full);
      if (dec && (dec.name || dec.symbol)) {
        m.name = dec.name || null;
        m.symbol = dec.symbol || null;
        m.metadataSource = 'metaplex';
      }
    } catch { /* skip malformed account */ }
  }
  return mints;
}

function decodeMetaplexMetadataPrefix(data: Uint8Array): { name: string; symbol: string } | null {
  try {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const dec = new TextDecoder();
    let off = 65;
    const read = (max: number) => {
      const len = view.getUint32(off, true);
      off += 4;
      if (len > max || off + len > data.length) throw new Error('bad');
      const s = dec.decode(data.subarray(off, off + len));
      off += len;
      return s;
    };
    return { name: cleanString(read(64), 64), symbol: cleanString(read(32), 16) };
  } catch {
    return null;
  }
}

function uiSupply(raw: bigint, decimals: number): number {
  const d = 10n ** BigInt(Math.min(decimals, 30));
  return Number(raw / d) + Number(raw % d) / Number(d);
}

async function settle<T>(cache: Cache, key: string, ttlMs: number, staleMs: number, loader: () => Promise<T>) {
  try {
    const r = await cache.get(key, { ttlMs, staleMs }, loader);
    return { value: r.value as T | null, status: (r.stale ? 'stale' : 'ok') as SourceStatus['status'], fetchedAt: r.fetchedAt as number | null };
  } catch {
    return { value: null as T | null, status: 'error' as SourceStatus['status'], fetchedAt: null as number | null };
  }
}

const CHAIN_TTL = 10 * 60_000;
const MARKET_TTL = 45_000;
const NINJA_TTL = 60_000; // one request per minute per instance stays far below the free quota

export async function getSnapshot(ctx: TokenCtx): Promise<Snapshot> {
  const r = await ctx.cache.get('token-snapshot', { ttlMs: 30_000, staleMs: 10 * 60_000 }, () => buildSnapshot(ctx));
  return r.value;
}

async function buildSnapshot(ctx: TokenCtx): Promise<Snapshot> {
  const [chain, xdex, ninja] = await Promise.all([
    settle(ctx.cache, 'chain-mints', CHAIN_TTL, 6 * 3600_000, () => discoverMints(ctx.rpc)),
    settle(ctx.cache, 'xdex-pools', MARKET_TTL, 30 * 60_000, () => ctx.xdex.listPools()),
    ctx.ninja.configured
      ? settle(ctx.cache, 'ninja-pools', NINJA_TTL, 30 * 60_000, () => ctx.ninja.listPools())
      : Promise.resolve({ value: null, status: 'not_configured' as const, fetchedAt: null }),
  ]);
  if (!chain.value && !xdex.value && !ninja.value) throw new Error('tokens: no data source available');

  const poolsByMint = new Map<string, XdexPool[]>();
  const lpMints = new Set<string>();
  for (const p of xdex.value?.pools ?? []) {
    if (p.lpMint) lpMints.add(p.lpMint);
    for (const s of [p.token1, p.token2]) {
      const list = poolsByMint.get(s.mint) ?? [];
      list.push(p);
      poolsByMint.set(s.mint, list);
    }
  }
  const ninjaByMint = new Map<string, NinjaPool[]>();
  for (const p of ninja.value?.pools ?? []) {
    if (!p.base.mint) continue; // cannot join to a mint without an address
    const list = ninjaByMint.get(p.base.mint) ?? [];
    list.push(p);
    ninjaByMint.set(p.base.mint, list);
  }

  const allMints = new Set<string>([...(chain.value?.keys() ?? []), ...poolsByMint.keys(), ...ninjaByMint.keys()]);
  const tokens: TokenRow[] = [];
  for (const mint of allMints) {
    const c = chain.value?.get(mint);
    const pools = poolsByMint.get(mint) ?? [];
    const npools = ninjaByMint.get(mint) ?? [];
    const isNative = mint === NATIVE_MINT;

    // Market fields: take price/logo/symbol from the deepest XDEX pool.
    let best: { pool: XdexPool; side: XdexPool['token1'] } | null = null;
    let liquidity: number | null = null;
    let volume: number | null = null;
    for (const p of pools) {
      const s = p.token1.mint === mint ? p.token1 : p.token2;
      if (p.tvlUsd !== null) liquidity = (liquidity ?? 0) + p.tvlUsd;
      if (s.volumeUsd24h !== null) volume = (volume ?? 0) + s.volumeUsd24h;
      if (!best || (p.tvlUsd ?? 0) > (best.pool.tvlUsd ?? 0)) best = { pool: p, side: s };
    }
    const nbest = npools.slice().sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0))[0] ?? null;

    const priceUsd = best?.side.priceUsd ?? nbest?.priceUsd ?? null;
    const supply = c && !isNative ? uiSupply(c.supplyRaw, c.decimals) : null;
    let marketCapUsd: number | null = null;
    let marketCapSource: TokenRow['marketCapSource'] = null;
    if (supply !== null && priceUsd !== null && supply > 0) {
      marketCapUsd = supply * priceUsd;
      marketCapSource = 'supply x price';
    } else if (nbest?.marketCapUsd != null) {
      marketCapUsd = nbest.marketCapUsd;
      marketCapSource = 'x1ninja';
    }

    let name = c?.name ?? null;
    let symbol = c?.symbol ?? null;
    let metadataSource: TokenRow['metadataSource'] = c?.metadataSource ?? null;
    if (!symbol && best?.side.symbol) {
      symbol = best.side.symbol;
      metadataSource = metadataSource ?? 'xdex';
    }
    if (!symbol && nbest?.base.symbol) {
      symbol = nbest.base.symbol;
      metadataSource = metadataSource ?? 'x1ninja';
    }
    if (!name && nbest?.base.name) name = nbest.base.name;
    if (isNative) {
      name = name ?? 'Wrapped XNT';
      symbol = symbol ?? 'WXNT';
    }

    const kind: TokenKind = lpMints.has(mint) ? 'lp' : c && c.decimals === 0 && c.supplyRaw <= 1n ? 'nft' : 'fungible';
    tokens.push({
      mint,
      program: c?.program ?? null,
      kind,
      decimals: c?.decimals ?? nbest?.base.decimals ?? null,
      supply,
      name,
      symbol,
      metadataSource,
      logoUrl: best?.side.logo ?? null,
      listed: pools.length > 0 || npools.length > 0,
      poolCount: Math.max(pools.length, npools.length),
      priceUsd,
      priceChange24h: nbest?.priceChange24h ?? null,
      liquidityUsd: liquidity ?? nbest?.liquidityUsd ?? null,
      volume24hUsd: volume ?? nbest?.volume24hUsd ?? null,
      marketCapUsd,
      marketCapSource,
      holders: nbest?.holders ?? null,
    });
  }

  const count = (f: (t: TokenRow) => boolean) => tokens.reduce((n, t) => n + (f(t) ? 1 : 0), 0);
  return {
    tokens,
    summary: {
      fungible: count((t) => t.kind === 'fungible'),
      nft: count((t) => t.kind === 'nft'),
      lp: count((t) => t.kind === 'lp'),
      listed: count((t) => t.listed && t.kind !== 'lp'),
      token2022: count((t) => t.program === 'token-2022'),
      pools: xdex.value?.pools.length ?? null,
      tvlUsd: xdex.value?.totals.tvlUsd ?? null,
      volume24hUsd: xdex.value?.totals.volume24hUsd ?? null,
    },
    byMint: new Map(tokens.map((t) => [t.mint, t])),
    poolsByMint,
    ninjaByMint,
    xdexTotals: xdex.value?.totals ?? null,
    sources: {
      chain: { status: chain.status, fetchedAt: iso(chain.fetchedAt), count: chain.value?.size },
      xdex: { status: xdex.status, fetchedAt: iso(xdex.fetchedAt), count: xdex.value?.pools.length },
      x1ninja: { status: ninja.status, fetchedAt: iso(ninja.fetchedAt), count: ninja.value?.pools.length },
    },
    builtAt: new Date().toISOString(),
  };
}

export const SORT_KEYS = ['liquidity', 'volume', 'marketCap', 'price', 'change', 'holders', 'supply', 'name'] as const;
export type SortKey = typeof SORT_KEYS[number];
export const KIND_FILTERS = ['fungible', 'nft', 'lp', 'all'] as const;
export const PROGRAM_FILTERS = ['all', 'spl-token', 'token-2022'] as const;

export interface ListQuery {
  q: string;
  sort: SortKey;
  dir: 'asc' | 'desc';
  kind: typeof KIND_FILTERS[number];
  program: typeof PROGRAM_FILTERS[number];
  listedOnly: boolean;
  limit: number;
  offset: number;
}

const sortValue: Record<SortKey, (t: TokenRow) => number | string | null> = {
  liquidity: (t) => t.liquidityUsd,
  volume: (t) => t.volume24hUsd,
  marketCap: (t) => t.marketCapUsd,
  price: (t) => t.priceUsd,
  change: (t) => t.priceChange24h,
  holders: (t) => t.holders,
  supply: (t) => t.supply,
  name: (t) => (t.name || t.symbol || '').toLowerCase() || null,
};

export function queryTokens(snap: Snapshot, q: ListQuery): { rows: TokenRow[]; total: number } {
  const needle = q.q.toLowerCase();
  let rows = snap.tokens.filter((t) => {
    if (q.kind !== 'all' && t.kind !== q.kind) return false;
    if (q.program !== 'all' && t.program !== q.program) return false;
    if (q.listedOnly && !t.listed) return false;
    if (needle) {
      // Addresses are case-sensitive; names and symbols are not.
      return t.mint === q.q || t.mint.toLowerCase().startsWith(needle) ||
        (t.symbol?.toLowerCase().includes(needle) ?? false) || (t.name?.toLowerCase().includes(needle) ?? false);
    }
    return true;
  });
  const get = sortValue[q.sort];
  const sign = q.dir === 'asc' ? 1 : -1;
  rows = rows.slice().sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    // Missing values always sort last, whichever direction is chosen.
    if (va === null && vb === null) return a.mint < b.mint ? -1 : 1;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va < vb) return -1 * sign;
    if (va > vb) return 1 * sign;
    // Stable tie-break: listed tokens first, then address.
    if (a.listed !== b.listed) return a.listed ? -1 : 1;
    return a.mint < b.mint ? -1 : 1;
  });
  return { rows: rows.slice(q.offset, q.offset + q.limit), total: rows.length };
}

// ---------- Per-token detail ----------

export interface OffChainMeta {
  image: string | null;
  description: string | null;
  uri: string | null;
}

/** Read the metadata URI for one mint (Token-2022 extension first, then Metaplex). */
export async function getMetadataUri(rpc: RpcCall, mint: string): Promise<string | null> {
  const acct = await rpc<any>('getAccountInfo', [mint, { encoding: 'jsonParsed' }]);
  const ext = acct?.value?.data?.parsed?.info?.extensions;
  const t22 = Array.isArray(ext) ? ext.find((e: any) => e?.extension === 'tokenMetadata')?.state?.uri : null;
  if (typeof t22 === 'string' && t22) return safeHttpsUrl(cleanString(t22, 400));
  const pda = await metaplexMetadataAddress(mint);
  const m = await rpc<any>('getAccountInfo', [pda, { encoding: 'base64' }]);
  const raw = m?.value?.data?.[0];
  if (typeof raw !== 'string') return null;
  const dec = decodeMetaplexMetadata(base64Decode(raw));
  return dec?.uri ? safeHttpsUrl(dec.uri) : null;
}

/**
 * Fetch the off-chain metadata JSON. The URI comes from chain data and is untrusted:
 * https only, public hostnames only, small size cap, short timeout, no retries.
 */
export async function getOffChainMeta(ctx: Pick<TokenCtx, 'rpc' | 'fetch' | 'cache'>, mint: string): Promise<OffChainMeta> {
  const r = await ctx.cache.get(`offchain:${mint}`, { ttlMs: 6 * 3600_000, staleMs: 24 * 3600_000 }, async () => {
    const uri = await getMetadataUri(ctx.rpc, mint);
    if (!uri) return { image: null, description: null, uri: null };
    try {
      const j = await fetchJson<any>(ctx.fetch, uri, { source: 'token-metadata', timeoutMs: 5_000, retries: 0, maxBytes: 128_000 });
      return {
        image: safeHttpsUrl(j?.image),
        description: typeof j?.description === 'string' ? cleanString(j.description, 600) || null : null,
        uri,
      };
    } catch {
      return { image: null, description: null, uri };
    }
  });
  return r.value;
}

export async function getTokenDetail(ctx: TokenCtx, mint: string) {
  const snap = await getSnapshot(ctx);
  const row = snap.byMint.get(mint) ?? null;

  const [acct, largest, offchain] = await Promise.all([
    ctx.rpc<any>('getAccountInfo', [mint, { encoding: 'jsonParsed' }]).catch(() => undefined),
    ctx.rpc<any>('getTokenLargestAccounts', [mint]).catch(() => null),
    getOffChainMeta(ctx, mint).catch(() => ({ image: null, description: null, uri: null })),
  ]);
  const parsed = acct?.value?.data?.parsed;
  const isMint = parsed?.type === 'mint';
  if (!row && !isMint) return null;
  const info = isMint ? parsed.info : null;

  const xpools = snap.poolsByMint.get(mint) ?? [];
  const main = xpools.slice().sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0))[0];
  let change: Record<string, number | null> | null = null;
  if (main) {
    const d = await ctx.cache.get(`xdex-pool:${main.address}`, { ttlMs: 60_000, staleMs: 10 * 60_000 }, () => ctx.xdex.getPool(main.address)).catch(() => null);
    const a = d?.value?.alpha;
    if (a && a.mint === mint) {
      const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
      change = { m5: n(a.price_change_5m), h1: n(a.price_change_1h), h6: n(a.price_change_6h), h24: n(a.price_change_24h) };
    }
  }

  const decimals = info ? Number(info.decimals) : row?.decimals ?? null;
  let supply = row?.supply ?? null;
  if (info && mint !== NATIVE_MINT) {
    try {
      supply = uiSupply(BigInt(info.supply), Number(info.decimals));
    } catch { /* keep index value */ }
  }
  const top = Array.isArray(largest?.value)
    ? largest.value.slice(0, 10).map((h: any) => ({
      address: String(h.address),
      amount: typeof h.uiAmount === 'number' ? h.uiAmount : Number(h.uiAmountString) || 0,
      share: supply && supply > 0 ? (Number(h.uiAmountString) || 0) / supply : null,
    }))
    : null;

  return {
    ...(row ?? {
      mint, program: null, kind: 'fungible', name: null, symbol: null, metadataSource: null, logoUrl: null, listed: false,
      poolCount: 0, priceUsd: null, priceChange24h: null, liquidityUsd: null, volume24hUsd: null, marketCapUsd: null,
      marketCapSource: null, holders: null,
    }),
    decimals,
    supply,
    priceChange24h: row?.priceChange24h ?? change?.h24 ?? null,
    priceChanges: change,
    mintAuthority: info ? info.mintAuthority ?? null : undefined,
    freezeAuthority: info ? info.freezeAuthority ?? null : undefined,
    extensions: info && Array.isArray(info.extensions) ? info.extensions.map((e: any) => String(e.extension)).slice(0, 20) : [],
    description: offchain.description,
    imageUrl: offchain.image,
    largestHolders: top,
    pools: xpools.map((p) => {
      const other = p.token1.mint === mint ? p.token2 : p.token1;
      return {
        address: p.address,
        pairedMint: other.mint,
        pairedSymbol: other.symbol,
        tvlUsd: p.tvlUsd,
        txns24h: p.txns24h,
        createdAt: p.createdAt,
        source: 'xdex',
      };
    }),
    ninjaPools: (snap.ninjaByMint.get(mint) ?? []).map((p) => p.address),
    sources: snap.sources,
    fetchedAt: new Date().toISOString(),
  };
}

/** Deterministic, rule-based risk review from on-chain facts. No model output involved. */
export function analyzeDetail(d: NonNullable<Awaited<ReturnType<typeof getTokenDetail>>>) {
  const findings: { level: 'info' | 'warn' | 'risk'; text: string }[] = [];
  let score = 10;
  const unknown: string[] = [];
  if (d.mintAuthority === undefined) unknown.push('mint and freeze authority');
  else {
    if (d.mintAuthority) {
      score -= 2;
      findings.push({ level: 'warn', text: 'Mint authority is active: supply can be increased.' });
    } else findings.push({ level: 'info', text: 'Mint authority is revoked: supply is fixed.' });
    if (d.freezeAuthority) {
      score -= 2;
      findings.push({ level: 'risk', text: 'Freeze authority is active: token accounts can be frozen.' });
    } else findings.push({ level: 'info', text: 'No freeze authority.' });
  }
  const top = d.largestHolders?.[0]?.share;
  if (top === null || top === undefined) unknown.push('holder concentration');
  else if (top > 0.5) {
    score -= 3;
    findings.push({ level: 'risk', text: `Largest account holds ${(top * 100).toFixed(1)}% of supply.` });
  } else if (top > 0.2) {
    score -= 1;
    findings.push({ level: 'warn', text: `Largest account holds ${(top * 100).toFixed(1)}% of supply.` });
  } else findings.push({ level: 'info', text: `Largest account holds ${(top * 100).toFixed(1)}% of supply.` });
  if (!d.listed) {
    score -= 2;
    findings.push({ level: 'warn', text: 'No DEX pool found: no market price or liquidity.' });
  } else if (d.liquidityUsd !== null && d.liquidityUsd < 1000) {
    score -= 1;
    findings.push({ level: 'warn', text: 'Pool liquidity is below $1,000.' });
  }
  if (!d.name && !d.symbol) {
    score -= 1;
    findings.push({ level: 'warn', text: 'No on-chain name or symbol.' });
  }
  if ((d.extensions || []).some((e: string) => e === 'transferHook' || e === 'transferFeeConfig' || e === 'permanentDelegate')) {
    findings.push({ level: 'warn', text: `Token-2022 extensions in use: ${d.extensions.join(', ')}.` });
  }
  score = Math.max(0, score);
  return {
    health_score: score,
    risk_level: score >= 8 ? 'Low' : score >= 5 ? 'Medium' : 'High',
    findings,
    not_assessed: unknown,
    method: 'Rule-based review of on-chain data. Not financial advice and not an audit.',
  };
}
