import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, Loader2, Wallet, TrendingUp, TrendingDown, RefreshCw,
  Plus, Trash2, Eye, EyeOff, AlertCircle
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
  const [allTokens, setAllTokens] = useState([]); // Store all tokens from database

  // Load wallets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('x1_portfolio_wallets');
    if (saved) {
      const parsed = JSON.parse(saved);
      setWallets(parsed);
    }
  }, []);

  // Load all tokens from database (same as TokenExplorer) - ONCE on mount
  useEffect(() => {
    const loadAllTokens = async () => {
      try {
        console.log('📡 Loading all tokens from database (like TokenExplorer)...');
        const response = await X1Api.listTokens({ limit: 3000, offset: 0, verified: false });
        
        if (response.success && response.data?.tokens) {
          setAllTokens(response.data.tokens);
          console.log(`✓ Loaded ${response.data.tokens.length} tokens from database`);
        }
      } catch (err) {
        console.error('Failed to load tokens from database:', err);
      }
    };

    loadAllTokens();
  }, []);

  // Save wallets to localStorage
  useEffect(() => {
    localStorage.setItem('x1_portfolio_wallets', JSON.stringify(wallets));
  }, [wallets]);

  const addWallet = async () => {
    if (!newWallet || wallets.find(w => w.address === newWallet)) return;
    
    // Validate address format (base58, 32-44 chars)
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

  // Fetch wallet tokens from RPC and match with database tokens
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
          
          // RPC endpoints - Your server first, then public fallbacks
          const RPC_ENDPOINTS = [
            'http://45.94.81.202:8899',      // Your validator server
            'https://rpc.mainnet.x1.xyz',    // Public RPC
            'https://nexus.fortiblox.com/rpc', 
            'https://rpc.owlnet.dev/?api-key=3a792cc7c3df79f2e7bc929757b47c38',
            'https://rpc.x1galaxy.io/'
          ];

          let data = null;

          // Try each RPC endpoint
          for (const endpoint of RPC_ENDPOINTS) {
            try {
              console.log(`  → Trying: ${endpoint}`);
              
              const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'getTokenAccountsByOwner',
                  params: [
                    wallet.address,
                    { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
                    { encoding: 'jsonParsed' }
                  ]
                })
              });

              data = await response.json();
              
              if (data.result) {
                console.log(`✓ Connected to: ${endpoint}`);
                break;
              }
            } catch (err) {
              console.log(`  ✗ Failed: ${err.message}`);
              continue;
            }
          }

          if (data?.result?.value) {
            const walletTokens = data.result.value
              .map(account => {
                const info = account.account.data.parsed.info;
                return {
                  mint: info.mint,
                  amount: Number(info.tokenAmount.uiAmount),
                  decimals: info.tokenAmount.decimals
                };
              })
              .filter(t => t.amount > 0);

            console.log(`✓ Found ${walletTokens.length} tokens in wallet`);
            
            // Match wallet tokens with database tokens (same approach as TokenExplorer)
            const enrichedTokens = walletTokens.map(walletToken => {
              // Find token data in database
              const tokenData = allTokens.find(t => t.mint === walletToken.mint);
              
              if (tokenData) {
                const currentPrice = parseFloat(tokenData.price || 0);
                const currentValue = walletToken.amount * currentPrice;
                
                return {
                  mint: walletToken.mint,
                  amount: walletToken.amount,
                  decimals: walletToken.decimals,
                  // Database fields
                  name: tokenData.name || 'Unknown Token',
                  symbol: tokenData.symbol || 'UNKNOWN',
                  logo: tokenData.logo_uri || tokenData.logo,
                  currentPrice: currentPrice,
                  currentValue: currentValue,
                  priceChange24h: tokenData.price_change_24h || '0.00',
                  verified: tokenData.verified || false,
                  marketCap: tokenData.market_cap || 0,
                  description: tokenData.description,
                  website: tokenData.website,
                  twitter: tokenData.twitter,
                  telegram: tokenData.telegram,
                  discord: tokenData.discord
                };
              } else {
                // Fallback if token not in database
                return {
                  mint: walletToken.mint,
                  amount: walletToken.amount,
                  decimals: walletToken.decimals,
                  name: walletToken.mint.slice(0, 8) + '...' + walletToken.mint.slice(-8),
                  symbol: 'UNKNOWN',
                  logo: null,
                  currentPrice: 0,
                  currentValue: 0,
                  priceChange24h: '0.00',
                  verified: false
                };
              }
            });

            return {
              address: wallet.address,
              label: wallet.label,
              tokens: enrichedTokens,
              totalValue: enrichedTokens.reduce((sum, t) => sum + t.currentValue, 0)
            };
          } else {
            return {
              address: wallet.address,
              label: wallet.label,
              tokens: [],
              totalValue: 0
            };
          }
        } catch (err) {
          console.error('Error fetching portfolio:', err);
          return {
            address: wallet.address,
            label: wallet.label,
            tokens: [],
            totalValue: 0
          };
        }
      });

      const results = await Promise.all(balancePromises);
      
      setPortfolioData({
        wallets: results,
        totalPortfolioValue: results.reduce((sum, w) => sum + w.totalValue, 0)
      });
    } catch (error) {
      console.error('Portfolio fetch error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when wallets change
  useEffect(() => {
    if (wallets.length > 0 && allTokens.length > 0) {
      fetchPortfolio();
    }
  }, [wallets, allTokens]);

  return (
    <div className="min-h-screen bg-[#1d2d3a] text-white">
      {/* Header */}
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
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Add Wallet Section */}
        <div className="bg-[#24384a] rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">Add Wallet</h2>
          <div className="flex gap-2">
            <Input
              placeholder="Enter wallet address"
              value={newWallet}
              onChange={(e) => setNewWallet(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addWallet()}
              className="bg-[#1d2d3a] border-0 text-white placeholder:text-gray-500"
            />
            <Button 
              onClick={addWallet}
              className="bg-cyan-500 hover:bg-cyan-600"
            >
              Add
            </Button>
          </div>
          {error && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Loading State */}
        {!allTokens.length && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
            <span className="text-gray-400">Loading token database...</span>
          </div>
        )}

        {/* Wallets List */}
        {allTokens.length > 0 && wallets.length > 0 && (
          <div className="bg-[#24384a] rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Wallets ({wallets.length})</h2>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setHideBalances(!hideBalances)}
                  className="text-gray-400 hover:text-white"
                >
                  {hideBalances ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={fetchPortfolio}
                  disabled={loading}
                  className="text-gray-400 hover:text-white"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {loading && (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
                <span className="text-gray-400">Loading portfolio data...</span>
              </div>
            )}

            {!loading && portfolioData && (
              <div className="space-y-4">
                {portfolioData.wallets.map((wallet) => (
                  <div key={wallet.address} className="bg-[#1d2d3a] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-bold">{wallet.label}</h3>
                        <p className="text-gray-400 text-sm">{wallet.address.slice(0, 12)}...{wallet.address.slice(-12)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-cyan-400">
                          {hideBalances ? '••••' : `$${wallet.totalValue.toFixed(2)}`}
                        </p>
                        <p className="text-gray-400 text-sm">{wallet.tokens.length} tokens</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeWallet(wallet.address)}
                        className="text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Tokens Table */}
                    {wallet.tokens.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left py-2 px-2 text-gray-400">Token</th>
                              <th className="text-right py-2 px-2 text-gray-400">Balance</th>
                              <th className="text-right py-2 px-2 text-gray-400">Price</th>
                              <th className="text-right py-2 px-2 text-gray-400">Value</th>
                              <th className="text-right py-2 px-2 text-gray-400">24h Change</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wallet.tokens.map((token) => (
                              <tr key={token.mint} className="border-b border-white/5 hover:bg-white/[0.02]">
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-2">
                                    {token.logo && <img src={token.logo} alt={token.symbol} className="w-6 h-6 rounded-full" />}
                                    <div>
                                      <div className="flex items-center gap-1">
                                        <p className="font-semibold">{token.symbol}</p>
                                        {token.verified && <Badge className="bg-cyan-500/20 text-cyan-400 text-xs">Verified</Badge>}
                                      </div>
                                      <p className="text-gray-400 text-xs">{token.name}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="text-right py-2 px-2 font-mono text-sm">{token.amount.toFixed(4)}</td>
                                <td className="text-right py-2 px-2 font-mono text-sm">${token.currentPrice.toFixed(4)}</td>
                                <td className="text-right py-2 px-2 font-mono text-sm">
                                  {hideBalances ? '••••' : `$${token.currentValue.toFixed(2)}`}
                                </td>
                                <td className={`text-right py-2 px-2 font-semibold ${parseFloat(token.priceChange24h) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {parseFloat(token.priceChange24h) >= 0 ? <TrendingUp className="w-4 h-4 inline mr-1" /> : <TrendingDown className="w-4 h-4 inline mr-1" />}
                                  {token.priceChange24h}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {wallet.tokens.length === 0 && (
                      <div className="text-center py-4 text-gray-400">
                        <p>No tokens found in this wallet</p>
                      </div>
                    )}
                  </div>
                ))}

                {/* Portfolio Summary */}
                {portfolioData.wallets.length > 0 && (
                  <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 mt-6">
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

        {allTokens.length > 0 && wallets.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Wallet className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>No wallets added yet. Add a wallet above to get started!</p>
          </div>
        )}
      </main>
    </div>
  );
}
