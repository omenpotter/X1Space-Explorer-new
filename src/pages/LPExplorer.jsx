// src/pages/LPExplorer.jsx
// LP Explorer with debug logging

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
  getTopLPHolders,
  getLPEvents,
  getLPEventStats,
  formatLPAmount,
  formatEventTime
} from '@/services/lpApi';

const LPExplorer = () => {
  const [stats, setStats] = useState(null);
  const [lpTokens, setLpTokens] = useState([]);
  const [topHolders, setTopHolders] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [eventStats, setEventStats] = useState(null);
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
      
      console.log('🔄 Starting LP data load...');
      
      const [statsData, tokensData, holdersData, eventsData, eventStatsData] = await Promise.all([
        getLPStats(),
        getLPTokens(500),
        getTopLPHolders(100),
        getLPEvents({ limit: 50 }),
        getLPEventStats()
      ]);

      console.log('📊 Stats data:', statsData);
      console.log('📊 Tokens data:', tokensData);
      console.log('📊 First 3 tokens:', tokensData.tokens?.slice(0, 3));

      setStats(statsData.stats);
      setLpTokens(tokensData.tokens || []);
      setTopHolders(holdersData.holders || []);
      setRecentEvents(eventsData.events || []);
      setEventStats(eventStatsData.stats);
      
      console.log(`✅ State updated - ${tokensData.tokens?.length || 0} pools`);
      
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
      token.token_a_symbol?.toLowerCase().includes(searchLower) ||
      token.token_b_symbol?.toLowerCase().includes(searchLower) ||
      token.pair_symbol?.toLowerCase().includes(searchLower)
    );
  });

  console.log('🔍 Filtered tokens:', filteredTokens.length, 'from', lpTokens.length);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1419] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading LP data from XDEX...</p>
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
                    <li>Backend functions not deployed</li>
                    <li>XDEX API is temporarily unavailable</li>
                    <li>Network connection issue</li>
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
              <p className="text-xs text-gray-500 mt-1">
                Debug: {lpTokens.length} pools loaded
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
              <CardTitle className="text-sm font-medium text-gray-300">Total Holders</CardTitle>
              <UsersIcon className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.total_holders || 0}</div>
              <p className="text-xs text-gray-500">Unique LP holders</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1d2d3a] border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">Total LP Supply</CardTitle>
              <TrendingUpIcon className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {stats?.total_lp_supply ? formatLPAmount(stats.total_lp_supply, 0) : '0'}
              </div>
              <p className="text-xs text-gray-500">LP tokens issued</p>
            </CardContent>
          </Card>

          <Card className="bg-[#1d2d3a] border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">LP Events</CardTitle>
              <ActivityIcon className="h-4 w-4 text-yellow-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{eventStats?.total_events || 0}</div>
              <p className="text-xs text-gray-500">
                <span className="text-emerald-400">{eventStats?.add_count || 0} adds</span> · {' '}
                <span className="text-red-400">{eventStats?.remove_count || 0} removes</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Pools Table */}
        <Card className="bg-[#1d2d3a] border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Liquidity Pools</CardTitle>
            <CardDescription className="text-gray-400">
              {lpTokens.length} pools sorted by TVL
            </CardDescription>
            <div className="flex items-center space-x-2 pt-4">
              <SearchIcon className="h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by LP mint address or token pair..."
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
                  <TableHead className="text-gray-400">LP Token Pair</TableHead>
                  <TableHead className="text-right text-gray-400">Holders</TableHead>
                  <TableHead className="text-right text-gray-400">Total Supply</TableHead>
                  <TableHead className="text-right text-gray-400">TVL</TableHead>
                  <TableHead className="text-right text-gray-400">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTokens.length > 0 ? filteredTokens.map((token, index) => {
                  // Debug log first token
                  if (index === 0) {
                    console.log('🔍 Rendering first token:', token);
                  }
                  
                  return (
                    <TableRow key={token.lp_mint || index} className="border-white/5 hover:bg-white/5">
                      <TableCell className="text-gray-400 font-medium">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center space-x-3">
                          {/* Token Logos */}
                          {(token.token_a_logo || token.token_b_logo) && (
                            <div className="flex -space-x-2">
                              {token.token_a_logo && (
                                <img 
                                  src={token.token_a_logo} 
                                  alt={token.token_a_symbol}
                                  className="w-6 h-6 rounded-full border-2 border-[#1d2d3a] bg-gray-800"
                                  onError={(e) => e.target.style.display = 'none'}
                                />
                              )}
                              {token.token_b_logo && (
                                <img 
                                  src={token.token_b_logo} 
                                  alt={token.token_b_symbol}
                                  className="w-6 h-6 rounded-full border-2 border-[#1d2d3a] bg-gray-800"
                                  onError={(e) => e.target.style.display = 'none'}
                                />
                              )}
                            </div>
                          )}
                          
                          {/* Pair Name */}
                          <div className="flex items-center gap-2">
                            <span className="text-cyan-400 font-semibold">
                              {token.token_a_symbol && token.token_b_symbol && 
                               token.token_a_symbol !== 'UNKNOWN' && token.token_b_symbol !== 'UNKNOWN'
                                ? `${token.token_a_symbol} / ${token.token_b_symbol}`
                                : token.pair_symbol || 
                                  (token.lp_mint ? `${token.lp_mint.slice(0,6)}…${token.lp_mint.slice(-4)}` : '—')}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-white/10"
                              onClick={() => window.open(`https://explorer.mainnet.x1.xyz/address/${token.lp_mint}`, '_blank')}
                              title={`View ${token.lp_mint} on X1 Explorer`}
                            >
                              <ExternalLinkIcon className="h-3 w-3 text-cyan-400" />
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="border-cyan-400/30 text-cyan-400">
                          {token.holder_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-gray-300">
                        {formatLPAmount(token.total_supply, token.decimals)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-400">
                        ${(token.liquidity_usd || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-sm text-gray-500">
                        {token.updated_at ? new Date(token.updated_at).toLocaleDateString() : '—'}
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {searchTerm ? 'No pools found matching your search' : 'No pools available'}
                      <div className="text-xs mt-2">
                        Debug: lpTokens.length = {lpTokens.length}, filteredTokens.length = {filteredTokens.length}
                      </div>
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
