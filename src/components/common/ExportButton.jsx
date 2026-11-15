import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * One CSV cell. Every field is quoted and embedded quotes are doubled. Text that a spreadsheet
 * would evaluate as a formula (leading = + - @, tab or carriage return) is prefixed with a single
 * quote: validator and token names are untrusted on-chain text. Real numbers are left as they are.
 */
export function csvCell(value) {
  if (value === null || value === undefined) return '""';
  if (typeof value === 'number') return Number.isFinite(value) ? `"${value}"` : '""';
  let text = typeof value === 'object' ? JSON.stringify(value) ?? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(headers.map((h) => csvCell(row?.[h])).join(','));
  return lines.join('\r\n');
}

export default function ExportButton({ data, filename = 'export', label = 'Export CSV' }) {
  const empty = !Array.isArray(data) || data.length === 0;

  const exportToCsv = () => {
    if (empty) return;
    const blob = new Blob([toCsv(data)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${String(filename).replace(/[^\w.-]+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={exportToCsv} disabled={empty} className="border-line-strong bg-transparent text-ink-soft hover:bg-surface-3 hover:text-ink">
      <Download className="mr-2 h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
