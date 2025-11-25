import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  ArrowRight,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const generateMockTransactions = (count) => {
  const types = ['Transfer', 'Stake', 'Vote', 'Create Account', 'Close Account', 'Swap'];
  const statuses = ['Success', 'Success', 'Success', 'Success', 'Failed'];
  
  return Array.from({ length: count }, (_, i) => ({
    signature: `${Math.random().toString(36).substring(2, 10)}...${Math.random().toString(36).substring(2, 6)}`,
    slot: 11265950 - Math.floor(Math.random() * 100),
    timestamp: new Date(Date.now() - i * 400 - Math.random() * 10000).toISOString(),
    type: types[Math.floor(Math.random() * types.length)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
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
      setTransactions(prev => {
        const types = ['Transfer', 'Stake', 'Vote', 'Create Account', 'Swap'];
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
    }, 300);
    
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

  const getTypeColor = (type) => {
    switch (type) {
      case 'Transfer': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Stake': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'Vote': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Create Account': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Close Account': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'Swap': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
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
              <Link to={createPageUrl('Blocks')} className="text-gray-400 hover:text-white transition-colors">
                Blocks
              </Link>
              <Link to={createPageUrl('Transactions')} className="text-white font-medium">
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
              <Zap className="w-8 h-8 text-yellow-400" />
              Transactions
            </h1>
            <p className="text-gray-400 mt-1">Live transaction feed from the X1 network</p>
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
                placeholder="Search by signature or address..."
                className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-gray-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Transaction Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#111827]/50 rounded-xl p-4 border border-white/5">
            <p className="text-gray-400 text-xs">Total Transactions</p>
            <p className="text-xl font-bold text-white mt-1">8.68B</p>
          </div>
          <div className="bg-[#111827]/50 rounded-xl p-4 border border-white/5">
            <p className="text-gray-400 text-xs">TPS</p>
            <p className="text-xl font-bold text-cyan-400 mt-1">2,622</p>
          </div>
          <div className="bg-[#111827]/50 rounded-xl p-4 border border-white/5">
            <p className="text-gray-400 text-xs">Success Rate</p>
            <p className="text-xl font-bold text-emerald-400 mt-1">99.8%</p>
          </div>
          <div className="bg-[#111827]/50 rounded-xl p-4 border border-white/5">
            <p className="text-gray-400 text-xs">Avg Fee</p>
            <p className="text-xl font-bold text-white mt-1">0.00025</p>
          </div>
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
          {transactions.map((tx, index) => (
            <Card 
              key={tx.signature + index}
              className={`bg-gradient-to-br from-[#111827] to-[#0d1320] border-white/5 hover:border-white/10 transition-all ${index === 0 && isLive ? 'ring-1 ring-cyan-500/20' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Signature & Status */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg ${tx.status === 'Success' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      {tx.status === 'Success' ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link 
                        to={createPageUrl('TransactionDetail') + `?sig=${tx.signature}`}
                        className="text-cyan-400 hover:underline font-mono text-sm truncate block"
                      >
                        {tx.signature}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-xs ${getTypeColor(tx.type)}`}>
                          {tx.type}
                        </Badge>
                        <span className="text-gray-500 text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(tx.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* From -> To */}
                  <div className="flex items-center gap-2 text-sm">
                    <div className="bg-white/5 rounded px-2 py-1 font-mono text-gray-300">
                      {tx.from}
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-500" />
                    <div className="bg-white/5 rounded px-2 py-1 font-mono text-gray-300">
                      {tx.to}
                    </div>
                  </div>
                  
                  {/* Amount & Fee */}
                  <div className="flex items-center gap-4">
                    {tx.type === 'Transfer' && (
                      <div className="text-right">
                        <p className="text-white font-semibold">{tx.amount} X1</p>
                        <p className="text-gray-500 text-xs">Amount</p>
                      </div>
                    )}
                    <div className="text-right min-w-[80px]">
                      <p className="text-gray-300 font-mono text-sm">{tx.fee}</p>
                      <p className="text-gray-500 text-xs">Fee</p>
                    </div>
                    <Link 
                      to={createPageUrl('TransactionDetail') + `?sig=${tx.signature}`}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <ArrowUpRight className="w-4 h-4 text-gray-400" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-sm">
            Showing <span className="text-white">20</span> latest transactions
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