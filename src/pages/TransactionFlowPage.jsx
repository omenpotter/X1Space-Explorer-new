import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, CheckCircle2, FileSearch, RefreshCw, Search, XCircle } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { CopyButton, Panel, Pill, StatCard } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, Skeleton, StatSkeleton, TableSkeleton, Unavailable } from '@/components/ds/States';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import X1Rpc from '@/components/x1/X1RpcService';
import AddressFlowGraph from '@/components/transactions/AddressFlowGraph';
import FlowFilters from '@/components/transactions/FlowFilters';
import FlowExport from '@/components/transactions/FlowExport';
import TransactionFlow from '@/components/transactions/TransactionFlow';
import { PROGRAM_IDS, TX_TYPES, addressUrl, formatUnits, formatXnt, getProgramInfo, isValidAddress, isValidSignature, normalizeTransaction } from '@/components/transactions/ProgramDecoder';
import { rpcCall } from '@/lib/x1/rpcClient';
import { DASH, integer, shortAddress, timeAgo } from '@/lib/format';
import { createPageUrl } from '@/utils';

// Per-address cap on fetched transactions: one signature page, then one getTransaction per signature.
const MAX_TRANSACTIONS = 25;
const CONCURRENCY = 5;

const detailUrl = (sig) => `${createPageUrl('TransactionDetail')}?sig=${encodeURIComponent(sig)}`;
const addrLabel = (a) => getProgramInfo(a).name || shortAddress(a, 6, 6);

/** Run `fn` over `items` with a small number in flight. `fn` must not throw. */
async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

const view = (data) => new DataView(data.buffer, data.byteOffset, data.byteLength);

/**
 * XNT transfers that the System Program instructions of a transaction state outright
 * (Transfer and TransferWithSeed, top level and inner). Nothing is paired or guessed.
 */
function systemTransfers(tx) {
  const out = [];
  const visit = (ix, inner) => {
    if (ix.programId !== PROGRAM_IDS.system || !(ix.data instanceof Uint8Array) || ix.data.length < 12) return;
    const kind = view(ix.data).getUint32(0, true);
    const lamports = view(ix.data).getBigUint64(4, true);
    if (kind === 2 && ix.accounts[0] && ix.accounts[1]) out.push({ from: ix.accounts[0], to: ix.accounts[1], lamports, inner });
    if (kind === 11 && ix.accounts[0] && ix.accounts[2]) out.push({ from: ix.accounts[0], to: ix.accounts[2], lamports, inner });
  };
  for (const ix of tx.instructions) {
    visit(ix, false);
    for (const i of ix.inner) visit(i, true);
  }
  return out;
}

function aggregate(records, center) {
  const incoming = new Map();
  const outgoing = new Map();
  let inflow = 0n;
  let outflow = 0n;
  const add = (map, address, lamports) => {
    const cur = map.get(address) || { address, lamports: 0n, count: 0 };
    cur.lamports += lamports;
    cur.count += 1;
    map.set(address, cur);
  };
  for (const r of records) {
    for (const t of r.transfers) {
      if (t.from === t.to) continue;
      if (t.to === center) { add(incoming, t.from, t.lamports); inflow += t.lamports; }
      else if (t.from === center) { add(outgoing, t.to, t.lamports); outflow += t.lamports; }
    }
  }
  const sort = (m) => [...m.values()].sort((a, b) => (a.lamports === b.lamports ? 0 : a.lamports > b.lamports ? -1 : 1));
  return { centerAddress: center, incoming: sort(incoming), outgoing: sort(outgoing), inflow, outflow };
}

function StatusPill({ success }) {
  if (success === null) return <Pill>Unknown</Pill>;
  return success ? <Pill tone="positive" icon={CheckCircle2}>Success</Pill> : <Pill tone="negative" icon={XCircle}>Failed</Pill>;
}

function SignatureCell({ signature }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Link to={detailUrl(signature)} title={signature} className="mono text-brand hover:underline">{shortAddress(signature, 8, 6)}</Link>
      <CopyButton value={signature} label="Copy signature" />
    </span>
  );
}

function SignatureMode({ tx }) {
  const transfers = useMemo(() => systemTransfers(tx), [tx]);
  const type = TX_TYPES[tx.type];
  return (
    <div className="space-y-6">
      <Panel
        title="Flow of this transaction"
        description="Signers, programs and balance changes read from the transaction. Category is derived from the program ids."
        actions={<><StatusPill success={tx.success} /><Pill tone={type.tone} title={type.title}>{type.label}</Pill></>}
      >
        <div className="p-4"><TransactionFlow transaction={tx} /></div>
      </Panel>

      <Panel title="XNT transfers stated by the transaction" description="System Program Transfer instructions, including inner instructions. Balance changes made by other programs appear in the Balances changed list above.">
        {transfers.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-muted">This transaction contains no System Program transfer instructions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">XNT transfers decoded from this transaction</caption>
              <thead><tr><th scope="col">From</th><th scope="col">To</th><th scope="col" className="text-right">Amount (XNT)</th><th scope="col" className="hidden md:table-cell">Level</th></tr></thead>
              <tbody>
                {transfers.map((t, i) => (
                  <tr key={i}>
                    <td><Link to={addressUrl(t.from)} title={t.from} className="mono text-ink-soft hover:text-brand">{addrLabel(t.from)}</Link></td>
                    <td><Link to={addressUrl(t.to)} title={t.to} className="mono text-ink-soft hover:text-brand">{addrLabel(t.to)}</Link></td>
                    <td className="tabular text-right">{formatUnits(t.lamports, 9)}</td>
                    <td className="hidden text-ink-muted md:table-cell">{t.inner ? 'Inner instruction' : 'Top level'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="text-sm text-ink-muted">
        <Link to={detailUrl(tx.signature)} className="text-brand hover:underline">Open the full decoded transaction</Link>
      </p>
    </div>
  );
}

function AddressMode({ result }) {
  const { address, records, flowData, balance, signaturesReturned, failedFetches, missing } = result;
  const graphRef = useRef(null);
  const [filterType, setFilterType] = useState('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [amountRange, setAmountRange] = useState({ min: '', max: '' });
  const [search, setSearch] = useState('');

  const clear = useCallback(() => {
    setFilterType('all');
    setDateRange({ from: '', to: '' });
    setAmountRange({ min: '', max: '' });
    setSearch('');
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateRange.from ? new Date(`${dateRange.from}T00:00:00`).getTime() : null;
    const to = dateRange.to ? new Date(`${dateRange.to}T23:59:59.999`).getTime() : null;
    const min = amountRange.min !== '' ? Number(amountRange.min) : null;
    const max = amountRange.max !== '' ? Number(amountRange.max) : null;
    return records.filter((r) => {
      if (filterType !== 'all' && r.type !== filterType) return false;
      if (q && !r.signature.toLowerCase().includes(q) && !r.transfers.some((t) => t.from.toLowerCase().includes(q) || t.to.toLowerCase().includes(q))) return false;
      if ((from !== null || to !== null) && !r.blockTime) return false;
      if (from !== null && r.blockTime * 1000 < from) return false;
      if (to !== null && r.blockTime * 1000 > to) return false;
      if (min !== null || max !== null) {
        if (r.netLamports === null) return false;
        const abs = Math.abs(Number(r.netLamports)) / 1e9;
        if (min !== null && abs < min) return false;
        if (max !== null && abs > max) return false;
      }
      return true;
    });
  }, [records, filterType, search, dateRange, amountRange]);

  const counterparties = flowData.incoming.length + flowData.outgoing.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Transactions analysed" value={integer(records.length)} hint={`Latest ${integer(signaturesReturned)} of up to ${MAX_TRANSACTIONS} requested`} tone="brand" />
        <StatCard label="Counterparties" value={integer(counterparties)} hint="Distinct addresses in decoded transfers" />
        <StatCard label="XNT received" value={formatUnits(flowData.inflow, 9)} hint="Decoded System transfers in" tone="positive" />
        <StatCard label="XNT sent" value={formatUnits(flowData.outflow, 9)} hint="Decoded System transfers out" tone="negative" />
      </div>

      <p role="note" className="rounded-lg border border-line bg-surface-2/50 px-3 py-2 text-sm text-ink-muted">
        Only the latest {MAX_TRANSACTIONS} transactions of this address were fetched, so older activity is not included and the totals cover this window only.
        {signaturesReturned >= MAX_TRANSACTIONS && ' The address has more history than this.'}
        {failedFetches > 0 && ` ${failedFetches} transaction${failedFetches === 1 ? '' : 's'} could not be loaded and ${failedFetches === 1 ? 'is' : 'are'} left out.`}
        {missing > 0 && ` ${missing} ${missing === 1 ? 'was' : 'were'} not returned by the node (possibly pruned).`}
        {' '}Flows are System Program transfers decoded from the instructions; other balance changes are in the table below. Current balance: {balance === null ? DASH : `${formatXnt(balance)} XNT`}.
      </p>

      <Panel
        title="XNT flow"
        description="Who sent XNT to this address and who it sent XNT to, from decoded transfers."
        actions={<FlowExport flowData={flowData} transactions={records} graphRef={graphRef} />}
      >
        <div ref={graphRef}><AddressFlowGraph flowData={flowData} /></div>
      </Panel>

      <FlowFilters
        filterType={filterType}
        setFilterType={setFilterType}
        dateRange={dateRange}
        setDateRange={setDateRange}
        amountRange={amountRange}
        setAmountRange={setAmountRange}
        searchSignature={search}
        setSearchSignature={setSearch}
        onClearFilters={clear}
      />

      <Panel title="Transactions" description={`Showing ${filtered.length} of ${records.length} fetched transactions. Net change includes fees paid by this address.`}>
        {filtered.length === 0 ? (
          <EmptyState icon={FileSearch} title="No transactions match the filters" description="Clear or relax the filters to see the fetched transactions again." action={<Button type="button" variant="outline" size="sm" onClick={clear} className="border-line-strong bg-transparent text-ink hover:bg-surface-3">Clear filters</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">Transactions fetched for {address}</caption>
              <thead>
                <tr>
                  <th scope="col">Signature</th>
                  <th scope="col">Type</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Net change (XNT)</th>
                  <th scope="col" className="hidden md:table-cell">Transfers</th>
                  <th scope="col" className="hidden lg:table-cell">Token changes</th>
                  <th scope="col" className="text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const type = TX_TYPES[r.type];
                  return (
                    <tr key={r.signature}>
                      <td><SignatureCell signature={r.signature} /></td>
                      <td><Pill tone={type.tone} title={type.title}>{type.label}</Pill></td>
                      <td><StatusPill success={r.success} /></td>
                      <td className="tabular text-right">
                        {r.netLamports === null ? <Unavailable reason="This address is not an account in the transaction" /> : (
                          <span className={r.netLamports > 0n ? 'text-positive' : r.netLamports < 0n ? 'text-negative' : 'text-ink-muted'}>{formatUnits(r.netLamports, 9, { sign: true })}</span>
                        )}
                      </td>
                      <td className="hidden md:table-cell">
                        {r.transfers.length === 0 ? <span className="text-ink-faint">{DASH}</span> : (
                          <ul className="space-y-0.5 text-xs">
                            {r.transfers.slice(0, 3).map((t, i) => (
                              <li key={i} className="whitespace-nowrap text-ink-muted">
                                <Link to={addressUrl(t.from)} title={t.from} className="mono hover:text-brand">{addrLabel(t.from)}</Link>
                                {' → '}
                                <Link to={addressUrl(t.to)} title={t.to} className="mono hover:text-brand">{addrLabel(t.to)}</Link>
                                <span className="tabular text-ink-soft"> {formatUnits(t.lamports, 9)}</span>
                              </li>
                            ))}
                            {r.transfers.length > 3 && <li className="text-ink-faint">+{r.transfers.length - 3} more</li>}
                          </ul>
                        )}
                      </td>
                      <td className="hidden lg:table-cell">
                        {r.tokenChanges.length === 0 ? <span className="text-ink-faint">{DASH}</span> : (
                          <ul className="space-y-0.5 text-xs">
                            {r.tokenChanges.slice(0, 3).map((t, i) => (
                              <li key={i} className="whitespace-nowrap">
                                <span className={`tabular ${t.delta > 0n ? 'text-positive' : 'text-negative'}`}>{formatUnits(t.delta, t.decimals ?? 0, { sign: true })}</span>
                                <span className="text-ink-muted"> {t.decimals === null ? 'base units of ' : 'of '}</span>
                                <span className="mono text-ink-muted" title={t.mint || undefined}>{shortAddress(t.mint)}</span>
                              </li>
                            ))}
                            {r.tokenChanges.length > 3 && <li className="text-ink-faint">+{r.tokenChanges.length - 3} more</li>}
                          </ul>
                        )}
                      </td>
                      <td className="text-right text-ink-muted" title={r.blockTime ? new Date(r.blockTime * 1000).toLocaleString() : undefined}>{r.blockTime ? timeAgo(r.blockTime * 1000) : DASH}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function LoadingView() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading transaction flow">
      <StatSkeleton count={4} />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Panel><TableSkeleton rows={6} columns={5} /></Panel>
    </div>
  );
}

export default function TransactionFlowPage() {
  const [params, setParams] = useSearchParams();
  const query = (params.get('address') || params.get('sig') || params.get('signature') || '').trim();
  const [input, setInput] = useState(query);
  const [inputError, setInputError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'idle' });

  const kind = isValidSignature(query) ? 'signature' : isValidAddress(query) ? 'address' : query ? 'invalid' : 'none';

  useEffect(() => {
    setInput(query);
  }, [query]);

  useEffect(() => {
    if (kind !== 'signature' && kind !== 'address') {
      setState({ status: 'idle' });
      return undefined;
    }
    let cancelled = false;
    setState({ status: 'loading' });

    (async () => {
      try {
        if (kind === 'signature') {
          const raw = await X1Rpc.getTransaction(query);
          if (cancelled) return;
          setState(raw ? { status: 'ready', mode: 'signature', tx: normalizeTransaction(raw) } : { status: 'notfound' });
          return;
        }

        const [balanceRes, signatures] = await Promise.all([
          X1Rpc.getBalance(query).catch(() => null),
          rpcCall('getSignaturesForAddress', [query, { limit: MAX_TRANSACTIONS }]),
        ]);
        if (cancelled) return;
        const sigs = Array.isArray(signatures) ? signatures.slice(0, MAX_TRANSACTIONS) : [];
        if (sigs.length === 0) {
          setState({ status: 'empty', balance: Number.isFinite(balanceRes?.value) ? balanceRes.value : null });
          return;
        }

        // One failing getTransaction must not break the page: each result is { ok } or { failed }.
        const results = await mapPool(sigs, CONCURRENCY, async (s) => {
          try {
            const raw = await X1Rpc.getTransaction(s.signature);
            return raw ? { tx: normalizeTransaction(raw), sig: s } : { missing: true };
          } catch {
            return { failed: true };
          }
        });
        if (cancelled) return;

        const records = results.filter((r) => r.tx).map(({ tx, sig }) => {
          const self = tx.accounts.find((a) => a.address === query);
          return {
            signature: tx.signature || sig.signature,
            slot: tx.slot ?? sig.slot ?? null,
            blockTime: tx.blockTime ?? sig.blockTime ?? null,
            type: tx.type,
            success: tx.success,
            feeLamports: tx.feeLamports,
            netLamports: self && Number.isFinite(self.delta) ? BigInt(self.delta) : null,
            transfers: systemTransfers(tx),
            tokenChanges: tx.tokenChanges.filter((t) => t.owner === query || t.account === query),
          };
        });
        const failedFetches = results.filter((r) => r.failed).length;
        const missing = results.filter((r) => r.missing).length;

        if (records.length === 0) {
          setState({ status: 'error', message: `The node listed ${sigs.length} signatures for this address but none of the transactions could be loaded.` });
          return;
        }
        setState({
          status: 'ready',
          mode: 'address',
          result: { address: query, records, flowData: aggregate(records, query), balance: Number.isFinite(balanceRes?.value) ? balanceRes.value : null, signaturesReturned: sigs.length, failedFetches, missing },
        });
      } catch (err) {
        if (!cancelled) setState({ status: 'error', message: err?.message || 'The X1 RPC did not respond.' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query, kind, attempt]);

  const submit = (e) => {
    e.preventDefault();
    const value = input.trim();
    if (isValidSignature(value)) {
      setInputError(null);
      setParams({ sig: value });
    } else if (isValidAddress(value)) {
      setInputError(null);
      setParams({ address: value });
    } else {
      setInputError('Enter a transaction signature (80 to 90 base58 characters) or an address (32 to 44 base58 characters). Base58 does not use 0, O, I or l.');
    }
  };

  const retry = () => setAttempt((n) => n + 1);

  return (
    <>
      <PageHeader
        icon={ArrowLeftRight}
        title="Transaction flow"
        description="Follow the XNT and token movements of one transaction, or of the latest transactions of an address. Everything is derived from the transactions returned by the X1 RPC."
        actions={kind === 'address' || kind === 'signature' ? (
          <Button type="button" variant="outline" size="sm" onClick={retry} disabled={state.status === 'loading'} className="border-line-strong bg-transparent text-ink hover:bg-surface-3">
            <RefreshCw className={`mr-2 h-4 w-4 ${state.status === 'loading' ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </Button>
        ) : null}
      />

      <form onSubmit={submit} className="panel mb-6 p-4" noValidate>
        <label htmlFor="flow-query" className="eyebrow mb-1.5 block">Signature or address</label>
        <div className="flex flex-wrap gap-2">
          <Input
            id="flow-query"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste a transaction signature or an address"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={inputError ? 'true' : undefined}
            aria-describedby={inputError ? 'flow-query-error' : undefined}
            className="mono min-w-[16rem] flex-1"
          />
          <Button type="submit" className="bg-brand text-brand-ink hover:bg-brand/90">
            <Search className="mr-2 h-4 w-4" aria-hidden="true" />
            Analyse
          </Button>
        </div>
        {inputError && <p id="flow-query-error" role="alert" className="mt-2 text-sm text-negative">{inputError}</p>}
        <p className="mt-2 text-xs text-ink-muted">For an address, the latest {MAX_TRANSACTIONS} transactions are fetched.</p>
      </form>

      {kind === 'none' && (
        <Panel><EmptyState icon={ArrowLeftRight} title="Enter a signature or an address" description="See who sent XNT to an address, who it paid, and what changed in a transaction." /></Panel>
      )}

      {kind === 'invalid' && (
        <Panel>
          <EmptyState icon={FileSearch} title="That is not a signature or an address" description="A signature is 80 to 90 base58 characters and an address is 32 to 44. Nothing was looked up." />
        </Panel>
      )}

      {state.status === 'loading' && <LoadingView />}

      {state.status === 'error' && (
        <Panel><ErrorState title="The flow could not be loaded" description={state.message} onRetry={retry} /></Panel>
      )}

      {state.status === 'notfound' && (
        <Panel><EmptyState icon={FileSearch} title="Transaction not found" description="The RPC node has no transaction with this signature. It may not exist, may not be confirmed yet, or may be older than the history the node keeps." /></Panel>
      )}

      {state.status === 'empty' && (
        <Panel>
          <EmptyState
            icon={FileSearch}
            title="No transactions found for this address"
            description={`The node returned no signatures for this address${state.balance ? `, although it holds ${formatXnt(state.balance)} XNT` : ''}. It may be new, unused, or its history may be pruned.`}
          />
        </Panel>
      )}

      {state.status === 'ready' && state.mode === 'signature' && <SignatureMode tx={state.tx} />}
      {state.status === 'ready' && state.mode === 'address' && <AddressMode key={state.result.address} result={state.result} />}
    </>
  );
}
