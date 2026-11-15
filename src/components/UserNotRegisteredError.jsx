import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { createPageUrl } from '@/utils';

// Rendered outside the application shell, so it carries its own full-height layout.
export default function UserNotRegisteredError() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10 text-ink">
      <div className="panel w-full max-w-md p-6 text-center sm:p-8">
        <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border border-warning/30 bg-warning/10 text-warning">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="font-display text-2xl font-semibold text-ink">Access restricted</h1>
        <p className="mt-3 text-sm text-ink-muted">
          This account is not registered to use this application. Contact the app administrator to request access.
        </p>
        <div className="mt-6 rounded-lg border border-line bg-surface-2 p-4 text-left text-sm text-ink-soft">
          <p>If you believe this is a mistake:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Check that you are signed in with the correct account</li>
            <li>Sign out and sign in again</li>
            <li>Ask the app administrator for access</li>
          </ul>
        </div>
        <a href={createPageUrl('Dashboard')} className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-strong">
          Back to dashboard
        </a>
      </div>
    </main>
  );
}
