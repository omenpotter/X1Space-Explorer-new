import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ChevronLeft, Loader2, RefreshCw, Bell, BellOff, Fish, ArrowRight, 
  TrendingUp, TrendingDown, AlertTriangle, Filter, Volume2, VolumeX,
  ExternalLink, Layers, Users, DollarSign, Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';

// Known important addresses on X1
const KNOWN_ADDRESSES = {
  'pXNTyoqQsskHdZ7Q1rnP25FEyHHjissbs7n6RRN2nP5': {
    label: 'X1 Stake Delegation Pool',
    type: 'stake_pool',
    url: 'https://delegation.mainnet.x1.xyz/info',
    color: 'bg-purple-500/20 text-purple-400'
  },
  'R1PP3RkqTJniWgzJgeymd4rFpdpXcmjywVomMpd8eAY': {
    label: 'R1PPER Stake Pool',
    type: 'stake_pool',
    url: 'https://delegation.mainnet.x1.xyz/info',
    color: 'bg-blue-500/20 text-blue-400'
  }
};

export default function WhaleWatcher() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [minAmount, setMinAmount] = useState(1000);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [alertHistory, setAlertHistory] = useState([]);
  const [customThreshold, setCustomThreshold] = useState('');
  const [filterAddress, setFilterAddress] = useState('');
  const [sortField, setSortField] = useState('amount');
  const [sortOrder, setSortOrder] = useState('desc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [stakePoolStats, setStakePoolStats] = useState(null);
  const [loadingStakeStats, setLoadingStakeStats] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('x1_whale_settings');
    if (saved) {
      const settings = JSON.parse(saved);
      setMinAmount(settings.minAmount || 1000);
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

  // Fetch stake pool statistics
  const fetchStakePoolStats = async () => {
    setLoadingStakeStats(true);
    try {
      const poolAddresses = Object.keys(KNOWN_ADDRESSES).filter(
        addr => KNOWN_ADDRESSES[addr].type === 'stake_pool'
      );
      
      const poolStats = await Promise.all(
        poolAddresses.map(async (address) => {
          try {
            const accountInfo = await X1Rpc.getAccountInfo(address);
            const balance = accountInfo?.value ? accountInfo.value.lamports / 1e9 : 0;
            
            return {
              address,
              label: KNOWN_ADDRESSES[address].label,
              balance,
              color: KNOWN_ADDRESSES[address].color,
              url: KNOWN_ADDRESSES[address].url
            };
          } catch (err) {
            return {
              address,
              label: KNOWN_ADDRESSES[address].label,
              balance: 0,
              color: KNOWN_ADDRESSES[address].color,
              url: KNOWN_ADDRESSES[address].url
            };
          }
        })
      );
      
      setStakePoolStats(poolStats);
    } catch (err) {
      console.error('Failed to fetch stake pool stats:', err);
    } finally {
      setLoadingStakeStats(false);
    }
  };

  useEffect(() => {
    fetchStakePoolStats();
  }, []);

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

  // Helper to get address label
  const getAddressLabel = (address) => {
    if (KNOWN_ADDRESSES[address]) {
      return {
        label: KNOWN_ADDRESSES[address].label,
        color: KNOWN_ADDRESSES[address].color,
        isKnown: true
      };
    }
    return { label: null, color: null, isKnown: false };
  };

  // Fetch whale transactions
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
            
            // Find balance changes
            const balanceChanges = [];
            for (let j = 0; j < Math.min(preBalances.length, accountKeys.length); j++) {
              const change = (postBalances[j] - preBalances[j]) / 1e9;
              if (Math.abs(change) > 0.00001) {
                balanceChanges.push({ 
                  idx: j, 
                  change, 
                  address: accountKeys[j] || 'unknown'
                });
              }
            }
            
            balanceChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
            
            const sender = balanceChanges.find(c => c.change < -0.00001);
            const receiver = balanceChanges.find(c => c.change > 0.00001);
            
            if (sender && receiver && sender.address && receiver.address) {
              const maxTransfer = Math.abs(sender.change);
              const fromAddress = sender.address;
              const toAddress = receiver.address;
              
              if (maxTransfer >= minAmount) {
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
                  from: fromAddress,
                  to: toAddress,
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
      
      console.log(`Found ${whaleTxs.length} whale transactions >= ${minAmount} XNT`);
      
      const prevIds = new Set(transactions.map(t => t.id));
      whaleTxs.forEach(tx => {
        if (!prevIds.has(tx.id)) {
          tx.isNew = true;
          triggerAlert(tx);
        }
      });
      
      setTransactions(whaleTxs);
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
      const interval = setInterval(() => {
        fetchWhaleTransactions();
      }, 15000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, minAmount]);

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

  // Filter and sort
  let filteredTxs = transactions.filter(tx => {
    if (filterType !== 'all' && tx.type !== filterType) return false;
    
    if (filterAddress && filterAddress.length >= 8) {
      const addrLower = filterAddress.toLowerCase();
      const fromMatch = tx.from?.toLowerCase().includes(addrLower);
      const toMatch = tx.to?.toLowerCase().includes(addrLower);
      if (!fromMatch && !toMatch) return false;
    }
    
    if (dateFrom || dateTo) {
      const txDate = new Date(tx.timestamp);
      if (dateFrom && txDate < new Date(dateFrom)) return false;
      if (dateTo && txDate > new Date(dateTo + 'T23:59:59')) return false;
    }
    
    return true;
  });
  
  filteredTxs = [...filteredTxs].sort((a, b) => {
    let aVal, bVal;
    switch (sortField) {
      case 'amount':
        aVal = a.amount;
        bVal = b.amount;
        break;
      case 'timestamp':
        aVal = a.timestamp;
        bVal = b.timestamp;
        break;
      case 'slot':
        aVal = a.slot;
        bVal = b.slot;
        break;
      default:
        return 0;
    }
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const totalVolume = filteredTxs.reduce((sum, tx) => sum + tx.amount, 0);
  const stakeVolume = transactions.filter(t => t.type === 'stake').reduce((sum, t) => sum + t.amount, 0);
  const unstakeVolume = transactions.filter(t => t.type === 'unstake').reduce((sum, t) => sum + t.amount, 0);
  const totalStaked = stakePoolStats?.reduce((sum, pool) => sum + pool.balance, 0) || 0;

  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <header className="bg-[#1d2d3a] border-b border-white/5">
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Link to={createPageUrl('Dashboard')}>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </Link>
              <Fish className="w-6 h-6 text-cyan-400" />
              <h1 className="text-2xl font-bold">Whale Watcher</h1>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0">Live</Badge>
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
              {isLive ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsLive(false)}
                  className="border-white/20 text-red-400 hover:bg-red-500/10"
                >
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse mr-2" />
                  Stop
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsLive(true)}
                  className="border-white/20 text-emerald-400 hover:bg-emerald-500/10"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2" />
                  Start
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-6">
        {/* Top Row: Stats + Stake Pools */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Stats Cards */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-[#1d2d3a] border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Whale Txs</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{filteredTxs.length}</p>
                </CardContent>
              </Card>
              <Card className="bg-[#1d2d3a] border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Total Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-cyan-400">{formatAmount(totalVolume)}</p>
                  <p className="text-xs text-gray-500">XNT</p>
                </CardContent>
              </Card>
              <Card className="bg-[#1d2d3a] border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Stake Inflow</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-emerald-400">+{formatAmount(stakeVolume)}</p>
                  <p className="text-xs text-gray-500">XNT</p>
                </CardContent>
              </Card>
              <Card className="bg-[#1d2d3a] border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-400">Unstake Outflow</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-red-400">-{formatAmount(unstakeVolume)}</p>
                  <p className="text-xs text-gray-500">XNT</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Stake Pool Dashboard */}
          <Card className="bg-[#1d2d3a] border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  Stake Pools
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={fetchStakePoolStats}
                  disabled={loadingStakeStats}
                  className="h-6 w-6 p-0"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingStakeStats ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingStakeStats ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                </div>
              ) : stakePoolStats && stakePoolStats.length > 0 ? (
                <div className="space-y-3">
                  <div className="bg-[#0f1419] rounded-lg p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">Total Staked</span>
                      <span className="text-sm font-bold text-purple-400">{formatAmount(totalStaked)} XNT</span>
                    </div>
                  </div>
                  {stakePoolStats.map((pool) => (
                    <div key={pool.address} className="bg-[#0f1419] rounded-lg p-3 border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <Badge className={`${pool.color} border-0 text-xs`}>
                          {pool.label}
                        </Badge>
                        <a 
                          href={pool.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-cyan-400 hover:text-cyan-300"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Balance:</span>
                          <span className="text-white font-mono">{formatAmount(pool.balance)} XNT</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Address:</span>
                          <span className="text-gray-500 font-mono">{pool.address.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">No stake pools tracked</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-[#1d2d3a] border-white/10 mb-6">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Amount Filter */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400 text-sm">Min Amount:</span>
                </div>
                {[1000, 10000, 50000, 100000, 500000].map((val) => (
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
                <div className="flex gap-2 items-center">
                  <Input 
                    type="number"
                    placeholder="Custom"
                    value={customThreshold}
                    onChange={(e) => setCustomThreshold(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && setMinAmount(parseFloat(customThreshold))}
                    className="w-32 bg-[#0f1419] border-white/10 text-white"
                  />
                  <Button 
                    onClick={() => setMinAmount(parseFloat(customThreshold))} 
                    size="sm" 
                    className="bg-cyan-500 hover:bg-cyan-600"
                  >
                    Set
                  </Button>
                </div>
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-2 flex-wrap">
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
                  <Button onClick={fetchWhaleTransactions} className="bg-cyan-500 hover:bg-cyan-600">
                    <Fish className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
              
              {/* Advanced Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/10">
                <Input 
                  placeholder="Filter by address..."
                  value={filterAddress}
                  onChange={(e) => setFilterAddress(e.target.value)}
                  className="bg-[#0f1419] border-white/10 text-white"
                />
                <Input 
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-[#0f1419] border-white/10 text-white"
                />
                <Input 
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-[#0f1419] border-white/10 text-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        ) : filteredTxs.length === 0 ? (
          <Card className="bg-[#1d2d3a] border-white/10">
            <CardContent className="py-20 text-center">
              <Fish className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h2 className="text-xl text-gray-400 mb-2">No whale transactions found</h2>
              <p className="text-gray-500">Lower threshold or wait for new transactions</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-[#1d2d3a] border-white/10">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Type</th>
                      <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">
                        <button onClick={() => { setSortField('amount'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }} className="hover:text-white">
                          Amount {sortField === 'amount' && (sortOrder === 'desc' ? '↓' : '↑')}
                        </button>
                      </th>
                      <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">From</th>
                      <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">To</th>
                      <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">
                        <button onClick={() => { setSortField('slot'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }} className="hover:text-white">
                          Slot {sortField === 'slot' && (sortOrder === 'desc' ? '↓' : '↑')}
                        </button>
                      </th>
                      <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">
                        <button onClick={() => { setSortField('timestamp'); setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc'); }} className="hover:text-white ml-auto">
                          Time {sortField === 'timestamp' && (sortOrder === 'desc' ? '↓' : '↑')}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTxs.map((tx) => {
                      const fromLabel = getAddressLabel(tx.from);
                      const toLabel = getAddressLabel(tx.to);
                      
                      return (
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
                        </td>
                        <td className="px-4 py-3">
                          {fromLabel.isKnown ? (
                            <div>
                              <Badge className={`${fromLabel.color} border-0 text-xs mb-1`}>
                                {fromLabel.label}
                              </Badge>
                              <div className="text-gray-500 text-xs font-mono">
                                {tx.from.substring(0, 8)}...
                              </div>
                            </div>
                          ) : (
                            <span className="text-cyan-400 font-mono text-sm">
                              {tx.from.substring(0, 12)}...{tx.from.slice(-6)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {toLabel.isKnown ? (
                            <div>
                              <Badge className={`${toLabel.color} border-0 text-xs mb-1`}>
                                {toLabel.label}
                              </Badge>
                              <div className="text-gray-500 text-xs font-mono">
                                {tx.to.substring(0, 8)}...
                              </div>
                            </div>
                          ) : (
                            <span className="text-emerald-400 font-mono text-sm">
                              {tx.to.substring(0, 12)}...{tx.to.slice(-6)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-400 font-mono text-sm">
                            {tx.slot?.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm ${tx.isNew ? 'text-cyan-400' : 'text-gray-400'}`}>
                            {tx.isNew && <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse mr-2" />}
                            {formatTime(tx.timestamp)}
                          </span>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alerts Section */}
        {alertsEnabled && (
          <Card className="bg-yellow-500/10 border-yellow-500/30 mt-6">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <div>
                  <span className="text-yellow-400 font-medium">Whale Alert Active</span>
                  <p className="text-gray-400 text-sm mt-1">
                    Notifications enabled for transactions ≥{formatAmount(minAmount)} XNT
                    {soundEnabled && ' · Sound alerts enabled'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
