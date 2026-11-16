import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Boxes } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Panel } from '@/components/ds/Primitives';
import { EmptyState, ErrorState, TableSkeleton, Unavailable } from '@/components/ds/States';
import { CompositionBar, TxTypeLegend, txBreakdown } from '@/components/x1/MempoolViz';
import { integer, shortAddress, timeAgo } from '@/lib/format';

/**
 * Table of confirmed blocks (summaries from X1Rpc.getRecentBlocks).
 * `status` is 'loading' | 'ready' | 'error'; with data present an error never hides the rows.
 */
const RecentBlocksTable = memo(/** @param {{ blocks?: any, status?: any, error?: any, onRetry?: any, limit?: any, title?: any, description?: any, showViewAll?: any, className?: any, [key: string]: any }} props */ function RecentBlocksTable({
  blocks,
  status = 'ready',
  error,
  onRetry,
  limit = 6,
  title = 'Recent blocks',
  description = 'Latest confirmed blocks with their transaction mix.',
  showViewAll = true,
  className,
}) {
  const rows = (blocks || []).slice(0, limit);
  return (
    <Panel
      className={className}
      title={title}
      description={description}
      actions={
        showViewAll ? (
          <Link to={createPageUrl('Blocks')} className="inline-flex items-center gap-1 rounded text-xs font-medium text-brand hover:underline">
            All blocks
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        ) : undefined
      }
    >
      {rows.length === 0 && status === 'loading' && <TableSkeleton rows={Math.min(limit, 6)} columns={4} />}
      {rows.length === 0 && status === 'error' && <ErrorState title="Blocks are unavailable" description={error} onRetry={onRetry} />}
      {rows.length === 0 && status === 'ready' && (
        <EmptyState icon={Boxes} title="No blocks returned" description="The RPC returned no block data for the most recent slots. They may have been skipped." />
      )}
      {rows.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="data-table [&_td]:!px-3 [&_th]:!px-3 2xl:[&_td]:!px-4 2xl:[&_th]:!px-4">
              <caption className="sr-only">{title}</caption>
              <thead>
                <tr>
                  <th scope="col">Slot</th>
                  <th scope="col" className="hidden 2xl:table-cell">Block hash</th>
                  <th scope="col" className="text-right">Transactions</th>
                  <th scope="col" className="hidden sm:table-cell">Vote / system / other</th>
                  <th scope="col" className="text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((block) => {
                  const b = txBreakdown(block);
                  return (
                    <tr key={block.slot}>
                      <td>
                        <Link to={`${createPageUrl('BlockDetail')}?slot=${block.slot}`} className="mono text-brand hover:underline">
                          {integer(block.slot)}
                        </Link>
                      </td>
                      <td className="hidden 2xl:table-cell">
                        <span className="mono text-ink-muted" title={block.blockhash || undefined}>{shortAddress(block.blockhash, 8, 8)}</span>
                      </td>
                      <td className="text-right tabular text-ink">{b ? integer(b.total) : <Unavailable reason="Transaction count not returned" />}</td>
                      <td className="hidden sm:table-cell">
                        {b ? (
                          <div className="flex items-center gap-2">
                            <CompositionBar breakdown={b} className="hidden w-24 shrink-0 2xl:flex" />
                            <span className="whitespace-nowrap text-xs tabular text-ink-muted">
                              {integer(b.vote)} / {integer(b.system)} / {integer(b.program + b.other)}
                            </span>
                          </div>
                        ) : (
                          <Unavailable />
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right text-ink-muted">
                        {block.blockTime ? (
                          <time dateTime={new Date(block.blockTime * 1000).toISOString()} title={new Date(block.blockTime * 1000).toLocaleString()}>
                            {timeAgo(block.blockTime * 1000)}
                          </time>
                        ) : (
                          <Unavailable reason="Block time not reported by the RPC" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TxTypeLegend className="hidden px-4 py-3 md:flex" />
        </>
      )}
    </Panel>
  );
});

export default RecentBlocksTable;
