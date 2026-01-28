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
  const [allTokens, setAllTokens] = useState(propAllTokens || []); // Use prop or load own

  // Load token data from database if not provided by parent
  useEffect(() => {
    if (!propAllTokens || propAllTokens.length === 0) {
      const loadTokenData = async () => {
        try {
          console.log('📡 Loading token data from database (no props provided)...');
          const response = await X1Api.listTokens({ limit: 3000, offset: 0, verified: false });
          
          if (response.success && response.data?.tokens) {
            console.log(`✓ Loaded ${response.data.tokens.length} tokens from database`);
            setAllTokens(response.data.tokens);
          }
        } catch (err) {
          console.error('Failed to load token data:', err);
        }
      };
      loadTokenData();
    } else {
      console.log(`✓ Using ${propAllTokens.length} tokens from parent prop`);
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
      
      // RPC endpoints
      const RPC_ENDPOINTS = [
        'http://45.94.81.202:8899',
        'https://rpc.mainnet.x1.xyz',
        'https://nexus.fortiblox.com/rpc',
        'https://rpc.owlnet.dev/?api-key=3a792cc7c3df79f2e7bc929757b47c38',
        'https://rpc.x1galaxy.io/'
      ];

      let data = null;

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
          console.log(`  ✗ Failed`);
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

        console.log(`✓ Found ${walletTokens.length} tokens`);
        
        // Match with database tokens (SAME approach as TokenExplorer)
        const enrichedHoldings = walletTokens.map(walletToken => {
          const tokenData = allTokens.find(t => t.mint === walletToken.mint);
          
          if (tokenData) {
            const currentPrice = parseFloat(tokenData.price || 0);
            const currentValue = walletToken.amount * currentPrice;
            
            return {
              ...walletToken,
              name: tokenData.name || 'Unknown Token',
              symbol: tokenData.symbol || 'UNKNOWN',
              logo: tokenData.logo_uri || tokenData.logo,
              currentPrice,
              currentValue,
              priceChange24h: tokenData.price_change_24h || '0.00',
              purchasePrice: 0,
              profitLoss: 0,
              profitLossPercent: 0,
              verified: tokenData.verified || false,
              description: tokenData.description,
              website: tokenData.website
            };
          } else {
            return {
              ...walletToken,
              name: walletToken.mint.slice(0, 8) + '...' + walletToken.mint.slice(-8),
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
        console.log(`✓ Portfolio loaded: ${enrichedHoldings.length} tokens`);
      } else {
        setError('Could not fetch wallet tokens');
        setHoldings([]);
      }
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
    const currentPrice = tokenData ? parseFloat(tokenData.price || 0) : 0;
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
      logo: tokenData?.logo_uri,
      currentPrice,
      currentValue,
      purchasePrice,
      profitLoss,
      profitLossPercent,
      priceChange24h: tokenData?.price_change_24h || '0.00',
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
                  <td className="px-6 py-4 text-right text-white">${holding.currentPrice.toFixed(4)}</td>
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

      {holdings.length === 0 && !error && (
        <div className="text-center p-8 text-gray-400">
          <p>Enter a wallet address to view portfolio</p>
        </div>
      )}
    </div>
  );
}
