import React, { useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

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
export const MempoolAggregatedViz = memo(({ data, label, onClick }) => {
  const { totalTxns, voteCount, transferCount, programCount, slots } = data;
  
  const blocks = useMemo(() => {
    const result = [];
    const total = 80;
    
    const voteRatio = voteCount / (totalTxns || 1);
    const transferRatio = transferCount / (totalTxns || 1);
    const programRatio = programCount / (totalTxns || 1);
    
    const voteBlocks = Math.round(total * voteRatio);
    const transferBlocks = Math.round(total * transferRatio);
    const programBlocks = Math.round(total * programRatio);
    const otherBlocks = Math.max(0, total - voteBlocks - transferBlocks - programBlocks);
    
    for (let i = 0; i < voteBlocks; i++) result.push('vote');
    for (let i = 0; i < transferBlocks; i++) result.push('transfer');
    for (let i = 0; i < programBlocks; i++) result.push('token');
    for (let i = 0; i < otherBlocks; i++) result.push('other');
    
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    
    return result;
  }, [totalTxns, voteCount, transferCount, programCount]);

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
          <span className="text-purple-400">{voteCount?.toLocaleString()}</span>
          <span className="text-emerald-400">{transferCount?.toLocaleString()}</span>
          <span className="text-yellow-400">{programCount?.toLocaleString()}</span>
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
    if (!txCount) return [];
    const result = [];
    const total = 60;
    
    const voteRatio = (voteCount || 0) / (txCount || 1);
    const transferRatio = (transferCount || 0) / (txCount || 1);
    const programRatio = ((programCount || 0) + (otherCount || 0)) / (txCount || 1);
    
    const voteBlocks = Math.round(total * voteRatio);
    const transferBlocks = Math.round(total * transferRatio);
    const programBlocks = Math.round(total * programRatio);
    const otherBlocks = Math.max(0, total - voteBlocks - transferBlocks - programBlocks);
    
    for (let i = 0; i < voteBlocks; i++) result.push('vote');
    for (let i = 0; i < transferBlocks; i++) result.push('transfer');
    for (let i = 0; i < programBlocks; i++) result.push('token');
    for (let i = 0; i < otherBlocks; i++) result.push('other');
    
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

export default { MempoolAggregatedViz, MempoolBlockViz, MempoolLegend };