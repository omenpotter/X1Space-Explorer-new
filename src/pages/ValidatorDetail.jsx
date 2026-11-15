import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bell, ExternalLink, Scale, SearchX, Server } from 'lucide-react';
import PageHeader from '@/components/shell/PageHeader';
import { ValidatorAvatar } from '@/components/ds/Avatar';
import { CopyButton, Freshness, Meter, Panel, StatCard } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, Skeleton, StatSkeleton, Unavailable } from '@/components/ds/States';
import { Button } from '@/components/ui/button';
import PerformanceChart from '@/components/validators/PerformanceChart';
import { SKIP_RATE_HELP, StatusPill, VOTE_RATE_HELP, ValidatorName, isNum, stakeShare, useValidators, websiteHref } from '@/components/validators/ValidatorCard';
import { X1_CONFIG } from '@/lib/x1/config';
import { compact, integer, percent } from '@/lib/format';
import { createPageUrl } from '@/utils';

const outlineBtn = 'border-line-strong bg-transparent text-ink-soft hover:bg-surface-3 hover:text-ink';
const back = { label: 'Validators', to: createPageUrl('Validators') };

/** @param {{ label?: any, value?: any, hint?: any, [key: string]: any }} props */
function AddressRow({ label, value, hint }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1">
        <span className="flex items-center gap-1">
          <span className="mono min-w-0 break-all text-sm text-ink-soft">{value}</span>
          <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} className="shrink-0" />
        </span>
        {hint && <span className="mt-0.5 block text-xs text-ink-faint">{hint}</span>}
      </dd>
    </div>
  );
}

export default function ValidatorDetail() {
  const [params] = useSearchParams();
  const id = (params.get('id') || '').trim();
  const { status, validators, epoch, error, loadedAt, refreshFailed, refreshing, reload } = useValidators(X1_CONFIG.polling.validatorsMs);

  const v = useMemo(() => validators.find((x) => x.votePubkey === id) || null, [validators, id]);
  const rank = useMemo(() => {
    if (!v) return null;
    return [...validators].sort((a, b) => b.activatedStake - a.activatedStake).findIndex((x) => x.votePubkey === v.votePubkey) + 1;
  }, [validators, v]);

  if (status === 'loading') {
    return (
      <>
        <PageHeader icon={Server} title="Validator" back={back} />
        <div role="status" aria-label="Loading validator">
          <Skeleton className="mb-6 h-36 w-full rounded-xl" />
          <StatSkeleton count={8} />
          <Skeleton className="mt-6 h-64 w-full rounded-xl" />
        </div>
      </>
    );
  }

  if (status === 'error') {
    return (
      <>
        <PageHeader icon={Server} title="Validator" back={back} />
        <Panel><ErrorState title="Validator data is unavailable" description={error} onRetry={() => reload()} /></Panel>
      </>
    );
  }

  if (!v) {
    return (
      <>
        <PageHeader icon={Server} title="Validator not found" back={back} />
        <Panel>
          <EmptyState
            icon={SearchX}
            title={id ? 'No validator has this vote address' : 'No validator selected'}
            description={id
              ? 'The address below does not match any current or delinquent vote account returned by the X1 RPC. Check that it is a vote account address, not an identity or wallet address.'
              : 'This page needs a vote account address in the link (?id=…). Choose a validator from the list.'}
            action={
              <div className="flex flex-col items-center gap-3">
                {id && <code className="mono max-w-full break-all rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-soft">{id}</code>}
                <Button asChild variant="outline" size="sm" className={outlineBtn}><Link to={back.to}>Browse validators</Link></Button>
              </div>
            }
          />
        </Panel>
      </>
    );
  }

  const share = stakeShare(v);
  const site = websiteHref(v);
  const loc = v.location;
  const lagTone = !isNum(v.voteLag) ? 'default' : v.voteLag > 150 ? 'negative' : v.voteLag > 32 ? 'warning' : 'default';

  return (
    <>
      <PageHeader
        icon={Server}
        title={<ValidatorName validator={v} />}
        back={back}
        badge={<StatusPill validator={v} />}
        meta={<Freshness at={loadedAt} stale={refreshFailed} source="X1 RPC · on-chain identity" onRefresh={() => reload(true)} refreshing={refreshing} />}
        actions={
          <>
            <Button asChild variant="outline" size="sm" className={outlineBtn}>
              <Link to={createPageUrl('ValidatorCompare')}><Scale className="mr-2 h-4 w-4" aria-hidden="true" />Compare</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className={outlineBtn}>
              <Link to={`${createPageUrl('ValidatorAlerts')}?validator=${encodeURIComponent(v.votePubkey)}`}><Bell className="mr-2 h-4 w-4" aria-hidden="true" />Set alert</Link>
            </Button>
          </>
        }
      />

      <Panel className="mb-6" bodyClassName="p-4 sm:p-5" aria-label="Validator profile">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <ValidatorAvatar validator={v} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <ValidatorName validator={v} className="break-all font-display text-lg font-semibold text-ink" />
              <StatusPill validator={v} />
              {isNum(rank) && rank > 0 && <span className="text-xs text-ink-muted tabular">#{rank} by stake</span>}
            </div>
            {site ? (
              <a href={site} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 text-sm text-brand hover:underline">
                <span className="truncate">{site.replace(/^https?:\/\//i, '').replace(/\/$/, '')}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : (
              <p className="mt-1 text-sm text-ink-faint">No website published</p>
            )}
            {v.details && <p className="mt-2 max-w-3xl whitespace-pre-line break-words text-sm text-ink-soft">{v.details}</p>}

            <dl className="mt-4 grid gap-4 md:grid-cols-2">
              <AddressRow label="Vote address" value={v.votePubkey} hint="Stake is delegated to this account." />
              <AddressRow label="Identity address" value={v.nodePubkey} hint="The node key that signs blocks and votes." />
            </dl>

            <p className="mt-4 text-xs text-ink-faint">
              {v.hasIdentity
                ? 'Name, website, description and icon are self-published by the operator on chain. They are shown as published and are not verified.'
                : 'This operator has not published an on-chain identity, so a shortened address and a generated avatar are shown instead of a name and icon.'}
            </p>
          </div>
        </div>
      </Panel>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Stake" value={`${compact(v.activatedStake)} XNT`} hint={isNum(v.activatedStake) ? `${integer(v.activatedStake)} XNT active` : undefined} tone="brand" />
        <div className="panel p-4">
          <p className="eyebrow">Stake share</p>
          <p className="mt-2 font-display text-2xl font-semibold tabular leading-none text-ink">{share === null ? <Unavailable reason="Stake share unknown" /> : percent(share, 2)}</p>
          <Meter value={share ?? 0} max={100} label="Share of total network stake" className="mt-3" />
          <p className="mt-2 text-xs text-ink-muted">Of all active stake</p>
        </div>
        <StatCard label="Commission" value={isNum(v.commission) ? `${v.commission}%` : <Unavailable reason="Commission not reported" />} hint="Share of staking rewards kept by the operator" />
        <StatCard
          label="Vote rate"
          value={isNum(v.voteRate) ? percent(v.voteRate, 2) : <Unavailable reason="Vote rate cannot be measured yet this epoch" />}
          hint="Share of the maximum vote credits earned this epoch"
          tone={!isNum(v.voteRate) ? 'default' : v.voteRate >= 95 ? 'positive' : v.voteRate >= 80 ? 'warning' : 'negative'}
        />
        <StatCard
          label="Skip rate"
          value={isNum(v.skipRate) ? percent(v.skipRate, 2) : <Unavailable reason="No leader slots yet this epoch" />}
          hint={isNum(v.skipRate) && isNum(v.leaderSlots) && isNum(v.blocksProduced)
            ? `${integer(v.blocksProduced)} blocks in ${integer(v.leaderSlots)} leader slots this epoch`
            : 'No leader slots yet this epoch'}
          tone={!isNum(v.skipRate) ? 'default' : v.skipRate < 5 ? 'default' : v.skipRate < 15 ? 'warning' : 'negative'}
        />
        <StatCard
          label="Last vote"
          value={isNum(v.lastVote) ? integer(v.lastVote) : <Unavailable reason="No vote recorded" />}
          hint={isNum(v.voteLag) ? `${integer(Math.max(0, v.voteLag))} slot${v.voteLag === 1 ? '' : 's'} behind the tip · root ${integer(v.rootSlot)}` : 'Vote lag unknown'}
          tone={lagTone}
        />
        <StatCard label="Version" value={v.version ? <span className="mono text-xl">{v.version}</span> : <Unavailable reason="Node is not visible in gossip, so its software version is unknown" />} hint={v.version ? 'Reported in gossip' : 'Node not visible in gossip'} />
        <StatCard
          label="Location"
          value={loc ? <span className="text-xl">{loc.country || 'Unknown country'}</span> : <span className="text-xl text-ink-muted">Not located</span>}
          hint={loc ? (loc.precision === 'city' ? 'City-level position (approximate)' : 'Country-level only') : 'The node address could not be resolved to a location'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Epoch credits history" description="Vote credits earned in each recent epoch. This is the only per-validator history the RPC provides." bodyClassName="p-4">
          <PerformanceChart epochCredits={v.epochCredits} currentEpoch={epoch} />
        </Panel>

        <Panel title="Vote credits" description={isNum(epoch) ? `Current epoch: ${integer(epoch)}` : undefined} bodyClassName="p-4">
          <dl className="space-y-4">
            <div>
              <dt className="eyebrow">This epoch so far</dt>
              <dd className="mt-1 font-display text-xl font-semibold tabular text-ink">{integer(v.creditsThisEpoch)}</dd>
            </div>
            <div>
              <dt className="eyebrow">Previous epoch</dt>
              <dd className="mt-1 font-display text-xl font-semibold tabular text-ink">{isNum(v.creditsPrevEpoch) ? integer(v.creditsPrevEpoch) : <Unavailable reason="No earlier epoch in the vote account history" />}</dd>
            </div>
            <div>
              <dt className="eyebrow">Lifetime total</dt>
              <dd className="mt-1 font-display text-xl font-semibold tabular text-ink">{integer(v.credits)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-ink-faint">{VOTE_RATE_HELP} {SKIP_RATE_HELP}</p>
        </Panel>
      </div>

      <p className="mt-4 text-xs text-ink-faint">
        Stake, commission, uptime-style history and reward history over longer periods are not available from the RPC and are not shown. No values on this page are estimated.
      </p>
    </>
  );
}
