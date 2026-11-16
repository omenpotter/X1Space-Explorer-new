// Captures the ORIGINAL app (commit acebc09, built in a separate worktree and served on :4174) for before/after comparison.
// The old frontend only calls its backend on x1space.xyz / base44.app hosts, so the hostname is mapped to the local
// preview. Its `/functions/getTokens` backend is reproduced here from the original source (base44/functions/getTokens),
// fed by the live XDEX pool list, so the page shows what the old function would have returned.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const OUT = 'docs/upgrade/screenshots/before';
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'x1space.xyz,127.0.0.1,localhost' } : undefined;
const b = await chromium.launch({ proxy, args: ['--host-resolver-rules=MAP x1space.xyz 127.0.0.1'] });

async function oldGetTokens() {
  const j = await (await fetch('https://api.xdex.xyz/api/xendex/pool/list?network=X1%20Mainnet')).json();
  const map = new Map();
  for (const pool of j.data) {
    for (const n of [1, 2]) {
      const mint = pool[`token${n}_address`];
      if (!mint) continue;
      const price = pool[`token${n}_price`] || 0;
      if (!map.has(mint)) map.set(mint, { mint, name: pool[`token${n}_symbol`] || 'Unknown Token', symbol: pool[`token${n}_symbol`] || 'UNKNOWN', logo_uri: pool[`token${n}_logo`] || null, decimals: 9, verified: !!pool[`token${n}_symbol`], pool_count: 1, liquidity: pool.tvl || 0, price });
      else { const t = map.get(mint); t.pool_count++; t.liquidity += pool.tvl || 0; if (price > 0 && t.price === 0) t.price = price; }
    }
  }
  const tokens = [...map.values()].sort((a, c) => c.liquidity - a.liquidity).map((t) => ({ mint: t.mint, name: t.name, symbol: t.symbol, logo_uri: t.logo_uri, decimals: 9, total_supply: 0, token_type: 'SPL Token', verification_count: t.verified ? 1 : 0, is_scam: false, website: null, twitter: null, liquidity: t.liquidity, pool_count: t.pool_count, price: t.price ? String(t.price) : '0.0000', market_cap: 0, price_change_24h: '0.00', volume_24h: 0, created_at: new Date().toISOString(), price_history: [] }));
  return { success: true, tokens: tokens.slice(0, 500), total: tokens.length, verified: tokens.filter((t) => t.verification_count).length, discovered: 0 };
}

const shots = [
  ['Dashboard', 'desktop', 1440, 900], ['TokenExplorer', 'desktop', 1440, 900], ['NetworkMap', 'desktop', 1440, 900],
  ['Validators', 'desktop', 1440, 900], ['Validators', 'mobile', 390, 844], ['NetworkMap', 'mobile', 390, 844], ['TokenExplorer', 'mobile', 390, 844],
];
for (const [name, vp, w, h] of shots) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  // Playwright runs the most recently registered matching route first: register the general rule first.
  await ctx.route(/x1space\.xyz:4174\/functions\//, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":{"code":503}}' }));
  await ctx.route(/x1space\.xyz:4174\/functions\/getTokens/, async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(await oldGetTokens()) }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 100)));
  await page.goto(`http://x1space.xyz:4174/${name}`).catch(() => {});
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `${OUT}/${name}-${vp}.png` });
  console.log(name, vp, 'page errors:', errors.length ? errors.join(' | ') : 'none');
  await ctx.close();
}
await b.close();
