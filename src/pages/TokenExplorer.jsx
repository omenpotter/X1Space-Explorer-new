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
  // Simplified - in production use @solana/web3.js PublicKey.findProgramAddress
  return mint; // Placeholder
};

// Parse Metaplex metadata from account data
const parseMetaplexMetadata = (accountData) => {
  try {
    // Simplified parser - in production decode properly
    return {
      name: 'Token',
      symbol: 'TKN',
      uri: null
    };
  } catch (e) {
    return null;
  }
};

export default function TokenExplorer() {
  const [loading, setLoading] = useState(true);
  const [supply, setSupply] = useState({ total: 0, circulating: 0 });
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
  const [priceTimeframe, setPriceTimeframe] = useState('7D');
  const [holderChartData, setHolderChartData] = useState([]);
  const [txFlowData, setTxFlowData] = useState([]);
  const [advancedFilters, setAdvancedFilters] = useState({
    tokenType: 'all',
    marketCapMin: '',
    marketCapMax: '',
    priceChangeMin: '',
    priceChangeMax: ''
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const searchDebounceRef = useRef(null);
  const [discoveredTokens, setDiscoveredTokens] = useState([]);
  const [showDiscovered, setShowDiscovered] = useState(false);
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
    
    // Subscribe to real-time token updates via WebSocket (don't interfere with Dashboard services)
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
          price: '0.0000',
          marketCap: 0,
          priceChange24h: '0.00',
          verified: update.data.verified || false,
          priceHistory: []
        };
        
        if (update.data.verified) {
          setAllTokens(prev => [newToken, ...prev]);
        } else {
          setDiscoveredTokens(prev => [newToken, ...prev]);
        }
        setLivePriceIndicator(true);
        setTimeout(() => setLivePriceIndicator(false), 2000);
      }
      
      if (update.type === 'token_verified' || update.type === 'token_updated') {
        setAllTokens(prev => prev.map(token => 
          token.mint === update.data.mint ? {
            ...token,
            ...update.data,
            price: update.data.price ? parseFloat(update.data.price).toFixed(4) : token.price,
            marketCap: update.data.market_cap || token.marketCap,
            priceChange24h: update.data.price_change_24h ? parseFloat(update.data.price_change_24h).toFixed(2) : token.priceChange24h
          } : token
        ));
        setLivePriceIndicator(true);
        setTimeout(() => setLivePriceIndicator(false), 2000);
      }
      
      if (update.type === 'price_update') {
        setAllTokens(prev => prev.map(token => {
          const priceData = update.data[token.mint];
          if (priceData) {
            return {
              ...token,
              price: priceData.price.toFixed(4),
              priceChange24h: priceData.price_change_24h?.toFixed(2) || token.priceChange24h,
              marketCap: priceData.market_cap || token.marketCap
            };
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
    
    // Fetch only tokens with real names (153 tokens)
    const allTokensResponse = await X1Api.listTokens({ limit: 1500, offset: 0, verified: false });

    if (allTokensResponse.success && allTokensResponse.data?.tokens) {
      const tokens = allTokensResponse.data.tokens;
      
      // Show mock data indicator if using mock data
      if (allTokensResponse._mock) {
        console.log('⚠️ Using mock data - backend not connected');
      } else {
        console.log(`✓ Loaded ${tokens.length} tokens from API`);
        console.log(`📊 Total: ${allTokensResponse.data.total}, Verified: ${allTokensResponse.data.verified}, Discovered: ${allTokensResponse.data.discovered}`);

      // Separate verified and unverified tokens
      const verified = [];
      const unverified = [];

      tokens.forEach(token => {
        const tokenData = {
          mint: token.mint || token.address,
          name: token.name || 'Unknown Token',
          symbol: token.symbol || 'UNKNOWN',
          logo: token.logo_uri || token.logo,
          decimals: token.decimals || 9,
          totalSupply: token.total_supply || token.totalSupply || token.supply || 0,
          tokenType: token.token_type || token.tokenType || 'SPL Token',
          price: token.price ? parseFloat(token.price).toFixed(4) : '0.0000',
          marketCap: token.market_cap || token.marketCap || 0,
          priceChange24h: token.price_change_24h || token.priceChange24h ? parseFloat(token.price_change_24h || token.priceChange24h).toFixed(2) : '0.00',
          mintAuthority: token.mint_authority || token.mintAuthority,
          freezeAuthority: token.freeze_authority || token.freezeAuthority,
          website: token.website,
          twitter: token.twitter,
          createdBy: token.created_by || token.createdBy,
          createdAt: token.created_at || token.createdAt,
          verificationCount: token.verification_count || token.verificationCount || 0,
          isScam: token.is_scam || token.isScam || false,
          verified: (token.verification_count || token.verificationCount || 0) > 0,
          verified: token.name !== 'Unknown Token' && token.symbol !== 'UNKNOWN',
          priceHistory: token.price_history || token.priceHistory || []
        };

        if (token.name !== 'Unknown Token' && token.symbol !== 'UNKNOWN') {
       verified.push(tokenData);
       } else {
       unverified.push(tokenData);
      }
      });

      setAllTokens(verified);
      setDiscoveredTokens(unverified);
      
      console.log(`✓ Verified: ${verified.length}, Unverified: ${unverified.length}`);
      
      // Fetch supply from RPC for ALL tokens since API returns 0
      console.log('🔄 Fetching token supplies from RPC (API has 0 values)...');
      
      const fetchSupplyBatch = async (tokens) => {
        return Promise.all(
          tokens.map(async (token) => {
            try {
              const response = await fetch('https://rpc.mainnet.x1.xyz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'getTokenSupply',
                  params: [token.mint]
                })
              });
              
              const data = await response.json();
              if (data?.result?.value?.uiAmount) {
                return { ...token, totalSupply: data.result.value.uiAmount };
              }
            } catch (err) {
              // Silent fail, keep original
            }
            return token;
          })
        );
      };
      
      // Fetch in batches to avoid overwhelming RPC
      const batchSize = 10;
      for (let i = 0; i < Math.min(verified.length, 50); i += batchSize) {
        const batch = verified.slice(i, i + batchSize);
        const updatedBatch = await fetchSupplyBatch(batch);
        
        setAllTokens(prev => {
          const updated = [...prev];
          updatedBatch.forEach((token, idx) => {
            const index = i + idx;
            if (updated[index]) {
              updated[index] = token;
            }
          });
          return updated;
        });
        
        console.log(`✅ Fetched supply for tokens ${i + 1}-${Math.min(i + batchSize, 50)}`);
      }
      
      console.log('✅ Supply fetch complete (first 50 tokens)');
      
      // Fetch real supply and validator stats from RPC
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
      
      setLoading(false);
      return;
    }

    console.log('⚠️ No token data available');
    setAllTokens([]);
    setDiscoveredTokens([]);
  } catch (err) {
    console.error('❌ Fetch error:', err);
    setAllTokens([]);
    setDiscoveredTokens([]);
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
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      switch(sortBy) {
        case 'supply': return direction * (b.totalSupply - a.totalSupply);
        case 'marketCap': return direction * (b.marketCap - a.marketCap);
        case 'price': return direction * (parseFloat(b.price) - parseFloat(a.price));
        case 'change': return direction * (parseFloat(b.priceChange24h) - parseFloat(a.priceChange24h));
  
        case 'name': return direction * a.name.localeCompare(b.name);
        default: return 0;
      }
    });
    
    return sorted;
  }, [allTokens, searchQuery, sortBy, sortDirection, advancedFilters]);
  
  // Debounced search handler
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
    setCreatorProfile(null);
    setLiquidityPools([]);
    
    try {
      // Try fetching from X1 API first
      if (apiHealthy) {
        console.log('🔄 Fetching token details from X1 API...');
        const [apiDetails, apiHolders, apiTxs, apiPools] = await Promise.all([
          X1Api.getTokenDetails(mint),
          X1Api.getTokenHolders(mint, { limit: 50 }),
          X1Api.getTokenTransactions(mint, { limit: 50 }),
          X1Api.getLiquidityPools(mint)
        ]);
        
        if (apiDetails.success) {
          const token = apiDetails.data.token;
          setTokenDetails({
            mint: token.mint,
            decimals: token.decimals || 9,
            supply: token.total_supply || 0,
            mintAuthority: token.mint_authority || 'None',
            freezeAuthority: token.freeze_authority || 'None',
            isInitialized: true,
            supplyType: token.mint_authority ? 'Mintable' : 'Fixed Supply',
            creationDate: token.created_at ? new Date(token.created_at) : null,
            blockTime: token.created_at ? new Date(token.created_at).getTime() / 1000 : null
          });
          
          if (token.metadata) {
            setTokenMetadata({
              name: token.name,
              symbol: token.symbol,
              image: token.logo_uri,
              description: token.description,
              website: token.website,
              twitter: token.twitter
            });
          }
          
          // Get creator profile if available
          if (token.creator_address) {
            const creator = await X1Api.getCreatorProfile(token.creator_address);
            if (creator.success) {
              setCreatorProfile(creator.data.creator);
            }
          }
        }
        
        if (apiHolders.success) {
          const holders = apiHolders.data.holders.map(h => ({
            address: h.owner_address,
            balance: h.balance,
            percentage: h.percentage
          }));
          setTokenHolders(holders);
          
          const top10 = holders.slice(0, 10);
          const others = holders.slice(10).reduce((sum, h) => sum + h.percentage, 0);
          const chartData = [
            ...top10.map((h, i) => ({
              name: `Holder ${i + 1}`,
              value: h.percentage,
              address: h.address
            })),
            ...(others > 0 ? [{ name: 'Others', value: others, address: null }] : [])
          ];
          setHolderChartData(chartData);
        }
        
        if (apiTxs.success) {
          const txs = apiTxs.data.transactions.map(tx => ({
            signature: tx.signature,
            blockTime: new Date(tx.timestamp).getTime() / 1000,
            type: tx.type || 'transfer',
            amount: tx.amount || 0,
            from: tx.from_address,
            to: tx.to_address,
            status: tx.status === 'success' ? 'success' : 'failed'
          }));
          setTokenTransactions(txs);
          
          const flowData = txs.reduce((acc, tx) => {
            const hour = Math.floor(tx.blockTime / 3600) * 3600;
            const existing = acc.find(d => d.timestamp === hour);
            if (existing) {
              existing.count += 1;
              existing.volume += tx.amount;
            } else {
              acc.push({ timestamp: hour * 1000, count: 1, volume: tx.amount });
            }
            return acc;
          }, []).sort((a, b) => a.timestamp - b.timestamp);
          setTxFlowData(flowData);
        }
        
        if (apiPools.success && apiPools.data.pools.length > 0) {
          setLiquidityPools(apiPools.data.pools);
          console.log(`✓ Found ${apiPools.data.pools.length} liquidity pools`);
        }
        
        setLoadingDetails(false);
        return;
      }
      
      // Fallback to RPC if API unavailable
      console.log('⚠️ X1 API unavailable, using RPC fallback...');
      const X1Rpc = (await import('../components/x1/X1RpcService')).default;
      
      // Fetch token account info first
      const accountInfo = await X1Rpc.getAccountInfo(mint);
      let creationDate = null;
      let blockTime = null;
      
      if (accountInfo?.value) {
        const parsed = accountInfo.value.data?.parsed?.info;
        
        // Try to get creation date from first signature
        try {
          const signatures = await X1Rpc.getSignaturesForAddress(mint, { limit: 1000 });
          if (signatures.length > 0) {
            const firstSig = signatures[signatures.length - 1];
            if (firstSig.blockTime) {
              creationDate = new Date(firstSig.blockTime * 1000);
              blockTime = firstSig.blockTime;
            }
          }
        } catch (e) {}
        
        setTokenDetails({
          mint,
          decimals: parsed?.decimals || 9,
          supply: Number(parsed?.supply || 0) / Math.pow(10, parsed?.decimals || 9),
          mintAuthority: parsed?.mintAuthority || 'None',
          freezeAuthority: parsed?.freezeAuthority || 'None',
          isInitialized: parsed?.isInitialized || false,
          supplyType: parsed?.mintAuthority ? 'Mintable' : 'Fixed Supply',
          creationDate,
          blockTime
        });
      }
      
      // Fetch metadata with enhanced info
      const tokenData = allTokens.find(t => t.mint === mint);
      if (tokenData?.website || tokenData?.twitter) {
        setTokenMetadata({
          name: tokenData.name,
          symbol: tokenData.symbol,
          image: tokenData.logo,
          description: null,
          website: tokenData.website,
          twitter: tokenData.twitter
        });
      }
      
      // Fetch token holders using multiple RPC endpoints
      const rpcEndpoints = [
        'https://nexus.fortiblox.com/rpc',
        'https://rpc.mainnet.x1.xyz',
        'https://rpc.x1galaxy.io/'
      ];
      
      let holdersData = null;
      for (const endpoint of rpcEndpoints) {
        try {
          const headers = {
            'Content-Type': 'application/json',
            ...(endpoint.includes('fortiblox') ? {
              'X-API-Key': 'pb_live_7d62cd095391ffd14daca14f2f739b06cac5fd182ca48aed9e2b106ba920c6b0'
            } : {})
          };
          
          const holdersRes = await fetch(endpoint, {
            method: 'POST',
            headers,
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
            }),
            signal: AbortSignal.timeout(10000)
          });
          
          const data = await holdersRes.json();
          if (data?.result && data.result.length > 0) {
            holdersData = data;
            console.log(`✓ Found ${data.result.length} holders for ${mint.substring(0, 8)}`);
            break;
          }
        } catch (e) {
          console.warn(`Holder fetch failed for ${endpoint}:`, e.message);
          continue;
        }
      }
      
      if (holdersData?.result && holdersData.result.length > 0) {
        const holders = holdersData.result
          .map(acc => {
            const info = acc.account?.data?.parsed?.info;
            const balance = Number(info?.tokenAmount?.amount || 0) / Math.pow(10, info?.tokenAmount?.decimals || 9);
            return {
              address: info?.owner || '',
              balance,
              percentage: 0
            };
          })
          .filter(h => h.balance > 0)
          .sort((a, b) => b.balance - a.balance)
          .slice(0, 50);
        
        const totalHeld = holders.reduce((sum, h) => sum + h.balance, 0);
        holders.forEach(h => {
          h.percentage = totalHeld > 0 ? (h.balance / totalHeld) * 100 : 0;
        });
        
        setTokenHolders(holders);
        
        // Generate holder distribution chart data (top 10 + others)
        const top10 = holders.slice(0, 10);
        const others = holders.slice(10).reduce((sum, h) => sum + h.percentage, 0);
        const chartData = [
          ...top10.map((h, i) => ({
            name: `Holder ${i + 1}`,
            value: h.percentage,
            address: h.address
          })),
          ...(others > 0 ? [{ name: 'Others', value: others, address: null }] : [])
        ];
        setHolderChartData(chartData);
        console.log(`✓ Processed ${holders.length} holders with distribution`);
      } else {
        console.warn('No holders found for this token');
        setTokenHolders([]);
        setHolderChartData([]);
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
      
      // Generate transaction flow data (hourly aggregation)
      const flowData = txDetails.reduce((acc, tx) => {
        const hour = Math.floor(tx.blockTime / 3600) * 3600;
        const existing = acc.find(d => d.timestamp === hour);
        if (existing) {
          existing.count += 1;
          existing.volume += tx.amount;
        } else {
          acc.push({ timestamp: hour * 1000, count: 1, volume: tx.amount });
        }
        return acc;
      }, []).sort((a, b) => a.timestamp - b.timestamp);
      setTxFlowData(flowData);
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
        {/* Network Anomaly Alert - Temporarily disabled */}
{/* <NetworkAnomalyAlert /> */}   

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Coins className="w-7 h-7 text-cyan-400" />
            Token Explorer
            {livePriceIndicator && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs animate-pulse">
                Live Prices Updated
              </Badge>
            )}
            {apiHealthy && (
              <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs ml-2">
                X1 API Connected
              </Badge>
            )}
          </h1>
          <div className="flex gap-2">
            <Button
              variant={!showDiscovered ? "default" : "outline"}
              size="sm"
              onClick={() => setShowDiscovered(false)}
              className={!showDiscovered ? "bg-cyan-500" : "border-white/20"}
            >
              Verified ({allTokens.length})
            </Button>
            <Button
              variant={showDiscovered ? "default" : "outline"}
              size="sm"
              onClick={() => setShowDiscovered(true)}
              className={showDiscovered ? "bg-cyan-500" : "border-white/20"}
            >
              Discovered ({discoveredTokens.length})
            </Button>
          </div>
        </div>

        {/* Top Stats - Synced with Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-[#24384a] rounded-lg p-4">
            <p className="text-gray-400 text-xs">Total Tokens</p>
            <p className="text-2xl font-bold text-cyan-400">{allTokens.length + discoveredTokens.length}</p>
          </div>
          <div className="bg-[#24384a] rounded-lg p-4">
            <p className="text-gray-400 text-xs">XNT Supply</p>
            <p className="text-2xl font-bold text-white">
              {supply.total ? formatNum(supply.total / 1e9) : '1,022.92'} B
            </p>
          </div>
          <div className="bg-[#24384a] rounded-lg p-4">
            <p className="text-gray-400 text-xs">Circulating</p>
            <p className="text-2xl font-bold text-emerald-400">
              {supply.circulating ? formatNum(supply.circulating / 1e9) : '1,022.92'} B
            </p>
          </div>
          <div className="bg-[#24384a] rounded-lg p-4">
            <p className="text-gray-400 text-xs">Total Staked</p>
            <p className="text-2xl font-bold text-purple-400">
              {validators.totalStake ? formatNum(validators.totalStake / 1e9) : '0'} B
            </p>
          </div>
          <div className="bg-[#24384a] rounded-lg p-4">
            <p className="text-gray-400 text-xs">Active Validators</p>
            <p className="text-2xl font-bold text-cyan-400">{validators.activeCount || 0}</p>
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
                <p className="text-white font-bold">${formatNum(supply.circulating / 1e9)}</p>
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
        {/* Search and Filters */}
        <div className="bg-[#24384a] rounded-xl p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center mb-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search tokens by name, symbol, or mint address..."
                onChange={(e) => handleSearchChange(e.target.value)}
                className="bg-[#1d2d3a] border-0 text-white pl-10"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[#1d2d3a] border-0 text-white rounded-lg px-3 py-2"
            >
              <option value="marketCap">Market Cap</option>
              <option value="price">Price</option>
              <option value="change">24h Change</option>

              <option value="supply">Supply</option>
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
          
          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-white/10">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Token Type</label>
                <select
                  value={advancedFilters.tokenType}
                  onChange={(e) => setAdvancedFilters({...advancedFilters, tokenType: e.target.value})}
                  className="w-full bg-[#1d2d3a] border-0 text-white rounded-lg px-3 py-2 text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="SPL Token">SPL Token</option>
                  <option value="Token-2022">Token-2022</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Market Cap Range</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={advancedFilters.marketCapMin}
                    onChange={(e) => setAdvancedFilters({...advancedFilters, marketCapMin: e.target.value})}
                    className="bg-[#1d2d3a] border-0 text-white text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={advancedFilters.marketCapMax}
                    onChange={(e) => setAdvancedFilters({...advancedFilters, marketCapMax: e.target.value})}
                    className="bg-[#1d2d3a] border-0 text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">24h Change % Range</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min %"
                    value={advancedFilters.priceChangeMin}
                    onChange={(e) => setAdvancedFilters({...advancedFilters, priceChangeMin: e.target.value})}
                    className="bg-[#1d2d3a] border-0 text-white text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="Max %"
                    value={advancedFilters.priceChangeMax}
                    onChange={(e) => setAdvancedFilters({...advancedFilters, priceChangeMax: e.target.value})}
                    className="bg-[#1d2d3a] border-0 text-white text-sm"
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAdvancedFilters({ tokenType: 'all', marketCapMin: '', marketCapMax: '', priceChangeMin: '', priceChangeMax: '' })}
                className="text-gray-400 hover:text-white"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>

        {/* Top Tokens */}
        <div className="bg-[#24384a] rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-white font-medium">
              {showDiscovered ? 'Discovered Tokens (Unverified)' : 'Verified Tokens'} ({showDiscovered ? discoveredTokens.length : filteredAndSortedTokens.length})
            </h3>
            {showDiscovered && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-0 text-xs">
                ⚠️ Unverified - DYOR
              </Badge>
            )}
          </div>
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
                {(showDiscovered ? discoveredTokens : filteredAndSortedTokens).slice(0, displayLimit).map((token, i) => (
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
                              {showDiscovered && (
                                <Badge className="bg-yellow-500/20 text-yellow-400 border-0 text-xs">Unverified</Badge>
                              )}
                              {token.verified && (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">✓ Verified</Badge>
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
                          
                    {/* Inline Token Details - Opens below this row */}
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
          />
        )}



      </main>
    </div>
  );
}
