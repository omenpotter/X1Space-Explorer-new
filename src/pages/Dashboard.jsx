import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, memo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Zap, AlertCircle, Globe, Calculator, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Lazy load components
const ThemeToggle = lazy(() => import('../components/common/ThemeToggle'));
const GlobalSearch = lazy(() => import('../components/common/GlobalSearch'));

const MobileNav = lazy(() => import('../components/layout/MobileNav'));
const MempoolViz = lazy(() => import('../components/x1/MempoolViz'));
const QuickLinks = lazy(() => import('../components/dashboard/QuickLinks'));
const RecentBlocksTable = lazy(() => import('@/components/dashboard/RecentBlocksTable'));
const MempoolLegend = lazy(() => import('../components/x1/MempoolViz').then(m => ({ default: m.MempoolLegend })));

// Lazy load recharts
const LazyChart = lazy(() => import('recharts').then(m => ({
  default: memo(({ data }) => {
    const { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } = m;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} width={50} />
          <Tooltip contentStyle={{ backgroundColor: '#1d2d3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} labelStyle={{ color: '#9ca3af' }} formatter={(value) => [`${value.toLocaleString()} TPS`, 'Avg TPS']} />
          <Line type="monotone" dataKey="tps" stroke="#eab308" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  })
})));

const MiniFallback = memo(() => <div className="w-5 h-5" />);

// Import RPC service directly for faster initial load
import X1Rpc from '../components/x1/X1RpcService';

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [recentBlocks, setRecentBlocks] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tpsInterval, setTpsInterval] = useState('1m');
  const [mempoolInterval, setMempoolInterval] = useState('1m');
  const [performanceData, setPerformanceData] = useState([]);
  const [pendingTxCount, setPendingTxCount] = useState(0);

  const aggregatedTpsData = useMemo(() => {
    if (!dashboardData?.tpsHistory?.length) return [];
    
    const history = dashboardData.tpsHistory;
    if (tpsInterval === '1m') {
      return history;
    }
    
    const aggregated = [];
    for (let i = 0; i < history.length; i += 10) {
      const chunk = history.slice(i, i + 10);
      const avgTps = Math.round(chunk.reduce((sum, d) => sum + d.tps, 0) / chunk.length);
      aggregated.push({
        time: `${Math.floor(i / 10) * 10}m`,
        tps: avgTps
      });
    }
    return aggregated;
  }, [dashboardData?.tpsHistory, tpsInterval]);

  const fetchData = React.useCallback(async () => {
    try {
      // Fetch dashboard data and blocks first (most important)
      const [data, blocks] = await Promise.all([
        X1Rpc.getDashboardData().catch(err => {
          console.error('Dashboard data error:', err);
          return dashboardData; // Keep existing data on error
        }),
        X1Rpc.getRecentBlocks(10).catch(err => {
          console.error('Recent blocks error:', err);
          return recentBlocks; // Keep existing data on error
        })
      ]);
      
      // Only update if we got valid data
      if (data && Object.keys(data).length > 0) {
        setDashboardData(data);
        setError(null);
      }
      if (blocks && blocks.length > 0) {
        setRecentBlocks(blocks);
      }
      
      setLastUpdate(new Date());
      setLoading(false);
      
      // Fetch secondary data in background (non-blocking)
      Promise.all([
        X1Rpc.getPerformanceHistory(60).catch(() => performanceData),
        X1Rpc.getPendingTransactions().catch(() => [])
      ]).then(([perfHistory, pendingTxs]) => {
        if (perfHistory && perfHistory.length > 0) {
          setPerformanceData(perfHistory);
        }
        setPendingTxCount(pendingTxs.length);
      }).catch(err => {
        console.warn('Secondary data fetch failed:', err);
      });
    } catch (err) {
      console.error('Failed to fetch data:', err);
      // Don't clear existing data on error
      if (!dashboardData) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, [dashboardData, recentBlocks, performanceData]);

  const aggregatedBlocks = useMemo(() => {
    // Calculate ratios from recent blocks data (actual on-chain tx types)
    let voteRatio = 0.70, transferRatio = 0.12, programRatio = 0.09, otherRatio = 0.09;
    if (recentBlocks.length > 0) {
      const totalTx = recentBlocks.reduce((sum, b) => sum + (b.txCount || 0), 0);
      const totalVote = recentBlocks.reduce((sum, b) => sum + (b.voteCount || 0), 0);
      const totalTransfer = recentBlocks.reduce((sum, b) => sum + (b.transferCount || 0), 0);
      const totalProgram = recentBlocks.reduce((sum, b) => sum + (b.programCount || 0), 0);
      const totalOther = recentBlocks.reduce((sum, b) => sum + (b.otherCount || 0), 0);
      if (totalTx > 0) {
        voteRatio = totalVote / totalTx;
        transferRatio = totalTransfer / totalTx;
        programRatio = totalProgram / totalTx;
        otherRatio = totalOther / totalTx;
      }
    }
    
    const aggregated = [];
    
    if (mempoolInterval === '1m') {
      const availableSamples = Math.min(10, performanceData.length);
      for (let i = 0; i < availableSamples; i++) {
        const sample = performanceData[i];
        if (!sample) continue;
        const totalTxns = sample.transactions;
        const slots = sample.slots;
        
        // Apply ratios from actual block data
        const voteCount = Math.round(totalTxns * voteRatio);
        const transferCount = Math.round(totalTxns * transferRatio);
        const programCount = Math.round(totalTxns * programRatio);
        const otherCount = Math.max(0, totalTxns - voteCount - transferCount - programCount);
        
        aggregated.push({
          totalTxns,
          slots,
          label: i === 0 ? 'Now' : `${i}m ago`,
          voteCount,
          transferCount,
          programCount,
          otherCount,
          timestamp: Date.now() - (i * 60 * 1000),
          isRealData: true
        });
      }
    } else {
      const maxWindows = Math.floor(performanceData.length / 10);
      const windowsToShow = Math.min(6, maxWindows);
      
      for (let i = 0; i < windowsToShow; i++) {
        let totalTxns = 0;
        let totalSlots = 0;
        let hasAllData = true;
        
        for (let j = 0; j < 10; j++) {
          const sampleIdx = i * 10 + j;
          const sample = performanceData[sampleIdx];
          if (!sample) {
            hasAllData = false;
            break;
          }
          totalTxns += sample.transactions;
          totalSlots += sample.slots;
        }
        
        if (!hasAllData) break;
        
        const voteCount = Math.round(totalTxns * voteRatio);
        const transferCount = Math.round(totalTxns * transferRatio);
        const programCount = Math.round(totalTxns * programRatio);
        const otherCount = Math.max(0, totalTxns - voteCount - transferCount - programCount);
        
        aggregated.push({
          totalTxns,
          slots: totalSlots,
          label: i === 0 ? 'Now' : `${i * 10}m ago`,
          voteCount,
          transferCount,
          programCount,
          otherCount,
          timestamp: Date.now() - (i * 10 * 60 * 1000),
          isRealData: true
        });
      }
    }
    
    return aggregated.length > 0 ? aggregated : [];
  }, [mempoolInterval, recentBlocks, performanceData]);

  useEffect(() => {
    // Fetch immediately on mount for fast initial load
    fetchData();
    // Refresh every 3 seconds for live slot updates at 3000+ TPS
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSearch = () => {
    if (searchQuery) {
      window.location.href = createPageUrl('Search') + `?q=${searchQuery}`;
    }
  };

  const formatNumber = (num) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num?.toLocaleString() || '0';
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `~${h}h ${m}m` : `~${m}m`;
  };

  // Show skeleton UI while loading instead of full-screen loader
  const showSkeleton = loading && !dashboardData;

  return (
    <>
      <title>X1 Blockchain Explorer | Real-time Network Stats & Analytics</title>
      <meta name="description" content="X1Space - Real-time X1 blockchain explorer with live network stats, validators, transactions, and token analytics. Track TPS, blocks, and validator performance." />
    <div className="min-h-screen bg-[#1d2d3a] text-white">
      {/* Header */}
      <header className="bg-[#1d2d3a] border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
                <Suspense fallback={<MiniFallback />}>
                  <MobileNav />
                </Suspense>
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-black font-black text-sm">X1</span>
              </div>
              <span className="hidden sm:block font-bold"><span className="text-cyan-400">X1</span><span className="text-white">Space</span></span>
              <div className="ml-2 px-2 py-0.5 bg-cyan-500/20 rounded text-cyan-400 text-xs font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Mainnet
              </div>
            </div>
            
            <nav className="flex items-center gap-1">
              <Link to={createPageUrl('Dashboard')} aria-label="Dashboard">
                <Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg" aria-label="Dashboard">
                  <Zap className="w-5 h-5" />
                </Button>
              </Link>
              <Link to={createPageUrl('Blocks')} aria-label="Blocks">
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg" aria-label="Blocks">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                  </svg>
                </Button>
              </Link>
              <Link to={createPageUrl('Validators')} aria-label="Validators">
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg" aria-label="Validators">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M3 3v18h18" />
                    <path d="M18 17V9" />
                    <path d="M13 17V5" />
                    <path d="M8 17v-3" />
                  </svg>
                </Button>
              </Link>
              <Link to={createPageUrl('Transactions')} aria-label="Transactions">
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg" aria-label="Transactions">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </Button>
              </Link>
              <Link to={createPageUrl('NetworkHealth')} aria-label="Network Health">
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg" aria-label="Network Health">
                  <Globe className="w-5 h-5" />
                </Button>
              </Link>
              <Link to={createPageUrl('StakingCalculator')} aria-label="Staking Calculator">
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg" aria-label="Staking Calculator">
                  <Calculator className="w-5 h-5" />
                </Button>
              </Link>
              <Link to={createPageUrl('AddressLookup')} aria-label="Address Lookup">
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg" aria-label="Address Lookup">
                  <Wallet className="w-5 h-5" />
                </Button>
              </Link>
              <Link to={createPageUrl('CustomDashboard')} aria-label="Custom Dashboard">
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg" aria-label="Custom Dashboard">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="9" rx="1" />
                    <rect x="14" y="3" width="7" height="5" rx="1" />
                    <rect x="14" y="12" width="7" height="9" rx="1" />
                    <rect x="3" y="16" width="7" height="5" rx="1" />
                  </svg>
                </Button>
              </Link>

              <Link to={createPageUrl('TokenExplorer')} aria-label="Token Explorer">
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg" aria-label="Token Explorer">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="8" />
                    <path d="M12 2v20M2 12h20" />
                  </svg>
                </Button>
              </Link>
            </nav>

            <div className="hidden md:flex items-center gap-3 mr-4">
              <a href="https://x.com/rkbehelvi" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors" aria-label="Follow us on X (Twitter)">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href="https://t.me/+HtiLywX2Dug3MjJk" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-cyan-400 transition-colors" aria-label="Join us on Telegram">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
              </a>
            </div>

            <div className="flex-1 max-w-md">
              <div className="relative">
                <Input
                  placeholder="Explore the X1 ecosystem"
                  className="w-full bg-[#24384a] border-0 text-white placeholder:text-gray-500 pr-10 rounded-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button 
                  size="icon" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 bg-cyan-500 hover:bg-cyan-600 h-7 w-7 rounded"
                  onClick={handleSearch}
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
            <span>Error connecting to X1 RPC: {error}</span>
            <Button variant="ghost" size="sm" onClick={fetchData} className="ml-auto text-red-400">
              Retry
            </Button>
          </div>
        </div>
      )}

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Block Visualization */}
        <div className="flex flex-col gap-4 mb-8">
          {/* X1 View Box */}
          <div className="bg-[#24384a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-white font-medium">X1 View</span>
                <div className="flex gap-1 bg-[#1d2d3a] rounded-lg p-1">
                  {['1m', '10m'].map((interval) => (
                    <button
                      key={interval}
                      onClick={() => setMempoolInterval(interval)}
                      className={`px-3 py-1.5 text-xs rounded ${mempoolInterval === interval ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      {interval}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Suspense fallback={<div className="h-4" aria-hidden="true" />}>
                          <MempoolLegend />
                        </Suspense>
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-emerald-400 text-sm font-medium">XNT $1.00</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">OTC</Badge>
                </div>
              </div>
            </div>
            <Suspense fallback={<div className="flex gap-2">{Array(10).fill(0).map((_, i) => <div key={i} className="w-[100px] h-[140px] bg-slate-800/50 rounded-lg animate-pulse" />)}</div>}>
              <MempoolViz 
                mempoolInterval={mempoolInterval}
                recentBlocks={recentBlocks}
                aggregatedBlocks={aggregatedBlocks}
                dashboardSlot={dashboardData?.slot}
                showPending={true}
                pendingCount={pendingTxCount}
              />
            </Suspense>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Live Network Stats */}
            <div className="bg-[#24384a] rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-400 text-sm">LIVE NETWORK STATS</h3>
                {lastUpdate && (
                  <span className="text-xs text-gray-600">
                    Updated {lastUpdate.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Current Slot</p>
                  <p className="text-white font-bold text-lg font-mono">
                    {dashboardData?.slot?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">TPS</p>
                  <p className="text-cyan-400 font-bold text-lg">
                    {dashboardData?.tps?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Total TXs</p>
                  <p className="text-white font-bold text-lg">
                    {formatNumber(dashboardData?.transactionCount || 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Supply Info */}
            <div className="bg-[#24384a] rounded-xl p-4">
              <h3 className="text-gray-400 text-sm mb-4">SUPPLY</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Circulating</p>
                  <p className="text-cyan-400 font-bold text-xl">
                    {formatNumber(dashboardData?.supply?.circulating)} XNT
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Total Supply</p>
                  <p className="text-white font-bold text-xl">
                    {formatNumber(dashboardData?.supply?.total)} XNT
                  </p>
                </div>
              </div>
            </div>

            {/* Validators */}
            <div className="bg-[#24384a] rounded-xl p-4">
              <h3 className="text-gray-400 text-sm mb-4">VALIDATORS</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Active</p>
                  <p className="text-emerald-400 font-bold text-xl">
                    {dashboardData?.validators?.current || '0'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Delinquent</p>
                  <p className="text-red-400 font-bold text-xl">
                    {dashboardData?.validators?.delinquent || '0'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Total Stake</p>
                  <p className="text-white font-bold text-xl">
                    {formatNumber(dashboardData?.validators?.totalStake || 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Epoch Progress */}
            <div className="bg-[#24384a] rounded-xl p-4">
              <h3 className="text-gray-400 text-sm mb-3">EPOCH {dashboardData?.epoch || '0'} PROGRESS</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-3 bg-[#1d2d3a] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500 to-green-500 rounded-full transition-all duration-500" 
                      style={{ width: `${dashboardData?.epochProgress || 0}%` }} 
                    />
                  </div>
                </div>
                <span className="text-white font-bold">{dashboardData?.epochProgress || 0}%</span>
              </div>
              <div className="flex items-center justify-between mt-3 text-sm">
                <span className="text-gray-400">
                  {dashboardData?.slotsRemaining?.toLocaleString() || '-'} slots remaining
                </span>
                <span className="text-white">
                  {formatTime(dashboardData?.timeRemaining || 0)}
                </span>
              </div>
            </div>

            {/* TPS Chart */}
            <div className="bg-[#24384a] rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-cyan-400 text-sm">TPS HISTORY</h3>
                <div className="flex gap-1">
                  {['1m', '10m'].map((interval) => (
                    <button
                      key={interval}
                      onClick={() => setTpsInterval(interval)}
                      className={`px-2 py-1 text-xs rounded ${tpsInterval === interval ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      {interval}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[200px]">
                {aggregatedTpsData.length > 0 ? (
                  <Suspense fallback={<div className="h-full flex items-center justify-center text-gray-500">Loading chart...</div>}>
                    <LazyChart data={aggregatedTpsData} tpsInterval={tpsInterval} />
                  </Suspense>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    Loading TPS data...
                  </div>
                )}
              </div>
            </div>


          </div>
        </div>

        {/* Quick Links and Recent Blocks - Lazy loaded */}
        <Suspense fallback={<div className="mt-8 h-32 bg-slate-800/20 rounded-xl animate-pulse" />}>
          <QuickLinks />
          <RecentBlocksTable blocks={recentBlocks} />
        </Suspense>
      </main>
      </div>
      </>
      );
      }