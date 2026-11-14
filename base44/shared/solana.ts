// Minimal Solana primitives needed server-side: base58, program-derived addresses,
// and decoders for mint and Metaplex metadata accounts. No external dependencies.

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const ALPHABET_MAP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) ALPHABET_MAP[ALPHABET[i]] = i;

export function base58Decode(s: string): Uint8Array {
  let n = 0n;
  for (const c of s) {
    const v = ALPHABET_MAP[c];
    if (v === undefined) throw new Error('invalid base58');
    n = n * 58n + BigInt(v);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.push(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const c of s) {
    if (c !== '1') break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

export function base58Encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = '';
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = '1' + out;
  }
  return out;
}

export function base64Decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --- ed25519 curve membership (needed to find program-derived addresses) ---
const P = 2n ** 255n - 19n;
const D = 37095705934669439343138083508754565189542113879843219016388785533085940283555n;
const SQRT_M1 = 19681161376707505956807079304988542015446066515923890162744021073123829784752n;
const mod = (a: bigint) => ((a % P) + P) % P;
function pow(base: bigint, exp: bigint): bigint {
  let r = 1n;
  let b = mod(base);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) r = mod(r * b);
    b = mod(b * b);
    e >>= 1n;
  }
  return r;
}

export function isOnCurve(bytes: Uint8Array): boolean {
  if (bytes.length !== 32) return false;
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(i === 31 ? bytes[i] & 0x7f : bytes[i]);
  if (y >= P) return false;
  const y2 = mod(y * y);
  const u = mod(y2 - 1n);
  const v = mod(D * y2 + 1n);
  const v3 = mod(v * v * v);
  const v7 = mod(v3 * v3 * v);
  let x = mod(u * v3 * pow(u * v7, (P - 5n) / 8n));
  const vx2 = mod(v * x * x);
  if (vx2 === u) return true;
  if (vx2 === mod(-u)) {
    x = mod(x * SQRT_M1);
    return true;
  }
  return false;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data as BufferSource));
}

const PDA_MARKER = new TextEncoder().encode('ProgramDerivedAddress');

export async function findProgramAddress(seeds: Uint8Array[], programId: Uint8Array): Promise<Uint8Array> {
  for (let bump = 255; bump >= 0; bump--) {
    const parts = [...seeds, new Uint8Array([bump]), programId, PDA_MARKER];
    const buf = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let off = 0;
    for (const p of parts) {
      buf.set(p, off);
      off += p.length;
    }
    const hash = await sha256(buf);
    if (!isOnCurve(hash)) return hash;
  }
  throw new Error('no program address');
}

export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export const METAPLEX_PROGRAM = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';

const METAPLEX_BYTES = base58Decode(METAPLEX_PROGRAM);
const METADATA_SEED = new TextEncoder().encode('metadata');

export async function metaplexMetadataAddress(mint: string): Promise<string> {
  const pda = await findProgramAddress([METADATA_SEED, METAPLEX_BYTES, base58Decode(mint)], METAPLEX_BYTES);
  return base58Encode(pda);
}

function cleanString(s: string, max: number): string {
  // deno-lint-ignore no-control-regex
  return s.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\ufeff]/g, '').trim().slice(0, max);
}

export interface OnChainMetadata {
  name: string;
  symbol: string;
  uri: string;
}

/** Decode the name/symbol/uri from a Metaplex metadata account. Returns null if malformed. */
export function decodeMetaplexMetadata(data: Uint8Array): OnChainMetadata | null {
  try {
    if (data.length < 1 + 32 + 32 + 4) return null;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const dec = new TextDecoder('utf-8', { fatal: false });
    let off = 1 + 32 + 32;
    const readStr = (max: number) => {
      const len = view.getUint32(off, true);
      off += 4;
      if (len > max || off + len > data.length) throw new Error('bad length');
      const s = dec.decode(data.subarray(off, off + len));
      off += len;
      return s;
    };
    const name = cleanString(readStr(64), 64);
    const symbol = cleanString(readStr(32), 16);
    const uri = cleanString(readStr(400), 400);
    return { name, symbol, uri };
  } catch {
    return null;
  }
}

/** Decode supply (u64 LE), decimals and the initialised flag from mint bytes 36..46. */
export function decodeMintSlice(b64: string): { supply: bigint; decimals: number; initialized: boolean } | null {
  try {
    const b = base64Decode(b64);
    if (b.length < 10) return null;
    let supply = 0n;
    for (let i = 7; i >= 0; i--) supply = (supply << 8n) | BigInt(b[i]);
    return { supply, decimals: b[8], initialized: b[9] === 1 };
  } catch {
    return null;
  }
}

export { cleanString };
