import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Plus, Trash2, Loader2, DollarSign } from 'lucide-react';
import X1Api from '../x1/X1ApiClient';

export default function PortfolioTracker({ walletAddress: propWalletAddress, allTokens: propAllTokens }) {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddToken, setShowAddToken] = useState(false);
  const [manualToken, setManualToken] = useState({ mint: '', amount: '', purchasePrice: '' });
  const [walletAddress, setWalletAddress] = useState(propWalletAddress || '');
  const [error, setError] = useState(null);
  const [allTokens, setAllTokens] = useState(propAllTokens || []);

  // Load token data if not provided by parent - EXACT TOKENEXPLORER ENRICHMENT
  useEffect(() => {
    if (!propAllTokens || propAllTokens.length === 0) {
      const loadTokenData = async () => {
        try {
          console.log('📡 Loading token data (TokenExplorer method)...');
          const response = await X1Api.listTokens({ limit: 3000, offset: 0, verified: false });
          
          if (response.success && response.data?.tokens) {
            const tokens = response.data.tokens;
            
            // ENRICHMENT - EXACT COPY FROM TOKENEXPLORER
            const enrichedTokens = tokens.map(token => {
              const tokenData = {
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
                mintAuthority: token.mint_authority || token.mintAuthority,
                freezeAuthority: token.freeze_authority || token.freezeAuthority,
                website: token.website,
                twitter: token.twitter,
                createdBy: token.created_by || token.createdBy,
                createdAt: token.created_at || token.createdAt,
                verificationCount: token.verification_count || token.verificationCount || 0,
                isScam: token.is_scam || token.isScam || false,
                verified: token.verified || false,
                priceHistory: token.price_history || token.priceHistory || [],
                description: token.description,
                telegram: token.telegram,
                discord: token.discord
              };
              return tokenData;
            });
            
            console.log(`✅ Loaded and enriched ${enrichedTokens.length} tokens`);
            setAllTokens(enrichedTokens);
          }
        } catch (err) {
          console.error('Failed to load token data:', err);
        }
      };
      loadTokenData();
    } else {
      console.log(`Using ${propAllTokens.length} tokens from parent prop`);
      setAllTokens(propAllTokens);
    }
  }, [propAllTokens]);

  // Subscribe to real-time price updates
  useEffect(() => {
    if (walletAddress) {
      fetchHoldings();
    }
    
    const unsubscribe = X1Api.subscribeToTokenUpdates((update) => {
      if (update.type === 'price_update') {
        console.log('💰 Real-time price update');
        setHoldings(prev => prev.map(holding => {
          const priceData = update.data[holding.mint];
          if (priceData) {
            const newPrice = priceData.price;
            const newValue = holding.amount * newPrice;
            const profitLoss = newValue - (holding.purchasePrice * holding.amount);
            const profitLossPercent = holding.purchasePrice > 0 ? (profitLoss / (holding.purchasePrice * holding.amount)) * 100 : 0;
            
            return {
              ...holding,
              currentPrice: newPrice,
              currentValue: newValue,
              profitLoss,
              profitLossPercent,
              priceChange24h: priceData.price_change_24h?.toFixed(2) || holding.priceChange24h
            };
          }
          return holding;
        }));
      }
    });
    
    return () => unsubscribe();
  }, [walletAddress]);

  const fetchHoldings = async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Fetching tokens for wallet:', walletAddress);
      
      // RPC endpoints - HTTPS only
      const RPC_ENDPOINTS = [
        'https://rpc.mainnet.x1.xyz',
        'https://nexus.fortiblox.com/rpc',
        'https://rpc.owlnet.dev/?api-key=3a792cc7c3df79f2e7bc929757b47c38',
        'https://rpc.x1galaxy.io/'
      ];

      let rpcData = null;

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
                walletAddress,
                { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
                { encoding: 'jsonParsed' }
              ]
            })
          });

          rpcData = await response.json();
          
          if (rpcData.result?.value) {
            console.log(`✓ Connected to: ${endpoint}`);
            break;
          }
        } catch (err) {
          console.log(`  ✗ Failed`);
          continue;
        }
      }

      if (!rpcData?.result?.value) {
        setError('Could not fetch wallet tokens');
        return;
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

      console.log(`✓ Found ${walletTokens.length} tokens`);
      console.log(`Matching against ${allTokens.length} enriched tokens`);
      
      // Match with enriched tokens - EXACT SAME LOGIC
      const enrichedHoldings = walletTokens.map((walletToken, idx) => {
        let tokenData = allTokens.find(t => t.mint === walletToken.mint);
        
        if (!tokenData) {
          tokenData = allTokens.find(t => 
            (t.mint || '').toLowerCase() === (walletToken.mint || '').toLowerCase()
          );
        }
        
        if (tokenData) {
          console.log(`✓ Token ${idx+1}: ${tokenData.symbol} (${tokenData.name}) - $${tokenData.price}`);
          const currentValue = walletToken.amount * tokenData.priceNum;
          
          return {
            ...walletToken,
            name: tokenData.name,
            symbol: tokenData.symbol,
            logo: tokenData.logo,
            price: tokenData.price,
            priceNum: tokenData.priceNum,
            currentPrice: tokenData.priceNum,
            currentValue: currentValue,
            priceChange24h: tokenData.priceChange24h,
            purchasePrice: 0,
            profitLoss: 0,
            profitLossPercent: 0,
            verified: tokenData.verified,
            description: tokenData.description,
            website: tokenData.website
          };
        } else {
          console.log(`✗ Token ${idx+1}: ${walletToken.mint.slice(0, 8)}... not found`);
          return {
            ...walletToken,
            name: walletToken.mint.slice(0, 8) + '...' + walletToken.mint.slice(-8),
            symbol: 'UNKNOWN',
            logo: null,
            price: '0.0000',
            priceNum: 0,
            currentPrice: 0,
            currentValue: 0,
            priceChange24h: '0.00',
            purchasePrice: 0,
            profitLoss: 0,
            profitLossPercent: 0,
            verified: false
          };
        }
      });

      setHoldings(enrichedHoldings);
      console.log(`✅ Portfolio updated: ${enrichedHoldings.length} tokens`);
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const addManualToken = () => {
    if (!manualToken.mint || !manualToken.amount) return;

    const tokenData = allTokens.find(t => t.mint === manualToken.mint);
    const currentPrice = tokenData ? tokenData.priceNum : 0;
    const purchasePrice = parseFloat(manualToken.purchasePrice) || 0;
    const amount = parseFloat(manualToken.amount);
    const currentValue = amount * currentPrice;
    const purchaseValue = amount * purchasePrice;
    const profitLoss = currentValue - purchaseValue;
    const profitLossPercent = purchaseValue > 0 ? (profitLoss / purchaseValue) * 100 : 0;

    const newHolding = {
      mint: manualToken.mint,
      amount,
      name: tokenData?.name || manualToken.mint.slice(0, 8) + '...',
      symbol: tokenData?.symbol || 'UNKNOWN',
      logo: tokenData?.logo,
      price: tokenData?.price || '0.0000',
      priceNum: currentPrice,
      currentPrice,
      currentValue,
      purchasePrice,
      profitLoss,
      profitLossPercent,
      priceChange24h: tokenData?.priceChange24h || '0.00',
      manual: true,
      verified: tokenData?.verified || false
    };

    setHoldings([...holdings, newHolding]);
    setManualToken({ mint: '', amount: '', purchasePrice: '' });
    setShowAddToken(false);
  };

  const removeHolding = (mint) => {
    setHoldings(holdings.filter(h => h.mint !== mint));
  };

  const portfolioStats = useMemo(() => {
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalProfitLoss = holdings.reduce((sum, h) => sum + h.profitLoss, 0);

    return {
      totalValue: totalValue.toFixed(2),
      totalProfitLoss: totalProfitLoss.toFixed(2),
      totalProfitLossPercent: holdings.length > 0 ? ((totalProfitLoss / (parseFloat(holdings.reduce((sum, h) => sum + (h.purchasePrice * h.amount), 0) || 1))) * 100).toFixed(2) : '0.00'
    };
  }, [holdings]);

  if (loading && holdings.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        <span className="ml-2 text-gray-400">Loading portfolio...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wallet Input */}
      <div className="bg-[#24384a] rounded-xl p-6">
        <h2 className="text-white font-bold mb-4">Portfolio Tracker</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Enter wallet address"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            className="bg-[#1d2d3a] border-0 text-white placeholder:text-gray-500"
          />
          <Button 
            onClick={() => fetchHoldings()}
            disabled={loading}
            className="bg-cyan-500 hover:bg-cyan-600"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load'}
          </Button>
        </div>
        {error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Stats */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#24384a] rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Total Value</p>
            <p className="text-white font-bold text-lg">${portfolioStats.totalValue}</p>
          </div>
          <div className="bg-[#24384a] rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Total P/L</p>
            <p className={`font-bold text-lg ${parseFloat(portfolioStats.totalProfitLoss) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${portfolioStats.totalProfitLoss}
            </p>
          </div>
          <div className="bg-[#24384a] rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Tokens</p>
            <p className="text-white font-bold text-lg">{holdings.length}</p>
          </div>
        </div>
      )}

      {/* Holdings Table */}
      {holdings.length > 0 && (
        <div className="bg-[#24384a] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#1d2d3a]">
              <tr>
                <th className="px-6 py-3 text-left text-gray-400 font-semibold">Token</th>
                <th className="px-6 py-3 text-right text-gray-400 font-semibold">Balance</th>
                <th className="px-6 py-3 text-right text-gray-400 font-semibold">Price</th>
                <th className="px-6 py-3 text-right text-gray-400 font-semibold">Value</th>
                <th className="px-6 py-3 text-right text-gray-400 font-semibold">24h</th>
                <th className="px-6 py-3 text-center text-gray-400 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((holding) => (
                <tr key={holding.mint} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {holding.logo && <img src={holding.logo} alt={holding.symbol} className="w-8 h-8 rounded-full" />}
                      <div>
                        <p className="text-white font-semibold">{holding.symbol}</p>
                        <p className="text-gray-400 text-sm">{holding.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-white">{holding.amount.toFixed(4)}</td>
                  <td className="px-6 py-4 text-right text-white">${holding.price}</td>
                  <td className="px-6 py-4 text-right text-white">${holding.currentValue.toFixed(2)}</td>
                  <td className={`px-6 py-4 text-right font-semibold ${parseFloat(holding.priceChange24h) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {holding.priceChange24h}%
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeHolding(holding.mint)}
                      className="text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Manual Token */}
      <div className="bg-[#24384a] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold">Add Manual Token</h3>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowAddToken(!showAddToken)}
            className="text-cyan-400"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        
        {showAddToken && (
          <div className="space-y-3">
            <Input
              placeholder="Token Mint"
              value={manualToken.mint}
              onChange={(e) => setManualToken({ ...manualToken, mint: e.target.value })}
              className="bg-[#1d2d3a] border-0 text-white placeholder:text-gray-500"
            />
            <Input
              placeholder="Amount"
              type="number"
              value={manualToken.amount}
              onChange={(e) => setManualToken({ ...manualToken, amount: e.target.value })}
              className="bg-[#1d2d3a] border-0 text-white placeholder:text-gray-500"
            />
            <Input
              placeholder="Purchase Price (optional)"
              type="number"
              value={manualToken.purchasePrice}
              onChange={(e) => setManualToken({ ...manualToken, purchasePrice: e.target.value })}
              className="bg-[#1d2d3a] border-0 text-white placeholder:text-gray-500"
            />
            <Button 
              onClick={addManualToken}
              className="w-full bg-cyan-500 hover:bg-cyan-600"
            >
              Add Token
            </Button>
          </div>
        )}
      </div>

      {holdings.length === 0 && !error && (
        <div className="text-center p-8 text-gray-400">
          <p>Enter a wallet address and click "Load" to view portfolio</p>
        </div>
      )}
    </div>
  );
}
