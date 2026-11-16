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
