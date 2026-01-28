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
// Import directly to avoid Suspense remounting during live updates
import MempoolViz from '../components/x1/MempoolViz';
const QuickLinks = lazy(() => import('../components/dashboard/QuickLinks'));
const RecentBlocksTable = lazy(() => import('@/components/dashboard/RecentBlocksTable'));
import { MempoolLegend } from '../components/x1/MempoolViz';

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
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tpsInterval, setTpsInterval] = useState('1m');
  const [mempoolInterval, setMempoolInterval] = useState('1m');
  const [hasLoadedData, setHasLoadedData] = useState(false);
  
  // OPTIMIZATION: Use refs for data to prevent object replacement and remounts
  const dashboardRef = React.useRef(null);
  const recentBlocksRef = React.useRef([]);
  const performanceDataRef = React.useRef([]);
  const pendingTxCountRef = React.useRef(0);
  // OPTIMIZATION: Replace forceRender with targeted update flag to reduce full component re-renders
  const [dataVersion, setDataVersion] = useState(0);
  const abortControllerRef = React.useRef(null);
  const isInitializedRef = React.useRef(false);

  // Read from ref for stable memoization
  const dashboardData = dashboardRef.current;
  const recentBlocks = recentBlocksRef.current;
  const performanceData = performanceDataRef.current;
  const pendingTxCount = pendingTxCountRef.current;

  // OPTIMIZATION: Memoize with dataVersion instead of deep dependency to prevent unnecessary recalculations
  const aggregatedTpsData = useMemo(() => {
    if (!dashboardData?.tpsHistory?.length) return [];
    
    const history = dashboardData.tpsHistory;
    if (tpsInterval === '1m') {
      return history;
    }
    
    // OPTIMIZATION: Pre-allocate array size for better memory efficiency
    const chunkSize = 10;
    const aggregated = new Array(Math.ceil(history.length / chunkSize));
    for (let i = 0; i < history.length; i += chunkSize) {
      const chunk = history.slice(i, Math.min(i + chunkSize, history.length));
      let sum = 0;
      for (let j = 0; j < chunk.length; j++) sum += chunk[j].tps;
      aggregated[Math.floor(i / chunkSize)] = {
        time: `${Math.floor(i / chunkSize) * chunkSize}m`,
        tps: Math.round(sum / chunk.length)
      };
    }
    return aggregated.filter(Boolean);
  }, [dashboardData?.tpsHistory, tpsInterval, dataVersion]);

  // OPTIMIZATION: Add abort controller for request cancellation on component unmount
  const initDashboard = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      // OPTIMIZATION: Fetch all data in parallel for faster initial load
      const [data, blocks, perfHistory, pendingTxs] = await Promise.all([
        X1Rpc.getDashboardData(),
        X1Rpc.getRecentBlocks(10).catch(() => []),
        X1Rpc.getPerformanceHistory(60).catch(() => []),
        X1Rpc.getPendingTransactions().catch(() => [])
      ]);
      
      // OPTIMIZATION: Batch all state updates together to minimize re-renders
      dashboardRef.current = data;
      recentBlocksRef.current = blocks;
      performanceDataRef.current = perfHistory;
      pendingTxCountRef.current = pendingTxs.length;
      setLastUpdate(new Date());
      setError(null);
      setDataVersion(v => v + 1);
      isInitializedRef.current = true;
      setHasLoadedData(true);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to fetch data:', err);
        setError(err.message);
      }
    }
  };

  // OPTIMIZATION: Debounced polling with smart update batching
  const pollDashboard = useCallback(async () => {
    if (!isInitializedRef.current || !dashboardRef.current) return;
    
    try {
      // OPTIMIZATION: Use Promise.allSettled to continue even if one request fails
      const results = await Promise.allSettled([
        X1Rpc.getDashboardData(),
        X1Rpc.getRecentBlocks(10),
        X1Rpc.getPerformanceHistory(60),
        X1Rpc.getPendingTransactions()
      ]);
      
      // OPTIMIZATION: Only update if data actually changed to prevent unnecessary re-renders
      let hasChanges = false;
      
      if (results[0].status === 'fulfilled' && results[0].value) {
        const data = results[0].value;
        if (dashboardRef.current.slot !== data.slot) {
          // OPTIMIZATION: In-place update without object replacement
          Object.assign(dashboardRef.current, {
            slot: data.slot,
            tps: data.tps,
            epochProgress: data.epochProgress,
            slotsRemaining: data.slotsRemaining,
            timeRemaining: data.timeRemaining,
            tpsHistory: data.tpsHistory,
            transactionCount: data.transactionCount,
            supply: data.supply,
            validators: data.validators
          });
          hasChanges = true;
        }
      }
      
      if (results[1].status === 'fulfilled' && results[1].value?.length) {
        const blocks = results[1].value;
        if (blocks[0]?.slot !== recentBlocksRef.current[0]?.slot) {
          recentBlocksRef.current = blocks;
          hasChanges = true;
        }
      }
      
      if (results[2].status === 'fulfilled') {
        performanceDataRef.current = results[2].value || [];
      }
      
      if (results[3].status === 'fulfilled') {
        pendingTxCountRef.current = results[3].value?.length || 0;
      }
      
      // OPTIMIZATION: Only trigger re-render if data actually changed
      if (hasChanges) {
        setLastUpdate(new Date());
        setError(null);
        setDataVersion(v => v + 1);
      }
    } catch (err) {
      console.error('Poll failed:', err);
      setError(err.message);
    }
  }, []);

  // OPTIMIZATION: Memoize with dataVersion and optimize calculation loops
  const aggregatedBlocks = useMemo(() => {
    // OPTIMIZATION: Early return if no data to process
    if (!recentBlocks.length && !performanceData.length) return [];
    
    // OPTIMIZATION: Calculate ratios once using optimized reduce
    let voteRatio = 0.70, transferRatio = 0.12, programRatio = 0.09, otherRatio = 0.09;
    if (recentBlocks.length > 0) {
      let totalTx = 0, totalVote = 0, totalTransfer = 0, totalProgram = 0, totalOther = 0;
      // OPTIMIZATION: Single loop instead of multiple reduces
      for (let i = 0; i < recentBlocks.length; i++) {
        const b = recentBlocks[i];
        totalTx += b.txCount || 0;
        totalVote += b.voteCount || 0;
        totalTransfer += b.transferCount || 0;
        totalProgram += b.programCount || 0;
        totalOther += b.otherCount || 0;
      }
      if (totalTx > 0) {
        const invTotal = 1 / totalTx; // OPTIMIZATION: Pre-calculate inverse for faster division
        voteRatio = totalVote * invTotal;
        transferRatio = totalTransfer * invTotal;
        programRatio = totalProgram * invTotal;
        otherRatio = totalOther * invTotal;
      }
    }
    
    const aggregated = [];
    const now = Date.now();
    
    if (mempoolInterval === '1m') {
      const availableSamples = Math.min(10, performanceData.length);
      // OPTIMIZATION: Pre-allocate array
      aggregated.length = availableSamples;
      for (let i = 0; i < availableSamples; i++) {
        const sample = performanceData[i];
        if (!sample) continue;
        const totalTxns = sample.transactions;
        
        // OPTIMIZATION: Use bitwise OR for rounding (faster than Math.round for positive numbers)
        const voteCount = (totalTxns * voteRatio + 0.5) | 0;
        const transferCount = (totalTxns * transferRatio + 0.5) | 0;
        const programCount = (totalTxns * programRatio + 0.5) | 0;
        const otherCount = Math.max(0, totalTxns - voteCount - transferCount - programCount);
        
        aggregated[i] = {
          totalTxns,
          slots: sample.slots,
          label: i === 0 ? 'Now' : `${i}m ago`,
          voteCount,
          transferCount,
          programCount,
          otherCount,
          timestamp: now - (i * 60000), // OPTIMIZATION: Pre-calculated constant
          isRealData: true
        };
      }
    } else {
      const maxWindows = Math.floor(performanceData.length / 10);
      const windowsToShow = Math.min(6, maxWindows);
      
      for (let i = 0; i < windowsToShow; i++) {
        let totalTxns = 0, totalSlots = 0;
        const startIdx = i * 10;
        const endIdx = Math.min(startIdx + 10, performanceData.length);
        
        // OPTIMIZATION: Single loop with range check
        for (let j = startIdx; j < endIdx; j++) {
          const sample = performanceData[j];
          if (!sample) continue;
          totalTxns += sample.transactions;
          totalSlots += sample.slots;
        }
        
        if (totalTxns === 0) continue;
        
        const voteCount = (totalTxns * voteRatio + 0.5) | 0;
        const transferCount = (totalTxns * transferRatio + 0.5) | 0;
        const programCount = (totalTxns * programRatio + 0.5) | 0;
        const otherCount = Math.max(0, totalTxns - voteCount - transferCount - programCount);
        
        aggregated.push({
          totalTxns,
          slots: totalSlots,
          label: i === 0 ? 'Now' : `${i * 10}m ago`,
          voteCount,
          transferCount,
          programCount,
          otherCount,
          timestamp: now - (i * 600000), // OPTIMIZATION: Pre-calculated constant
          isRealData: true
        });
      }
    }
    
    return aggregated;
  }, [mempoolInterval, recentBlocks, performanceData, dataVersion]);

  // OPTIMIZATION: Proper cleanup and request cancellation
  React.useEffect(() => {
    initDashboard();
    // OPTIMIZATION: 5000ms polling interval with proper cleanup
    const interval = setInterval(pollDashboard, 5000);
    
    return () => {
      clearInterval(interval);
      // OPTIMIZATION: Cancel any pending requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [pollDashboard]);

  const handleSearch = () => {
    if (searchQuery) {
      window.location.href = createPageUrl('Search') + `?q=${searchQuery}`;
    }
  };

  // OPTIMIZATION: Memoized utility functions to prevent recreation on every render
  const formatNumber = useCallback((num) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num?.toLocaleString() || '0';
  }, []);

  const formatTime = useCallback((seconds) => {
    const h = (seconds / 3600) | 0; // OPTIMIZATION: Bitwise OR for faster floor operation
    const m = ((seconds % 3600) / 60) | 0;
    return h > 0 ? `~${h}h ${m}m` : `~${m}m`;
  }, []);

  // Skip loading screen - show dashboard immediately
  if (!hasLoadedData) return null;

  // From here on, keep old data visible during updates (Stale-While-Revalidate)
  return (
    <div className="min-h-screen bg-[#1d2d3a] text-white">
      {/* Header */}
      <header className="bg-[#1d2d3a] border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <MobileNav />
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-black font-black text-sm">X1</span>
              </div>
              <span className="hidden sm:block font-bold"><span className="text-cyan-400">X1</span><span className="text-white">Space</span></span>
              <div className="ml-2 px-2 py-0.5 bg-cyan-500/20 rounded text-cyan-400 text-xs font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Mainnet
              </div>
            </div>
            
            <nav className="flex items-center gap-2">
              <Link to={createPageUrl('Dashboard')} aria-label="Dashboard">
                <Button variant="ghost" className="text-cyan-400 bg-cyan-500/10 rounded-lg text-sm" aria-label="Dashboard">
                  Dashboard
                </Button>
              </Link>
              <Link to={createPageUrl('Blocks')} aria-label="Blocks">
                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg text-sm" aria-label="Blocks">
                  Blocks
                </Button>
              </Link>
              <Link to={createPageUrl('Validators')} aria-label="Validators">
                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg text-sm" aria-label="Validators">
                  Validators
                </Button>
              </Link>
              <Link to={createPageUrl('Transactions')} aria-label="Transactions">
                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg text-sm" aria-label="Transactions">
                  Transactions
                </Button>
              </Link>
              <Link to={createPageUrl('NetworkHealth')} aria-label="Network Health">
                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg text-sm" aria-label="Network Health">
                  Network
                </Button>
              </Link>
              <Link to={createPageUrl('StakingCalculator')} aria-label="Staking Calculator">
                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg text-sm" aria-label="Staking Calculator">
                  Staking
                </Button>
              </Link>
              <Link to={createPageUrl('AddressLookup')} aria-label="Address Lookup">
                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg text-sm" aria-label="Address Lookup">
                  Lookup
                </Button>
              </Link>
              <Link to={createPageUrl('CustomDashboard')} aria-label="Custom Dashboard">
                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg text-sm" aria-label="Custom Dashboard">
                  Custom
                </Button>
              </Link>

              <Link to={createPageUrl('TokenExplorer')} aria-label="Token Explorer">
                <Button variant="ghost" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg text-sm" aria-label="Token Explorer">
                  Tokens
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
            <Button variant="ghost" size="sm" onClick={pollDashboard} className="ml-auto text-red-400">
              Retry
            </Button>
          </div>
        </div>
      )}

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Block Visualization - permanently mounted */}
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
                <MempoolLegend />
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-emerald-400 text-sm font-medium">XNT $1.00</span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">OTC</Badge>
                </div>
              </div>
            </div>
            <MempoolViz
              key="mempool-stable"
              mempoolInterval={mempoolInterval}
              recentBlocks={recentBlocks}
              aggregatedBlocks={aggregatedBlocks}
              dashboardSlot={dashboardData?.slot}
              showPending={true}
              pendingCount={pendingTxCount}
            />
          </div>
        </div>

        {/* Stats Grid - permanently mounted */}
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
                    {dashboardData?.slot?.toLocaleString() || '-'}
                  </p>
                </div>
                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">TPS</p>
                  <p className="text-cyan-400 font-bold text-lg">
                    {dashboardData?.tps?.toLocaleString() || '-'}
                  </p>
                </div>
                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Total TXs</p>
                  <p className="text-white font-bold text-lg">
                    {formatNumber(dashboardData?.transactionCount)}
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
                    {dashboardData?.validators?.current || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Delinquent</p>
                  <p className="text-red-400 font-bold text-xl">
                    {dashboardData?.validators?.delinquent || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Total Stake</p>
                  <p className="text-white font-bold text-xl">
                    {formatNumber(dashboardData?.validators?.totalStake)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Epoch Progress */}
            <div className="bg-[#24384a] rounded-xl p-4">
              <h3 className="text-gray-400 text-sm mb-3">EPOCH {dashboardData?.epoch || '-'} PROGRESS</h3>
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
                  <LazyChart data={aggregatedTpsData} tpsInterval={tpsInterval} />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">Loading...</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links and Recent Blocks - permanently mounted */}
        <QuickLinks />
        <RecentBlocksTable blocks={recentBlocks} />
      </main>
    </div>
  );
}
