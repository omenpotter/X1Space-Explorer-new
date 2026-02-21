// src/pages/LPExplorer.jsx
// Final version - Pure XDEX API with correct data display

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  ExternalLinkIcon,
  ArrowLeftIcon,
  RefreshCwIcon,
  AlertCircleIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  getLPStats,
  getLPTokens,
  formatLPAmount
} from '@/services/lpApi';

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
      
      console.log('🔄 Loading LP data from XDEX...');
      
      const [statsData, tokensData] = await Promise.all([
        getLPStats(),
        getLPTokens(500)
      ]);

      setStats(statsData.stats);
      setLpTokens(tokensData.tokens);
      
      console.log(`✅ Loaded ${tokensData.tokens.length} pools`);
      
    } catch (error) {
      console.error('❌ Failed to load LP data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTokens = lpTokens.filter(token => {
    const searchLower = searchTerm.toLowerCase();
    return (
      token.lp_mint?.toLowerCase().includes(searchLower) ||
      token.pair_name?.toLowerCase().includes(searchLower) ||
      token.pair_symbol?.toLowerCase().includes(searchLower) ||
      token.token_a?.symbol?.toLowerCase().includes(searchLower) ||
      token.token_b?.symbol?.toLowerCase().includes(searchLower) ||
      token.token_a_symbol?.toLowerCase().includes(searchLower) ||
      token.token_b_symbol?.toLowerCase().includes(searchLower)
    );
  });

  // Helper to safely get token pair name
  const getPairName = (token) => {
    // Try different property combinations
    if (token.pair_name) return token.pair_name;
    if (token.pair_symbol) return token.pair_symbol;
    
    // Try nested token objects
    if (token.token_a?.symbol && token.token_b?.symbol) {
      return `${token.token_a.symbol}/${token.token_b.symbol}`;
    }
    
    // Try flat properties
    if (token.token_a_symbol && token.token_b_symbol) {
      return `${token.token_a_symbol}/${token.token_b_symbol}`;
    }
    
    return 'UNKNOWN/UNKNOWN';
  };

  // Helper to get token images
  const getTokenImages = (token) => {
    return {
      tokenA: token.token_a?.image || token.token_a_image || null,
      tokenB: token.token_b?.image || token.token_b_image || null
    };
  };

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
                  <p>Possible causes:</p>
                  <ul className="list-disc list-inside">
                    <li>XDEX API is temporarily unavailable</li>
                    <li>Network connection issue</li>
                    <li>CORS restrictions</li>
                  </ul>
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
            disabled={loading}
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
            <CardDescription className="text-gray-400">
              {lpTokens.length} pools from XDEX
            </CardDescription>
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
                  <TableHead className="text-right text-gray-400">APR</TableHead>
                  <TableHead className="text-right text-gray-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTokens.length > 0 ? filteredTokens.map((token, index) => {
                  const pairName = getPairName(token);
                  const images = getTokenImages(token);
                  
                  return (
                    <TableRow key={token.lp_mint || index} className="border-white/5 hover:bg-white/5">
                      <TableCell className="text-gray-400 font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {/* Token Images */}
                          <div className="flex -space-x-2">
                            {images.tokenA && (
                              <img 
                                src={images.tokenA} 
                                alt="Token A" 
                                className="w-6 h-6 rounded-full border-2 border-[#1d2d3a] bg-gray-800"
                                onError={(e) => e.target.style.display = 'none'}
                              />
                            )}
                            {images.tokenB && (
                              <img 
                                src={images.tokenB} 
                                alt="Token B" 
                                className="w-6 h-6 rounded-full border-2 border-[#1d2d3a] bg-gray-800"
                                onError={(e) => e.target.style.display = 'none'}
                              />
                            )}
                          </div>
                          
                          {/* Pair Name */}
                          <span className="text-cyan-400 font-semibold">
                            {pairName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-400">
                        ${(token.liquidity_usd || token.liquidity || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-gray-300">
                        ${(token.volume_24h || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {token.apr ? (
                          <Badge variant="outline" className="border-emerald-400/30 text-emerald-400">
                            {token.apr.toFixed(2)}%
                          </Badge>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-white/10"
                            onClick={() => window.open(`https://explorer.mainnet.x1.xyz/address/${token.lp_mint || token.pool_address}`, '_blank')}
                            title="View on X1 Explorer"
                          >
                            <ExternalLinkIcon className="h-3 w-3 text-cyan-400" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-white/10"
                            onClick={() => window.open(`https://app.xdex.xyz/liquidity?pool=${token.lp_mint || token.pool_address}`, '_blank')}
                            title="Add Liquidity on XDEX"
                          >
                            <ExternalLinkIcon className="h-3 w-3 text-purple-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {searchTerm ? 'No pools found matching your search' : 'No pools available'}
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
