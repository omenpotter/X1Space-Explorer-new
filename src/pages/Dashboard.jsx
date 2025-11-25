import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';

// Generate mock mempool data
const generateMempoolBlocks = () => {
  return Array.from({ length: 7 }, (_, i) => ({
    id: i,
    feeRange: i === 0 ? '1 - 111' : i < 3 ? '0.18 - 1.00' : '0.18 - 0.18',
    medianFee: i === 0 ? '~1' : '~0',
    totalFees: i === 0 ? 0.016 : 0.002,
    txCount: i === 0 ? 2999 : 4000 + Math.floor(Math.random() * 1000),
    eta: `In ~${(i + 1) * 10} minutes`,
    color: i === 0 ? 'from-yellow-500/30 to-yellow-600/20' : 'from-cyan-500/20 to-cyan-600/10'
  }));
};

const generateConfirmedBlocks = () => {
  const baseSlot = 11265950;
  const leaders = ['X1 Labs', 'StakeSquid', 'Chorus One', 'Everstake', 'Unknown'];
  
  return Array.from({ length: 8 }, (_, i) => ({
    slot: baseSlot - i,
    feeRange: `${(1 + Math.random() * 2).toFixed(2)} - ${(100 + Math.random() * 400).toFixed(0)}`,
    medianFee: `~${Math.floor(1 + Math.random() * 3)}`,
    totalFees: (0.02 + Math.random() * 0.03).toFixed(3),
    txCount: 2500 + Math.floor(Math.random() * 2000),
    timeAgo: i === 0 ? '3 minutes ago' : `${3 + i * 15} minutes ago`,
    leader: leaders[Math.floor(Math.random() * leaders.length)],
    color: i < 2 ? 'from-purple-500/30 to-purple-600/20' : 'from-blue-500/20 to-blue-600/10'
  }));
};

const generateTxData = () => {
  return Array.from({ length: 60 }, (_, i) => ({
    time: i,
    value: 1500 + Math.random() * 1000
  }));
};

// Mempool Block Visualization Component
const MempoolBlockViz = ({ block, isPending = true }) => {
  // Generate random "transaction" squares
  const squares = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    size: Math.random() > 0.7 ? 'large' : Math.random() > 0.4 ? 'medium' : 'small',
    opacity: 0.3 + Math.random() * 0.7
  }));

  return (
    <div className="relative group cursor-pointer">
      {/* Block container */}
      <div className={`
        relative w-[120px] h-[180px] md:w-[140px] md:h-[200px]
        bg-gradient-to-b ${block.color}
        border border-white/10 rounded-sm
        overflow-hidden
        transition-all duration-300
        hover:border-cyan-500/50 hover:scale-[1.02]
      `}>
        {/* Transaction visualization grid */}
        <div className="absolute inset-1 grid grid-cols-10 gap-[1px]">
          {squares.map((sq) => (
            <div
              key={sq.id}
              className={`
                ${sq.size === 'large' ? 'col-span-2 row-span-2' : sq.size === 'medium' ? 'col-span-1 row-span-2' : ''}
                bg-[#9ACD32] rounded-[1px]
              `}
              style={{ opacity: sq.opacity * 0.8 }}
            />
          ))}
        </div>
        
        {/* Fee info overlay */}
        <div className="absolute top-2 left-2 right-2">
          <p className="text-[10px] text-gray-300">{block.medianFee} sat/vB</p>
          <p className="text-[9px] text-cyan-400">{block.feeRange} sat/vB</p>
        </div>
        
        {/* Bottom stats */}
        <div className="absolute bottom-2 left-2 right-2">
          <p className="text-white font-bold text-sm">‎{block.totalFees} XNT</p>
          <p className="text-[10px] text-gray-400">{block.txCount.toLocaleString()} transactions</p>
          <p className="text-[10px] text-cyan-400">{isPending ? block.eta : block.timeAgo}</p>
        </div>
      </div>
      
      {/* Slot number for confirmed blocks */}
      {!isPending && (
        <div className="text-center mt-2">
          <Link 
            to={createPageUrl('BlockDetail') + `?slot=${block.slot}`}
            className="text-cyan-400 hover:underline text-sm font-mono"
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
  const [mempoolBlocks] = useState(generateMempoolBlocks());
  const [confirmedBlocks, setConfirmedBlocks] = useState(generateConfirmedBlocks());
  const [txData] = useState(generateTxData());
  const [currentTPS, setCurrentTPS] = useState(2622);
  const [unconfirmedTx, setUnconfirmedTx] = useState(66513);
  
  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTPS(prev => Math.floor(prev + (Math.random() - 0.5) * 100));
      setUnconfirmedTx(prev => Math.floor(prev + (Math.random() - 0.5) * 500));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = () => {
    if (searchQuery) {
      window.location.href = createPageUrl('Search') + `?q=${searchQuery}`;
    }
  };

  return (
    <div className="min-h-screen bg-[#1d2d3a] text-white">
      {/* Header */}
      <header className="bg-[#1d2d3a] border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-black font-black text-sm">X1</span>
              </div>
              <div className="hidden sm:block">
                <span className="text-white font-bold">X1</span>
                <span className="text-cyan-400 font-bold">.space</span>
              </div>
              <div className="ml-2 px-2 py-0.5 bg-cyan-500/20 rounded text-cyan-400 text-xs font-medium">
                Mainnet
              </div>
            </div>
            
            {/* Nav Icons */}
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
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </Button>
              </Link>
            </nav>
            
            {/* Search */}
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

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Mempool & Blocks Visualization */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          {/* Mempool (Pending) Section */}
          <div className="flex-1">
            <div className="flex items-center gap-4 overflow-x-auto pb-4">
              {/* Pending blocks */}
              <div className="flex gap-2">
                {mempoolBlocks.map((block) => (
                  <MempoolBlockViz key={block.id} block={block} isPending={true} />
                ))}
              </div>
              
              {/* Divider with arrows */}
              <div className="flex flex-col items-center px-4 shrink-0">
                <div className="flex items-center gap-1 text-gray-500">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                </div>
              </div>
              
              {/* Confirmed blocks */}
              <div className="flex gap-2">
                {confirmedBlocks.slice(0, 6).map((block) => (
                  <MempoolBlockViz key={block.slot} block={block} isPending={false} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Transaction Fees */}
          <div className="space-y-4">
            <div className="bg-[#24384a] rounded-xl p-4">
              <h3 className="text-gray-400 text-sm mb-4">TRANSACTION FEES</h3>
              <div className="grid grid-cols-4 gap-2">
                {['No Priority', 'Low Priority', 'Medium Priority', 'High Priority'].map((label, i) => (
                  <div key={label} className={`p-3 rounded-lg text-center ${i === 0 ? 'bg-gray-600/30' : i === 1 ? 'bg-green-500/20 border border-green-500/30' : i === 2 ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    <p className="text-white font-bold">{i + 1} <span className="text-xs text-gray-400">sat/vB</span></p>
                    <p className="text-cyan-400 text-xs">${(0.12 + i * 0.05).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Mempool Goggles */}
            <div className="bg-[#24384a] rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-400 text-sm flex items-center gap-2">
                  Mempool Goggles™ : All
                  <ExternalLink className="w-3 h-3" />
                </h3>
              </div>
              <div className="flex gap-2 mb-4">
                {['All', 'Consolidation', 'Coinjoin', 'Data'].map((tab, i) => (
                  <button 
                    key={tab}
                    className={`px-3 py-1 rounded text-xs ${i === 0 ? 'bg-cyan-500 text-black' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              {/* Visual mempool grid */}
              <div className="bg-[#1d2d3a] rounded-lg p-2 h-[200px] grid grid-cols-20 gap-[2px]">
                {Array.from({ length: 300 }, (_, i) => (
                  <div 
                    key={i} 
                    className="bg-[#9ACD32] rounded-[1px]"
                    style={{ 
                      opacity: 0.3 + Math.random() * 0.7,
                      gridColumn: Math.random() > 0.9 ? 'span 2' : 'span 1',
                      gridRow: Math.random() > 0.9 ? 'span 2' : 'span 1'
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Network Stats */}
          <div className="space-y-4">
            {/* Epoch Progress */}
            <div className="bg-[#24384a] rounded-xl p-4">
              <h3 className="text-gray-400 text-sm mb-3">EPOCH PROGRESS</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-3 bg-[#1d2d3a] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-green-500 rounded-full" style={{ width: '94.4%' }} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">~10.3 minutes</p>
                  <p className="text-xs text-gray-400">Average slot time</p>
                </div>
                <div className="text-right">
                  <p className="flex items-center gap-1">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 font-bold">2.54%</span>
                  </p>
                  <p className="text-xs text-gray-400">Previous: <span className="text-red-400">-2.37%</span></p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">In ~39 hours</p>
                  <p className="text-xs text-gray-400">November 26 at 10:27 PM</p>
                </div>
              </div>
            </div>

            {/* Live Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#24384a] rounded-xl p-4">
                <h3 className="text-gray-400 text-sm mb-2">Minimum fee</h3>
                <p className="text-2xl font-bold text-white">0.10 <span className="text-sm text-gray-400">sat/vB</span></p>
              </div>
              <div className="bg-[#24384a] rounded-xl p-4">
                <h3 className="text-gray-400 text-sm mb-2">Memory Usage</h3>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-[#1d2d3a] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-500 to-yellow-500 rounded-full" style={{ width: '65%' }} />
                  </div>
                  <span className="text-xs text-white">194 / 300 MB</span>
                </div>
              </div>
              <div className="bg-[#24384a] rounded-xl p-4">
                <h3 className="text-gray-400 text-sm mb-2">Unconfirmed</h3>
                <p className="text-2xl font-bold text-white">{unconfirmedTx.toLocaleString()} <span className="text-sm text-gray-400">TXs</span></p>
              </div>
            </div>

            {/* Incoming Transactions Chart */}
            <div className="bg-[#24384a] rounded-xl p-4">
              <h3 className="text-cyan-400 text-sm mb-4">Incoming Transactions</h3>
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={txData}>
                    <YAxis 
                      domain={['auto', 'auto']}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      width={40}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1d2d3a', 
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#eab308" 
                      strokeWidth={2}
                      dot={false}
                    />
                    {/* Dashed average line */}
                    <Line 
                      type="monotone" 
                      dataKey={() => 1800}
                      stroke="#6b7280"
                      strokeWidth={1}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#24384a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 text-sm flex items-center gap-2">
                Recent Replacements
                <ExternalLink className="w-3 h-3" />
              </h3>
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-[#1d2d3a] rounded-lg">
                  <span className="text-cyan-400 text-sm font-mono">
                    {Math.random().toString(36).substring(2, 10)}...
                  </span>
                  <span className="text-gray-400 text-xs">
                    {Math.floor(Math.random() * 5) + 1}s ago
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-[#24384a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 text-sm flex items-center gap-2">
                Recent Transactions
                <ExternalLink className="w-3 h-3" />
              </h3>
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-[#1d2d3a] rounded-lg">
                  <span className="text-cyan-400 text-sm font-mono">
                    {Math.random().toString(36).substring(2, 10)}...
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-white text-sm">
                      {(Math.random() * 10).toFixed(2)} XNT
                    </span>
                    <span className="text-gray-400 text-xs">
                      {Math.floor(Math.random() * 10) + 1}s ago
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}