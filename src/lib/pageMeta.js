// Per-route document title, canonical URL and robots directive.
// The app is a single-page application served from one HTML file, so these cannot be static: a canonical
// link in index.html would tell search engines that every route duplicates the home page.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const SITE_ORIGIN = 'https://x1space.xyz';
const SUFFIX = 'X1 Space';

/** Title per page name (the route path without the slash). */
export const PAGE_TITLES = {
  Dashboard: 'X1 Network Overview',
  NetworkHealth: 'Network Statistics',
  NetworkMap: 'Validator Network Map',
  Blocks: 'Blocks',
  BlockDetail: 'Block',
  Transactions: 'Transactions',
  TransactionDetail: 'Transaction',
  TransactionFlowPage: 'Transaction Flow',
  AddressLookup: 'Address Lookup',
  Validators: 'Validators',
  ValidatorDetail: 'Validator',
  Leaderboard: 'Validator Leaderboard',
  ValidatorCompare: 'Compare Validators',
  ValidatorAlerts: 'Validator Alerts',
  StakingCalculator: 'Staking Calculator',
  TokenExplorer: 'Tokens',
  LPExplorer: 'Liquidity Pools',
  WhaleWatcher: 'Whale Watcher',
  PortfolioTracker: 'Portfolio Tracker',
  Watchlist: 'Watchlist',
  CustomDashboard: 'Custom Dashboard',
  ApiDocs: 'API Documentation',
  Learn: 'X1 Explorer Guide',
  Search: 'Search',
  OAuthConsent: 'Authorize',
};

/** Pages that should stay out of search results: personal, transient, or an unbounded space of entity URLs. */
export const NOINDEX = new Set([
  'OAuthConsent', 'CustomDashboard', 'PortfolioTracker', 'Watchlist', 'Search', 'ValidatorAlerts',
  'AddressLookup', 'TransactionDetail', 'TransactionFlowPage', 'BlockDetail', 'ValidatorCompare',
]);

/** Lower-case route name to the canonical page name. React Router matches paths case-insensitively and the app's own links are lower-case (`createPageUrl`), so `/validators` is a real page. */
const CANONICAL_PAGE = Object.fromEntries(Object.keys(PAGE_TITLES).map((k) => [k.toLowerCase(), k]));

export const HOME_TITLE = `${SUFFIX} | X1 Blockchain Explorer`;
export const NOT_FOUND_TITLE = `Page Not Found | ${SUFFIX}`;

/** One-sentence description per indexable page (meta description, og:description). */
export const PAGE_DESCRIPTIONS = {
  Dashboard: 'Explore X1 mainnet live: blocks, transactions, validators with on-chain identity, every token mint, liquidity pools and network health.',
  NetworkHealth: 'Live X1 network statistics: TPS, slot time, epoch progress, block production, skip rate and RPC health, read from X1 mainnet.',
  NetworkMap: 'Map of X1 validator nodes by location, with stake share and delinquency, from gossip and vote account data.',
  Blocks: 'Latest X1 blocks with slot, block time, transaction count, fees and leader validator, updated live from X1 mainnet.',
  Transactions: 'Recent X1 transactions with signatures, status, fees and programs, streamed from X1 mainnet blocks.',
  Validators: 'Every X1 validator: vote account, identity, activated stake, commission, vote credits, skip rate and delinquency.',
  Leaderboard: 'X1 validator leaderboard ranked by stake, vote credits and performance, from on-chain vote accounts.',
  StakingCalculator: 'Estimate XNT staking rewards on X1 from live inflation, total active stake and validator commission.',
  TokenExplorer: 'Browse X1 tokens — SPL and Token-2022 mints with supply, decimals, authorities, holders and on-chain metadata.',
  LPExplorer: 'X1 liquidity pools on XDEX: reserves, prices and recent swaps, read from on-chain pool accounts and the XDEX API.',
  WhaleWatcher: 'Large XNT and token transfers on X1 mainnet, detected from recent blocks.',
  ApiDocs: 'X1 Space JSON API and X1 RPC reference: endpoints, parameters and example responses for X1 blockchain data.',
  Learn: 'How to use an X1 blockchain explorer: read blocks and transactions, check validators, verify SPL and Token-2022 tokens, and inspect liquidity pools.',
  ValidatorDetail: 'X1 validator profile: vote account, identity, stake, commission, vote credits and performance from X1 mainnet.',
};

const DEFAULT_DESCRIPTION = PAGE_DESCRIPTIONS.Dashboard;
export const ORG_ID = 'https://x1nexus.xyz/#arkbs-labs';
export const LEADER_SLOT_CHECKER = 'https://x1-leader-slot-checker.vercel.app';

/** Base58 public key check (32–44 chars, no 0 O I l). Used to decide whether an entity URL is indexable. */
export const isPubkeyLike = (s) => typeof s === 'string' && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);

/**
 * Title, canonical, robots and description for a path. `known` is false only for the 404 page.
 * A path is matched case-insensitively; the canonical URL always uses the canonical spelling
 * listed in the sitemap, so `/validators` and `/Validators` are one page for search engines.
 *
 * Entity rule (deterministic, bounded): `/ValidatorDetail?id=<vote pubkey>` is indexable with a
 * self-referencing canonical when `id` is a well-formed public key. The page downgrades itself to
 * noindex if the RPC has no such validator (see `useEntityMeta`). Without a valid id it is noindex.
 * Other query strings never create new canonical URLs.
 * @returns {{ title: string, canonical: string, robots: string, description?: string, page?: string }}
 */
export function metaFor(pathname, known = true, search = '') {
  const key = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  const home = key === '' || key === 'dashboard' || key === 'home';
  const page = home ? 'Dashboard' : CANONICAL_PAGE[key];
  if (!known || !page) {
    return { title: NOT_FOUND_TITLE, canonical: '', robots: 'noindex, nofollow' };
  }
  const base = {
    title: home ? HOME_TITLE : `${PAGE_TITLES[page]} | ${SUFFIX}`,
    canonical: `${SITE_ORIGIN}${home ? '/' : `/${page}`}`,
    robots: NOINDEX.has(page) ? 'noindex, follow' : 'index, follow',
    description: PAGE_DESCRIPTIONS[page] || DEFAULT_DESCRIPTION,
    page,
  };
  if (page === 'ValidatorDetail') {
    const id = new URLSearchParams(search).get('id')?.trim();
    if (isPubkeyLike(id)) {
      return { ...base, title: `Validator ${id.slice(0, 4)}…${id.slice(-4)} | ${SUFFIX}`, canonical: `${SITE_ORIGIN}/ValidatorDetail?id=${id}` };
    }
    return { ...base, robots: 'noindex, follow' };
  }
  return base;
}


/** Schema.org graph for a page. Only types supported by the visible content. */
export function structuredData(meta) {
  if (!meta.page || !meta.canonical) return null;
  const site = { '@id': `${SITE_ORIGIN}/#website` };
  /** @type {Record<string, any>[]} */
  const graph = [
    {
      '@type': 'Organization', '@id': ORG_ID, name: 'ARKBS Labs',
      description: 'Builder of X1 ecosystem tools: X1 Space, X1 Nexus, 404X1, Pump X1 and X1 Leader Slot Checker.',
      sameAs: ['https://x.com/rkbehelvi'],
    },
    {
      '@type': 'WebSite', '@id': `${SITE_ORIGIN}/#website`, url: `${SITE_ORIGIN}/`, name: 'X1 Space', alternateName: 'X1Space Explorer',
      description: 'Independent blockchain explorer and analytics for X1 mainnet.', inLanguage: 'en', publisher: { '@id': ORG_ID },
    },
    {
      '@type': 'Thing', '@id': `${SITE_ORIGIN}/#x1`, name: 'X1 blockchain', url: 'https://x1.xyz/', sameAs: ['https://docs.x1.xyz/'],
      description: 'High-performance layer-1 blockchain compatible with the Solana Virtual Machine (SVM); native token XNT.',
    },
    {
      '@type': meta.page === 'Learn' || meta.page === 'ApiDocs' ? 'TechArticle' : 'WebPage',
      '@id': `${meta.canonical}#webpage`, url: meta.canonical, name: meta.title, description: meta.description,
      isPartOf: site, about: { '@id': `${SITE_ORIGIN}/#x1` }, inLanguage: 'en',
      ...(meta.page === 'Learn' ? { headline: 'How to use an X1 blockchain explorer', author: { '@id': ORG_ID }, publisher: { '@id': ORG_ID }, datePublished: '2026-11-20', dateModified: '2026-11-20' } : {}),
    },
  ];
  if (meta.page === 'Dashboard') {
    graph.push({
      '@type': 'WebApplication', '@id': `${SITE_ORIGIN}/#app`, name: 'X1 Space', url: `${SITE_ORIGIN}/`,
      applicationCategory: 'DeveloperApplication', operatingSystem: 'Any (web browser)', isAccessibleForFree: true,
      description: 'Blockchain explorer for X1 mainnet: blocks, transactions, validators, tokens, liquidity pools and network health.',
      publisher: { '@id': ORG_ID },
    });
  } else {
    const crumbs = [{ name: 'X1 Space', item: `${SITE_ORIGIN}/` }];
    if (meta.page === 'ValidatorDetail') crumbs.push({ name: 'Validators', item: `${SITE_ORIGIN}/Validators` });
    crumbs.push({ name: meta.title.replace(` | ${SUFFIX}`, ''), item: meta.canonical });
    graph.push({ '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, ...c })) });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

/** JSON for a script element; "<" is escaped so no value can close the element. */
export const serializeJsonLd = (data) => JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

function setTag(selector, create, apply) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  apply(el);
  return el;
}

const metaTag = (attr, key, value) => setTag(`meta[${attr}="${key}"]`, () => { const m = document.createElement('meta'); m.setAttribute(attr, key); return m; }, (el) => { el.setAttribute('content', value); });

export function applyMeta(meta) {
  const { title, canonical, robots, description } = meta;
  document.title = title;
  metaTag('name', 'robots', robots);
  if (description) {
    metaTag('name', 'description', description);
    metaTag('property', 'og:description', description);
    metaTag('name', 'twitter:description', description);
  }
  metaTag('property', 'og:title', title);
  metaTag('name', 'twitter:title', title);
  const existing = document.head.querySelector('link[rel="canonical"]');
  if (canonical) {
    setTag('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), (el) => { el.href = canonical; });
    metaTag('property', 'og:url', canonical);
    metaTag('name', 'twitter:url', canonical);
  } else if (existing) {
    existing.remove();
  }
  // Replace the platform-injected generic JSON-LD with an accurate per-page graph.
  document.head.querySelectorAll('script[type="application/ld+json"][data-seo-source="builder"]').forEach((n) => n.remove());
  const data = structuredData(meta);
  const ld = document.head.querySelector('script#x1space-ld');
  if (data) {
    setTag('script#x1space-ld', () => Object.assign(document.createElement('script'), { id: 'x1space-ld', type: 'application/ld+json' }), (el) => { el.textContent = serializeJsonLd(data); });
  } else if (ld) {
    ld.remove();
  }
}

// Page-level refinements (e.g. a validator's name, or noindex when an entity is missing). React runs
// child effects before the Layout's, so overrides are stored and merged whenever route meta is applied.
const overrides = new Map();
let currentKey = '';

/** Keep the title, description, canonical, robots and JSON-LD in step with the current route. */
export default function usePageMeta(known = true) {
  const { pathname, search } = useLocation();
  useEffect(() => {
    currentKey = pathname + search;
    applyMeta({ ...metaFor(pathname, known, search), ...(overrides.get(currentKey) || {}) });
  }, [pathname, search, known]);
}

/**
 * Refine metadata from a page once its data has loaded. Pass null fields to keep route defaults.
 * @param {{ title?: string|null, description?: string|null, robots?: string|null } | null} override
 */
export function useEntityMeta(override) {
  const { pathname, search } = useLocation();
  const json = JSON.stringify(override || {});
  useEffect(() => {
    const key = pathname + search;
    const clean = Object.fromEntries(Object.entries(JSON.parse(json)).filter(([, v]) => v));
    overrides.set(key, clean);
    if (key === currentKey || !currentKey) applyMeta({ ...metaFor(pathname, true, search), ...clean });
    return () => { overrides.delete(key); };
  }, [pathname, search, json]);
}
