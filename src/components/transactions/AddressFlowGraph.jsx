import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Download, Send, Wallet } from 'lucide-react';
import { Panel } from '@/components/ds/Primitives';
import { shortAddress } from '@/lib/format';
import { addressUrl, formatUnits, getProgramInfo } from './ProgramDecoder';

const DIAGRAM_LIMIT = 8;

const label = (address) => getProgramInfo(address).name || shortAddress(address, 6, 6);

function NodeCard({ node }) {
  return (
    <Link to={addressUrl(node.address)} title={node.address} className="block rounded-lg border border-line bg-surface-2 p-3 transition-colors hover:bg-surface-3">
      <span className="flex items-center gap-2">
        <Wallet className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
        <span className="mono truncate text-xs text-ink-soft">{label(node.address)}</span>
      </span>
      <span className="mt-1 block text-xs">
        <span className="tabular font-medium text-ink">{formatUnits(node.lamports, 9)} XNT</span>
        <span className="ml-2 text-ink-muted">{node.count} transfer{node.count === 1 ? '' : 's'}</span>
      </span>
    </Link>
  );
}

function Side({ icon: Icon, tone, title, nodes, total, empty }) {
  return (
    <section className="min-w-0 space-y-2" aria-label={title}>
      <h3 className={`flex items-center gap-2 text-sm font-medium ${tone}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {title} ({nodes.length})
      </h3>
      {nodes.length === 0 ? (
        <p className="text-sm text-ink-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {nodes.slice(0, DIAGRAM_LIMIT).map((n) => <li key={n.address}><NodeCard node={n} /></li>)}
        </ul>
      )}
      {nodes.length > DIAGRAM_LIMIT && <p className="text-xs text-ink-muted">Top {DIAGRAM_LIMIT} by amount shown here. The table below lists all {nodes.length}.</p>}
      {total > 0n && <p className="tabular text-xs text-ink-muted">Total {formatUnits(total, 9)} XNT</p>}
    </section>
  );
}

/**
 * Counterparties that moved XNT to or from the analysed address, using only System Program transfers
 * decoded from the fetched transactions. A table with the same data follows the diagram.
 */
export default function AddressFlowGraph({ flowData }) {
  const { centerAddress, incoming, outgoing, inflow, outflow } = flowData;
  const rows = [
    ...incoming.map((n) => ({ ...n, direction: 'In' })),
    ...outgoing.map((n) => ({ ...n, direction: 'Out' })),
  ];

  return (
    <div className="space-y-6 p-4">
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
        <Side icon={Download} tone="text-positive" title="Received from" nodes={incoming} total={inflow} empty="No XNT transfers into this address in the sample." />
        <div className="hidden items-center self-center text-ink-faint md:flex" aria-hidden="true"><ArrowRight className="h-4 w-4" /></div>
        <section className="min-w-0 rounded-lg border border-brand/40 bg-brand/10 p-3" aria-label="Analysed address">
          <p className="eyebrow">Analysed address</p>
          <p className="mono mt-1 break-all text-xs text-ink" title={centerAddress}>{centerAddress}</p>
        </section>
        <div className="hidden items-center self-center text-ink-faint md:flex" aria-hidden="true"><ArrowRight className="h-4 w-4" /></div>
        <Side icon={Send} tone="text-negative" title="Sent to" nodes={outgoing} total={outflow} empty="No XNT transfers out of this address in the sample." />
      </div>

      <Panel title="Same flows as a table" description="Aggregated per counterparty from decoded System Program transfers." className="bg-surface-2/40">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ink-muted">No System Program transfers involving this address were found in the fetched transactions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">XNT flows between the analysed address and each counterparty</caption>
              <thead>
                <tr>
                  <th scope="col">Direction</th>
                  <th scope="col">Counterparty</th>
                  <th scope="col" className="text-right">Transfers</th>
                  <th scope="col" className="text-right">Amount (XNT)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.direction}-${r.address}`}>
                    <td className={r.direction === 'In' ? 'text-positive' : 'text-negative'}>{r.direction === 'In' ? 'Received from' : 'Sent to'}</td>
                    <td><Link to={addressUrl(r.address)} title={r.address} className="mono text-ink-soft hover:text-brand">{label(r.address)}</Link></td>
                    <td className="tabular text-right">{r.count}</td>
                    <td className="tabular text-right">{formatUnits(r.lamports, 9)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
