// src/pages/LPExplorer.jsx
// Updated with proper XDEX integration and error handling

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropletIcon, 
  TrendingUpIcon, 
  UsersIcon, 
  ActivityIcon,
  SearchIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ExternalLinkIcon,
  ArrowLeftIcon,
  RefreshCwIcon,
  AlertCircleIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Direct XDEX API calls (using backend proxy to avoid CORS)
const XDEX_API = 'https://api.xdex.xyz';
const NETWORK = 'X1%20Mainnet';

const formatLPAmount = (amount, decimals = 9) => {
  const value = Number(amount) / Math.pow(10, decimals);
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
  return value.toFixed(2);
};

const LPExplorer = () => {
  const [stats, setStats] = useState(null);
  const [lpTokens, setLpTokens] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Fetching LP data from XDEX...');
      
      // Fetch pool list from XDEX
      const response = await fetch(
        `${XDEX_API}/api/xendex/pool/list?network=${NETWORK}`,
        { 
          signal: AbortSignal.timeout(15000),
          mode: 'cors',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`XDEX API returned ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.data) {
        throw new Error('Invalid response from XDEX API');
      }

      const pools = data.data;
      console.log(`✅ Loaded ${pools.length} pools from XDEX`);

      // Calculate stats
      const totalPools = pools.length;
      const totalLiquidity = pools.reduce((sum, p) => sum + (p.liquidity || 0), 0);
      const totalVolume24h = pools.reduce((sum, p) => sum + (p.volume_24h || 0), 0);
      
      const uniqueTokens = new Set();
      pools.forEach(p => {
        if (p.token_a_mint) uniqueTokens.add(p.token_a_mint);
        if (p.token_b_mint) uniqueTokens.add(p.token_b_mint);
      });

      setStats({
        total_pools: totalPools,
        total_liquidity_usd: totalLiquidity,
        total_volume_24h: totalVolume24h,
        unique_tokens: uniqueTokens.size,
        total_holders: 0,
        total_lp_supply: 0
      });

      // Format pools for display
      const formattedPools = pools.map(pool => ({
        lp_mint: pool.pool_address,
        pool_address: pool.pool_address,
        pair_name: `${pool.token_a_symbol || 'UNKNOWN'}/${pool.token_b_symbol || 'UNKNOWN'}`,
        pair_symbol: `${pool.token_a_symbol || 'UNKNOWN'}/${pool.token_b_symbol || 'UNKNOWN'}`,
        token_a_symbol: pool.token_a_symbol || 'UNKNOWN',
        token_b_symbol: pool.token_b_symbol || 'UNKNOWN',
        token_a_name: pool.token_a_name || 'Unknown Token',
        token_b_name: pool.token_b_name || 'Unknown Token',
        liquidity: pool.liquidity || 0,
        volume_24h: pool.volume_24h || 0,
        holder_count: 0,
        total_supply: 0,
        decimals: 9,
        updated_at: new Date().toISOString()
      }));

      setLpTokens(formattedPools);
      
    } catch (error) {
      console.error('❌ Failed to load LP data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTokens = lpTokens.filter(token =>
    token.lp_mint.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.pair_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1419] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading liquidity pools from XDEX...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f1419] text-white">
        <div className="max-w-[1800px] mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-6">
            <Link to={createPageUrl('Dashboard')}>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>

          <Card className="bg-[#1d2d3a] border-red-500/20">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <AlertCircleIcon className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Failed to Load LP Data</h3>
                <p className="text-gray-400 mb-4">{error}</p>
                <div className="space-y-2 text-sm text-gray-500 mb-6">
                  <p>This might be due to:</p>
                  <ul className="list-disc list-inside">
                    <li>XDEX API is temporarily unavailable</li>
                    <li>Network connection issue</li>
                    <li>CORS restrictions from your browser</li>
                  </ul>
                  <p className="mt-4 text-cyan-400">Try refreshing or check back later</p>
                </div>
                <Button onClick={loadData} className="bg-cyan-500 hover:bg-cyan-600">
                  <RefreshCwIcon className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <div className="max-w-[1800px] mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl('Dashboard')}>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-bold text-white">Liquidity Pools</h1>
              <p className="text-gray-400 mt-1">
                Explore XDEX liquidity pools on X1 Mainnet
              </p>
            </div>
          </div>
          <Button 
            onClick={loadData} 
            variant="outline" 
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCwIcon className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#1d2d3a] border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Total Pools</CardTitle>
              <DropletIcon className="h-4 w-4 text-cyan-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.total_pools || 0}</div>
              <p className="text-xs text-gray-500">Active liquidity pools</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1d2d3a] border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Total Liquidity</CardTitle>
              <TrendingUpIcon className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                ${(stats?.total_liquidity_usd || 0).toLocaleString()}
              </div>
              <p className="text-xs text-gray-500">Total value locked</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1d2d3a] border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">24h Volume</CardTitle>
              <ActivityIcon className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                ${(stats?.total_volume_24h || 0).toLocaleString()}
              </div>
              <p className="text-xs text-gray-500">Trading volume</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1d2d3a] border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Unique Tokens</CardTitle>
              <UsersIcon className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.unique_tokens || 0}</div>
              <p className="text-xs text-gray-500">In all pools</p>
            </CardContent>
          </Card>
        </div>

        {/* Pools Table */}
        <Card className="bg-[#1d2d3a] border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Liquidity Pools</CardTitle>
            <CardDescription className="text-gray-400">All pools sorted by liquidity</CardDescription>
            <div className="flex items-center space-x-2 pt-4">
              <SearchIcon className="h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by pool address or token pair..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm bg-[#0f1419] border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-white/5 hover:bg-transparent">
                  <TableHead className="text-gray-400 w-16">#</TableHead>
                  <TableHead className="text-gray-400">Pool Pair</TableHead>
                  <TableHead className="text-right text-gray-400">Liquidity</TableHead>
                  <TableHead className="text-right text-gray-400">24h Volume</TableHead>
                  <TableHead className="text-right text-gray-400">Pool Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTokens.length > 0 ? filteredTokens.map((token, index) => (
                  <TableRow key={token.lp_mint} className="border-white/5 hover:bg-white/5">
                    <TableCell className="text-gray-400 font-medium">
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-semibold">
                      <div className="flex items-center space-x-2">
                        <span className="text-cyan-400">
                          {token.pair_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-400">
                      ${token.liquidity.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-gray-300">
                      ${token.volume_24h.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <code className="text-xs text-gray-500">
                          {token.lp_mint.substring(0, 8)}...{token.lp_mint.slice(-6)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-white/10"
                          onClick={() => window.open(`https://explorer.mainnet.x1.xyz/address/${token.lp_mint}`, '_blank')}
                          title={`View on X1 Explorer`}
                        >
                          <ExternalLinkIcon className="h-3 w-3 text-cyan-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:bg-white/10"
                          onClick={() => window.open(`https://app.xdex.xyz/liquidity?pool=${token.lp_mint}`, '_blank')}
                          title={`View on XDEX`}
                        >
                          <ExternalLinkIcon className="h-3 w-3 text-purple-400" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No pools found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LPExplorer;
