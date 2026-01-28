import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, Loader2, Wallet, TrendingUp, TrendingDown, RefreshCw,
  Plus, Trash2, Eye, EyeOff
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

  // Load tokens - USE ALL TOKENS (don't filter by verified)
  useEffect(() => {
    const loadAllTokens = async () => {
      try {
        console.log('📡 Loading tokens...');
        const response = await X1Api.listTokens({ limit: 3000, offset: 0, verified: false });

        if (response.success && response.data?.tokens) {
          const tokens = response.data.tokens;
          console.log(`✓ Loaded ${tokens.length} tokens total`);
          
          // ENRICHMENT - SAME AS TOKENEXPLORER
          const enrichedTokens = tokens.map(token => ({
            mint: token.mint || token.address,
            name: token.name || 'Unknown Token',
            symbol: token.symbol || 'UNKNOWN',
            logo: token.logo_uri || token.logo,
            decimals: token.decimals || 9,
            totalSupply: token.total_supply || token.totalSupply || token.supply || 0,
            tokenType: token.token_type || token.tokenType || 'SPL Token',
            price: token.price ? parseFloat(token.price).toFixed(4) : '0.0000',
            priceNum: token.price ? parseFloat(token.price) : 0,
            marketCap: token.market_cap || token.marketCap || 0,
            priceChange24h: token.price_change_24h || token.priceChange24h ? parseFloat(token.price_change_24h || token.priceChange24h).toFixed(2) : '0.00',
            verified: token.verified || false,
            description: token.description
          }));
          
          setAllTokens(enrichedTokens);
          console.log(`✅ Ready: ${enrichedTokens.length} tokens`);
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
                })
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

          console.log(`✓ Found ${walletTokens.length} wallet tokens, matching with ${allTokens.length} database tokens`);
          
          // Match with ALL tokens
          const enrichedWalletTokens = walletTokens.map((walletToken, idx) => {
            let tokenData = allTokens.find(t => t.mint === walletToken.mint);
            
            if (!tokenData) {
              tokenData = allTokens.find(t => 
                (t.mint || '').toLowerCase() === (walletToken.mint || '').toLowerCase()
              );
            }
            
            if (tokenData && tokenData.symbol !== 'UNKNOWN') {
              console.log(`✓ Token ${idx+1}: ${tokenData.symbol} (${tokenData.name}) - $${tokenData.price}`);
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
                currentPrice: tokenData.priceNum,
                currentValue: currentValue,
                priceChange24h: tokenData.priceChange24h,
                verified: tokenData.verified,
                marketCap: tokenData.marketCap,
                tokenType: tokenData.tokenType,
                website: tokenData.website,
                twitter: tokenData.twitter,
                description: tokenData.description
              };
            } else {
              const displayName = tokenData?.name || walletToken.mint.slice(0, 8) + '...';
              const displaySymbol = tokenData?.symbol || 'UNKNOWN';
              console.log(`⚠️ Token ${idx+1}: ${displaySymbol} - ${displayName}`);
              return {
                mint: walletToken.mint,
                amount: walletToken.amount,
                decimals: walletToken.decimals,
                name: displayName,
                symbol: displaySymbol,
                logo: tokenData?.logo || null,
                price: tokenData?.price || '0.0000',
                priceNum: tokenData?.priceNum || 0,
                currentPrice: tokenData?.priceNum || 0,
                currentValue: (walletToken.amount * (tokenData?.priceNum || 0)),
                priceChange24h: tokenData?.priceChange24h || '0.00',
                verified: tokenData?.verified || false
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
      console.log(`🚀 Fetching: ${wallets.length} wallets, ${allTokens.length} tokens`);
      fetchPortfolio();
    }
  }, [wallets, allTokens]);

  return (
    <div className="min-h-screen bg-[#1d2d3a] text-white">
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
            <Button onClick={addWallet} className="bg-cyan-500 hover:bg-cyan-600">Add</Button>
          </div>
          {error && <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">{error}</div>}
        </div>

        {allTokens.length === 0 && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mr-2" />
            <span className="text-gray-400">Loading token database...</span>
          </div>
        )}

        {allTokens.length > 0 && wallets.length > 0 && (
          <div className="bg-[#24384a] rounded-xl p-6">
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
                  <div key={wallet.address} className="bg-[#1d2d3a] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-bold">{wallet.label}</h3>
                        <p className="text-gray-400 text-sm">{wallet.address.slice(0, 12)}...{wallet.address.slice(-12)}</p>
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
                              <th className="text-right py-2 px-2 text-gray-400">24h</th>
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
                                        {token.verified && <Badge className="bg-cyan-500/20 text-cyan-400 text-xs">✓</Badge>}
                                      </div>
                                      <p className="text-gray-400 text-xs">{token.name}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="text-right py-2 px-2 font-mono text-sm">{token.amount.toFixed(4)}</td>
                                <td className="text-right py-2 px-2 font-mono text-sm">${token.price}</td>
                                <td className="text-right py-2 px-2 font-mono text-sm">{hideBalances ? '••••' : `$${token.currentValue.toFixed(2)}`}</td>
                                <td className={`text-right py-2 px-2 font-semibold ${parseFloat(token.priceChange24h) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {parseFloat(token.priceChange24h) >= 0 ? '↑' : '↓'} {token.priceChange24h}%
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
            <p>No wallets added yet. Add one above to get started!</p>
          </div>
        )}
      </main>
    </div>
  );
}
