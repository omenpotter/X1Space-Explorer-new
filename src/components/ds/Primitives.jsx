import { useEffect, useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

/** @param {{ title?: any, description?: any, actions?: any, children?: any, className?: any, bodyClassName?: any, as?: any, [key: string]: any }} props */
export function Panel({ title, description, actions, children, className, bodyClassName, as: Tag = 'section', ...rest }) {
  return (
    <Tag className={cn('panel', className)} {...rest}>
      {(title || actions) && (
        <div className="panel-header">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-medium text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </Tag>
  );
}

const TONES = {
  default: 'text-ink',
  brand: 'text-brand',
  positive: 'text-positive',
  negative: 'text-negative',
  warning: 'text-warning',
};

/** @param {{ label?: any, value?: any, hint?: any, tone?: any, icon?: any, className?: any, [key: string]: any }} props */
export function StatCard({ label, value, hint, tone = 'default', icon: Icon, className }) {
  return (
    <div className={cn('panel p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-ink-faint" aria-hidden="true" />}
      </div>
      <p className={cn('mt-2 font-display text-2xl font-semibold tabular leading-none', TONES[tone] || TONES.default)}>{value}</p>
      {hint && <p className="mt-2 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

const PILL = {
  positive: 'border-positive/25 bg-positive/10 text-positive',
  negative: 'border-negative/25 bg-negative/10 text-negative',
  warning: 'border-warning/25 bg-warning/10 text-warning',
  brand: 'border-brand/25 bg-brand/10 text-brand',
  violet: 'border-violet/25 bg-violet/10 text-violet',
  neutral: 'border-line-strong bg-surface-2 text-ink-muted',
};

/** Status label. Always carries text (and optionally an icon) so meaning never depends on colour alone. */
/** @param {{ tone?: any, icon?: any, children?: any, className?: any, title?: any, [key: string]: any }} props */
export function Pill({ tone = 'neutral', icon: Icon, children, className, title }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium', PILL[tone] || PILL.neutral, className)}>
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** "Updated 12s ago" with the source, refreshed every few seconds. Shows a warning tone when data is stale. */
/** @param {{ at?: any, source?: any, stale?: any, staleAfterMs?: any, onRefresh?: any, refreshing?: any, className?: any, [key: string]: any }} props */
export function Freshness({ at, source, stale = false, staleAfterMs = 5 * 60 * 1000, onRefresh, refreshing = false, className }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  const t = at ? (at instanceof Date ? at.getTime() : typeof at === 'number' ? at : Date.parse(at)) : NaN;
  const old = stale || (Number.isFinite(t) && Date.now() - t > staleAfterMs);
  return (
    <span className={cn('inline-flex items-center gap-2 text-xs', old ? 'text-warning' : 'text-ink-muted', className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', old ? 'bg-warning' : 'bg-positive')} aria-hidden="true" />
      <span>
        {Number.isFinite(t) ? `${old ? 'Stale: updated' : 'Updated'} ${timeAgo(t)}` : 'Not loaded yet'}
        {source ? ` · ${source}` : ''}
      </span>
      {onRefresh && (
        <button type="button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh data" className="rounded p-1 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/** @param {{ value?: any, label?: any, className?: any, [key: string]: any }} props */
export function CopyButton({ value, label = 'Copy', className }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (insecure context or denied): leave the button unchanged.
    }
  };
  return (
    <button type="button" onClick={copy} aria-label={copied ? 'Copied' : label} className={cn('rounded p-1 text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink', className)}>
      {copied ? <Check className="h-3.5 w-3.5 text-positive" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
    </button>
  );
}

/** Proportion bar with an accessible text value. */
/** @param {{ value?: any, max?: any, tone?: any, label?: any, className?: any, [key: string]: any }} props */
export function Meter({ value, max = 100, tone = 'brand', label, className }) {
  const pct = Number.isFinite(value) && max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const bar = { brand: 'bg-brand', positive: 'bg-positive', warning: 'bg-warning', negative: 'bg-negative' }[tone] || 'bg-brand';
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Number.isFinite(value) ? value : undefined} aria-label={label} className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <div className={cn('h-full rounded-full transition-[width] duration-500', bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}
