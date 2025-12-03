import React, { useMemo, memo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Optimized to prevent unnecessary re-renders

// Small transaction block for mempool visualization - memoized
const TxBlock = memo(({ type, size = 'sm' }) => {
  const colors = {
    vote: 'bg-purple-500',
    transfer: 'bg-emerald-500',
    token: 'bg-yellow-500',
    other: 'bg-orange-500'
  };
  
  const sizes = {
    xs: 'w-2 h-2',
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3'
  };
  
  return (
    <div 
      className={`${colors[type] || colors.other} ${sizes[size]} rounded-sm opacity-90`}
      title={type}
    />
  );
});

TxBlock.displayName = 'TxBlock';

// Mempool-style aggregated view with many small boxes - memoized
export const MempoolAggregatedViz = memo(({ data, label, onClick, viewMode = '1m' }) => {
  const { totalTxns, voteCount, transferCount, programCount, otherCount, slots } = data || {};
  
  const blocks = useMemo(() => {
    const result = [];
    const total = 80;
    
    // Use safe defaults if data is missing
    const safeVoteCount = voteCount || 0;
    const safeTransferCount = transferCount || 0;
    const safeProgramCount = programCount || 0;
    const safeOtherCount = otherCount || 0;
    
    // Thresholds for showing dots based on view mode
    // 1m: 10 token/program = 1 dot, 5 other = 1 dot
    // 10m: 100 token/program = 1 dot, 50 other = 1 dot
    const programThreshold = viewMode === '10m' ? 100 : 10;
    const otherThreshold = viewMode === '10m' ? 50 : 5;
    const voteThreshold = viewMode === '10m' ? 1000 : 100;
    const transferThreshold = viewMode === '10m' ? 50 : 5;
    
    // Calculate dots based on thresholds
    const voteDots = Math.min(56, Math.max(1, Math.floor(safeVoteCount / voteThreshold)));
    const transferDots = Math.min(12, Math.max(safeTransferCount > 0 ? 1 : 0, Math.floor(safeTransferCount / transferThreshold)));
    const programDots = Math.min(8, Math.max(safeProgramCount > 0 ? 1 : 0, Math.floor(safeProgramCount / programThreshold)));
    const otherDots = Math.min(4, Math.max(safeOtherCount > 0 ? 1 : 0, Math.floor(safeOtherCount / otherThreshold)));
    
    // If we have no transaction data at all, use default distribution
    const totalDots = voteDots + transferDots + programDots + otherDots;
    
    if (totalDots === 0 || (safeVoteCount === 0 && safeTransferCount === 0 && safeProgramCount === 0 && safeOtherCount === 0)) {
      // Default distribution
      for (let i = 0; i < 56; i++) result.push('vote');
      for (let i = 0; i < 12; i++) result.push('transfer');
      for (let i = 0; i < 8; i++) result.push('token');
      for (let i = 0; i < 4; i++) result.push('other');
    } else {
      // Generate colored blocks based on actual counts
      for (let i = 0; i < voteDots; i++) result.push('vote');
      for (let i = 0; i < transferDots; i++) result.push('transfer');
      for (let i = 0; i < programDots; i++) result.push('token');
      for (let i = 0; i < otherDots; i++) result.push('other');
      
      // Fill remaining slots proportionally if under 80
      while (result.length < total) {
        if (safeVoteCount > 0) result.push('vote');
        else if (safeTransferCount > 0) result.push('transfer');
        else result.push('vote');
        if (result.length >= total) break;
      }
    }
    
    // Trim to exactly 80 if over
    while (result.length > total) result.pop();
    
    // Shuffle for visual variety
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    
    return result;
  }, [voteCount, transferCount, programCount, otherCount, viewMode]);

  return (
    <div 
      className="relative flex-1 min-w-[100px] max-w-[160px] h-[140px] bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-white/10 rounded-lg overflow-hidden cursor-pointer hover:border-cyan-500/50 transition-all flex flex-col"
      onClick={onClick}
    >
      <div className="px-2 py-1 bg-black/40 flex items-center justify-between flex-shrink-0">
        <span className="text-cyan-400 font-bold text-xs">{label}</span>
        <span className="text-gray-500 text-[8px]">{slots?.toLocaleString()} slots</span>
      </div>
      
      <div className="flex-1 px-1.5 py-1 flex flex-wrap gap-[1px] content-start overflow-hidden">
        {blocks.map((type, i) => (
          <TxBlock key={i} type={type} size="xs" />
        ))}
      </div>
      
      <div className="bg-black/60 px-2 py-1.5 flex-shrink-0">
        <p className="text-white font-bold text-sm">{totalTxns?.toLocaleString()}</p>
        <div className="flex gap-1 text-[7px]">
          <span className="text-purple-400" title="Votes">{voteCount?.toLocaleString() || 0}</span>
          <span className="text-emerald-400" title="Transfers">{transferCount?.toLocaleString() || 0}</span>
          <span className="text-yellow-400" title="Token/Program">{programCount?.toLocaleString() || 0}</span>
          <span className="text-orange-400" title="Other">{otherCount?.toLocaleString() || 0}</span>
        </div>
      </div>
    </div>
  );
});

MempoolAggregatedViz.displayName = 'MempoolAggregatedViz';

// Mempool-style block view with small tx boxes - memoized
export const MempoolBlockViz = memo(({ block, isNew }) => {
  const { slot, txCount, voteCount, transferCount, programCount, otherCount, blockTime } = block || {};
  
  const blocks = useMemo(() => {
    const result = [];
    const total = 60;
    
    // If we have real transaction counts, use them
    if (txCount && txCount > 0) {
      const voteRatio = (voteCount || 0) / txCount;
      const transferRatio = (transferCount || 0) / txCount;
      const programRatio = ((programCount || 0) + (otherCount || 0)) / txCount;
      
      const voteBlocks = Math.round(total * voteRatio);
      const transferBlocks = Math.round(total * transferRatio);
      const programBlocks = Math.round(total * programRatio);
      const otherBlocks = Math.max(0, total - voteBlocks - transferBlocks - programBlocks);
      
      for (let i = 0; i < voteBlocks; i++) result.push('vote');
      for (let i = 0; i < transferBlocks; i++) result.push('transfer');
      for (let i = 0; i < programBlocks; i++) result.push('token');
      for (let i = 0; i < otherBlocks; i++) result.push('other');
    } else {
      // Default distribution for blocks without tx data - typical X1 ratio
      for (let i = 0; i < 42; i++) result.push('vote');    // ~70%
      for (let i = 0; i < 9; i++) result.push('transfer'); // ~15%
      for (let i = 0; i < 6; i++) result.push('token');    // ~10%
      for (let i = 0; i < 3; i++) result.push('other');    // ~5%
    }
    
    // Shuffle for visual variety
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    
    return result;
  }, [txCount, voteCount, transferCount, programCount, otherCount]);

  const formatTimeAgo = (bt) => {
    if (!bt) return 'now';
    const diff = (Date.now() / 1000) - bt;
    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  };

  return (
    <Link to={createPageUrl('BlockDetail') + `?slot=${slot}`}>
      <div className={`
        relative flex-1 min-w-[100px] max-w-[140px] h-[140px]
        bg-gradient-to-b from-purple-900/30 to-slate-900/50
        border border-white/10 rounded-lg overflow-hidden cursor-pointer
        hover:border-cyan-500/50 transition-all flex flex-col
        ${isNew ? 'ring-2 ring-cyan-500/50 animate-pulse' : ''}
      `}>
        <div className="px-2 py-1 bg-black/40 flex items-center justify-between flex-shrink-0">
          <span className="text-cyan-400 font-mono text-[9px]">#{slot?.toLocaleString()}</span>
          <span className="text-gray-500 text-[8px]">{formatTimeAgo(blockTime)}</span>
        </div>
        
        <div className="flex-1 px-1.5 py-1 flex flex-wrap gap-[1px] content-start overflow-hidden">
          {blocks.map((type, i) => (
            <TxBlock key={i} type={type} size="xs" />
          ))}
        </div>
        
        <div className="bg-black/60 px-2 py-1.5 flex-shrink-0">
          <p className="text-white font-bold text-sm">{txCount?.toLocaleString()}</p>
          <div className="flex gap-1 text-[7px]">
            <span className="text-purple-400">{voteCount || 0}</span>
            <span className="text-emerald-400">{transferCount || 0}</span>
            <span className="text-yellow-400">{(programCount || 0) + (otherCount || 0)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
});

MempoolBlockViz.displayName = 'MempoolBlockViz';

// Legend for mempool colors - memoized
export const MempoolLegend = memo(() => (
  <div className="flex items-center gap-4 text-xs">
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 bg-purple-500 rounded-sm" />
      <span className="text-gray-400">Vote</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
      <span className="text-gray-400">Transfer</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 bg-yellow-500 rounded-sm" />
      <span className="text-gray-400">Token/Program</span>
    </div>
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 bg-orange-500 rounded-sm" />
      <span className="text-gray-400">Other</span>
    </div>
  </div>
));

MempoolLegend.displayName = 'MempoolLegend';

// Pending transactions mini-viz that loops - SAME SIZE as block boxes
const PendingTxViz = memo(({ pendingCount = 0 }) => {
  const [animKey, setAnimKey] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimKey(k => k + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const txTypes = useMemo(() => {
    const types = [];
    const count = Math.min(pendingCount || 20, 60);
    for (let i = 0; i < count; i++) {
      const rand = Math.random();
      if (rand < 0.6) types.push('vote');
      else if (rand < 0.8) types.push('transfer');
      else if (rand < 0.95) types.push('token');
      else types.push('other');
    }
    return types;
  }, [pendingCount, animKey]);

  return (
    <div className="relative flex-1 min-w-[100px] max-w-[140px] h-[140px] bg-gradient-to-b from-cyan-900/30 to-slate-900/50 border border-dashed border-cyan-500/30 rounded-lg overflow-hidden flex flex-col">
      <div className="px-2 py-1 bg-cyan-500/10 flex items-center justify-between flex-shrink-0">
        <span className="text-cyan-400 font-mono text-[9px] animate-pulse">⏳ PENDING</span>
        <span className="text-gray-500 text-[8px]">now</span>
      </div>
      
      <div className="flex-1 px-1.5 py-1 flex flex-wrap gap-[1px] content-start overflow-hidden">
        {txTypes.map((type, i) => (
          <TxBlock key={`${animKey}-${i}`} type={type} size="xs" />
        ))}
      </div>
      
      <div className="bg-cyan-500/10 px-2 py-1.5 flex-shrink-0">
        <p className="text-cyan-400 font-bold text-sm">{pendingCount || '...'}</p>
        <p className="text-gray-500 text-[7px]">pending txs</p>
      </div>
    </div>
  );
});

PendingTxViz.displayName = 'PendingTxViz';

export { PendingTxViz };

// Combined wrapper component for Dashboard
const MempoolViz = memo(({ mempoolInterval, recentBlocks, aggregatedBlocks, dashboardSlot, showPending = true, pendingCount = 0 }) => {
  // Show loading or placeholder for 1m/10m views when no data
  if (mempoolInterval !== 'blocks' && (!aggregatedBlocks || aggregatedBlocks.length === 0)) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto">
        <div className="text-gray-500 py-8 w-full text-center">
          Loading {mempoolInterval} performance data...
        </div>
      </div>
    );
  }
  
  // Show loading for blocks view when no blocks
  if (mempoolInterval === 'blocks' && (!recentBlocks || recentBlocks.length === 0)) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto">
        <div className="text-gray-500 py-8 w-full text-center">
          Loading blocks...
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-2 overflow-x-auto" key={mempoolInterval + '-' + (recentBlocks[0]?.slot || 0)}>
      {showPending && mempoolInterval === 'blocks' && (
        <PendingTxViz pendingCount={pendingCount} />
      )}
      {mempoolInterval === 'blocks' ? (
        recentBlocks.slice(0, showPending ? 9 : 10).map((block, i) => (
          <MempoolBlockViz key={block.slot} block={block} isNew={i === 0} />
        ))
      ) : (
        aggregatedBlocks.map((agg, i) => (
          <MempoolAggregatedViz key={`${mempoolInterval}-${i}-${dashboardSlot}`} data={agg} label={agg.label} viewMode={mempoolInterval} />
        ))
      )}
    </div>
  );
});

MempoolViz.displayName = 'MempoolViz';

export default MempoolViz;