import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Layers,
  Clock,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Zap,
  Hash
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const generateMockBlocks = (start, count) => {
  const leaders = [
    'X1 Labs (node4)', 'X1 Labs (node9)', 'X1 Labs (node11)', 
    'StakeSquid', 'Chorus One', 'Everstake', 'Figment', 'Unknown'
  ];
  
  return Array.from({ length: count }, (_, i) => {
    const slot = start - i;
    return {
      slot,
      parent: slot - 1,
      leader: leaders[Math.floor(Math.random() * leaders.length)],
      time: 300 + Math.floor(Math.random() * 300),
      txCount: 2000 + Math.floor(Math.random() * 2000),
      timestamp: new Date(Date.now() - i * 400).toISOString(),
      hash: `${slot}...${Math.random().toString(36).substring(2, 8)}`,
      fee: (Math.random() * 0.01).toFixed(4)
    };
  });
};

export default function Blocks() {
  const [blocks, setBlocks] = useState(generateMockBlocks(11265950, 20));
  const [searchQuery, setSearchQuery] = useState('');
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    if (!isLive) return;
    
    const interval = setInterval(() => {
      setBlocks(prev => {
        const newSlot = prev[0].slot + 1;
        const leaders = ['X1 Labs (node4)', 'X1 Labs (node9)', 'X1 Labs (node11)', 'StakeSquid'];
        const newBlock = {
          slot: newSlot,
          parent: newSlot - 1,
          leader: leaders[Math.floor(Math.random() * leaders.length)],
          time: 300 + Math.floor(Math.random() * 300),
          txCount: 2000 + Math.floor(Math.random() * 2000),
          timestamp: new Date().toISOString(),
          hash: `${newSlot}...${Math.random().toString(36).substring(2, 8)}`,
          fee: (Math.random() * 0.01).toFixed(4)
        };
        return [newBlock, ...prev.slice(0, 19)];
      });
    }, 400);
    
    return () => clearInterval(interval);
  }, [isLive]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = (now - date) / 1000;
    
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0d1320]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link to={createPageUrl('Dashboard')} className="text-3xl font-black tracking-tight">
                <span className="text-white">X</span>
                <span className="text-cyan-400">1</span>
              </Link>
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-xs">
                Mainnet
              </Badge>
            </div>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link to={createPageUrl('Dashboard')} className="text-gray-400 hover:text-white transition-colors">
                Cluster Stats
              </Link>
              <Link to={createPageUrl('Validators')} className="text-gray-400 hover:text-white transition-colors">
                Validators
              </Link>
              <Link to={createPageUrl('Blocks')} className="text-white font-medium">
                Blocks
              </Link>
              <Link to={createPageUrl('Transactions')} className="text-gray-400 hover:text-white transition-colors">
                Transactions
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Page Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Layers className="w-8 h-8 text-purple-400" />
              Blocks
            </h1>
            <p className="text-gray-400 mt-1">Latest blocks on the X1 blockchain</p>
          </div>
          
          <Button 
            onClick={() => setIsLive(!isLive)}
            className={`${isLive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'} border`}
            variant="outline"
          >
            <span className={`w-2 h-2 rounded-full mr-2 ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`} />
            {isLive ? 'Live' : 'Paused'}
          </Button>
        </div>

        {/* Search */}
        <Card className="bg-[#111827]/80 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by slot number or block hash..."
                className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-gray-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Blocks Grid - Mobile Friendly Cards */}
        <div className="grid gap-4 md:hidden">
          {blocks.map((block, index) => (
            <Card 
              key={block.slot}
              className={`bg-gradient-to-br from-[#111827] to-[#0d1320] border-white/5 ${index === 0 && isLive ? 'ring-1 ring-cyan-500/30' : ''}`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Link to={createPageUrl('BlockDetail') + `?slot=${block.slot}`} className="text-cyan-400 hover:underline font-mono text-lg font-bold">
                    #{block.slot.toLocaleString()}
                  </Link>
                  <Badge variant="outline" className="border-gray-500/30 text-gray-400">
                    {formatTime(block.timestamp)}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-xs font-bold text-black">
                    X1
                  </div>
                  <span className="text-white text-sm">{block.leader}</span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                  <div>
                    <p className="text-gray-500 text-xs">Transactions</p>
                    <p className="text-white font-mono">{block.txCount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Time</p>
                    <p className="text-white font-mono">{block.time}ms</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Fees</p>
                    <p className="text-white font-mono">{block.fee}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Blocks Table - Desktop */}
        <Card className="bg-gradient-to-br from-[#111827] to-[#0d1320] border-white/5 hidden md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-gray-400 text-xs font-medium px-4 py-3 uppercase tracking-wider">Slot</th>
                    <th className="text-left text-gray-400 text-xs font-medium px-4 py-3 uppercase tracking-wider">Hash</th>
                    <th className="text-left text-gray-400 text-xs font-medium px-4 py-3 uppercase tracking-wider">Leader</th>
                    <th className="text-right text-gray-400 text-xs font-medium px-4 py-3 uppercase tracking-wider">Transactions</th>
                    <th className="text-right text-gray-400 text-xs font-medium px-4 py-3 uppercase tracking-wider">Time (ms)</th>
                    <th className="text-right text-gray-400 text-xs font-medium px-4 py-3 uppercase tracking-wider">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((block, index) => (
                    <tr 
                      key={block.slot}
                      className={`border-b border-white/5 hover:bg-white/[0.02] transition-all ${index === 0 && isLive ? 'bg-cyan-500/5' : ''}`}
                    >
                      <td className="px-4 py-4">
                        <Link to={createPageUrl('BlockDetail') + `?slot=${block.slot}`} className="text-cyan-400 hover:underline font-mono font-bold">
                          {block.slot.toLocaleString()}
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-gray-400 font-mono text-sm">{block.hash}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-xs font-bold text-black">
                            X1
                          </div>
                          <span className="text-white">{block.leader}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Zap className="w-3 h-3 text-yellow-400" />
                          <span className="text-white font-mono">{block.txCount.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right text-gray-300 font-mono">
                        {block.time}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span className="text-sm">{formatTime(block.timestamp)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-sm">
            Latest <span className="text-white">20</span> blocks
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Older
            </Button>
            <Button variant="outline" className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5">
              Newer
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}