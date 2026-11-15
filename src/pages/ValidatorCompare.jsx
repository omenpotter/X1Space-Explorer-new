import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Scale, Search, SearchX, Server } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { Freshness, Panel } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from '@/components/ds/States';
import { Button } from '@/components/ui/button';
import ValidatorCompare from '@/components/validators/ValidatorCompare';
import { StatusPill, ValidatorIdentity, matchesValidator, useValidators } from '@/components/validators/ValidatorCard';
import { X1_CONFIG } from '@/lib/x1/config';
import { compact, integer } from '@/lib/format';
import { createPageUrl } from '@/utils';

const MIN = 2;
const MAX = 4;
const outlineBtn = 'border-line-strong bg-transparent text-ink-soft hover:bg-surface-3 hover:text-ink';

export default function ValidatorComparePage() {
  const [params, setParams] = useSearchParams();
  const { status, validators, epoch, error, loadedAt, refreshFailed, refreshing, reload } = useValidators(X1_CONFIG.polling.validatorsMs);
  const [query, setQuery] = useState('');

  const ids = useMemo(() => {
    const raw = (params.get('ids') || '').split(',').map((s) => s.trim()).filter(Boolean);
    return [...new Set(raw)].slice(0, MAX);
  }, [params]);

  const setIds = (next) => {
    const p = new URLSearchParams(params);
    if (next.length) p.set('ids', next.join(','));
    else p.delete('ids');
    setParams(p, { replace: true });
  };

  const byId = useMemo(() => new Map(validators.map((v) => [v.votePubkey, v])), [validators]);
  const selected = useMemo(() => ids.map((id) => byId.get(id)).filter(Boolean), [ids, byId]);
  const unknownIds = status === 'ready' ? ids.filter((id) => !byId.has(id)) : [];

  const results = useMemo(() => {
    const q = query.trim();
    return validators
      .filter((v) => !ids.includes(v.votePubkey) && matchesValidator(v, q))
      .slice(0, q ? 12 : 8);
  }, [validators, ids, query]);

  const full = ids.length >= MAX;

  return (
    <>
      <PageHeader
        icon={Scale}
        title="Compare validators"
        description={`Select ${MIN} to ${MAX} validators to compare their stake, commission and measured performance side by side.`}
        meta={<Freshness at={loadedAt} stale={refreshFailed} source="X1 RPC" onRefresh={() => reload(true)} refreshing={refreshing} />}
        back={{ label: 'Validators', to: createPageUrl('Validators') }}
      />

      {status === 'loading' && (
        <div role="status" aria-label="Loading validators">
          <Skeleton className="mb-6 h-40 w-full rounded-xl" />
          <Panel><TableSkeleton rows={6} columns={4} /></Panel>
        </div>
      )}

      {status === 'error' && (
        <Panel><ErrorState title="Validator data is unavailable" description={error} onRetry={() => reload()} /></Panel>
      )}

      {status === 'ready' && (
        <div className="space-y-6">
          <Panel
            title={`Selected (${selected.length} of ${MAX})`}
            description={full ? 'Maximum reached. Remove one to add another.' : 'Search by name, vote address or identity address.'}
          >
            <div className="p-4">
              {unknownIds.length > 0 && (
                <p role="alert" className="mb-3 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-warning">
                  {unknownIds.length === 1 ? 'One address in the link is' : `${unknownIds.length} addresses in the link are`} not a known vote account and was ignored.
                  <Button type="button" variant="link" size="sm" className="h-auto px-2 py-0 text-warning underline" onClick={() => setIds(selected.map((v) => v.votePubkey))}>Remove</Button>
                </p>
              )}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={full}
                  placeholder={full ? 'Remove a validator to add another' : 'Name, vote address or identity address'}
                  aria-label="Search validators to compare"
                  className="h-9 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:opacity-60"
                />
              </div>
              {!full && (
                results.length === 0 ? (
                  <EmptyState icon={SearchX} title="No validators match" description="Try a different name or address." className="py-8" />
                ) : (
                  <ul className="mt-3 divide-y divide-line/60 rounded-lg border border-line" aria-label="Validators you can add">
                    {results.map((v) => (
                      <li key={v.votePubkey} className="flex items-center justify-between gap-3 px-3 py-2">
                        <ValidatorIdentity validator={v} size={28} sub={<span className="tabular">{compact(v.activatedStake)} XNT staked</span>} />
                        <span className="flex shrink-0 items-center gap-2">
                          <StatusPill validator={v} className="hidden sm:inline-flex" />
                          <Button type="button" size="sm" variant="outline" className={outlineBtn} onClick={() => { setIds([...ids, v.votePubkey]); setQuery(''); }} aria-label={`Add ${v.name || v.votePubkey} to comparison`}>
                            <Plus className="mr-1 h-4 w-4" aria-hidden="true" />Add
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          </Panel>

          {selected.length >= MIN ? (
            <ValidatorCompare validators={selected} epoch={epoch} onRemove={(id) => setIds(ids.filter((x) => x !== id))} />
          ) : (
            <Panel>
              <EmptyState
                icon={Scale}
                title={selected.length === 0 ? 'Nothing to compare yet' : 'Add one more validator'}
                description={`Pick at least ${MIN} validators above. The selection is kept in the page link so you can share it.`}
                action={<Button asChild variant="outline" size="sm" className={outlineBtn}><Link to={createPageUrl('Validators')}><Server className="mr-2 h-4 w-4" aria-hidden="true" />Browse all {integer(validators.length)} validators</Link></Button>}
              />
              {selected.length === 1 && (
                <div className="border-t border-line px-4 py-3">
                  <ValidatorIdentity validator={selected[0]} />
                </div>
              )}
            </Panel>
          )}
        </div>
      )}
    </>
  );
}
