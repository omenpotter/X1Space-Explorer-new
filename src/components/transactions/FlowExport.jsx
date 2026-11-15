import React, { memo, useCallback, useState } from 'react';
import { Download, FileImage, FileJson, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatUnits } from './ProgramDecoder';

const stamp = (flowData) => `${String(flowData?.centerAddress || 'flow').slice(0, 8)}_${Date.now()}`;
const bigintReplacer = (_k, v) => (typeof v === 'bigint' ? v.toString() : v);
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function save(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Render the graph element to a canvas. html2canvas is only downloaded when an image/PDF export is requested. */
async function renderGraph(element) {
  const { default: html2canvas } = await import('html2canvas');
  const background = getComputedStyle(document.body).backgroundColor;
  return html2canvas(element, { backgroundColor: background && background !== 'rgba(0, 0, 0, 0)' ? background : null, scale: 2, useCORS: true, logging: false });
}

const FlowExport = memo(function FlowExport({ flowData, transactions, graphRef }) {
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (label, fn) => {
    setMessage(null);
    setBusy(true);
    try {
      await fn();
      setMessage({ ok: true, text: `${label} export downloaded.` });
    } catch (err) {
      setMessage({ ok: false, text: `${label} export failed${err?.message ? `: ${err.message}` : '.'} Try the JSON or CSV export instead.` });
    } finally {
      setBusy(false);
    }
  }, []);

  const exportJson = () => run('JSON', async () => {
    const data = {
      address: flowData.centerAddress,
      exportedAt: new Date().toISOString(),
      note: 'Flows are System Program transfers decoded from the fetched transactions. netLamports is the address balance change in the transaction, including fees.',
      summary: { transactionsFetched: transactions.length, inflowLamports: flowData.inflow, outflowLamports: flowData.outflow, counterpartiesIn: flowData.incoming.length, counterpartiesOut: flowData.outgoing.length },
      incoming: flowData.incoming,
      outgoing: flowData.outgoing,
      transactions,
    };
    save(new Blob([JSON.stringify(data, bigintReplacer, 2)], { type: 'application/json' }), `x1_flow_${stamp(flowData)}.json`);
  });

  const exportCsv = () => run('CSV', async () => {
    const headers = ['Signature', 'Type', 'Status', 'Slot', 'Time (UTC)', 'Net change of address (XNT)', 'Fee (XNT)'];
    const rows = transactions.map((tx) => [
      tx.signature,
      tx.type,
      tx.success === null ? 'unknown' : tx.success ? 'success' : 'failed',
      tx.slot ?? '',
      tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : '',
      tx.netLamports === null || tx.netLamports === undefined ? '' : formatUnits(tx.netLamports, 9).replace(/,/g, ''),
      tx.feeLamports === null || tx.feeLamports === undefined ? '' : formatUnits(tx.feeLamports, 9).replace(/,/g, ''),
    ]);
    save(new Blob([[headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' }), `x1_transactions_${stamp(flowData)}.csv`);
  });

  const exportPng = () => run('PNG', async () => {
    if (!graphRef?.current) throw new Error('the diagram is not on screen');
    const canvas = await renderGraph(graphRef.current);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('the browser could not encode the image');
    save(blob, `x1_flow_${stamp(flowData)}.png`);
  });

  const exportPdf = () => run('PDF', async () => {
    if (!graphRef?.current) throw new Error('the diagram is not on screen');
    const [canvas, { jsPDF }] = await Promise.all([renderGraph(graphRef.current), import('jspdf')]);
    const pdf = new jsPDF({ orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const ratio = Math.min((pageW - margin * 2) / canvas.width, (pageH - margin * 2 - 20) / canvas.height);
    pdf.setFontSize(10);
    pdf.text(`X1 transaction flow for ${flowData.centerAddress}`, margin, margin);
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin + 14, canvas.width * ratio, canvas.height * ratio);
    pdf.save(`x1_flow_${stamp(flowData)}.pdf`);
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={busy} className="border-line-strong bg-transparent text-ink hover:bg-surface-3">
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            {busy ? 'Exporting' : 'Export'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="border-line bg-surface-2 text-ink">
          <DropdownMenuItem onClick={exportJson} className="cursor-pointer"><FileJson className="mr-2 h-4 w-4" aria-hidden="true" />JSON</DropdownMenuItem>
          <DropdownMenuItem onClick={exportCsv} className="cursor-pointer"><FileSpreadsheet className="mr-2 h-4 w-4" aria-hidden="true" />CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={exportPng} className="cursor-pointer"><FileImage className="mr-2 h-4 w-4" aria-hidden="true" />PNG image</DropdownMenuItem>
          <DropdownMenuItem onClick={exportPdf} className="cursor-pointer"><FileText className="mr-2 h-4 w-4" aria-hidden="true" />PDF</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {message && (
        <span role={message.ok ? 'status' : 'alert'} className={`text-xs ${message.ok ? 'text-ink-muted' : 'text-negative'}`}>{message.text}</span>
      )}
    </div>
  );
});

export default FlowExport;
