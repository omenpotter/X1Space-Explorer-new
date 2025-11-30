import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Small transaction block for mempool visualization
const TxBlock = ({ type, size = 'sm' }) => {
  const colors = {
    vote: 'bg-purple-500',
    transfer: 'bg-emerald-500',
    token: 'bg-yellow-500',
    other: 'bg-orange-500' // Changed from blue to orange for better visibility
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
};

// Mempool-style aggregated view with many small boxes
export const MempoolAggregatedViz = ({ data, label, onClick }) => {
  const { totalTxns, voteCount, transferCount, programCount, slots, timestamp } = data;
  
  // Generate grid of small blocks based on tx type ratios - fill the box fully
  const blocks = useMemo(() => {
    const result = [];
    const total = 120; // Fixed count to fill box nicely
    
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
    
    // Shuffle for visual variety
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    
    return result;
  }, [totalTxns, voteCount, transferCount, programCount]);

  return (
    <div 
      className="relative w-[140px] h-[180px] md:w-[160px] md:h-[200px] bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-white/10 rounded-lg overflow-hidden cursor-pointer hover:border-cyan-500/50 transition-all"
      onClick={onClick}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 px-2 py-1 bg-black/40 flex items-center justify-between">
        <span className="text-cyan-400 font-bold text-sm">{label}</span>
        <span className="text-gray-500 text-[9px]">{slots?.toLocaleString()} slots</span>
      </div>
      
      {/* Mempool grid */}
      <div className="absolute top-8 left-2 right-2 bottom-16 flex flex-wrap gap-[2px] content-start overflow-hidden">
        {blocks.map((type, i) => (
          <TxBlock key={i} type={type} size="sm" />
        ))}
      </div>
      
      {/* Footer stats */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2">
        <p className="text-white font-bold text-lg">{totalTxns?.toLocaleString()}</p>
        <div className="flex flex-wrap gap-1 text-[8px]">
          <span className="text-purple-400">{voteCount?.toLocaleString()}</span>
          <span className="text-emerald-400">{transferCount?.toLocaleString()}</span>
          <span className="text-yellow-400">{programCount?.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};

// Mempool-style block view with small tx boxes
export const MempoolBlockViz = ({ block, isNew }) => {
  const { slot, txCount, voteCount, transferCount, programCount, otherCount, blockTime } = block || {};
  
  // Generate grid of small blocks - fill the box fully
  const blocks = useMemo(() => {
    if (!txCount) return [];
    const result = [];
    const total = 80; // Fixed count to fill box nicely
    
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
    
    // Shuffle
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
        relative w-[120px] h-[160px] md:w-[140px] md:h-[180px]
        bg-gradient-to-b from-purple-900/30 to-slate-900/50
        border border-white/10 rounded-lg overflow-hidden cursor-pointer
        hover:border-cyan-500/50 transition-all
        ${isNew ? 'ring-2 ring-cyan-500/50 animate-pulse' : ''}
      `}>
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 px-2 py-1 bg-black/40 flex items-center justify-between">
          <span className="text-cyan-400 font-mono text-[10px]">#{slot?.toLocaleString()}</span>
          <span className="text-gray-500 text-[9px]">{formatTimeAgo(blockTime)}</span>
        </div>
        
        {/* Mempool grid */}
        <div className="absolute top-7 left-1.5 right-1.5 bottom-14 flex flex-wrap gap-[1px] content-start overflow-hidden">
          {blocks.map((type, i) => (
            <TxBlock key={i} type={type} size="xs" />
          ))}
        </div>
        
        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1.5">
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
};

// Legend for mempool colors
export const MempoolLegend = () => (
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
);

export default { MempoolAggregatedViz, MempoolBlockViz, MempoolLegend };