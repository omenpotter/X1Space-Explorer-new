import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe2, MapPinOff } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import WorldMap from '@/components/map/WorldMap';
import { ValidatorAvatar } from '@/components/ds/Avatar';
import { Freshness, Meter, Panel, Pill, StatCard } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, Skeleton, StatSkeleton } from '@/components/ds/States';
import X1Rpc from '@/components/x1/X1RpcService';
import { fetchValidatorDirectory, getDirectoryMeta } from '@/components/x1/ValidatorNames';
import { X1_CONFIG } from '@/lib/x1/config';
import { compact, integer, percent } from '@/lib/format';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

const CONTINENTS = { NA: 'North America', SA: 'South America', EU: 'Europe', AF: 'Africa', AS: 'Asia', OC: 'Oceania', AN: 'Antarctica' };
const STAKE_FILTERS = [
  { value: 0, label: 'Any stake' },
  { value: 10_000, label: '≥ 10K XNT' },
  { value: 100_000, label: '≥ 100K XNT' },
  { value: 1_000_000, label: '≥ 1M XNT' },
];

const selectClass = 'h-8 rounded-lg border border-line bg-surface-2 px-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand/25';

/** @param {{ v?: any, [key: string]: any }} props */
function ValidatorRow({ v }) {
  return (
    <li>
      <Link to={`${createPageUrl('ValidatorDetail')}?id=${v.votePubkey}`} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2">
        <ValidatorAvatar validator={v} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{v.name}</span>
          <span className="block text-xs text-ink-muted">{compact(v.activatedStake)} XNT · {v.stakePercent}% of stake</span>
        </span>
        <Pill tone={v.delinquent ? 'negative' : 'positive'}>{v.delinquent ? 'Delinquent' : 'Active'}</Pill>
      </Link>
    </li>
  );
}

/** @param {{ title?: any, rows?: any, total?: any, unit?: any, [key: string]: any }} props */
function Distribution({ title, rows, total, unit }) {
  return (
    <Panel title={title} bodyClassName="p-4">
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">No located validators match the current filters.</p>
      ) : (
        <ol className="space-y-3">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-ink">{r.label}</span>
                <span className="shrink-0 tabular text-ink-muted">
                  {integer(r.count)} {unit} · <span className="text-ink">{percent(total > 0 ? (r.stake / total) * 100 : 0, 1)}</span> of stake
                </span>
              </div>
              <Meter value={r.stake} max={total} label={`${r.label} share of located stake`} />
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export default function NetworkMap() {
  const [state, setState] = useState(/** @type {Record<string, any>} */ ({ status: 'loading', validators: [], meta: null, error: null, loadedAt: null }));
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState({ status: 'all', continent: 'all', minStake: 0, precision: 'all' });
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    try {
      await fetchValidatorDirectory(background);
      const validators = await X1Rpc.getValidatorDetails();
      setState({ status: 'ready', validators, meta: getDirectoryMeta(), error: null, loadedAt: Date.now() });
    } catch (err) {
      // Keep the last good data during a failed background refresh.
      setState((s) => (background && s.validators.length ? { ...s, refreshFailed: true } : { status: 'error', validators: [], meta: null, error: err?.message || 'The X1 RPC did not respond.', loadedAt: null }));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (!document.hidden) load(true);
    }, X1_CONFIG.polling.networkMapMs);
    return () => clearInterval(id);
  }, [load]);

  const filtered = useMemo(
    () => state.validators.filter((v) => {
      if (filters.status === 'active' && v.delinquent) return false;
      if (filters.status === 'delinquent' && !v.delinquent) return false;
      if (v.activatedStake < filters.minStake) return false;
      if (filters.continent !== 'all' && v.location?.continent !== filters.continent) return false;
      if (filters.precision === 'city' && v.location?.precision !== 'city') return false;
      return true;
    }),
    [state.validators, filters],
  );

  const located = useMemo(() => filtered.filter((v) => v.location), [filtered]);
  const unlocated = useMemo(() => filtered.filter((v) => !v.location), [filtered]);
  const locatedStake = useMemo(() => located.reduce((s, v) => s + v.activatedStake, 0), [located]);

  // One marker per distinct position. Validators in the same place are grouped, never spread out artificially.
  const clusters = useMemo(() => {
    const map = new Map();
    for (const v of located) {
      const key = `${v.location.lat},${v.location.lon}`;
      const c = map.get(key) || { id: key, lat: v.location.lat, lon: v.location.lon, country: v.location.country, precision: v.location.precision, validators: [], stake: 0, delinquent: 0 };
      c.validators.push(v);
      c.stake += v.activatedStake;
      if (v.delinquent) c.delinquent += 1;
      map.set(key, c);
    }
    const maxStake = Math.max(1, ...[...map.values()].map((c) => c.stake));
    return [...map.values()].map((c) => ({
      ...c,
      radius: 5 + 17 * Math.sqrt(c.stake / maxStake),
      hollow: c.precision !== 'city',
      tone: c.delinquent === c.validators.length ? 'negative' : c.delinquent > 0 ? 'warning' : 'brand',
      label: `${c.country || 'Unknown country'}, ${c.precision === 'city' ? 'city-level position' : 'country-level position'}: ${c.validators.length} validator${c.validators.length === 1 ? '' : 's'}, ${compact(c.stake)} XNT staked${c.delinquent ? `, ${c.delinquent} delinquent` : ''}`,
    }));
  }, [located]);

  const group = useCallback((keyOf, labelOf) => {
    const map = new Map();
    for (const v of located) {
      const key = keyOf(v) || 'unknown';
      const g = map.get(key) || { key, label: labelOf(v, key), count: 0, stake: 0 };
      g.count += 1;
      g.stake += v.activatedStake;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => b.stake - a.stake);
  }, [located]);

  const byContinent = useMemo(() => group((v) => v.location.continent, (v, k) => CONTINENTS[k] || 'Unknown region'), [group]);
  const byCountry = useMemo(() => group((v) => v.location.countryCode, (v) => v.location.country || 'Unknown country'), [group]);
  const continentOptions = useMemo(() => [...new Set(state.validators.map((v) => v.location?.continent).filter(Boolean))].sort(), [state.validators]);
  const selectedCluster = clusters.find((c) => c.id === selected) || null;

  const meta = state.meta;
  const geoDown = state.status === 'ready' && (meta?.unavailable || meta?.fallback || meta?.sources?.geolocation?.status !== 'ok');
  const cityCount = located.filter((v) => v.location.precision === 'city').length;

  return (
    <>
      <PageHeader
        icon={Globe2}
        title="Network Map"
        description="Approximate locations of X1 mainnet validators, grouped by position and sized by stake."
        meta={<Freshness at={state.loadedAt} stale={!!state.refreshFailed} source="X1 RPC · on-chain identity · geojs.io" onRefresh={() => load(true)} refreshing={refreshing} />}
      />

      {state.status === 'loading' && (
        <div role="status" aria-label="Loading network map">
          <StatSkeleton />
          <Skeleton className="mt-6 aspect-[960/500] w-full rounded-xl" />
        </div>
      )}

      {state.status === 'error' && (
        <Panel>
          <ErrorState title="Validator data is unavailable" description={state.error} onRetry={() => load()} />
        </Panel>
      )}

      {state.status === 'ready' && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Validators" value={integer(filtered.length)} hint={`${integer(filtered.filter((v) => !v.delinquent).length)} active · ${integer(filtered.filter((v) => v.delinquent).length)} delinquent`} tone="brand" />
            <StatCard label="Located" value={`${integer(located.length)} / ${integer(filtered.length)}`} hint={`${integer(cityCount)} city-level · ${integer(located.length - cityCount)} country-level`} />
            <StatCard label="Countries" value={integer(byCountry.filter((c) => c.key !== 'unknown').length)} hint={byCountry[0] ? `Most stake: ${byCountry[0].label}` : undefined} />
            <StatCard label="Largest country share" value={byCountry[0] && locatedStake > 0 ? percent((byCountry[0].stake / locatedStake) * 100, 1) : '—'} hint="Of located stake" tone={byCountry[0] && byCountry[0].stake / locatedStake > 0.5 ? 'warning' : 'default'} />
          </div>

          {geoDown && (
            <div role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-ink-soft">
              <MapPinOff className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
              <p>
                <span className="font-medium text-ink">Location data is unavailable right now.</span> The location service did not respond, so validators are listed without positions.
                Nothing is placed on the map by guesswork.
              </p>
            </div>
          )}

          <Panel
            title="Validator locations"
            description="Solid markers are city-level positions. Dashed markers mark a country only."
            actions={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <select aria-label="Filter by status" className={selectClass} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="delinquent">Delinquent</option>
                </select>
                <select aria-label="Filter by region" className={selectClass} value={filters.continent} onChange={(e) => setFilters({ ...filters, continent: e.target.value })}>
                  <option value="all">All regions</option>
                  {continentOptions.map((c) => <option key={c} value={c}>{CONTINENTS[c] || c}</option>)}
                </select>
                <select aria-label="Filter by stake" className={selectClass} value={filters.minStake} onChange={(e) => setFilters({ ...filters, minStake: Number(e.target.value) })}>
                  {STAKE_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select aria-label="Filter by location precision" className={selectClass} value={filters.precision} onChange={(e) => setFilters({ ...filters, precision: e.target.value })}>
                  <option value="all">Any precision</option>
                  <option value="city">City-level only</option>
                </select>
              </div>
            }
            bodyClassName="p-3"
          >
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <WorldMap
                  markers={clusters}
                  selectedId={selected}
                  onSelect={(id) => setSelected((s) => (s === id ? null : id))}
                  renderTooltip={(c) => (
                    <>
                      <p className="font-medium text-ink">{c.country || 'Unknown country'}</p>
                      <p className="mt-0.5 text-ink-muted">{c.precision === 'city' ? 'City-level position (approximate)' : 'Country-level only'}</p>
                      <dl className="mt-2 space-y-1">
                        <div className="flex justify-between gap-3"><dt className="text-ink-muted">Validators</dt><dd className="tabular text-ink">{c.validators.length}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-ink-muted">Stake</dt><dd className="tabular text-ink">{compact(c.stake)} XNT</dd></div>
                        {c.delinquent > 0 && <div className="flex justify-between gap-3"><dt className="text-ink-muted">Delinquent</dt><dd className="tabular text-negative">{c.delinquent}</dd></div>}
                      </dl>
                      <p className="mt-2 text-ink-faint">Select to list validators</p>
                    </>
                  )}
                />
                <ul className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs text-ink-muted" aria-label="Map legend">
                  <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-brand bg-brand/30" aria-hidden="true" />Active</li>
                  <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-warning bg-warning/30" aria-hidden="true" />Some delinquent</li>
                  <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-negative bg-negative/30" aria-hidden="true" />All delinquent</li>
                  <li className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-dashed border-ink-muted" aria-hidden="true" />Country-level position</li>
                  <li>Marker size = combined stake</li>
                </ul>
              </div>

              <div className="rounded-lg border border-line bg-surface-2/50" aria-live="polite">
                {selectedCluster ? (
                  <>
                    <div className="border-b border-line px-4 py-3">
                      <p className="text-sm font-medium text-ink">{selectedCluster.country || 'Unknown country'}</p>
                      <p className="text-xs text-ink-muted">
                        {selectedCluster.validators.length} validator{selectedCluster.validators.length === 1 ? '' : 's'} · {compact(selectedCluster.stake)} XNT ·{' '}
                        {selectedCluster.precision === 'city' ? 'city-level' : 'country-level'}
                      </p>
                    </div>
                    <ul className="max-h-[420px] overflow-y-auto p-2">
                      {selectedCluster.validators.map((v) => <ValidatorRow key={v.votePubkey} v={v} />)}
                    </ul>
                  </>
                ) : (
                  <EmptyState
                    icon={Globe2}
                    title={clusters.length ? 'Select a marker' : 'Nothing to show on the map'}
                    description={clusters.length ? 'Choose a marker to list the validators at that position.' : 'No located validators match the current filters.'}
                    className="py-10"
                  />
                )}
              </div>
            </div>
          </Panel>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Distribution title="Stake by region" rows={byContinent} total={locatedStake} unit="validators" />
            <Distribution title="Stake by country" rows={byCountry.slice(0, 8)} total={locatedStake} unit="validators" />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title="Hosting providers" description="All gossip nodes (validators and RPC nodes), by network operator." bodyClassName="p-4">
              {meta?.providers?.length ? (
                <ol className="space-y-3">
                  {meta.providers.slice(0, 8).map((p) => (
                    <li key={p.name}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate text-ink">{p.name}</span>
                        <span className="shrink-0 tabular text-ink-muted">{integer(p.nodes)} nodes{meta.nodes?.total ? ` · ${percent((p.nodes / meta.nodes.total) * 100, 1)}` : ''}</span>
                      </div>
                      <Meter value={p.nodes} max={meta.nodes?.total || p.nodes} label={`${p.name} share of nodes`} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-ink-muted">Provider data is not available.</p>
              )}
            </Panel>

            <Panel title={`Not located (${integer(unlocated.length)})`} description="Validators whose node address could not be resolved to a location. They are listed here instead of being placed on the map." bodyClassName="p-2">
              {unlocated.length === 0 ? (
                <p className="p-2 text-sm text-ink-muted">Every validator matching the filters has a location.</p>
              ) : (
                <ul className={cn('max-h-[340px] overflow-y-auto')}>
                  {unlocated.slice(0, 100).map((v) => <ValidatorRow key={v.votePubkey} v={v} />)}
                </ul>
              )}
            </Panel>
          </div>

          <p className="mt-4 text-xs text-ink-faint">
            Locations come from looking up each node's public gossip address with geojs.io and are rounded to roughly 10 km. They show where a server's network is registered,
            which can differ from where the operator is. Node addresses are never shown or sent to your browser.
          </p>
        </>
      )}
    </>
  );
}
