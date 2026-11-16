import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * Standard page heading: optional back link, title, description, status slot and actions.
 * Every routed page renders exactly one of these (and so exactly one <h1>).
 */
/** @param {{ title?: any, description?: any, icon?: any, back?: any, badge?: any, meta?: any, actions?: any, className?: any, [key: string]: any }} props */
export default function PageHeader({ title, description, icon: Icon, back, badge, meta, actions, className }) {
  return (
    <header className={cn('mb-6', className)}>
      {back && (
        <Link to={back.to} className="mb-3 inline-flex items-center gap-1 rounded text-xs font-medium text-ink-muted transition-colors hover:text-ink">
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {Icon && (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand/20 bg-brand/10 text-brand">
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
            )}
            <h1 className="text-2xl font-semibold text-ink sm:text-[28px]">{title}</h1>
            {badge}
          </div>
          {description && <p className="mt-2 max-w-3xl text-sm text-ink-muted">{description}</p>}
          {meta && <div className="mt-2">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
