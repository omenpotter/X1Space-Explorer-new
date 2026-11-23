import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, X } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { rpcCall } from '@/lib/x1/rpcClient';
import { classifyQuery } from '@/lib/x1/search';
import { integer } from '@/lib/format';
import { NAV_GROUPS, PARENT_PAGE } from './nav';

/** @param {{ className?: any, [key: string]: any }} props */
function Brand({ className }) {
  return (
    <Link to={createPageUrl('Dashboard')} className={cn('flex items-center gap-2.5 rounded-md', className)} aria-label="X1 Space home">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-sky-600 font-display text-[13px] font-bold text-brand-ink shadow-[0_0_0_1px_hsl(var(--brand)/0.35)]">X1</span>
      <span className="font-display text-[17px] font-semibold tracking-tight text-ink">
        X1<span className="text-brand">Space</span>
      </span>
    </Link>
  );
}

/** @param {{ current?: any, onNavigate?: any, [key: string]: any }} props */
function NavList({ current, onNavigate }) {
  const active = PARENT_PAGE[current] ?? current;
  return (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mt-5 first:mt-2">
          <p className="eyebrow px-3 pb-1.5">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = item.page === active;
              return (
                <li key={item.page}>
                  <Link
                    to={createPageUrl(item.page)}
                    onClick={onNavigate}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                      isActive ? 'bg-brand/10 text-brand' : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-brand' : 'text-ink-faint group-hover:text-ink-soft')} aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Live chain status from the RPC. Shows a clear offline state instead of a stale number. */
function NetworkStatus() {
  const [state, setState] = useState(/** @type {Record<string, any>} */ ({ status: 'loading' }));
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.hidden) return;
      try {
        const e = await rpcCall('getEpochInfo', [], 'epochInfo:shell', 'short');
        if (alive) setState({ status: 'ok', slot: e.absoluteSlot, epoch: e.epoch });
      } catch {
        if (alive) setState({ status: 'down' });
      }
    };
    load();
    const id = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  const ok = state.status === 'ok';
  return (
    <div role="status" aria-live="off" className="hidden items-center gap-2 rounded-full border border-line bg-surface-1 px-3 py-1.5 text-xs sm:flex" title="Live from the X1 mainnet RPC">
      <span className={cn('h-2 w-2 rounded-full', ok ? 'bg-positive' : state.status === 'down' ? 'bg-negative' : 'bg-ink-faint')} aria-hidden="true" />
      {ok ? (
        <span className="text-ink-muted">
          <span className="hidden lg:inline">Mainnet · </span>Slot <span className="mono text-ink">{integer(state.slot)}</span>
          <span className="hidden md:inline"> · Epoch <span className="mono text-ink">{state.epoch}</span></span>
        </span>
      ) : (
        <span className={state.status === 'down' ? 'text-negative' : 'text-ink-muted'}>{state.status === 'down' ? 'RPC unreachable' : 'Connecting…'}</span>
      )}
    </div>
  );
}

function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const options = classifyQuery(query);

  // "/" focuses the search box from anywhere, as on most explorers.
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (opt) => {
    if (!opt) return;
    navigate(opt.to);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(options[active] || options[0]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showList = open && options.length > 0;
  return (
    <div className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls="global-search-options"
        aria-autocomplete="list"
        aria-label="Search by address, transaction signature, block slot, token or validator"
        placeholder="Search address, signature, slot, token…"
        value={query}
        maxLength={100}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        className="h-9 w-full rounded-lg border border-line bg-surface-1 pl-9 pr-9 text-sm text-ink placeholder:text-ink-faint focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/25"
      />
      {query ? (
        <button type="button" aria-label="Clear search" onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint hover:text-ink">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line-strong px-1.5 text-[10px] text-ink-faint md:block" aria-hidden="true">/</kbd>
      )}
      {showList && (
        <ul id="global-search-options" role="listbox" className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-lg border border-line-strong bg-surface-2 py-1 shadow-2xl">
          {options.map((opt, i) => (
            <li key={opt.type} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(opt)}
                onMouseEnter={() => setActive(i)}
                className={cn('flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm', i === active ? 'bg-surface-3 text-ink' : 'text-ink-soft')}
              >
                <span className="truncate">{opt.label}</span>
                <span className="eyebrow shrink-0">{opt.type.replace('-search', '')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-10 border-t border-line">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-5 text-xs text-ink-faint sm:px-6">
        <p>
          <span className="font-display font-semibold text-ink-soft">X1<span className="text-brand">Space</span></span>
          <span className="ml-2">© 2025–2026 · Independent explorer for X1 mainnet. Data from the X1 RPC, XDEX and on-chain accounts.</span>
        </p>
        <nav aria-label="Guides, project and X1 ecosystem" className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link to={createPageUrl('Learn')} className="hover:text-ink">Explorer guide</Link>
          <a href="https://x1-leader-slot-checker.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:text-ink">Leader schedules ↗</a>
          <a href="https://x1nexus.xyz/" target="_blank" rel="noopener noreferrer" className="hover:text-ink">X1 Nexus launches ↗</a>
          <Link to="/About" className="hover:text-ink">About</Link>
          <Link to="/Contact" className="hover:text-ink">Contact</Link>
          <span>An ARKBS Labs project</span>
        </nav>
        <div className="flex items-center gap-1">
          <a href="https://x.com/rkbehelvi" target="_blank" rel="noopener noreferrer" aria-label="X1 Space on X" className="rounded p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
          </a>
          <a href="https://t.me/+HtiLywX2Dug3MjJk" target="_blank" rel="noopener noreferrer" aria-label="X1 Space on Telegram" className="rounded p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" /></svg>
          </a>
        </div>
      </div>
    </footer>
  );
}

/** @param {{ children?: any, currentPageName?: any, [key: string]: any }} props */
export default function AppShell({ children, currentPageName }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef(null);

  // On navigation: close the drawer, return to the top and move focus to the content for keyboard users.
  useEffect(() => {
    setDrawerOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a href="#main" className="skip-link">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface-1/80 backdrop-blur lg:flex">
        <div className="flex h-14 items-center px-5">
          <Brand />
        </div>
        <NavList current={currentPageName} />
      </aside>

      <div className="lg:pl-60">
        <div className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <button type="button" aria-label="Open navigation" className="-ml-1 rounded-md p-2 text-ink-muted hover:bg-surface-2 hover:text-ink lg:hidden">
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col border-line bg-surface-1 p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex h-14 items-center px-5">
                  <Brand />
                </div>
                <NavList current={currentPageName} onNavigate={() => setDrawerOpen(false)} />
              </SheetContent>
            </Sheet>
            <Brand className="lg:hidden [&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
            <div className="flex flex-1 justify-center">
              <GlobalSearch />
            </div>
            <NetworkStatus />
          </div>
        </div>

        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto min-h-[100svh] max-w-[1600px] px-4 py-6 outline-none sm:px-6 sm:py-8">
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}
