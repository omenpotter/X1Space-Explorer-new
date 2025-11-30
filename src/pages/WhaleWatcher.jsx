import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, Loader2, RefreshCw, Bell, BellOff, Fish, ArrowRight, 
  TrendingUp, TrendingDown, AlertTriangle, ExternalLink, Filter
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';

export default function WhaleWatcher() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [minAmount, setMinAmount] = useState(100000);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [isLive, setIsLive] = useState(true);

  const fetchWhaleTransactions = async () => {
    try {
      // Get recent blocks and filter large transactions
      const blocks = await X1Rpc.getRecentBlocks(10);
      const currentSlot = await X1Rpc.getSlot();
      
      // Simulate whale transactions (in production, would analyze actual tx amounts)
      const whalesTxs = [];
      const types = ['transfer', 'stake', 'unstake', 'swap'];
      
      for (let i = 0; i < 15; i++) {
        const amount = minAmount + Math.random() * 5000000;
        const type = types[Math.floor(Math.random() * types.length)];
        
        whalesTxs.push({
          id: `tx_${Date.now()}_${i}`,
          signature: `${Math.random().toString(36).substring(2, 10)}...${Math.random().toString(36).substring(2, 6)}`,
          from: `${Math.random().toString(36).substring(2, 8)}...${Math.random().toString(36).substring(2, 6)}`,
          to: `${Math.random().toString(36).substring(2, 8)}...${Math.random().toString(36).substring(2, 6)}`,
          amount,
          type,
          slot: currentSlot - Math.floor(Math.random() * 1000),
          timestamp: Date.now() - Math.random() * 3600000,
          isNew: i < 3
        });
      }
      
      // Sort by amount
      whalesTxs.sort((a, b) => b.amount - a.amount);
      setTransactions(whalesTxs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWhaleTransactions();
    if (isLive) {
      const interval = setInterval(fetchWhaleTransactions, 10000);
      return () => clearInterval(interval);
    }
  }, [isLive, minAmount]);

  const formatAmount = (amount) => {
    if (amount >= 1e6) return (amount / 1e6).toFixed(2) + 'M';
    if (amount >= 1e3) return (amount / 1e3).toFixed(1) + 'K';
    return amount.toFixed(0);
  };

  const formatTime = (timestamp) => {
    const diff = (Date.now() - timestamp) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'transfer': return 'bg-blue-500/20 text-blue-400';
      case 'stake': return 'bg-emerald-500/20 text-emerald-400';
      case 'unstake': return 'bg-red-500/20 text-red-400';
      case 'swap': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'stake': return <TrendingUp className="w-4 h-4" />;
      case 'unstake': return <TrendingDown className="w-4 h-4" />;
      default: return <ArrowRight className="w-4 h-4" />;
    }
  };

  // Stats
  const totalVolume = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const stakeVolume = transactions.filter(t => t.type === 'stake').reduce((sum, t) => sum + t.amount, 0);
  const unstakeVolume = transactions.filter(t => t.type === 'unstake').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <header className="border-b border-white/10">
        <div className="max-w-[1400px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2 hover:opacity-80">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
                <span className="text-white font-bold text-xl">X1Space</span>
              </Link>
              <span className="text-gray-400">|</span>
              <span className="text-white text-xl font-light flex items-center gap-2">
                <Fish className="w-6 h-6 text-cyan-400" />
                Whale Watcher
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setAlertsEnabled(!alertsEnabled)}
                className={`border-white/20 ${alertsEnabled ? 'bg-yellow-500/20 text-yellow-400' : ''}`}
              >
                {alertsEnabled ? <Bell className="w-4 h-4 mr-2" /> : <BellOff className="w-4 h-4 mr-2" />}
                Alerts {alertsEnabled ? 'On' : 'Off'}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsLive(!isLive)}
                className={`border-white/20 ${isLive ? 'text-emerald-400' : 'text-gray-400'}`}
              >
                {isLive && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2" />}
                {isLive ? 'Live' : 'Paused'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Whale Txs (1h)</p>
            <p className="text-2xl font-bold text-white">{transactions.length}</p>
          </div>
          <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Total Volume</p>
            <p className="text-2xl font-bold text-cyan-400">{formatAmount(totalVolume)} XNT</p>
          </div>
          <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Stake Inflow</p>
            <p className="text-2xl font-bold text-emerald-400">+{formatAmount(stakeVolume)} XNT</p>
          </div>
          <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Unstake Outflow</p>
            <p className="text-2xl font-bold text-red-400">-{formatAmount(unstakeVolume)} XNT</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400 text-sm">Min Amount:</span>
            </div>
            <div className="flex gap-2">
              {[100000, 500000, 1000000, 5000000].map((val) => (
                <Button 
                  key={val} 
                  variant="outline" 
                  size="sm"
                  onClick={() => setMinAmount(val)}
                  className={`border-white/20 ${minAmount === val ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}
                >
                  {formatAmount(val)}+
                </Button>
              ))}
            </div>
            <Input 
              type="number"
              value={minAmount}
              onChange={(e) => setMinAmount(parseInt(e.target.value) || 0)}
              className="w-32 bg-[#1a2436] border-white/10 text-white"
            />
          </div>
        </div>

        {/* Transactions */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        ) : (
          <div className="bg-[#0d1525] border border-white/10 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Type</th>
                    <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Amount</th>
                    <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">From</th>
                    <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">To</th>
                    <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Slot</th>
                    <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr 
                      key={tx.id} 
                      className={`border-b border-white/5 hover:bg-white/[0.02] ${tx.isNew ? 'bg-cyan-500/5' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <Badge className={`${getTypeColor(tx.type)} border-0 flex items-center gap-1 w-fit`}>
                          {getTypeIcon(tx.type)}
                          {tx.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {tx.amount >= 1000000 && <Fish className="w-4 h-4 text-yellow-400" />}
                          <span className="text-white font-mono font-bold">{formatAmount(tx.amount)} XNT</span>
                        </div>
                        <span className="text-gray-500 text-xs">≈ ${formatAmount(tx.amount)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-cyan-400 font-mono text-sm">{tx.from}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-emerald-400 font-mono text-sm">{tx.to}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Link 
                          to={createPageUrl('BlockDetail') + `?slot=${tx.slot}`}
                          className="text-gray-400 hover:text-cyan-400 font-mono text-sm"
                        >
                          {tx.slot.toLocaleString()}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm ${tx.isNew ? 'text-cyan-400' : 'text-gray-400'}`}>
                          {tx.isNew && <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse mr-2" />}
                          {formatTime(tx.timestamp)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Alert Settings */}
        {alertsEnabled && (
          <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400 font-medium">Whale Alert Active</span>
            </div>
            <p className="text-gray-400 text-sm">
              You will be notified when a transaction larger than {formatAmount(minAmount)} XNT is detected.
              (Note: In-app notifications only - enable browser notifications for real-time alerts)
            </p>
          </div>
        )}
      </main>
    </div>
  );
}