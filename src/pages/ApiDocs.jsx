import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Code, Loader2, Play } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { CopyButton, Panel, Pill } from '@/components/ds/Primitives';
import { rpcCall } from '@/lib/x1/rpcClient';
import { X1_CONFIG } from '@/lib/x1/config';
import { cn } from '@/lib/utils';

const RPC_URL = X1_CONFIG.rpcEndpoints[0];
const MAX_PARAMS_BYTES = 2048;
const MAX_OUTPUT_CHARS = 8000;

const inputClass = 'w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-faint focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/25';
const primaryButton = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50';

// Read-only methods the console will send. Anything else is refused before a request is made.
const RPC_METHODS = [
  { method: 'getSlot', params: '[]', description: 'Current slot.' },
  { method: 'getEpochInfo', params: '[]', description: 'Current epoch, slot index and slots in the epoch.' },
  { method: 'getBlockHeight', params: '[]', description: 'Current block height.' },
  { method: 'getHealth', params: '[]', description: 'Node health: "ok" when the node is caught up.' },
  { method: 'getVersion', params: '[]', description: 'Node software version.' },
  { method: 'getSupply', params: '[]', description: 'Total and circulating supply, in lamports.' },
  { method: 'getVoteAccounts', params: '[]', description: 'Current and delinquent vote accounts with activated stake.' },
  { method: 'getClusterNodes', params: '[]', description: 'Nodes visible in gossip. The response can be large.' },
  { method: 'getRecentPerformanceSamples', params: '[5]', description: 'Recent per-minute transaction and slot counts.' },
  { method: 'getBalance', params: '["<address>"]', description: 'Lamport balance of an account.' },
  { method: 'getAccountInfo', params: '["<address>", {"encoding": "jsonParsed"}]', description: 'Account data and owner.' },
  { method: 'getTransaction', params: '["<signature>", {"maxSupportedTransactionVersion": 0}]', description: 'A confirmed transaction by signature.' },
  { method: 'getBlock', params: '[<slot>, {"transactionDetails": "signatures", "maxSupportedTransactionVersion": 0}]', description: 'A confirmed block by slot.' },
  { method: 'getSignaturesForAddress', params: '["<address>", {"limit": 5}]', description: 'Recent signatures for an address.' },
  { method: 'getTokenSupply', params: '["<mint>"]', description: 'Supply of an SPL token mint.' },
  { method: 'getTokenLargestAccounts', params: '["<mint>"]', description: 'The largest holders of an SPL token mint.' },
];
const ALLOWED = new Set(RPC_METHODS.map((m) => m.method));

const COMMON_NOTES = [
  'Every endpoint is read-only and answers GET (query string) or POST (JSON body of at most 4,000 bytes). Unknown parameters are ignored.',
  'Each endpoint is rate limited per client IP address per minute. Over the limit you receive HTTP 429 with error code rate_limited and a Retry-After header. Requests whose IP cannot be determined share a larger, common allowance.',
  'Successful GET responses are cacheable for the number of seconds listed per endpoint (Cache-Control: public, max-age). POST responses and errors are never cached (no-store). The server also caches upstream data for short periods.',
  'A value the data sources cannot supply is null, never 0. Treat null as unknown.',
  'Errors use the shape { success: false, error: { status, code, message } }. An unreachable data source returns 502 upstream_unavailable.',
  'CORS: browsers on x1space.xyz, www.x1space.xyz, *.base44.app and localhost can read responses. Other origins receive no Access-Control-Allow-Origin header, so browser scripts on other sites cannot read them. Server-side callers are limited by the rate limits instead.',
];

const TOKEN_LIST_PARAMS = [
  ['sort', 'liquidity (default), volume, marketCap, price, change, holders, supply, name'],
  ['dir', 'desc (default) or asc'],
  ['program', 'all (default), spl-token or token-2022'],
  ['listed', '"true" limits results to tokens with a DEX market'],
];

const ENDPOINTS = [
  {
    name: 'getTokens',
    summary: 'Token list with market data, filtered, sorted and paged.',
    rate: 60,
    cache: 15,
    params: [
      ['q', 'Optional text filter on name, symbol or mint, up to 64 characters (also accepted as name or symbol)'],
      ['kind', 'fungible (default), nft, lp or all'],
      ...TOKEN_LIST_PARAMS,
      ['limit', 'Integer 1 to 200, default 50'],
      ['offset', 'Integer 0 to 1,000,000, default 0'],
    ],
    returns: 'tokens (mint, program, kind, decimals, supply, name, symbol, logoUrl, listed, priceUsd, priceChange24h, liquidityUsd, volume24hUsd, marketCapUsd, holders), total, limit, offset, indexed, summary, sources, fetchedAt. Market fields are null for tokens without a DEX market.',
  },
  {
    name: 'searchTokens',
    summary: 'Search tokens of every kind by name, symbol or mint.',
    rate: 60,
    cache: 15,
    params: [
      ['q', 'Required, 2 to 64 characters. Shorter queries return 400 query_too_short'],
      ['limit', 'Integer 1 to 50, default 20'],
      ...TOKEN_LIST_PARAMS,
    ],
    returns: 'results and tokens (same rows as getTokens), count, total, query, sources, fetchedAt. Searches every kind and always starts at offset 0.',
  },
  {
    name: 'getTokenByMint',
    summary: 'One token in detail.',
    rate: 60,
    cache: 15,
    params: [['mint', 'Required token mint address. 400 invalid_mint if it is not an address']],
    returns: 'token and stale (true when the last refresh failed and a recent copy is served). 404 not_found when no token mint exists at that address.',
  },
  {
    name: 'getTokenPrices',
    summary: 'Current price and market figures for one token.',
    rate: 120,
    cache: 10,
    params: [
      ['mint', 'Required token mint address'],
      ['history', '"true" adds price candles'],
      ['tf', 'Candle timeframe with history: 1m, 5m, 15m, 1h (default), 4h or 1D'],
      ['limit', 'Candles with history: integer 1 to 300, default 100'],
    ],
    returns: 'data with mint, priceUsd, priceSource, priceUpdatedAt, priceChange24h, volume24hUsd, liquidityUsd, marketCapUsd, fetchedAt (each null when unknown). With history, data.history has a status (ok, stale, not_configured, no_pool or error) and candles (null unless ok or stale). 404 when there is neither a price nor a token row.',
  },
  {
    name: 'getLiquidityPools',
    summary: 'DEX pools that contain a token.',
    rate: 60,
    cache: 15,
    params: [['token', 'Required token mint address']],
    returns: 'token, pools (address, lpMint, pair, token1, token2, tvlUsd, txns24h, apr24h, lpHolders, createdAt, source), count, source, fetchedAt.',
  },
  {
    name: 'getLPTokens',
    summary: 'All listed DEX pools, largest TVL first.',
    rate: 60,
    cache: 15,
    params: [
      ['limit', 'Integer 1 to 500, default 500'],
      ['offset', 'Integer 0 to 100,000, default 0'],
    ],
    returns: 'pools (same fields as getLiquidityPools), count (all pools), stale, source, fetchedAt. Pools without a TVL sort last.',
  },
  {
    name: 'getLPStats',
    summary: 'Aggregate statistics across listed pools.',
    rate: 60,
    cache: 15,
    params: [],
    returns: 'stats (pool totals from the DEX plus listedPools), stale, source, fetchedAt.',
  },
  {
    name: 'getLPPoolDetail',
    summary: 'One pool, with optional analytics and recent trades.',
    rate: 60,
    cache: 15,
    params: [
      ['pool', 'Required pool address. 400 invalid_pool if it is not an address'],
      ['trades', '"true" adds recent trades'],
      ['type', 'Trade filter with trades: all (default), buys, sells or lp'],
      ['tradeLimit', 'Trades to return: integer 1 to 200, default 50'],
    ],
    returns: 'pool, fetchedAt, analytics when available (mint, priceChange m5/h1/h6/h24, marketCapUsd, fdvUsd; null fields when unknown), and with trades a trades object with status (ok, stale, not_configured or error) and items (null unless ok or stale). 404 not_found when the pool is not listed.',
  },
  {
    name: 'getNetworkStats',
    summary: 'Live network figures from the X1 RPC.',
    rate: 120,
    cache: 5,
    params: [],
    returns: 'slot, blockHeight, epoch, slotIndex, slotsInEpoch, epochProgress (0 to 1), transactionCount, tps, userTps, slotTimeSeconds, validators (active, delinquent), stake (activeXnt, delinquentXnt, delinquentShare), supply (totalXnt, circulatingXnt), source, fetchedAt, stale. Averages cover the last 5 performance samples. Parts that could not be read are null.',
  },
  {
    name: 'getNetworkHistory',
    summary: 'Per-minute TPS history from RPC performance samples.',
    rate: 30,
    cache: 60,
    params: [['hours', 'Integer 1 to 12, default 12. The RPC keeps roughly 12 hours of samples']],
    returns: 'data (time, slot, tps, userTps, slotTimeSeconds; oldest first), requestedHours, coveredHours, note, source, fetchedAt, stale. Timestamps are derived from the sample period.',
  },
  {
    name: 'detectAnomalies',
    summary: 'Threshold checks on live network values.',
    rate: 30,
    cache: 30,
    params: [],
    returns: 'action (ok or alert), severity (null when none), message, issues (severity, metric, message), checked, method, fetchedAt. It checks delinquent stake share, slot time and TPS against fixed thresholds; there is no historical baseline.',
  },
  {
    name: 'getValidators',
    summary: 'Validator directory with identity and stake data.',
    rate: 30,
    cache: 120,
    params: [],
    returns: 'The validator directory (see the Validators page for the fields it uses). Identity details are null when a validator has not published them.',
  },
  {
    name: 'analyzeToken',
    summary: 'Analysis derived from a token\'s detail data.',
    rate: 20,
    cache: 30,
    params: [['mint', 'Required token mint address']],
    returns: 'mint, analysis, fetchedAt. 404 not_found when no token mint exists at that address.',
  },
];

function validateParams(text) {
  if (new TextEncoder().encode(text).length > MAX_PARAMS_BYTES) return { error: `Parameters must be under ${MAX_PARAMS_BYTES} bytes.` };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: 'Parameters must be valid JSON.' };
  }
  if (!Array.isArray(parsed)) return { error: 'Parameters must be a JSON array, for example [] or ["<address>"].' };
  return { params: parsed };
}

/** @param {{ children?: any, className?: any, [key: string]: any }} props */
function Mono({ children, className }) {
  return <pre className={cn('mono overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-3 text-xs text-ink-soft', className)}>{children}</pre>;
}

function RpcConsole() {
  const [method, setMethod] = useState('getEpochInfo');
  const [paramsText, setParamsText] = useState('[]');
  const [state, setState] = useState({ status: 'idle', text: '', note: null, error: null });

  const choose = (m) => {
    setMethod(m);
    setParamsText(RPC_METHODS.find((x) => x.method === m)?.params ?? '[]');
    setState({ status: 'idle', text: '', note: null, error: null });
  };

  const run = async (e) => {
    e.preventDefault();
    if (!ALLOWED.has(method)) return setState({ status: 'error', text: '', note: null, error: 'This method is not allowed in the console.' });
    const checked = validateParams(paramsText);
    if (checked.error) return setState({ status: 'error', text: '', note: null, error: checked.error });
    setState({ status: 'loading', text: '', note: null, error: null });
    try {
      const result = await rpcCall(method, checked.params);
      const full = JSON.stringify(result ?? null, null, 2) ?? 'null';
      const truncated = full.length > MAX_OUTPUT_CHARS;
      return setState({ status: 'done', text: truncated ? full.slice(0, MAX_OUTPUT_CHARS) : full, note: truncated ? `Output truncated to ${MAX_OUTPUT_CHARS.toLocaleString('en-US')} of ${full.length.toLocaleString('en-US')} characters.` : null, error: null });
    } catch (err) {
      return setState({ status: 'error', text: '', note: null, error: err?.message || 'The request failed.' });
    }
  };

  const spec = RPC_METHODS.find((m) => m.method === method);
  return (
    <Panel title="Try an RPC method" description="Sends a read-only request to the X1 RPC from your browser. Replace placeholders such as <address> before running.">
      <form onSubmit={run} className="space-y-4 p-4" noValidate>
        <div>
          <label htmlFor="rpc-method" className="mb-1.5 block text-xs font-medium text-ink-muted">Method (read-only allowlist)</label>
          <select id="rpc-method" value={method} onChange={(e) => choose(e.target.value)} className={cn(inputClass, 'h-9 sm:max-w-sm')}>
            {RPC_METHODS.map((m) => <option key={m.method} value={m.method}>{m.method}</option>)}
          </select>
          {spec && <p className="mt-1.5 text-xs text-ink-muted">{spec.description}</p>}
        </div>
        <div>
          <label htmlFor="rpc-params" className="mb-1.5 block text-xs font-medium text-ink-muted">Params (JSON array, under {MAX_PARAMS_BYTES.toLocaleString('en-US')} bytes)</label>
          <textarea
            id="rpc-params"
            value={paramsText}
            onChange={(e) => setParamsText(e.target.value)}
            rows={3}
            spellCheck={false}
            aria-invalid={state.status === 'error'}
            aria-describedby={state.status === 'error' ? 'rpc-error' : undefined}
            className={cn(inputClass, 'mono py-2 text-xs')}
          />
        </div>
        <button type="submit" disabled={state.status === 'loading'} className={primaryButton}>
          {state.status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          Run request
        </button>
        {state.error && <p id="rpc-error" role="alert" className="text-sm text-negative">{state.error}</p>}
        {state.status === 'done' && (
          <div role="status">
            <p className="eyebrow mb-2">Response</p>
            <Mono className="max-h-[360px] overflow-y-auto">{state.text}</Mono>
            {state.note && <p className="mt-2 text-xs text-warning">{state.note}</p>}
          </div>
        )}
      </form>
    </Panel>
  );
}

/** @param {{ e?: any, [key: string]: any }} props */
function EndpointCard({ e }) {
  return (
    <article className="panel p-4" aria-labelledby={`ep-${e.name}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`ep-${e.name}`} className="mono text-sm font-medium text-brand">{e.name}</h3>
        <span className="flex flex-wrap gap-2">
          <Pill>GET / POST</Pill>
          <Pill>{e.rate} requests/min per IP</Pill>
          <Pill>{e.cache}s cache</Pill>
        </span>
      </div>
      <p className="mt-2 text-sm text-ink-soft">{e.summary}</p>
      <p className="mono mt-2 break-all text-xs text-ink-muted">/functions/{e.name}</p>
      <div className="mt-3">
        <p className="eyebrow mb-1.5">Parameters</p>
        {e.params.length === 0 ? (
          <p className="text-sm text-ink-muted">None.</p>
        ) : (
          <dl className="space-y-1.5 text-sm">
            {e.params.map(([k, v]) => (
              <div key={k} className="grid gap-x-3 sm:grid-cols-[120px_1fr]">
                <dt className="mono text-xs text-ink">{k}</dt>
                <dd className="text-ink-muted">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="mt-3">
        <p className="eyebrow mb-1.5">Returns</p>
        <p className="text-sm text-ink-muted">{e.returns}</p>
      </div>
    </article>
  );
}

export default function ApiDocs() {
  const curl = `curl -X POST ${RPC_URL} \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"getEpochInfo","params":[]}'`;
  return (
    <>
      <PageHeader
        icon={Code}
        title="API Documentation"
        description="The public X1 JSON-RPC endpoint, a read-only console to try it, and the read-only data endpoints this site exposes."
      />

      <div className="space-y-8">
        <section aria-labelledby="rpc-heading" className="space-y-4">
          <h2 id="rpc-heading" className="font-display text-lg font-semibold text-ink">X1 JSON-RPC</h2>
          <Panel title="RPC endpoint" description="Public X1 mainnet RPC. All requests are POST with a JSON-RPC 2.0 body. It is a shared public node and can rate limit heavy use; for production, run your own node or a dedicated provider.">
            <div className="space-y-4 p-4">
              <div className="flex items-center gap-2">
                <code className="mono flex-1 overflow-x-auto rounded-lg bg-surface-2 px-3 py-2 text-sm text-brand">{RPC_URL}</code>
                <CopyButton value={RPC_URL} label="Copy RPC URL" />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="eyebrow">Example</p>
                  <CopyButton value={curl} label="Copy curl example" />
                </div>
                <Mono>{curl}</Mono>
              </div>
            </div>
          </Panel>
          <p className="max-w-3xl text-sm text-ink-muted">
            To verify explorer data directly, use <code>getTransaction</code> with a transaction signature, <code>getBlock</code> with its slot,
            <code> getVoteAccounts</code> for validator vote accounts, or <code>getAccountInfo</code> with a token mint address. The{' '}
            <Link to="/Learn" className="text-brand underline">Explorer Guide</Link> explains how to interpret those records.
          </p>
          <RpcConsole />
        </section>

        <section aria-labelledby="site-heading" className="space-y-4">
          <div>
            <h2 id="site-heading" className="font-display text-lg font-semibold text-ink">X1 Space Explorer data endpoints</h2>
            <p className="mt-1 max-w-3xl text-sm text-ink-muted">Functions served by this site at /functions/&lt;name&gt;. They combine X1 RPC data with DEX market data and answer in JSON.</p>
          </div>
          <Panel title="Behaviour shared by every endpoint">
            <ul className="list-disc space-y-2 p-4 pl-8 text-sm text-ink-muted">
              {COMMON_NOTES.map((n) => <li key={n}>{n}</li>)}
            </ul>
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            {ENDPOINTS.map((e) => <EndpointCard key={e.name} e={e} />)}
          </div>
        </section>
      </div>
    </>
  );
}
