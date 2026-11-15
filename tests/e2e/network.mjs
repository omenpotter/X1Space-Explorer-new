// Records every request the browser makes while visiting key pages and asserts that no
// credentials leave the browser and that only expected hosts are contacted.
// Same setup as run.mjs (preview server on 4173, functions server on 8787).
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const APP = 'http://127.0.0.1:4173';
const FUNCTIONS = 'http://127.0.0.1:8787';

const PAGES = ['Dashboard', 'TokenExplorer', 'NetworkMap', 'Validators', 'LPExplorer', 'Blocks', 'Transactions', 'PortfolioTracker', 'ApiDocs'];
const ALLOWED_HOSTS = new Set(['127.0.0.1', 'rpc.mainnet.x1.xyz', 'rpc.x1galaxy.io']);
const SECRET_PATTERNS = [/fbx_[0-9a-f]{16,}/i, /api-?key=/i, /x1_[A-Za-z0-9]{20,}/, /Bearer\s+[A-Za-z0-9._-]{16,}/];

const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {});
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const seen = [];
const problems = [];

await ctx.route(/\/functions\//, async (route) => {
  const u = new URL(route.request().url());
  try {
    const r = await fetch(FUNCTIONS + u.pathname + u.search, { headers: { origin: APP } });
    await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers.entries()), body: Buffer.from(await r.arrayBuffer()) });
  } catch {
    await route.abort();
  }
});
ctx.on('request', (req) => {
  const url = new URL(req.url());
  const headers = req.headers();
  seen.push({ host: url.hostname, path: url.pathname, method: req.method() });
  if (!ALLOWED_HOSTS.has(url.hostname)) problems.push(`unexpected host ${url.hostname}${url.pathname}`);
  const blob = req.url() + ' ' + JSON.stringify(headers) + ' ' + (req.postData() || '');
  for (const p of SECRET_PATTERNS) if (p.test(blob)) problems.push(`credential-like value in request to ${url.hostname}${url.pathname} (${p})`);
  if (headers.authorization && url.hostname !== '127.0.0.1') problems.push(`Authorization header sent to ${url.hostname}`);
  if (headers['x-api-key']) problems.push(`X-API-Key header sent to ${url.hostname}`);
});

for (const name of PAGES) {
  const page = await ctx.newPage();
  await page.goto(`${APP}/${name}`);
  await page.waitForSelector('h1', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(5000);
  await page.close();
}

// Responses served to the browser must not contain credential material either.
const probe = await Promise.all(['getTokens?limit=2', 'getValidators', 'getLPStats', 'getNetworkStats'].map(async (p) => (await fetch(`${FUNCTIONS}/functions/${p}`)).text()));
for (const t of probe) for (const p of SECRET_PATTERNS) if (p.test(t)) problems.push(`credential-like value in a backend response (${p})`);

const hosts = {};
for (const r of seen) hosts[r.host] = (hosts[r.host] || 0) + 1;
console.log('requests by host:', JSON.stringify(hosts));
console.log('total requests:', seen.length);
const result = { ranAt: new Date().toISOString(), pages: PAGES, requestsByHost: hosts, total: seen.length, problems };
fs.writeFileSync('docs/upgrade/network-audit.json', JSON.stringify(result, null, 2));
console.log(problems.length ? 'FAIL\n' + problems.join('\n') : 'PASS: no credentials in requests or responses; only expected hosts contacted');
await b.close();
process.exit(problems.length ? 1 : 0);
