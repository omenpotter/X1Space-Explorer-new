import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Zap,
  TrendingDown,
  ExternalLink,
  Loader2,
  AlertCircle,
  Globe,
  Calculator,
  Wallet,
  Star,
  Trophy,
  Coins,
  Map,
  Clock,
  Bell
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import X1Rpc from '../components/x1/X1RpcService';
import ThemeToggle from '../components/layout/ThemeToggle';
import MobileNav from '../components/layout/MobileNav';

// Block visualization component for aggregated time view
const AggregatedBlockViz = ({ data }) => {
  const { totalTxns, slots, label, voteCount, transferCount, programCount } = data;
  
  const total = totalTxns || 1;
  const voteRatio = voteCount / total;
  const transferRatio = transferCount / total;
  const programRatio = programCount / total;

  return (
    <div className="relative group cursor-pointer">
      <div className="relative w-[140px] h-[200px] md:w-[160px] md:h-[220px] bg-gradient-to-b from-cyan-500/20 to-blue-600/20 border border-white/10 rounded-lg overflow-hidden transition-all duration-300 hover:border-cyan-500/50 hover:scale-[1.02]">
        {/* Visual representation of tx types */}
        <div className="absolute inset-2 bottom-24 flex flex-col gap-[2px]">
          <div className="bg-purple-500/50 rounded flex items-center justify-center" style={{ flex: Math.max(0.1, voteRatio) }}>
            <span className="text-[8px] text-purple-200">Vote</span>
          </div>
          <div className="bg-emerald-500/50 rounded flex items-center justify-center" style={{ flex: Math.max(0.1, transferRatio) }}>
            <span className="text-[8px] text-emerald-200">Transfer</span>
          </div>
          <div className="bg-yellow-500/50 rounded flex items-center justify-center" style={{ flex: Math.max(0.1, programRatio) }}>
            <span className="text-[8px] text-yellow-200">Program</span>
          </div>
        </div>
        
        <div className="absolute top-2 right-2">
          <p className="text-sm text-cyan-400 font-bold">{label}</p>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2">
          <p className="text-white font-bold text-lg">{totalTxns.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400">{slots.toLocaleString()} slots</p>
          <div className="flex flex-wrap gap-1 text-[8px] mt-1">
            <span className="text-purple-400">{voteCount.toLocaleString()} vote</span>
            <span className="text-emerald-400">{transferCount.toLocaleString()} xfer</span>
            <span className="text-yellow-400">{programCount.toLocaleString()} prog</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Block visualization component - shows actual transaction breakdown
const BlockViz = ({ block }) => {
  const txCount = block?.txCount || 0;
  const voteCount = block?.voteCount || 0;
  const transferCount = block?.transferCount || 0;
  const programCount = block?.programCount || 0;
  const otherCount = block?.otherCount || (txCount - voteCount);
  
  const formatTimeAgo = (blockTime) => {
    if (!blockTime) return 'just now';
    const diff = (Date.now() / 1000) - blockTime;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const total = txCount || 1;

  return (
    <div className="relative group cursor-pointer">
      <div className="relative w-[120px] h-[180px] md:w-[140px] md:h-[200px] bg-gradient-to-b from-purple-500/30 to-purple-600/20 border border-white/10 rounded-lg overflow-hidden transition-all duration-300 hover:border-cyan-500/50 hover:scale-[1.02]">
        {/* Transaction type visualization */}
        <div className="absolute inset-2 bottom-20 flex flex-col gap-[2px]">
          {voteCount > 0 && (
            <div className="bg-purple-500/50 rounded flex items-center justify-center" style={{ flex: voteCount / total }}>
              <span className="text-[7px] text-purple-200">{voteCount}</span>
            </div>
          )}
          {transferCount > 0 && (
            <div className="bg-emerald-500/50 rounded flex items-center justify-center" style={{ flex: transferCount / total }}>
              <span className="text-[7px] text-emerald-200">{transferCount}</span>
            </div>
          )}
          {(programCount > 0 || otherCount > 0) && (
            <div className="bg-yellow-500/50 rounded flex items-center justify-center" style={{ flex: (programCount + otherCount) / total }}>
              <span className="text-[7px] text-yellow-200">{programCount + otherCount}</span>
            </div>
          )}
        </div>
        
        <div className="absolute top-1 left-2 right-2">
          <p className="text-[9px] text-cyan-400 font-mono">#{block?.slot?.toLocaleString()}</p>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2">
          <p className="text-white font-bold text-sm">{txCount.toLocaleString()}</p>
          <p className="text-[8px] text-gray-400">{formatTimeAgo(block?.blockTime)}</p>
          <div className="flex flex-wrap gap-1 text-[7px]">
            <span className="text-purple-400">vote</span>
            <span className="text-emerald-400">xfer</span>
            <span className="text-yellow-400">prog</span>
          </div>
        </div>
      </div>
      
      {block?.slot && (
        <div className="text-center mt-1">
          <Link 
            to={createPageUrl('BlockDetail') + `?slot=${block.slot}`}
            className="text-cyan-400 hover:underline text-xs font-mono"
          >
            {block.slot.toLocaleString()}
          </Link>
        </div>
      )}
    </div>
  );
};

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [recentBlocks, setRecentBlocks] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tpsInterval, setTpsInterval] = useState('1m');
  const [mempoolInterval, setMempoolInterval] = useState('blocks');
  const [historicalBlocks, setHistoricalBlocks] = useState([]);

  // Aggregate TPS data based on selected interval
  const getAggregatedTpsData = () => {
    if (!dashboardData?.tpsHistory?.length) return [];
    
    const history = dashboardData.tpsHistory;
    if (tpsInterval === '1m') {
      return history; // Already 1-minute samples
    }
    
    // Aggregate to 10-minute bars
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
  };

  // Fetch dashboard data
  const fetchData = async () => {
    try {
      const [data, blocks] = await Promise.all([
        X1Rpc.getDashboardData(),
        X1Rpc.getRecentBlocks(10) // Fetch 10 blocks for display
      ]);
      
      setDashboardData(data);
      setRecentBlocks(blocks);
      setHistoricalBlocks(blocks);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get aggregated blocks based on interval - uses TPS-based calculation for consistent data
  // X1 has ~2.5 slots/second = 150 slots/min = 1500 slots/10min
  const getAggregatedBlocks = () => {
    if (mempoolInterval === 'blocks') return null;
    
    const aggregated = [];
    const tps = dashboardData?.tps || 3000;
    
    // Use actual block data to calculate tx type ratios
    let voteRatio = 0.70, transferRatio = 0.15, programRatio = 0.15;
    if (recentBlocks.length > 0) {
      const totalTx = recentBlocks.reduce((sum, b) => sum + (b.txCount || 0), 0);
      const totalVote = recentBlocks.reduce((sum, b) => sum + (b.voteCount || 0), 0);
      const totalTransfer = recentBlocks.reduce((sum, b) => sum + (b.transferCount || 0), 0);
      const totalProgram = recentBlocks.reduce((sum, b) => sum + (b.programCount || b.otherCount || 0), 0);
      if (totalTx > 0) {
        voteRatio = totalVote / totalTx;
        transferRatio = totalTransfer / totalTx;
        programRatio = totalProgram / totalTx;
      }
    }
    
    if (mempoolInterval === '1m') {
      // Each 1-minute window: ~150 slots, tps * 60 transactions
      for (let i = 0; i < 10; i++) {
        const label = i === 0 ? 'Now' : `${i}m ago`;
        const slots = 150; // ~2.5 slots/sec * 60 sec
        const totalTxns = Math.round(tps * 60);
        aggregated.push({
          totalTxns,
          slots,
          label,
          voteCount: Math.round(totalTxns * voteRatio),
          transferCount: Math.round(totalTxns * transferRatio),
          programCount: Math.round(totalTxns * programRatio),
          hasData: true
        });
      }
    } else {
      // Each 10-minute window: ~1500 slots, tps * 600 transactions
      for (let i = 0; i < 10; i++) {
        const label = i === 0 ? 'Now' : `${i * 10}m ago`;
        const slots = 1500; // ~2.5 slots/sec * 600 sec
        const totalTxns = Math.round(tps * 600);
        aggregated.push({
          totalTxns,
          slots,
          label,
          voteCount: Math.round(totalTxns * voteRatio),
          transferCount: Math.round(totalTxns * transferRatio),
          programCount: Math.round(totalTxns * programRatio),
          hasData: true
        });
      }
    }
    
    return aggregated;
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

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

  // No pending blocks - X1 processes blocks instantly

  if (loading && !dashboardData) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-gray-400">Connecting to X1 Network...</p>
        </div>
      </div>
    );
  }

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
              <span className="hidden sm:block text-white font-bold">X1Space</span>
              <div className="ml-2 px-2 py-0.5 bg-cyan-500/20 rounded text-cyan-400 text-xs font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Mainnet
              </div>
            </div>
            
            <nav className="hidden md:flex items-center gap-1">
              <Link to={createPageUrl('Dashboard')}>
                <Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg">
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
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </Button>
              </Link>
              <Link to={createPageUrl('NetworkHealth')}>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                  <Globe className="w-5 h-5" />
                </Button>
              </Link>
              <Link to={createPageUrl('StakingCalculator')}>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                  <Calculator className="w-5 h-5" />
                </Button>
              </Link>
              <Link to={createPageUrl('AddressLookup')}>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                  <Wallet className="w-5 h-5" />
                </Button>
              </Link>
              <ThemeToggle />
            </nav>
            
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
          {/* Interval Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">X1 View:</span>
              <div className="flex gap-1 bg-[#24384a] rounded-lg p-1">
                {['blocks', '1m', '10m'].map((interval) => (
                  <button
                    key={interval}
                    onClick={() => setMempoolInterval(interval)}
                    className={`px-3 py-1 text-xs rounded ${mempoolInterval === interval ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    {interval === 'blocks' ? 'Blocks' : interval}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 text-sm font-medium">XNT $1.00</span>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">OTC</Badge>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 overflow-x-auto pb-4">
              {/* Show 10 continuous blocks or aggregated time views - auto-updating */}
              <div className="flex gap-2" key={mempoolInterval + '-' + (recentBlocks[0]?.slot || 0)}>
                {mempoolInterval === 'blocks' ? (
                  recentBlocks.slice(0, 10).map((block) => (
                    <BlockViz key={block.slot} block={block} />
                  ))
                ) : (
                  getAggregatedBlocks()?.slice(0, 10).map((agg, i) => (
                    <AggregatedBlockViz key={`${mempoolInterval}-${i}-${dashboardData?.slot}`} data={agg} />
                  ))
                )}
              </div>
            </div>
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
                  <span className="text-xs text-gray-500">
                    Updated {lastUpdate.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Current Slot</p>
                  <p className="text-white font-bold text-lg font-mono">
                    {dashboardData?.slot?.toLocaleString() || '-'}
                  </p>
                </div>
                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Block Height</p>
                  <p className="text-white font-bold text-lg font-mono">
                    {dashboardData?.blockHeight?.toLocaleString() || '-'}
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
                {dashboardData?.tpsHistory?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getAggregatedTpsData()}>
                      <YAxis 
                        domain={['auto', 'auto']}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6b7280', fontSize: 10 }}
                        width={50}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1d2d3a', 
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px'
                        }}
                        labelStyle={{ color: '#9ca3af' }}
                        formatter={(value) => [`${value.toLocaleString()} TPS`, 'Avg TPS']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="tps" 
                        stroke="#eab308" 
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    Loading TPS data...
                  </div>
                )}
              </div>
            </div>

            {/* Version Info */}
            <div className="bg-[#24384a] rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs">Network Version</p>
                  <p className="text-white font-mono">{dashboardData?.version || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">RPC Endpoint</p>
                  <p className="text-cyan-400 font-mono text-sm">rpc.mainnet.x1.xyz</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Link to={createPageUrl('NetworkHealth')} className="bg-[#24384a] rounded-xl p-4 hover:bg-[#2a4258] transition-colors">
            <Globe className="w-6 h-6 text-cyan-400 mb-2" />
            <p className="text-white font-medium">Network Health</p>
            <p className="text-gray-500 text-xs">Monitor network status</p>
          </Link>
          <Link to={createPageUrl('TokenExplorer')} className="bg-[#24384a] rounded-xl p-4 hover:bg-[#2a4258] transition-colors">
            <Coins className="w-6 h-6 text-yellow-400 mb-2" />
            <p className="text-white font-medium">Tokens</p>
            <p className="text-gray-500 text-xs">SPL token explorer</p>
          </Link>
          <Link to={createPageUrl('NetworkMap')} className="bg-[#24384a] rounded-xl p-4 hover:bg-[#2a4258] transition-colors">
            <Map className="w-6 h-6 text-emerald-400 mb-2" />
            <p className="text-white font-medium">Network Map</p>
            <p className="text-gray-500 text-xs">Global node distribution</p>
          </Link>
          <Link to={createPageUrl('EpochHistory')} className="bg-[#24384a] rounded-xl p-4 hover:bg-[#2a4258] transition-colors">
            <Clock className="w-6 h-6 text-purple-400 mb-2" />
            <p className="text-white font-medium">Epoch History</p>
            <p className="text-gray-500 text-xs">Historical data</p>
          </Link>
          <Link to={createPageUrl('StakingCalculator')} className="bg-[#24384a] rounded-xl p-4 hover:bg-[#2a4258] transition-colors">
            <Calculator className="w-6 h-6 text-cyan-400 mb-2" />
            <p className="text-white font-medium">Staking Calculator</p>
            <p className="text-gray-500 text-xs">Estimate rewards</p>
          </Link>
          <Link to={createPageUrl('ValidatorAlerts')} className="bg-[#24384a] rounded-xl p-4 hover:bg-[#2a4258] transition-colors">
            <Bell className="w-6 h-6 text-yellow-400 mb-2" />
            <p className="text-white font-medium">Alerts</p>
            <p className="text-gray-500 text-xs">Validator notifications</p>
          </Link>
          <Link to={createPageUrl('Watchlist')} className="bg-[#24384a] rounded-xl p-4 hover:bg-[#2a4258] transition-colors">
            <Star className="w-6 h-6 text-orange-400 mb-2" />
            <p className="text-white font-medium">Watchlist</p>
            <p className="text-gray-500 text-xs">Track validators</p>
          </Link>
          <Link to={createPageUrl('Leaderboard')} className="bg-[#24384a] rounded-xl p-4 hover:bg-[#2a4258] transition-colors">
            <Trophy className="w-6 h-6 text-amber-400 mb-2" />
            <p className="text-white font-medium">Leaderboard</p>
            <p className="text-gray-500 text-xs">Top validators</p>
          </Link>
          <Link to={createPageUrl('AddressLookup')} className="bg-[#24384a] rounded-xl p-4 hover:bg-[#2a4258] transition-colors">
            <Wallet className="w-6 h-6 text-blue-400 mb-2" />
            <p className="text-white font-medium">Address Lookup</p>
            <p className="text-gray-500 text-xs">Search accounts</p>
          </Link>
          <Link to={createPageUrl('PortfolioTracker')} className="bg-[#24384a] rounded-xl p-4 hover:bg-[#2a4258] transition-colors">
            <TrendingDown className="w-6 h-6 text-emerald-400 mb-2" />
            <p className="text-white font-medium">Portfolio</p>
            <p className="text-gray-500 text-xs">Track holdings & rewards</p>
          </Link>
          <Link to={createPageUrl('WhaleWatcher')} className="bg-[#24384a] rounded-xl p-4 hover:bg-[#2a4258] transition-colors">
            <svg className="w-6 h-6 text-cyan-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C8 2 4 6 4 10c0 2 1 4 3 5v2c0 1 1 2 2 2h6c1 0 2-1 2-2v-2c2-1 3-3 3-5 0-4-4-8-8-8z" />
              <path d="M9 22v-2M15 22v-2" />
            </svg>
            <p className="text-white font-medium">Whale Watcher</p>
            <p className="text-gray-500 text-xs">Track large transactions</p>
          </Link>
          <Link to={createPageUrl('ValidatorCompare')} className="bg-[#24384a] rounded-xl p-4 hover:bg-[#2a4258] transition-colors">
            <svg className="w-6 h-6 text-indigo-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
            <p className="text-white font-medium">Compare</p>
            <p className="text-gray-500 text-xs">Side-by-side analysis</p>
          </Link>
          <Link to={createPageUrl('ApiDocs')} className="bg-[#24384a] rounded-xl p-4 hover:bg-[#2a4258] transition-colors">
            <svg className="w-6 h-6 text-pink-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <p className="text-white font-medium">API</p>
            <p className="text-gray-500 text-xs">Developer docs</p>
          </Link>
        </div>

        {/* Recent Blocks Table */}
        <div className="mt-8 bg-[#24384a] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-400 text-sm flex items-center gap-2">
              Recent Blocks
              <ExternalLink className="w-3 h-3" />
            </h3>
            <Link to={createPageUrl('Blocks')}>
              <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300">
                View All
              </Button>
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-2">Slot</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-2">Block Hash</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-2">Transactions</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentBlocks.slice(0, 5).map((block, i) => (
                  <tr key={block.slot} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <Link 
                        to={createPageUrl('BlockDetail') + `?slot=${block.slot}`}
                        className="text-cyan-400 hover:underline font-mono"
                      >
                        {block.slot.toLocaleString()}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-400 font-mono text-sm">
                        {block.blockhash?.substring(0, 20)}...
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-mono">
                      {block.txCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 text-sm">
                      {block.blockTime ? new Date(block.blockTime * 1000).toLocaleTimeString() : block.timeAgo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}