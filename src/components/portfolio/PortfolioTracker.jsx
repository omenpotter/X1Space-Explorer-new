import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Plus, Trash2, Loader2, DollarSign } from 'lucide-react';
import X1Api from '../x1/X1ApiClient';

export default function PortfolioTracker({ walletAddress: propWalletAddress, allTokens }) {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddToken, setShowAddToken] = useState(false);
  const [manualToken, setManualToken] = useState({ mint: '', amount: '', purchasePrice: '' });
  const [walletAddress, setWalletAddress] = useState(propWalletAddress || '');
  const [error, setError] = useState(null);
  const [tokenMetadata, setTokenMetadata] = useState(new Map());

  // Fetch token metadata from X1Api once on component mount
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
        } else {
          console.warn('Failed to load token metadata from X1Api');
        }
      } catch (err) {
        console.error('Error loading token metadata:', err);
      }
    };

    loadTokenMetadata();
  }, []);

  // Original wallet token fetching and real-time updates
  useEffect(() => {
    if (walletAddress) {
      fetchHoldings();
    }
    
    // Subscribe to real-time price updates via WebSocket
    const unsubscribe = X1Api.subscribeToTokenUpdates((update) => {
      if (update.type === 'price_update') {
        console.log('💰 Real-time price update received');
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
    
    return () => {
      unsubscribe();
    };
  }, [walletAddress]);

  const fetchHoldings = async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Fetching tokens for wallet:', walletAddress);
      
      // RPC endpoints - Your server first (8899), then public fallbacks
      const RPC_ENDPOINTS = [
        'http://45.94.81.202:8899',      // Your validator server - RPC API (PRIMARY)
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
                walletAddress,
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
        const enrichedHoldings = tokenAccounts.map(holding => {
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
              purchasePrice: 0,
              profitLoss: 0,
              profitLossPercent: 0,
              verified: metadata.verified
            };
          } else {
            // Fallback if token not in X1Api metadata
            return {
              ...holding,
              name: holding.mint.slice(0, 8) + '...' + holding.mint.slice(-8),
              symbol: 'UNKNOWN',
              logo: null,
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
        console.log(`✓ Portfolio loaded with ${enrichedHoldings.length} tokens`);
      } else {
        console.log('⚠ No tokens found for this wallet');
        setError('No tokens found for this wallet address');
        setHoldings([]);
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      setError(`Failed to fetch wallet tokens: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addManualToken = () => {
    if (!manualToken.mint || !manualToken.amount) return;

    const metadata = tokenMetadata.get(manualToken.mint);
    const currentPrice = metadata ? metadata.price : 0;
    const purchasePrice = parseFloat(manualToken.purchasePrice) || 0;
    const amount = parseFloat(manualToken.amount);
    const currentValue = amount * currentPrice;
    const purchaseValue = amount * purchasePrice;
    const profitLoss = currentValue - purchaseValue;
    const profitLossPercent = purchaseValue > 0 ? (profitLoss / purchaseValue) * 100 : 0;

    const newHolding = {
      mint: manualToken.mint,
      amount,
      name: metadata?.name || manualToken.mint.slice(0, 8) + '...',
      symbol: metadata?.symbol || 'UNKNOWN',
      logo: metadata?.logo,
      currentPrice,
      currentValue,
      purchasePrice,
      profitLoss,
      profitLossPercent,
      priceChange24h: metadata?.priceChange24h || '0.00',
      manual: true,
      verified: metadata?.verified || false
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
    const topGainer = holdings.reduce((max, h) => 
      parseFloat(h.priceChange24h) > parseFloat(max?.priceChange24h || 0) ? h : max, holdings[0]);
    const topLoser = holdings.reduce((min, h) => 
      parseFloat(h.priceChange24h) < parseFloat(min?.priceChange24h || 0) ? h : min, holdings[0]);

    return {
      totalValue: totalValue.toFixed(2),
      totalProfitLoss: totalProfitLoss.toFixed(2),
      totalProfitLossPercent: holdings.length > 0 ? ((totalProfitLoss / (parseFloat(holdings.reduce((sum, h) => sum + (h.purchasePrice * h.amount), 0) || 1))) * 100).toFixed(2) : '0.00',
      topGainer,
      topLoser
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
      {/* Wallet Input Section */}
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load Portfolio'}
          </Button>
        </div>
        {error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Portfolio Stats */}
      {holdings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <p className="text-gray-400 text-sm mb-1">P/L %</p>
            <p className={`font-bold text-lg ${parseFloat(portfolioStats.totalProfitLossPercent) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {portfolioStats.totalProfitLossPercent}%
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
                <th className="px-6 py-3 text-right text-gray-400 font-semibold">24h Change</th>
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
                  <td className="px-6 py-4 text-right text-white">${holding.currentPrice.toFixed(4)}</td>
                  <td className="px-6 py-4 text-right text-white">${holding.currentValue.toFixed(2)}</td>
                  <td className={`px-6 py-4 text-right font-semibold ${parseFloat(holding.priceChange24h) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    <div className="flex items-center justify-end gap-1">
                      {parseFloat(holding.priceChange24h) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {holding.priceChange24h}%
                    </div>
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

      {/* Add Manual Token Section */}
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
          <p>Enter a wallet address and click "Load Portfolio" to view your tokens</p>
        </div>
      )}
    </div>
  );
}
