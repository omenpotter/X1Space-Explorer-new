import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, Search } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { Freshness, Panel, StatCard } from '@/components/ds/Primitives';
import { ErrorState, StatSkeleton, Unavailable } from '@/components/ds/States';
import { StatusPill, ValidatorIdentity, isNum, matchesValidator, useValidators } from '@/components/validators/ValidatorCard';
import X1Rpc from '@/components/x1/X1RpcService';
import { X1_CONFIG } from '@/lib/x1/config';
import { compact, integer, percent } from '@/lib/format';
import { cn } from '@/lib/utils';

const TIMEFRAMES = [
  { key: 'day', label: 'Day', years: 1 / 365 },
  { key: 'month', label: 'Month', years: 1 / 12 },
  { key: 'year', label: 'Year', years: 1 },
  { key: 'five', label: '5 years', years: 5 },
];
const inputClass = 'h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/25';

const fmtAmount = (n) => (isNum(n) ? n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 6 : 2 }) : '—');

/** Parses a user-typed number; empty or invalid input is null (never silently 0). */
function parseInput(text) {
  if (String(text).trim() === '') return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Network-wide staking figures from the RPC: inflation paid to validators, supply, and total active stake. */
function useNetworkEconomics(pollMs) {
  const [state, setState] = useState({ status: 'loading', inflation: null, supply: null, error: null, loadedAt: null, stale: false });
  const load = useCallback(async () => {
    try {
      const [inflation, supply] = await Promise.all([X1Rpc.getInflationRate(), X1Rpc.getSupply()]);
      const validatorRate = Number(inflation?.validator);
      const total = Number(supply?.value?.total) / 1e9;
      setState({
        status: 'ready',
        inflation: { validator: Number.isFinite(validatorRate) ? validatorRate : null, total: Number.isFinite(Number(inflation?.total)) ? Number(inflation.total) : null, epoch: inflation?.epoch ?? null },
        supply: Number.isFinite(total) && total > 0 ? total : null,
        error: null,
        loadedAt: Date.now(),
        stale: false,
      });
    } catch (err) {
      setState((s) => (s.status === 'ready' ? { ...s, stale: true } : { status: 'error', inflation: null, supply: null, error: err?.message || 'The X1 RPC did not respond.', loadedAt: null, stale: false }));
    }
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);
  return { ...state, reload: load };
}

export default function StakingCalculator() {
  const val = useValidators(X1_CONFIG.polling.validatorsMs);
  const econ = useNetworkEconomics(X1_CONFIG.polling.validatorsMs);

  const [amountText, setAmountText] = useState('');
  const [timeframe, setTimeframe] = useState('year');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [overrideText, setOverrideText] = useState('');
  const [adjustVote, setAdjustVote] = useState(false);

  const active = useMemo(() => val.validators.filter((v) => !v.delinquent), [val.validators]);
  const selected = useMemo(() => active.find((v) => v.votePubkey === selectedId) || null, [active, selectedId]);
  const choices = useMemo(() => active.filter((v) => matchesValidator(v, query)).slice(0, query.trim() ? 30 : 10), [active, query]);

  // Total active stake across every vote account, in XNT.
  const totalStake = useMemo(() => {
    const sum = val.validators.reduce((s, v) => s + (isNum(v.activatedStake) ? v.activatedStake : 0), 0);
    return sum > 0 ? sum : null;
  }, [val.validators]);

  const amount = parseInput(amountText);
  const override = parseInput(overrideText);
  const networkInflation = econ.inflation?.validator ?? null; // fraction per year paid to stakers
  const usingOverride = override !== null;
  const inflationUsed = usingOverride ? override / 100 : networkInflation;

  // Gross yearly staker yield = (validator inflation x supply) / total active stake.
  const grossYield = inflationUsed !== null && econ.supply && totalStake ? (inflationUsed * econ.supply) / totalStake : null;
  const commission = selected && isNum(selected.commission) ? selected.commission : null;
  const voteFactor = adjustVote && selected && isNum(selected.voteRate) ? selected.voteRate / 100 : 1;
  const netYield = grossYield !== null && commission !== null ? grossYield * (1 - commission / 100) * voteFactor : null;

  const tf = TIMEFRAMES.find((t) => t.key === timeframe);
  const rewards = netYield !== null && amount !== null ? amount * netYield * tf.years : null;

  const loading = val.status === 'loading' || econ.status === 'loading';
  const failed = val.status === 'error' || econ.status === 'error';
  const retry = () => { val.reload(); econ.reload(); };
  const loadedAt = val.loadedAt && econ.loadedAt ? Math.min(val.loadedAt, econ.loadedAt) : null;

  return (
    <>
      <PageHeader
        icon={Calculator}
        title="Staking calculator"
        description="Estimate staking rewards from the live inflation rate, supply, total active stake and a validator's commission."
        meta={<Freshness at={loadedAt} stale={val.refreshFailed || econ.stale} source="X1 RPC" onRefresh={retry} refreshing={val.refreshing} />}
      />

      {loading && !failed && <StatSkeleton count={4} />}
      {failed && <Panel><ErrorState title="Staking inputs are unavailable" description={val.error || econ.error} onRetry={retry} /></Panel>}

      {!loading && !failed && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Validator inflation" value={networkInflation === null ? '—' : percent(networkInflation * 100, 3)} hint={`Yearly share of supply paid to stakers${econ.inflation?.epoch != null ? ` (epoch ${econ.inflation.epoch})` : ''}`} tone="brand" />
            <StatCard label="Total supply" value={econ.supply ? `${compact(econ.supply)} XNT` : '—'} hint="getSupply" />
            <StatCard label="Total active stake" value={totalStake ? `${compact(totalStake)} XNT` : '—'} hint={`Across ${integer(val.validators.length)} vote accounts`} />
            <StatCard label="Gross staker yield" value={grossYield === null ? '—' : percent(grossYield * 100, 2)} hint="Before commission, per year, not compounded" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Inputs">
              <div className="space-y-5 p-4">
                <div>
                  <label htmlFor="stake-amount" className="eyebrow mb-1.5 block">Amount to stake (XNT)</label>
                  <input id="stake-amount" inputMode="decimal" type="number" min="0" step="any" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="Enter an amount" className={inputClass} />
                </div>

                <fieldset>
                  <legend className="eyebrow mb-1.5">Timeframe</legend>
                  <div className="flex flex-wrap gap-2">
                    {TIMEFRAMES.map((t) => (
                      <button key={t.key} type="button" aria-pressed={timeframe === t.key} onClick={() => setTimeframe(t.key)} className={cn('h-9 flex-1 rounded-lg border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40', timeframe === t.key ? 'border-brand/40 bg-brand/10 text-brand' : 'border-line-strong text-ink-soft hover:bg-surface-3')}>{t.label}</button>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="inflation-override" className="eyebrow mb-1.5 block">Assumed validator inflation (optional, % per year)</label>
                  <input id="inflation-override" type="number" min="0" step="any" value={overrideText} onChange={(e) => setOverrideText(e.target.value)} placeholder={networkInflation === null ? 'Not available from RPC' : `Leave empty to use ${(networkInflation * 100).toFixed(3)}% from RPC`} className={inputClass} />
                  <p className="mt-1 text-xs text-ink-muted">{usingOverride ? 'Your assumption is being used instead of the on-chain rate.' : 'Inflation changes over time. Enter a figure here to model a different rate.'}</p>
                </div>

                <label className="flex items-start gap-2 text-sm text-ink-soft">
                  <input type="checkbox" checked={adjustVote} onChange={(e) => setAdjustVote(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" />
                  <span>Scale by the validator's vote rate this epoch <span className="text-ink-muted">(an assumption that credits earned track rewards; vote rate is a snapshot)</span></span>
                </label>
              </div>
            </Panel>

            <Panel title="Estimated rewards" description="Estimate only">
              <div className="space-y-4 p-4">
                <div>
                  <p className="eyebrow">Estimated rewards per {tf.label.toLowerCase()}</p>
                  <p className="mt-2 font-display text-3xl font-semibold tabular text-brand">
                    {rewards === null ? <Unavailable reason={!selected ? 'Choose a validator' : amount === null ? 'Enter an amount' : 'Inputs from the RPC are missing'} /> : `${fmtAmount(rewards)} XNT`}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {!selected ? 'Choose a validator to see an estimate.' : amount === null ? 'Enter an amount to stake.' : `Estimated yearly rate after commission: ${netYield === null ? '—' : percent(netYield * 100, 2)}`}
                  </p>
                </div>

                <dl className="divide-y divide-line/60 rounded-lg border border-line text-sm">
                  {[
                    ['Validator inflation', inflationUsed === null ? null : percent(inflationUsed * 100, 3), usingOverride ? 'your assumption' : 'from RPC'],
                    ['Total supply', econ.supply ? `${compact(econ.supply)} XNT` : null, ''],
                    ['Total active stake', totalStake ? `${compact(totalStake)} XNT` : null, ''],
                    ['Gross yield', grossYield === null ? null : percent(grossYield * 100, 2), ''],
                    ['Validator commission', commission === null ? null : `${commission}%`, selected ? '' : 'choose a validator'],
                    ['Vote rate factor', adjustVote ? (selected && isNum(selected.voteRate) ? percent(selected.voteRate, 1) : null) : 'not applied', 'assumption'],
                  ].map(([k, v, note]) => (
                    <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
                      <dt className="text-ink-muted">{k}</dt>
                      <dd className="tabular text-ink">{v === null ? <Unavailable /> : v}{note && <span className="ml-1 text-xs text-ink-muted">({note})</span>}</dd>
                    </div>
                  ))}
                </dl>

                <div className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-sm text-warning">
                  <p><strong>Estimates, not promises.</strong> Actual rewards depend on inflation (which changes), total stake, the validator's performance and commission, and when your stake activates.</p>
                  <p className="mt-2 text-xs">
                    Formula: rewards = amount x (inflation x supply / total active stake) x (1 - commission){adjustVote ? ' x vote rate' : ''} x years. Simple, not compounded. Multi-year figures hold today's rates constant.
                  </p>
                </div>
              </div>
            </Panel>
          </div>

          <Panel title="Choose a validator" description={`${integer(active.length)} active validators`}>
            <div className="border-b border-line px-4 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, vote address or identity address" aria-label="Search validators" className="h-9 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/25" />
              </div>
            </div>
            {choices.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-muted">No active validators match.</p>
            ) : (
              <ul className="max-h-[360px] divide-y divide-line/60 overflow-y-auto" aria-label="Validators">
                {choices.map((v) => {
                  const isSel = v.votePubkey === selectedId;
                  return (
                    <li key={v.votePubkey}>
                      <button type="button" aria-pressed={isSel} onClick={() => setSelectedId(v.votePubkey)} className={cn('flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/40', isSel && 'bg-brand/10')}>
                        <ValidatorIdentity validator={v} size={28} sub={<span className="tabular">{compact(v.activatedStake)} XNT staked</span>} />
                        <span className="flex shrink-0 items-center gap-3 text-sm">
                          <span className="tabular text-ink-soft">{isNum(v.commission) ? `${v.commission}% commission` : <Unavailable reason="Commission not reported" />}</span>
                          <StatusPill validator={v} className="hidden sm:inline-flex" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
