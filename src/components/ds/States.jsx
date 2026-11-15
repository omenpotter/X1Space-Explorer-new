import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Skeleton({ className, style }) {
  return <div className={cn('skeleton', className)} style={style} aria-hidden="true" />;
}

/** Placeholder rows shaped like a table while data loads. */
export function TableSkeleton({ rows = 8, columns = 5 }) {
  return (
    <div role="status" aria-label="Loading" className="divide-y divide-line/60">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 flex-1" style={{ maxWidth: `${28 + ((r * 7) % 18)}%` }} />
          {Array.from({ length: columns - 1 }, (_, c) => (
            <Skeleton key={c} className="hidden h-4 w-20 sm:block" />
          ))}
        </div>
      ))}
      <span className="sr-only">Loading data</span>
    </div>
  );
}

export function StatSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="panel p-4">
          <Skeleton className="mb-3 h-3 w-20" />
          <Skeleton className="h-7 w-28" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-muted">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="font-display text-base font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Could not load data', description, onRetry, className }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-negative/30 bg-negative/10 text-negative">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="font-display text-base font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-md text-sm text-ink-muted">{description || 'The data source did not respond. Nothing is shown rather than showing outdated or estimated values.'}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm" className="mt-4 border-line-strong bg-transparent text-ink hover:bg-surface-3">
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}

/** Inline marker for a value that is not available. Explains why on hover and to screen readers. */
export function Unavailable({ reason = 'Not available from the data source', className }) {
  return (
    <span title={reason} className={cn('text-ink-faint', className)}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{reason}</span>
    </span>
  );
}
