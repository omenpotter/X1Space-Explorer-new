import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Bell, Percent, Play, Pause, Plus, Search, Send, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { Freshness, Panel, Pill } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, TableSkeleton, Unavailable } from '@/components/ds/States';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ValidatorAvatar } from '@/components/ds/Avatar';
import { ValidatorName, isNum, matchesValidator, useValidators } from '@/components/validators/ValidatorCard';
import { X1_CONFIG } from '@/lib/x1/config';
import { compact, integer, percent, shortAddress } from '@/lib/format';
import { cn } from '@/lib/utils';

const ALERTS_KEY = 'x1_alerts';
const CONFIG_KEY = 'x1_alert_config';
const EVENTS_KEY = 'x1_triggered_alerts';
const MAX_ALERTS = 100;
const MAX_EVENTS = 50;

const outlineBtn = 'border-line-strong bg-transparent text-ink-soft hover:bg-surface-3 hover:text-ink';
const inputClass = 'h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/25';

// Every condition reads a real measured field. A null field never triggers.
const TYPES = {
  voteRate: { label: 'Vote rate drops below', unit: '%', icon: Activity, tone: 'warning', short: 'Vote rate', fallback: 95 },
  skipRate: { label: 'Skip rate rises above', unit: '%', icon: Activity, tone: 'warning', short: 'Skip rate', fallback: 10 },
  commission: { label: 'Commission rises above', unit: '%', icon: Percent, tone: 'negative', short: 'Commission', fallback: 10 },
  delinquent: { label: 'Becomes delinquent', unit: '', icon: AlertTriangle, tone: 'negative', short: 'Delinquent', fallback: 0 },
  stake_increase: { label: 'Stake rises between checks by', unit: 'XNT', icon: TrendingUp, tone: 'positive', short: 'Stake up', fallback: 100000 },
  stake_decrease: { label: 'Stake falls between checks by', unit: 'XNT', icon: TrendingDown, tone: 'warning', short: 'Stake down', fallback: 100000 },
};

const isStr = (s, max = 200) => typeof s === 'string' && s.length > 0 && s.length <= max;

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: settings last for this visit only.
  }
}

function loadAlerts() {
  const raw = readJson(ALERTS_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a) => a && isStr(a.id, 64) && isStr(a.votePubkey, 64) && Object.prototype.hasOwnProperty.call(TYPES, a.type) && Number.isFinite(a.threshold) && a.threshold >= 0)
    .slice(0, MAX_ALERTS)
    .map((a) => ({ id: a.id, votePubkey: a.votePubkey, name: isStr(a.name, 120) ? a.name : null, type: a.type, threshold: a.threshold, enabled: a.enabled !== false }));
}
function loadEvents() {
  const raw = readJson(EVENTS_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && isStr(e.id, 64) && isStr(e.message, 300) && isStr(e.validatorName, 120) && Number.isFinite(Date.parse(e.timestamp)))
    .slice(0, MAX_EVENTS)
    .map((e) => ({ id: e.id, validatorName: e.validatorName, message: e.message, timestamp: e.timestamp }));
}
function loadWebhook() {
  const cfg = readJson(CONFIG_KEY, {});
  return cfg && typeof cfg.webhookUrl === 'string' ? cfg.webhookUrl.slice(0, 500) : '';
}

/** Returns { url } for an acceptable webhook or { error } with a message to show the user. */
export function validateWebhook(input) {
  const text = String(input || '').trim();
  if (!text) return { url: '' };
  let u;
  try {
    u = new URL(text);
  } catch {
    return { error: 'This is not a valid URL. Enter a full address starting with https://.' };
  }
  if (u.protocol !== 'https:') return { error: 'Only https:// webhook URLs are accepted.' };
  if (u.username || u.password) return { error: 'Webhook URLs must not contain a username or password.' };
  return { url: u.toString() };
}

let idCounter = 0;
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${++idCounter}`);

function webhookBody(url, event) {
  const host = new URL(url).hostname;
  const text = `X1 Space alert: ${event.validatorName}: ${event.message}`;
  if (host === 'discord.com' || host.endsWith('.discord.com')) return { content: text };
  if (host === 'hooks.slack.com') return { text };
  return { type: 'x1_validator_alert', validatorName: event.validatorName, message: event.message, timestamp: event.timestamp, text };
}

/** Evaluates one alert. Returns a message when it should fire, otherwise null. Null inputs never fire. */
function evaluate(alert, v, prev) {
  switch (alert.type) {
    case 'voteRate':
      return isNum(v.voteRate) && v.voteRate < alert.threshold ? `Vote rate is ${percent(v.voteRate, 1)} (below ${alert.threshold}%)` : null;
    case 'skipRate':
      return isNum(v.skipRate) && v.skipRate > alert.threshold ? `Skip rate is ${percent(v.skipRate, 1)} (above ${alert.threshold}%)` : null;
    case 'commission':
      return isNum(v.commission) && v.commission > alert.threshold ? `Commission is ${v.commission}% (above ${alert.threshold}%)` : null;
    case 'delinquent':
      return v.delinquent === true && prev && prev.delinquent === false ? 'Validator became delinquent' : null;
    case 'stake_increase':
    case 'stake_decrease': {
      if (!prev || !isNum(prev.stake) || !isNum(v.activatedStake)) return null;
      const delta = alert.type === 'stake_increase' ? v.activatedStake - prev.stake : prev.stake - v.activatedStake;
      return delta >= alert.threshold && delta > 0 ? `Stake ${alert.type === 'stake_increase' ? 'increased' : 'decreased'} by ${compact(delta)} XNT since the last check` : null;
    }
    default:
      return null;
  }
}

export default function ValidatorAlerts() {
  const { status, validators, error, loadedAt, refreshFailed, refreshing, reload } = useValidators(X1_CONFIG.polling.validatorsMs);
  const [alerts, setAlerts] = useState(loadAlerts);
  const [events, setEvents] = useState(loadEvents);
  const [webhookText, setWebhookText] = useState(loadWebhook);
  const [webhook, setWebhook] = useState(() => validateWebhook(loadWebhook()).url || '');
  const [webhookError, setWebhookError] = useState(null);
  const [webhookNote, setWebhookNote] = useState(null);
  const [monitoring, setMonitoring] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);

  const snapshot = useRef(new Map()); // votePubkey -> { stake, delinquent } from the previous evaluation
  const firing = useRef(new Set()); // alert ids whose level condition is currently true (fire on transition only)
  const lastEvaluated = useRef(null);
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const webhookRef = useRef(webhook);
  webhookRef.current = webhook;

  const byId = useMemo(() => new Map(validators.map((v) => [v.votePubkey, v])), [validators]);

  const post = useCallback(async (url, event) => {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(webhookBody(url, event)) });
    if (!res.ok) throw new Error(`The webhook answered with HTTP ${res.status}`);
  }, []);

  // Evaluate whenever fresh data arrives (polling and hidden-tab skipping live in useValidators).
  useEffect(() => {
    if (!monitoring || status !== 'ready' || !loadedAt || lastEvaluated.current === loadedAt) return;
    lastEvaluated.current = loadedAt;
    const fresh = [];
    for (const alert of alertsRef.current) {
      if (!alert.enabled) { firing.current.delete(alert.id); continue; }
      const v = byId.get(alert.votePubkey);
      if (!v) continue;
      const message = evaluate(alert, v, snapshot.current.get(v.votePubkey));
      if (message) {
        if (!firing.current.has(alert.id)) {
          fresh.push({ id: newId(), validatorName: alert.name || shortAddress(alert.votePubkey), message, timestamp: new Date().toISOString() });
        }
        firing.current.add(alert.id);
      } else {
        firing.current.delete(alert.id);
      }
    }
    snapshot.current = new Map(validators.map((v) => [v.votePubkey, { stake: isNum(v.activatedStake) ? v.activatedStake : null, delinquent: typeof v.delinquent === 'boolean' ? v.delinquent : null }]));
    if (fresh.length) {
      setEvents((prev) => {
        const next = [...fresh, ...prev].slice(0, MAX_EVENTS);
        writeJson(EVENTS_KEY, next);
        return next;
      });
      if (webhookRef.current) {
        fresh.forEach((e) => post(webhookRef.current, e).catch((err) => setWebhookNote({ ok: false, text: `Webhook delivery failed: ${err.message}` })));
      }
    }
  }, [monitoring, status, loadedAt, byId, validators, post]);

  const toggleMonitoring = () => {
    if (!monitoring) {
      // Take a baseline so change-based alerts compare against what is current now.
      snapshot.current = new Map(validators.map((v) => [v.votePubkey, { stake: isNum(v.activatedStake) ? v.activatedStake : null, delinquent: typeof v.delinquent === 'boolean' ? v.delinquent : null }]));
      lastEvaluated.current = loadedAt;
      firing.current = new Set();
    }
    setMonitoring((m) => !m);
  };

  const saveWebhook = () => {
    const result = validateWebhook(webhookText);
    if (result.error) {
      setWebhookError(result.error);
      return;
    }
    setWebhookError(null);
    setWebhook(result.url);
    setWebhookText(result.url);
    writeJson(CONFIG_KEY, { webhookUrl: result.url });
    setWebhookNote({ ok: true, text: result.url ? 'Webhook saved in this browser.' : 'Webhook removed.' });
  };

  const sendTest = async () => {
    const result = validateWebhook(webhookText);
    if (result.error || !result.url) {
      setWebhookError(result.error || 'Enter a webhook URL first.');
      return;
    }
    setWebhookError(null);
    setSending(true);
    setWebhookNote(null);
    try {
      await post(result.url, { validatorName: 'Test', message: 'This is a test notification from X1 Space.', timestamp: new Date().toISOString() });
      setWebhookNote({ ok: true, text: 'Test notification delivered.' });
    } catch (err) {
      setWebhookNote({ ok: false, text: `Test failed: ${err.message}. Some webhook hosts block requests from browsers.` });
    } finally {
      setSending(false);
    }
  };

  const persist = (next) => { setAlerts(next); writeJson(ALERTS_KEY, next); };
  const addAlert = (v, type) => {
    if (alerts.length >= MAX_ALERTS) return;
    persist([...alerts, { id: newId(), votePubkey: v.votePubkey, name: v.hasIdentity ? v.name : null, type, threshold: TYPES[type].fallback, enabled: true }]);
  };
  const removeAlert = (id) => { firing.current.delete(id); persist(alerts.filter((a) => a.id !== id)); };
  const toggleAlert = (id) => persist(alerts.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  const setThreshold = (id, text) => {
    const n = Number(text);
    if (text === '' || !Number.isFinite(n) || n < 0) return;
    persist(alerts.map((a) => (a.id === id ? { ...a, threshold: n } : a)));
  };

  const results = useMemo(() => validators.filter((v) => matchesValidator(v, query)).slice(0, 20), [validators, query]);

  return (
    <>
      <PageHeader
        icon={Bell}
        title="Validator alerts"
        description="Get notified when a validator's measured vote rate, skip rate, commission, stake or delinquency crosses a threshold you set."
        meta={<Freshness at={loadedAt} stale={refreshFailed} source="X1 RPC" onRefresh={() => reload(true)} refreshing={refreshing} />}
        actions={
          <>
            <Button type="button" variant="outline" size="sm" className={cn(outlineBtn, monitoring && 'border-positive/40 text-positive')} onClick={toggleMonitoring} disabled={status !== 'ready'} aria-pressed={monitoring}>
              {monitoring ? <><Pause className="mr-2 h-4 w-4" aria-hidden="true" />Monitoring</> : <><Play className="mr-2 h-4 w-4" aria-hidden="true" />Start monitoring</>}
            </Button>
            <Button type="button" size="sm" className="bg-brand text-brand-ink hover:bg-brand/90" onClick={() => setShowAdd((s) => !s)} aria-expanded={showAdd}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />New alert
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <p className="rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-ink-soft">
          Alerts are checked in this browser tab only, about every {Math.round(X1_CONFIG.polling.validatorsMs / 1000)} seconds while the tab is visible. Nothing is checked when the tab is closed or hidden. Alerts, history and the webhook are stored in this browser and are not synced.
        </p>

        {status === 'error' && <Panel><ErrorState title="Validator data is unavailable" description={error} onRetry={() => reload()} /></Panel>}

        <Panel title="Webhook" description="Optional. Alerts are always listed below; add an https webhook (Discord, Slack or any endpoint that accepts JSON) to also push them out.">
          <div className="space-y-3 p-4">
            <div>
              <label htmlFor="webhook-url" className="eyebrow mb-1.5 block">Webhook URL</label>
              <input id="webhook-url" type="url" inputMode="url" autoComplete="off" spellCheck={false} value={webhookText} onChange={(e) => { setWebhookText(e.target.value); setWebhookError(null); }} placeholder="https://discord.com/api/webhooks/…" className={cn(inputClass, webhookError && 'border-negative/60')} aria-invalid={webhookError ? 'true' : undefined} aria-describedby={webhookError ? 'webhook-error' : 'webhook-help'} />
              {webhookError ? <p id="webhook-error" role="alert" className="mt-1.5 text-sm text-negative">{webhookError}</p> : <p id="webhook-help" className="mt-1.5 text-xs text-ink-muted">Treat this URL like a password: anyone with it can post to your channel. It is kept in this browser only.</p>}
              {webhookNote && <p role="status" className={cn('mt-1.5 text-sm', webhookNote.ok ? 'text-positive' : 'text-negative')}>{webhookNote.text}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className={outlineBtn} onClick={saveWebhook}>Save</Button>
              <Button type="button" variant="outline" size="sm" className={outlineBtn} onClick={sendTest} disabled={sending || !webhookText.trim()}>
                <Send className="mr-2 h-4 w-4" aria-hidden="true" />{sending ? 'Sending…' : 'Send test'}
              </Button>
            </div>
          </div>
        </Panel>

        {showAdd && (
          <Panel title="Create an alert" description="Search for a validator, then pick a condition. Thresholds can be edited afterwards.">
            <div className="p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, vote address or identity address" aria-label="Search validators" className={cn(inputClass, 'pl-9')} />
              </div>
              {status === 'loading' ? <TableSkeleton rows={3} columns={2} /> : results.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-muted">No validators match.</p>
              ) : (
                <ul className="mt-3 max-h-[420px] space-y-2 overflow-y-auto" aria-label="Validators">
                  {results.map((v) => (
                    <li key={v.votePubkey} className="rounded-lg border border-line bg-surface-2 p-3">
                      <div className="flex items-center gap-3">
                        <ValidatorAvatar validator={v} size={28} />
                        <div className="min-w-0 flex-1">
                          <ValidatorName validator={v} className="block truncate text-sm font-medium text-ink" />
                          <p className="text-xs text-ink-muted tabular">{compact(v.activatedStake)} XNT · vote rate {isNum(v.voteRate) ? percent(v.voteRate, 1) : 'unavailable'}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(TYPES).map(([type, t]) => (
                          <Button key={type} type="button" size="sm" variant="outline" className={cn(outlineBtn, 'h-7 text-xs')} onClick={() => addAlert(v, type)} aria-label={`Add alert for ${v.name || v.votePubkey}: ${t.label}`}>
                            <t.icon className="mr-1 h-3 w-3" aria-hidden="true" />{t.short}
                          </Button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        )}

        {events.length > 0 && (
          <Panel title="Recent alert events" actions={<Button type="button" variant="ghost" size="sm" className="text-ink-muted hover:text-ink" onClick={() => { setEvents([]); writeJson(EVENTS_KEY, []); }}>Clear</Button>}>
            <ul className="divide-y divide-line/60">
              {events.slice(0, 10).map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm">
                  <time dateTime={e.timestamp} className="text-xs tabular text-ink-muted">{new Date(e.timestamp).toLocaleTimeString()}</time>
                  <span className="font-medium text-ink">{e.validatorName}</span>
                  <span className="text-ink-soft">{e.message}</span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel title={`Your alerts (${alerts.length})`}>
          {alerts.length === 0 ? (
            <EmptyState icon={Bell} title="No alerts yet" description="Create an alert to watch a validator. Conditions use measured values only." />
          ) : (
            <ul className="divide-y divide-line/60">
              {alerts.map((a) => {
                const t = TYPES[a.type];
                const v = byId.get(a.votePubkey);
                return (
                  <li key={a.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-3', !a.enabled && 'opacity-60')}>
                    {v ? <ValidatorAvatar validator={v} size={28} /> : null}
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate text-sm font-medium text-ink">{v ? <ValidatorName validator={v} /> : (a.name || <span className="mono">{shortAddress(a.votePubkey, 6, 4)}</span>)}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                        <Pill tone={t.tone} icon={t.icon}>{t.short}</Pill>
                        <span>{t.label}</span>
                        {a.type !== 'delinquent' && (
                          <>
                            <input type="number" min="0" step="any" defaultValue={a.threshold} key={`${a.id}-${a.threshold}`} onBlur={(e) => setThreshold(a.id, e.target.value)} aria-label={`Threshold for ${t.label}`} className="h-7 w-24 rounded-md border border-line bg-surface-2 px-2 text-sm tabular text-ink focus:outline-none focus:ring-2 focus:ring-brand/25" />
                            <span>{t.unit}</span>
                          </>
                        )}
                        {status === 'ready' && !v && <span className="text-warning">Not found in the current validator list</span>}
                      </div>
                    </div>
                    {v && (
                      <span className="text-xs text-ink-muted tabular">
                        Now: {a.type === 'voteRate' ? (isNum(v.voteRate) ? percent(v.voteRate, 1) : <Unavailable />) : a.type === 'skipRate' ? (isNum(v.skipRate) ? percent(v.skipRate, 1) : <Unavailable reason="No leader slots yet this epoch" />) : a.type === 'commission' ? (isNum(v.commission) ? `${v.commission}%` : <Unavailable />) : a.type === 'delinquent' ? (v.delinquent ? 'Delinquent' : 'Active') : `${integer(v.activatedStake)} XNT`}
                      </span>
                    )}
                    <Switch checked={a.enabled} onCheckedChange={() => toggleAlert(a.id)} aria-label={`${a.enabled ? 'Disable' : 'Enable'} alert`} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeAlert(a.id)} className="text-ink-faint hover:text-negative" aria-label="Delete alert">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
