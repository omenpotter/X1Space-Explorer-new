import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Activity, 
  Layers, 
  Clock, 
  TrendingUp, 
  Zap,
  Database,
  Users,
  ArrowUpRight,
  Circle,
  ChevronRight,
  Cpu
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

// Mock data - in production this would come from X1 RPC
const generateTPSData = () => {
  return Array.from({ length: 30 }, (_, i) => ({
    time: `${30 - i}m`,
    tps: Math.floor(2000 + Math.random() * 1000)
  })).reverse();
};

const mockBlocks = [
  { slot: 11265950, parent: 11265949, leader: 'X1 Labs (node4)', time: 358, txCount: 2847 },
  { slot: 11265949, parent: 11265948, leader: 'X1 Labs (node4)', time: 378, txCount: 3102 },
  { slot: 11265948, parent: 11265947, leader: 'X1 Labs (node11)', time: 585, txCount: 2654 },
  { slot: 11265947, parent: 11265946, leader: 'X1 Labs (node11)', time: 356, txCount: 2901 },
  { slot: 11265946, parent: 11265945, leader: 'X1 Labs (node11)', time: 355, txCount: 3245 },
  { slot: 11265945, parent: 11265944, leader: 'Unknown', time: 318, txCount: 2567 },
  { slot: 11265944, parent: 11265943, leader: 'Unknown', time: 357, txCount: 2789 },
  { slot: 11265943, parent: 11265942, leader: 'Unknown', time: 359, txCount: 3012 },
];

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [tpsData, setTpsData] = useState(generateTPSData());
  const [currentTPS, setCurrentTPS] = useState(2622);
  const [slot, setSlot] = useState(11265950);
  const [blockHeight, setBlockHeight] = useState(11206465);
  const [epochProgress, setEpochProgress] = useState(94.4);
  
  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTPS(prev => Math.floor(prev + (Math.random() - 0.5) * 100));
      setSlot(prev => prev + 1);
      setTpsData(prev => {
        const newData = [...prev.slice(1), { time: 'now', tps: Math.floor(2000 + Math.random() * 1000) }];
        return newData;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = () => {
    if (searchQuery) {
      // Navigate to search results
      window.location.href = createPageUrl('Search') + `?q=${searchQuery}`;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0d1320]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl font-black tracking-tight">
                <span className="text-white">X</span>
                <span className="text-cyan-400">1</span>
              </div>
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-xs">
                Mainnet
              </Badge>
            </div>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link to={createPageUrl('Dashboard')} className="text-white font-medium">
                Cluster Stats
              </Link>
              <Link to={createPageUrl('Validators')} className="text-gray-400 hover:text-white transition-colors">
                Validators
              </Link>
              <Link to={createPageUrl('Blocks')} className="text-gray-400 hover:text-white transition-colors">
                Blocks
              </Link>
              <Link to={createPageUrl('Transactions')} className="text-gray-400 hover:text-white transition-colors">
                Transactions
              </Link>
            </nav>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full">
                <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400" />
                <span className="text-emerald-400 text-sm font-medium">Online</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Search Bar */}
        <div className="relative max-w-2xl mx-auto">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl blur-xl" />
          <div className="relative bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-1">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-gray-400 ml-4" />
              <Input
                placeholder="Search for blocks, accounts, transactions, programs..."
                className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-gray-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button 
                onClick={handleSearch}
                className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold rounded-xl"
              >
                Search
              </Button>
            </div>
          </div>
        </div>

        {/* Supply Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-[#111827] to-[#0d1320] border-white/5 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium">Circulating Supply</p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-4xl font-bold text-cyan-400">1B</span>
                    <span className="text-gray-500">/ 1B</span>
                  </div>
                  <p className="text-emerald-400 text-sm mt-2">100.0% is circulating</p>
                </div>
                <div className="p-3 bg-cyan-500/10 rounded-xl">
                  <Database className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#111827] to-[#0d1320] border-white/5 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-400 text-sm font-medium">Active Stake</p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-4xl font-bold text-cyan-400">961.9M</span>
                    <span className="text-gray-500">/ 1B</span>
                  </div>
                  <p className="text-sm mt-2">
                    <span className="text-gray-400">Delinquent stake: </span>
                    <span className="text-red-400">0.1%</span>
                  </p>
                </div>
                <div className="p-3 bg-cyan-500/10 rounded-xl">
                  <Users className="w-6 h-6 text-cyan-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Cluster Stats */}
        <Card className="bg-gradient-to-br from-[#111827] to-[#0d1320] border-white/5">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Live Cluster Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              <div className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <span className="text-gray-400">Slot</span>
                <Link to={createPageUrl('Blocks') + `?slot=${slot}`} className="text-cyan-400 hover:underline font-mono">
                  {slot.toLocaleString()}
                </Link>
              </div>
              <div className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <span className="text-gray-400">Block height</span>
                <span className="text-white font-mono">{blockHeight.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <span className="text-gray-400">Cluster time</span>
                <span className="text-white font-mono text-sm">
                  {new Date().toUTCString()}
                </span>
              </div>
              <div className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <span className="text-gray-400">Slot time (1min average)</span>
                <span className="text-white font-mono">375ms</span>
              </div>
              <div className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <span className="text-gray-400">Slot time (1hr average)</span>
                <span className="text-white font-mono">373ms</span>
              </div>
              <div className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <span className="text-gray-400">Epoch</span>
                <Link to={createPageUrl('Blocks') + `?epoch=63`} className="text-cyan-400 hover:underline font-mono">
                  63
                </Link>
              </div>
              <div className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <span className="text-gray-400">Epoch progress</span>
                <div className="flex items-center gap-3">
                  <Progress value={epochProgress} className="w-32 h-2 bg-white/10" />
                  <span className="text-white font-mono">{epochProgress}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <span className="text-gray-400">Epoch time remaining (approx.)</span>
                <span className="text-white font-mono">~1h 15m 42s</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transaction Stats */}
        <Card className="bg-gradient-to-br from-[#111827] to-[#0d1320] border-white/5">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Live Transaction Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              <div className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <span className="text-gray-400">Transaction count</span>
                <span className="text-white font-mono">8,687,199,980</span>
              </div>
              <div className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <span className="text-gray-400">Transactions per second (TPS)</span>
                <span className="text-emerald-400 font-mono font-bold text-xl">{currentTPS.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TPS Chart */}
        <Card className="bg-gradient-to-br from-[#111827] to-[#0d1320] border-white/5">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                TPS History
              </CardTitle>
              <Tabs defaultValue="30m" className="w-auto">
                <TabsList className="bg-white/5 border border-white/10">
                  <TabsTrigger value="30m" className="text-xs data-[state=active]:bg-cyan-500 data-[state=active]:text-black">30m</TabsTrigger>
                  <TabsTrigger value="2h" className="text-xs data-[state=active]:bg-cyan-500 data-[state=active]:text-black">2h</TabsTrigger>
                  <TabsTrigger value="6h" className="text-xs data-[state=active]:bg-cyan-500 data-[state=active]:text-black">6h</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tpsData}>
                  <defs>
                    <linearGradient id="tpsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="time" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#fff'
                    }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="tps" 
                    stroke="#06b6d4" 
                    strokeWidth={2}
                    fill="url(#tpsGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Blocks */}
        <Card className="bg-gradient-to-br from-[#111827] to-[#0d1320] border-white/5">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                Recent Blocks
              </CardTitle>
              <Link to={createPageUrl('Blocks')}>
                <Button variant="ghost" className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10">
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-3">Slot</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-3">Parent</th>
                    <th className="text-left text-gray-400 text-sm font-medium px-6 py-3">Leader</th>
                    <th className="text-right text-gray-400 text-sm font-medium px-6 py-3">Time (ms)</th>
                    <th className="text-right text-gray-400 text-sm font-medium px-6 py-3">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {mockBlocks.map((block, index) => (
                    <tr 
                      key={block.slot} 
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <Link to={createPageUrl('BlockDetail') + `?slot=${block.slot}`} className="text-cyan-400 hover:underline font-mono">
                          {block.slot.toLocaleString()}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-400 font-mono">
                        {block.parent.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-xs font-bold text-black">
                            X1
                          </div>
                          <span className="text-white">{block.leader}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-300 font-mono">
                        {block.time}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-300 font-mono">
                        {block.txCount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Network Stats Footer */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#111827]/50 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Cpu className="w-4 h-4" />
              Network Ping
            </div>
            <p className="text-xl font-bold text-white">559 ms</p>
          </div>
          <div className="bg-[#111827]/50 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Users className="w-4 h-4" />
              Total Nodes
            </div>
            <p className="text-xl font-bold text-white">961</p>
          </div>
          <div className="bg-[#111827]/50 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Layers className="w-4 h-4" />
              Block Producers
            </div>
            <p className="text-xl font-bold text-white">935</p>
          </div>
          <div className="bg-[#111827]/50 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Activity className="w-4 h-4" />
              Blocks Produced
            </div>
            <p className="text-xl font-bold text-emerald-400">99.55%</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-gray-500 text-sm">
          <p>X1 Blockchain Explorer • Built for the X1 Community</p>
        </div>
      </footer>
    </div>
  );
}