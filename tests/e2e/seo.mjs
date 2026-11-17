// SEO checks against the built app: per-route title, canonical and robots, plus robots.txt and sitemap.xml.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const APP = 'http://127.0.0.1:4173';
const results = [];
const check = async (name, fn) => {
  try { const d = await fn(); results.push({ name, pass: true, detail: d || '' }); console.log(`PASS  ${name}${d ? '  — ' + d : ''}`); }
  catch (e) { results.push({ name, pass: false, detail: String(e.message).slice(0, 200) }); console.log(`FAIL  ${name}  — ${String(e.message).slice(0, 200)}`); }
};
const expect = (c, m) => { if (!c) throw new Error(m); };
const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {});
const ctx = await b.newContext();
await ctx.route(/\/functions\//, (r) => r.fulfill({ status: 503, body: '{}' }));
const meta = async (path) => {
  const page = await ctx.newPage();
  await page.goto(APP + path);
  await page.waitForSelector('h1', { timeout: 25000 });
  const m = await page.evaluate(() => ({ title: document.title, canonical: document.querySelector('link[rel=canonical]')?.href || null, robots: document.querySelector('meta[name=robots]')?.content || null, h1: document.querySelectorAll('h1').length }));
  await page.close();
  return m;
};
for (const [path, canonical, robots] of [['/Dashboard', 'https://x1space.xyz/', 'index'], ['/TokenExplorer', 'https://x1space.xyz/TokenExplorer', 'index'], ['/Validators', 'https://x1space.xyz/Validators', 'index'], ['/NetworkMap', 'https://x1space.xyz/NetworkMap', 'index'], ['/Watchlist', 'https://x1space.xyz/Watchlist', 'noindex'], ['/AddressLookup?address=x', 'https://x1space.xyz/AddressLookup', 'noindex'], ['/NoSuchPage', null, 'noindex']]) {
  await check(`${path}: title, canonical and robots`, async () => {
    const m = await meta(path);
    expect(m.title && m.title.length > 8 && m.title.length < 80, `title "${m.title}"`);
    expect(m.canonical === canonical, `canonical ${m.canonical}`);
    expect(m.robots && m.robots.startsWith(robots), `robots ${m.robots}`);
    expect(m.h1 === 1, `h1 count ${m.h1}`);
    return `${m.title} | ${m.robots}`;
  });
}
await check('titles are unique across list pages', async () => {
  const t = new Set();
  for (const p of ['/Dashboard', '/TokenExplorer', '/Validators', '/NetworkMap', '/Blocks', '/LPExplorer']) t.add((await meta(p)).title);
  expect(t.size === 6, [...t].join(' | '));
});
// Regression: in-app links are lower-case; valid pages must never get the 404 title or noindex,nofollow.
await check('lower-case and mixed-case routes keep their real title, canonical and robots (never the 404 title)', async () => {
  const seen = [];
  for (const [path, title, canonical] of [
    ['/validators', 'Validators | X1 Space', 'https://x1space.xyz/Validators'],
    ['/tokenexplorer', 'Tokens | X1 Space', 'https://x1space.xyz/TokenExplorer'],
    ['/lpexplorer', 'Liquidity Pools | X1 Space', 'https://x1space.xyz/LPExplorer'],
    ['/networkhealth', 'Network Statistics | X1 Space', 'https://x1space.xyz/NetworkHealth'],
    ['/dashboard', 'X1 Space | X1 Blockchain Explorer', 'https://x1space.xyz/'],
    ['/', 'X1 Space | X1 Blockchain Explorer', 'https://x1space.xyz/'],
  ]) {
    const m = await meta(path);
    expect(m.title === title, `${path}: title "${m.title}" expected "${title}"`);
    expect(m.canonical === canonical, `${path}: canonical ${m.canonical}`);
    expect(m.robots && m.robots.startsWith('index'), `${path}: robots ${m.robots}`);
    seen.push(m.title);
  }
  return seen.length + ' routes';
});
await check('genuine 404 pages (and only those) get the not-found title, no canonical, noindex,nofollow', async () => {
  for (const path of ['/NoSuchPage', '/a/b/c', '/validators/extra']) {
    const m = await meta(path);
    expect(m.title === 'Page Not Found | X1 Space', `${path}: title "${m.title}"`);
    expect(m.canonical === null, `${path}: canonical ${m.canonical}`);
    expect(m.robots === 'noindex, nofollow', `${path}: robots ${m.robots}`);
  }
});
await check('title follows internal navigation, history and refresh', async () => {
  const page = await ctx.newPage();
  await page.goto(APP + '/dashboard');
  await page.waitForSelector('h1', { timeout: 25000 });
  const t = () => page.title();
  expect((await t()) === 'X1 Space | X1 Blockchain Explorer', 'dashboard title ' + (await t()));
  await page.locator('a[href="/validators"]').first().click();
  await page.waitForFunction(() => document.title === 'Validators | X1 Space', null, { timeout: 8000 });
  await page.reload();
  await page.waitForSelector('h1', { timeout: 25000 });
  expect((await t()) === 'Validators | X1 Space', 'after refresh ' + (await t()));
  await page.goBack();
  await page.waitForFunction(() => document.title === 'X1 Space | X1 Blockchain Explorer', null, { timeout: 8000 });
  await page.goto(APP + '/NoSuchPage');
  await page.waitForSelector('h1');
  expect((await t()) === 'Page Not Found | X1 Space', '404 title ' + (await t()));
  await page.locator('a[href="/dashboard"]').first().click();
  await page.waitForFunction(() => document.title === 'X1 Space | X1 Blockchain Explorer', null, { timeout: 8000 });
  await page.close();
});
await check('robots.txt and sitemap.xml are served and consistent', async () => {
  const r = await (await fetch(APP + '/robots.txt')).text();
  const s = await (await fetch(APP + '/sitemap.xml')).text();
  expect(/Sitemap: https:\/\/x1space\.xyz\/sitemap\.xml/.test(r) && /Disallow: \/functions\//.test(r), 'robots.txt content');
  const urls = [...s.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(urls.length >= 10 && urls.every((u) => u.startsWith('https://x1space.xyz/')), 'sitemap urls');
  return `${urls.length} urls`;
});
await b.close();
const failed = results.filter((r) => !r.pass);
fs.writeFileSync('docs/upgrade/seo-results.json', JSON.stringify({ ranAt: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results }, null, 2));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
