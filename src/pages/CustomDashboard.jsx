import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowDown, ArrowUp, Bell, Clock, Coins, Layers, LayoutGrid, Plus, Save, Search, Settings, TrendingUp, Trash2, Users, X, Zap,
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageHeader from '@/components/shell/PageHeader';
import { Freshness, Meter, Panel, Pill } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, Skeleton, Unavailable } from '@/components/ds/States';
import X1Rpc from '@/components/x1/X1RpcService';
import { rpcCall } from '@/lib/x1/rpcClient';
import { api } from '@/lib/x1/api';
import { X1_CONFIG } from '@/lib/x1/config';
import { compact, integer, percent, usd } from '@/lib/format';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

const LAYOUTS_KEY = 'x1_dashboard_layouts';
const CURRENT_KEY = 'x1_dashboard_current';
const ALERTS_KEY = 'x1_alerts';
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MAX_LAYOUTS = 20;
const MAX_WIDGETS = 16;
const HISTORY_REFRESH_MS = 60000;

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const inputClass = 'h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/25';
const buttonClass = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line-strong px-3 text-sm text-ink-soft transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50';
const primaryButton = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50';
const iconButton = 'rounded p-1.5 text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent';
const tooltipStyle = { backgroundColor: 'hsl(var(--surface-2))', border: '1px solid hsl(var(--line))', borderRadius: 8, color: 'hsl(var(--ink))', fontSize: 12 };

// Every widget shows live data. `needs` says which data source it reads.
const WIDGET_TYPES = {
  network_stats: { name: 'Network Stats', icon: Zap, size: 'medium', needs: 'stats' },
  epoch: { name: 'Epoch Progress', icon: Clock, size: 'medium', needs: 'stats' },
  validators: { name: 'Validator Summary', icon: Users, size: 'medium', needs: 'stats' },
  supply: { name: 'Supply', icon: Coins, size: 'small', needs: 'stats' },
  staking: { name: 'Staked Share of Supply', icon: Layers, size: 'small', needs: 'stats' },
  block_time: { name: 'Slot Time', icon: Clock, size: 'small', needs: 'stats' },
  tps_chart: { name: 'TPS History', icon: Activity, size: 'large', needs: 'history' },
  performance: { name: 'User TPS (non-vote)', icon: TrendingUp, size: 'large', needs: 'history' },
  recent_blocks: { name: 'Recent Blocks', icon: LayoutGrid, size: 'large', needs: 'blocks' },
  tx_types: { name: 'Transaction Types', icon: Activity, size: 'medium', needs: 'blocks' },
  network_health: { name: 'RPC Health', icon: Activity, size: 'medium', needs: 'health' },
  price_widget: { name: 'XNT Price', icon: TrendingUp, size: 'small', needs: 'price' },
  validator_alerts: { name: 'Validator Alerts', icon: Bell, size: 'medium', needs: null },
  address_lookup: { name: 'Address Lookup', icon: Search, size: 'medium', needs: null },
};

const DEFAULT_LAYOUTS = {
  default: { name: 'Default', widgets: ['network_stats', 'epoch', 'validators', 'tps_chart', 'supply'] },
  minimal: { name: 'Minimal', widgets: ['network_stats', 'epoch'] },
  full: { name: 'Full', widgets: ['network_stats', 'epoch', 'validators', 'tps_chart', 'supply', 'recent_blocks', 'performance'] },
};

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Layouts come from localStorage and are untrusted: keep only known widget ids, once each. */
function cleanWidgets(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const id of list) {
    if (typeof id === 'string' && Object.prototype.hasOwnProperty.call(WIDGET_TYPES, id) && !out.includes(id)) out.push(id);
    if (out.length >= MAX_WIDGETS) break;
  }
  return out;
}

function readLayouts() {
  try {
    const raw = JSON.parse(localStorage.getItem(LAYOUTS_KEY) || '{}');
    const out = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [key, value] of Object.entries(raw)) {
        if (UNSAFE_KEYS.has(key) || !value || typeof value !== 'object' || Object.keys(out).length >= MAX_LAYOUTS) continue;
        out[key.slice(0, 40)] = { name: key.slice(0, 40), widgets: cleanWidgets(value.widgets) };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function readCurrent() {
  try {
    const v = localStorage.getItem(CURRENT_KEY);
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}

function store(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: layouts last for this visit only.
  }
}

function initialState() {
  const saved = readLayouts();
  const current = readCurrent();
  const has = (k) => k && (Object.prototype.hasOwnProperty.call(saved, k) || Object.prototype.hasOwnProperty.call(DEFAULT_LAYOUTS, k));
  const key = has(current) ? current : 'default';
  const layout = saved[key] || DEFAULT_LAYOUTS[key];
  return { saved, key, widgets: layout.widgets };
}

function alertCount() {
  try {
    const list = JSON.parse(localStorage.getItem(ALERTS_KEY) || '[]');
    return Array.isArray(list) ? list.filter((a) => a && a.enabled === true).length : null;
  } catch {
    return null;
  }
}

/** @param {{ value?: any, children?: any, reason?: any, [key: string]: any }} props */
function Num({ value, children, reason = 'Not available from the data source' }) {
  return isNum(value) ? children : <Unavailable reason={reason} />;
}

/** @param {{ label?: any, children?: any, [key: string]: any }} props */
function Metric({ label, children }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular text-ink">{children}</p>
    </div>
  );
}

/* ------------------------------ Widgets ------------------------------ */

/** @param {{ stats?: any, [key: string]: any }} props */
function NetworkStatsWidget({ stats }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Metric label="Current slot"><Num value={stats?.slot}>{integer(stats?.slot)}</Num></Metric>
      <Metric label="Block height"><Num value={stats?.blockHeight}>{integer(stats?.blockHeight)}</Num></Metric>
      <Metric label="TPS"><Num value={stats?.tps}>{integer(stats?.tps)}</Num></Metric>
      <Metric label="Total transactions"><Num value={stats?.transactionCount}>{compact(stats?.transactionCount)}</Num></Metric>
    </div>
  );
}

/** @param {{ stats?: any, [key: string]: any }} props */
function EpochWidget({ stats }) {
  const pct = isNum(stats?.epochProgress) ? stats.epochProgress * 100 : null;
  const remaining = isNum(stats?.slotsInEpoch) && isNum(stats?.slotIndex) ? stats.slotsInEpoch - stats.slotIndex : null;
  const minutes = remaining !== null && isNum(stats?.slotTimeSeconds) ? Math.round((remaining * stats.slotTimeSeconds) / 60) : null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-ink-muted">Epoch <Num value={stats?.epoch}>{integer(stats?.epoch)}</Num></span>
        <span className="font-semibold tabular text-ink">{pct !== null ? percent(pct, 1) : <Unavailable reason="Epoch progress is not available" />}</span>
      </div>
      {pct !== null && <Meter value={pct} label="Epoch progress" tone="brand" />}
      <div className="mt-2 flex flex-wrap justify-between gap-x-3 text-xs text-ink-muted">
        <span>{remaining !== null ? `${integer(remaining)} slots remaining` : 'Slots remaining unavailable'}</span>
        <span>{minutes !== null ? `about ${integer(minutes)} min at the current slot time` : ''}</span>
      </div>
    </div>
  );
}

/** @param {{ stats?: any, [key: string]: any }} props */
function ValidatorsWidget({ stats }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-center">
      <div>
        <p className="text-2xl font-semibold tabular text-positive"><Num value={stats?.validators?.active}>{integer(stats?.validators?.active)}</Num></p>
        <p className="text-xs text-ink-muted">Active</p>
      </div>
      <div>
        <p className="text-2xl font-semibold tabular text-negative"><Num value={stats?.validators?.delinquent}>{integer(stats?.validators?.delinquent)}</Num></p>
        <p className="text-xs text-ink-muted">Delinquent</p>
      </div>
      <div>
        <p className="text-2xl font-semibold tabular text-ink"><Num value={stats?.stake?.activeXnt}>{compact(stats?.stake?.activeXnt)}</Num></p>
        <p className="text-xs text-ink-muted">Active stake (XNT)</p>
      </div>
    </div>
  );
}

/** @param {{ stats?: any, [key: string]: any }} props */
function SupplyWidget({ stats }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between"><dt className="text-ink-muted">Circulating</dt><dd className="tabular text-brand"><Num value={stats?.supply?.circulatingXnt}>{compact(stats?.supply?.circulatingXnt)} XNT</Num></dd></div>
      <div className="flex justify-between"><dt className="text-ink-muted">Total</dt><dd className="tabular text-ink"><Num value={stats?.supply?.totalXnt}>{compact(stats?.supply?.totalXnt)} XNT</Num></dd></div>
    </dl>
  );
}

/** @param {{ stats?: any, [key: string]: any }} props */
function StakingWidget({ stats }) {
  const total = stats?.supply?.totalXnt;
  const active = stats?.stake?.activeXnt;
  const share = isNum(total) && total > 0 && isNum(active) ? (active / total) * 100 : null;
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-ink-muted">Active stake / total supply</span>
        <span className="font-semibold tabular text-brand">{share !== null ? percent(share, 1) : <Unavailable reason="Needs both active stake and total supply" />}</span>
      </div>
      {share !== null && <Meter value={share} label="Staked share of supply" />}
    </div>
  );
}

/** @param {{ stats?: any, [key: string]: any }} props */
function BlockTimeWidget({ stats }) {
  return (
    <div className="text-center">
      <p className="mb-1 text-xs text-ink-muted">Average slot time (recent samples)</p>
      <p className="text-2xl font-semibold tabular text-brand"><Num value={stats?.slotTimeSeconds}>{Math.round(stats?.slotTimeSeconds * 1000)} ms</Num></p>
    </div>
  );
}

/** @param {{ label?: any, hasData?: any, children?: any, [key: string]: any }} props */
function ChartBox({ label, hasData, children }) {
  return (
    <div className="h-[180px]" role="img" aria-label={label}>
      {hasData ? <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-ink-muted">No history available</div>}
    </div>
  );
}

/** @param {{ history?: any, [key: string]: any }} props */
function TpsChartWidget({ history }) {
  const data = (history || []).filter((p) => isNum(p.tps)).slice(-90).map((p) => ({ time: p.time, tps: Math.round(p.tps) }));
  return (
    <ChartBox label="Transactions per second over the last hour or more, from RPC performance samples" hasData={data.length > 1}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="tpsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--brand))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--brand))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="time" hide />
        <YAxis hide domain={['auto', 'auto']} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => new Date(t).toLocaleTimeString()} formatter={(v) => [`${Number(v).toLocaleString()} TPS`, '']} />
        <Area type="monotone" dataKey="tps" stroke="hsl(var(--brand))" fill="url(#tpsFill)" isAnimationActive={false} />
      </AreaChart>
    </ChartBox>
  );
}

/** @param {{ history?: any, [key: string]: any }} props */
function PerformanceWidget({ history }) {
  const data = (history || []).filter((p) => isNum(p.userTps)).slice(-60).map((p) => ({ time: p.time, userTps: Math.round(p.userTps) }));
  return (
    <ChartBox label="User transactions per second (vote transactions excluded) per minute sample" hasData={data.length > 1}>
      <BarChart data={data}>
        <XAxis dataKey="time" hide />
        <YAxis hide />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => new Date(t).toLocaleTimeString()} formatter={(v) => [`${Number(v).toLocaleString()} user TPS`, '']} />
        <Bar dataKey="userTps" fill="hsl(var(--positive))" isAnimationActive={false} />
      </BarChart>
    </ChartBox>
  );
}

/** @param {{ blocks?: any, [key: string]: any }} props */
function RecentBlocksWidget({ blocks }) {
  if (!blocks) return <Unavailable reason="Recent blocks could not be loaded" />;
  if (blocks.length === 0) return <p className="py-4 text-center text-sm text-ink-muted">No blocks returned by the RPC.</p>;
  return (
    <ul className="max-h-[220px] space-y-2 overflow-y-auto">
      {blocks.slice(0, 6).map((b) => (
        <li key={b.slot} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
          <Link to={`${createPageUrl('BlockDetail')}?slot=${b.slot}`} className="mono rounded text-sm text-brand hover:underline">#{integer(b.slot)}</Link>
          <span className="text-sm tabular text-ink-muted">{integer(b.txCount)} txs</span>
        </li>
      ))}
    </ul>
  );
}

/** @param {{ blocks?: any, [key: string]: any }} props */
function TxTypesWidget({ blocks }) {
  if (!blocks) return <Unavailable reason="Recent blocks could not be loaded" />;
  const total = blocks.reduce((s, b) => s + (b.txCount || 0), 0);
  if (total === 0) return <p className="py-4 text-center text-sm text-ink-muted">No transactions in the recent blocks.</p>;
  const votes = blocks.reduce((s, b) => s + (b.voteCount || 0), 0);
  const transfers = blocks.reduce((s, b) => s + (b.transferCount || 0), 0);
  const other = total - votes - transfers;
  const items = [['Votes', votes, 'text-violet'], ['System transfers', transfers, 'text-brand'], ['Other programs', other, 'text-positive']];
  return (
    <div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {items.map(([label, n, tone]) => (
          <div key={label}>
            <p className={cn('text-lg font-semibold tabular', tone)}>{percent((n / total) * 100, 0)}</p>
            <p className="text-xs text-ink-muted">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-faint">Across the last {integer(blocks.length)} blocks ({integer(total)} transactions).</p>
    </div>
  );
}

/** @param {{ health?: any, stats?: any, [key: string]: any }} props */
function NetworkHealthWidget({ health, stats }) {
  const share = stats?.stake?.delinquentShare;
  return (
    <div className="space-y-3 text-center">
      {health === 'ok' ? <Pill tone="positive">RPC node reports ok</Pill> : health === 'error' ? <Pill tone="negative">RPC node reports not ok</Pill> : <Unavailable reason="The health check has not completed" />}
      <p className="text-xs text-ink-muted">
        Delinquent stake: {isNum(share) ? percent(share * 100, 1) : <Unavailable reason="Validator data is not available" />}
      </p>
    </div>
  );
}

/** @param {{ price?: any, [key: string]: any }} props */
function PriceWidget({ price }) {
  return (
    <div className="text-center">
      <p className="mb-1 text-xs text-ink-muted">XNT price (XDEX market)</p>
      <p className="text-2xl font-semibold tabular text-ink">{isNum(price) ? usd(price) : <Unavailable reason="No XNT market price is available right now" />}</p>
    </div>
  );
}

function ValidatorAlertsWidget() {
  const count = alertCount();
  return (
    <div className="text-center">
      <Link to={createPageUrl('ValidatorAlerts')} className="block rounded">
        <span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-warning/15"><Bell className="h-5 w-5 text-warning" aria-hidden="true" /></span>
        <p className="text-lg font-semibold tabular text-ink">{count === null ? <Unavailable reason="Saved alerts could not be read in this browser" /> : integer(count)}</p>
        <p className="text-xs text-ink-muted">Active alerts saved in this browser</p>
      </Link>
    </div>
  );
}

function AddressLookupWidget() {
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [error, setError] = useState(null);
  const submit = (e) => {
    e.preventDefault();
    const value = address.trim();
    if (!BASE58.test(value)) return setError('Enter a valid address: 32 to 44 base58 characters.');
    return navigate(`${createPageUrl('AddressLookup')}?address=${value}`);
  };
  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="dash-address" className="sr-only">Address to look up</label>
      <input id="dash-address" value={address} onChange={(e) => { setAddress(e.target.value); setError(null); }} maxLength={44} spellCheck={false} autoComplete="off" placeholder="Enter an address" aria-invalid={!!error} className={cn(inputClass, 'mono')} />
      {error && <p role="alert" className="mt-1.5 text-xs text-negative">{error}</p>}
      <button type="submit" className="mt-2 text-xs font-medium text-brand hover:underline">Look up address</button>
    </form>
  );
}

/** @param {{ id?: any, src?: any, [key: string]: any }} props */
function WidgetBody({ id, src }) {
  const { stats, history, blocks, health, price } = src;
  switch (id) {
    case 'network_stats': return <NetworkStatsWidget stats={stats} />;
    case 'epoch': return <EpochWidget stats={stats} />;
    case 'validators': return <ValidatorsWidget stats={stats} />;
    case 'supply': return <SupplyWidget stats={stats} />;
    case 'staking': return <StakingWidget stats={stats} />;
    case 'block_time': return <BlockTimeWidget stats={stats} />;
    case 'tps_chart': return <TpsChartWidget history={history} />;
    case 'performance': return <PerformanceWidget history={history} />;
    case 'recent_blocks': return <RecentBlocksWidget blocks={blocks} />;
    case 'tx_types': return <TxTypesWidget blocks={blocks} />;
    case 'network_health': return <NetworkHealthWidget health={health} stats={stats} />;
    case 'price_widget': return <PriceWidget price={price} />;
    case 'validator_alerts': return <ValidatorAlertsWidget />;
    case 'address_lookup': return <AddressLookupWidget />;
    default: return null;
  }
}

/** @param {{ id?: any, src?: any, editing?: any, index?: any, count?: any, onRemove?: any, onMove?: any, [key: string]: any }} props */
function Widget({ id, src, editing, index, count, onRemove, onMove }) {
  const info = WIDGET_TYPES[id];
  if (!info) return null;
  const Icon = info.icon;
  return (
    <section aria-label={info.name} className={cn('panel p-4', info.size === 'large' && 'md:col-span-2')}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink">
          <Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          <span className="truncate">{info.name}</span>
        </h2>
        {editing && (
          <div className="flex shrink-0 items-center">
            <button type="button" onClick={() => onMove(index, -1)} disabled={index === 0} aria-label={`Move ${info.name} earlier`} className={iconButton}><ArrowUp className="h-4 w-4" aria-hidden="true" /></button>
            <button type="button" onClick={() => onMove(index, 1)} disabled={index === count - 1} aria-label={`Move ${info.name} later`} className={iconButton}><ArrowDown className="h-4 w-4" aria-hidden="true" /></button>
            <button type="button" onClick={() => onRemove(id)} aria-label={`Remove ${info.name}`} className={cn(iconButton, 'hover:text-negative')}><X className="h-4 w-4" aria-hidden="true" /></button>
          </div>
        )}
      </div>
      <WidgetBody id={id} src={src} />
    </section>
  );
}

/* ------------------------------- Page -------------------------------- */

export default function CustomDashboard() {
  const init = useMemo(initialState, []);
  const [saved, setSaved] = useState(init.saved);
  const [currentLayout, setCurrentLayout] = useState(init.key);
  const [widgets, setWidgets] = useState(init.widgets);
  const [editing, setEditing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  const [layoutError, setLayoutError] = useState(null);

  const [src, setSrc] = useState({ stats: null, history: null, blocks: null, health: null, price: null });
  const [status, setStatus] = useState({ state: 'loading', loadedAt: null, stale: false });
  const [refreshing, setRefreshing] = useState(false);
  const historyAt = useRef(0);
  const mounted = useRef(true);
  const busy = useRef(false);

  const needs = useMemo(() => new Set(widgets.map((id) => WIDGET_TYPES[id]?.needs).filter(Boolean)), [widgets]);
  const needsRef = useRef(needs);
  needsRef.current = needs;
  const needsKey = [...needs].sort().join(',');

  const fetchData = useCallback(async (background = false) => {
    if (busy.current) return;
    busy.current = true;
    if (background) setRefreshing(true);
    const want = needsRef.current;
    const wantHistory = want.has('history') && Date.now() - historyAt.current > HISTORY_REFRESH_MS;
    const jobs = {
      stats: api.networkStats(),
      history: wantHistory ? api.networkHistory(2) : null,
      blocks: want.has('blocks') ? X1Rpc.getRecentBlocks(8) : null,
      health: want.has('health') ? rpcCall('getHealth').then((r) => (r === 'ok' ? 'ok' : 'error')).catch((e) => (e?.kind === 'rpc' ? 'error' : Promise.reject(e))) : null,
      price: want.has('price') ? api.tokenPrice(X1_CONFIG.nativeMint) : null,
    };
    const keys = Object.keys(jobs).filter((k) => jobs[k]);
    const settled = await Promise.allSettled(keys.map((k) => jobs[k]));
    busy.current = false;
    if (!mounted.current) return;
    const failed = [];
    setSrc((prev) => {
      const next = { ...prev };
      keys.forEach((k, i) => {
        const r = settled[i];
        if (r.status === 'rejected') {
          failed.push(k);
          return; // keep the last good value for this source
        }
        const v = r.value;
        if (k === 'stats') next.stats = v && typeof v === 'object' ? v : null;
        else if (k === 'history') next.history = Array.isArray(v?.data) ? v.data : null;
        else if (k === 'blocks') next.blocks = Array.isArray(v) ? v : null;
        else if (k === 'health') next.health = v;
        else if (k === 'price') next.price = isNum(v?.data?.priceUsd) ? v.data.priceUsd : null;
      });
      return next;
    });
    if (keys.includes('history') && !failed.includes('history')) historyAt.current = Date.now();
    setStatus((s) => {
      if (failed.includes('stats') && s.state !== 'ready') return { state: 'error', loadedAt: null, stale: false };
      return { state: 'ready', loadedAt: failed.length === keys.length ? s.loadedAt : Date.now(), stale: failed.length > 0 };
    });
    setRefreshing(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    fetchData();
    const id = setInterval(() => {
      if (!document.hidden) fetchData(true);
    }, X1_CONFIG.polling.dashboardMs);
    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [fetchData]);

  // Data for newly added widgets loads right away instead of at the next tick.
  useEffect(() => {
    if (status.state === 'ready') fetchData(true);
  }, [needsKey]);

  const loadLayout = (key) => {
    const layout = saved[key] || DEFAULT_LAYOUTS[key];
    if (!layout) return;
    setWidgets(layout.widgets);
    setCurrentLayout(key);
    store(CURRENT_KEY, key);
  };

  const saveLayout = (e) => {
    e.preventDefault();
    const name = layoutName.trim().slice(0, 40) || `Layout ${Object.keys(saved).length + 1}`;
    if (UNSAFE_KEYS.has(name) || Object.prototype.hasOwnProperty.call(DEFAULT_LAYOUTS, name.toLowerCase())) return setLayoutError('That name is reserved. Choose another.');
    if (!Object.prototype.hasOwnProperty.call(saved, name) && Object.keys(saved).length >= MAX_LAYOUTS) return setLayoutError(`You can save up to ${MAX_LAYOUTS} layouts.`);
    const next = { ...saved, [name]: { name, widgets } };
    setSaved(next);
    setCurrentLayout(name);
    store(LAYOUTS_KEY, JSON.stringify(next));
    store(CURRENT_KEY, name);
    setLayoutName('');
    return setLayoutError(null);
  };

  const deleteLayout = (key) => {
    const next = { ...saved };
    delete next[key];
    setSaved(next);
    store(LAYOUTS_KEY, JSON.stringify(next));
    if (currentLayout === key) {
      setWidgets(DEFAULT_LAYOUTS.default.widgets);
      setCurrentLayout('default');
      store(CURRENT_KEY, 'default');
    }
  };

  const addWidget = (id) => {
    setWidgets((w) => (w.includes(id) || w.length >= MAX_WIDGETS ? w : [...w, id]));
    setShowAdd(false);
  };
  const removeWidget = (id) => setWidgets((w) => w.filter((x) => x !== id));
  const moveWidget = (index, delta) => setWidgets((w) => {
    const to = index + delta;
    if (to < 0 || to >= w.length) return w;
    const copy = [...w];
    [copy[index], copy[to]] = [copy[to], copy[index]];
    return copy;
  });

  const layoutLabel = saved[currentLayout]?.name || DEFAULT_LAYOUTS[currentLayout]?.name || currentLayout;

  return (
    <>
      <PageHeader
        icon={LayoutGrid}
        title="Custom Dashboard"
        description="Arrange live network widgets. Layouts are saved only in this browser."
        badge={<Pill tone="brand">{layoutLabel}</Pill>}
        meta={status.state === 'ready' ? <Freshness at={status.loadedAt} stale={status.stale} source="X1 RPC" onRefresh={() => fetchData(true)} refreshing={refreshing} /> : null}
        actions={(
          <button type="button" onClick={() => setEditing((v) => !v)} aria-pressed={editing} className={cn(buttonClass, editing && 'border-brand/40 bg-brand/10 text-brand')}>
            <Settings className="h-4 w-4" aria-hidden="true" />
            {editing ? 'Done' : 'Edit layout'}
          </button>
        )}
      />

      {editing && (
        <Panel title="Layouts" className="mb-6">
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2">
              {Object.keys(DEFAULT_LAYOUTS).map((key) => (
                <button key={key} type="button" onClick={() => loadLayout(key)} aria-pressed={currentLayout === key} className={cn(buttonClass, 'h-8', currentLayout === key && 'border-brand/40 bg-brand/10 text-brand')}>
                  {DEFAULT_LAYOUTS[key].name}
                </button>
              ))}
              {Object.keys(saved).map((key) => (
                <span key={key} className="inline-flex items-center gap-1">
                  <button type="button" onClick={() => loadLayout(key)} aria-pressed={currentLayout === key} className={cn(buttonClass, 'h-8', currentLayout === key && 'border-brand/40 bg-brand/10 text-brand')}>{saved[key].name}</button>
                  <button type="button" onClick={() => deleteLayout(key)} aria-label={`Delete layout ${saved[key].name}`} className={cn(iconButton, 'hover:text-negative')}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
                </span>
              ))}
            </div>
            <form onSubmit={saveLayout} className="flex flex-col gap-2 sm:flex-row sm:items-center" noValidate>
              <label htmlFor="layout-name" className="sr-only">Layout name</label>
              <input id="layout-name" value={layoutName} onChange={(e) => { setLayoutName(e.target.value); setLayoutError(null); }} maxLength={40} placeholder="New layout name" className={cn(inputClass, 'sm:w-56')} />
              <button type="submit" className={primaryButton}><Save className="h-4 w-4" aria-hidden="true" />Save layout</button>
              <button type="button" onClick={() => setShowAdd((v) => !v)} aria-expanded={showAdd} className={buttonClass}><Plus className="h-4 w-4" aria-hidden="true" />Add widget</button>
            </form>
            {layoutError && <p role="alert" className="text-xs text-negative">{layoutError}</p>}
            {showAdd && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(WIDGET_TYPES).map(([id, info]) => {
                  const Icon = info.icon;
                  const added = widgets.includes(id);
                  return (
                    <button key={id} type="button" onClick={() => addWidget(id)} disabled={added} className={cn(buttonClass, 'justify-start')}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span className="truncate">{info.name}</span>
                      {added && <span className="ml-auto text-xs text-ink-faint">Added</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>
      )}

      {status.state === 'loading' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading">
          {widgets.slice(0, 6).map((id) => <div key={id} className="panel p-4"><Skeleton className="mb-4 h-4 w-32" /><Skeleton className="h-20 w-full" /></div>)}
        </div>
      ) : status.state === 'error' && widgets.some((id) => WIDGET_TYPES[id].needs === 'stats') ? (
        <Panel><ErrorState title="Could not load network data" onRetry={() => { setStatus({ state: 'loading', loadedAt: null, stale: false }); fetchData(); }} /></Panel>
      ) : widgets.length === 0 ? (
        <Panel><EmptyState icon={LayoutGrid} title="No widgets on this dashboard" description="Choose Edit layout, then Add widget." /></Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {widgets.map((id, i) => (
            <Widget key={id} id={id} src={src} editing={editing} index={i} count={widgets.length} onRemove={removeWidget} onMove={moveWidget} />
          ))}
        </div>
      )}
    </>
  );
}
