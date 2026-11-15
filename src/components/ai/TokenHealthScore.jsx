import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Panel, Pill } from '@/components/ds/Primitives';
import { ErrorState, Skeleton } from '@/components/ds/States';
import { api } from '@/lib/x1/api';
import { cn } from '@/lib/utils';

/** Rule-based review of a token's on-chain facts (authorities, holder concentration, liquidity). */
export default function TokenHealthScore({ mint }) {
  const [state, setState] = useState({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const data = await api.tokenAnalysis(mint);
      setState({ status: 'ready', analysis: data.analysis });
    } catch (err) {
      setState({ status: 'error', message: err.message });
    }
  }, [mint]);

  useEffect(() => {
    load();
  }, [load]);

  const a = state.analysis;
  const tone = a?.risk_level === 'Low' ? 'positive' : a?.risk_level === 'Medium' ? 'warning' : 'negative';
  return (
    <Panel title="Risk review" description="Rule-based check of on-chain facts" bodyClassName="p-4">
      {state.status === 'loading' && <Skeleton className="h-24 w-full" />}
      {state.status === 'error' && <ErrorState description={state.message} onRetry={load} className="py-6" />}
      {a && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-ink">
              {a.risk_level === 'Low' ? <ShieldCheck className="h-4 w-4 text-positive" aria-hidden="true" /> : <ShieldAlert className="h-4 w-4 text-warning" aria-hidden="true" />}
              Health score {a.health_score}/10
            </span>
            <Pill tone={tone}>{a.risk_level} risk</Pill>
          </div>
          <ul className="space-y-1.5 text-sm">
            {a.findings.map((f, i) => (
              <li key={i} className="flex gap-2 text-ink-soft">
                <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', f.level === 'risk' ? 'bg-negative' : f.level === 'warn' ? 'bg-warning' : 'bg-positive')} aria-hidden="true" />
                <span><span className="sr-only">{f.level}: </span>{f.text}</span>
              </li>
            ))}
          </ul>
          {a.not_assessed?.length > 0 && <p className="text-xs text-ink-faint">Not assessed: {a.not_assessed.join(', ')}.</p>}
          <p className="text-xs text-ink-faint">{a.method}</p>
        </div>
      )}
    </Panel>
  );
}
