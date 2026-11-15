
/** Full-height centred layout for pages that render outside the application shell (sign-in, consent). */
export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10 text-ink">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          {Icon && (
            <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
          )}
          <h1 className="font-display text-2xl font-semibold text-ink sm:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-ink-muted">{subtitle}</p>}
        </div>
        <div className="panel p-6 sm:p-8">{children}</div>
        {footer && <p className="mt-6 text-center text-sm text-ink-muted">{footer}</p>}
      </div>
    </main>
  );
}
