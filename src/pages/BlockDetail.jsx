import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Zap,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  CheckCircle,
  Clock,
  Layers,
  User
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function BlockDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const slot = urlParams.get('slot') || '11265950';
  const [copied, setCopied] = useState(null);
  
  const block = {
    slot: parseInt(slot),
    blockhash: '5X8vBJ2aK9Lm4nH7wQ3rT6yU8iO0pA1sD2fG5hJ6kL7mN8oP9qR0sT1uV2wX3yZ4a5b6c7d8e9f',
    previousBlockhash: '4W7uAH1bJ8Kl3mG6vP2qS5xT7yU9iN0oM1nB4cV5dE6fG7hI8jK9lL0mN1oP2qR3sT4uV5wX6yZ7a',
    parent: parseInt(slot) - 1,
    leader: 'X1 Labs (node4)',
    leaderPubkey: '7J5wJaH55ZYjCCmCMt7Gb3QL6FGFmjz5U8b6NcbzfoTy',
    time: 358,
    txCount: 2847,
    successTx: 2831,
    failedTx: 16,
    timestamp: new Date().toISOString(),
    rewards: 0.0025,
    fees: 0.847,
    feeRange: '1.14 - 301',
    medianFee: 2
  };

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  // Generate transaction squares for visualization
  const squares = Array.from({ length: 200 }, (_, i) => ({
    id: i,
    opacity: 0.3 + Math.random() * 0.7
  }));

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
                  placeholder="Search..."
                  className="w-full bg-[#24384a] border-0 text-white placeholder:text-gray-500 pr-10 rounded-lg"
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
        {/* Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Link to={createPageUrl('Blocks')}>
            <Button variant="ghost" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Blocks
            </Button>
          </Link>
          
          <div className="flex items-center gap-2">
            <Link to={createPageUrl('BlockDetail') + `?slot=${block.parent}`}>
              <Button variant="outline" size="icon" className="border-white/10 text-gray-400 hover:text-white h-8 w-8">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </Link>
            <span className="text-gray-400 text-sm px-2">Block #{slot}</span>
            <Link to={createPageUrl('BlockDetail') + `?slot=${block.slot + 1}`}>
              <Button variant="outline" size="icon" className="border-white/10 text-gray-400 hover:text-white h-8 w-8">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Block Visualization */}
          <div className="lg:col-span-1">
            <div className="bg-[#24384a] rounded-xl p-4">
              <div className="relative w-full h-[300px] bg-gradient-to-b from-purple-500/30 to-purple-600/10 rounded-lg overflow-hidden">
                {/* Transaction grid */}
                <div className="absolute inset-2 grid grid-cols-14 gap-[2px]">
                  {squares.map((sq) => (
                    <div
                      key={sq.id}
                      className="bg-[#9ACD32] rounded-[1px]"
                      style={{ opacity: sq.opacity * 0.7 }}
                    />
                  ))}
                </div>
                
                {/* Slot overlay */}
                <div className="absolute top-3 left-3 right-3">
                  <p className="text-cyan-400 font-mono font-bold text-2xl">
                    #{block.slot.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-300 mt-1">~{block.medianFee} sat/vB</p>
                  <p className="text-xs text-cyan-400/80">{block.feeRange} sat/vB</p>
                </div>
                
                {/* Bottom stats */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/40 p-4">
                  <p className="text-white font-bold">‎{block.fees} XNT</p>
                  <p className="text-sm text-gray-400">{block.txCount.toLocaleString()} transactions</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-5 h-5 rounded bg-cyan-500/30 flex items-center justify-center">
                      <span className="text-[10px] text-cyan-400 font-bold">X1</span>
                    </div>
                    <span className="text-sm text-gray-400">{block.leader}</span>
                  </div>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Success</p>
                  <p className="text-emerald-400 font-bold">{block.successTx.toLocaleString()}</p>
                </div>
                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Failed</p>
                  <p className="text-red-400 font-bold">{block.failedTx}</p>
                </div>
                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Block Time</p>
                  <p className="text-white font-bold">{block.time}ms</p>
                </div>
                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Rewards</p>
                  <p className="text-cyan-400 font-bold">{block.rewards} XNT</p>
                </div>
              </div>
            </div>
          </div>

          {/* Block Details */}
          <div className="lg:col-span-2">
            <div className="bg-[#24384a] rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/5">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Layers className="w-5 h-5 text-purple-400" />
                  Block Overview
                </h2>
              </div>
              
              <div className="divide-y divide-white/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2">
                  <span className="text-gray-400 text-sm">Slot</span>
                  <span className="text-white font-mono">{block.slot.toLocaleString()}</span>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2">
                  <span className="text-gray-400 text-sm">Blockhash</span>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-mono text-xs sm:text-sm truncate max-w-[200px] sm:max-w-[400px]">
                      {block.blockhash}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleCopy(block.blockhash, 'hash')}
                    >
                      {copied === 'hash' ? (
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2">
                  <span className="text-gray-400 text-sm">Previous Hash</span>
                  <span className="text-gray-300 font-mono text-xs truncate max-w-[200px] sm:max-w-[400px]">
                    {block.previousBlockhash}
                  </span>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2">
                  <span className="text-gray-400 text-sm">Parent Slot</span>
                  <Link 
                    to={createPageUrl('BlockDetail') + `?slot=${block.parent}`}
                    className="text-cyan-400 hover:underline font-mono"
                  >
                    {block.parent.toLocaleString()}
                  </Link>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2">
                  <span className="text-gray-400 text-sm">Block Leader</span>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center">
                      <span className="text-[10px] text-cyan-400 font-bold">X1</span>
                    </div>
                    <span className="text-white">{block.leader}</span>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2">
                  <span className="text-gray-400 text-sm">Leader Pubkey</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300 font-mono text-xs truncate max-w-[200px] sm:max-w-[300px]">
                      {block.leaderPubkey}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleCopy(block.leaderPubkey, 'leader')}
                    >
                      {copied === 'leader' ? (
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2">
                  <span className="text-gray-400 text-sm">Timestamp</span>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">{new Date(block.timestamp).toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2">
                  <span className="text-gray-400 text-sm">Transactions</span>
                  <div className="flex items-center gap-4">
                    <span className="text-emerald-400">
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      {block.successTx.toLocaleString()} successful
                    </span>
                    <span className="text-red-400">
                      {block.failedTx} failed
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2">
                  <span className="text-gray-400 text-sm">Total Fees</span>
                  <span className="text-cyan-400 font-bold">{block.fees} XNT</span>
                </div>
              </div>
            </div>
            
            {/* View Transactions Button */}
            <div className="mt-4">
              <Link to={createPageUrl('Transactions') + `?block=${slot}`}>
                <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-semibold">
                  View All {block.txCount.toLocaleString()} Transactions
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}