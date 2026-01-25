import React, { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Coins, Search, Loader2, TrendingUp, TrendingDown, Star, ChevronLeft, RefreshCw, Copy, Check, Clock, Calendar, Filter, Globe, Twitter, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis, PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area } from 'recharts';

import X1Api from '../components/x1/X1ApiClient';
import AIVerificationAssistant from '../components/portfolio/AIVerificationAssistant';
import SmartSearchBar from '../components/ai/SmartSearchBar';
import TokenHealthScore from '../components/ai/TokenHealthScore';
import NetworkAnomalyAlert from '../components/ai/NetworkAnomalyAlert';
import TokenDetailsModal from '../components/TokenDetailsModal';

// Helper to derive Metaplex metadata PDA
const deriveMetadataPDA = async (mint) => {
  const METADATA_PROGRAM_ID = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
  const seeds = [
    Buffer.from('metadata'),
    Buffer.from(METADATA_PROGRAM_ID, 'base64'),
    Buffer.from(mint, 'base64')
  ];
  return mint; // Placeholder
};

// Parse Metaplex metadata from account data
const parseMetaplexMetadata = (accountData) => {
  try {
    return {
      name: 'Token',
      symbol: 'TKN',
      uri: null
    };
  } catch (e) {
    return null;
  }
};

// AUTOMATIC VERIFICATION SYSTEM
// A token is automatically verified if it meets ALL criteria:
const autoVerifyToken = (token) => {
  const hasValidMetadata = token.name && 
                          token.name !== 'Unknown Token' && 
                          token.symbol && 
                          token.symbol !== 'UNKNOWN';
  
  const hasValidSupply = token.totalSupply && token.totalSupply > 0;
  
  const hasPrice = token.price && parseFloat(token.price) > 0;
  
  const hasMarketCap = token.marketCap && token.marketCap > 0;
  
  // Token is verified if it has valid metadata AND (supply OR price data)
  return hasValidMetadata && hasValidSupply && (hasPrice || hasMarketCap);
};

export default function TokenExplorer() {
  const [loading, setLoading] = useState(true);
  const [supply, setSupply] = useState({ total: 0, circulating: 0 });
  const [validators, setValidators] = useState({ totalStake: 0, activeCount: 0 });
  const [allTokens, setAllTokens] = useState([]); // Now contains ALL tokens (verified + unverified)
  const [watchlist, setWatchlist] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [tokenDetails, setTokenDetails] = useState(null);
  const [tokenTransactions, setTokenTransactions] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [tokenHolders, setTokenHolders] = useState([]);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [tokenMetadata, setTokenMetadata] = useState(null);
  const [approveAmount, setApproveAmount] = useState('');
  const [approveSpender, setApproveSpender] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('supply');
  const [txFilter, setTxFilter] = useState({ type: 'all', dateRange: 'all', searchSig: '' });
  const [sortDirection, setSortDirection] = useState('desc');
  const [displayLimit, setDisplayLimit] = useState(50);
  const [copiedAddress, setCopiedAddress] = useState(null);
  const [priceTimeframe, setPriceTimeframe] = useState('7D');
  const [holderChartData, setHolderChartData] = useState([]);
  const [txFlowData, setTxFlowData] = useState([]);
  const [advancedFilters, setAdvancedFilters] = useState({
    tokenType: 'all',
    marketCapMin: '',
    marketCapMax: '',
    priceChangeMin: '',
    priceChangeMax: '',
    verificationStatus: 'all' // New filter: 'all', 'verified', 'unverified'
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const searchDebounceRef = useRef(null);
  const [livePriceIndicator, setLivePriceIndicator] = useState(false);
  const [apiHealthy, setApiHealthy] = useState(false);
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [liquidityPools, setLiquidityPools] = useState([]);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiAssistantToken, setAiAssistantToken] = useState(null);
  const [aiSearchResult, setAiSearchResult] = useState(null);
  const [expandedToken, setExpandedToken] = useState(null);
  const [modalToken, setModalToken] = useState(null);

  useEffect(() => {
    loadWatchlist();
    fetchData();
    
    // Check X1 API health
    X1Api.checkHealth().then(health => {
      setApiHealthy(health.status === 'online');
      console.log('X1 API Status:', health.status);
    });
    
    // Subscribe to real-time token updates via WebSocket
    const unsubscribe = X1Api.subscribeToTokenUpdates((update) => {
      console.log('🔴 Real-time WebSocket update:', update);
      
      if (update.type === 'token_created') {
        const newToken = {
          mint: update.data.mint,
          name: update.data.name || 'Unknown Token',
          symbol: update.data.symbol || 'UNKNOWN',
          logo: update.data.logo_uri,
          decimals: update.data.decimals || 9,
          totalSupply: update.data.total_supply || 0,
          tokenType: update.data.token_type || 'SPL Token',
          price: update.data.price || '0.0000',
          marketCap: update.data.market_cap || 0,
          priceChange24h: update.data.price_change_24h || '0.00',
          verified: false, // Will be auto-verified below
          priceHistory: []
        };
        
        // AUTOMATIC VERIFICATION
        newToken.verified = autoVerifyToken(newToken);
        
        // Add to allTokens array (no more separate arrays)
        setAllTokens(prev => [newToken, ...prev]);
        setLivePriceIndicator(true);
        setTimeout(() => setLivePriceIndicator(false), 2000);
      }
      
      if (update.type === 'token_verified' || update.type === 'token_updated') {
        setAllTokens(prev => prev.map(token => {
          if (token.mint === update.data.mint) {
            const updatedToken = {
              ...token,
              ...update.data,
              price: update.data.price ? parseFloat(update.data.price).toFixed(4) : token.price,
              marketCap: update.data.market_cap || token.marketCap,
              priceChange24h: update.data.price_change_24h ? parseFloat(update.data.price_change_24h).toFixed(2) : token.priceChange24h
            };
            
            // RE-VERIFY after update
            updatedToken.verified = autoVerifyToken(updatedToken);
            return updatedToken;
          }
          return token;
        }));
        setLivePriceIndicator(true);
        setTimeout(() => setLivePriceIndicator(false), 2000);
      }
      
      if (update.type === 'price_update') {
        setAllTokens(prev => prev.map(token => {
          const priceData = update.data[token.mint];
          if (priceData) {
            const updatedToken = {
              ...token,
              price: priceData.price.toFixed(4),
              priceChange24h: priceData.price_change_24h?.toFixed(2) || token.priceChange24h,
              marketCap: priceData.market_cap || token.marketCap
            };
            
            // RE-VERIFY after price update
            updatedToken.verified = autoVerifyToken(updatedToken);
            return updatedToken;
          }
          return token;
        }));
        setLivePriceIndicator(true);
        setTimeout(() => setLivePriceIndicator(false), 2000);
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [supplyData, validatorData, tokensData] = await Promise.all([
        X1Api.getSupply(),
        X1Api.getValidatorInfo(),
        X1Api.getTokenList()
      ]);

      setSupply(supplyData);
      setValidators(validatorData);

      // Process and AUTO-VERIFY all tokens
      const processedTokens = tokensData.map(token => {
        const processed = {
          ...token,
          price: token.price ? parseFloat(token.price).toFixed(4) : '0.0000',
          priceChange24h: token.priceChange24h ? parseFloat(token.priceChange24h).toFixed(2) : '0.00',
          verified: false // Will be set below
        };
        
        // AUTOMATIC VERIFICATION
        processed.verified = autoVerifyToken(processed);
        return processed;
      });

      setAllTokens(processedTokens);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWatchlist = () => {
    try {
      const saved = localStorage.getItem('tokenWatchlist');
      if (saved) setWatchlist(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load watchlist', e);
    }
  };

  const toggleWatchlist = (mint) => {
    const updated = watchlist.includes(mint) 
      ? watchlist.filter(m => m !== mint)
      : [...watchlist, mint];
    setWatchlist(updated);
    localStorage.setItem('tokenWatchlist', JSON.stringify(updated));
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(text);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatNum = (num) => {
    if (!num || num === 0) return '0';
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toLocaleString();
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (hours < 1) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const fetchTokenDetails = async (mint) => {
    try {
      const [details, holders, txs, metadata, pools] = await Promise.all([
        X1Api.getTokenDetails(mint),
        X1Api.getTokenHolders(mint),
        X1Api.getTokenTransactions(mint),
        X1Api.getTokenMetadata(mint),
        X1Api.getTokenLiquidityPools(mint)
      ]);

      setTokenDetails(details);
      setTokenHolders(holders);
      setTokenTransactions(txs);
      setTokenMetadata(metadata);
      setLiquidityPools(pools);

      // Generate holder distribution chart
      const topHolders = holders.slice(0, 10);
      const othersAmount = holders.slice(10).reduce((sum, h) => sum + h.balance, 0);
      const chartData = [
        ...topHolders.map(h => ({ name: h.address.substring(0, 8), value: h.balance })),
        { name: 'Others', value: othersAmount }
      ];
      setHolderChartData(chartData);

      // Generate transaction flow data (last 7 days)
      const now = Date.now() / 1000;
      const weekAgo = now - (7 * 24 * 60 * 60);
      const dailyTxs = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = weekAgo + (i * 24 * 60 * 60);
        const dayEnd = dayStart + (24 * 60 * 60);
        const dayTxs = txs.filter(tx => tx.timestamp >= dayStart && tx.timestamp < dayEnd);
        dailyTxs.push({
          date: new Date(dayStart * 1000).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
          transactions: dayTxs.length,
          volume: dayTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0)
        });
      }
      setTxFlowData(dailyTxs);

    } catch (error) {
      console.error('Failed to fetch token details:', error);
    }
  };

  // Debounced search
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      // Search logic handled by filteredAndSortedTokens
    }, 300);
  };

  // Calculate verified and unverified counts
  const tokenStats = useMemo(() => {
    const verified = allTokens.filter(t => t.verified).length;
    const unverified = allTokens.filter(t => !t.verified).length;
    const total = allTokens.length;
    
    return { total, verified, unverified };
  }, [allTokens]);

  // Filter and sort tokens
  const filteredAndSortedTokens = useMemo(() => {
    let filtered = [...allTokens];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(token =>
        token.name.toLowerCase().includes(query) ||
        token.symbol.toLowerCase().includes(query) ||
        token.mint.toLowerCase().includes(query)
      );
    }

    // Advanced filters
    if (advancedFilters.tokenType !== 'all') {
      filtered = filtered.filter(token => token.tokenType === advancedFilters.tokenType);
    }

    if (advancedFilters.verificationStatus !== 'all') {
      filtered = filtered.filter(token => 
        advancedFilters.verificationStatus === 'verified' ? token.verified : !token.verified
      );
    }

    if (advancedFilters.marketCapMin) {
      filtered = filtered.filter(token => token.marketCap >= parseFloat(advancedFilters.marketCapMin));
    }

    if (advancedFilters.marketCapMax) {
      filtered = filtered.filter(token => token.marketCap <= parseFloat(advancedFilters.marketCapMax));
    }

    if (advancedFilters.priceChangeMin) {
      filtered = filtered.filter(token => parseFloat(token.priceChange24h) >= parseFloat(advancedFilters.priceChangeMin));
    }

    if (advancedFilters.priceChangeMax) {
      filtered = filtered.filter(token => parseFloat(token.priceChange24h) <= parseFloat(advancedFilters.priceChangeMax));
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'price':
          aVal = parseFloat(a.price);
          bVal = parseFloat(b.price);
          break;
        case 'change':
          aVal = parseFloat(a.priceChange24h);
          bVal = parseFloat(b.priceChange24h);
          break;
        case 'marketCap':
          aVal = a.marketCap;
          bVal = b.marketCap;
          break;
        case 'supply':
          aVal = a.totalSupply;
          bVal = b.totalSupply;
          break;
        default:
          return 0;
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  }, [allTokens, searchQuery, sortBy, sortDirection, advancedFilters]);

  const filteredTransactions = useMemo(() => {
    let filtered = [...tokenTransactions];

    if (txFilter.type !== 'all') {
      filtered = filtered.filter(tx => tx.type === txFilter.type);
    }

    if (txFilter.dateRange !== 'all') {
      const now = Date.now() / 1000;
      const ranges = {
        '1h': 60 * 60,
        '24h': 24 * 60 * 60,
        '7d': 7 * 24 * 60 * 60,
        '30d': 30 * 24 * 60 * 60
      };
      const cutoff = now - ranges[txFilter.dateRange];
      filtered = filtered.filter(tx => tx.timestamp >= cutoff);
    }

    if (txFilter.searchSig) {
      const query = txFilter.searchSig.toLowerCase();
      filtered = filtered.filter(tx =>
        tx.signature.toLowerCase().includes(query) ||
        tx.from?.toLowerCase().includes(query) ||
        tx.to?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [tokenTransactions, txFilter]);

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 100) {
        setDisplayLimit(prev => Math.min(prev + 50, filteredAndSortedTokens.length));
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [filteredAndSortedTokens.length]);

  const handleAISearch = (result) => {
    setAiSearchResult(result);
    if (result.tokens && result.tokens.length > 0) {
      setSearchQuery(result.tokens[0].symbol);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0e13]/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to={createPageUrl('portfolio')} className="flex items-center gap-2 text-gray-400 hover:text-white">
            <ChevronLeft className="w-5 h-5" />
            <span>Back to Portfolio</span>
          </Link>
          <div className="flex items-center gap-4">
            {livePriceIndicator && (
              <div className="flex items-center gap-2 text-emerald-400 animate-pulse">
                <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                <span className="text-xs">Live Update</span>
              </div>
            )}
            <Button
              onClick={fetchData}
              size="sm"
              variant="outline"
              className="border-white/20 text-cyan-400 hover:bg-cyan-500/10"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Network Anomaly Alert */}
        <NetworkAnomalyAlert 
          validators={validators}
          supply={supply}
          apiHealthy={apiHealthy}
        />

        {/* Stats Grid - NOW SHOWS ALL TOKENS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-4 border border-purple-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Tokens</p>
                <p className="text-2xl font-bold text-white">{tokenStats.total.toLocaleString()}</p>
              </div>
              <Coins className="w-10 h-10 text-purple-400" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-xl p-4 border border-emerald-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Verified Tokens</p>
                <p className="text-2xl font-bold text-white">{tokenStats.verified.toLocaleString()}</p>
              </div>
              <Check className="w-10 h-10 text-emerald-400" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-xl p-4 border border-yellow-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Discovered Tokens</p>
                <p className="text-2xl font-bold text-white">{tokenStats.unverified.toLocaleString()}</p>
              </div>
              <Sparkles className="w-10 h-10 text-yellow-400" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl p-4 border border-cyan-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Supply</p>
                <p className="text-2xl font-bold text-white">{(supply.total / 1e9).toFixed(2)}B</p>
              </div>
              <TrendingUp className="w-10 h-10 text-cyan-400" />
            </div>
          </div>
        </div>

        {/* Smart Search Bar with AI */}
        <div className="mb-6">
          <SmartSearchBar 
            onSearch={handleAISearch}
            allTokens={allTokens}
          />
        </div>

        {/* Filter and Search Controls */}
        <div className="bg-[#1a2332] rounded-xl p-4 mb-6 border border-white/5">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search tokens by name, symbol, or address..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 bg-[#0f1419] border-white/10 text-white placeholder:text-gray-500"
              />
            </div>
            
            <Button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              variant="outline"
              className="border-white/20 text-gray-300 hover:bg-white/5"
            >
              <Filter className="w-4 h-4 mr-2" />
              {showAdvancedFilters ? 'Hide' : 'Show'} Filters
            </Button>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/5">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Token Type</label>
                <select
                  value={advancedFilters.tokenType}
                  onChange={(e) => setAdvancedFilters(prev => ({ ...prev, tokenType: e.target.value }))}
                  className="w-full bg-[#0f1419] border border-white/10 rounded-md px-3 py-2 text-white text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="SPL Token">SPL Token</option>
                  <option value="Token-2022">Token-2022</option>
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-xs mb-1 block">Verification Status</label>
                <select
                  value={advancedFilters.verificationStatus}
                  onChange={(e) => setAdvancedFilters(prev => ({ ...prev, verificationStatus: e.target.value }))}
                  className="w-full bg-[#0f1419] border border-white/10 rounded-md px-3 py-2 text-white text-sm"
                >
                  <option value="all">All Tokens</option>
                  <option value="verified">Verified Only</option>
                  <option value="unverified">Unverified Only</option>
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-xs mb-1 block">Market Cap Range</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={advancedFilters.marketCapMin}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, marketCapMin: e.target.value }))}
                    className="bg-[#0f1419] border-white/10 text-white text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={advancedFilters.marketCapMax}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, marketCapMax: e.target.value }))}
                    className="bg-[#0f1419] border-white/10 text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-xs mb-1 block">24h Change Range (%)</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={advancedFilters.priceChangeMin}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, priceChangeMin: e.target.value }))}
                    className="bg-[#0f1419] border-white/10 text-white text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={advancedFilters.priceChangeMax}
                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, priceChangeMax: e.target.value }))}
                    className="bg-[#0f1419] border-white/10 text-white text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Search Results */}
        {aiSearchResult && (
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-purple-400 mt-1" />
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-2">AI Search Results</h3>
                <p className="text-gray-300 text-sm mb-3">{aiSearchResult.summary}</p>
                {aiSearchResult.tokens && aiSearchResult.tokens.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {aiSearchResult.tokens.map(token => (
                      <Badge key={token.mint} className="bg-purple-500/20 text-purple-300 border-0">
                        {token.symbol}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setAiSearchResult(null)} className="text-gray-500 hover:text-white">×</button>
            </div>
          </div>
        )}

        {/* Token List */}
        <div className="bg-[#1a2332] rounded-xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 text-xs px-4 py-3 cursor-pointer hover:text-white" onClick={() => setSortBy('rank')}>#</th>
                  <th className="text-left text-gray-400 text-xs px-4 py-3 cursor-pointer hover:text-white" onClick={() => setSortBy('name')}>Token</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3 cursor-pointer hover:text-white" onClick={() => setSortBy('price')}>Price</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3 cursor-pointer hover:text-white" onClick={() => setSortBy('change')}>24h Change</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3 cursor-pointer hover:text-white" onClick={() => setSortBy('marketCap')}>Market Cap</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3 cursor-pointer hover:text-white" onClick={() => setSortBy('supply')}>Supply</th>
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
                              <p className="text-gray-500 text-xs font-mono truncate">{token.mint.substring(0, 12)}...</p>
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
                              <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">{token.tokenType || 'SPL Token'}</Badge>
                              {token.verified ? (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">✓ Verified</Badge>
                              ) : (
                                <Badge className="bg-yellow-500/20 text-yellow-400 border-0 text-xs">⚠ Unverified</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-white font-mono">${token.price}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={parseFloat(token.priceChange24h) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                          {parseFloat(token.priceChange24h) >= 0 ? '+' : ''}{token.priceChange24h}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">${formatNum(token.marketCap)}</td>
                      <td className="px-4 py-3 text-right text-gray-400">{formatNum(token.totalSupply)}</td>
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
                                setLoadingDetails(true);
                                await fetchTokenDetails(token.mint);
                                setLoadingDetails(false);
                              }
                            }}
                            className={`border-white/20 text-cyan-400 hover:bg-cyan-500/10 text-xs ${
                              expandedToken === token.mint ? 'bg-cyan-500/20' : ''
                            }`}
                          >
                           {expandedToken === token.mint ? 'Hide' : 'Details'}
                          </Button>
                          {!token.verified && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setAiAssistantToken(token.mint);
                                setShowAIAssistant(true);
                              }}
                              className="text-purple-400 hover:bg-purple-500/10 text-xs"
                              title="AI Verification Assistant"
                            >
                              <Sparkles className="w-3 h-3" />
                            </Button>
                          )}
                          </div>
                          </td>
                          </tr>
                          
                    {/* Inline Token Details */}
                    {expandedToken === token.mint && (
                      <tr>
                        <td colSpan="7" className="p-0 bg-[#1d2d3a]">
                          <TokenDetailsModal
                            token={modalToken}
                            tokenDetails={tokenDetails}
                            tokenHolders={tokenHolders}
                            loadingDetails={loadingDetails}
                            onClose={() => setExpandedToken(null)}
                            allTokens={allTokens}
                            tokenMetadata={tokenMetadata}
                            copiedAddress={copiedAddress}
                            copyToClipboard={copyToClipboard}
                            formatNum={formatNum}
                            formatTime={formatTime}
                            priceTimeframe={priceTimeframe}
                            setPriceTimeframe={setPriceTimeframe}
                            holderChartData={holderChartData}
                            txFlowData={txFlowData}
                            tokenTransactions={tokenTransactions}
                            filteredTransactions={filteredTransactions}
                            txFilter={txFilter}
                            setTxFilter={setTxFilter}
                            createPageUrl={createPageUrl}
                          />
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

        {/* AI Verification Assistant */}
        {showAIAssistant && (
          <AIVerificationAssistant 
            tokenMint={aiAssistantToken}
            onClose={() => {
              setShowAIAssistant(false);
              setAiAssistantToken(null);
            }}
            onVerified={() => {
              // Re-fetch token data to update verification status
              fetchData();
            }}
          />
        )}

      </main>
    </div>
  );
}
