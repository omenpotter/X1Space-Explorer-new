import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Zap,
  Clock,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const generateMockBlocks = (start, count) => {
  const leaders = [
    { name: 'X1 Labs', icon: 'X1', color: 'cyan' },
    { name: 'StakeSquid', icon: 'SS', color: 'purple' },
    { name: 'Chorus One', icon: 'C1', color: 'blue' },
    { name: 'Everstake', icon: 'ES', color: 'green' },
    { name: 'Figment', icon: 'FG', color: 'orange' },
    { name: 'Unknown', icon: '??', color: 'gray' }
  ];
  
  return Array.from({ length: count }, (_, i) => {
    const slot = start - i;
    const leader = leaders[Math.floor(Math.random() * leaders.length)];
    return {
      slot,
      parent: slot - 1,
      leader,
      time: 300 + Math.floor(Math.random() * 300),
      txCount: 2000 + Math.floor(Math.random() * 2000),
      timestamp: new Date(Date.now() - i * 400).toISOString(),
      hash: `${slot}...${Math.random().toString(36).substring(2, 8)}`,
      feeRange: `${(1 + Math.random()).toFixed(2)} - ${(100 + Math.random() * 300).toFixed(0)}`,
      medianFee: Math.floor(1 + Math.random() * 3),
      totalFees: (0.02 + Math.random() * 0.03).toFixed(3),
      reward: (0.001 + Math.random() * 0.002).toFixed(4)
    };
  });
};

// Block visualization similar to mempool.space
const BlockViz = ({ block, isNew }) => {
  const squares = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    opacity: 0.4 + Math.random() * 0.6
  }));

  const colorClass = {
    cyan: 'from-cyan-500/40 to-cyan-600/20',
    purple: 'from-purple-500/40 to-purple-600/20',
    blue: 'from-blue-500/40 to-blue-600/20',
    green: 'from-green-500/40 to-green-600/20',
    orange: 'from-orange-500/40 to-orange-600/20',
    gray: 'from-gray-500/40 to-gray-600/20'
  }[block.leader.color];

  return (
    <Link to={createPageUrl('BlockDetail') + `?slot=${block.slot}`}>
      <div className={`
        relative w-full h-[200px]
        bg-gradient-to-b ${colorClass}
        border border-white/10 rounded-lg
        overflow-hidden cursor-pointer
        transition-all duration-300
        hover:border-cyan-500/50 hover:scale-[1.01]
        ${isNew ? 'ring-2 ring-cyan-500/50' : ''}
      `}>
        {/* Transaction grid */}
        <div className="absolute inset-2 grid grid-cols-10 gap-[2px]">
          {squares.map((sq) => (
            <div
              key={sq.id}
              className="bg-[#9ACD32] rounded-[1px]"
              style={{ opacity: sq.opacity * 0.7 }}
            />
          ))}
        </div>
        
        {/* Slot number */}
        <div className="absolute top-0 left-0 right-0 text-center py-2">
          <span className="text-cyan-400 font-mono font-bold text-lg">
            {block.slot.toLocaleString()}
          </span>
        </div>
        
        {/* Fee info */}
        <div className="absolute top-10 left-3 right-3">
          <p className="text-xs text-gray-300">~{block.medianFee} sat/vB</p>
          <p className="text-[10px] text-cyan-400/80">{block.feeRange} sat/vB</p>
        </div>
        
        {/* Bottom stats */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/30 p-3">
          <p className="text-white font-bold text-sm">‎{block.totalFees} XNT</p>
          <p className="text-[10px] text-gray-400">{block.txCount.toLocaleString()} transactions</p>
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1">
              <div className={`w-4 h-4 rounded bg-${block.leader.color}-500/30 flex items-center justify-center`}>
                <span className="text-[8px] text-white font-bold">{block.leader.icon}</span>
              </div>
              <span className="text-[10px] text-gray-400">{block.leader.name}</span>
            </div>
            <span className="text-[10px] text-gray-400">{formatTimeAgo(block.timestamp)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

const formatTimeAgo = (timestamp) => {
  const diff = (Date.now() - new Date(timestamp).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
};

export default function Blocks() {
  const [blocks, setBlocks] = useState(generateMockBlocks(11265950, 24));
  const [searchQuery, setSearchQuery] = useState('');
  const [isLive, setIsLive] = useState(true);
  const [newBlockSlot, setNewBlockSlot] = useState(null);

  useEffect(() => {
    if (!isLive) return;
    
    const interval = setInterval(() => {
      setBlocks(prev => {
        const newSlot = prev[0].slot + 1;
        const leaders = [
          { name: 'X1 Labs', icon: 'X1', color: 'cyan' },
          { name: 'StakeSquid', icon: 'SS', color: 'purple' },
          { name: 'Chorus One', icon: 'C1', color: 'blue' }
        ];
        const newBlock = {
          slot: newSlot,
          parent: newSlot - 1,
          leader: leaders[Math.floor(Math.random() * leaders.length)],
          time: 300 + Math.floor(Math.random() * 300),
          txCount: 2000 + Math.floor(Math.random() * 2000),
          timestamp: new Date().toISOString(),
          hash: `${newSlot}...${Math.random().toString(36).substring(2, 8)}`,
          feeRange: `${(1 + Math.random()).toFixed(2)} - ${(100 + Math.random() * 300).toFixed(0)}`,
          medianFee: Math.floor(1 + Math.random() * 3),
          totalFees: (0.02 + Math.random() * 0.03).toFixed(3),
          reward: (0.001 + Math.random() * 0.002).toFixed(4)
        };
        setNewBlockSlot(newSlot);
        setTimeout(() => setNewBlockSlot(null), 1000);
        return [newBlock, ...prev.slice(0, 23)];
      });
    }, 400);
    
    return () => clearInterval(interval);
  }, [isLive]);

  return (
    <div className="min-h-screen bg-[#1d2d3a] text-white">
      {/* Header */}
      <header className="bg-[#1d2d3a] border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-black font-black text-sm">X1</span>
                </div>
                <div className="hidden sm:block">
                  <span className="text-white font-bold">X1</span>
                  <span className="text-cyan-400 font-bold">.space</span>
                </div>
              </Link>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">Mainnet</Badge>
            </div>
            
            <nav className="hidden md:flex items-center gap-1">
              <Link to={createPageUrl('Dashboard')}>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                  <Zap className="w-5 h-5" />
                </Button>
              </Link>
              <Link to={createPageUrl('Blocks')}>
                <Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                  </svg>
                </Button>
              </Link>
              <Link to={createPageUrl('Validators')}>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3v18h18" />
                    <path d="M18 17V9" />
                    <path d="M13 17V5" />
                    <path d="M8 17v-3" />
                  </svg>
                </Button>
              </Link>
              <Link to={createPageUrl('Transactions')}>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </Button>
              </Link>
            </nav>
            
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Input
                  placeholder="Search by slot or hash..."
                  className="w-full bg-[#24384a] border-0 text-white placeholder:text-gray-500 pr-10 rounded-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button 
                  size="icon" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 bg-cyan-500 hover:bg-cyan-600 h-7 w-7 rounded"
                >
                  <Search className="w-4 h-4 text-black" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Title & Controls */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Recent Blocks</h1>
            <p className="text-gray-400 text-sm">Live block feed from the X1 network</p>
          </div>
          
          <Button 
            onClick={() => setIsLive(!isLive)}
            variant="outline"
            className={`border-white/10 ${isLive ? 'text-emerald-400' : 'text-gray-400'}`}
          >
            {isLive ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2" />
                <Pause className="w-4 h-4 mr-1" /> Live
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" /> Paused
              </>
            )}
          </Button>
        </div>

        {/* Blocks Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {blocks.map((block) => (
            <BlockViz 
              key={block.slot} 
              block={block} 
              isNew={block.slot === newBlockSlot}
            />
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <Button variant="outline" className="border-white/10 text-gray-400 hover:text-white">
            <ChevronLeft className="w-4 h-4 mr-1" /> Older Blocks
          </Button>
          <Button variant="outline" className="border-white/10 text-gray-400 hover:text-white">
            Newer Blocks <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </main>
    </div>
  );
}