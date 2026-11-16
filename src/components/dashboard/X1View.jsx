// X1 View: premium transaction-activity section of the dashboard. Real network data only: totals and slot
// counts per minute from the RPC performance samples; the non-vote split is estimated from the latest blocks
// and labelled as such (see src/lib/x1/x1view.js).
import { memo, useMemo, useRef, useState } from 'react';
import usePolling from '@/components/dashboard/usePolling';
import { EmptyState, ErrorState, Skeleton, Unavailable } from '@/components/ds/States';
import X1Rpc from '@/components/x1/X1RpcService';
import { api } from '@/lib/x1/api';
import { X1_CONFIG } from '@/lib/x1/config';
import { buildWindows, CATEGORIES, matrixDots, SAMPLES_NEEDED } from '@/lib/x1/x1view';
import { integer, timeAgo, usd } from '@/lib/format';
import { Activity } from 'lucide-react';
import './x1view.css';

const SAMPLES_POLL_MS = 15 * 1000;
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const ALL_KEYS = [...CATEGORIES, { key: 'nonvote', label: 'Non-vote', hint: 'Non-vote transactions (type split unavailable)' }];

const WindowCard = memo(/** @param {{ win: any, view: string, first: boolean, [key: string]: any }} props */ function WindowCard({ win, view, first }) {
  const dots = useMemo(() => matrixDots(win.counts), [win.counts]);
  const parts = ALL_KEYS.filter((c) => win.counts[c.key] !== undefined && (win.counts[c.key] > 0 || c.key === 'vote'));
  const summary = `${win.label}: ${integer(win.total)} transactions in ${integer(win.slots)} slots. ${parts.map((c) => `${integer(win.counts[c.key])} ${c.label.toLowerCase()}`).join(', ')}${win.estimated ? '. Non-vote split estimated from the latest blocks.' : ''}`;
  return (
    <li className="x1v__card" data-now={first && view === '1m' ? 'true' : 'false'} aria-label={summary} title={summary}>
      <div className="x1v__head">
        <span className="x1v__label">{win.label}</span>
        <span className="x1v__slots">{integer(win.slots)} slots</span>
      </div>
      <div className="x1v__matrix" aria-hidden="true">
        {dots.map((k, i) => <span key={i} className="x1v__dot" data-k={k} />)}
      </div>
      <div className="x1v__foot">
        <p className="x1v__total">{integer(win.total)}</p>
        <p className="text-[11px] text-ink-muted">transactions</p>
        <div className="x1v__counts" aria-hidden="true">
          {parts.map((c) => <span key={c.key} data-k={c.key} title={c.label}>{integer(win.counts[c.key])}</span>)}
        </div>
      </div>
    </li>
  );
});

export default function X1View() {
  const [view, setView] = useState('1m');
  const tabRefs = useRef({});
  const VIEW_KEYS = ['1m', '10m'];
  // Arrow keys, Home and End move between the tabs, as the ARIA tabs pattern expects.
  const onTabKey = (e) => {
    const i = VIEW_KEYS.indexOf(view);
    let next = null;
    if (e.key === 'ArrowRight') next = VIEW_KEYS[(i + 1) % VIEW_KEYS.length];
    else if (e.key === 'ArrowLeft') next = VIEW_KEYS[(i + VIEW_KEYS.length - 1) % VIEW_KEYS.length];
    else if (e.key === 'Home') next = VIEW_KEYS[0];
    else if (e.key === 'End') next = VIEW_KEYS[VIEW_KEYS.length - 1];
    if (next) {
      e.preventDefault();
      setView(next);
      tabRefs.current[next]?.focus();
    }
  };
  const samples = usePolling(() => X1Rpc.getRecentPerformanceSamples(SAMPLES_NEEDED), SAMPLES_POLL_MS);
  const blocks = usePolling(() => X1Rpc.getRecentBlocks(10), X1_CONFIG.polling.blocksMs);
  const price = usePolling(() => api.tokenPrice(X1_CONFIG.nativeMint), X1_CONFIG.polling.priceMs);

  const windows = useMemo(
    () => buildWindows({ samples: samples.data, blocks: blocks.data, view }),
    [samples.data, blocks.data, view],
  );
  const anyEstimate = windows.some((w) => w.estimated);
  const anySplitMissing = windows.some((w) => !w.split);
  const priceUsd = price.data?.data?.priceUsd;
  const stale = samples.stale;
  const legend = ALL_KEYS.filter((c) => c.key !== 'nonvote' || windows.some((w) => w.counts.nonvote > 0));

  return (
    <section aria-labelledby="x1view-title" className="x1v mb-6">
      <div className="x1v__inner">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="x1view-title" className="font-display text-lg font-semibold text-ink">X1 View</h2>
            <div className="x1v__tabs" role="tablist" aria-label="X1 View time scale" onKeyDown={onTabKey}>
              {VIEW_KEYS.map((v) => (
                <button key={v} ref={(el) => { tabRefs.current[v] = el; }} role="tab" id={`x1v-tab-${v}`} type="button" aria-selected={view === v} aria-controls="x1v-panel" tabIndex={view === v ? 0 : -1} className="x1v__tab" onClick={() => setView(v)}>{v}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="x1v__price" title={price.data?.data?.priceSource ? `${price.data.data.priceSource}${price.data.data.priceUpdatedAt ? ` · updated ${timeAgo(price.data.data.priceUpdatedAt)}` : ''}` : undefined}>
              {isNum(priceUsd) ? `XNT ${usd(priceUsd)}` : price.status === 'loading' ? <Skeleton className="inline-block h-4 w-20 align-middle" /> : <Unavailable reason="No XNT price could be fetched" />}
            </span>
            <span className="x1v__live" data-stale={stale ? 'true' : 'false'} role="status">
              <i aria-hidden="true" />{stale ? 'STALE' : 'LIVE'}
            </span>
          </div>
        </div>

        <ul className="x1v__legend mb-4" aria-label="Transaction type legend">
          {legend.map((c) => <li key={c.key} title={c.hint}><i data-k={c.key} aria-hidden="true" />{c.label}</li>)}
        </ul>

        {samples.status === 'loading' && <Skeleton className="h-52 w-full" />}
        {samples.status === 'error' && <ErrorState title="Transaction activity is unavailable" description={samples.error?.message} onRetry={samples.reload} className="py-8" />}
        {samples.status === 'ready' && windows.length === 0 && <EmptyState icon={Activity} title="Not enough samples yet" description="The RPC node returned too few performance samples for this view." />}
        {samples.status === 'ready' && windows.length > 0 && (
          <div id="x1v-panel" role="tabpanel" aria-labelledby={`x1v-tab-${view}`}>
          <ul className="x1v__row" tabIndex={0} aria-label={`Transactions per ${view === '1m' ? 'minute' : 'ten minutes'}`}>
            {windows.map((w, i) => <WindowCard key={w.key} win={w} view={view} first={i === 0} />)}
          </ul>
          </div>
        )}

        <p className="mt-1 text-xs text-ink-muted">
          Totals and slot counts are exact RPC performance samples{samples.loadedAt ? ` (updated ${timeAgo(samples.loadedAt)})` : ''}. Each matrix has 80 dots shared out in proportion to the counts.
          {anyEstimate ? ' The transfer / token-program / other split of non-vote transactions is estimated from the latest confirmed blocks; the vote count is exact.' : ''}
          {anySplitMissing ? ' Where no type split could be computed, the type counts are not shown rather than guessed.' : ''}
        </p>
      </div>
    </section>
  );
}
