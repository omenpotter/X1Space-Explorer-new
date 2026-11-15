import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { createPageUrl } from '@/utils';

// Rendered outside the application shell, so it carries its own full-height layout.
export default function PageNotFound() {
  const { pathname } = useLocation();
  // The path is user-controlled: shown as plain text, shortened so it cannot break the layout.
  const shown = pathname.length > 80 ? `${pathname.slice(0, 80)}…` : pathname;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10 text-ink">
      <div className="panel w-full max-w-md p-6 text-center sm:p-8">
        <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-muted">
          <Compass className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink">Page not found</h1>
        <p className="mt-3 text-sm text-ink-muted">
          There is no page at <span className="mono break-all text-ink-soft">{shown}</span>. The link may be outdated or mistyped.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link to={createPageUrl('Dashboard')} className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-strong">
            Back to dashboard
          </Link>
          <Link to={createPageUrl('Search')} className="inline-flex items-center justify-center rounded-lg border border-line-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-3">
            Search the explorer
          </Link>
        </div>
      </div>
    </main>
  );
}
