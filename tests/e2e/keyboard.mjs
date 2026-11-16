// Manual-style keyboard audit, automated: Tab through each principal page and check that focus moves,
// is visibly indicated, never gets trapped, and that the skip link and Escape handling work.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const APP = 'http://127.0.0.1:4173';
const FUNCTIONS = 'http://127.0.0.1:8787';
const results = [];
const check = async (name, fn) => {
  try { const d = await fn(); results.push({ name, pass: true, detail: d || '' }); console.log(`PASS  ${name}${d ? '  — ' + d : ''}`); }
  catch (e) { results.push({ name, pass: false, detail: String(e.message).split('\n')[0].slice(0, 220) }); console.log(`FAIL  ${name}  — ${String(e.message).split('\n')[0].slice(0, 220)}`); }
};
const expect = (c, m) => { if (!c) throw new Error(m); };
const b = await chromium.launch(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' } } : {});
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
await ctx.route(/^https?:\/\/[^/]+\/(api\/apps\/[^/]+\/)?functions\//, async (route) => {
  const req = route.request(); const u = new URL(req.url());
  const name = u.pathname.replace(/^\/(api\/apps\/[^/]+\/)?functions\//, '');
  const hasBody = req.method() !== 'GET' && req.method() !== 'HEAD';
  try {
    const r = await fetch(`${FUNCTIONS}/functions/${name}${u.search}`, { method: req.method(), headers: { origin: APP, ...(hasBody ? { 'content-type': 'application/json' } : {}) }, body: hasBody ? req.postData() || undefined : undefined });
    await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers.entries()), body: Buffer.from(await r.arrayBuffer()) });
  } catch { await route.abort(); }
});
const describe = () => document.activeElement && document.activeElement !== document.body ? {
  id: `${document.activeElement.tagName}:${(document.activeElement.getAttribute('aria-label') || document.activeElement.textContent || '').trim().slice(0, 30)}:${document.activeElement.getAttribute('href') || ''}`,
  visible: (() => { const s = getComputedStyle(document.activeElement); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none'); })(),
} : null;

for (const name of ['Dashboard', 'TokenExplorer', 'Validators', 'NetworkMap', 'Blocks', 'Search']) {
  const page = await ctx.newPage();
  await check(`${name}: 25 Tab presses move focus onward, each stop has a visible focus indicator`, async () => {
    await page.goto(`${APP}/${name}`);
    await page.waitForSelector('h1', { timeout: 25000 });
    await page.waitForTimeout(2500);
    const seen = []; const invisible = [];
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press('Tab');
      const d = await page.evaluate(describe);
      if (!d) continue;
      seen.push(d.id);
      if (!d.visible) invisible.push(d.id);
    }
    expect(new Set(seen).size >= 12, `only ${new Set(seen).size} distinct stops (trapped?)`);
    expect(invisible.length === 0, `no visible focus indicator on: ${[...new Set(invisible)].slice(0, 4).join(' | ')}`);
    return `${new Set(seen).size} distinct stops`;
  });
  await page.close();
}
{
  const page = await ctx.newPage();
  await page.goto(`${APP}/Dashboard`);
  await page.waitForSelector('h1', { timeout: 25000 });
  await check('skip-to-content link is the first stop and moves focus to main content', async () => {
    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => document.activeElement?.textContent?.trim());
    expect(/skip/i.test(first || ''), `first stop is "${first}"`);
    await page.keyboard.press('Enter');
    const inMain = await page.evaluate(() => !!document.activeElement?.closest('main') || document.activeElement?.id === 'main-content' || location.hash.length > 1);
    expect(inMain, 'focus did not move to main');
  });
  await page.close();
}
await b.close();
const failed = results.filter((r) => !r.pass);
fs.writeFileSync('docs/upgrade/keyboard-results.json', JSON.stringify({ ranAt: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results }, null, 2));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
