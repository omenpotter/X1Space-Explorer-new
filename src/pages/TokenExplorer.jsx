import React, { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Coins, Search, Loader2, Star, ChevronLeft, RefreshCw, Copy, Check, Filter, Globe, Twitter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

import X1Api from '../components/x1/X1ApiClient';

export default function TokenExplorer() {
  const [loading, setLoading] = useState(true);
  const [supply, setSupply] = useState({ total: 0, circulating: 0 });
  const [validators, setValidators] = useState({ totalStake: 0, activeCount: 0 });
  const [allTokens, setAllTokens] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [tokenDetails, setTokenDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [tokenMetadata, setTokenMetadata] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('liquidity');
  const [sortDirection, setSortDirection] = useState('desc');
  const [displayLimit, setDisplayLimit] = useState(100);
  const [copiedAddress, setCopiedAddress] = useState(null);
  const [advancedFilters, setAdvancedFilters] = useState({
    tokenType: 'all',
    liquidityMin: '',
    liquidityMax: ''
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const searchDebounceRef = useRef(null);
  const [expandedToken, setExpandedToken] = useState(null);
  const [modalToken, setModalToken] = useState(null);

  useEffect(() => {
    loadWatchlist();
    fetchData();
  }, []);

  const loadWatchlist = () => {
    const saved = localStorage.getItem('x1_token_watchlist');
    if (saved) setWatchlist(JSON.parse(saved));
  };

  const toggleWatchlist = (mint) => {
    const updated = watchlist.includes(mint) 
      ? watchlist.filter(m => m !== mint)
      : [...watchlist, mint];
    setWatchlist(updated);
    localStorage.setItem('x1_token_watchlist', JSON.stringify(updated));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('🔄 Fetching tokens from API...');
      
      // Fetch ALL tokens (verified and unverified)
      const allTokensResponse = await X1Api.listTokens({ limit: 500, offset: 0, verified: false });

      console.log('📊 API Response:', allTokensResponse);

      if (allTokensResponse.success && allTokensResponse.data?.tokens) {
        const tokens = allTokensResponse.data.tokens;
        
        console.log(`✅ Loaded ${tokens.length} tokens from API`);
        
        const tokenData = tokens.map(token => ({
          mint: token.mint,
          name: token.name || 'Unknown Token',
          symbol: token.symbol || 'UNKNOWN',
          logo: token.logo_uri,
          decimals: token.decimals || 9,
          totalSupply: token.total_supply || 0,
          tokenType: token.token_type || 'SPL Token',
          price: token.price ? parseFloat(token.price).toFixed(4) : '0.0000',
          marketCap: token.market_cap || 0,
          priceChange24h: token.price_change_24h ? parseFloat(token.price_change_24h).toFixed(2) : '0.00',
          liquidity: token.liquidity || 0,
          poolCount: token.pool_count || 0,
          website: token.website,
          twitter: token.twitter,
          verified: token.verification_count > 0,
          priceHistory: token.price_history || []
        }));

        setAllTokens(tokenData);
        console.log(`✅ Total tokens: ${tokenData.length}`);
        
        // Fetch supply and validator stats from RPC
        try {
          const X1Rpc = (await import('../components/x1/X1RpcService')).default;
          
          const [supplyInfo, voteAccounts] = await Promise.all([
            X1Rpc.getSupply(),
            X1Rpc.getVoteAccounts()
          ]);

          if (supplyInfo) {
            setSupply({
              total: supplyInfo.value.total,
              circulating: supplyInfo.value.circulating
            });
          }

          if (voteAccounts) {
            const totalStake = voteAccounts.current.reduce((sum, v) => sum + v.activatedStake, 0);
            setValidators({
              totalStake,
              activeCount: voteAccounts.current.length
            });
          }
        } catch (err) {
          console.warn('Could not fetch supply/validator stats:', err);
        }
      } else {
        console.log('⚠️ No token data available');
        setAllTokens([]);
      }
    } catch (err) {
      console.error('❌ Fetch error:', err);
      setAllTokens([]);
    } finally {
      setLoading(false);
    }
  };
  
  const filteredAndSortedTokens = useMemo(() => {
    let filtered = [...allTokens];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(token => 
        token.name.toLowerCase().includes(query) ||
        token.symbol.toLowerCase().includes(query) ||
        token.mint.toLowerCase().includes(query)
      );
    }
    
    // Apply advanced filters
    if (advancedFilters.tokenType !== 'all') {
      filtered = filtered.filter(token => token.tokenType === advancedFilters.tokenType);
    }
    
    if (advancedFilters.liquidityMin) {
      filtered = filtered.filter(token => token.liquidity >= parseFloat(advancedFilters.liquidityMin));
    }
    
    if (advancedFilters.liquidityMax) {
      filtered = filtered.filter(token => token.liquidity <= parseFloat(advancedFilters.liquidityMax));
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      switch(sortBy) {
        case 'liquidity': return direction * (b.liquidity - a.liquidity);
        case 'poolCount': return direction * (b.poolCount - a.poolCount);
        case 'price': return direction * (parseFloat(b.price) - parseFloat(a.price));
        case 'name': return direction * a.name.localeCompare(b.name);
        default: return 0;
      }
    });
    
    return sorted;
  }, [allTokens, searchQuery, sortBy, sortDirection, advancedFilters]);
  
  const handleSearchChange = useCallback((value) => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    searchDebounceRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 300);
  }, []);
  
  const copyToClipboard = useCallback((address) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  }, []);
  
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500) {
        if (displayLimit < filteredAndSortedTokens.length) {
          setDisplayLimit(prev => Math.min(prev + 50, filteredAndSortedTokens.length));
        }
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [displayLimit, filteredAndSortedTokens.length]);

  const fetchTokenDetails = async (mint) => {
    setLoadingDetails(true);
    setSelectedToken(mint);
    
    try {
      const X1Rpc = (await import('../components/x1/X1RpcService')).default;
      const accountInfo = await X1Rpc.getAccountInfo(mint);
      
      if (accountInfo?.value) {
        const parsed = accountInfo.value.data?.parsed?.info;
        
        setTokenDetails({
          mint,
          decimals: parsed?.decimals || 9,
          supply: Number(parsed?.supply || 0) / Math.pow(10, parsed?.decimals || 9),
          mintAuthority: parsed?.mintAuthority || 'None',
          freezeAuthority: parsed?.freezeAuthority || 'None',
          isInitialized: parsed?.isInitialized || false,
          supplyType: parsed?.mintAuthority ? 'Mintable' : 'Fixed Supply'
        });
      }
      
      const tokenData = allTokens.find(t => t.mint === mint);
      if (tokenData) {
        setTokenMetadata({
          name: tokenData.name,
          symbol: tokenData.symbol,
          image: tokenData.logo,
          website: tokenData.website,
          twitter: tokenData.twitter
        });
      }
    } catch (err) {
      console.error('Failed to fetch token details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatNum = (num) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    if (num >= 1) return num.toFixed(2);
    if (num >= 0.01) return num.toFixed(4);
    if (num >= 0.000001) return num.toFixed(8);
    if (num > 0) return num.toExponential(2);
    return '0.00';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1419] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading tokens from XDEX...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <header className="bg-[#1d2d3a] border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2 hover:opacity-80">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
                <span className="font-bold"><span className="text-cyan-400">X1</span>Space</span>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={fetchData} variant="outline" size="sm" className="border-white/20 text-cyan-400">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Coins className="w-7 h-7 text-cyan-400" />
            Token Explorer
            <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs ml-2">
              {allTokens.length} Tokens
            </Badge>
          </h1>
        </div>

        {/* Top Stats - Only 3 cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#1d2d3a] border border-white/10 rounded-lg p-4">
            <p className="text-gray-400 text-xs">Total Tokens</p>
            <p className="text-2xl font-bold text-cyan-400">{allTokens.length}</p>
          </div>
          <div className="bg-[#1d2d3a] border border-white/10 rounded-lg p-4">
            <p className="text-gray-400 text-xs">Total Staked</p>
            <p className="text-2xl font-bold text-purple-400">
              {validators.totalStake ? formatNum(validators.totalStake / 1e9) : '0'} B
            </p>
          </div>
          <div className="bg-[#1d2d3a] border border-white/10 rounded-lg p-4">
            <p className="text-gray-400 text-xs">Active Validators</p>
            <p className="text-2xl font-bold text-cyan-400">{validators.activeCount || 0}</p>
          </div>
        </div>

        {/* XNT Featured */}
        {(() => {
          // Find WXNT token (wrapped XNT) for actual price
          const xntToken = allTokens.find(t => 
            t.symbol === 'WXNT' || 
            t.mint === 'So11111111111111111111111111111111111111112'
          );
          const xntPrice = xntToken ? parseFloat(xntToken.price) : 1.00;
          const xntLiquidity = xntToken ? xntToken.liquidity : 0;
          const priceHistory = xntToken?.priceHistory?.length > 0 
            ? xntToken.priceHistory 
            : Array.from({ length: 30 }, (_, i) => ({ day: i, price: xntPrice }));
          
          return (
            <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                    <span className="text-black font-black text-lg">X1</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">X1 Native Token (XNT)</h2>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-0 mt-1">
                      ${xntPrice.toFixed(4)}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-gray-400 text-xs">Liquidity</p>
                    <p className="text-white font-bold">${formatNum(xntLiquidity)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Market Cap</p>
                    <p className="text-white font-bold">${formatNum((supply.circulating / 1e9) * xntPrice)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">24h Change</p>
                    <p className={`font-bold ${parseFloat(xntToken?.priceChange24h || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {parseFloat(xntToken?.priceChange24h || 0) >= 0 ? '+' : ''}{xntToken?.priceChange24h || '0.00'}%
                    </p>
                  </div>
                  <div className="h-16 w-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={priceHistory}>
                        <Line type="monotone" dataKey="price" stroke="#06b6d4" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Search and Filters */}
        <div className="bg-[#1d2d3a] border border-white/10 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center mb-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search tokens by name, symbol, or mint address..."
                onChange={(e) => handleSearchChange(e.target.value)}
                className="bg-[#0f1419] border-white/10 text-white pl-10"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#0f1419] border border-white/10 text-white rounded-lg px-3 py-2"
            >
              <option value="liquidity">Liquidity</option>
              <option value="price">Price</option>
              <option value="poolCount">Pool Count</option>
              <option value="name">Name</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
              className="border-white/20"
            >
              {sortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`border-white/20 ${showAdvancedFilters ? 'bg-cyan-500/20 text-cyan-400' : ''}`}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
          </div>
          
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-white/10">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Liquidity Range</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={advancedFilters.liquidityMin}
                    onChange={(e) => setAdvancedFilters({...advancedFilters, liquidityMin: e.target.value})}
                    className="bg-[#0f1419] border-white/10 text-white text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={advancedFilters.liquidityMax}
                    onChange={(e) => setAdvancedFilters({...advancedFilters, liquidityMax: e.target.value})}
                    className="bg-[#0f1419] border-white/10 text-white text-sm"
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAdvancedFilters({ tokenType: 'all', liquidityMin: '', liquidityMax: '' })}
                className="text-gray-400 hover:text-white self-end"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>

        {/* Tokens Table */}
        <div className="bg-[#1d2d3a] border border-white/10 rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="text-white font-medium">
              All Tokens ({filteredAndSortedTokens.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 text-xs px-4 py-3">#</th>
                  <th className="text-left text-gray-400 text-xs px-4 py-3">Token</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3">Price</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3">Liquidity</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3">Pools</th>
                  <th className="text-center text-gray-400 text-xs px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedTokens.slice(0, displayLimit).map((token, i) => (
                  <Fragment key={token.mint}>
                    <tr className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {token.logo ? (
                            <img src={token.logo} alt={token.symbol} className="w-8 h-8 rounded-full" onError={(e) => e.target.style.display = 'none'} />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs">
                              {token.symbol.substring(0, 2)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium text-sm">{token.name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-gray-500 text-xs">{token.symbol}</p>
                              <button
                                onClick={() => copyToClipboard(token.mint)}
                                className="text-gray-500 hover:text-cyan-400 transition-colors shrink-0"
                                title="Copy mint address"
                              >
                                {copiedAddress === token.mint ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                              {token.verified && (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">✓</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-white font-mono">${parseFloat(token.price).toFixed(4)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-mono">${formatNum(token.liquidity)}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant="outline" className="border-cyan-400/30 text-cyan-400">
                          {token.poolCount}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => toggleWatchlist(token.mint)} className={watchlist.includes(token.mint) ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'}>
                            <Star className="w-4 h-4" fill={watchlist.includes(token.mint) ? 'currentColor' : 'none'} />
                          </button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              if (expandedToken === token.mint) {
                                setExpandedToken(null);
                              } else {
                                setExpandedToken(token.mint);
                                setModalToken(token);
                                await fetchTokenDetails(token.mint);
                              }
                            }}
                            className={`border-white/20 text-cyan-400 hover:bg-cyan-500/10 text-xs ${
                              expandedToken === token.mint ? 'bg-cyan-500/20' : ''
                            }`}
                          >
                            {expandedToken === token.mint ? 'Hide' : 'Details'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    
                    {expandedToken === token.mint && tokenDetails && (
                      <tr>
                        <td colSpan="6" className="p-0 bg-[#0f1419]">
                          <div className="p-6 border-t border-white/5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <h3 className="text-white font-bold mb-4">Token Information</h3>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Mint Authority:</span>
                                    <span className="text-white font-mono text-xs">{tokenDetails.mintAuthority === 'None' ? 'None' : `${tokenDetails.mintAuthority.slice(0, 8)}...`}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Freeze Authority:</span>
                                    <span className="text-white font-mono text-xs">{tokenDetails.freezeAuthority === 'None' ? 'None' : `${tokenDetails.freezeAuthority.slice(0, 8)}...`}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Decimals:</span>
                                    <span className="text-white">{tokenDetails.decimals}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Supply Type:</span>
                                    <Badge variant="outline" className={tokenDetails.supplyType === 'Fixed Supply' ? 'border-emerald-400/30 text-emerald-400' : 'border-yellow-400/30 text-yellow-400'}>
                                      {tokenDetails.supplyType}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              
                              {tokenMetadata && (
                                <div>
                                  <h3 className="text-white font-bold mb-4">Links</h3>
                                  <div className="space-y-2">
                                    {tokenMetadata.website && (
                                      <a href={tokenMetadata.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm">
                                        <Globe className="w-4 h-4" />
                                        Website
                                      </a>
                                    )}
                                    {tokenMetadata.twitter && (
                                      <a href={tokenMetadata.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm">
                                        <Twitter className="w-4 h-4" />
                                        Twitter
                                      </a>
                                    )}
                                    <a href={`https://explorer.mainnet.x1.xyz/address/${token.mint}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm">
                                      View on X1 Explorer
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {displayLimit < filteredAndSortedTokens.length && (
            <div className="p-4 text-center border-t border-white/5">
              <p className="text-gray-400 text-sm">Showing {displayLimit} of {filteredAndSortedTokens.length} tokens - Scroll for more</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
