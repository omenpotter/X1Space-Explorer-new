import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, Loader2, Wallet, TrendingUp, TrendingDown, RefreshCw,
  Plus, Trash2, Eye, EyeOff, ArrowUpRight, ArrowDownRight, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, AreaChart, Area } from 'recharts';
import X1Api from '../components/x1/X1ApiClient';

export default function PortfolioTracker() {
  const [wallets, setWallets] = useState([]);
  const [newWallet, setNewWallet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [portfolioData, setPortfolioData] = useState(null);
  const [hideBalances, setHideBalances] = useState(false);
  const [tokenMetadata, setTokenMetadata] = useState(new Map());

  // Load wallets from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('x1_portfolio_wallets');
    if (saved) {
      const parsed = JSON.parse(saved);
      setWallets(parsed);
    }
  }, []);

  // Load token metadata from X1Api once on mount
  useEffect(() => {
    const loadTokenMetadata = async () => {
      try {
        console.log('📡 Loading token metadata from X1Api...');
        const response = await X1Api.listTokens({ limit: 3000, offset: 0, verified: false });
        
        if (response.success && response.data?.tokens) {
          const metadata = new Map();
          response.data.tokens.forEach(token => {
            metadata.set(token.mint, {
              name: token.name || 'Unknown Token',
              symbol: token.symbol || 'UNKNOWN',
              logo: token.logo_uri || token.logo,
              price: parseFloat(token.price || 0),
              priceChange24h: token.price_change_24h || '0.00',
              decimals: token.decimals || 9,
              verified: token.verified || false
            });
          });
          console.log(`✓ Loaded metadata for ${metadata.size} tokens from X1Api`);
          setTokenMetadata(metadata);
        }
      } catch (err) {
        console.error('Failed to load token metadata:', err);
      }
    };

    loadTokenMetadata();
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

  // Fetch wallet tokens from RPC
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
            'http://45.94.81.202:8899',      // Your validator server - RPC API
            'https://rpc.mainnet.x1.xyz',    // Public RPC 1
            'https://nexus.fortiblox.com/rpc', // Public RPC 2
            'https://rpc.owlnet.dev/?api-key=3a792cc7c3df79f2e7bc929757b47c38', // Public RPC 3
            'https://rpc.x1galaxy.io/'       // Public RPC 4
          ];

          let data = null;

          // Try each RPC endpoint until one works
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
            const tokenAccounts = data.result.value
              .map(account => {
                const info = account.account.data.parsed.info;
                return {
                  mint: info.mint,
                  amount: Number(info.tokenAmount.uiAmount),
                  decimals: info.tokenAmount.decimals
                };
              })
              .filter(t => t.amount > 0);

            console.log(`✓ Found ${tokenAccounts.length} tokens in wallet`);
            
            // Enrich with metadata from X1Api
            const enrichedTokens = tokenAccounts.map(holding => {
              const metadata = tokenMetadata.get(holding.mint);
              
              if (metadata) {
                const currentValue = holding.amount * metadata.price;
                return {
                  ...holding,
                  name: metadata.name,
                  symbol: metadata.symbol,
                  logo: metadata.logo,
                  currentPrice: metadata.price,
                  currentValue,
                  priceChange24h: metadata.priceChange24h,
                  verified: metadata.verified
                };
              } else {
                return {
                  ...holding,
                  name: holding.mint.slice(0, 8) + '...' + holding.mint.slice(-8),
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
              totalValue: 0,
              error: 'Could not fetch tokens'
            };
          }
        } catch (err) {
          console.error('Error fetching portfolio:', err);
          return {
            address: wallet.address,
            label: wallet.label,
            tokens: [],
            totalValue: 0,
            error: err.message
          };
        }
      });

      const results = await Promise.all(balancePromises);
      
      // Filter out errors, keep successful results
      const validResults = results.filter(r => !r.error && r.tokens.length > 0);
      
      if (validResults.length > 0) {
        setPortfolioData({
          wallets: validResults,
          totalPortfolioValue: validResults.reduce((sum, w) => sum + w.totalValue, 0)
        });
      } else {
        setError('Could not fetch token data from any RPC endpoint');
        setPortfolioData(null);
      }
    } catch (error) {
      console.error('Portfolio fetch error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when wallets change
  useEffect(() => {
    if (wallets.length > 0) {
      fetchPortfolio();
    }
  }, [wallets]);

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

        {/* Wallets List */}
        {wallets.length > 0 && (
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
                        <p className="text-gray-400 text-sm">{wallet.address.slice(0, 8)}...{wallet.address.slice(-8)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-cyan-400">${wallet.totalValue.toFixed(2)}</p>
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
                                      <p className="font-semibold">{token.symbol}</p>
                                      <p className="text-gray-400 text-xs">{token.name}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="text-right py-2 px-2">{token.amount.toFixed(4)}</td>
                                <td className="text-right py-2 px-2">${token.currentPrice.toFixed(4)}</td>
                                <td className="text-right py-2 px-2">${token.currentValue.toFixed(2)}</td>
                                <td className={`text-right py-2 px-2 font-semibold ${parseFloat(token.priceChange24h) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {parseFloat(token.priceChange24h) >= 0 ? '↑' : '↓'} {token.priceChange24h}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}

                {/* Portfolio Summary */}
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 mt-6">
                  <p className="text-gray-400 mb-1">Total Portfolio Value</p>
                  <p className="text-3xl font-bold text-cyan-400">${portfolioData.totalPortfolioValue.toFixed(2)}</p>
                </div>
              </div>
            )}

            {!loading && wallets.length > 0 && !portfolioData && (
              <div className="text-center py-8 text-gray-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Could not load portfolio data. Check RPC connection.</p>
              </div>
            )}
          </div>
        )}

        {wallets.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Wallet className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>No wallets added yet. Add a wallet to get started!</p>
          </div>
        )}
      </main>
    </div>
  );
}
