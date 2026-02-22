// src/pages/LPExplorer.jsx
// Clean version - Only Pools tab (removed empty Top Holders and Recent Activity tabs)

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
  SearchIcon,
  ExternalLinkIcon,
  ArrowLeftIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  ArrowUpDown,
  ArrowUpIcon,
  ArrowDownIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  getLPStats,
  getLPTokens
} from '../components/x1/lpApi';

const LPExplorer = () => {
  const [stats, setStats] = useState(null);
  const [lpTokens, setLpTokens] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'liquidity_usd', direction: 'desc' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [statsData, tokensData] = await Promise.all([
        getLPStats(),
        getLPTokens(500)
      ]);

      setStats(statsData.stats);
      setLpTokens(tokensData.tokens || []);
    } catch (error) {
      console.error('Failed to load LP data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Sorting function
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter and sort tokens
  const filteredTokens = (lpTokens || [])
    .filter(token =>
      token.lp_mint.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.token_a_symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.token_b_symbol?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'holder_count':
          aValue = a.holder_count || 0;
          bValue = b.holder_count || 0;
          break;
        case 'liquidity_usd':
          aValue = a.liquidity_usd || 0;
          bValue = b.liquidity_usd || 0;
          break;
        case 'updated_at':
          aValue = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          bValue = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (sortConfig.direction === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

  // Sort indicator component
  const SortIndicator = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-3 w-3 ml-1 text-gray-500" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUpIcon className="h-3 w-3 ml-1 text-cyan-400" />
      : <ArrowDownIcon className="h-3 w-3 ml-1 text-cyan-400" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1419] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading LP data...</p>
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
                  <p>Please check:</p>
                  <ul className="list-disc list-inside">
                    <li>XDEX API is available</li>
                    <li>Network connection is stable</li>
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
          >
            <RefreshCwIcon className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <CardTitle className="text-sm font-medium text-gray-300">Total TVL</CardTitle>
              <TrendingUpIcon className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                ${lpTokens.reduce((sum, t) => sum + (t.liquidity_usd || 0), 0).toLocaleString()}
              </div>
              <p className="text-xs text-gray-500">Total value locked</p>
            </CardContent>
          </Card>
        </div>

        {/* Pools Table - No Tabs */}
        <Card className="bg-[#1d2d3a] border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Liquidity Pools</CardTitle>
            <CardDescription className="text-gray-400">
              {lpTokens.length} pools - Click column headers to sort
            </CardDescription>
            <div className="flex items-center space-x-2 pt-4">
              <SearchIcon className="h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by token pair or address..."
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
                  <TableHead className="text-gray-400">Token Pair</TableHead>
                  <TableHead 
                    className="text-right text-gray-400 cursor-pointer hover:text-cyan-400 transition-colors select-none"
                    onClick={() => handleSort('holder_count')}
                  >
                    <div className="flex items-center justify-end">
                      Holders
                      <SortIndicator columnKey="holder_count" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right text-gray-400 cursor-pointer hover:text-cyan-400 transition-colors select-none"
                    onClick={() => handleSort('liquidity_usd')}
                  >
                    <div className="flex items-center justify-end">
                      TVL (USD)
                      <SortIndicator columnKey="liquidity_usd" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-right text-gray-400 cursor-pointer hover:text-cyan-400 transition-colors select-none"
                    onClick={() => handleSort('updated_at')}
                  >
                    <div className="flex items-center justify-end">
                      Updated
                      <SortIndicator columnKey="updated_at" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTokens.length > 0 ? filteredTokens.map((token, index) => (
                  <TableRow key={token.lp_mint} className="border-white/5 hover:bg-white/5">
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
                        
                        <div className="flex items-center gap-2">
                          <span className="text-cyan-400 font-semibold">
                            {token.pair_symbol || `${token.token_a_symbol}/${token.token_b_symbol}`}
                          </span>
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
                            onClick={() => window.open(`https://app.xdex.xyz/liquidity`, '_blank')}
                            title={`Trade on XDEX`}
                          >
                            <ExternalLinkIcon className="h-3 w-3 text-purple-400" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="border-cyan-400/30 text-cyan-400">
                        {token.holder_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-400 font-semibold">
                      ${(token.liquidity_usd || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-sm text-gray-500">
                      {token.updated_at ? new Date(token.updated_at).toLocaleDateString() : '—'}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
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