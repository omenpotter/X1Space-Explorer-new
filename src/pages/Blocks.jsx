import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Zap,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';

// Block visualization
const BlockViz = ({ block, isNew }) => {
  const squares = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    opacity: 0.4 + Math.random() * 0.6
  }));

  return (
    <Link to={createPageUrl('BlockDetail') + `?slot=${block.slot}`}>
      <div className={`
        relative w-full h-[200px]
        bg-gradient-to-b from-purple-500/30 to-purple-600/20
        border border-white/10 rounded-lg
        overflow-hidden cursor-pointer
        transition-all duration-300
        hover:border-cyan-500/50 hover:scale-[1.01]
        ${isNew ? 'ring-2 ring-cyan-500/50' : ''}
      `}>
        <div className="absolute inset-2 grid grid-cols-10 gap-[2px]">
          {squares.map((sq) => (
            <div
              key={sq.id}
              className="bg-[#9ACD32] rounded-[1px]"
              style={{ opacity: sq.opacity * 0.7 }}
            />
          ))}
        </div>
        
        <div className="absolute top-0 left-0 right-0 text-center py-2">
          <span className="text-cyan-400 font-mono font-bold text-lg">
            {block.slot?.toLocaleString()}
          </span>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 bg-black/30 p-3">
          <p className="text-white font-bold text-sm">{block.txCount?.toLocaleString() || 0} txns</p>
          <p className="text-[10px] text-gray-400">
            {block.blockTime ? new Date(block.blockTime * 1000).toLocaleTimeString() : 'Processing...'}
          </p>
        </div>
      </div>
    </Link>
  );
};

export default function Blocks() {
  const [blocks, setBlocks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLive, setIsLive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newBlockSlot, setNewBlockSlot] = useState(null);
  const [currentSlot, setCurrentSlot] = useState(null);

  const fetchBlocks = async () => {
    try {
      const slot = await X1Rpc.getSlot();
      setCurrentSlot(slot);
      
      // Check if we have a new block
      if (blocks.length > 0 && slot > blocks[0]?.slot) {
        setNewBlockSlot(slot);
        setTimeout(() => setNewBlockSlot(null), 1000);
      }
      
      const recentBlocks = await X1Rpc.getRecentBlocks(24);
      setBlocks(recentBlocks);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch blocks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlocks();
    
    if (isLive) {
      const interval = setInterval(fetchBlocks, 2000);
      return () => clearInterval(interval);
    }
  }, [isLive]);

  if (loading && blocks.length === 0) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading blocks from X1 Network...</p>
        </div>
      </div>
    );
  }

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
                  placeholder="Search by slot..."
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

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2">
          <div className="max-w-[1800px] mx-auto flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Error: {error}</span>
          </div>
        </div>
      )}

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Title & Controls */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Recent Blocks</h1>
            <p className="text-gray-400 text-sm">
              Current slot: <span className="text-cyan-400 font-mono">{currentSlot?.toLocaleString()}</span>
            </p>
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

        {/* Block Table */}
        <div className="mt-8 bg-[#24384a] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h2 className="text-lg font-semibold">Block Details</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Slot</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Block Hash</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Transactions</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Block Height</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {blocks.slice(0, 10).map((block) => (
                  <tr key={block.slot} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <Link 
                        to={createPageUrl('BlockDetail') + `?slot=${block.slot}`}
                        className="text-cyan-400 hover:underline font-mono"
                      >
                        {block.slot?.toLocaleString()}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-400 font-mono text-sm">
                        {block.blockhash?.substring(0, 20)}...
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-mono">
                      {block.txCount?.toLocaleString() || 0}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 font-mono">
                      {block.blockHeight?.toLocaleString() || '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-sm">
                      {block.blockTime ? new Date(block.blockTime * 1000).toLocaleTimeString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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