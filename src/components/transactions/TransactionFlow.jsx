import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { Pill } from '@/components/ds/Primitives';
import { shortAddress } from '@/lib/format';
import { ProgramLabel, addressUrl, formatUnits, formatXnt } from './ProgramDecoder';

function Step() {
  return (
    <div className="flex items-center justify-center text-ink-faint" aria-hidden="true">
      <ArrowDown className="h-4 w-4 md:hidden" />
      <ArrowRight className="hidden h-4 w-4 md:block" />
    </div>
  );
}

/** @param {{ title?: any, count?: any, children?: any, [key: string]: any }} props */
function Column({ title, count, children }) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-surface-2/50">
      <h3 className="eyebrow border-b border-line px-3 py-2">{title} ({count})</h3>
      <div className="max-h-80 overflow-y-auto p-3">{children}</div>
    </section>
  );
}

/** @param {{ address?: any, [key: string]: any }} props */
const AddressLink = ({ address }) => (
  <Link to={addressUrl(address)} title={address} className="mono text-xs text-ink-soft hover:text-brand">{shortAddress(address, 6, 6)}</Link>
);

/**
 * Who signed, which programs ran, and which balances changed, for one transaction.
 * Built from the transaction itself (signer flags, instruction program ids, pre/post balances).
 * It is plain lists, so it reads the same with a keyboard or a screen reader.
 */
/** @param {{ transaction?: any, [key: string]: any }} props */
export default function TransactionFlow({ transaction }) {
  if (!transaction) return null;
  const signers = transaction.accounts.filter((a) => a.signer);
  const { programIds, innerProgramIds, balanceChanges, tokenChanges } = transaction;
  const changeCount = balanceChanges.length + tokenChanges.length;

  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1.3fr)] md:items-start">
      <Column title="Signed by" count={signers.length}>
        {signers.length === 0 ? (
          <p className="text-sm text-ink-muted">Signer flags are not available for this transaction.</p>
        ) : (
          <ul className="space-y-2">
            {signers.map((a) => (
              <li key={a.address} className="flex flex-wrap items-center gap-2">
                <AddressLink address={a.address} />
                {a.index === 0 && <Pill>Fee payer</Pill>}
              </li>
            ))}
          </ul>
        )}
      </Column>

      <Step />

      <Column title="Programs invoked" count={programIds.length + innerProgramIds.length}>
        {programIds.length + innerProgramIds.length === 0 ? (
          <p className="text-sm text-ink-muted">No instructions in this transaction.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {programIds.map((p) => <li key={p}><ProgramLabel programId={p} /></li>)}
            {innerProgramIds.map((p) => (
              <li key={p} className="flex flex-wrap items-center gap-2">
                <ProgramLabel programId={p} />
                <Pill title="Called by another program during execution (inner instruction)">Inner call</Pill>
              </li>
            ))}
          </ul>
        )}
      </Column>

      <Step />

      <Column title="Balances changed" count={changeCount}>
        {changeCount === 0 ? (
          <p className="text-sm text-ink-muted">No XNT or token balance changed.</p>
        ) : (
          <ul className="space-y-2">
            {balanceChanges.map((a) => (
              <li key={`n-${a.index}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <AddressLink address={a.address} />
                <span className={`tabular text-sm ${a.delta > 0 ? 'text-positive' : 'text-negative'}`}>{formatXnt(a.delta, { sign: true })} XNT</span>
              </li>
            ))}
            {tokenChanges.map((t, i) => (
              <li key={`t-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                {t.account ? <AddressLink address={t.account} /> : <span className="text-xs text-ink-faint">Unknown account</span>}
                <span className={`tabular text-sm ${t.delta > 0n ? 'text-positive' : 'text-negative'}`}>
                  {formatUnits(t.delta, t.decimals ?? 0, { sign: true })} <span className="text-ink-muted">{t.decimals === null ? 'base units of ' : 'of token '}</span>
                  <span className="mono text-xs text-ink-muted" title={t.mint || undefined}>{shortAddress(t.mint)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Column>
    </div>
  );
}
