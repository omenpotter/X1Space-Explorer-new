import { Link } from 'react-router-dom';
import { CopyButton, Pill } from '@/components/ds/Primitives';
import { DASH, shortAddress } from '@/lib/format';
import { createPageUrl } from '@/utils';

// Everything in this file is derived from a transaction returned by the RPC.
// Program names are attached only to the fixed, well-known native / SPL program ids below.
// Any other program is identified by its address: nothing is guessed.

export const PROGRAM_IDS = {
  system: '11111111111111111111111111111111',
  token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  token2022: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
  associatedToken: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  stake: 'Stake11111111111111111111111111111111111111',
  vote: 'Vote111111111111111111111111111111111111111',
  computeBudget: 'ComputeBudget111111111111111111111111111111',
  memo: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
  memoV1: 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo',
  addressLookupTable: 'AddressLookupTab1e1111111111111111111111111',
  bpfLoaderUpgradeable: 'BPFLoaderUpgradeab1e11111111111111111111111',
};

const KNOWN_PROGRAMS = {
  [PROGRAM_IDS.system]: 'System Program',
  [PROGRAM_IDS.token]: 'SPL Token',
  [PROGRAM_IDS.token2022]: 'Token-2022',
  [PROGRAM_IDS.associatedToken]: 'Associated Token Account',
  [PROGRAM_IDS.stake]: 'Stake Program',
  [PROGRAM_IDS.vote]: 'Vote Program',
  [PROGRAM_IDS.computeBudget]: 'Compute Budget',
  [PROGRAM_IDS.memo]: 'Memo',
  [PROGRAM_IDS.memoV1]: 'Memo (v1)',
  [PROGRAM_IDS.addressLookupTable]: 'Address Lookup Table',
  [PROGRAM_IDS.bpfLoaderUpgradeable]: 'BPF Upgradeable Loader',
};

const SYSTEM_INSTRUCTIONS = ['CreateAccount', 'Assign', 'Transfer', 'CreateAccountWithSeed', 'AdvanceNonceAccount', 'WithdrawNonceAccount', 'InitializeNonceAccount', 'AuthorizeNonceAccount', 'Allocate', 'AllocateWithSeed', 'AssignWithSeed', 'TransferWithSeed', 'UpgradeNonceAccount'];
const TOKEN_INSTRUCTIONS = ['InitializeMint', 'InitializeAccount', 'InitializeMultisig', 'Transfer', 'Approve', 'Revoke', 'SetAuthority', 'MintTo', 'Burn', 'CloseAccount', 'FreezeAccount', 'ThawAccount', 'TransferChecked', 'ApproveChecked', 'MintToChecked', 'BurnChecked', 'InitializeAccount2', 'SyncNative', 'InitializeAccount3', 'InitializeMultisig2', 'InitializeMint2'];
const STAKE_INSTRUCTIONS = ['Initialize', 'Authorize', 'DelegateStake', 'Split', 'Withdraw', 'Deactivate', 'SetLockup', 'Merge', 'AuthorizeWithSeed', 'InitializeChecked', 'AuthorizeChecked', 'AuthorizeCheckedWithSeed', 'SetLockupChecked', 'GetMinimumDelegation', 'DeactivateDelinquent', 'Redelegate', 'MoveStake', 'MoveLamports'];
const VOTE_INSTRUCTIONS = ['InitializeAccount', 'Authorize', 'Vote', 'Withdraw', 'UpdateValidatorIdentity', 'UpdateCommission', 'VoteSwitch', 'AuthorizeChecked', 'UpdateVoteState', 'UpdateVoteStateSwitch', 'AuthorizeWithSeed', 'AuthorizeCheckedWithSeed', 'CompactUpdateVoteState', 'CompactUpdateVoteStateSwitch', 'TowerSync', 'TowerSyncSwitch'];
const COMPUTE_BUDGET_INSTRUCTIONS = ['RequestUnits (deprecated)', 'RequestHeapFrame', 'SetComputeUnitLimit', 'SetComputeUnitPrice', 'SetLoadedAccountsDataSizeLimit'];
const ATA_INSTRUCTIONS = ['Create', 'CreateIdempotent', 'RecoverNested'];

/** Transaction categories, by the programs a transaction invokes at the top level. */
export const TX_TYPES = {
  vote: { label: 'Vote', tone: 'neutral', title: 'Invokes the Vote program' },
  stake: { label: 'Stake', tone: 'brand', title: 'Invokes the Stake program' },
  token: { label: 'Token', tone: 'violet', title: 'Invokes SPL Token or Token-2022' },
  system: { label: 'System', tone: 'brand', title: 'Invokes the System program (transfers, account creation)' },
  other: { label: 'Other', tone: 'neutral', title: 'Invokes other programs only' },
};

export function classifyPrograms(programIds = []) {
  if (programIds.includes(PROGRAM_IDS.vote)) return 'vote';
  if (programIds.includes(PROGRAM_IDS.stake)) return 'stake';
  if (programIds.includes(PROGRAM_IDS.token) || programIds.includes(PROGRAM_IDS.token2022)) return 'token';
  if (programIds.includes(PROGRAM_IDS.system)) return 'system';
  return 'other';
}

/** `{ name, known }`. `name` is null for any program that is not one of the well-known ids. */
export function getProgramInfo(programId) {
  const name = KNOWN_PROGRAMS[programId] || null;
  return { name, known: !!name };
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;
const BASE58_MAP = Object.fromEntries([...BASE58].map((c, i) => [c, i]));

export function isValidSignature(value) {
  return typeof value === 'string' && value.length >= 80 && value.length <= 90 && BASE58_RE.test(value);
}

export function isValidAddress(value) {
  return typeof value === 'string' && value.length >= 32 && value.length <= 44 && BASE58_RE.test(value);
}

/** Base58 string -> bytes, or null when the string is not base58. */
export function base58Decode(str) {
  if (typeof str !== 'string') return null;
  const bytes = [];
  for (const ch of str) {
    let carry = BASE58_MAP[ch];
    if (carry === undefined) return null;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < str.length && str[i] === '1'; i++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

const group = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Exact decimal rendering of an integer amount in base units. */
export function formatUnits(value, decimals = 0, { sign = false } = {}) {
  let v;
  try {
    v = typeof value === 'bigint' ? value : BigInt(value);
  } catch {
    return DASH;
  }
  const negative = v < 0n;
  let digits = (negative ? -v : v).toString();
  let out;
  if (decimals > 0) {
    digits = digits.padStart(decimals + 1, '0');
    const frac = digits.slice(-decimals).replace(/0+$/, '');
    out = group(digits.slice(0, -decimals)) + (frac ? `.${frac}` : '');
  } else {
    out = group(digits);
  }
  return (negative ? '-' : sign && v > 0n ? '+' : '') + out;
}

/** Lamports -> XNT, exact to 9 decimals. Missing values render as a dash, never as 0. */
export function formatXnt(lamports, opts) {
  return typeof lamports === 'number' && Number.isFinite(lamports) ? formatUnits(Math.round(lamports), 9, opts) : DASH;
}

const view = (data) => new DataView(data.buffer, data.byteOffset, data.byteLength);
const u32 = (data, offset) => (data.length >= offset + 4 ? view(data).getUint32(offset, true) : null);
const u64 = (data, offset) => (data.length >= offset + 8 ? view(data).getBigUint64(offset, true) : null);

/**
 * Decode an instruction of a well-known program from its data bytes.
 * Returns `{ name, fields }`; `name` is null when the program or the instruction layout is not known.
 */
export function decodeInstruction(programId, data) {
  const none = { name: null, fields: [] };
  if (!(data instanceof Uint8Array)) return none;
  const fields = [];

  if (programId === PROGRAM_IDS.system) {
    const kind = u32(data, 0);
    if (kind === null) return none;
    const lamports = kind === 0 || kind === 2 ? u64(data, 4) : null;
    if (lamports !== null) fields.push({ label: kind === 2 ? 'Amount' : 'Funding', value: `${formatUnits(lamports, 9)} XNT` });
    if (kind === 0 && u64(data, 12) !== null) fields.push({ label: 'Space', value: `${formatUnits(u64(data, 12))} bytes` });
    return { name: SYSTEM_INSTRUCTIONS[kind] || null, fields };
  }

  if (programId === PROGRAM_IDS.token || programId === PROGRAM_IDS.token2022) {
    if (data.length === 0) return none;
    const kind = data[0];
    if ([3, 4, 7, 8].includes(kind) && u64(data, 1) !== null) {
      fields.push({ label: 'Amount (base units, decimals not in instruction)', value: formatUnits(u64(data, 1)) });
    }
    if ([12, 13, 14, 15].includes(kind) && data.length >= 10) {
      fields.push({ label: 'Amount', value: formatUnits(u64(data, 1), data[9]) });
      fields.push({ label: 'Decimals', value: String(data[9]) });
    }
    return { name: TOKEN_INSTRUCTIONS[kind] || null, fields };
  }

  if (programId === PROGRAM_IDS.stake) {
    const kind = u32(data, 0);
    if (kind === null) return none;
    if ((kind === 3 || kind === 4) && u64(data, 4) !== null) fields.push({ label: 'Amount', value: `${formatUnits(u64(data, 4), 9)} XNT` });
    return { name: STAKE_INSTRUCTIONS[kind] || null, fields };
  }

  if (programId === PROGRAM_IDS.vote) {
    const kind = u32(data, 0);
    return kind === null ? none : { name: VOTE_INSTRUCTIONS[kind] || null, fields };
  }

  if (programId === PROGRAM_IDS.computeBudget) {
    if (data.length === 0) return none;
    const kind = data[0];
    if (kind === 1 && u32(data, 1) !== null) fields.push({ label: 'Heap frame', value: `${formatUnits(u32(data, 1))} bytes` });
    if (kind === 2 && u32(data, 1) !== null) fields.push({ label: 'Compute unit limit', value: formatUnits(u32(data, 1)) });
    if (kind === 3 && u64(data, 1) !== null) fields.push({ label: 'Compute unit price', value: `${formatUnits(u64(data, 1))} micro-lamports` });
    return { name: COMPUTE_BUDGET_INSTRUCTIONS[kind] || null, fields };
  }

  if (programId === PROGRAM_IDS.associatedToken) {
    const kind = data.length === 0 ? 0 : data[0];
    return { name: ATA_INSTRUCTIONS[kind] || null, fields };
  }

  if (programId === PROGRAM_IDS.memo || programId === PROGRAM_IDS.memoV1) {
    // Memo text is untrusted: it is only ever rendered as a text node.
    fields.push({ label: 'Memo', value: new TextDecoder('utf-8').decode(data) });
    return { name: 'Memo', fields };
  }

  return none;
}

/**
 * Turn a raw `getTransaction` (encoding "json") response into the shape the pages use.
 * Nothing is inferred here: every field is read from the response or computed from it exactly.
 */
export function normalizeTransaction(tx) {
  const message = tx?.transaction?.message || {};
  const meta = tx?.meta || null;
  const header = message.header || null;
  const staticKeys = (message.accountKeys || []).map((k) => (typeof k === 'string' ? k : k?.pubkey || null));
  const loadedWritable = meta?.loadedAddresses?.writable || [];
  const loadedReadonly = meta?.loadedAddresses?.readonly || [];

  const signers = header?.numRequiredSignatures;
  const roSigned = header?.numReadonlySignedAccounts;
  const roUnsigned = header?.numReadonlyUnsignedAccounts;
  const flagsKnown = [signers, roSigned, roUnsigned].every(Number.isFinite);

  const lamportDelta = (i) => {
    const pre = meta?.preBalances?.[i];
    const post = meta?.postBalances?.[i];
    return Number.isFinite(pre) && Number.isFinite(post) ? { pre, post, delta: post - pre } : { pre: null, post: null, delta: null };
  };

  const accounts = [
    ...staticKeys.map((address, i) => ({
      address,
      signer: flagsKnown ? i < signers : null,
      writable: flagsKnown ? (i < signers ? i < signers - roSigned : i < staticKeys.length - roUnsigned) : null,
      source: 'message',
    })),
    ...loadedWritable.map((address) => ({ address, signer: false, writable: true, source: 'lookup' })),
    ...loadedReadonly.map((address) => ({ address, signer: false, writable: false, source: 'lookup' })),
  ].map((a, index) => ({ ...a, index, ...lamportDelta(index) }));

  const keys = accounts.map((a) => a.address);
  const toInstruction = (ix) => ({
    programId: keys[ix?.programIdIndex] ?? null,
    accounts: (ix?.accounts || []).map((i) => keys[i] ?? null),
    data: base58Decode(ix?.data ?? ''),
  });
  const instructions = (message.instructions || []).map((ix, index) => ({ ...toInstruction(ix), index, inner: [] }));
  for (const groupOfInner of meta?.innerInstructions || []) {
    const parent = instructions[groupOfInner?.index];
    if (parent) parent.inner = (groupOfInner.instructions || []).map(toInstruction);
  }

  const tokenChanges = [];
  const pre = new Map((meta?.preTokenBalances || []).map((b) => [b.accountIndex, b]));
  const post = new Map((meta?.postTokenBalances || []).map((b) => [b.accountIndex, b]));
  for (const index of new Set([...pre.keys(), ...post.keys()])) {
    const before = pre.get(index);
    const after = post.get(index);
    const ref = after || before;
    try {
      // A token account missing on one side did not exist then, so its balance was zero.
      const delta = BigInt(after?.uiTokenAmount?.amount ?? '0') - BigInt(before?.uiTokenAmount?.amount ?? '0');
      if (delta === 0n) continue;
      const decimals = ref.uiTokenAmount?.decimals;
      tokenChanges.push({
        account: keys[index] ?? null,
        owner: ref.owner || null,
        mint: ref.mint || null,
        programId: ref.programId || null,
        decimals: Number.isFinite(decimals) ? decimals : null,
        delta,
      });
    } catch {
      // Unparseable amount from the RPC: leave this entry out rather than show a wrong number.
    }
  }

  const programIds = [...new Set(instructions.map((ix) => ix.programId).filter(Boolean))];
  const innerProgramIds = [...new Set(instructions.flatMap((ix) => ix.inner.map((i) => i.programId)).filter(Boolean))].filter((p) => !programIds.includes(p));

  return {
    signature: tx?.transaction?.signatures?.[0] || null,
    slot: Number.isFinite(tx?.slot) ? tx.slot : null,
    blockTime: Number.isFinite(tx?.blockTime) ? tx.blockTime : null,
    version: tx?.version ?? null,
    success: meta ? !meta.err : null,
    err: meta?.err ?? null,
    feeLamports: Number.isFinite(meta?.fee) ? meta.fee : null,
    computeUnits: Number.isFinite(meta?.computeUnitsConsumed) ? meta.computeUnitsConsumed : null,
    recentBlockhash: message.recentBlockhash || null,
    feePayer: keys[0] || null,
    accounts,
    instructions,
    balanceChanges: accounts.filter((a) => a.delta !== null && a.delta !== 0),
    tokenChanges,
    logs: Array.isArray(meta?.logMessages) ? meta.logMessages : null,
    programIds,
    innerProgramIds,
    type: classifyPrograms(programIds),
  };
}

export const addressUrl = (address) => `${createPageUrl('AddressLookup')}?address=${encodeURIComponent(address)}`;

/** Program shown by its well-known name, or by address when it is not a well-known program. */
export function ProgramLabel({ programId, className }) {
  if (!programId) return <span className="text-ink-faint">Program account missing from response</span>;
  const { name } = getProgramInfo(programId);
  return (
    <span className={className}>
      {name && <span className="font-medium text-ink">{name} </span>}
      <Link to={addressUrl(programId)} title={programId} className={name ? 'mono text-xs text-ink-muted hover:text-brand' : 'mono text-brand hover:underline'}>
        {shortAddress(programId, 6, 6)}
      </Link>
    </span>
  );
}

function InstructionName({ decoded, data }) {
  if (decoded.name) return <Pill tone="brand" title="Decoded from the instruction data">{decoded.name}</Pill>;
  return <Pill title="This instruction's data layout is not known to the explorer">Not decoded{data ? ` · ${data.length} bytes` : ''}</Pill>;
}

export default function ProgramDecoder({ instruction, accountFlags }) {
  if (!instruction) return null;
  const { programId, accounts = [], data, inner = [], index } = instruction;
  const decoded = decodeInstruction(programId, data);

  return (
    <li className="rounded-lg border border-line bg-surface-2/50 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="tabular text-xs text-ink-faint">#{index + 1}</span>
        <ProgramLabel programId={programId} className="min-w-0 text-sm" />
        {programId && <CopyButton value={programId} label="Copy program id" />}
        <span className="ml-auto"><InstructionName decoded={decoded} data={data} /></span>
      </div>

      {decoded.fields.length > 0 && (
        <dl className="mt-3 space-y-1 rounded-md border border-line bg-surface-1 p-3 text-sm">
          {decoded.fields.map((f) => (
            <div key={f.label} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
              <dt className="text-ink-muted">{f.label}</dt>
              <dd className="min-w-0 break-words tabular text-ink">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {accounts.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">Accounts ({accounts.length})</summary>
          <ol className="mt-2 space-y-1">
            {accounts.map((address, i) => {
              const flags = address ? accountFlags?.[address] : null;
              return (
                <li key={i} className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="w-5 tabular text-ink-faint">{i}</span>
                  {address ? (
                    <Link to={addressUrl(address)} className="mono min-w-0 break-all text-ink-soft hover:text-brand">{address}</Link>
                  ) : (
                    <span className="text-ink-faint">Account index outside the transaction's account list</span>
                  )}
                  {flags?.signer && <Pill tone="positive">Signer</Pill>}
                  {flags?.writable && <Pill tone="warning">Writable</Pill>}
                </li>
              );
            })}
          </ol>
        </details>
      )}

      {inner.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">Inner instructions ({inner.length})</summary>
          <ol className="mt-2 space-y-1.5">
            {inner.map((ix, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="tabular text-ink-faint">#{index + 1}.{i + 1}</span>
                <ProgramLabel programId={ix.programId} />
                <InstructionName decoded={decodeInstruction(ix.programId, ix.data)} data={ix.data} />
              </li>
            ))}
          </ol>
        </details>
      )}
    </li>
  );
}
