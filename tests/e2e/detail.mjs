// Parameterised and edge routes: detail pages with real identifiers taken from the live chain,
// invalid and unknown inputs, the Home redirect and the 404 page.
// Same setup as run.mjs (preview on 4173, functions server on 8787).
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const APP = 'http://127.0.0.1:4173';
const FUNCTIONS = 'http://127.0.0.1:8787';
const RPC = 'https://rpc.mainnet.x1.xyz';
const rpc = async (method, params = []) => (await (await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json()).result;

const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push({ name, pass: true, detail: detail || '' });
    console.log(`PASS  ${name}${detail ? '  — ' + detail : ''}`);
  } catch (e) {
    results.push({ name, pass: false, detail: String(e.message).split('\n')[0].slice(0, 200) });
    console.log(`FAIL  ${name}  — ${String(e.message).split('\n')[0].slice(0, 200)}`);
  }
};
const expect = (c, m) => { if (!c) throw new Error(m); };

// Real identifiers
const slot = await rpc('getSlot');
let block = null;
for (let s = slot - 3; s > slot - 30 && !block; s--) block = await rpc('getBlock', [s, { transactionDetails: 'signatures', rewards: false, maxSupportedTransactionVersion: 0 }]).then((b) => b && b.signatures?.length ? { slot: s, sig: b.signatures[b.signatures.length - 1] } : null).catch(() => null);
const votes = await rpc('getVoteAccounts');
const vote = votes.current[0].votePubkey;
const vote2 = votes.current[1].votePubkey;
const wallet = 'So11111111111111111111111111111111111111112';
console.log('using slot', block.slot, 'sig', block.sig.slice(0, 8) + '…', 'vote', vote.slice(0, 6) + '…');

const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {});

async function open(vp = { width: 1280, height: 900 }) {
  const ctx = await b.newContext({ viewport: vp, reducedMotion: 'reduce' });
  await ctx.route(/\/functions\//, async (route) => {
    const u = new URL(route.request().url());
    try {
      const r = await fetch(FUNCTIONS + u.pathname + u.search, { headers: { origin: APP } });
      await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers.entries()), body: Buffer.from(await r.arrayBuffer()) });
    } catch { await route.abort(); }
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 160)));
  return { ctx, page, errors };
}
const settle = async (page, ms = 4000) => { await page.waitForSelector('h1', { timeout: 25000 }); await page.waitForTimeout(ms); };
const h1 = (page) => page.locator('h1').first().innerText();
const body = (page) => page.locator('main').innerText();
const axe = async (page) => {
  await page.addScriptTag({ content: axeSource });
  const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })).violations.filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => `${x.id}: ${x.nodes[0]?.target?.join(' ')}`.slice(0, 140)));
  expect(v.length === 0, v.join(' | '));
};

const cases = [
  ['BlockDetail with a real slot', `/BlockDetail?slot=${block.slot}`, (t) => /Block|Slot/i.test(t) && /Transactions|transactions/.test(t) && !/No block at slot/.test(t)],
  ['BlockDetail with an invalid slot shows an empty state', '/BlockDetail?slot=abc', (t) => /slot/i.test(t) && !/undefined|NaN/.test(t)],
  ['BlockDetail far in the future shows a clear not-found state', `/BlockDetail?slot=${slot + 99999999}`, (t) => /No block|not.*available|not found/i.test(t)],
  ['TransactionDetail with a real signature', `/TransactionDetail?sig=${block.sig}`, (t) => /Success|Failed/.test(t) && /Fee/i.test(t)],
  ['TransactionDetail with a malformed signature is rejected before any lookup', '/TransactionDetail?sig=not-a-signature', (t) => /invalid|not a valid|signature/i.test(t)],
  ['ValidatorDetail with a real vote account', `/ValidatorDetail?id=${vote}`, (t) => /Commission/i.test(t) && /Stake/i.test(t) && !/NaN|undefined/.test(t)],
  ['ValidatorDetail with an unknown id shows not-found', '/ValidatorDetail?id=11111111111111111111111111111111', (t) => /not found|No validator/i.test(t)],
  ['AddressLookup with a real address', `/AddressLookup?address=${wallet}`, (t) => /Balance|Owner|Account/i.test(t) && !/NaN|undefined/.test(t)],
  ['AddressLookup with an invalid address is rejected', '/AddressLookup?address=hello', (t) => /valid|invalid|address/i.test(t)],
  ['TransactionFlowPage with a real signature', `/TransactionFlowPage?sig=${block.sig}`, (t) => /Flow|transfer|Transaction/i.test(t) && !/NaN|undefined/.test(t)],
  ['ValidatorCompare with two real validators', `/ValidatorCompare?ids=${vote},${vote2}`, (t) => /Stake/i.test(t) && /Commission/i.test(t) && !/NaN|undefined/.test(t)],
  ['Search for a token name returns real results', '/Search?q=wxnt', (t) => /WXNT|Wrapped/i.test(t)],
  ['Search for a slot finds the block', `/Search?q=${block.slot}`, (t) => /block|slot/i.test(t)],
  ['Search for an address classifies it', `/Search?q=${wallet}`, (t) => /token|account|address/i.test(t)],
  ['Search for something that does not exist shows an empty result, not demo data', '/Search?q=zzzzqqqq', (t) => !/2847|125\.45|X1 Labs Validator/.test(t)],
];
for (const vpName of ['desktop', 'mobile']) {
  const vp = vpName === 'desktop' ? { width: 1280, height: 900 } : { width: 390, height: 844 };
  for (const [name, path, ok] of cases) {
    const { ctx, page, errors } = await open(vp);
    await check(`[${vpName}] ${name}`, async () => {
      await page.goto(APP + path);
      await settle(page);
      const t = await body(page);
      expect(ok(t), `unexpected content: ${t.replace(/\s+/g, ' ').slice(0, 140)}`);
      expect(errors.length === 0, errors.join(' | '));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow <= 1, `horizontal overflow ${overflow}px`);
      expect((await page.locator('h1').count()) === 1, 'expected exactly one h1');
    });
    await ctx.close();
  }
}

{
  const { ctx, page } = await open();
  await check('Home redirects to the dashboard', async () => {
    await page.goto(APP + '/Home');
    await page.waitForURL(/dashboard/i, { timeout: 10000 });
  });
  await check('unknown route shows the 404 page with a way back', async () => {
    await page.goto(APP + '/NoSuchPage');
    await page.waitForSelector('text=404', { timeout: 15000 });
    expect(await page.getByRole('link', { name: /dashboard|home|back/i }).first().isVisible(), 'no link back');
  });
  await ctx.close();
}
for (const path of [`/BlockDetail?slot=${block.slot}`, `/TransactionDetail?sig=${block.sig}`, `/ValidatorDetail?id=${vote}`, `/AddressLookup?address=${wallet}`, `/ValidatorCompare?ids=${vote},${vote2}`, '/Search?q=wxnt']) {
  const { ctx, page } = await open();
  await check(`a11y: ${path.split('?')[0]} has no serious or critical axe violations`, async () => {
    await page.goto(APP + path);
    await settle(page, 5000);
    await axe(page);
  });
  await ctx.close();
}
await b.close();
const failed = results.filter((r) => !r.pass);
fs.writeFileSync('docs/upgrade/detail-results.json', JSON.stringify({ ranAt: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results }, null, 2));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
