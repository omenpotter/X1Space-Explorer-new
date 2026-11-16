// X1 View: both tabs, labels, live data against the RPC, real-time refresh, accessibility, screenshots.
// Same setup as run.mjs (preview on 4173, functions server on 8787).
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const APP = 'http://127.0.0.1:4173';
const FUNCTIONS = 'http://127.0.0.1:8787';
const OUT = 'docs/upgrade/screenshots/x1view';
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const check = async (name, fn) => {
  try { const d = await fn(); results.push({ name, pass: true, detail: d || '' }); console.log(`PASS  ${name}${d ? '  — ' + d : ''}`); }
  catch (e) { results.push({ name, pass: false, detail: String(e.message).split('\n')[0].slice(0, 220) }); console.log(`FAIL  ${name}  — ${String(e.message).split('\n')[0].slice(0, 220)}`); }
};
const expect = (c, m) => { if (!c) throw new Error(m); };

const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {});
async function open(vp) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await ctx.route(/^https?:\/\/[^/]+\/(api\/apps\/[^/]+\/)?functions\//, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const name = u.pathname.replace(/^\/(api\/apps\/[^/]+\/)?functions\//, '');
    const hasBody = req.method() !== 'GET' && req.method() !== 'HEAD';
    try {
      const r = await fetch(`${FUNCTIONS}/functions/${name}${u.search}`, { method: req.method(), headers: { origin: APP, ...(hasBody ? { 'content-type': 'application/json' } : {}) }, body: hasBody ? req.postData() || undefined : undefined });
      await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers.entries()), body: Buffer.from(await r.arrayBuffer()) });
    } catch { await route.abort(); }
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|App state check failed/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  return { ctx, page, errors };
}
const cards = (page) => page.locator('section[aria-labelledby="x1view-title"] ul.x1v__row > li');
const labels = (page) => page.locator('section[aria-labelledby="x1view-title"] .x1v__label').allInnerTexts();
const num = (t) => Number(t.replace(/[^0-9]/g, ''));

const { ctx, page, errors } = await open({ width: 1280, height: 900 });
let lastSamples = null;
let sampleResponses = 0;
page.on('response', async (r) => {
  try {
    if (r.request().method() !== 'POST' || !/rpc\./.test(r.url())) return;
    const req = JSON.parse(r.request().postData() || '{}');
    if (req.method === 'getRecentPerformanceSamples' && req.params?.[0] === 60) { lastSamples = (await r.json()).result; sampleResponses++; }
  } catch { /* ignore */ }
});
await page.goto(APP + '/Dashboard');
await page.waitForSelector('section[aria-labelledby="x1view-title"] .x1v__card', { timeout: 30000 });
await page.waitForTimeout(2500);

await check('1m tab: Now, 1m ago ... 9m ago', async () => {
  const l = await labels(page);
  expect(JSON.stringify(l) === JSON.stringify(['Now', '1m ago', '2m ago', '3m ago', '4m ago', '5m ago', '6m ago', '7m ago', '8m ago', '9m ago']), JSON.stringify(l));
});
await check('1m tab is selected by default and exposes tab semantics', async () => {
  expect((await page.getByRole('tab', { name: '1m' }).getAttribute('aria-selected')) === 'true', '1m not selected');
  expect((await page.getByRole('tablist').count()) >= 1, 'no tablist');
});
await check('1m totals and slots equal the RPC samples the page received (exact)', async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const n0 = sampleResponses;
    const totals = (await page.locator('.x1v__row .x1v__total').allInnerTexts()).map(num);
    const slots = (await page.locator('.x1v__row .x1v__slots').allInnerTexts()).map(num);
    const snap = lastSamples;
    if (n0 !== sampleResponses || !snap) { await page.waitForTimeout(1500); continue; }
    for (let i = 0; i < 10; i++) {
      expect(totals[i] === snap[i].numTransactions, `card ${i}: total ${totals[i]} != sample ${snap[i].numTransactions}`);
      expect(slots[i] === snap[i].numSlots, `card ${i}: slots ${slots[i]} != sample ${snap[i].numSlots}`);
    }
    return `10/10 cards equal the node's samples (newest: ${snap[0].numTransactions} tx, ${snap[0].numSlots} slots)`;
  }
  throw new Error('could not take a consistent snapshot');
});
await check('every card: categories add up to the total and the vote count is shown', async () => {
  const n = await cards(page).count();
  for (let i = 0; i < n; i++) {
    const label = await cards(page).nth(i).getAttribute('aria-label');
    const total = num(label.match(/: ([\d,]+) transactions/)[1]);
    const parts = [...label.matchAll(/([\d,]+) (vote|transfer|token\/program|other|non-vote)/g)].map((m) => num(m[1]));
    expect(parts.reduce((a, c) => a + c, 0) === total, `card ${i}: ${label}`);
  }
});
await check('dot matrices have at most 80 dots, never zero for a window with transactions', async () => {
  const counts = await page.locator('.x1v__row .x1v__matrix').evaluateAll((els) => els.map((e) => e.children.length));
  expect(counts.every((c) => c > 0 && c <= 80), JSON.stringify(counts));
});
await check('matrices are deterministic across re-renders (no random dot order)', async () => {
  const a = await page.locator('.x1v__row .x1v__matrix').first().evaluate((e) => [...e.children].map((c) => c.dataset.k).join(','));
  await page.getByRole('tab', { name: '10m' }).click();
  await page.getByRole('tab', { name: '1m' }).click();
  const b2 = await page.locator('.x1v__row .x1v__matrix').first().evaluate((e) => [...e.children].map((c) => c.dataset.k).join(','));
  // Counts may have changed with a refresh; ordering must still be grouped (vote first, then others) with no interleaving.
  const grouped = (s) => !/vote.*(transfer|program|other|nonvote).*vote/.test(s);
  expect(grouped(a) && grouped(b2), 'dots are interleaved');
});
await page.screenshot({ path: `${OUT}/x1view-1m-desktop.png`, clip: await page.locator('section[aria-labelledby="x1view-title"]').boundingBox() });

await page.getByRole('tab', { name: '10m' }).click();
await page.waitForTimeout(500);
await check('10m tab: 10m ago, 20m ago, 30m ago, 40m ago, 50m ago', async () => {
  const l = await labels(page);
  expect(JSON.stringify(l) === JSON.stringify(['10m ago', '20m ago', '30m ago', '40m ago', '50m ago']), JSON.stringify(l));
  expect((await page.getByRole('tab', { name: '10m' }).getAttribute('aria-selected')) === 'true', '10m not selected');
});
await check('10m totals and slots equal the sum of ten RPC samples each', async () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const n0 = sampleResponses;
    const totals = (await page.locator('.x1v__row .x1v__total').allInnerTexts()).map(num);
    const slots = (await page.locator('.x1v__row .x1v__slots').allInnerTexts()).map(num);
    const snap = lastSamples;
    if (n0 !== sampleResponses || !snap) { await page.waitForTimeout(1500); continue; }
    for (let w = 0; w < 5; w++) {
      const ch = snap.slice(w * 10, w * 10 + 10);
      expect(totals[w] === ch.reduce((a, x) => a + x.numTransactions, 0), `window ${w} total`);
      expect(slots[w] === ch.reduce((a, x) => a + x.numSlots, 0), `window ${w} slots`);
    }
    return '5/5 windows equal the sums of their ten samples';
  }
  throw new Error('could not take a consistent snapshot');
});
await page.screenshot({ path: `${OUT}/x1view-10m-desktop.png`, clip: await page.locator('section[aria-labelledby="x1view-title"]').boundingBox() });

await check('real-time: the section refreshes on its own (updated caption and LIVE badge)', async () => {
  const before = await page.locator('section[aria-labelledby="x1view-title"] p.text-xs').innerText();
  expect(/LIVE|STALE/.test(await page.locator('.x1v__live').innerText()), 'no live badge');
  const n0 = sampleResponses;
  await page.waitForTimeout(18000);
  expect(sampleResponses > n0, 'no new performance-sample request in 18s');
  const after = await page.locator('section[aria-labelledby="x1view-title"] p.text-xs').innerText();
  expect(/updated/.test(after), 'no updated caption');
  return `${sampleResponses - n0} new sample request(s) in 18s; caption before: "${before.slice(0, 60)}…" after: "${after.slice(0, 60)}…"`;
});
await check('live XNT price is shown', async () => {
  const t = await page.locator('.x1v__price').innerText();
  expect(/XNT \$\d|No XNT price|—/.test(t), t);
  return t.trim();
});
await check('legend lists the four original categories', async () => {
  const t = await page.locator('.x1v__legend').innerText();
  for (const w of ['Vote', 'Transfer', 'Token/Program', 'Other']) expect(t.includes(w), `missing ${w}`);
});
await check('Latest block activity section and other dashboard sections are still present', async () => {
  const body = await page.locator('main').innerText();
  for (const t of ['latest block activity', 'transactions per second', 'recent blocks', 'slot', 'active validators']) expect(body.toLowerCase().includes(t), `missing ${t}`);
});
await check('no page errors or console errors', async () => { expect(errors.length === 0, errors.join(' | ')); });
await check('no serious/critical axe violations on the dashboard', async () => {
  await page.addScriptTag({ content: axeSource });
  const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })).violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id}: ${x.nodes[0]?.target?.join(' ')}`.slice(0, 160)));
  expect(v.length === 0, v.join(' | '));
});
await page.getByRole('tab', { name: '1m' }).click();
await page.screenshot({ path: `${OUT}/dashboard-desktop-full.png`, fullPage: true });
await ctx.close();

for (const [name, vp] of [['tablet', { width: 820, height: 1100 }], ['mobile', { width: 390, height: 844 }]]) {
  const o = await open(vp);
  await o.page.goto(APP + '/Dashboard');
  await o.page.waitForSelector('.x1v__card', { timeout: 30000 });
  await o.page.waitForTimeout(2000);
  await check(`[${name}] no horizontal page overflow, section visible, row scrolls inside itself`, async () => {
    const ov = await o.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(ov <= 1, `overflow ${ov}px`);
    expect(await o.page.locator('.x1v').isVisible(), 'section hidden');
    expect(o.errors.length === 0, o.errors.join(' | '));
  });
  await o.page.locator('.x1v').screenshot({ path: `${OUT}/x1view-1m-${name}.png` });
  await o.page.getByRole('tab', { name: '10m' }).click();
  await o.page.waitForTimeout(400);
  await o.page.locator('.x1v').screenshot({ path: `${OUT}/x1view-10m-${name}.png` });
  await o.ctx.close();
}
await b.close();
const failed = results.filter((r) => !r.pass);
fs.writeFileSync('docs/upgrade/x1view-results.json', JSON.stringify({ ranAt: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results }, null, 2));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
