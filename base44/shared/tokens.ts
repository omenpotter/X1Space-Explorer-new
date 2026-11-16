// Token index: on-chain mint discovery (SPL Token + Token-2022), on-chain metadata,
// and DEX market data (XDEX, optionally X1 Ninja). Each layer is independent: a token
// with no pool is still listed, and a failed source is reported rather than hidden.
//
// Memory matters here: a Base44 backend function call is limited to 128 MB. The index therefore keeps one
// small record per mint (a few numbers and two short strings) and builds full rows only for the few listed
// tokens and for the page being returned. Detail endpoints do not need the index at all: they read the one
// mint they were asked about (getTokenRow / getTokenDetail).
import type { Cache } from './cache.ts';
import type { RpcCall } from './rpc.ts';
import type { Xdex, XdexPool, XdexTotals } from './xdex.ts';
import type { Ninja, NinjaPool } from './ninja.ts';
import {
  base58Encode,
  base64Decode,
  cleanString,
  decodeMetaplexMetadata,
  decodeMintSlice,
  metaplexMetadataAddress,
  METAPLEX_PROGRAM,
  TOKEN_2022_PROGRAM,
  TOKEN_PROGRAM,
} from './solana.ts';
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

/** One mint as read from chain. Deliberately small: there is one of these per mint on the network. */
export interface ChainRec {
  program: 0 | 1; // 0 = SPL Token, 1 = Token-2022
  decimals: number;
  supply: number; // UI amount
  nft: boolean; // 0 decimals and a supply of at most 1
  name: string | null;
  symbol: string | null;
  ms: 0 | 1 | 2; // metadata source: none, Token-2022 extension, Metaplex
}

const MS_NAME = [null, 'token-2022', 'metaplex'] as const;
const iso = (t: number | null | undefined) => (t ? new Date(t).toISOString() : null);

function uiSupply(raw: bigint, decimals: number): number {
  const d = 10n ** BigInt(Math.min(decimals, 30));
  return Number(raw / d) + Number(raw % d) / Number(d);
}

// ---------- Chain ----------

/**
 * Discover every mint and its on-chain metadata. The four program scans run one after another and each
 * response is reduced to compact records before the next request starts, so only one large JSON document
 * is alive at a time.
 */
export async function discoverMints(rpc: RpcCall): Promise<Map<string, ChainRec>> {
  const slice = { offset: 36, length: 10 };
  const big = { timeoutMs: 30_000, maxBytes: 64_000_000 };
  const mints = new Map<string, ChainRec>();

  const addSlice = (list: any, program: 0 | 1) => {
    if (!Array.isArray(list)) throw new Error('chain: unexpected shape');
    for (const a of list) {
      const d = decodeMintSlice(a?.account?.data?.[0] ?? '');
      if (!d || !d.initialized || !isAddress(a.pubkey)) continue;
      mints.set(a.pubkey, { program, decimals: d.decimals, supply: uiSupply(d.supply, d.decimals), nft: d.decimals === 0 && d.supply <= 1n, name: null, symbol: null, ms: 0 });
    }
  };

  addSlice(await rpc('getProgramAccounts', [TOKEN_PROGRAM, { encoding: 'base64', filters: [{ dataSize: 82 }], dataSlice: slice }], big), 0);
  addSlice(await rpc('getProgramAccounts', [TOKEN_2022_PROGRAM, { encoding: 'base64', filters: [{ dataSize: 82 }], dataSlice: slice }], big), 1);

  // Token-2022 mints with extensions carry account type 1 at byte 165 and may embed their own metadata.
  const ext = await rpc<any[]>('getProgramAccounts', [TOKEN_2022_PROGRAM, { encoding: 'jsonParsed', filters: [{ memcmp: { offset: 165, bytes: '2' } }] }], big);
  if (!Array.isArray(ext)) throw new Error('chain: unexpected shape');
  for (const a of ext) {
    const info = a?.account?.data?.parsed?.info;
    if (a?.account?.data?.parsed?.type !== 'mint' || !info || !isAddress(a.pubkey)) continue;
    const rec = recFromParsedMint(info, 1);
    if (rec) mints.set(a.pubkey, rec);
  }

  // Metaplex metadata accounts (key 4): the slice holds mint, name and symbol. Optional layer.
  try {
    const mpx = await rpc<any[]>('getProgramAccounts', [METAPLEX_PROGRAM, { encoding: 'base64', filters: [{ memcmp: { offset: 0, bytes: '5' } }], dataSlice: { offset: 33, length: 86 } }], big);
    if (Array.isArray(mpx)) {
      for (const a of mpx) {
        try {
          const b = base64Decode(a?.account?.data?.[0] ?? '');
          if (b.length < 40) continue;
          const m = mints.get(base58Encode(b.subarray(0, 32)));
          if (!m || m.ms) continue;
          const dec = decodeMetaplexSlice(b);
          if (dec && (dec.name || dec.symbol)) {
            m.name = dec.name || null;
            m.symbol = dec.symbol || null;
            m.ms = 2;
          }
        } catch { /* skip malformed account */ }
      }
    }
  } catch { /* names for plain SPL tokens are optional */ }
  return mints;
}

/** Build a record from a parsed mint account (`info` of a jsonParsed mint). */
function recFromParsedMint(info: any, program: 0 | 1): ChainRec | null {
  let raw = 0n;
  try {
    raw = BigInt(info.supply ?? '0');
  } catch { /* keep 0 */ }
  const decimals = Number(info.decimals) || 0;
  const meta = (info.extensions || []).find((e: any) => e?.extension === 'tokenMetadata')?.state;
  const name = typeof meta?.name === 'string' ? cleanString(meta.name, 64) : '';
  const symbol = typeof meta?.symbol === 'string' ? cleanString(meta.symbol, 16) : '';
  return { program, decimals, supply: uiSupply(raw, decimals), nft: decimals === 0 && raw <= 1n, name: name || null, symbol: symbol || null, ms: name || symbol ? 1 : 0 };
}

/** The slice starts at the mint (32 bytes), then name (length-prefixed) and symbol. */
function decodeMetaplexSlice(b: Uint8Array): { name: string; symbol: string } | null {
  try {
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const dec = new TextDecoder();
    let off = 32;
    const read = (max: number) => {
      const len = view.getUint32(off, true);
      off += 4;
      if (len > max || off + len > b.length) throw new Error('bad');
      const s = dec.decode(b.subarray(off, off + len));
      off += len;
      return s;
    };
    return { name: cleanString(read(64), 64), symbol: cleanString(read(32), 16) };
  } catch {
    return null;
  }
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

// ---------- Market ----------

export interface Market {
  poolsByMint: Map<string, XdexPool[]>;
  ninjaByMint: Map<string, NinjaPool[]>;
  lpMints: Set<string>;
  totals: XdexTotals | null;
  poolCount: number | null;
  sources: { xdex: SourceStatus; x1ninja: SourceStatus };
  builtAt: string;
}

/** XDEX pools (and X1 Ninja pools when a key is configured), grouped by token. Small and cheap to rebuild. */
export async function getMarket(ctx: Pick<TokenCtx, 'xdex' | 'ninja' | 'cache'>): Promise<Market> {
  const m = await getMarketLenient(ctx);
  // Callers that need market data must not present an empty market as real.
  if (m.sources.xdex.status === 'error' && m.ninjaByMint.size === 0) throw new Error('market: no data source available');
  return m;
}

/** Like getMarket, but a failed source yields an empty market with its status reported. */
export async function getMarketLenient(ctx: Pick<TokenCtx, 'xdex' | 'ninja' | 'cache'>): Promise<Market> {
  const r = await ctx.cache.get('market', { ttlMs: 20_000, staleMs: 30 * 60_000 }, async () => {
    const [xdex, ninja] = await Promise.all([
      settle(ctx.cache, 'xdex-pools', MARKET_TTL, 30 * 60_000, () => ctx.xdex.listPools()),
      ctx.ninja.configured
        ? settle(ctx.cache, 'ninja-pools', NINJA_TTL, 30 * 60_000, () => ctx.ninja.listPools())
        : Promise.resolve({ value: null, status: 'not_configured' as const, fetchedAt: null }),
    ]);
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
    return {
      poolsByMint,
      ninjaByMint,
      lpMints,
      totals: xdex.value?.totals ?? null,
      poolCount: xdex.value?.pools.length ?? null,
      sources: {
        xdex: { status: xdex.status, fetchedAt: iso(xdex.fetchedAt), count: xdex.value?.pools.length },
        x1ninja: { status: ninja.status, fetchedAt: iso(ninja.fetchedAt), count: ninja.value?.pools.length },
      },
      builtAt: new Date().toISOString(),
    } as Market;
  });
  return r.value;
}

/** Build the full row for one mint from its chain record (if any) and the market. */
export function buildRow(mint: string, c: ChainRec | undefined, market: Market): TokenRow {
  const pools = market.poolsByMint.get(mint) ?? [];
  const npools = market.ninjaByMint.get(mint) ?? [];
  const isNative = mint === NATIVE_MINT;

  // Price, logo and symbol come from the deepest XDEX pool.
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
  const supply = c && !isNative ? c.supply : null;
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
  let metadataSource: TokenRow['metadataSource'] = c ? MS_NAME[c.ms] : null;
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

  const kind: TokenKind = market.lpMints.has(mint) ? 'lp' : c && c.nft ? 'nft' : 'fungible';
  return {
    mint,
    program: c ? (c.program === 1 ? 'token-2022' : 'spl-token') : null,
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
  };
}

// ---------- Index (list and search) ----------

export interface Snapshot {
  chain: Map<string, ChainRec>;
  market: Market;
  /** Full rows for the (few) mints that have market data. Every other row is built on demand. */
  marketRows: Map<string, TokenRow>;
  indexed: number;
  summary: { fungible: number; nft: number; lp: number; listed: number; token2022: number; pools: number | null; tvlUsd: number | null; volume24hUsd: number | null };
  sources: { chain: SourceStatus; xdex: SourceStatus; x1ninja: SourceStatus };
  builtAt: string;
}

export async function getSnapshot(ctx: TokenCtx): Promise<Snapshot> {
  const r = await ctx.cache.get('token-snapshot', { ttlMs: 30_000, staleMs: 10 * 60_000 }, () => buildSnapshot(ctx));
  return r.value;
}

async function buildSnapshot(ctx: TokenCtx): Promise<Snapshot> {
  const chain = await settle(ctx.cache, 'chain-mints', CHAIN_TTL, 6 * 3600_000, () => discoverMints(ctx.rpc));
  const market = await getMarketLenient(ctx);
  if (!chain.value && market.sources.xdex.status === 'error' && (market.sources.x1ninja.status === 'error' || market.sources.x1ninja.status === 'not_configured')) {
    throw new Error('tokens: no data source available');
  }
  const chainMap = chain.value ?? new Map<string, ChainRec>();

  const marketMints = new Set<string>([...market.poolsByMint.keys(), ...market.ninjaByMint.keys()]);
  const marketRows = new Map<string, TokenRow>();
  for (const mint of marketMints) marketRows.set(mint, buildRow(mint, chainMap.get(mint), market));

  let fungible = 0, nft = 0, lp = 0, token2022 = 0;
  for (const [mint, c] of chainMap) {
    if (c.program === 1) token2022++;
    const kind = market.lpMints.has(mint) ? 'lp' : c.nft ? 'nft' : 'fungible';
    if (kind === 'lp') lp++;
    else if (kind === 'nft') nft++;
    else fungible++;
  }
  let listed = 0;
  let marketOnly = 0;
  for (const [mint, row] of marketRows) {
    if (row.kind !== 'lp') listed++;
    if (!chainMap.has(mint)) {
      marketOnly++;
      if (row.kind === 'lp') lp++;
      else if (row.kind === 'nft') nft++;
      else fungible++;
    }
  }

  return {
    chain: chainMap,
    market,
    marketRows,
    indexed: chainMap.size + marketOnly,
    summary: { fungible, nft, lp, listed, token2022, pools: market.poolCount, tvlUsd: market.totals?.tvlUsd ?? null, volume24hUsd: market.totals?.volume24hUsd ?? null },
    sources: {
      chain: { status: chain.status, fetchedAt: iso(chain.fetchedAt), count: chain.value?.size },
      xdex: market.sources.xdex,
      x1ninja: market.sources.x1ninja,
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

const rowSort: Record<SortKey, (t: TokenRow) => number | string | null> = {
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
  const cands: { mint: string; key: number | string | null; listed: boolean }[] = [];

  const consider = (mint: string, c: ChainRec | undefined, row: TokenRow | undefined) => {
    const kind: TokenKind = row ? row.kind : snap.market.lpMints.has(mint) ? 'lp' : c && c.nft ? 'nft' : 'fungible';
    if (q.kind !== 'all' && kind !== q.kind) return;
    const program = row ? row.program : c ? (c.program === 1 ? 'token-2022' : 'spl-token') : null;
    if (q.program !== 'all' && program !== q.program) return;
    if (q.listedOnly && !row) return;
    const name = row ? row.name : c?.name ?? null;
    const symbol = row ? row.symbol : c?.symbol ?? null;
    if (needle) {
      // Addresses are case-sensitive; names and symbols are not.
      const hit = mint === q.q || mint.toLowerCase().startsWith(needle) || (symbol?.toLowerCase().includes(needle) ?? false) || (name?.toLowerCase().includes(needle) ?? false);
      if (!hit) return;
    }
    let key: number | string | null;
    if (row) key = rowSort[q.sort](row);
    else if (q.sort === 'supply') key = c ? c.supply : null;
    else if (q.sort === 'name') key = ((name || symbol || '').toLowerCase()) || null;
    else key = null; // no market data
    cands.push({ mint, key, listed: !!row });
  };

  for (const [mint, c] of snap.chain) consider(mint, c, snap.marketRows.get(mint));
  for (const [mint, row] of snap.marketRows) if (!snap.chain.has(mint)) consider(mint, undefined, row);

  const sign = q.dir === 'asc' ? 1 : -1;
  cands.sort((a, b) => {
    // Missing values always sort last, whichever direction is chosen.
    if (a.key === null && b.key === null) return a.mint < b.mint ? -1 : 1;
    if (a.key === null) return 1;
    if (b.key === null) return -1;
    if (a.key < b.key) return -1 * sign;
    if (a.key > b.key) return 1 * sign;
    // Stable tie-break: listed tokens first, then address.
    if (a.listed !== b.listed) return a.listed ? -1 : 1;
    return a.mint < b.mint ? -1 : 1;
  });
  const page = cands.slice(q.offset, q.offset + q.limit);
  const rows = page.map((c) => snap.marketRows.get(c.mint) ?? buildRow(c.mint, snap.chain.get(c.mint), snap.market));
  return { rows, total: cands.length };
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
      const j = await fetchJson<any>(ctx.fetch, uri, { source: 'token-metadata', timeoutMs: 5_000, retries: 0, maxBytes: 128_000, validateRedirect: safeHttpsUrl });
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

// ---------- One token ----------

/** Resolve a name for a mint with no embedded metadata through its Metaplex metadata account. */
async function metaplexName(rpc: RpcCall, mint: string): Promise<{ name: string; symbol: string } | null> {
  try {
    const pda = await metaplexMetadataAddress(mint);
    const m = await rpc<any>('getAccountInfo', [pda, { encoding: 'base64' }]);
    const raw = m?.value?.data?.[0];
    if (typeof raw !== 'string') return null;
    const dec = decodeMetaplexMetadata(base64Decode(raw));
    return dec && (dec.name || dec.symbol) ? { name: dec.name, symbol: dec.symbol } : null;
  } catch {
    return null;
  }
}

/** Read one mint: its chain record (from the mint account) plus the market. No full index needed. */
export async function getTokenRow(ctx: Pick<TokenCtx, 'rpc' | 'xdex' | 'ninja' | 'cache'>, mint: string) {
  const [market, acct] = await Promise.all([
    getMarketLenient(ctx),
    ctx.rpc<any>('getAccountInfo', [mint, { encoding: 'jsonParsed' }]).catch(() => undefined),
  ]);
  const parsed = acct?.value?.data?.parsed;
  let rec: ChainRec | null = null;
  if (parsed?.type === 'mint') {
    rec = recFromParsedMint(parsed.info, acct.value.owner === TOKEN_2022_PROGRAM ? 1 : 0);
    if (rec && !rec.ms) {
      const m = await metaplexName(ctx.rpc, mint);
      if (m) {
        rec.name = m.name || null;
        rec.symbol = m.symbol || null;
        rec.ms = 2;
      }
    }
  }
  const inMarket = market.poolsByMint.has(mint) || market.ninjaByMint.has(mint);
  if (!rec && !inMarket) return null;
  return { row: buildRow(mint, rec ?? undefined, market), market, acct: acct as any, rec };
}

export async function getTokenDetail(ctx: TokenCtx, mint: string) {
  const [loaded, largest, offchain] = await Promise.all([
    getTokenRow(ctx, mint),
    ctx.rpc<any>('getTokenLargestAccounts', [mint]).catch(() => null),
    getOffChainMeta(ctx, mint).catch(() => ({ image: null, description: null, uri: null })),
  ]);
  if (!loaded) return null;
  const { row, market, acct } = loaded;
  const parsed = acct?.value?.data?.parsed;
  const info = parsed?.type === 'mint' ? parsed.info : null;

  const xpools = market.poolsByMint.get(mint) ?? [];
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

  const decimals = info ? Number(info.decimals) : row.decimals;
  let supply = row.supply;
  if (info && mint !== NATIVE_MINT) {
    try {
      supply = uiSupply(BigInt(info.supply), Number(info.decimals));
    } catch { /* keep the row value */ }
  }
  const top = Array.isArray(largest?.value)
    ? largest.value.slice(0, 10).map((h: any) => ({
      address: String(h.address),
      amount: typeof h.uiAmount === 'number' ? h.uiAmount : Number(h.uiAmountString) || 0,
      share: supply && supply > 0 ? (Number(h.uiAmountString) || 0) / supply : null,
    }))
    : null;

  return {
    ...row,
    decimals,
    supply,
    priceChange24h: row.priceChange24h ?? change?.h24 ?? null,
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
    ninjaPools: (market.ninjaByMint.get(mint) ?? []).map((p) => p.address),
    sources: { chain: { status: acct ? 'ok' : 'error', fetchedAt: new Date().toISOString() }, xdex: market.sources.xdex, x1ninja: market.sources.x1ninja },
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
