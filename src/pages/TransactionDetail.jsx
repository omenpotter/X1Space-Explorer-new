import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, FileSearch, Receipt, XCircle } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { CopyButton, Panel, Pill } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, Skeleton, Unavailable } from '@/components/ds/States';
import X1Rpc from '@/components/x1/X1RpcService';
import ProgramDecoder, { TX_TYPES, addressUrl, formatUnits, formatXnt, isValidSignature, normalizeTransaction } from '@/components/transactions/ProgramDecoder';
import TransactionFlow from '@/components/transactions/TransactionFlow';
import { integer, shortAddress, timeAgo } from '@/lib/format';
import { createPageUrl } from '@/utils';

const BACK = { label: 'Transactions', to: createPageUrl('Transactions') };

/** Human-readable form of `meta.err`, using only what the RPC returned. */
function describeError(err) {
  if (err === null || err === undefined) return null;
  if (typeof err === 'string') return err;
  if (Array.isArray(err.InstructionError)) {
    const [index, detail] = err.InstructionError;
    const reason = typeof detail === 'string' ? detail : Object.entries(detail || {}).map(([k, v]) => `${k} ${JSON.stringify(v)}`).join(', ');
    return `Instruction #${Number(index) + 1} failed: ${reason || 'no reason given'}`;
  }
  return JSON.stringify(err);
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 min-w-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

function AddressCell({ address }) {
  if (!address) return <Unavailable reason="Account missing from the RPC response" />;
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <Link to={addressUrl(address)} title={address} className="mono text-ink-soft hover:text-brand">
        <span className="hidden break-all lg:inline">{address}</span>
        <span className="lg:hidden">{shortAddress(address, 6, 6)}</span>
      </Link>
      <CopyButton value={address} label="Copy address" />
    </span>
  );
}

function LoadingView() {
  return (
    <div role="status" aria-label="Loading transaction" className="space-y-6">
      <div className="panel p-4"><Skeleton className="h-5 w-full max-w-2xl" /></div>
      <div className="panel grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}><Skeleton className="mb-2 h-3 w-20" /><Skeleton className="h-5 w-32" /></div>
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <span className="sr-only">Loading transaction</span>
    </div>
  );
}

export default function TransactionDetail() {
  const [params] = useSearchParams();
  const signature = (params.get('sig') || '').trim();
  const valid = isValidSignature(signature);
  const [state, setState] = useState({ status: 'loading', tx: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!valid) return undefined;
    let cancelled = false;
    setState({ status: 'loading', tx: null, error: null });
    X1Rpc.getTransaction(signature)
      .then((raw) => {
        if (cancelled) return;
        setState(raw ? { status: 'ready', tx: normalizeTransaction(raw), error: null } : { status: 'notfound', tx: null, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', tx: null, error: err?.message || 'The X1 RPC did not respond.' });
      });
    return () => {
      cancelled = true;
    };
  }, [signature, valid, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const tx = state.tx;
  const accountFlags = useMemo(() => Object.fromEntries((tx?.accounts || []).filter((a) => a.address).map((a) => [a.address, a])), [tx]);
  const type = tx ? TX_TYPES[tx.type] : null;

  const badge = valid && tx ? (
    <span className="flex flex-wrap items-center gap-2">
      {tx.success === null ? <Pill>Status unavailable</Pill> : tx.success ? <Pill tone="positive" icon={CheckCircle2}>Success</Pill> : <Pill tone="negative" icon={XCircle}>Failed</Pill>}
      {type && <Pill tone={type.tone} title={`${type.title}. Category is derived from the program ids in this transaction.`}>{type.label}</Pill>}
    </span>
  ) : null;

  return (
    <>
      <PageHeader icon={Receipt} title="Transaction" back={BACK} badge={badge} description="Decoded from the transaction as returned by the X1 RPC." />

      {!signature && (
        <Panel>
          <EmptyState icon={FileSearch} title="No signature given" description="Open a transaction from the Transactions list, or paste a signature into the search bar at the top of the page." />
        </Panel>
      )}

      {signature && !valid && (
        <Panel>
          <EmptyState
            icon={FileSearch}
            title="That is not a transaction signature"
            description="A signature is 80 to 90 base58 characters (letters and digits, without 0, O, I or l). Nothing was looked up."
            action={<Link to={BACK.to} className="text-sm text-brand hover:underline">Go to Transactions</Link>}
          />
        </Panel>
      )}

      {valid && state.status === 'loading' && <LoadingView />}

      {valid && state.status === 'error' && (
        <Panel>
          <ErrorState title="The transaction could not be loaded" description={state.error} onRetry={retry} />
        </Panel>
      )}

      {valid && state.status === 'notfound' && (
        <Panel>
          <EmptyState
            icon={FileSearch}
            title="Transaction not found"
            description="The RPC node has no transaction with this signature. It may not exist, may not be confirmed yet, or may be older than the history this node keeps."
            action={
              <div className="space-y-3">
                <p className="mono break-all text-xs text-ink-muted">{signature}</p>
                <button type="button" onClick={retry} className="text-sm text-brand hover:underline">Check again</button>
              </div>
            }
          />
        </Panel>
      )}

      {valid && state.status === 'ready' && tx && (
        <div className="space-y-6">
          <Panel bodyClassName="p-4">
            <p className="eyebrow">Signature</p>
            <p className="mt-1 flex items-start gap-1">
              <span className="mono min-w-0 break-all text-sm text-ink">{signature}</span>
              <CopyButton value={signature} label="Copy signature" className="shrink-0" />
            </p>
          </Panel>

          {tx.success === false && (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-negative/30 bg-negative/10 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-negative" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium text-ink">This transaction failed</p>
                <p className="mt-1 break-words text-ink-soft">{describeError(tx.err)}</p>
                <p className="mt-1 text-xs text-ink-muted">The fee was still charged. See the log messages below for the program output.</p>
              </div>
            </div>
          )}

          <Panel title="Overview" bodyClassName="p-4">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Status">
                {tx.success === null ? <Unavailable reason="The RPC returned no execution metadata" /> : tx.success ? <span className="text-positive">Success</span> : <span className="text-negative">Failed</span>}
              </Field>
              <Field label="Slot">
                {tx.slot === null ? <Unavailable /> : <Link to={`${createPageUrl('BlockDetail')}?slot=${tx.slot}`} className="tabular text-brand hover:underline">{integer(tx.slot)}</Link>}
              </Field>
              <Field label="Block time">
                {tx.blockTime === null ? (
                  <Unavailable reason="The RPC did not return a block time for this transaction" />
                ) : (
                  <time dateTime={new Date(tx.blockTime * 1000).toISOString()} title={new Date(tx.blockTime * 1000).toUTCString()}>
                    {new Date(tx.blockTime * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })}
                    <span className="text-ink-muted"> · {timeAgo(tx.blockTime * 1000)}</span>
                  </time>
                )}
              </Field>
              <Field label="Fee">
                {tx.feeLamports === null ? <Unavailable reason="The RPC returned no fee" /> : <span className="tabular">{formatXnt(tx.feeLamports)} XNT</span>}
              </Field>
              <Field label="Signer (fee payer)"><AddressCell address={tx.feePayer} /></Field>
              <Field label="Compute units used">
                {tx.computeUnits === null ? <Unavailable reason="Not reported by the RPC for this transaction" /> : <span className="tabular">{integer(tx.computeUnits)}</span>}
              </Field>
              <Field label="Version">{tx.version === null ? <Unavailable /> : String(tx.version)}</Field>
              <Field label="Recent blockhash">
                {tx.recentBlockhash ? <span className="mono text-ink-soft" title={tx.recentBlockhash}>{shortAddress(tx.recentBlockhash, 8, 8)}</span> : <Unavailable />}
              </Field>
            </dl>
          </Panel>

          <Panel title="Flow" description="Signers, the programs they invoked and the balances that changed. Read directly from this transaction." bodyClassName="p-4">
            <TransactionFlow transaction={tx} />
          </Panel>

          <Panel title={`XNT balance changes (${tx.balanceChanges.length})`} description="Post-balance minus pre-balance for every account, as recorded with the transaction." bodyClassName="p-0">
            {tx.balanceChanges.length === 0 ? (
              <p className="p-4 text-sm text-ink-muted">{tx.success === null ? 'Balances were not returned by the RPC.' : 'No account balance changed.'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">Native XNT balance changes by account</caption>
                  <thead>
                    <tr>
                      <th scope="col">Account</th>
                      <th scope="col" className="hidden !text-right md:table-cell">Before</th>
                      <th scope="col" className="hidden !text-right md:table-cell">After</th>
                      <th scope="col" className="!text-right">Change (XNT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tx.balanceChanges.map((a) => (
                      <tr key={a.index}>
                        <td><AddressCell address={a.address} /></td>
                        <td className="hidden text-right tabular text-ink-muted md:table-cell">{formatXnt(a.pre)}</td>
                        <td className="hidden text-right tabular text-ink-muted md:table-cell">{formatXnt(a.post)}</td>
                        <td className={`text-right tabular ${a.delta > 0 ? 'text-positive' : 'text-negative'}`}>{formatXnt(a.delta, { sign: true })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {tx.tokenChanges.length > 0 && (
            <Panel title={`Token balance changes (${tx.tokenChanges.length})`} description="Post-balance minus pre-balance for every token account in the transaction." bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <caption className="sr-only">Token balance changes by token account</caption>
                  <thead>
                    <tr>
                      <th scope="col">Token account</th>
                      <th scope="col" className="hidden md:table-cell">Owner</th>
                      <th scope="col">Mint</th>
                      <th scope="col" className="!text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tx.tokenChanges.map((t, i) => (
                      <tr key={i}>
                        <td>{t.account ? <Link to={addressUrl(t.account)} title={t.account} className="mono text-ink-soft hover:text-brand">{shortAddress(t.account, 6, 6)}</Link> : <Unavailable />}</td>
                        <td className="hidden md:table-cell">{t.owner ? <Link to={addressUrl(t.owner)} title={t.owner} className="mono text-ink-soft hover:text-brand">{shortAddress(t.owner, 6, 6)}</Link> : <Unavailable reason="Owner not reported by the RPC" />}</td>
                        <td>
                          {t.mint ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="mono text-ink-soft" title={t.mint}>{shortAddress(t.mint, 6, 6)}</span>
                              <CopyButton value={t.mint} label="Copy mint address" />
                            </span>
                          ) : <Unavailable />}
                        </td>
                        <td className={`text-right tabular ${t.delta > 0n ? 'text-positive' : 'text-negative'}`}>
                          {formatUnits(t.delta, t.decimals ?? 0, { sign: true })}
                          {t.decimals === null && <span className="text-ink-muted"> base units</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          <Panel
            title={`Instructions (${tx.instructions.length})`}
            description="Programs are named only when they are well-known native or SPL programs; all others are shown by address. Instruction names are decoded from the instruction data."
            bodyClassName="p-4"
          >
            {tx.instructions.length === 0 ? (
              <p className="text-sm text-ink-muted">This transaction has no instructions.</p>
            ) : (
              <ol className="space-y-3">
                {tx.instructions.map((ix) => <ProgramDecoder key={ix.index} instruction={ix} accountFlags={accountFlags} />)}
              </ol>
            )}
          </Panel>

          <Panel title={`Accounts (${tx.accounts.length})`} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="data-table">
                <caption className="sr-only">Accounts referenced by this transaction, with signer and writable flags</caption>
                <thead>
                  <tr>
                    <th scope="col" className="w-10">#</th>
                    <th scope="col">Address</th>
                    <th scope="col">Flags</th>
                    <th scope="col" className="hidden !text-right sm:table-cell">Change (XNT)</th>
                  </tr>
                </thead>
                <tbody>
                  {tx.accounts.map((a) => (
                    <tr key={a.index}>
                      <td className="tabular text-ink-faint">{a.index}</td>
                      <td><AddressCell address={a.address} /></td>
                      <td>
                        <span className="flex flex-wrap gap-1">
                          {a.index === 0 && <Pill tone="brand">Fee payer</Pill>}
                          {a.signer && <Pill tone="positive">Signer</Pill>}
                          {a.writable === null ? <Unavailable reason="Message header missing from the RPC response" /> : a.writable ? <Pill tone="warning">Writable</Pill> : <Pill>Read-only</Pill>}
                          {a.source === 'lookup' && <Pill title="Loaded through an address lookup table">Lookup table</Pill>}
                        </span>
                      </td>
                      <td className={`hidden text-right tabular sm:table-cell ${a.delta > 0 ? 'text-positive' : a.delta < 0 ? 'text-negative' : 'text-ink-faint'}`}>
                        {a.delta === null ? <Unavailable reason="Balance not returned by the RPC" /> : a.delta === 0 ? 'No change' : formatXnt(a.delta, { sign: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title={`Log messages${tx.logs ? ` (${tx.logs.length})` : ''}`} bodyClassName="p-4">
            {tx.logs === null ? (
              <p className="text-sm text-ink-muted">The RPC did not return log messages for this transaction.</p>
            ) : tx.logs.length === 0 ? (
              <p className="text-sm text-ink-muted">This transaction produced no log messages.</p>
            ) : (
              <ol tabIndex={0} aria-label="Program log messages" className="mono max-h-[480px] space-y-0.5 overflow-auto rounded-lg border border-line bg-surface-2 p-3 text-xs text-ink-soft">
                {tx.logs.map((line, i) => (
                  <li key={i} className="whitespace-pre-wrap break-all">{String(line)}</li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
