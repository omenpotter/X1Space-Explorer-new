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
  NetworkHealth: 'Network Health',
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
  TokenExplorer: 'Token Explorer',
  LPExplorer: 'Liquidity Pools',
  WhaleWatcher: 'Whale Watcher',
  PortfolioTracker: 'Portfolio Tracker',
  Watchlist: 'Watchlist',
  CustomDashboard: 'Custom Dashboard',
  ApiDocs: 'API Documentation',
  Search: 'Search',
  OAuthConsent: 'Authorize',
};

/** Pages that should stay out of search results: personal, transient, or an unbounded space of entity URLs. */
export const NOINDEX = new Set([
  'OAuthConsent', 'CustomDashboard', 'PortfolioTracker', 'Watchlist', 'Search', 'ValidatorAlerts',
  'AddressLookup', 'TransactionDetail', 'TransactionFlowPage', 'BlockDetail', 'ValidatorCompare',
]);

/** @returns {{ title: string, canonical: string, robots: string }} */
export function metaFor(pathname, known = true) {
  const name = pathname.replace(/^\/+|\/+$/g, '');
  const home = name === '' || name === 'Dashboard' || name === 'Home';
  const page = home ? 'Dashboard' : name;
  if (!known || !(page in PAGE_TITLES)) {
    return { title: `Page not found | ${SUFFIX}`, canonical: '', robots: 'noindex, nofollow' };
  }
  return {
    title: home ? `${PAGE_TITLES.Dashboard} | ${SUFFIX} — X1 Blockchain Explorer` : `${PAGE_TITLES[page]} | ${SUFFIX}`,
    canonical: `${SITE_ORIGIN}${home ? '/' : `/${page}`}`,
    robots: NOINDEX.has(page) ? 'noindex, follow' : 'index, follow',
  };
}

function setTag(selector, create, apply) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  apply(el);
  return el;
}

export function applyMeta({ title, canonical, robots }) {
  document.title = title;
  setTag('meta[name="robots"]', () => Object.assign(document.createElement('meta'), { name: 'robots' }), (el) => { el.content = robots; });
  const existing = document.head.querySelector('link[rel="canonical"]');
  if (canonical) {
    setTag('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), (el) => { el.href = canonical; });
  } else if (existing) {
    existing.remove();
  }
}

/** Keep the title, canonical link and robots directive in step with the current route. */
export default function usePageMeta(known = true) {
  const { pathname } = useLocation();
  useEffect(() => { applyMeta(metaFor(pathname, known)); }, [pathname, known]);
}
