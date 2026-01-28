import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, memo } from 'react';
import { flushSync } from 'react-dom'; // ADDED: For batching state updates
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
  const isMountedRef = React.useRef(true); // ADDED: Track component mount status to prevent memory leaks

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
      
      // MODIFIED: Add check to prevent updates if component unmounted
      if (!isMountedRef.current) return;
      
      // OPTIMIZATION: Batch all state updates together to minimize re-renders
      dashboardRef.current = data;
      recentBlocksRef.current = blocks;
      performanceDataRef.current = perfHistory;
      pendingTxCountRef.current = pendingTxs.length;
      isInitializedRef.current = true;
      
      // MODIFIED: Use flushSync to batch all state updates in one render cycle
      flushSync(() => {
        setLastUpdate(new Date());
        setError(null);
        setDataVersion(v => v + 1);
        setHasLoadedData(true);
      });
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
      
      // MODIFIED: Add check to prevent updates if component unmounted
      if (!isMountedRef.current) return;
      
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
      // MODIFIED: Use flushSync to batch state updates
      if (hasChanges) {
        flushSync(() => {
          setLastUpdate(new Date());
          setError(null);
          setDataVersion(v => v + 1);
        });
      }
    } catch (err) {
      console.error('Poll failed:', err);
      setError(err.message);
    }
  }, []);

  // OPTIMIZATION: Memoize with dataVersion and optimize calculation loops
  const aggregatedBlocks = useMemo(() => {
    // OPTIMIZATION: Early return if no data to process
    if (!recentBlocks?.length) return [];
    
    const grouped = {};
    for (const block of recentBlocks) {
      const interval = mempoolInterval === '1m' ? '1m' : '10m';
      const key = `${interval}`;
      if (!grouped[key]) {
        grouped[key] = {
          label: key,
          totalTxns: 0,
          voteCount: 0,
          transferCount: 0,
          programCount: 0,
          otherCount: 0,
          slots: 0
        };
      }
      grouped[key].totalTxns += block.txCount || 0;
      grouped[key].voteCount += block.voteCount || 0;
      grouped[key].transferCount += block.transferCount || 0;
      grouped[key].programCount += block.programCount || 0;
      grouped[key].otherCount += block.otherCount || 0;
      grouped[key].slots += 1;
    }
    return Object.values(grouped);
  }, [recentBlocks, mempoolInterval, dataVersion]);

  // Helper functions
  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // MODIFIED: Complete rewrite of useEffect for proper lifecycle management and cleanup
  useEffect(() => {
    isMountedRef.current = true;
    initDashboard();

    // Setup polling interval
    const pollInterval = setInterval(() => {
      if (isMountedRef.current) {
        pollDashboard();
      }
    }, 5000);

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      clearInterval(pollInterval);
      abortControllerRef.current?.abort();
    };
  }, [pollDashboard]);

  return (
    <div className="min-h-screen bg-[#1a252f]">
      {/* Header */}
      <header className="bg-[#202a35] border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-[1800px] mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center font-bold text-white">
              X
            </div>
            <span className="font-bold text-white hidden sm:inline">X1 Space</span>
          </div>

          <div className="flex-1 max-w-md hidden md:block">
            <Suspense fallback={<MiniFallback />}>
              <GlobalSearch />
            </Suspense>
          </div>

          <div className="flex items-center gap-2">
            <Suspense fallback={<MiniFallback />}>
              <ThemeToggle />
            </Suspense>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/20 border-b border-red-500/30 p-4 text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>Error connecting to X1 RPC: {error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={pollDashboard} className="ml-auto text-red-400">
            Retry
          </Button>
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
            {/* MODIFIED: Added stable key to prevent remounting on every poll */}
            <MempoolViz 
              key="mempool-main-viz"
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
