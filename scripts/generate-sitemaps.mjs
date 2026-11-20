// Regenerates public/sitemap.xml (index), public/sitemap-pages.xml and public/sitemap-validators.xml.
// Read-only: one getVoteAccounts call to X1 mainnet. Run: node scripts/generate-sitemaps.mjs
//
// Validator eligibility (deterministic, bounded): current (non-delinquent) vote accounts with
// activated stake > 0 and a well-formed vote pubkey. Delinquent or unstaked validators are omitted;
// their pages still render but are not advertised. Re-run when the validator set changes.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ORIGIN = 'https://x1space.xyz';
const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const today = new Date().toISOString().slice(0, 10);
// Keep in sync with indexable pages in src/lib/pageMeta.js (NOINDEX excluded).
export const PAGES = ['', 'NetworkHealth', 'NetworkMap', 'Blocks', 'Transactions', 'Validators', 'Leaderboard', 'StakingCalculator', 'TokenExplorer', 'LPExplorer', 'WhaleWatcher', 'ApiDocs', 'Learn'];
const PUBKEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function eligibleValidators(voteAccounts) {
  return [...(voteAccounts?.current ?? [])]
    .filter((v) => PUBKEY.test(v.votePubkey) && Number(v.activatedStake) > 0)
    .sort((a, b) => b.activatedStake - a.activatedStake)
    .map((v) => v.votePubkey);
}

const urlset = (urls) => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const res = await fetch('https://rpc.mainnet.x1.xyz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getVoteAccounts' }) });
  const { result, error } = await res.json();
  if (error || !result) throw new Error(`getVoteAccounts failed: ${error?.message}`);
  const validators = eligibleValidators(result);
  writeFileSync(join(PUBLIC, 'sitemap-pages.xml'), urlset(PAGES.map((p) => `${ORIGIN}/${p}`)));
  writeFileSync(join(PUBLIC, 'sitemap-validators.xml'), urlset(validators.map((id) => `${ORIGIN}/ValidatorDetail?id=${id}`)));
  writeFileSync(join(PUBLIC, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${ORIGIN}/sitemap-pages.xml</loc><lastmod>${today}</lastmod></sitemap>\n  <sitemap><loc>${ORIGIN}/sitemap-validators.xml</loc><lastmod>${today}</lastmod></sitemap>\n</sitemapindex>\n`);
  console.log(`pages: ${PAGES.length}, validators: ${validators.length} (of ${result.current.length} current, ${result.delinquent.length} delinquent)`);
}
