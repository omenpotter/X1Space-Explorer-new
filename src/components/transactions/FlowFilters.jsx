import { memo } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TX_TYPES } from './ProgramDecoder';

const TYPES = ['all', ...Object.keys(TX_TYPES)];

/** @param {{ id?: any, label?: any, children?: any, [key: string]: any }} props */
function Field({ id, label, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="eyebrow mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

/**
 * Filters for the fetched transactions. `dateRange` holds `YYYY-MM-DD` strings (or ''), and the amounts
 * are XNT, compared with the absolute net change of the analysed address.
 */
const FlowFilters = memo(/** @param {{ filterType?: any, setFilterType?: any, dateRange?: any, setDateRange?: any, amountRange?: any, setAmountRange?: any, searchSignature?: any, setSearchSignature?: any, onClearFilters?: any, [key: string]: any }} props */ function FlowFilters({ filterType, setFilterType, dateRange, setDateRange, amountRange, setAmountRange, searchSignature, setSearchSignature, onClearFilters }) {
  const active = filterType !== 'all' || dateRange.from || dateRange.to || amountRange.min || amountRange.max || searchSignature;

  return (
    <div className="panel space-y-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <label htmlFor="flow-search" className="eyebrow mb-1.5 block">Search</label>
          <Search className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-ink-faint" aria-hidden="true" />
          <Input id="flow-search" placeholder="Signature or address" value={searchSignature} onChange={(e) => setSearchSignature(e.target.value)} className="mono pl-9" />
        </div>
        {active && (
          <Button type="button" variant="outline" size="sm" onClick={onClearFilters} className="border-line-strong bg-transparent text-ink hover:bg-surface-3">
            <X className="mr-2 h-4 w-4" aria-hidden="true" />
            Clear filters
          </Button>
        )}
      </div>

      <div role="group" aria-label="Filter by transaction type" className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilterType(t)}
            aria-pressed={filterType === t}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filterType === t ? 'border-brand/40 bg-brand/10 text-brand' : 'border-line-strong text-ink-muted hover:bg-surface-3 hover:text-ink'}`}
          >
            {t === 'all' ? 'All types' : TX_TYPES[t].label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="flow-from" label="From date">
          <Input id="flow-from" type="date" value={dateRange.from} max={dateRange.to || undefined} onChange={(e) => setDateRange((p) => ({ ...p, from: e.target.value }))} />
        </Field>
        <Field id="flow-to" label="To date">
          <Input id="flow-to" type="date" value={dateRange.to} min={dateRange.from || undefined} onChange={(e) => setDateRange((p) => ({ ...p, to: e.target.value }))} />
        </Field>
        <Field id="flow-min" label="Min change (XNT)">
          <Input id="flow-min" type="number" min="0" step="any" inputMode="decimal" placeholder="No minimum" value={amountRange.min} onChange={(e) => setAmountRange((p) => ({ ...p, min: e.target.value }))} />
        </Field>
        <Field id="flow-max" label="Max change (XNT)">
          <Input id="flow-max" type="number" min="0" step="any" inputMode="decimal" placeholder="No maximum" value={amountRange.max} onChange={(e) => setAmountRange((p) => ({ ...p, max: e.target.value }))} />
        </Field>
      </div>
    </div>
  );
});

export default FlowFilters;
