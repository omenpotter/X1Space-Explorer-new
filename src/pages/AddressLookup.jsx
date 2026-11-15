import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ExternalLink, FileSearch, Search, Wallet, XCircle } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { CopyButton, Panel, Pill, StatCard } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, Skeleton, StatSkeleton, TableSkeleton, Unavailable } from '@/components/ds/States';
import { TokenAvatar } from '@/components/ds/Avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PROGRAM_IDS, formatUnits, formatXnt, getProgramInfo, isValidAddress } from '@/components/transactions/ProgramDecoder';
import { rpcCall } from '@/lib/x1/rpcClient';
import { api } from '@/lib/x1/api';
import { X1_CONFIG } from '@/lib/x1/config';
import { safeUrl } from '@/lib/safeUrl';
import { DASH, integer, shortAddress, timeAgo } from '@/lib/format';
import { createPageUrl } from '@/utils';

const MAX_SIGNATURES = 25;
const MAX_TOKEN_NAMES = 20;
const TOKEN_PROGRAMS = [
  { id: PROGRAM_IDS.token, label: 'SPL Token', tone: 'neutral' },
  { id: PROGRAM_IDS.token2022, label: 'Token-2022', tone: 'violet' },
];

const detailUrl = (sig) => `${createPageUrl('TransactionDetail')}?sig=${encodeURIComponent(sig)}`;
const message = (err) => err?.message || 'The X1 RPC did not respond.';

/** Size of the account data in bytes, or null when the response does not say. */
function dataSize(data) {
  if (data && typeof data === 'object' && !Array.isArray(data) && Number.isFinite(data.space)) return data.space;
  if (Array.isArray(data) && typeof data[0] === 'string' && data[1] === 'base64') {
    const s = data[0];
    const padding = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((s.length * 3) / 4) - padding);
  }
  return null;
}

function parseHoldings(settled) {
  const holdings = [];
  let emptyAccounts = 0;
  const failedPrograms = [];
  settled.forEach((res, i) => {
    const program = TOKEN_PROGRAMS[i];
    if (res.status !== 'fulfilled') {
      failedPrograms.push(program.label);
      return;
    }
    for (const entry of res.value?.value || []) {
      const info = entry?.account?.data?.parsed?.info;
      const amount = info?.tokenAmount;
      if (!info?.mint || !amount) continue;
      let raw;
      try {
        raw = BigInt(amount.amount);
      } catch {
        continue;
      }
      if (raw === 0n) {
        emptyAccounts += 1;
        continue;
      }
      holdings.push({ account: entry.pubkey, mint: info.mint, raw, decimals: Number.isFinite(amount.decimals) ? amount.decimals : 0, program });
    }
  });
  return { holdings, emptyAccounts, failedPrograms };
}

/** @param {{ label?: any, children?: any, [key: string]: any }} props */
function Row({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 min-w-0 break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

/** @param {{ address?: any, [key: string]: any }} props */
function AddressLink({ address }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <Link to={`${createPageUrl('AddressLookup')}?address=${encodeURIComponent(address)}`} title={address} className="mono break-all text-ink-soft hover:text-brand">{address}</Link>
      <CopyButton value={address} label="Copy address" />
    </span>
  );
}

function LoadingView() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading address">
      <Skeleton className="h-16 w-full rounded-xl" />
      <StatSkeleton count={4} />
      <Panel><TableSkeleton rows={4} columns={4} /></Panel>
      <Panel><TableSkeleton rows={6} columns={4} /></Panel>
    </div>
  );
}

/** @param {{ parsed?: any, [key: string]: any }} props */
function VoteDetails({ parsed }) {
  const info = parsed?.info;
  if (parsed?.type !== 'vote' || !info) return null;
  const voter = info.authorizedVoters?.[0]?.authorizedVoter;
  return (
    <Panel title="Vote account details" description="Read from the parsed vote account.">
      <dl className="grid gap-4 p-4 sm:grid-cols-2">
        <Row label="Commission">{Number.isFinite(info.commission) ? `${info.commission}%` : <Unavailable />}</Row>
        <Row label="Root slot">{Number.isFinite(info.rootSlot) ? <span className="tabular">{integer(info.rootSlot)}</span> : <Unavailable />}</Row>
        <Row label="Node identity">{info.nodePubkey ? <AddressLink address={info.nodePubkey} /> : <Unavailable />}</Row>
        <Row label="Authorized voter">{voter ? <AddressLink address={voter} /> : <Unavailable />}</Row>
        <Row label="Authorized withdrawer">{info.authorizedWithdrawer ? <AddressLink address={info.authorizedWithdrawer} /> : <Unavailable />}</Row>
      </dl>
    </Panel>
  );
}

export default function AddressLookup() {
  const [params, setParams] = useSearchParams();
  const address = (params.get('address') || '').trim();
  const valid = isValidAddress(address);
  const [input, setInput] = useState(address);
  const [inputError, setInputError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState(/** @type {Record<string, any>} */ ({ status: 'idle' }));
  const [names, setNames] = useState({});

  useEffect(() => {
    setInput(address);
  }, [address]);

  useEffect(() => {
    if (!valid) {
      setState({ status: 'idle' });
      return undefined;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    setNames({});

    (async () => {
      const [balanceRes, infoRes, sigRes, ...tokenRes] = await Promise.allSettled([
        rpcCall('getBalance', [address]),
        rpcCall('getAccountInfo', [address, { encoding: 'jsonParsed' }]),
        rpcCall('getSignaturesForAddress', [address, { limit: MAX_SIGNATURES }]),
        ...TOKEN_PROGRAMS.map((p) => rpcCall('getTokenAccountsByOwner', [address, { programId: p.id }, { encoding: 'jsonParsed' }])),
      ]);
      if (cancelled) return;

      // Without the balance and the account there is nothing reliable to show.
      if (balanceRes.status === 'rejected' && infoRes.status === 'rejected') {
        setState({ status: 'error', message: message(balanceRes.reason) });
        return;
      }

      const balance = balanceRes.status === 'fulfilled' && Number.isFinite(balanceRes.value?.value) ? balanceRes.value.value : null;
      const account = infoRes.status === 'fulfilled' ? infoRes.value?.value || null : undefined; // null = does not exist, undefined = unknown
      const signatures = sigRes.status === 'fulfilled' && Array.isArray(sigRes.value) ? sigRes.value.slice(0, MAX_SIGNATURES) : null;
      const tokens = parseHoldings(tokenRes);

      if (account === null && !balance && signatures && signatures.length === 0 && tokens.holdings.length === 0) {
        setState({ status: 'notfound' });
        return;
      }
      setState({ status: 'ready', balance, account, accountError: infoRes.status === 'rejected' ? message(infoRes.reason) : null, signatures, signaturesError: sigRes.status === 'rejected' ? message(sigRes.reason) : null, tokens });
    })();

    return () => {
      cancelled = true;
    };
  }, [address, valid, attempt]);

  // Token names for the first holdings only, so one page never fans out into many requests.
  const holdings = state.status === 'ready' ? state.tokens.holdings : null;
  useEffect(() => {
    if (!holdings || holdings.length === 0) return undefined;
    let cancelled = false;
    const mints = [...new Set(holdings.map((h) => h.mint))].slice(0, MAX_TOKEN_NAMES);
    Promise.allSettled(mints.map((m) => api.token(m))).then((results) => {
      if (cancelled) return;
      const found = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value?.token) found[mints[i]] = r.value.token;
      });
      setNames(found);
    });
    return () => {
      cancelled = true;
    };
  }, [holdings]);

  const submit = (e) => {
    e.preventDefault();
    const value = input.trim();
    if (!isValidAddress(value)) {
      setInputError('An address is 32 to 44 base58 characters (letters and digits, without 0, O, I or l).');
      return;
    }
    setInputError(null);
    setParams({ address: value });
  };

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const ownerName = useMemo(() => (state.status === 'ready' && state.account ? getProgramInfo(state.account.owner).name : null), [state]);
  const explorer = safeUrl(`${X1_CONFIG.explorerUrl}/address/${encodeURIComponent(address)}`);

  return (
    <>
      <PageHeader icon={Wallet} title="Address lookup" description="Balance, account details, token holdings and recent activity of any X1 address, read from the X1 RPC." />

      <form onSubmit={submit} className="panel mb-6 p-4" noValidate>
        <label htmlFor="address-query" className="eyebrow mb-1.5 block">Address</label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="address-query"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste an X1 address"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={inputError ? 'true' : undefined}
            aria-describedby={inputError ? 'address-query-error' : undefined}
            className="mono min-w-[16rem] flex-1"
          />
          <Button type="submit" className="bg-brand text-brand-ink hover:bg-brand/90">
            <Search className="mr-2 h-4 w-4" aria-hidden="true" />
            Look up
          </Button>
        </div>
        {inputError && <p id="address-query-error" role="alert" className="mt-2 text-sm text-negative">{inputError}</p>}
      </form>

      {!address && <Panel><EmptyState icon={Wallet} title="Enter an address" description="Paste an address above, or open one from a transaction." /></Panel>}

      {address && !valid && (
        <Panel><EmptyState icon={FileSearch} title="That is not a valid address" description="An address is 32 to 44 base58 characters. Nothing was looked up." /></Panel>
      )}

      {valid && state.status === 'loading' && <LoadingView />}

      {valid && state.status === 'error' && <Panel><ErrorState title="The address could not be loaded" description={state.message} onRetry={retry} /></Panel>}

      {valid && state.status === 'notfound' && (
        <Panel>
          <EmptyState
            icon={FileSearch}
            title="Address not found on chain"
            description="This address has no account, no balance, no token holdings and no transaction history on this node. It may never have received funds."
            action={<p className="mono break-all text-xs text-ink-muted">{address}</p>}
          />
        </Panel>
      )}

      {valid && state.status === 'ready' && (
        <div className="space-y-6">
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="mono break-all text-sm text-ink">{address}</span>
              <CopyButton value={address} label="Copy address" />
              {ownerName && <Pill tone="brand" title="The program that owns this account">Owner: {ownerName}</Pill>}
              {state.account?.executable && <Pill tone="warning">Executable program</Pill>}
            </div>
            <span className="flex items-center gap-4 text-sm">
              <Link to={`${createPageUrl('TransactionFlowPage')}?address=${encodeURIComponent(address)}`} className="text-brand hover:underline">View flow</Link>
              <a href={explorer} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink-muted hover:text-ink">
                X1 explorer<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
              </a>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Balance" value={state.balance === null ? DASH : <span>{formatXnt(state.balance)} <span className="text-base text-ink-muted">XNT</span></span>} hint={state.balance === null ? 'Balance could not be read' : state.account === null ? 'No account data: the address holds no funds' : undefined} tone="brand" />
            <StatCard label="Token holdings" value={integer(state.tokens.holdings.length)} hint={state.tokens.failedPrograms.length ? `${state.tokens.failedPrograms.join(' and ')} not read` : 'Non-empty token accounts'} />
            <StatCard label="Recent signatures" value={state.signatures ? integer(state.signatures.length) : DASH} hint={state.signatures ? (state.signatures.length >= MAX_SIGNATURES ? `Latest ${MAX_SIGNATURES} (there may be more)` : 'All the node has') : 'Not available'} />
            <StatCard label="Data size" value={state.account ? (dataSize(state.account.data) === null ? DASH : <span>{integer(dataSize(state.account.data))} <span className="text-base text-ink-muted">bytes</span></span>) : DASH} hint={state.account === undefined ? 'Account info not read' : state.account === null ? 'No account' : undefined} />
          </div>

          <Panel title="Account" description="Raw account fields from the RPC.">
            {state.accountError ? (
              <p className="px-4 py-5 text-sm text-ink-muted">Account info could not be loaded: {state.accountError}</p>
            ) : state.account === null ? (
              <p className="px-4 py-5 text-sm text-ink-muted">No account exists at this address on chain. It is not holding any data, but the node still reports the activity shown below.</p>
            ) : (
              <dl className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <Row label="Owner program">
                  <span className="inline-flex flex-wrap items-center gap-x-2">
                    {ownerName && <span className="font-medium">{ownerName}</span>}
                    <Link to={`${createPageUrl('AddressLookup')}?address=${encodeURIComponent(state.account.owner)}`} title={state.account.owner} className="mono text-xs text-ink-muted hover:text-brand">{shortAddress(state.account.owner, 6, 6)}</Link>
                  </span>
                </Row>
                <Row label="Executable">{state.account.executable ? 'Yes' : 'No'}</Row>
                <Row label="Data size">{dataSize(state.account.data) === null ? <Unavailable reason="The RPC did not report a size" /> : <span className="tabular">{integer(dataSize(state.account.data))} bytes</span>}</Row>
                <Row label="Lamports"><span className="tabular">{integer(state.account.lamports)}</span></Row>
              </dl>
            )}
          </Panel>

          {state.account?.data?.parsed && <VoteDetails parsed={state.account.data.parsed} />}

          <Panel
            title="Token holdings"
            description={`Token accounts owned by this address, from both SPL Token and Token-2022.${state.tokens.holdings.length > MAX_TOKEN_NAMES ? ` Names are looked up for the first ${MAX_TOKEN_NAMES} only.` : ''}${state.tokens.emptyAccounts ? ` ${state.tokens.emptyAccounts} empty token account${state.tokens.emptyAccounts === 1 ? '' : 's'} hidden.` : ''}`}
          >
            {state.tokens.failedPrograms.length > 0 && (
              <p role="alert" className="border-b border-line px-4 py-3 text-sm text-warning">Holdings under {state.tokens.failedPrograms.join(' and ')} could not be loaded, so this list may be incomplete.</p>
            )}
            {state.tokens.holdings.length === 0 ? (
              <EmptyState icon={Wallet} title="No token holdings" description="This address holds no non-empty token accounts." />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">Token holdings of {address}</caption>
                  <thead><tr><th scope="col">Token</th><th scope="col" className="text-right">Balance</th><th scope="col" className="hidden md:table-cell">Program</th><th scope="col" className="hidden lg:table-cell">Token account</th></tr></thead>
                  <tbody>
                    {state.tokens.holdings.map((h) => {
                      const t = names[h.mint];
                      return (
                        <tr key={h.account}>
                          <td>
                            <span className="flex min-w-0 items-center gap-3">
                              <TokenAvatar token={t || { mint: h.mint }} size={28} />
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-ink">{t ? t.name || t.symbol || 'Unnamed token' : 'Unknown token'}{t?.symbol && t?.name ? <span className="ml-2 text-xs text-ink-muted">{t.symbol}</span> : null}</span>
                                <span className="mono block text-xs text-ink-faint" title={h.mint}>{shortAddress(h.mint, 6, 6)}</span>
                              </span>
                            </span>
                          </td>
                          <td className="tabular text-right">{formatUnits(h.raw, h.decimals)}</td>
                          <td className="hidden md:table-cell"><Pill tone={h.program.tone}>{h.program.label}</Pill></td>
                          <td className="hidden lg:table-cell"><span className="mono text-xs text-ink-muted" title={h.account}>{shortAddress(h.account, 6, 6)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Recent transactions"
            description={state.signatures ? `The latest ${state.signatures.length} signature${state.signatures.length === 1 ? '' : 's'} (up to ${MAX_SIGNATURES}) involving this address.` : undefined}
          >
            {state.signaturesError ? (
              <ErrorState title="Recent transactions could not be loaded" description={state.signaturesError} onRetry={retry} className="py-8" />
            ) : !state.signatures || state.signatures.length === 0 ? (
              <EmptyState icon={FileSearch} title="No transactions found" description="The node has no signatures for this address. It may be new, unused, or its history may be pruned." />
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">Recent transaction signatures involving {address}</caption>
                  <thead><tr><th scope="col">Signature</th><th scope="col">Status</th><th scope="col" className="hidden sm:table-cell">Slot</th><th scope="col" className="text-right">Time</th></tr></thead>
                  <tbody>
                    {state.signatures.map((s) => (
                      <tr key={s.signature}>
                        <td>
                          <span className="inline-flex items-center gap-1">
                            <Link to={detailUrl(s.signature)} title={s.signature} className="mono text-brand hover:underline">{shortAddress(s.signature, 8, 6)}</Link>
                            <CopyButton value={s.signature} label="Copy signature" />
                          </span>
                        </td>
                        <td>{s.err ? <Pill tone="negative" icon={XCircle}>Failed</Pill> : <Pill tone="positive" icon={CheckCircle2}>Success</Pill>}</td>
                        <td className="hidden sm:table-cell">
                          {Number.isFinite(s.slot) ? <Link to={`${createPageUrl('BlockDetail')}?slot=${s.slot}`} className="mono tabular text-ink-soft hover:text-brand">{integer(s.slot)}</Link> : DASH}
                        </td>
                        <td className="text-right text-ink-muted" title={s.blockTime ? new Date(s.blockTime * 1000).toLocaleString() : undefined}>{s.blockTime ? timeAgo(s.blockTime * 1000) : DASH}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
