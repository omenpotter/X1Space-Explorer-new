// Performance and cost measurements: transfer size, load timing, request counts per minute (visible and
// hidden tab), and JS heap. Writes docs/upgrade/perf-results.json.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const APP = 'http://127.0.0.1:4173';
const FUNCTIONS = 'http://127.0.0.1:8787';
const WINDOW_MS = Number(process.env.PERF_WINDOW_MS || 60000);
const PAGES = ['Dashboard', 'NetworkHealth', 'TokenExplorer', 'NetworkMap', 'Validators', 'Blocks', 'LPExplorer'];
const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {});
const out = { ranAt: new Date().toISOString(), windowMs: WINDOW_MS, pages: {} };

async function measure(name, hidden) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/^https?:\/\/[^/]+\/(api\/apps\/[^/]+\/)?functions\//, async (route) => {
    const req = route.request(); const u = new URL(req.url());
    const fn = u.pathname.replace(/^\/(api\/apps\/[^/]+\/)?functions\//, '');
    const hasBody = req.method() !== 'GET' && req.method() !== 'HEAD';
    try {
      const r = await fetch(`${FUNCTIONS}/functions/${fn}${u.search}`, { method: req.method(), headers: { origin: APP, ...(hasBody ? { 'content-type': 'application/json' } : {}) }, body: hasBody ? req.postData() || undefined : undefined });
      await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers.entries()), body: Buffer.from(await r.arrayBuffer()) });
    } catch { await route.abort(); }
  });
  const page = await ctx.newPage();
  let bytes = 0; let loadBytes = null; let rpc = 0; let fnCalls = 0; let imgs = 0; let counting = false;
  const rpcMethods = {};
  page.on('response', async (r) => {
    const u = new URL(r.url());
    const len = Number(r.headers()['content-length'] || 0) || (await r.body().then((x) => x.length).catch(() => 0));
    bytes += len;
    if (!counting) return;
    if (r.request().method() === 'POST' && /rpc\./.test(u.hostname)) { rpc++; try { const m = JSON.parse(r.request().postData() || '{}').method; rpcMethods[m] = (rpcMethods[m] || 0) + 1; } catch { /* ignore */ } }
    else if (/\/functions\//.test(u.pathname)) { if (/getImage/.test(u.pathname)) imgs++; else fnCalls++; }
  });
  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  const t0 = Date.now();
  await page.goto(`${APP}/${name}`, { waitUntil: 'load' });
  await page.waitForSelector('h1', { timeout: 30000 });
  const ready = Date.now() - t0;
  await page.waitForTimeout(4000);
  loadBytes = bytes;
  const client = await ctx.newCDPSession(page);
  await client.send('Performance.enable');
  if (hidden) await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  counting = true;
  await page.waitForTimeout(WINDOW_MS);
  counting = false;
  const m = Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  const lcp = await page.evaluate(() => Math.round(window.__lcp));
  await ctx.close();
  return { readyMs: ready, lcpMs: lcp, transferKBAtLoad: Math.round(loadBytes / 1024), rpcPerMin: Math.round((rpc * 60000) / WINDOW_MS), functionCallsPerMin: Math.round((fnCalls * 60000) / WINDOW_MS), imageCallsDuringWindow: imgs, jsHeapMB: Math.round(m.JSHeapUsedSize / 1048576), domNodes: m.Nodes, rpcMethods };
}
for (const name of PAGES) {
  out.pages[name] = { visible: await measure(name, false) };
  console.log(name, 'visible', JSON.stringify({ ...out.pages[name].visible, rpcMethods: undefined }));
}
for (const name of ['Dashboard', 'NetworkHealth']) {
  out.pages[name].hidden = await measure(name, true);
  console.log(name, 'hidden ', JSON.stringify({ ...out.pages[name].hidden, rpcMethods: undefined }));
}
fs.writeFileSync('docs/upgrade/perf-results.json', JSON.stringify(out, null, 2));
await b.close();
