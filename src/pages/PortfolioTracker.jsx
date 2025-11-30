import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, Loader2, Wallet, TrendingUp, TrendingDown, RefreshCw,
  Plus, Trash2, Eye, EyeOff, ArrowUpRight, ArrowDownRight, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, AreaChart, Area } from 'recharts';
import X1Rpc from '../components/x1/X1RpcService';

export default function PortfolioTracker() {
  const [wallets, setWallets] = useState([]);
  const [newWallet, setNewWallet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [portfolioData, setPortfolioData] = useState(null);
  const [hideBalances, setHideBalances] = useState(false);
  const [walletBalances, setWalletBalances] = useState({});

  // Load wallets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('x1_portfolio_wallets');
    if (saved) {
      const parsed = JSON.parse(saved);
      setWallets(parsed);
    }
  }, []);

  // Save wallets to localStorage
  useEffect(() => {
    localStorage.setItem('x1_portfolio_wallets', JSON.stringify(wallets));
  }, [wallets]);

  const addWallet = async () => {
    if (!newWallet || wallets.find(w => w.address === newWallet)) return;
    
    // Validate address format (base58, 32-44 chars)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(newWallet)) {
      setError('Invalid wallet address format');
      return;
    }
    
    setWallets([...wallets, { address: newWallet, label: `Wallet ${wallets.length + 1}` }]);
    setNewWallet('');
    setError(null);
  };

  const removeWallet = (address) => {
    setWallets(wallets.filter(w => w.address !== address));
    const newBalances = { ...walletBalances };
    delete newBalances[address];
    setWalletBalances(newBalances);
  };

  // Fetch real wallet data from RPC
  const fetchPortfolio = async () => {
    if (wallets.length === 0) {
      setPortfolioData(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const balancePromises = wallets.map(async (wallet) => {
        try {
          // Get balance
          const balanceResult = await X1Rpc.getBalance(wallet.address);
          const balance = (balanceResult?.value || 0) / 1e9;
          
          // Get stake accounts
          let stakedAmount = 0;
          try {
            const stakeAccounts = await X1Rpc.getStakeAccounts(wallet.address);
            if (stakeAccounts?.length) {
              stakedAmount = stakeAccounts.reduce((sum, acc) => {
                const lamports = acc.account?.lamports || 0;
                return sum + lamports;
              }, 0) / 1e9;
            }
          } catch (e) {
            // Stake accounts may not exist
          }
          
          // Get recent transactions
          let recentTxs = [];
          try {
            const sigs = await X1Rpc.getSignaturesForAddress(wallet.address, { limit: 10 });
            recentTxs = sigs || [];
          } catch (e) {
            // May fail for new wallets
          }
          
          return {
            address: wallet.address,
            label: wallet.label,
            balance,
            stakedAmount,
            totalBalance: balance + stakedAmount,
            recentTxs: recentTxs.length
          };
        } catch (e) {
          return {
            address: wallet.address,
            label: wallet.label,
            balance: 0,
            stakedAmount: 0,
            totalBalance: 0,
            error: e.message
          };
        }
      });
      
      const results = await Promise.all(balancePromises);
      
      // Update wallet balances
      const newBalances = {};
      results.forEach(r => {
        newBalances[r.address] = r;
      });
      setWalletBalances(newBalances);
      
      // Calculate totals
      const totalBalance = results.reduce((sum, r) => sum + r.totalBalance, 0);
      const totalStaked = results.reduce((sum, r) => sum + r.stakedAmount, 0);
      const totalAvailable = results.reduce((sum, r) => sum + r.balance, 0);
      
      // Estimate rewards (~8% APY)
      const dailyReward = (totalStaked * 0.08) / 365;
      const monthlyReward = dailyReward * 30;
      
      // Build historical chart (simulated based on current balance)
      const history = [];
      let historicalValue = totalBalance * 0.95;
      for (let i = 30; i >= 0; i--) {
        historicalValue += dailyReward + (Math.random() - 0.3) * (totalBalance * 0.001);
        history.push({
          day: i === 0 ? 'Today' : `${i}d`,
          value: Math.max(0, Math.round(historicalValue * 100) / 100)
        });
      }
      
      // Get current epoch for rewards estimation
      const epochInfo = await X1Rpc.getEpochInfo();
      
      setPortfolioData({
        totalBalance,
        stakedAmount: totalStaked,
        availableBalance: totalAvailable,
        dailyReward,
        monthlyReward,
        totalRewardsEarned: monthlyReward * 3, // Estimate
        change24h: dailyReward > 0 ? (dailyReward / totalBalance) * 100 : 0,
        history,
        epoch: epochInfo.epoch,
        walletCount: wallets.length
      });
      
    } catch (err) {
      console.error('Portfolio fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, [wallets.length]);

  const formatNumber = (num) => {
    if (hideBalances) return '••••••';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num?.toFixed(4) || '0';
  };

  const pieData = portfolioData ? [
    { name: 'Staked', value: portfolioData.stakedAmount, color: '#06b6d4' },
    { name: 'Available', value: portfolioData.availableBalance, color: '#10b981' }
  ].filter(d => d.value > 0) : [];

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <header className="border-b border-white/10">
        <div className="max-w-[1400px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2 hover:opacity-80">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
                <span className="font-bold text-xl"><span className="text-cyan-400">X1</span><span className="text-white">Space</span></span>
              </Link>
              <span className="text-gray-400">|</span>
              <span className="text-white text-xl font-light">Portfolio Tracker</span>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0">Live RPC</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setHideBalances(!hideBalances)}>
                {hideBalances ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
              </Button>
              <Button variant="outline" size="sm" onClick={fetchPortfolio} disabled={loading} className="border-white/20">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {/* Add Wallet */}
        <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4 mb-6">
          <h3 className="text-white font-medium mb-3">Track Wallets</h3>
          <div className="flex gap-2">
            <Input 
              placeholder="Enter X1 wallet address (e.g., 7Vhw...)"
              value={newWallet}
              onChange={(e) => setNewWallet(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addWallet()}
              className="bg-[#1a2436] border-white/10 text-white font-mono"
            />
            <Button onClick={addWallet} className="bg-cyan-500 hover:bg-cyan-600">
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>
          
          {wallets.length > 0 && (
            <div className="mt-4 space-y-2">
              {wallets.map((w) => {
                const data = walletBalances[w.address];
                return (
                  <div key={w.address} className="flex items-center justify-between bg-[#1a2436] rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Wallet className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <span className="text-gray-400 font-mono text-sm truncate">{w.address}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {data && !data.error && (
                        <span className="text-white font-mono text-sm">
                          {hideBalances ? '••••' : formatNumber(data.totalBalance)} XNT
                        </span>
                      )}
                      {data?.error && (
                        <span className="text-red-400 text-xs">Error</span>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => removeWallet(w.address)}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {wallets.length === 0 ? (
          <div className="text-center py-20">
            <Wallet className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl text-gray-400 mb-2">No wallets tracked</h2>
            <p className="text-gray-500">Add a wallet address above to start tracking your portfolio</p>
          </div>
        ) : loading && !portfolioData ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        ) : portfolioData && (
          <>
            {/* Portfolio Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Total Balance</p>
                <p className="text-3xl font-bold text-white">{formatNumber(portfolioData.totalBalance)} XNT</p>
                <div className={`flex items-center gap-1 mt-1 ${portfolioData.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {portfolioData.change24h >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  <span className="text-sm">+{portfolioData.change24h.toFixed(4)}% (24h est.)</span>
                </div>
              </div>
              <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Staked Amount</p>
                <p className="text-3xl font-bold text-cyan-400">{formatNumber(portfolioData.stakedAmount)} XNT</p>
                <p className="text-gray-500 text-sm mt-1">~8% APY estimated</p>
              </div>
              <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Est. Daily Rewards</p>
                <p className="text-3xl font-bold text-emerald-400">+{formatNumber(portfolioData.dailyReward)} XNT</p>
                <p className="text-gray-500 text-sm mt-1">≈ ${hideBalances ? '••••' : (portfolioData.dailyReward * 1).toFixed(4)}</p>
              </div>
              <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Available Balance</p>
                <p className="text-3xl font-bold text-white">{formatNumber(portfolioData.availableBalance)} XNT</p>
                <p className="text-gray-500 text-sm mt-1">{portfolioData.walletCount} wallet(s) tracked</p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2 bg-[#0d1525] border border-white/10 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4">Portfolio Value (30 days estimate)</h3>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={portfolioData.history}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} domain={['auto', 'auto']} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0d1525', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        formatter={(value) => [`${value.toFixed(4)} XNT`, 'Balance']}
                      />
                      <Area type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2} fill="url(#colorValue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4">Allocation</h3>
                {pieData.length > 0 ? (
                  <>
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                            {pieData.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0d1525', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            formatter={(value) => [`${value.toFixed(4)} XNT`, '']}
                          />
                        </RechartsPie>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 mt-2">
                      {pieData.map((item) => (
                        <div key={item.name} className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-gray-400 text-sm">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-500">
                    No allocation data
                  </div>
                )}
              </div>
            </div>

            {/* Wallet Details */}
            <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4">
              <h3 className="text-white font-medium mb-4">Wallet Breakdown</h3>
              <div className="space-y-3">
                {Object.values(walletBalances).map((data) => (
                  <div key={data.address} className="flex items-center justify-between bg-[#1a2436] rounded-lg p-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Wallet className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-white font-mono text-sm truncate">{data.address}</p>
                        <p className="text-gray-500 text-xs">{data.recentTxs || 0} recent transactions</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-white font-mono">{hideBalances ? '••••••' : formatNumber(data.totalBalance)} XNT</p>
                      {data.stakedAmount > 0 && (
                        <p className="text-cyan-400 text-xs">{hideBalances ? '••••' : formatNumber(data.stakedAmount)} staked</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Info */}
            <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <p className="text-blue-400 text-sm">
                💡 Data fetched directly from X1 RPC. Rewards are estimated based on ~8% APY. 
                Historical chart is estimated based on current balance and staking rewards.
                Current Epoch: {portfolioData.epoch}
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}