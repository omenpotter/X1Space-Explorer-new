import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Coins, Search, Loader2, TrendingUp, TrendingDown, Star, ChevronLeft, RefreshCw, Copy, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';

export default function TokenExplorer() {
  const [loading, setLoading] = useState(true);
  const [supply, setSupply] = useState({ total: 1000000000, circulating: 850000000 });
  const [validators, setValidators] = useState({ totalStake: 0, activeCount: 0 });
  const [allTokens, setAllTokens] = useState([]);
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
      // Import X1Rpc for consistent supply data
      const X1Rpc = (await import('../components/x1/X1RpcService')).default;
      
      // Fetch supply using X1Rpc (same as dashboard)
      const supplyData = await X1Rpc.getSupply();
      
      if (supplyData?.value) {
        const val = supplyData.value;
        setSupply({
          total: Number(val.total) / 1e9,
          circulating: Number(val.circulating) / 1e9
        });
      }

      // Fetch validators for stake (use X1Rpc for consistency)
      const voteData = await X1Rpc.getVoteAccounts();
      if (voteData) {
        const totalStake = (voteData.current.reduce((sum, v) => sum + v.activatedStake, 0) + 
                           voteData.delinquent.reduce((sum, v) => sum + v.activatedStake, 0)) / 1e9;
        setValidators({ 
          totalStake,
          activeCount: voteData.current.length,
          delinquentCount: voteData.delinquent.length
        });
      }

      // Fetch tokens with better pagination and filtering
      console.log('Fetching tokens from X1 blockchain...');
      
      const mints = new Map();
      
      // Try primary, then fallback endpoints for SPL tokens
      const tryFetch = async (url) => {
        const headers = {
          'Content-Type': 'application/json',
          ...(url.includes('fortiblox') ? {
            'X-API-Key': 'pb_live_7d62cd095391ffd14daca14f2f739b06cac5fd182ca48aed9e2b106ba920c6b0',
            'Authorization': 'Bearer fbx_d4a25e545366fed1ea1582884e62874d6b9fdf94d1f6c4b9889fefa951300dff'
          } : {})
        };
        
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getProgramAccounts',
            params: [
              'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
              { encoding: 'jsonParsed', filters: [{ dataSize: 82 }] }
            ]
          })
        });
        return response;
      };

      let splTokensRes;
      try {
        splTokensRes = await tryFetch('https://rpc.mainnet.x1.xyz');
      } catch {
        try {
          splTokensRes = await tryFetch('https://nexus.fortiblox.com/rpc');
        } catch {
          splTokensRes = await tryFetch('https://rpc.x1galaxy.io/');
        }
      }
      
      const splTokensData = await splTokensRes.json();
      console.log('SPL Tokens fetched:', splTokensData?.result?.length || 0);
      
      // Process SPL tokens
      if (splTokensData?.result) {
        splTokensData.result.forEach(acc => {
          try {
            const info = acc.account?.data?.parsed?.info;
            if (info) {
              const mint = acc.pubkey;
              const decimals = info.decimals || 9;
              const supply = Number(info.supply || 0) / Math.pow(10, decimals);

              if (supply > 0 || info.mintAuthority) {
                mints.set(mint, {
                  mint,
                  name: `Token ${mint.substring(0, 8)}`,
                  symbol: mint.substring(0, 6).toUpperCase(),
                  decimals,
                  totalSupply: supply,
                  tokenType: 'SPL Token',
                  price: 0,
                  marketCap: 0,
                  priceChange24h: 0,
                  volume24h: 0,
                  mintAuthority: info.mintAuthority || null,
                  freezeAuthority: info.freezeAuthority || null,
                  priceHistory: []
                });
              }
            }
          } catch (e) {
            console.error('Error processing token:', e);
          }
        });
      }
      
      // Try to fetch Token-2022 tokens
      try {
        const token2022Res = await fetch('https://nexus.fortiblox.com/rpc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'pb_live_7d62cd095391ffd14daca14f2f739b06cac5fd182ca48aed9e2b106ba920c6b0',
            'Authorization': 'Bearer fbx_d4a25e545366fed1ea1582884e62874d6b9fdf94d1f6c4b9889fefa951300dff'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'getProgramAccounts',
            params: [
              'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
              {
                encoding: 'jsonParsed',
                filters: [
                  { dataSize: 82 }
                ]
              }
            ]
          })
        });
        
        const token2022Data = await token2022Res.json();
        console.log('Token-2022 fetched:', token2022Data?.result?.length || 0);
        
        if (token2022Data?.result) {
          token2022Data.result.forEach(acc => {
            try {
              const info = acc.account?.data?.parsed?.info;
              if (info) {
                const mint = acc.pubkey;
                const decimals = info.decimals || 9;
                const supply = Number(info.supply || 0) / Math.pow(10, decimals);

                if ((supply > 0 || info.mintAuthority) && !mints.has(mint)) {
                  mints.set(mint, {
                    mint,
                    name: `Token2022 ${mint.substring(0, 8)}`,
                    symbol: mint.substring(0, 6).toUpperCase(),
                    decimals,
                    totalSupply: supply,
                    tokenType: 'Token-2022',
                    price: 0,
                    marketCap: 0,
                    priceChange24h: 0,
                    volume24h: 0,
                    mintAuthority: info.mintAuthority || null,
                    freezeAuthority: info.freezeAuthority || null,
                    priceHistory: []
                  });
                }
              }
            } catch (e) {
              console.error('Error processing token2022:', e);
            }
          });
        }
      } catch (e) {
        console.warn('Token-2022 fetch failed:', e);
      }
      
      console.log('Total unique tokens found:', mints.size);
      let tokenList = Array.from(mints.values());
      
      // Simulate market data for display
      tokenList = tokenList.map(token => ({
        ...token,
        price: token.totalSupply > 0 ? (Math.random() * 10).toFixed(4) : 0,
        marketCap: token.totalSupply * (Math.random() * 10),
        priceChange24h: (Math.random() * 40 - 20).toFixed(2),
        volume24h: Math.random() * 1000000,
        priceHistory: Array.from({ length: 30 }, (_, i) => ({
          day: i,
          price: Math.random() * 10
        }))
      }));
      
      setAllTokens(tokenList);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const filteredAndSortedTokens = useMemo(() => {
    let filtered = allTokens.filter(token => 
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.mint.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    const sorted = [...filtered].sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      switch(sortBy) {
        case 'supply': return direction * (b.totalSupply - a.totalSupply);
        case 'marketCap': return direction * (b.marketCap - a.marketCap);
        case 'price': return direction * (parseFloat(b.price) - parseFloat(a.price));
        case 'change': return direction * (parseFloat(b.priceChange24h) - parseFloat(a.priceChange24h));
        default: return 0;
      }
    });
    
    return sorted;
  }, [allTokens, searchQuery, sortBy, sortDirection]);
  
  const copyToClipboard = useCallback((address) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  }, []);
  
  // Infinite scroll handler
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
    setTokenTransactions([]);
    setTokenHolders([]);
    setTokenMetadata(null);
    
    try {
      // Import X1Rpc
      const X1Rpc = (await import('../components/x1/X1RpcService')).default;
      
      // Fetch token metadata from common standards (Metaplex)
      try {
        const metadataRes = await fetch('https://nexus.fortiblox.com/rpc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'pb_live_7d62cd095391ffd14daca14f2f739b06cac5fd182ca48aed9e2b106ba920c6b0'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getAccountInfo',
            params: [mint, { encoding: 'jsonParsed' }]
          })
        });
        const metadataData = await metadataRes.json();
        if (metadataData?.result?.value?.data?.parsed?.info?.uri) {
          const uri = metadataData.result.value.data.parsed.info.uri;
          const metaRes = await fetch(uri);
          const meta = await metaRes.json();
          setTokenMetadata({
            name: meta.name || null,
            symbol: meta.symbol || null,
            image: meta.image || null,
            description: meta.description || null,
            website: meta.external_url || null,
            twitter: meta.twitter || null
          });
        }
      } catch (e) {
        // Metadata not available
      }
      
      // Fetch token account info
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
      
      // Fetch token holders
      const holdersRes = await fetch('https://nexus.fortiblox.com/rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'pb_live_7d62cd095391ffd14daca14f2f739b06cac5fd182ca48aed9e2b106ba920c6b0'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getProgramAccounts',
          params: [
            'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            {
              encoding: 'jsonParsed',
              filters: [
                { dataSize: 165 },
                { memcmp: { offset: 0, bytes: mint } }
              ]
            }
          ]
        })
      });
      const holdersData = await holdersRes.json();
      
      if (holdersData?.result) {
        const holders = holdersData.result
          .map(acc => {
            const info = acc.account?.data?.parsed?.info;
            return {
              address: info?.owner || '',
              balance: Number(info?.tokenAmount?.amount || 0) / Math.pow(10, info?.tokenAmount?.decimals || 9),
              percentage: 0
            };
          })
          .filter(h => h.balance > 0)
          .sort((a, b) => b.balance - a.balance)
          .slice(0, 20);
        
        const totalSupply = holders.reduce((sum, h) => sum + h.balance, 0);
        holders.forEach(h => {
          h.percentage = (h.balance / totalSupply) * 100;
        });
        
        setTokenHolders(holders);
      }

      // Fetch token transactions
      const signatures = await X1Rpc.getSignaturesForAddress(mint, { limit: 50 });
      const txDetails = [];
      
      for (const sig of signatures.slice(0, 50)) {
        try {
          const tx = await X1Rpc.getTransaction(sig.signature);
          if (tx) {
            const message = tx.transaction?.message;
            const meta = tx.meta;
            const accountKeys = message?.accountKeys || [];
            
            // Determine transaction type and details
            let type = 'transfer';
            let amount = 0;
            let from = accountKeys[0] || '';
            let to = accountKeys[1] || '';
            
            // Parse pre/post token balances for amount
            const preTokenBalances = meta?.preTokenBalances || [];
            const postTokenBalances = meta?.postTokenBalances || [];
            
            if (preTokenBalances.length > 0 && postTokenBalances.length > 0) {
              const preAmount = preTokenBalances[0]?.uiTokenAmount?.uiAmount || 0;
              const postAmount = postTokenBalances[0]?.uiTokenAmount?.uiAmount || 0;
              amount = Math.abs(postAmount - preAmount);
            }
            
            txDetails.push({
              signature: sig.signature,
              blockTime: sig.blockTime,
              type,
              amount,
              from,
              to,
              status: meta?.err ? 'failed' : 'success'
            });
          }
        } catch (e) {
          // Skip failed tx fetches
        }
      }
      
      setTokenTransactions(txDetails);
    } catch (err) {
      console.error('Failed to fetch token details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };
  
  const filteredTransactions = useMemo(() => {
    let filtered = tokenTransactions;
    
    // Filter by type
    if (txFilter.type !== 'all') {
      filtered = filtered.filter(tx => tx.type === txFilter.type);
    }
    
    // Filter by signature search
    if (txFilter.searchSig) {
      filtered = filtered.filter(tx => 
        tx.signature.toLowerCase().includes(txFilter.searchSig.toLowerCase())
      );
    }
    
    // Filter by date range
    if (txFilter.dateRange !== 'all') {
      const now = Date.now() / 1000;
      const ranges = {
        '1h': 3600,
        '24h': 86400,
        '7d': 604800,
        '30d': 2592000
      };
      const cutoff = now - (ranges[txFilter.dateRange] || 0);
      filtered = filtered.filter(tx => tx.blockTime >= cutoff);
    }
    
    return filtered;
  }, [tokenTransactions, txFilter]);

  const formatNum = (num) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Recently';
    const diff = (Date.now() / 1000 - timestamp);
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const handleTransfer = async () => {
    if (!transferTo || !transferAmount || !selectedToken) return;
    alert(`Transfer functionality requires wallet integration. Would transfer ${transferAmount} tokens to ${transferTo}`);
  };

  const handleApprove = async () => {
    if (!approveSpender || !approveAmount || !selectedToken) return;
    alert(`Approve functionality requires wallet integration. Would approve ${approveAmount} tokens for spender ${approveSpender}`);
  };

  const xntHistory = Array.from({ length: 30 }, (_, i) => ({ day: i, price: 1.00 }));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
      </div>
    );
  }

  const topTokens = allTokens.slice(0, 10);
  const totalMarketCap = supply.circulating * 1.0;

  return (
    <div className="min-h-screen bg-[#1d2d3a] text-white">
      <header className="bg-[#1d2d3a] border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2 hover:opacity-80">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
                <span className="font-bold"><span className="text-cyan-400">X1</span>Space</span>
              </Link>
            </div>
            <Button onClick={fetchData} variant="outline" size="sm" className="border-white/20 text-cyan-400">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Coins className="w-7 h-7 text-cyan-400" />
          Token Explorer
        </h1>

        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-[#24384a] rounded-lg p-4">
            <p className="text-gray-400 text-xs">Total Tokens</p>
            <p className="text-2xl font-bold text-cyan-400">{allTokens.length}</p>
          </div>
          <div className="bg-[#24384a] rounded-lg p-4">
            <p className="text-gray-400 text-xs">XNT Supply</p>
            <p className="text-2xl font-bold text-white">{formatNum(supply.total)} XNT</p>
          </div>
          <div className="bg-[#24384a] rounded-lg p-4">
            <p className="text-gray-400 text-xs">Circulating</p>
            <p className="text-2xl font-bold text-emerald-400">{formatNum(supply.circulating)} XNT</p>
          </div>
          <div className="bg-[#24384a] rounded-lg p-4">
            <p className="text-gray-400 text-xs">Total Staked</p>
            <p className="text-2xl font-bold text-purple-400">{formatNum(validators.totalStake)} XNT</p>
          </div>
          <div className="bg-[#24384a] rounded-lg p-4">
            <p className="text-gray-400 text-xs">Active Validators</p>
            <p className="text-2xl font-bold text-cyan-400">{validators.activeCount}</p>
          </div>
        </div>

        {/* XNT Featured */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                <span className="text-black font-black text-lg">X1</span>
              </div>
              <div>
                <h2 className="text-xl font-bold">X1 Native Token (XNT)</h2>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-0 mt-1">$1.00 OTC</Badge>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-gray-400 text-xs">Market Cap</p>
                <p className="text-white font-bold">${formatNum(supply.circulating * 1.0)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">24h Change</p>
                <p className="text-gray-400 font-bold">0.00%</p>
              </div>
              <div className="h-16 w-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={xntHistory}>
                    <Line type="monotone" dataKey="price" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
        
        {/* Search and Sort */}
        <div className="bg-[#24384a] rounded-xl p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Search tokens by name, symbol, or mint address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#1d2d3a] border-0 text-white flex-1 min-w-[200px]"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#1d2d3a] border-0 text-white rounded-lg px-3 py-2"
            >
              <option value="supply">Sort by Supply</option>
              <option value="marketCap">Sort by Market Cap</option>
              <option value="price">Sort by Price</option>
              <option value="change">Sort by 24h Change</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
              className="border-white/20"
            >
              {sortDirection === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
        </div>

        {/* Top Tokens */}
        <div className="bg-[#24384a] rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="text-white font-medium">Tokens ({filteredAndSortedTokens.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 text-xs px-4 py-3">#</th>
                  <th className="text-left text-gray-400 text-xs px-4 py-3">Token</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3">Price</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3">24h Change</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3">Market Cap</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3">Supply</th>
                  <th className="text-center text-gray-400 text-xs px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedTokens.slice(0, displayLimit).map((token, i) => (
                  <tr key={token.mint} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs">
                          {token.symbol.substring(0, 2)}
                        </div>
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
                            <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">{token.tokenType}</Badge>
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
                          onClick={() => fetchTokenDetails(token.mint)}
                          className="border-white/20 text-cyan-400 hover:bg-cyan-500/10 text-xs"
                        >
                         Details
                        </Button>
                        </div>
                        </td>
                        </tr>
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

        {/* Token Details Modal */}
        {selectedToken && (
          <div className="bg-[#24384a] rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium text-lg">Token Details</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedToken(null)} className="text-gray-400">Close</Button>
            </div>
            
            {loadingDetails ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              </div>
            ) : tokenDetails ? (
              <>
                {/* Token Metadata */}
                {tokenMetadata && (
                  <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-4">
                      {tokenMetadata.image && (
                        <img src={tokenMetadata.image} alt={tokenMetadata.name} className="w-16 h-16 rounded-full" />
                      )}
                      <div className="flex-1">
                        <h4 className="text-white font-bold text-lg">{tokenMetadata.name || 'Unknown Token'}</h4>
                        <p className="text-gray-400 text-sm">{tokenMetadata.description || 'No description available'}</p>
                        <div className="flex gap-3 mt-2">
                          {tokenMetadata.website && (
                            <a href={tokenMetadata.website} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-xs hover:underline">
                              🌐 Website
                            </a>
                          )}
                          {tokenMetadata.twitter && (
                            <a href={tokenMetadata.twitter} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-xs hover:underline">
                              🐦 Twitter
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Mint Address</p>
                    <p className="text-cyan-400 font-mono text-xs break-all">{tokenDetails.mint}</p>
                  </div>
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Total Supply</p>
                    <p className="text-white font-bold">{formatNum(tokenDetails.supply)}</p>
                  </div>
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Decimals</p>
                    <p className="text-white font-bold">{tokenDetails.decimals}</p>
                  </div>
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Mint Authority</p>
                    <p className="text-white font-mono text-xs break-all">{tokenDetails.mintAuthority}</p>
                  </div>
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Freeze Authority</p>
                    <p className="text-white font-mono text-xs break-all">{tokenDetails.freezeAuthority}</p>
                  </div>
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Supply Type</p>
                    <Badge className="bg-purple-500/20 text-purple-400 border-0">{tokenDetails.supplyType}</Badge>
                  </div>
                </div>

                {/* Token Interactions */}
                <div className="bg-[#1d2d3a] rounded-lg p-4 mb-6">
                  <h4 className="text-white font-medium mb-3">Token Actions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Transfer To</label>
                      <Input
                        placeholder="Recipient address..."
                        value={transferTo}
                        onChange={(e) => setTransferTo(e.target.value)}
                        className="bg-[#24384a] border-0 text-white font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Amount</label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="0.0"
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                          className="bg-[#24384a] border-0 text-white font-mono"
                        />
                        <Button onClick={handleTransfer} className="bg-cyan-500 hover:bg-cyan-600">
                          Transfer
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Approve Spender</label>
                      <Input
                        placeholder="Spender address..."
                        value={approveSpender}
                        onChange={(e) => setApproveSpender(e.target.value)}
                        className="bg-[#24384a] border-0 text-white font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Allowance</label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="0.0"
                          value={approveAmount}
                          onChange={(e) => setApproveAmount(e.target.value)}
                          className="bg-[#24384a] border-0 text-white font-mono"
                        />
                        <Button onClick={handleApprove} className="bg-purple-500 hover:bg-purple-600">
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">⚠️ Wallet connection required for token interactions</p>
                </div>

                {/* Contract ABI */}
                <div className="bg-[#1d2d3a] rounded-lg p-4 mb-6">
                  <h4 className="text-white font-medium mb-2">Contract Interface (SPL Token Standard)</h4>
                  <div className="bg-[#0a0f1a] rounded p-3 overflow-x-auto">
                    <pre className="text-xs text-gray-400 font-mono">
{`interface SPLToken {
  function transfer(address recipient, uint256 amount) public;
  function approve(address spender, uint256 amount) public;
  function transferFrom(address sender, address recipient, uint256 amount) public;
  function balanceOf(address account) public view returns (uint256);
  function allowance(address owner, address spender) public view returns (uint256);
}`}
                    </pre>
                  </div>
                </div>

                {/* Token Holders */}
                <h4 className="text-white font-medium mb-3">Top Token Holders ({tokenHolders.length})</h4>
                {tokenHolders.length > 0 ? (
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left text-gray-400 text-xs px-2 py-2">#</th>
                          <th className="text-left text-gray-400 text-xs px-2 py-2">Address</th>
                          <th className="text-right text-gray-400 text-xs px-2 py-2">Balance</th>
                          <th className="text-right text-gray-400 text-xs px-2 py-2">Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tokenHolders.map((holder, i) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <td className="px-2 py-2 text-gray-400">{i + 1}</td>
                            <td className="px-2 py-2">
                              <Link to={createPageUrl('AddressLookup') + `?address=${holder.address}`} className="text-cyan-400 hover:underline font-mono text-xs">
                                {holder.address.substring(0, 12)}...{holder.address.slice(-4)}
                              </Link>
                            </td>
                            <td className="px-2 py-2 text-right text-white font-mono text-sm">{holder.balance.toFixed(4)}</td>
                            <td className="px-2 py-2 text-right">
                              <Badge className="bg-purple-500/20 text-purple-400 border-0">{holder.percentage.toFixed(2)}%</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4 mb-6">No holders found</p>
                )}

                <h4 className="text-white font-medium mb-3">Recent Transactions ({tokenTransactions.length})</h4>
                
                {/* Transaction Filters */}
                <div className="bg-[#24384a] rounded-lg p-3 mb-4 flex flex-wrap gap-3">
                  <Input
                    placeholder="Search by signature..."
                    value={txFilter.searchSig}
                    onChange={(e) => setTxFilter({...txFilter, searchSig: e.target.value})}
                    className="bg-[#1d2d3a] border-0 text-white text-sm flex-1 min-w-[150px]"
                  />
                  <select
                    value={txFilter.type}
                    onChange={(e) => setTxFilter({...txFilter, type: e.target.value})}
                    className="bg-[#1d2d3a] border-0 text-white rounded-lg px-3 py-1 text-sm"
                  >
                    <option value="all">All Types</option>
                    <option value="transfer">Transfer</option>
                    <option value="approve">Approve</option>
                    <option value="mint">Mint</option>
                    <option value="burn">Burn</option>
                  </select>
                  <select
                    value={txFilter.dateRange}
                    onChange={(e) => setTxFilter({...txFilter, dateRange: e.target.value})}
                    className="bg-[#1d2d3a] border-0 text-white rounded-lg px-3 py-1 text-sm"
                  >
                    <option value="all">All Time</option>
                    <option value="1h">Last Hour</option>
                    <option value="24h">Last 24h</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left text-gray-400 text-xs px-2 py-2">Signature</th>
                        <th className="text-left text-gray-400 text-xs px-2 py-2">Type</th>
                        <th className="text-right text-gray-400 text-xs px-2 py-2">Amount</th>
                        <th className="text-left text-gray-400 text-xs px-2 py-2">From</th>
                        <th className="text-left text-gray-400 text-xs px-2 py-2">To</th>
                        <th className="text-right text-gray-400 text-xs px-2 py-2">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((tx, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="px-2 py-2">
                            <Link to={createPageUrl('TransactionDetail') + `?sig=${tx.signature}`} className="text-cyan-400 hover:underline font-mono text-xs">
                              {tx.signature.substring(0, 8)}...
                            </Link>
                          </td>
                          <td className="px-2 py-2">
                            <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">{tx.type}</Badge>
                          </td>
                          <td className="px-2 py-2 text-right text-white font-mono text-xs">{tx.amount.toFixed(4)}</td>
                          <td className="px-2 py-2">
                            <Link to={createPageUrl('AddressLookup') + `?address=${tx.from}`} className="text-cyan-400 hover:underline font-mono text-xs">
                              {tx.from.substring(0, 8)}...
                            </Link>
                          </td>
                          <td className="px-2 py-2">
                            <Link to={createPageUrl('AddressLookup') + `?address=${tx.to}`} className="text-emerald-400 hover:underline font-mono text-xs">
                              {tx.to.substring(0, 8)}...
                            </Link>
                          </td>
                          <td className="px-2 py-2 text-right text-gray-400 text-xs">{formatTime(tx.blockTime)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-gray-400 text-center py-8">No details available</p>
            )}
          </div>
        )}


      </main>
    </div>
  );
}