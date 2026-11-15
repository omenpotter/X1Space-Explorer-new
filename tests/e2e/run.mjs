// Browser checks for the built app. Not part of `npm test`: needs a browser and two local servers.
//
//   npm run build
//   npx vite preview --port 4173 &                                   (serves dist/)
//   NODE_USE_ENV_PROXY=1 npx vite-node -c vitest.config.js scripts/dev-functions-server.ts &
//   node tests/e2e/run.mjs
//
// The app talks to the real X1 RPC; backend function calls (SDK POST and direct GET) are forwarded to the local functions server,
// which runs the production handlers against live public data. Failure scenarios are simulated
// by intercepting requests. Results are written to docs/upgrade/e2e-results.json.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const APP = process.env.APP_URL || 'http://127.0.0.1:4173';
const FUNCTIONS = process.env.FUNCTIONS_URL || 'http://127.0.0.1:8787';
const OUT = path.resolve('docs/upgrade/screenshots', process.env.SHOT_DIR || 'after');
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  'Dashboard', 'NetworkHealth', 'NetworkMap', 'Blocks', 'Transactions', 'TransactionFlowPage', 'AddressLookup',
  'Validators', 'Leaderboard', 'ValidatorCompare', 'ValidatorAlerts', 'StakingCalculator',
  'TokenExplorer', 'LPExplorer', 'WhaleWatcher', 'PortfolioTracker', 'Watchlist', 'CustomDashboard', 'ApiDocs', 'Search',
];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, tablet: { width: 820, height: 1180 }, mobile: { width: 390, height: 844 } };

const results = [];
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const check = async (name, fn) => {
  try {
    const detail = await fn();
    record(name, true, typeof detail === 'string' ? detail : '');
  } catch (err) {
    record(name, false, String(err?.message || err).split('\n')[0].slice(0, 220));
  }
};
const expect = (cond, message) => {
  if (!cond) throw new Error(message);
};

const launchOptions = {};
if (process.env.HTTPS_PROXY) launchOptions.proxy = { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' };
const browser = await chromium.launch(launchOptions);

// Backend functions are reached two ways: through the SDK (POST `<server>/api/apps/<id>/functions/<name>`
// with a JSON body; in the local build the id is the string 'undefined') and, for images and as a fallback,
// by a direct GET of `/functions/<name>?...`. Both are forwarded to the local functions server.
const FUNCTION_ROUTE = /^https?:\/\/[^/]+\/(api\/apps\/[^/]+\/)?functions\//;
const functionName = (url) => url.pathname.replace(/^\/(api\/apps\/[^/]+\/)?functions\//, '').split('/')[0];

/** New page with both function routes forwarded to the local functions server. `overrides` simulate failures. */
async function open(viewport, overrides = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: overrides.dsf || 1, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  await context.route(FUNCTION_ROUTE, async (route) => {
    const url = new URL(route.request().url());
    const name = functionName(url);
    if (overrides.functions?.[name]) return overrides.functions[name](route);
    if (overrides.functions?.['*']) return overrides.functions['*'](route);
    try {
      const req = route.request();
      const method = req.method();
      const hasBody = method !== 'GET' && method !== 'HEAD';
      const headers = { origin: APP };
      if (hasBody) headers['content-type'] = req.headers()['content-type'] || 'application/json';
      const res = await fetch(FUNCTIONS + `/functions/${name}` + url.search, { method, headers, body: hasBody ? req.postData() || undefined : undefined });
      const body = Buffer.from(await res.arrayBuffer());
      await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers.entries()), body });
    } catch {
      await route.abort();
    }
  });
  if (overrides.rpcDown) await context.route(/rpc\.(mainnet\.x1\.xyz|x1galaxy\.io)/, (route) => route.abort());
  return { page, context, errors };
}

const settle = async (page, ms = 2500) => {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('h1', { timeout: 20000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
};
const fail500 = (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false,"error":{"status":500,"code":"internal_error","message":"Internal error"}}' });

// ---------- 1. Every routed page: renders, one h1, no page errors, no horizontal overflow ----------
for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  for (const name of PAGES) {
    if (ONLY && !ONLY.includes(name)) continue;
    const { page, context, errors } = await open(viewport);
    await check(`[${vpName}] ${name} renders`, async () => {
      await page.goto(`${APP}/${name}`);
      await settle(page, name === 'TokenExplorer' || name === 'NetworkMap' || name === 'Validators' ? 6000 : 3000);
      const info = await page.evaluate(() => ({
        h1: document.querySelectorAll('h1').length,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        hasShell: !!document.querySelector('nav[aria-label="Main"]') || !!document.querySelector('button[aria-label="Open navigation"]'),
        rawHex: document.querySelectorAll('[class*="bg-[#"]').length,
        text: document.body.innerText.length,
      }));
      await page.screenshot({ path: path.join(OUT, `${name}-${vpName}.png`), fullPage: false });
      expect(errors.length === 0, `page errors: ${errors.join(' | ')}`);
      expect(info.h1 === 1, `expected one h1, found ${info.h1}`);
      expect(info.overflow <= 1, `horizontal overflow ${info.overflow}px`);
      expect(info.hasShell, 'application shell missing');
      expect(info.rawHex === 0, `${info.rawHex} elements still use raw hex backgrounds`);
      expect(info.text > 200, 'page looks empty');
    });
    await context.close();
  }
}

// ---------- 2. Token Explorer ----------
if (!ONLY || ONLY.includes('TokenExplorer')) {
  const { page, context, errors } = await open(VIEWPORTS.desktop, { dsf: 2 });
  await page.goto(`${APP}/TokenExplorer`);
  await page.waitForSelector('table.data-table tbody tr', { timeout: 30000 });
  await check('tokens: table lists 50 rows from the live index', async () => {
    const rows = await page.locator('table.data-table tbody tr').count();
    expect(rows === 50, `rows=${rows}`);
    const indexed = await page.locator('text=Token mints indexed').locator('xpath=../..').innerText();
    const n = Number((indexed.match(/[\d,]{5,}/) || ['0'])[0].replace(/,/g, ''));
    expect(n > 20000, `indexed=${n}`);
    return `${n} mints indexed`;
  });
  await check('tokens: source status and freshness are shown', async () => {
    const text = await page.locator('main').innerText();
    expect(/On-chain index: live/.test(text), 'chain status missing');
    expect(/XDEX: live/.test(text), 'xdex status missing');
    expect(/X1 Ninja: not connected/.test(text), 'ninja status missing');
    expect(/Updated (just now|\d+s ago)/.test(text), 'freshness missing');
  });
  await check('tokens: unknown market values show a dash, never $0.00', async () => {
    await page.getByRole('button', { name: /Supply/ }).click();
    await page.waitForTimeout(2500);
    const cells = await page.locator('table.data-table tbody tr td:nth-child(3)').allInnerTexts();
    expect(cells.length > 0, 'no rows');
    expect(!cells.some((c) => /\$0\.00\b/.test(c)), 'found $0.00 for a token without a market');
    expect(cells.some((c) => c.includes('—')), 'expected unavailable markers for unlisted tokens');
    await page.getByRole('button', { name: /Liquidity/ }).click();
    await page.waitForTimeout(2500);
  });
  await page.screenshot({ path: path.join(OUT, 'TokenExplorer-detail-list@2x.png') });
  await check('tokens: search filters server-side', async () => {
    await page.getByLabel('Search tokens by name, symbol or mint address').fill('wxnt');
    await page.waitForTimeout(2500);
    const first = await page.locator('table.data-table tbody tr').first().innerText();
    expect(/WXNT/i.test(first), `first row: ${first.slice(0, 60)}`);
  });
  await check('tokens: detail drawer shows chain facts and a risk review', async () => {
    await page.locator('table.data-table tbody tr').first().locator('td:nth-child(2) button').click();
    await page.waitForSelector('text=On-chain facts', { timeout: 20000 });
    const text = await page.locator('[role="dialog"]').innerText();
    expect(/Decimals/.test(text) && /Mint authority/.test(text), 'chain facts missing');
    expect(/Risk review/.test(text), 'risk review missing');
    await page.screenshot({ path: path.join(OUT, 'TokenExplorer-detail@2x.png') });
    await page.keyboard.press('Escape');
  });
  await check('tokens: kind and program filters change the result set', async () => {
    await page.getByLabel('Search tokens by name, symbol or mint address').fill('');
    await page.getByRole('button', { name: 'NFTs' }).click();
    await page.waitForTimeout(2500);
    const a = await page.locator('nav[aria-label="Pagination"]').innerText();
    await page.getByLabel('Token program').selectOption('token-2022');
    await page.waitForTimeout(2500);
    const b = await page.locator('nav[aria-label="Pagination"]').innerText();
    expect(a !== b, 'pagination did not change');
    return `${a.split('\n')[0]} -> ${b.split('\n')[0]}`;
  });
  await check('tokens: no page errors', async () => expect(errors.length === 0, errors.join(' | ')));
  await context.close();

  const down = await open(VIEWPORTS.desktop, { functions: { getTokens: fail500 } });
  await check('tokens: backend failure shows an error state with retry, not empty or fake rows', async () => {
    await down.page.goto(`${APP}/TokenExplorer`);
    await down.page.waitForSelector('[role="alert"]', { timeout: 20000 });
    const rows = await down.page.locator('table.data-table tbody tr').count();
    expect(rows === 0, `rows=${rows}`);
    expect(await down.page.getByRole('button', { name: 'Try again' }).isVisible(), 'retry missing');
    await down.page.screenshot({ path: path.join(OUT, 'TokenExplorer-error.png') });
  });
  await down.context.close();

  const empty = await open(VIEWPORTS.mobile);
  await check('tokens: empty search result shows an empty state', async () => {
    await empty.page.goto(`${APP}/TokenExplorer?q=zzzzqqqqxxxx`);
    await empty.page.waitForSelector('text=No tokens match', { timeout: 20000 });
  });
  await empty.context.close();
}

// ---------- 3. Network Map ----------
if (!ONLY || ONLY.includes('NetworkMap')) {
  const { page, context, errors } = await open(VIEWPORTS.desktop, { dsf: 2 });
  await page.goto(`${APP}/NetworkMap`);
  await page.waitForSelector('svg [data-marker]', { timeout: 40000 });
  await check('map: world outline and validator markers render', async () => {
    const markers = await page.locator('svg [data-marker]').count();
    const land = await page.locator('svg path').count();
    expect(markers > 5, `markers=${markers}`);
    expect(land >= 4, 'map outline missing');
    const box = await page.locator('svg[role="group"]').boundingBox();
    expect(box.width > 600 && box.height > 300, `map size ${Math.round(box.width)}x${Math.round(box.height)}`);
    return `${markers} location markers`;
  });
  await check('map: located + unlocated accounts for every validator', async () => {
    const text = await page.locator('main').innerText();
    const m = text.match(/LOCATED\s+([\d,]+) \/ ([\d,]+)/i);
    expect(m, 'located stat missing');
    const [located, total] = [m[1], m[2]].map((s) => Number(s.replace(/,/g, '')));
    const un = Number((text.match(/Not located \(([\d,]+)\)/) || [0, '-1'])[1].replace(/,/g, ''));
    expect(located + un === total, `${located} + ${un} != ${total}`);
    return `${located} located, ${un} not located, ${total} total`;
  });
  await check('map: no raw node addresses anywhere in the page', async () => {
    const html = await page.content();
    expect(!/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5}\b/.test(html), 'found an ip:port in the page');
  });
  await check('map: selecting a marker lists its validators', async () => {
    await page.locator('svg [data-marker]').last().click();
    await page.waitForSelector('[aria-live="polite"] ul li a', { timeout: 5000 });
    const n = await page.locator('[aria-live="polite"] ul li a').count();
    expect(n >= 1, 'no validators listed');
    await page.screenshot({ path: path.join(OUT, 'NetworkMap-selected@2x.png') });
  });
  await check('map: status filter narrows the markers', async () => {
    const before = await page.locator('svg [data-marker]').count();
    await page.getByLabel('Filter by status').selectOption('delinquent');
    await page.waitForTimeout(600);
    const after = await page.locator('svg [data-marker]').count();
    expect(after < before, `before=${before} after=${after}`);
    await page.getByLabel('Filter by status').selectOption('all');
  });
  await check('map: markers are keyboard operable and zoom controls work', async () => {
    await page.locator('svg [data-marker]').first().focus();
    await page.waitForSelector('[role="tooltip"]', { timeout: 3000 });
    await page.getByRole('button', { name: 'Zoom in' }).click();
    const t = await page.locator('svg[role="group"] > g').getAttribute('transform');
    expect(/scale\(1\.5\)/.test(t), `transform=${t}`);
    await page.getByRole('button', { name: 'Reset map view' }).click();
  });
  await check('map: resizes with the viewport', async () => {
    await page.setViewportSize({ width: 700, height: 900 });
    await page.waitForTimeout(400);
    const box = await page.locator('svg[role="group"]').boundingBox();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(box.width <= 700 && box.width > 500, `width=${Math.round(box.width)}`);
    expect(overflow <= 1, `overflow=${overflow}`);
  });
  await check('map: no page errors', async () => expect(errors.length === 0, errors.join(' | ')));
  await context.close();

  const noGeo = await open(VIEWPORTS.desktop, { functions: { getValidators: fail500 } });
  await check('map: location service failure places nothing and says so', async () => {
    await noGeo.page.goto(`${APP}/NetworkMap`);
    await noGeo.page.waitForSelector('text=Location data is unavailable right now', { timeout: 40000 });
    const markers = await noGeo.page.locator('svg [data-marker]').count();
    expect(markers === 0, `markers=${markers}`);
    await noGeo.page.screenshot({ path: path.join(OUT, 'NetworkMap-no-geolocation.png') });
  });
  await noGeo.context.close();

  const noRpc = await open(VIEWPORTS.desktop, { rpcDown: true });
  await check('map: RPC outage shows an error state with retry', async () => {
    await noRpc.page.goto(`${APP}/NetworkMap`);
    await noRpc.page.waitForSelector('text=Validator data is unavailable', { timeout: 60000 });
    expect(await noRpc.page.getByRole('button', { name: 'Try again' }).isVisible(), 'retry missing');
  });
  await noRpc.context.close();
}

// ---------- 4. Validators: identity, logos and fallbacks ----------
if (!ONLY || ONLY.includes('Validators')) {
  const { page, context } = await open(VIEWPORTS.desktop, { dsf: 2 });
  await page.goto(`${APP}/Validators`);
  await page.waitForSelector('[data-avatar]', { timeout: 40000 });
  await page.waitForTimeout(6000);
  await check('validators: every row has an avatar; official icons load where reachable', async () => {
    const counts = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('img[data-avatar="image"]')];
      return {
        loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
        generated: document.querySelectorAll('[data-avatar="generated"]').length,
        broken: imgs.filter((i) => i.complete && i.naturalWidth === 0 && getComputedStyle(i).opacity !== '0').length,
        emoji: /[\u{1F300}-\u{1FAFF}]/u.test(document.querySelector('main')?.innerText || ''),
      };
    });
    expect(counts.loaded + counts.generated > 20, JSON.stringify(counts));
    expect(counts.broken === 0, `${counts.broken} visibly broken images`);
    expect(!counts.emoji, 'emoji icons still present');
    await page.screenshot({ path: path.join(OUT, 'Validators@2x.png') });
    return `${counts.loaded} official icons loaded, ${counts.generated} generated avatars visible`;
  });
  await context.close();

  const noImg = await open(VIEWPORTS.desktop, { functions: { getImage: (route) => route.fulfill({ status: 404, body: '' }) } });
  await check('validators: when every icon fails, generated avatars are shown and nothing is broken', async () => {
    await noImg.page.goto(`${APP}/Validators`);
    await noImg.page.waitForSelector('[data-avatar]', { timeout: 40000 });
    await noImg.page.waitForTimeout(5000);
    const c = await noImg.page.evaluate(() => ({ img: document.querySelectorAll('img[data-avatar="image"]').length, gen: document.querySelectorAll('[data-avatar="generated"]').length }));
    expect(c.gen > 20 && c.img === 0, JSON.stringify(c));
  });
  await check('validators: generated avatars are stable across reloads', async () => {
    const read = () => noImg.page.evaluate(() => [...document.querySelectorAll('[data-avatar="generated"]')].slice(0, 8).map((e) => e.style.background + e.textContent));
    const a = await read();
    await noImg.page.reload();
    await noImg.page.waitForSelector('[data-avatar]', { timeout: 40000 });
    await noImg.page.waitForTimeout(5000);
    const b = await read();
    expect(a.length > 0 && JSON.stringify(a) === JSON.stringify(b), 'avatars changed between loads');
  });
  await noImg.context.close();
}

// ---------- 5. Navigation, search and keyboard ----------
if (!ONLY) {
  const { page, context } = await open(VIEWPORTS.desktop);
  await page.goto(`${APP}/`);
  await settle(page);
  await check('shell: skip link is the first focus stop', async () => {
    await page.keyboard.press('Tab');
    const text = await page.evaluate(() => document.activeElement?.textContent);
    expect(/Skip to content/.test(text || ''), `focused: ${text}`);
  });
  await check('shell: "/" focuses search and a mint address routes to the token', async () => {
    await page.keyboard.press('Escape');
    await page.locator('main').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('/');
    await page.keyboard.type('So11111111111111111111111111111111111111112');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForURL(/TokenExplorer|tokenexplorer/i, { timeout: 8000 });
  });
  await check('shell: active page is marked in navigation', async () => {
    const current = await page.locator('nav[aria-label="Main"] a[aria-current="page"]').innerText();
    expect(/Tokens/.test(current), `current=${current}`);
  });
  await context.close();

  const mobile = await open(VIEWPORTS.mobile);
  await mobile.page.goto(`${APP}/Validators`);
  await settle(mobile.page);
  await check('shell: mobile drawer opens and navigates', async () => {
    await mobile.page.getByRole('button', { name: 'Open navigation' }).click();
    await mobile.page.getByRole('link', { name: 'Network Map' }).click();
    await mobile.page.waitForURL(/networkmap/i, { timeout: 8000 });
  });
  await mobile.context.close();
}

// ---------- 6. Accessibility (axe-core, WCAG 2 A/AA) ----------
for (const name of ['Dashboard', 'TokenExplorer', 'NetworkMap', 'Validators', 'LPExplorer', 'Blocks', 'Transactions', 'Search']) {
  if (ONLY && !ONLY.includes(name)) continue;
  const { page, context } = await open(VIEWPORTS.desktop);
  await check(`a11y: ${name} has no serious or critical axe violations`, async () => {
    await page.goto(`${APP}/${name}`);
    await settle(page, 6000);
    await page.addScriptTag({ content: axeSource });
    const violations = await page.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
      return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target?.join(' ')}`.slice(0, 160));
    });
    expect(violations.length === 0, violations.join(' | '));
  });
  await context.close();
}

// ---------- 7. Load performance (local build, lab numbers only) ----------
if (!ONLY) {
  const { page, context } = await open(VIEWPORTS.mobile);
  await check('performance: first paint and transfer size of the landing page', async () => {
    await page.goto(`${APP}/`);
    await settle(page, 3000);
    const m = await page.evaluate(() => {
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
      const res = performance.getEntriesByType('resource').filter((r) => r.name.includes('/assets/'));
      return { fcp: Math.round(fcp || 0), js: Math.round(res.filter((r) => r.name.endsWith('.js')).reduce((s, r) => s + (r.encodedBodySize || 0), 0) / 1024), requests: res.length };
    });
    expect(m.fcp > 0 && m.fcp < 4000, `fcp=${m.fcp}ms`);
    return `FCP ${m.fcp} ms, ${m.js} KB of JS over ${m.requests} asset requests (uncompressed preview server)`;
  });
  await context.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
fs.writeFileSync(path.resolve('docs/upgrade', process.env.RESULTS_FILE || 'e2e-results.json'), JSON.stringify({ ranAt: new Date().toISOString(), passed: results.length - failed.length, failed: failed.length, results }, null, 2));
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
