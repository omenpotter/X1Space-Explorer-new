import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, Loader2, RefreshCw, Bell, BellOff, Fish, ArrowRight, 
  TrendingUp, TrendingDown, AlertTriangle, Filter, Settings, Volume2, VolumeX
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';
import RPCDebugger from '../components/debug/RPCDebugger';

export default function WhaleWatcher() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [minAmount, setMinAmount] = useState(10000); // Lower default threshold
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [filterType, setFilterType] = useState('all'); // all, transfer, stake, unstake
  const [alertHistory, setAlertHistory] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [customThreshold, setCustomThreshold] = useState('');

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('x1_whale_settings');
    if (saved) {
      const settings = JSON.parse(saved);
      setMinAmount(settings.minAmount || 100000);
      setAlertsEnabled(settings.alertsEnabled || false);
      setSoundEnabled(settings.soundEnabled || false);
      setFilterType(settings.filterType || 'all');
    }
    
    const savedAlerts = localStorage.getItem('x1_whale_alerts');
    if (savedAlerts) {
      setAlertHistory(JSON.parse(savedAlerts).slice(0, 50));
    }
  }, []);

  // Save settings
  useEffect(() => {
    localStorage.setItem('x1_whale_settings', JSON.stringify({
      minAmount, alertsEnabled, soundEnabled, filterType
    }));
  }, [minAmount, alertsEnabled, soundEnabled, filterType]);

  // Request notification permission
  useEffect(() => {
    if (alertsEnabled && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [alertsEnabled]);

  // Trigger alert for whale transaction
  const triggerAlert = useCallback((tx) => {
    // Browser notification
    if (alertsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('🐋 Whale Alert!', {
        body: `${formatAmount(tx.amount)} XNT ${tx.type} detected`,
        icon: '/favicon.ico'
      });
    }
    
    // Sound alert
    if (soundEnabled) {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQkuod3v4rZTBQCNzfn/9cRpDACK0///+shqCgCI0///+cpsCAB60P3/88VpAgBzyPr/7rlgAABqwPX/4qlZAABftO7/1plSAABUqOj/y4lLAABKnOL/wXlEAABAkNz/t2k9AAA2hNb/rVk2');
      audio.volume = 0.3;
      audio.play().catch(() => {});
    }
    
    // Save to alert history
    const newAlert = {
      ...tx,
      alertTime: Date.now()
    };
    setAlertHistory(prev => {
      const updated = [newAlert, ...prev].slice(0, 50);
      localStorage.setItem('x1_whale_alerts', JSON.stringify(updated));
      return updated;
    });
  }, [alertsEnabled, soundEnabled]);

  // Fetch whale transactions - scan recent blocks for large transfers
  const fetchWhaleTransactions = async () => {
    setLoading(true);
    try {
      const currentSlot = await X1Rpc.getSlot();
      const whaleTxs = [];
      
      // Scan last 30 blocks
      for (let i = 0; i < 30; i++) {
        try {
          const block = await X1Rpc.getBlock(currentSlot - i, { transactionDetails: 'full' });
          if (!block?.transactions) continue;
          
          block.transactions.forEach(tx => {
            if (!tx.transaction || !tx.meta) return;
            
            const message = tx.transaction.message;
            const accountKeys = message?.accountKeys || [];
            const instructions = message?.instructions || [];
            const preBalances = tx.meta.preBalances || [];
            const postBalances = tx.meta.postBalances || [];
            
            // Skip vote transactions
            const isVote = instructions.some(ix => {
              const programId = accountKeys[ix.programIdIndex];
              return programId === 'Vote111111111111111111111111111111111111111';
            });
            if (isVote) return;
            
            // Find ALL balance changes to detect transfers
            const balanceChanges = [];
            for (let j = 0; j < preBalances.length; j++) {
              const change = (postBalances[j] - preBalances[j]) / 1e9;
              if (Math.abs(change) > 0) {
                balanceChanges.push({ idx: j, change, address: accountKeys[j] });
              }
            }
            
            // Sort by absolute value to find largest transfer
            balanceChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
            
            // Find sender (negative change) and receiver (positive change)
            const sender = balanceChanges.find(c => c.change < -0.0001); // Lost money
            const receiver = balanceChanges.find(c => c.change > 0.0001); // Gained money
            
            if (sender && receiver) {
              const maxTransfer = Math.abs(sender.change);
              const fromIdx = sender.idx;
              const toIdx = receiver.idx;
              
              // Check if qualifies as whale transaction
              if (maxTransfer >= minAmount) {
              
                // Determine type
                let type = 'transfer';
                const hasStakeProgram = instructions.some(ix => 
                  accountKeys[ix.programIdIndex] === 'Stake11111111111111111111111111111111111111'
                );
                if (hasStakeProgram) {
                  type = sender.change < 0 ? 'stake' : 'unstake';
                }
                
                whaleTxs.push({
                  id: tx.transaction.signatures[0],
                  signature: tx.transaction.signatures[0],
                  from: accountKeys[fromIdx] || '',
                  to: accountKeys[toIdx] || '',
                  amount: maxTransfer,
                  type,
                  slot: currentSlot - i,
                  timestamp: block.blockTime ? block.blockTime * 1000 : Date.now(),
                  status: tx.meta.err ? 'failed' : 'success',
                  isNew: false
                });
              }
            }
          });
          
          if (whaleTxs.length >= 50) break;
        } catch (e) {
          // Skip failed blocks
        }
      }
      
      whaleTxs.sort((a, b) => b.amount - a.amount);
      
      // Mark new ones
      const prevIds = new Set(transactions.map(t => t.id));
      whaleTxs.forEach(tx => {
        if (!prevIds.has(tx.id)) {
          tx.isNew = true;
          triggerAlert(tx);
        }
      });
      
      setTransactions(whaleTxs);
      console.log(`Whale Watcher: Scanned 30 blocks, found ${whaleTxs.length} transfers >= ${formatAmount(minAmount)} XNT`);
    } catch (err) {
      console.error('Whale watcher error:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWhaleTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minAmount]);

  useEffect(() => {
    if (isLive) {
      const interval = setInterval(fetchWhaleTransactions, 15000); // Every 15 seconds
      return () => clearInterval(interval);
    }
  }, [isLive, fetchWhaleTransactions]);

  const formatAmount = (amount) => {
    if (amount >= 1e6) return (amount / 1e6).toFixed(2) + 'M';
    if (amount >= 1e3) return (amount / 1e3).toFixed(1) + 'K';
    return amount.toFixed(0);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'now';
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

  // Filter transactions
  const filteredTxs = filterType === 'all' 
    ? transactions 
    : transactions.filter(tx => tx.type === filterType);

  // Stats
  const totalVolume = filteredTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const stakeVolume = transactions.filter(t => t.type === 'stake').reduce((sum, t) => sum + t.amount, 0);
  const unstakeVolume = transactions.filter(t => t.type === 'unstake').reduce((sum, t) => sum + t.amount, 0);

  const applyCustomThreshold = () => {
    const value = parseFloat(customThreshold);
    if (!isNaN(value) && value > 0) {
      setMinAmount(value);
      // Trigger a new fetch with the new threshold
      setLoading(true);
      fetchWhaleTransactions();
    }
  };

  const clearCustomThreshold = () => {
    setCustomThreshold('');
    setMinAmount(100000);
    setLoading(true);
    fetchWhaleTransactions();
  };

  const searchWhales = () => {
    setLoading(true);
    fetchWhaleTransactions();
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <header className="border-b border-white/10">
        <div className="max-w-[1400px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2 hover:opacity-80">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
                <span className="font-bold text-xl"><span className="text-cyan-400">X1</span><span className="text-white">Space</span></span>
              </Link>
              <span className="text-gray-400">|</span>
              <span className="text-white text-xl font-light flex items-center gap-2">
                <Fish className="w-6 h-6 text-cyan-400" />
                Whale Watcher
              </span>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0">Live RPC</Badge>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`border-white/20 ${soundEnabled ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400'}`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setAlertsEnabled(!alertsEnabled)}
                className={`border-white/20 ${alertsEnabled ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-400'}`}
              >
                {alertsEnabled ? <Bell className="w-4 h-4 mr-2" /> : <BellOff className="w-4 h-4 mr-2" />}
                Alerts
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
            <p className="text-gray-400 text-sm">Whale Txs Found</p>
            <p className="text-2xl font-bold text-white">{filteredTxs.length}</p>
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
              {[10000, 50000, 100000, 500000].map((val) => (
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
            <div className="flex gap-2 items-center">
              <Input 
                type="number"
                placeholder="Custom amount"
                value={customThreshold}
                onChange={(e) => setCustomThreshold(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyCustomThreshold()}
                className="w-32 bg-[#1a2436] border-white/10 text-white"
              />
              <Button onClick={applyCustomThreshold} size="sm" className="bg-cyan-500 hover:bg-cyan-600">Set</Button>
              <Button onClick={clearCustomThreshold} size="sm" variant="outline" className="border-white/20 text-gray-400 hover:text-white">Clear</Button>
            </div>
            <span className="text-gray-500 text-sm ml-2">Current: {formatAmount(minAmount)}+ XNT</span>
          </div>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <span className="text-gray-400 text-sm">Type:</span>
            {['all', 'transfer', 'stake', 'unstake'].map((type) => (
              <Button 
                key={type} 
                variant="outline" 
                size="sm"
                onClick={() => setFilterType(type)}
                className={`border-white/20 ${filterType === type ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
            <div className="ml-auto">
              <Button onClick={searchWhales} className="bg-cyan-500 hover:bg-cyan-600">
                <Fish className="w-4 h-4 mr-2" />
                Search Whales
              </Button>
            </div>
          </div>
        </div>

        {/* Transactions */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        ) : filteredTxs.length === 0 ? (
          <div className="text-center py-20 bg-[#0d1525] border border-white/10 rounded-lg">
            <Fish className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl text-gray-400 mb-2">No whale transactions found</h2>
            <p className="text-gray-500">Try lowering the minimum amount threshold or wait for new transactions</p>
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
                  {filteredTxs.map((tx) => (
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
                        <Link 
                          to={createPageUrl('AddressLookup') + `?address=${tx.from}`}
                          className="text-cyan-400 hover:underline font-mono text-sm"
                        >
                          {tx.from?.substring(0, 8)}...{tx.from?.slice(-4)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link 
                          to={createPageUrl('AddressLookup') + `?address=${tx.to}`}
                          className="text-emerald-400 hover:underline font-mono text-sm"
                        >
                          {tx.to?.substring(0, 8)}...{tx.to?.slice(-4)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link 
                          to={createPageUrl('BlockDetail') + `?slot=${tx.slot}`}
                          className="text-gray-400 hover:text-cyan-400 font-mono text-sm"
                        >
                          {tx.slot?.toLocaleString()}
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

        {/* Alert Settings Info */}
        {alertsEnabled && (
          <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400 font-medium">Whale Alert Active</span>
            </div>
            <p className="text-gray-400 text-sm">
              Browser notifications enabled for transactions ≥{formatAmount(minAmount)} XNT.
              {soundEnabled && ' Sound alerts are also enabled.'}
              {Notification.permission !== 'granted' && (
                <span className="text-yellow-400 ml-2">
                  (Please allow notifications in your browser for full functionality)
                </span>
              )}
            </p>
          </div>
        )}

        {/* Alert History */}
        {alertHistory.length > 0 && (
          <div className="mt-6 bg-[#0d1525] border border-white/10 rounded-lg p-4">
            <h3 className="text-white font-medium mb-3">Recent Alerts ({alertHistory.length})</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {alertHistory.slice(0, 10).map((alert, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-[#1a2436] rounded px-3 py-2">
                  <span className="text-gray-400">{formatAmount(alert.amount)} XNT {alert.type}</span>
                  <span className="text-gray-500">{formatTime(alert.alertTime)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <RPCDebugger />
    </div>
  );
}