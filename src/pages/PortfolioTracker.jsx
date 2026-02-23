import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, Loader2, Wallet, RefreshCw,
  Trash2, Eye, EyeOff
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

  useEffect(() => {
    const saved = localStorage.getItem('x1_portfolio_wallets');
    if (saved) setWallets(JSON.parse(saved));
  }, []);

  // Load tokens from Base44 API (same as Token Explorer)
  useEffect(() => {
    const loadAllTokens = async () => {
      try {
        console.log('📡 Loading tokens from Base44 API...');
        
        // Use same API endpoint as Token Explorer
        const response = await X1Api.listTokens({ limit: 500, offset: 0, verified: false });

        if (response.success && response.data?.tokens) {
          const tokens = response.data.tokens;
          console.log(`✓ Loaded ${tokens.length} tokens from XDEX`);
          
          // Map to simplified format for portfolio matching
          const enrichedTokens = tokens.map(token => ({
            mint: token.mint,
            name: token.name || 'Unknown Token',
            symbol: token.symbol || 'UNKNOWN',
            logo: token.logo_uri,
            decimals: token.decimals || 9,
            price: token.price ? parseFloat(token.price).toFixed(4) : '0.0000',
            priceNum: token.price ? parseFloat(token.price) : 0,
            verified: token.verification_count > 0
          }));
          
          setAllTokens(enrichedTokens);
          console.log(`✅ Ready: ${enrichedTokens.length} tokens with prices`);
        }
      } catch (err) {
        console.error('Failed to load tokens:', err);
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
          
          // Use RPC failover endpoints
          const RPC_ENDPOINTS = [
            'https://rpc.mainnet.x1.xyz',
            'https://nexus.fortiblox.com/rpc',
            'https://rpc.owlnet.dev/?api-key=3a792cc7c3df79f2e7bc929757b47c38',
            'https://rpc.x1galaxy.io/'
          ];

          let rpcData = null;

          for (const endpoint of RPC_ENDPOINTS) {
            try {
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
                }),
                signal: AbortSignal.timeout(5000)
              });

              rpcData = await response.json();
              if (rpcData.result?.value) {
                console.log(`✓ RPC: ${endpoint}`);
                break;
              }
            } catch (err) {
              continue;
            }
          }

          if (!rpcData?.result?.value) {
            return { address: wallet.address, label: wallet.label, tokens: [], totalValue: 0 };
          }

          // Extract wallet token balances
          const walletTokens = rpcData.result.value
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
          
          // Match with price data from Base44 API
          const enrichedWalletTokens = walletTokens.map((walletToken) => {
            const tokenData = allTokens.find(t => t.mint === walletToken.mint);
            
            if (tokenData) {
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
              // Token not found in price database
              return {
                mint: walletToken.mint,
                amount: walletToken.amount,
                decimals: walletToken.decimals,
                name: walletToken.mint.slice(0, 8) + '...',
                symbol: 'UNKNOWN',
                logo: null,
                price: '0.0000',
                priceNum: 0,
                currentValue: 0,
                verified: false
              };
            }
          });

          return {
            address: wallet.address,
            label: wallet.label,
            tokens: enrichedWalletTokens,
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
      console.log(`🚀 Fetching portfolio: ${wallets.length} wallets, ${allTokens.length} tokens`);
      fetchPortfolio();
    }
  }, [wallets, allTokens]);

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

        {allTokens.length === 0 && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
            <span className="text-gray-400">Loading token prices from XDEX...</span>
          </div>
        )}

        {allTokens.length > 0 && wallets.length > 0 && (
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
                {portfolioData.wallets.map((wallet) => (
                  <div key={wallet.address} className="bg-[#0f1419] border border-white/5 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-bold">{wallet.label}</h3>
                        <p className="text-gray-400 text-sm font-mono">{wallet.address.slice(0, 12)}...{wallet.address.slice(-12)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-cyan-400">${hideBalances ? '••••' : wallet.totalValue.toFixed(2)}</p>
                        <p className="text-gray-400 text-sm">{wallet.tokens.length} tokens</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeWallet(wallet.address)} className="text-red-400 hover:bg-red-500/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {wallet.tokens.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10">
                              <th className="text-left py-2 px-2 text-gray-400">Token</th>
                              <th className="text-right py-2 px-2 text-gray-400">Balance</th>
                              <th className="text-right py-2 px-2 text-gray-400">Price</th>
                              <th className="text-right py-2 px-2 text-gray-400">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wallet.tokens.map((token) => (
                              <tr key={token.mint} className="border-b border-white/5 hover:bg-white/[0.02]">
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-2">
                                    {token.logo ? (
                                      <img src={token.logo} alt={token.symbol} className="w-6 h-6 rounded-full" />
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs">
                                        {token.symbol.substring(0, 1)}
                                      </div>
                                    )}
                                    <div>
                                      <div className="flex items-center gap-1">
                                        <p className="font-semibold">{token.symbol}</p>
                                        {token.verified && <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">✓</Badge>}
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

                    {wallet.tokens.length === 0 && (
                      <div className="text-center py-4 text-gray-400">
                        <p>No tokens found in this wallet</p>
                      </div>
                    )}
                  </div>
                ))}

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

        {allTokens.length > 0 && wallets.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Wallet className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>No wallets added yet. Add one above to get started!</p>
          </div>
        )}
      </main>
    </div>
  );
}
