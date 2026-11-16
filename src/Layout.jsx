import AppShell from '@/components/shell/AppShell';
import usePageMeta from '@/lib/pageMeta';

// Pages that render full-screen without the application chrome.
const BARE_PAGES = new Set(['OAuthConsent']);

/** @param {{ children?: any, currentPageName?: any, [key: string]: any }} props */
export default function Layout({ children, currentPageName }) {
  usePageMeta();
  if (BARE_PAGES.has(currentPageName)) return <>{children}</>;
  return <AppShell currentPageName={currentPageName}>{children}</AppShell>;
}
