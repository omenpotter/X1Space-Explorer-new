import React, { useState, useEffect, memo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Zap, AlertCircle, Globe, Calculator, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Simple stat card - no external dependencies
const StatCard = memo(({ label, value, color = "text-white" }) => (
  <div className="bg-[#1d2d3a] rounded-lg p-3">
    <p className="text-gray-400 text-xs mb-1">{label}</p>
    <p className={`${color} font-bold text-lg font-mono`}>{value}</p>
  </div>
));

// Simple block card - pure CSS, no heavy deps
const SimpleBlockCard = memo(({ block }) => (
  <Link 
    to={createPageUrl('BlockDetail') + `?slot=${block.slot}`}
    className="flex-shrink-0 w-[100px] h-[120px] bg-gradient-to-b from-purple-900/30 to-slate-900/50 border border-white/10 rounded-lg p-2 hover:border-cyan-500/50 transition-colors"
  >
    <p className="text-cyan-400 font-mono text-[10px]">#{block.slot?.toLocaleString()}</p>
    <div className="mt-2 flex flex-wrap gap-[2px]">
      {Array(Math.min(30, Math.floor((block.txCount || 0) / 10))).fill(0).map((_, i) => (
        <div key={i} className="w-2 h-2 bg-purple-500 rounded-sm opacity-70" />
      ))}
    </div>
    <div className="mt-auto pt-2">
      <p className="text-white font-bold text-sm">{block.txCount?.toLocaleString()}</p>
      <p className="text-gray-500 text-[9px]">txns</p>
    </div>
  </Link>
));

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    let mounted = true;
    
    const fetchData = async () => {
      try {
        // Dynamic import to not block initial render
        const X1Rpc = (await import('../components/x1/X1RpcService')).default;
        
        // Fetch only essential data first
        const dashData = await X1Rpc.getDashboardData();
        if (mounted) {
          setData(dashData);
          setLoading(false);
        }
        
        // Fetch blocks after main content is shown
        const recentBlocks = await X1Rpc.getRecentBlocks(8);
        if (mounted) setBlocks(recentBlocks);
        
      } catch (err) {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatTime = (seconds) => {
    if (!seconds) return '-';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `~${h}h ${m}m` : `~${m}m`;
  };

  // Fast loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-cyan-500 rounded-lg flex items-center justify-center mx-auto mb-3">
            <span className="text-black font-black text-xl">X1</span>
          </div>
          <p className="text-gray-400">Loading...</p>
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
              <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center">
                <span className="text-black font-black text-sm">X1</span>
              </div>
              <span className="hidden sm:block font-bold">
                <span className="text-cyan-400">X1</span>
                <span className="text-white">Space</span>
              </span>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs ml-2">Mainnet</Badge>
            </div>
            
            <nav className="hidden md:flex items-center gap-1">
              <Link to={createPageUrl('Dashboard')}>
                <Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg">
                  <Zap className="w-5 h-5" />
                </Button>
              </Link>
              <Link to={createPageUrl('Blocks')}>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                  </svg>
                </Button>
              </Link>
              <Link to={createPageUrl('Validators')}>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />
                  </svg>
                </Button>
              </Link>
              <Link to={createPageUrl('Transactions')}>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </Button>
              </Link>
              <Link to={createPageUrl('NetworkHealth')}><Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg"><Globe className="w-5 h-5" /></Button></Link>
              <Link to={createPageUrl('StakingCalculator')}><Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg"><Calculator className="w-5 h-5" /></Button></Link>
              <Link to={createPageUrl('AddressLookup')}><Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg"><Wallet className="w-5 h-5" /></Button></Link>
            </nav>
            
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Input
                  placeholder="Search address, tx, block..."
                  className="w-full bg-[#24384a] border-0 text-white placeholder:text-gray-500 pr-10 rounded-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchQuery && (window.location.href = createPageUrl('Search') + `?q=${searchQuery}`)}
                />
                <Button 
                  size="icon" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 bg-cyan-500 hover:bg-cyan-600 h-7 w-7 rounded"
                  onClick={() => searchQuery && (window.location.href = createPageUrl('Search') + `?q=${searchQuery}`)}
                >
                  <Search className="w-4 h-4 text-black" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2">
          <div className="max-w-[1800px] mx-auto flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>RPC Error: {error}</span>
          </div>
        </div>
      )}

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Recent Blocks - Simple visualization */}
        <div className="bg-[#24384a] rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-white font-medium">Recent Blocks</span>
              <Link to={createPageUrl('Blocks')}>
                <Button variant="ghost" size="sm" className="text-cyan-400 text-xs">View All →</Button>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 text-sm font-medium">XNT $1.00</span>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">OTC</Badge>
            </div>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2">
            {blocks.length > 0 ? (
              blocks.map((block) => <SimpleBlockCard key={block.slot} block={block} />)
            ) : (
              Array(8).fill(0).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[100px] h-[120px] bg-slate-800/50 rounded-lg" />
              ))
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div className="bg-[#24384a] rounded-xl p-4">
              <h3 className="text-gray-400 text-sm mb-4">NETWORK STATS</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Current Slot" value={data?.slot?.toLocaleString() || '-'} />
                <StatCard label="Block Height" value={data?.blockHeight?.toLocaleString() || '-'} />
                <StatCard label="TPS" value={data?.tps?.toLocaleString() || '-'} color="text-cyan-400" />
                <StatCard label="Total TXs" value={formatNumber(data?.transactionCount)} />
              </div>
            </div>

            <div className="bg-[#24384a] rounded-xl p-4">
              <h3 className="text-gray-400 text-sm mb-4">SUPPLY</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Circulating</p>
                  <p className="text-cyan-400 font-bold text-xl">{formatNumber(data?.supply?.circulating)} XNT</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Total Supply</p>
                  <p className="text-white font-bold text-xl">{formatNumber(data?.supply?.total)} XNT</p>
                </div>
              </div>
            </div>

            <div className="bg-[#24384a] rounded-xl p-4">
              <h3 className="text-gray-400 text-sm mb-4">VALIDATORS</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-400 text-xs mb-1">Active</p>
                  <p className="text-emerald-400 font-bold text-xl">{data?.validators?.current || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Delinquent</p>
                  <p className="text-red-400 font-bold text-xl">{data?.validators?.delinquent || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-1">Total Stake</p>
                  <p className="text-white font-bold text-xl">{formatNumber(data?.validators?.totalStake)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div className="bg-[#24384a] rounded-xl p-4">
              <h3 className="text-gray-400 text-sm mb-3">EPOCH {data?.epoch || '-'} PROGRESS</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-3 bg-[#1d2d3a] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500 to-green-500 rounded-full" 
                      style={{ width: `${data?.epochProgress || 0}%` }} 
                    />
                  </div>
                </div>
                <span className="text-white font-bold">{data?.epochProgress || 0}%</span>
              </div>
              <div className="flex items-center justify-between mt-3 text-sm">
                <span className="text-gray-400">{data?.slotsRemaining?.toLocaleString() || '-'} slots remaining</span>
                <span className="text-white">{formatTime(data?.timeRemaining)}</span>
              </div>
            </div>

            <div className="bg-[#24384a] rounded-xl p-4">
              <h3 className="text-gray-400 text-sm mb-4">TPS (Last 30 min)</h3>
              <div className="h-[180px] flex items-end gap-1">
                {(data?.tpsHistory || []).slice(-30).map((d, i) => (
                  <div 
                    key={i}
                    className="flex-1 bg-yellow-500/80 rounded-t"
                    style={{ height: `${Math.min(100, (d.tps / (data?.tps * 2 || 5000)) * 100)}%` }}
                    title={`${d.tps} TPS`}
                  />
                ))}
              </div>
            </div>

            <div className="bg-[#24384a] rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-xs">Network Version</p>
                  <p className="text-white font-mono">{data?.version || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">RPC</p>
                  <p className="text-cyan-400 font-mono text-sm">mainnet.x1.xyz</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { page: 'NetworkHealth', icon: '🌐', title: 'Network Health' },
            { page: 'Validators', icon: '✅', title: 'Validators' },
            { page: 'StakingCalculator', icon: '🧮', title: 'Staking Calc' },
            { page: 'AddressLookup', icon: '🔍', title: 'Address Lookup' },
            { page: 'Transactions', icon: '📄', title: 'Transactions' },
          ].map(({ page, icon, title }) => (
            <Link key={page} to={createPageUrl(page)} className="bg-[#24384a] rounded-lg p-3 hover:bg-[#2a4258] transition-colors text-center">
              <span className="text-2xl">{icon}</span>
              <p className="text-white text-sm mt-1">{title}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}