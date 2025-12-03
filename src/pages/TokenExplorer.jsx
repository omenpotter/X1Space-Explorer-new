import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Coins, Search, Loader2, TrendingUp, TrendingDown,
  ExternalLink, Copy, Check, RefreshCw, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import X1Rpc from '../components/x1/X1RpcService';

export default function TokenExplorer() {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(null);
  const [supply, setSupply] = useState({ total: 0, circulating: 0, nonCirculating: 0 });
  const [epochInfo, setEpochInfo] = useState(null);
  const [inflationRate, setInflationRate] = useState(null);
  const [validators, setValidators] = useState({ current: 0, totalStake: 0 });
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [supplyData, epoch, inflation, voteAccounts] = await Promise.all([
          X1Rpc.getSupply(),
          X1Rpc.getEpochInfo(),
          X1Rpc.getInflationRate().catch(() => null),
          X1Rpc.getVoteAccounts()
        ]);
        
        setSupply({
          total: supplyData.value.total / 1e9,
          circulating: supplyData.value.circulating / 1e9,
          nonCirculating: supplyData.value.nonCirculating / 1e9
        });
        setEpochInfo(epoch);
        setInflationRate(inflation);
        setValidators({
          current: voteAccounts.current.length,
          totalStake: voteAccounts.current.reduce((sum, v) => sum + v.activatedStake, 0) / 1e9
        });
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const searchToken = async () => {
    if (!searchQuery || searchQuery.length < 32) {
      setSearchError('Please enter a valid token mint address');
      return;
    }
    
    setSearching(true);
    setSearchError(null);
    setSearchResult(null);
    
    try {
      const accountInfo = await X1Rpc.getAccountInfo(searchQuery);
      
      if (!accountInfo?.value) {
        setSearchError('Token not found');
        setSearching(false);
        return;
      }
      
      const owner = accountInfo.value.owner;
      
      if (owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
        // This is an SPL token mint
        const data = accountInfo.value.data?.parsed?.info;
        setSearchResult({
          type: 'token_mint',
          mint: searchQuery,
          supply: data?.supply ? parseInt(data.supply) / Math.pow(10, data?.decimals || 0) : 0,
          decimals: data?.decimals || 0,
          freezeAuthority: data?.freezeAuthority,
          mintAuthority: data?.mintAuthority
        });
      } else {
        setSearchError('Address is not an SPL token mint');
      }
    } catch (err) {
      setSearchError('Failed to fetch token info: ' + err.message);
    } finally {
      setSearching(false);
    }
  };

  const copyAddress = (address) => {
    navigator.clipboard.writeText(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatSupply = (num) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    return num.toLocaleString();
  };

  // XNT is the only native token, priced at $1.00 OTC
  const xntToken = {
    mint: 'Native XNT (SOL-compatible)',
    name: 'X1 Native Token',
    symbol: 'XNT',
    decimals: 9,
    supply: supply.total,
    circulating: supply.circulating,
    price: 1.00, // OTC price
    isNative: true
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1d2d3a] text-white">
      <header className="bg-[#1d2d3a] border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-black font-black text-sm">X1</span>
                </div>
                <span className="text-white font-bold hidden sm:inline">X1</span>
                <span className="text-cyan-400 font-bold hidden sm:inline">.space</span>
              </Link>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">Mainnet</Badge>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              <Link to={createPageUrl('Dashboard')}><Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg"><Zap className="w-5 h-5" /></Button></Link>
              <Link to={createPageUrl('TokenExplorer')}><Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg"><Coins className="w-5 h-5" /></Button></Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Coins className="w-7 h-7 text-cyan-400" />
            Token Explorer
          </h1>
        </div>

        {/* XNT Token Card */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <span className="text-black font-black text-xl">X1</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-white">{xntToken.name}</h2>
                <Badge className="bg-cyan-500/20 text-cyan-400 border-0">Native</Badge>
              </div>
              <p className="text-gray-400">{xntToken.symbol}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-3xl font-bold text-emerald-400">${xntToken.price.toFixed(2)}</p>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-0">OTC Price</Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Total Supply</p>
              <p className="text-xl font-bold text-white">{formatSupply(xntToken.supply)} XNT</p>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Circulating</p>
              <p className="text-xl font-bold text-cyan-400">{formatSupply(xntToken.circulating)} XNT</p>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Market Cap (OTC)</p>
              <p className="text-xl font-bold text-white">${formatSupply(xntToken.circulating * xntToken.price)}</p>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Decimals</p>
              <p className="text-xl font-bold text-white">{xntToken.decimals}</p>
            </div>
          </div>
        </div>

        {/* OTC Notice */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
          <p className="text-yellow-400 text-sm font-medium mb-2">
            ⚠️ Trading Status
          </p>
          <p className="text-yellow-400/80 text-sm">
            XNT is currently trading <strong>Over The Counter (OTC)</strong> at $1.00. 
            Not yet listed on exchanges. This page will automatically update when exchange listings go live.
          </p>
        </div>

        {/* Network Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#24384a] rounded-xl p-4">
            <h3 className="text-gray-400 text-sm mb-3">STAKING STATS</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Active Validators</span>
                <span className="text-white font-bold">{validators.current}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Total Staked</span>
                <span className="text-cyan-400 font-mono">{(validators.totalStake / 1e6).toFixed(0)}M XNT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Stake Ratio</span>
                <span className="text-emerald-400 font-mono">{((validators.totalStake / supply.circulating) * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
          
          <div className="bg-[#24384a] rounded-xl p-4">
            <h3 className="text-gray-400 text-sm mb-3">INFLATION</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Base Rate</span>
                <span className="text-white font-mono">{inflationRate?.total ? (inflationRate.total * 100).toFixed(2) : '~8.00'}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Validator Rate</span>
                <span className="text-cyan-400 font-mono">{inflationRate?.validator ? (inflationRate.validator * 100).toFixed(2) : '~8.00'}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Current Epoch</span>
                <span className="text-white font-mono">{epochInfo?.epoch || '-'}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-[#24384a] rounded-xl p-4">
            <h3 className="text-gray-400 text-sm mb-3">SUPPLY DISTRIBUTION</h3>
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Circulating', value: supply.circulating, color: '#06b6d4' },
                      { name: 'Staked', value: validators.totalStake, color: '#10b981' },
                      { name: 'Non-Circulating', value: supply.nonCirculating, color: '#6b7280' }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={45}
                    dataKey="value"
                  >
                    <Cell fill="#06b6d4" />
                    <Cell fill="#10b981" />
                    <Cell fill="#6b7280" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* SPL Token Search */}
        <div className="bg-[#24384a] rounded-xl p-6 mb-6">
          <h3 className="text-white font-medium mb-4">Search SPL Token</h3>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Enter SPL token mint address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchToken()}
              className="bg-[#1d2d3a] border-0 text-white font-mono flex-1"
            />
            <Button onClick={searchToken} className="bg-cyan-500 hover:bg-cyan-600" disabled={searching}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          
          {searchError && (
            <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
              <AlertCircle className="w-4 h-4" />
              <span>{searchError}</span>
            </div>
          )}
          
          {searchResult && (
            <div className="bg-[#1d2d3a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Coins className="w-5 h-5 text-cyan-400" />
                <span className="text-white font-medium">SPL Token Found</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-400">Mint:</span>
                  <p className="text-cyan-400 font-mono text-xs truncate">{searchResult.mint}</p>
                </div>
                <div>
                  <span className="text-gray-400">Supply:</span>
                  <p className="text-white font-mono">{searchResult.supply.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-400">Decimals:</span>
                  <p className="text-white">{searchResult.decimals}</p>
                </div>
                <div>
                  <span className="text-gray-400">Mint Authority:</span>
                  <p className="text-white font-mono text-xs truncate">{searchResult.mintAuthority || 'None'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-blue-400 text-sm">
            ℹ️ Token data is fetched live from the X1 blockchain. XNT is the native token (like SOL on Solana). 
            SPL tokens can be searched by their mint address. The ecosystem is growing - more tokens coming soon!
          </p>
        </div>
      </main>
    </div>
  );
}