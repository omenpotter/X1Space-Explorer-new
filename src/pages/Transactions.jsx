import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Zap,
  ArrowRight,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Pause,
  Play
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const generateMockTransactions = (count) => {
  const types = ['Transfer', 'Stake', 'Vote', 'Create', 'Close', 'Swap'];
  
  return Array.from({ length: count }, (_, i) => ({
    signature: `${Math.random().toString(36).substring(2, 10)}...${Math.random().toString(36).substring(2, 6)}`,
    slot: 11265950 - Math.floor(Math.random() * 100),
    timestamp: new Date(Date.now() - i * 300 - Math.random() * 5000).toISOString(),
    type: types[Math.floor(Math.random() * types.length)],
    status: Math.random() > 0.05 ? 'Success' : 'Failed',
    fee: (Math.random() * 0.001).toFixed(6),
    from: `${Math.random().toString(36).substring(2, 6)}...${Math.random().toString(36).substring(2, 6)}`,
    to: `${Math.random().toString(36).substring(2, 6)}...${Math.random().toString(36).substring(2, 6)}`,
    amount: (Math.random() * 100).toFixed(2)
  }));
};

export default function Transactions() {
  const [transactions, setTransactions] = useState(generateMockTransactions(20));
  const [searchQuery, setSearchQuery] = useState('');
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    if (!isLive) return;
    
    const interval = setInterval(() => {
      const types = ['Transfer', 'Stake', 'Vote', 'Create', 'Swap'];
      setTransactions(prev => {
        const newTx = {
          signature: `${Math.random().toString(36).substring(2, 10)}...${Math.random().toString(36).substring(2, 6)}`,
          slot: 11265950 + Math.floor(Math.random() * 10),
          timestamp: new Date().toISOString(),
          type: types[Math.floor(Math.random() * types.length)],
          status: 'Success',
          fee: (Math.random() * 0.001).toFixed(6),
          from: `${Math.random().toString(36).substring(2, 6)}...${Math.random().toString(36).substring(2, 6)}`,
          to: `${Math.random().toString(36).substring(2, 6)}...${Math.random().toString(36).substring(2, 6)}`,
          amount: (Math.random() * 100).toFixed(2)
        };
        return [newTx, ...prev.slice(0, 19)];
      });
    }, 200);
    
    return () => clearInterval(interval);
  }, [isLive]);

  const formatTime = (timestamp) => {
    const diff = (Date.now() - new Date(timestamp).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  };

  const typeColors = {
    Transfer: 'bg-blue-500/20 text-blue-400',
    Stake: 'bg-purple-500/20 text-purple-400',
    Vote: 'bg-green-500/20 text-green-400',
    Create: 'bg-yellow-500/20 text-yellow-400',
    Close: 'bg-red-500/20 text-red-400',
    Swap: 'bg-cyan-500/20 text-cyan-400'
  };

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
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
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
                <Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg">
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
                  placeholder="Search by signature..."
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
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Total Transactions</p>
            <p className="text-2xl font-bold text-white">8.68B</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">TPS</p>
            <p className="text-2xl font-bold text-cyan-400">2,622</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Success Rate</p>
            <p className="text-2xl font-bold text-emerald-400">99.8%</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Avg Fee</p>
            <p className="text-2xl font-bold text-white">0.00025 XNT</p>
          </div>
        </div>

        {/* Live Toggle */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
          <Button 
            onClick={() => setIsLive(!isLive)}
            variant="outline"
            size="sm"
            className={`border-white/10 ${isLive ? 'text-emerald-400' : 'text-gray-400'}`}
          >
            {isLive ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2" />
                <Pause className="w-3 h-3 mr-1" /> Live
              </>
            ) : (
              <>
                <Play className="w-3 h-3 mr-1" /> Paused
              </>
            )}
          </Button>
        </div>

        {/* Transactions Table */}
        <div className="bg-[#24384a] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Signature</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Type</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">From / To</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Amount</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Fee</th>
                  <th className="text-center text-gray-400 text-xs font-medium px-4 py-3">Status</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Age</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, index) => (
                  <tr 
                    key={tx.signature + index}
                    className={`border-b border-white/5 hover:bg-white/[0.02] transition-all ${index === 0 && isLive ? 'bg-cyan-500/5' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <Link 
                        to={createPageUrl('TransactionDetail') + `?sig=${tx.signature}`}
                        className="text-cyan-400 hover:underline font-mono text-sm"
                      >
                        {tx.signature}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${typeColors[tx.type]} border-0 text-xs`}>
                        {tx.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400 font-mono bg-white/5 px-2 py-0.5 rounded">{tx.from}</span>
                        <ArrowRight className="w-3 h-3 text-gray-600" />
                        <span className="text-gray-400 font-mono bg-white/5 px-2 py-0.5 rounded">{tx.to}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {tx.type === 'Transfer' && (
                        <span className="text-white font-mono text-sm">{tx.amount} XNT</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-gray-400 font-mono text-xs">{tx.fee}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {tx.status === 'Success' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-gray-500 text-xs">{formatTime(tx.timestamp)} ago</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-4 mt-6">
          <Button variant="outline" className="border-white/10 text-gray-400 hover:text-white">
            <ChevronLeft className="w-4 h-4 mr-1" /> Older
          </Button>
          <Button variant="outline" className="border-white/10 text-gray-400 hover:text-white">
            Newer <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </main>
    </div>
  );
}