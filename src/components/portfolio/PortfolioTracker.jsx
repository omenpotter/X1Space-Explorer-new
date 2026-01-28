import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Plus, Trash2, Loader2, DollarSign } from 'lucide-react';
import X1Rpc from '../x1/X1RpcService';
import X1Api from '../x1/X1ApiClient';

export default function PortfolioTracker({ walletAddress, allTokens }) {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddToken, setShowAddToken] = useState(false);
  const [manualToken, setManualToken] = useState({ mint: '', amount: '', purchasePrice: '' });
  const [allAvailableTokens, setAllAvailableTokens] = useState([]);

  // Fetch comprehensive token list
  useEffect(() => {
    const fetchTokens = async () => {
      try {
        if (!allTokens || allTokens.length === 0) {
          const res = await fetch('https://api.x1.xyz/tokens').catch(() => null);
          if (res?.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.tokens || data.data || []);
            setAllAvailableTokens(list);
          }
        } else {
          setAllAvailableTokens(allTokens);
        }
      } catch (err) {
        console.error('Token fetch error:', err);
        if (allTokens?.length > 0) setAllAvailableTokens(allTokens);
      }
    };
    fetchTokens();
  }, [allTokens]);

  useEffect(() => {
    if (walletAddress) {
      fetchHoldings();
    }
    
    // Subscribe to real-time price updates via WebSocket
    const unsubscribe = X1Api.subscribeToTokenUpdates((update) => {
      if (update.type === 'price_update') {
        console.log('🔴 Portfolio: Real-time price update received');
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

    try {
      const response = await fetch('https://rpc.mainnet.x1.xyz', {
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

      const data = await response.json();
      if (data.result?.value) {
        const tokenAccounts = data.result.value.map(account => {
          const info = account.account.data.parsed.info;
          return {
            mint: info.mint,
            amount: Number(info.tokenAmount.uiAmount),
            decimals: info.tokenAmount.decimals
          };
        }).filter(t => t.amount > 0);

        const enrichedHoldings = tokenAccounts.map(holding => {
          const tokensToUse = allAvailableTokens.length > 0 ? allAvailableTokens : (allTokens || []);
          const tokenData = tokensToUse.find(t => 
            (t.mint || '').trim().toLowerCase() === (holding.mint || '').trim().toLowerCase()
          );
          const currentPrice = tokenData ? parseFloat(tokenData.price) : 0;
          const currentValue = holding.amount * currentPrice;

          return {
            ...holding,
            name: tokenData?.name || 'Unknown Token',
            symbol: tokenData?.symbol || 'UNKNOWN',
            logo: tokenData?.logo,
            currentPrice,
            currentValue,
            priceChange24h: tokenData?.priceChange24h || '0.00',
            purchasePrice: 0,
            profitLoss: 0,
            profitLossPercent: 0
          };
        });

        setHoldings(enrichedHoldings);
      }
    } catch (error) {
      console.error('Failed to fetch holdings:', error);
    } finally {
      setLoading(false);
    }
  };

  const addManualToken = () => {
    if (!manualToken.mint || !manualToken.amount) return;

    const tokensToUse = allAvailableTokens.length > 0 ? allAvailableTokens : (allTokens || []);
    const tokenData = tokensToUse.find(t => 
      (t.mint || '').trim().toLowerCase() === (manualToken.mint || '').trim().toLowerCase()
    );
    const currentPrice = tokenData ? parseFloat(tokenData.price) : 0;
    const purchasePrice = parseFloat(manualToken.purchasePrice) || 0;
    const amount = parseFloat(manualToken.amount);
    const currentValue = amount * currentPrice;
    const purchaseValue = amount * purchasePrice;
    const profitLoss = currentValue - purchaseValue;
    const profitLossPercent = purchaseValue > 0 ? (profitLoss / purchaseValue) * 100 : 0;

    const newHolding = {
      mint: manualToken.mint,
      amount,
      name: tokenData?.name || 'Unknown Token',
      symbol: tokenData?.symbol || 'UNKNOWN',
      logo: tokenData?.logo,
      currentPrice,
      currentValue,
      purchasePrice,
      profitLoss,
      profitLossPercent,
      priceChange24h: tokenData?.priceChange24h || '0.00',
      manual: true
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

    return { totalValue, totalProfitLoss, topGainer, topLoser };
  }, [holdings]);

  const formatNum = (num) => {
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#24384a] rounded-lg p-4">
          <p className="text-gray-400 text-xs mb-1">Total Value</p>
          <p className="text-2xl font-bold text-white">${formatNum(portfolioStats.totalValue)}</p>
        </div>
        <div className="bg-[#24384a] rounded-lg p-4">
          <p className="text-gray-400 text-xs mb-1">Total P/L</p>
          <p className={`text-2xl font-bold ${portfolioStats.totalProfitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {portfolioStats.totalProfitLoss >= 0 ? '+' : ''}${formatNum(portfolioStats.totalProfitLoss)}
          </p>
        </div>
        <div className="bg-[#24384a] rounded-lg p-4">
          <p className="text-gray-400 text-xs mb-1">Top Gainer</p>
          <p className="text-white font-bold text-sm">{portfolioStats.topGainer?.symbol || 'N/A'}</p>
          <p className="text-emerald-400 text-xs">+{portfolioStats.topGainer?.priceChange24h || '0.00'}%</p>
        </div>
        <div className="bg-[#24384a] rounded-lg p-4">
          <p className="text-gray-400 text-xs mb-1">Top Loser</p>
          <p className="text-white font-bold text-sm">{portfolioStats.topLoser?.symbol || 'N/A'}</p>
          <p className="text-red-400 text-xs">{portfolioStats.topLoser?.priceChange24h || '0.00'}%</p>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-[#24384a] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-white font-medium">Your Holdings ({holdings.length})</h3>
          <Button size="sm" onClick={() => setShowAddToken(!showAddToken)} className="bg-cyan-500 hover:bg-cyan-600">
            <Plus className="w-4 h-4 mr-2" />
            Add Token
          </Button>
        </div>

        {showAddToken && (
          <div className="p-4 border-b border-white/5 bg-[#1d2d3a]">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input
                placeholder="Token mint address"
                value={manualToken.mint}
                onChange={(e) => setManualToken({...manualToken, mint: e.target.value})}
                className="bg-[#24384a] border-0 text-white font-mono text-sm"
              />
              <Input
                type="number"
                placeholder="Amount"
                value={manualToken.amount}
                onChange={(e) => setManualToken({...manualToken, amount: e.target.value})}
                className="bg-[#24384a] border-0 text-white text-sm"
              />
              <Input
                type="number"
                placeholder="Purchase price (optional)"
                value={manualToken.purchasePrice}
                onChange={(e) => setManualToken({...manualToken, purchasePrice: e.target.value})}
                className="bg-[#24384a] border-0 text-white text-sm"
              />
              <Button onClick={addManualToken} className="bg-emerald-500 hover:bg-emerald-600">
                Add
              </Button>
            </div>
          </div>
        )}

        {holdings.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No tokens found in your wallet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 text-xs px-4 py-3">Token</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3">Balance</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3">Price</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3">24h Change</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3">Value</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3">P/L</th>
                  <th className="text-center text-gray-400 text-xs px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => (
                  <tr key={holding.mint} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {holding.logo ? (
                          <img src={holding.logo} alt={holding.symbol} className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs">
                            {holding.symbol.substring(0, 1)}
                          </div>
                        )}
                        <div>
                          <p className="text-white text-sm font-medium">{holding.symbol}</p>
                          <p className="text-gray-500 text-xs">{holding.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-mono text-sm">{holding.amount.toFixed(4)}</td>
                    <td className="px-4 py-3 text-right text-white font-mono text-sm">${holding.currentPrice.toFixed(4)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={parseFloat(holding.priceChange24h) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {parseFloat(holding.priceChange24h) >= 0 ? '+' : ''}{holding.priceChange24h}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-white font-bold">${holding.currentValue.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      {holding.profitLoss !== 0 ? (
                        <div>
                          <p className={`font-bold ${holding.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {holding.profitLoss >= 0 ? '+' : ''}${holding.profitLoss.toFixed(2)}
                          </p>
                          <p className={`text-xs ${holding.profitLoss >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {holding.profitLoss >= 0 ? '+' : ''}{holding.profitLossPercent.toFixed(2)}%
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {holding.manual && (
                        <button onClick={() => removeHolding(holding.mint)} className="text-gray-500 hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
