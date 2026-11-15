import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/lib/x1/api';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

const POLL_MS = 5 * 60 * 1000;

const SEVERITY = {
  High: { box: 'border-negative/30 bg-negative/10', icon: 'text-negative', text: 'text-negative' },
  Medium: { box: 'border-warning/30 bg-warning/10', icon: 'text-warning', text: 'text-warning' },
  Low: { box: 'border-line-strong bg-surface-2', icon: 'text-ink-muted', text: 'text-ink-muted' },
};

/**
 * Shows the result of the backend threshold checks on live network values.
 * Renders nothing when the checks pass or when the check itself could not be run:
 * an unreachable detector is not evidence of a problem.
 */
export default function NetworkAnomalyAlert({ className }) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const data = await api.anomalies();
        if (!cancelled) setResult(data?.action === 'alert' ? data : null);
      } catch {
        if (!cancelled) setResult(null);
      }
    };
    check();
    const id = setInterval(() => {
      if (!document.hidden) check();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!result) return null;

  const issues = Array.isArray(result.issues) ? result.issues : [];
  const tone = SEVERITY[result.severity] || SEVERITY.Medium;

  return (
    <div role="status" className={cn('mb-6 flex items-start gap-3 rounded-xl border p-4 text-sm', tone.box, className)}>
      <AlertTriangle className={cn('mt-0.5 h-4 w-4 shrink-0', tone.icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">
          Network check: {result.severity ? `${result.severity.toLowerCase()} severity` : 'attention needed'}
        </p>
        {issues.length > 0 ? (
          <ul className="mt-1 space-y-1 text-ink-soft">
            {issues.map((issue, i) => (
              <li key={`${issue.metric}-${i}`}>
                <span className={cn('font-medium', (SEVERITY[issue.severity] || tone).text)}>{issue.severity}:</span> {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          result.message && <p className="mt-1 text-ink-soft">{result.message}</p>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          {result.method}
          {result.fetchedAt ? ` Checked ${timeAgo(result.fetchedAt)}.` : ''}
        </p>
      </div>
    </div>
  );
}
