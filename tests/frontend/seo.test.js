import { describe, it, expect } from 'vitest';
import { metaFor, structuredData, serializeJsonLd, PAGE_DESCRIPTIONS, PAGE_TITLES, NOINDEX, isPubkeyLike } from '@/lib/pageMeta';
import { PAGES, eligibleValidators } from '../../scripts/generate-sitemaps.mjs';
import fs from 'node:fs';

const VOTE = '7ZPky9oA5bDzCwpuBk9BshFX3BXNXzN9DjpnRcphNGtn';

describe('descriptions', () => {
  it('every indexable page has a unique description of useful length', () => {
    const indexable = Object.keys(PAGE_TITLES).filter((p) => !NOINDEX.has(p) && p !== 'ValidatorDetail');
    const seen = new Set();
    for (const p of indexable) {
      const d = PAGE_DESCRIPTIONS[p];
      expect(d, p).toBeTruthy();
      expect(d.length, p).toBeGreaterThanOrEqual(70);
      expect(d.length, p).toBeLessThanOrEqual(165);
      expect(seen.has(d), p).toBe(false);
      seen.add(d);
    }
  });
});

describe('validator entity URLs', () => {
  it('valid vote pubkey -> self-referencing canonical, indexable', () => {
    const m = metaFor('/validatordetail', true, `?id=${VOTE}`);
    expect(m.canonical).toBe(`https://x1space.xyz/ValidatorDetail?id=${VOTE}`);
    expect(m.robots).toBe('index, follow');
  });
  it('missing, malformed or hostile id -> noindex and no new canonical', () => {
    for (const q of ['', '?id=', '?id=abc', '?id=<script>', `?id=${VOTE}0OIl`, '?foo=bar']) {
      const m = metaFor('/ValidatorDetail', true, q);
      expect(m.robots, q).toBe('noindex, follow');
      expect(m.canonical, q).toBe('https://x1space.xyz/ValidatorDetail');
    }
  });
  it('query strings never create canonicals on other pages', () => {
    expect(metaFor('/TokenExplorer', true, '?mint=abc&q=x').canonical).toBe('https://x1space.xyz/TokenExplorer');
    expect(metaFor('/Blocks', true, '?page=9').canonical).toBe('https://x1space.xyz/Blocks');
  });
  it('isPubkeyLike', () => {
    expect(isPubkeyLike(VOTE)).toBe(true);
    expect(isPubkeyLike('0'.repeat(40))).toBe(false);
  });
});

describe('structured data', () => {
  it('home has Organization, WebSite and WebApplication; inner pages have breadcrumbs', () => {
    const home = structuredData(metaFor('/'))['@graph'].map((n) => n['@type']);
    expect(home).toEqual(expect.arrayContaining(['Organization', 'WebSite', 'WebPage', 'WebApplication']));
    const v = structuredData(metaFor('/ValidatorDetail', true, `?id=${VOTE}`))['@graph'];
    const bc = v.find((n) => n['@type'] === 'BreadcrumbList');
    expect(bc.itemListElement.map((i) => i.item)).toEqual(['https://x1space.xyz/', 'https://x1space.xyz/Validators', `https://x1space.xyz/ValidatorDetail?id=${VOTE}`]);
    expect(structuredData(metaFor('/Learn'))['@graph'].some((n) => n['@type'] === 'TechArticle' && n.dateModified)).toBe(true);
  });
  it('404 pages have no structured data', () => {
    expect(structuredData(metaFor('/nope'))).toBeNull();
  });
  it('never contains ratings or reviews', () => {
    for (const p of Object.keys(PAGE_TITLES)) expect(JSON.stringify(structuredData(metaFor(`/${p}`)) || {})).not.toMatch(/aggregateRating|"review"/i);
  });
  it('serializer cannot close a script element', () => {
    const s = serializeJsonLd({ name: '</script><img src=x onerror=alert(1)>' });
    expect(s).not.toMatch(/</);
    expect(JSON.parse(s).name).toContain('</script>');
  });
});

describe('sitemaps', () => {
  it('sitemap pages are exactly the indexable pages', () => {
    for (const p of PAGES.filter(Boolean)) {
      expect(PAGE_TITLES[p], p).toBeTruthy();
      expect(NOINDEX.has(p), p).toBe(false);
    }
    const xml = fs.readFileSync('public/sitemap-pages.xml', 'utf8');
    expect([...xml.matchAll(/<loc>(.*?)<\/loc>/g)].length).toBe(PAGES.length);
    expect(fs.readFileSync('public/sitemap.xml', 'utf8')).toMatch(/<sitemapindex/);
  });
  it('validator eligibility excludes delinquent, unstaked and malformed accounts', () => {
    const out = eligibleValidators({
      current: [{ votePubkey: VOTE, activatedStake: 5 }, { votePubkey: 'bad<key>', activatedStake: 9 }, { votePubkey: '11111111111111111111111111111111', activatedStake: 0 }],
      delinquent: [{ votePubkey: '9oCgTnLY7akSYPaLmTh6TdcXZ49raaBDMdVePXcwNCGB', activatedStake: 100 }],
    });
    expect(out).toEqual([VOTE]);
  });
  it('every validator sitemap URL is a valid indexable entity URL', () => {
    const xml = fs.readFileSync('public/sitemap-validators.xml', 'utf8');
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(0);
    for (const u of locs) {
      const url = new URL(u);
      const m = metaFor(url.pathname, true, url.search);
      expect(m.canonical).toBe(u);
      expect(m.robots).toBe('index, follow');
    }
  });
});
