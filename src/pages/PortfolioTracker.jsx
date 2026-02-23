import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, Loader2, Wallet, RefreshCw,
  Trash2, Eye, EyeOff, Search, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Api from '../components/x1/X1ApiClient';

export default function PortfolioTracker() {
  const [wallets, setWallets] = useState([]);
  const [newWallet, setNewWallet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [portfolioData, setPortfolioData] = useState(null);
  const [hideBalances, setHideBalances] = useState(false);
  const [allTokens, setAllTokens] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('value'); // value, balance, symbol, price
  const [sortDirection, setSortDirection] = useState('desc');
  const [loadingTokens, setLoadingTokens] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('x1_portfolio_wallets');
    if (saved) setWallets(JSON.parse(saved));
  }, []);

  // Load ALL tokens using SAME API as Token Explorer
  useEffect(() => {
    const loadAllTokens = async () => {
      try {
        setLoadingTokens(true);
        console.log('📡 Loading tokens from API (same as Token Explorer)...');
        
        // Use EXACT same call as TokenExplorer.jsx line 61
        const allTokensResponse = await X1Api.listTokens({ limit: 500, offset: 0, verified: false });

        console.log('📊 API Response:', allTokensResponse);

        if (allTokensResponse.success && allTokensResponse.data?.tokens) {
          const tokens = allTokensResponse.data.tokens;
          
          console.log(`✅ Loaded ${tokens.length} tokens from API`);
          
          // Map using EXACT same structure as TokenExplorer.jsx line 70-87
          const tokenData = tokens.map(token => ({
            mint: token.mint,
            name: token.name || 'Unknown Token',
            symbol: token.symbol || 'UNKNOWN',
            logo: token.logo_uri,
            decimals: token.decimals || 9,
            totalSupply: token.total_supply || 0,
            tokenType: token.token_type || 'SPL Token',
            price: token.price ? parseFloat(token.price).toFixed(4) : '0.0000',
            priceNum: token.price ? parseFloat(token.price) : 0,
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
          console.log(`✅ Total tokens ready: ${tokenData.length}`);
        } else {
          console.log('⚠️ No token data available');
          setAllTokens([]);
        }
      } catch (err) {
        console.error('Failed to load tokens:', err);
        setAllTokens([]);
      } finally {
        setLoadingTokens(false);
      }
    };

    loadAllTokens();
  }, []);

  useEffect(() => {
    localStorage.setItem('x1_portfolio_wallets', JSON.stringify(wallets));
  }, [wallets]);

  const addWallet = () => {
    if (!newWallet || wallets.find(w => w.address === newWallet)) return;
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(newWallet)) {
      setError('Invalid wallet address format');
      return;
    }
    setWallets([...wallets, { address: newWallet, label: `Wallet ${wallets.length + 1}` }]);
    setNewWallet('');
    setError(null);
  };

  const removeWallet = (address) => {
    setWallets(wallets.filter(w => w.address !== address));
  };

  const handleSort = useCallback((column) => {
    if (sortBy === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  }, [sortBy]);

  const filterAndSortTokens = useCallback((tokens) => {
    let filtered = [...tokens];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(token =>
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query) ||
        token.mint.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      switch (sortBy) {
        case 'value':
          return direction * (b.currentValue - a.currentValue);
        case 'balance':
          return direction * (b.amount - a.amount);
        case 'symbol':
          return direction * a.symbol.localeCompare(b.symbol);
        case 'price':
          return direction * (b.priceNum - a.priceNum);
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [searchQuery, sortBy, sortDirection]);

  const fetchPortfolio = async () => {
    if (wallets.length === 0) {
      setPortfolioData(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const balancePromises = wallets.map(async (wallet) => {
        try {
          console.log('🔍 Fetching tokens for wallet:', wallet.address);
          
          // Use RPC failover endpoints (same as other explorers)
          const RPC_ENDPOINTS = [
            'https://rpc.mainnet.x1.xyz',
            'https://nexus.fortiblox.com/rpc',
            'https://rpc.owlnet.dev/?api-key=3a792cc7c3df79f2e7bc929757b47c38',
            'https://rpc.x1galaxy.io/'
          ];

          let rpcData = null;
          let nativeBalance = 0;

          // Fetch native XNT balance + token accounts from BOTH programs
          for (const endpoint of RPC_ENDPOINTS) {
            try {
              // Fetch native balance + Token Program + Token-2022 Program in parallel
              const [balanceResponse, tokenProgramResponse, token2022Response] = await Promise.all([
                // Get native XNT balance
                fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getBalance',
                    params: [wallet.address]
                  }),
                  signal: AbortSignal.timeout(5000)
                }),
                // Get Token Program accounts
                fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 2,
                    method: 'getTokenAccountsByOwner',
                    params: [
                      wallet.address,
                      { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, // Legacy Token Program
                      { encoding: 'jsonParsed' }
                    ]
                  }),
                  signal: AbortSignal.timeout(5000)
                }),
                // Get Token-2022 Program accounts
                fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 3,
                    method: 'getTokenAccountsByOwner',
                    params: [
                      wallet.address,
                      { programId: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' }, // Token-2022 Program
                      { encoding: 'jsonParsed' }
                    ]
                  }),
                  signal: AbortSignal.timeout(5000)
                })
              ]);

              const balanceData = await balanceResponse.json();
              const tokenProgramData = await tokenProgramResponse.json();
              const token2022Data = await token2022Response.json();
              
              if (balanceData.result?.value !== undefined) {
                nativeBalance = balanceData.result.value / 1e9; // Convert lamports to XNT
                console.log(`✓ Native XNT balance: ${nativeBalance}`);
              }
              
              // Combine tokens from both programs
              const legacyTokens = tokenProgramData.result?.value || [];
              const token2022Tokens = token2022Data.result?.value || [];
              
              console.log(`✓ Legacy Token Program: ${legacyTokens.length} tokens`);
              console.log(`✓ Token-2022 Program: ${token2022Tokens.length} tokens`);
              
              if (legacyTokens.length > 0 || token2022Tokens.length > 0) {
                rpcData = {
                  result: {
                    value: [...legacyTokens, ...token2022Tokens]
                  }
                };
                console.log(`✓ RPC success: ${endpoint} (Total: ${rpcData.result.value.length} tokens)`);
                break;
              }
            } catch (err) {
              console.warn(`RPC failed: ${endpoint}`);
              continue;
            }
          }

          if (!rpcData?.result?.value && nativeBalance === 0) {
            console.warn('No RPC data for wallet:', wallet.address);
            return { address: wallet.address, label: wallet.label, tokens: [], totalValue: 0 };
          }

          // Extract wallet token balances
          const walletTokens = rpcData?.result?.value
            ? rpcData.result.value
                .map(account => {
                  const info = account.account.data.parsed.info;
                  return {
                    mint: info.mint,
                    amount: Number(info.tokenAmount.uiAmount),
                    decimals: info.tokenAmount.decimals
                  };
                })
                .filter(t => t.amount > 0)
            : [];

          console.log(`✓ Found ${walletTokens.length} SPL tokens + native XNT in wallet`);
          
          // DEBUG: Log all wallet token mints
          console.log('═══ WALLET TOKENS ═══');
          walletTokens.forEach((t, i) => {
            console.log(`${i+1}. Mint: ${t.mint} | Amount: ${t.amount}`);
          });
          
          // DEBUG: Log total tokens in price database
          console.log(`═══ PRICE DATABASE ═══`);
          console.log(`Total tokens in database: ${allTokens.length}`);
          console.log('Sample mints from database:', allTokens.slice(0, 5).map(t => `${t.symbol}: ${t.mint}`));
          
          // Match with price data from API (ONLY show tokens with known prices)
          const enrichedWalletTokens = walletTokens
            .map((walletToken, idx) => {
              const tokenData = allTokens.find(t => t.mint === walletToken.mint);
              
              if (tokenData) {
                console.log(`✓ MATCH ${idx+1}: ${tokenData.symbol} (${tokenData.name}) @ $${tokenData.price} | Wallet: ${walletToken.amount}`);
                const currentValue = walletToken.amount * tokenData.priceNum;
                
                return {
                  mint: walletToken.mint,
                  amount: walletToken.amount,
                  decimals: walletToken.decimals,
                  name: tokenData.name,
                  symbol: tokenData.symbol,
                  logo: tokenData.logo,
                  price: tokenData.price,
                  priceNum: tokenData.priceNum,
                  currentValue: currentValue,
                  verified: tokenData.verified
                };
              } else {
                // Token not in price database - SKIP IT
                console.log(`✗ NO MATCH ${idx+1}: ${walletToken.mint} (not in price database)`);
                
                // DEBUG: Try to find similar tokens
                const similar = allTokens.filter(t => 
                  t.mint.toLowerCase().includes(walletToken.mint.toLowerCase().slice(0, 8)) ||
                  walletToken.mint.toLowerCase().includes(t.mint.toLowerCase().slice(0, 8))
                );
                if (similar.length > 0) {
                  console.log(`  → Similar: `, similar.map(t => `${t.symbol}: ${t.mint}`));
                }
                
                return null;
              }
            })
            .filter(token => token !== null); // Remove null entries (unknown tokens)

          // Add native XNT if balance > 0
          if (nativeBalance > 0) {
            // Find XNT price from token list (WXNT or XNT)
            const xntToken = allTokens.find(t => 
              t.symbol === 'WXNT' || 
              t.symbol === 'XNT' ||
              t.name.toLowerCase().includes('x1 native')
            );
            
            if (xntToken) {
              enrichedWalletTokens.unshift({
                mint: 'native',
                amount: nativeBalance,
                decimals: 9,
                name: 'X1 Native Token',
                symbol: 'XNT',
                logo: xntToken.logo || '/assets/images/tokens/x1.webp',
                price: xntToken.price,
                priceNum: xntToken.priceNum,
                currentValue: nativeBalance * xntToken.priceNum,
                verified: true
              });
              console.log(`✓ Added native XNT: ${nativeBalance} @ $${xntToken.price}`);
            }
          }

          // Fetch stake accounts for this wallet
          let stakeBalance = 0;
          try {
            for (const endpoint of RPC_ENDPOINTS) {
              try {
                const stakeResponse = await fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 4,
                    method: 'getProgramAccounts',
                    params: [
                      'Stake11111111111111111111111111111111111111', // Stake program
                      {
                        encoding: 'jsonParsed',
                        filters: [
                          {
                            memcmp: {
                              offset: 12, // Staker authority offset
                              bytes: wallet.address
                            }
                          }
                        ]
                      }
                    ]
                  }),
                  signal: AbortSignal.timeout(5000)
                });

                const stakeData = await stakeResponse.json();
                
                if (stakeData.result && Array.isArray(stakeData.result)) {
                  stakeData.result.forEach(account => {
                    const lamports = account.account?.lamports || 0;
                    stakeBalance += lamports / 1e9;
                  });
                  
                  if (stakeBalance > 0) {
                    console.log(`✓ Found staked XNT: ${stakeBalance}`);
                    
                    // Add staked XNT as a separate entry
                    const xntToken = allTokens.find(t => 
                      t.symbol === 'WXNT' || t.symbol === 'XNT'
                    );
                    
                    if (xntToken) {
                      enrichedWalletTokens.push({
                        mint: 'staked',
                        amount: stakeBalance,
                        decimals: 9,
                        name: 'Staked XNT',
                        symbol: '💎 XNT',
                        logo: xntToken.logo,
                        price: xntToken.price,
                        priceNum: xntToken.priceNum,
                        currentValue: stakeBalance * xntToken.priceNum,
                        verified: true,
                        isStaked: true
                      });
                    }
                  }
                  break;
                }
              } catch (err) {
                continue;
              }
            }
          } catch (err) {
            console.warn('Failed to fetch stake accounts:', err);
          }

          console.log(`✅ Showing ${enrichedWalletTokens.length} tokens with prices (filtered out unknowns)`);

          return {
            address: wallet.address,
            label: wallet.label,
            tokens: enrichedWalletTokens,
            stakeBalance: stakeBalance,
            totalValue: enrichedWalletTokens.reduce((sum, t) => sum + t.currentValue, 0)
          };
        } catch (err) {
          console.error('Wallet error:', err);
          return { address: wallet.address, label: wallet.label, tokens: [], totalValue: 0 };
        }
      });

      const results = await Promise.all(balancePromises);
      setPortfolioData({
        wallets: results,
        totalPortfolioValue: results.reduce((sum, w) => sum + w.totalValue, 0)
      });
    } catch (error) {
      console.error('Portfolio error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (wallets.length > 0 && allTokens.length > 0) {
      console.log(`🚀 Auto-fetching portfolio: ${wallets.length} wallets × ${allTokens.length} tokens`);
      fetchPortfolio();
    }
  }, [wallets, allTokens]);

  const SortIndicator = ({ columnKey }) => {
    if (sortBy !== columnKey) {
      return <ArrowUpDown className="h-3 w-3 ml-1 inline text-gray-500" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1 inline text-cyan-400" />
      : <ArrowDown className="h-3 w-3 ml-1 inline text-cyan-400" />;
  };

  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <header className="bg-[#1d2d3a] border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl('Dashboard')}>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </Link>
            <Wallet className="w-6 h-6 text-cyan-400" />
            <h1 className="text-2xl font-bold">Portfolio Tracker</h1>
            {allTokens.length > 0 && (
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">
                {allTokens.length} Tokens Loaded
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-[#1d2d3a] border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">Add Wallet</h2>
          <div className="flex gap-2">
            <Input
              placeholder="Enter wallet address"
              value={newWallet}
              onChange={(e) => setNewWallet(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addWallet()}
              className="bg-[#0f1419] border-white/10 text-white placeholder:text-gray-500"
            />
            <Button onClick={addWallet} className="bg-cyan-500 hover:bg-cyan-600">Add</Button>
          </div>
          {error && <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">{error}</div>}
        </div>

        {loadingTokens && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
            <span className="text-gray-400">Loading token prices from XDEX...</span>
          </div>
        )}

        {!loadingTokens && allTokens.length > 0 && wallets.length > 0 && (
          <div className="bg-[#1d2d3a] border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Wallets ({wallets.length})</h2>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setHideBalances(!hideBalances)} className="text-gray-400 hover:text-white">
                  {hideBalances ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={fetchPortfolio} disabled={loading} className="text-gray-400 hover:text-white">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
                <span className="text-gray-400">Loading portfolio...</span>
              </div>
            )}

            {!loading && portfolioData && (
              <div className="space-y-4">
                {/* Search and Sort Controls */}
                <div className="bg-[#0f1419] border border-white/5 rounded-lg p-4">
                  <div className="flex gap-3 items-center flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        placeholder="Search tokens..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-[#1d2d3a] border-white/10 text-white placeholder:text-gray-500 pl-10"
                      />
                    </div>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="bg-[#1d2d3a] border border-white/10 text-white rounded px-3 py-2"
                    >
                      <option value="value">Sort by Value</option>
                      <option value="balance">Sort by Balance</option>
                      <option value="symbol">Sort by Symbol</option>
                      <option value="price">Sort by Price</option>
                    </select>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="text-gray-400 hover:text-white"
                    >
                      {sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {portfolioData.wallets.map((wallet) => {
                  const filteredTokens = filterAndSortTokens(wallet.tokens);
                  
                  return (
                  <div key={wallet.address} className="bg-[#0f1419] border border-white/5 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div>
                        <h3 className="font-bold">{wallet.label}</h3>
                        <p className="text-gray-400 text-sm font-mono">{wallet.address.slice(0, 12)}...{wallet.address.slice(-12)}</p>
                        {wallet.stakeBalance > 0 && (
                          <div className="mt-2 inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded px-2 py-1">
                            <span className="text-purple-400 text-xs">💎 Staked:</span>
                            <span className="text-purple-300 text-xs font-mono font-bold">
                              {wallet.stakeBalance.toFixed(2)} XNT
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-cyan-400">${hideBalances ? '••••' : wallet.totalValue.toFixed(2)}</p>
                        <p className="text-gray-400 text-sm">
                          {wallet.tokens.length} tokens
                          {filteredTokens.length !== wallet.tokens.length && ` (${filteredTokens.length} shown)`}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeWallet(wallet.address)} className="text-red-400 hover:bg-red-500/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {filteredTokens.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th 
                                className="text-left py-2 px-2 text-gray-400 cursor-pointer hover:text-cyan-400 transition-colors select-none"
                                onClick={() => handleSort('symbol')}
                              >
                                Token <SortIndicator columnKey="symbol" />
                              </th>
                              <th 
                                className="text-right py-2 px-2 text-gray-400 cursor-pointer hover:text-cyan-400 transition-colors select-none"
                                onClick={() => handleSort('balance')}
                              >
                                Balance <SortIndicator columnKey="balance" />
                              </th>
                              <th 
                                className="text-right py-2 px-2 text-gray-400 cursor-pointer hover:text-cyan-400 transition-colors select-none"
                                onClick={() => handleSort('price')}
                              >
                                Price <SortIndicator columnKey="price" />
                              </th>
                              <th 
                                className="text-right py-2 px-2 text-gray-400 cursor-pointer hover:text-cyan-400 transition-colors select-none"
                                onClick={() => handleSort('value')}
                              >
                                Value <SortIndicator columnKey="value" />
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTokens.map((token) => (
                              <tr key={token.mint} className={`border-b border-white/5 hover:bg-white/[0.02] ${token.isStaked ? 'bg-purple-500/5' : ''}`}>
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-2">
                                    {token.logo ? (
                                      <img src={token.logo} alt={token.symbol} className="w-6 h-6 rounded-full" onError={(e) => e.target.style.display = 'none'} />
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs">
                                        {token.symbol.substring(0, 1)}
                                      </div>
                                    )}
                                    <div>
                                      <div className="flex items-center gap-1">
                                        <p className="font-semibold">{token.symbol}</p>
                                        {token.verified && <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">✓</Badge>}
                                        {token.isStaked && <Badge className="bg-purple-500/20 text-purple-400 border-0 text-xs">Staked</Badge>}
                                      </div>
                                      <p className="text-gray-400 text-xs">{token.name}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="text-right py-2 px-2 font-mono text-sm">{token.amount.toFixed(4)}</td>
                                <td className="text-right py-2 px-2 font-mono text-sm">${token.price}</td>
                                <td className="text-right py-2 px-2 font-mono text-sm text-cyan-400">
                                  {hideBalances ? '••••' : `$${token.currentValue.toFixed(2)}`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {filteredTokens.length === 0 && wallet.tokens.length > 0 && (
                      <div className="text-center py-4 text-gray-400">
                        <p>No tokens found matching "{searchQuery}"</p>
                      </div>
                    )}

                    {wallet.tokens.length === 0 && (
                      <div className="text-center py-4 text-gray-400">
                        <p>No tokens found in this wallet</p>
                      </div>
                    )}
                  </div>
                )})}

                {portfolioData.wallets.length > 0 && (
                  <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-lg p-6 mt-6">
                    <p className="text-gray-400 mb-1">Total Portfolio Value</p>
                    <p className="text-3xl font-bold text-cyan-400">
                      {hideBalances ? '••••••••' : `$${portfolioData.totalPortfolioValue.toFixed(2)}`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!loadingTokens && allTokens.length > 0 && wallets.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Wallet className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>No wallets added yet. Add one above to get started!</p>
          </div>
        )}
      </main>
    </div>
  );
}
