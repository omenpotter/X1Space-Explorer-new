import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Search as SearchIcon, SearchX } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { TokenAvatar, ValidatorAvatar } from '@/components/ds/Avatar';
import { Panel, Pill } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, Skeleton } from '@/components/ds/States';
import X1Rpc from '@/components/x1/X1RpcService';
import { api } from '@/lib/x1/api';
import { compact, integer, shortAddress, timeAgo, usd } from '@/lib/format';
import { createPageUrl } from '@/utils';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
const MAX_QUERY = 100;
const VALIDATOR_MATCH_LIMIT = 10;

const PROGRAMS = {
  system: '11111111111111111111111111111111',
  vote: 'Vote111111111111111111111111111111111111111',
  stake: 'Stake11111111111111111111111111111111111111',
  token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  token2022: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
};

const GROUP_TITLES = {
  block: 'Block',
  transaction: 'Transaction',
  account: 'Account',
  validators: 'Validators',
  tokens: 'Tokens',
};

/** Which lookups a query can lead to. Same rules as classifyQuery in the search helper (lib/x1/search). */
function planLookups(q) {
  const groups = [];
  if (!q) return groups;
  if (/^\d{1,12}$/.test(q)) groups.push('block');
  if (BASE58.test(q)) {
    if (q.length >= 80 && q.length <= 90) groups.push('transaction');
    if (q.length >= 32 && q.length <= 44) groups.push('account', 'validators');
  }
  if (groups.length === 0 && q.length >= 2 && q.length <= 64) groups.push('tokens', 'validators');
  return groups;
}

function describeAccount(value) {
  const owner = value.owner;
  const parsedType = value.data?.parsed?.type;
  if (value.executable) return { kind: 'program', label: 'Program (executable)' };
  if ((owner === PROGRAMS.token || owner === PROGRAMS.token2022) && parsedType === 'mint') return { kind: 'mint', label: owner === PROGRAMS.token2022 ? 'Token mint (Token-2022)' : 'Token mint' };
  if ((owner === PROGRAMS.token || owner === PROGRAMS.token2022) && parsedType === 'account') return { kind: 'token-account', label: 'Token account' };
  if (owner === PROGRAMS.vote) return { kind: 'vote', label: 'Vote account' };
  if (owner === PROGRAMS.stake) return { kind: 'stake', label: 'Stake account' };
  if (owner === PROGRAMS.system) return { kind: 'wallet', label: 'System wallet' };
  return { kind: 'other', label: 'Program-owned account' };
}

const LOOKUPS = {
  async block(q) {
    const slot = Number(q);
    try {
      // "signatures" is the lightest detail level that still carries the transaction count.
      const block = await X1Rpc.getBlock(slot, { transactionDetails: 'signatures' });
      if (!block) return { found: false, slot };
      return {
        found: true,
        slot,
        blockTime: typeof block.blockTime === 'number' ? block.blockTime : null,
        txCount: Array.isArray(block.signatures) ? block.signatures.length : null,
        blockHeight: typeof block.blockHeight === 'number' ? block.blockHeight : null,
      };
    } catch (err) {
      // The node answered but has no block here (skipped slot, not yet produced, or pruned).
      if (err?.kind === 'rpc') return { found: false, slot, reason: err.message };
      throw err;
    }
  },

  async transaction(q) {
    try {
      const tx = await X1Rpc.getTransaction(q);
      if (!tx) return { found: false };
      return {
        found: true,
        signature: q,
        failed: !!tx.meta?.err,
        slot: typeof tx.slot === 'number' ? tx.slot : null,
        blockTime: typeof tx.blockTime === 'number' ? tx.blockTime : null,
      };
    } catch (err) {
      if (err?.kind === 'rpc') return { found: false, reason: err.message };
      throw err;
    }
  },

  async account(q) {
    const [info, balance] = await Promise.allSettled([X1Rpc.getAccountInfo(q), X1Rpc.getBalance(q)]);
    if (info.status === 'rejected') {
      // A string that is base58 but not a valid 32-byte key is rejected by the node.
      if (info.reason?.kind === 'rpc') return { found: false, address: q, reason: 'The RPC does not accept this as an address.' };
      throw info.reason;
    }
    const value = info.value?.value ?? null;
    const lamports = balance.status === 'fulfilled' && typeof balance.value?.value === 'number' ? balance.value.value : typeof value?.lamports === 'number' ? value.lamports : null;
    if (!value) return { found: false, address: q, lamports };
    return { found: true, address: q, lamports, owner: value.owner, ...describeAccount(value) };
  },

  async validators(q) {
    const all = await X1Rpc.getValidatorDetails();
    const isAddress = BASE58.test(q) && q.length >= 32 && q.length <= 44;
    const needle = q.toLowerCase();
    const matches = isAddress
      ? all.filter((v) => v.votePubkey === q || v.nodePubkey === q)
      : all.filter((v) => typeof v.name === 'string' && v.name.toLowerCase().includes(needle));
    return { found: matches.length > 0, byAddress: isAddress, total: matches.length, matches: matches.slice(0, VALIDATOR_MATCH_LIMIT) };
  },

  async tokens(q) {
    const data = await api.searchTokens(q, 10);
    const results = Array.isArray(data?.results) ? data.results : [];
    return { found: results.length > 0, results, total: typeof data?.total === 'number' ? data.total : results.length };
  },
};

function xnt(lamports) {
  if (typeof lamports !== 'number' || !Number.isFinite(lamports)) return '—';
  return `${(lamports / 1e9).toLocaleString('en-US', { maximumFractionDigits: 9 })} XNT`;
}

function when(blockTime) {
  if (typeof blockTime !== 'number') return 'Time not recorded';
  const ms = blockTime * 1000;
  return `${new Date(ms).toLocaleString()} (${timeAgo(ms)})`;
}

/** @param {{ to?: any, children?: any, label?: any, [key: string]: any }} props */
function ResultLink({ to, children, label }) {
  return (
    <Link to={to} aria-label={label} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none">
      <span className="min-w-0 flex-1">{children}</span>
      <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint transition-colors group-hover:text-brand" aria-hidden="true" />
    </Link>
  );
}

/** @param {{ children?: any, [key: string]: any }} props */
function Miss({ children }) {
  return <p className="px-4 py-4 text-sm text-ink-muted">{children}</p>;
}

/** @param {{ items?: any, [key: string]: any }} props */
function Facts({ items }) {
  return (
    <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
      {items.filter(Boolean).map((item) => <span key={item}>{item}</span>)}
    </span>
  );
}

/** @param {{ data?: any, [key: string]: any }} props */
function BlockResult({ data }) {
  if (!data.found) return <Miss>No block at slot {integer(data.slot)}. The slot may have been skipped, not produced yet, or pruned from the RPC node.</Miss>;
  return (
    <ResultLink to={`${createPageUrl('BlockDetail')}?slot=${data.slot}`} label={`Open block at slot ${data.slot}`}>
      <span className="block text-sm font-medium text-ink">Slot <span className="mono">{integer(data.slot)}</span></span>
      <Facts items={[when(data.blockTime), data.txCount !== null ? `${integer(data.txCount)} transactions` : null, data.blockHeight !== null ? `Height ${integer(data.blockHeight)}` : null]} />
    </ResultLink>
  );
}

/** @param {{ data?: any, [key: string]: any }} props */
function TransactionResult({ data }) {
  if (!data.found) return <Miss>No transaction with this signature was found. It may be too old for the RPC node, or not confirmed yet.</Miss>;
  return (
    <ResultLink to={`${createPageUrl('TransactionDetail')}?sig=${data.signature}`} label="Open transaction">
      <span className="flex flex-wrap items-center gap-2">
        <span className="mono min-w-0 break-all text-sm text-ink">{shortAddress(data.signature, 16, 16)}</span>
        <Pill tone={data.failed ? 'negative' : 'positive'}>{data.failed ? 'Failed' : 'Success'}</Pill>
      </span>
      <Facts items={[data.slot !== null ? `Slot ${integer(data.slot)}` : null, when(data.blockTime)]} />
    </ResultLink>
  );
}

/** @param {{ data?: any, [key: string]: any }} props */
function AccountResult({ data }) {
  if (!data.found) {
    return (
      <>
        <Miss>
          {data.reason || 'No account exists at this address. An address that has never held XNT, or whose account was closed, has no on-chain record.'}
        </Miss>
        {!data.reason && (
          <div className="border-t border-line/60">
            <ResultLink to={`${createPageUrl('AddressLookup')}?address=${data.address}`} label="Open address lookup">
              <span className="text-sm text-ink-soft">Check token holdings and past signatures for this address</span>
            </ResultLink>
          </div>
        )}
      </>
    );
  }
  return (
    <ul className="divide-y divide-line/60">
      <li>
        <ResultLink to={`${createPageUrl('AddressLookup')}?address=${data.address}`} label="Open address details">
          <span className="flex flex-wrap items-center gap-2">
            <span className="mono min-w-0 break-all text-sm text-ink">{data.address}</span>
            <Pill tone={data.kind === 'mint' ? 'brand' : 'neutral'}>{data.label}</Pill>
          </span>
          <Facts items={[`Balance ${xnt(data.lamports)}`, `Owner program ${shortAddress(data.owner, 6, 6)}`]} />
        </ResultLink>
      </li>
      {data.kind === 'mint' && (
        <li>
          <ResultLink to={`${createPageUrl('TokenExplorer')}?mint=${data.address}`} label="Open token details">
            <span className="text-sm text-ink-soft">View this mint in the token explorer</span>
          </ResultLink>
        </li>
      )}
    </ul>
  );
}

/** @param {{ data?: any, query?: any, [key: string]: any }} props */
function ValidatorsResult({ data, query }) {
  if (!data.found) {
    return <Miss>{data.byAddress ? 'This address is not the vote account or identity of a current validator.' : `No validator name contains "${query}".`}</Miss>;
  }
  return (
    <>
      <ul className="divide-y divide-line/60">
        {data.matches.map((v) => (
          <li key={v.votePubkey}>
            <ResultLink to={`${createPageUrl('ValidatorDetail')}?id=${v.votePubkey}`} label={`Open validator ${v.name || v.votePubkey}`}>
              <span className="flex items-center gap-3">
                <ValidatorAvatar validator={v} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{v.name || shortAddress(v.votePubkey)}</span>
                    <Pill tone={v.delinquent ? 'negative' : 'positive'}>{v.delinquent ? 'Delinquent' : 'Active'}</Pill>
                  </span>
                  <span className="block text-xs text-ink-muted">
                    <span className="mono">{shortAddress(v.votePubkey, 6, 6)}</span> · {compact(v.activatedStake)} XNT staked
                  </span>
                </span>
              </span>
            </ResultLink>
          </li>
        ))}
      </ul>
      {data.total > data.matches.length && (
        <p className="border-t border-line/60 px-4 py-3 text-xs text-ink-muted">
          Showing {data.matches.length} of {integer(data.total)} matching validators.{' '}
          <Link to={`${createPageUrl('Validators')}?search=${encodeURIComponent(query)}`} className="text-brand hover:underline">See all</Link>
        </p>
      )}
    </>
  );
}

/** @param {{ data?: any, query?: any, [key: string]: any }} props */
function TokensResult({ data, query }) {
  if (!data.found) return <Miss>No token name or symbol matches &quot;{query}&quot;.</Miss>;
  return (
    <>
      <ul className="divide-y divide-line/60">
        {data.results.map((t) => (
          <li key={t.mint}>
            <ResultLink to={`${createPageUrl('TokenExplorer')}?mint=${t.mint}`} label={`Open token ${t.symbol || t.name || t.mint}`}>
              <span className="flex items-center gap-3">
                <TokenAvatar token={t} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{t.name || 'Unnamed token'}</span>
                    {t.symbol && <span className="text-xs text-ink-muted">{t.symbol}</span>}
                    {t.program === 'token-2022' && <Pill tone="violet">Token-2022</Pill>}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    <span className="mono">{shortAddress(t.mint, 6, 6)}</span>
                    {typeof t.priceUsd === 'number' ? ` · ${usd(t.priceUsd)}` : ' · No market price'}
                  </span>
                </span>
              </span>
            </ResultLink>
          </li>
        ))}
      </ul>
      {data.total > data.results.length && (
        <p className="border-t border-line/60 px-4 py-3 text-xs text-ink-muted">
          Showing {data.results.length} of {integer(data.total)} matching tokens.{' '}
          <Link to={`${createPageUrl('TokenExplorer')}?q=${encodeURIComponent(query)}`} className="text-brand hover:underline">See all</Link>
        </p>
      )}
    </>
  );
}

const RENDERERS = { block: BlockResult, transaction: TransactionResult, account: AccountResult, validators: ValidatorsResult, tokens: TokensResult };

/** @param {{ name?: any, state?: any, query?: any, onRetry?: any, [key: string]: any }} props */
function ResultGroup({ name, state, query, onRetry }) {
  const Body = RENDERERS[name];
  return (
    <Panel title={GROUP_TITLES[name]} aria-busy={state.status === 'loading'}>
      {state.status === 'loading' && (
        <div role="status" aria-label={`Looking up ${GROUP_TITLES[name].toLowerCase()}`} className="space-y-2 px-4 py-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      )}
      {state.status === 'error' && <ErrorState className="py-8" title={`${GROUP_TITLES[name]} lookup failed`} description={state.error} onRetry={onRetry} />}
      {state.status === 'ready' && <Body data={state.data} query={query} />}
    </Panel>
  );
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').trim().slice(0, MAX_QUERY);
  const [input, setInput] = useState(query);
  const [results, setResults] = useState({});
  const runId = useRef(0);

  const groups = useMemo(() => planLookups(query), [query]);

  const runGroup = useCallback((name, q, id) => {
    setResults((r) => ({ ...r, [name]: { status: 'loading' } }));
    LOOKUPS[name](q).then(
      (data) => {
        if (runId.current === id) setResults((r) => ({ ...r, [name]: { status: 'ready', data } }));
      },
      (err) => {
        if (runId.current === id) setResults((r) => ({ ...r, [name]: { status: 'error', error: err?.message || 'The data source did not respond.' } }));
      },
    );
  }, []);

  useEffect(() => {
    setInput(query);
    const id = ++runId.current;
    setResults({});
    for (const name of groups) runGroup(name, query, id);
  }, [query, groups, runGroup]);

  const onSubmit = (e) => {
    e.preventDefault();
    const next = input.trim().slice(0, MAX_QUERY);
    setSearchParams(next ? { q: next } : {});
  };

  const states = groups.map((g) => results[g] || { status: 'loading' });
  const settled = groups.length > 0 && states.every((s) => s.status !== 'loading');
  const nothingFound = settled && states.every((s) => s.status === 'ready' && !s.data.found);

  return (
    <>
      <PageHeader
        icon={SearchIcon}
        title="Search"
        description="Look up a block by slot, a transaction by signature, an account, token mint or validator by address, or tokens and validators by name."
      />

      <form onSubmit={onSubmit} role="search" className="mb-6 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={MAX_QUERY}
            autoComplete="off"
            spellCheck={false}
            placeholder="Slot, signature, address or name"
            aria-label="Search by slot, transaction signature, address or name"
            className="h-10 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </div>
        <button type="submit" className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
          Search
        </button>
      </form>

      {!query && (
        <Panel>
          <EmptyState
            icon={SearchIcon}
            title="Enter something to look up"
            description="A slot number finds a block. An 80 to 90 character signature finds a transaction. A 32 to 44 character address finds an account, token mint or validator. Anything else searches token and validator names."
          />
        </Panel>
      )}

      {query && groups.length === 0 && (
        <Panel>
          <EmptyState
            icon={SearchX}
            title="This does not look like something on chain"
            description="Enter a slot number, a transaction signature, an address, or a name between 2 and 64 characters."
          />
        </Panel>
      )}

      {groups.length > 0 && (
        <div aria-live="polite">
          <p className="mb-3 text-sm text-ink-muted">
            Results for <span className="mono break-all text-ink">{query.length > 48 ? shortAddress(query, 20, 20) : query}</span>
          </p>
          {nothingFound && (
            <Panel className="mb-4">
              <EmptyState
                icon={SearchX}
                title="Nothing found"
                description="Nothing on X1 mainnet matches this query. The details of each lookup are listed below."
                className="py-8"
              />
            </Panel>
          )}
          <div className="space-y-4">
            {groups.map((name, i) => (
              <ResultGroup key={name} name={name} state={states[i]} query={query} onRetry={() => runGroup(name, query, runId.current)} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
