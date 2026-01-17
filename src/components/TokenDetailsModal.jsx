import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  X, Copy, Check, Clock, Globe, Twitter, TrendingUp, 
  TrendingDown, AlertCircle, Shield, Users, Activity 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  PieChart, Pie, Cell, ResponsiveContainer, XAxis, 
  YAxis, Tooltip 
} from 'recharts';
import TokenHealthScore from './ai/TokenHealthScore';

export default function TokenDetailsModal({
  token,
  tokenDetails,
  tokenHolders,
  loadingDetails,
  onClose,
  fetchTokenPrice,
  allTokens,
  tokenMetadata,
  copiedAddress,
  copyToClipboard,
  formatNum,
  formatTime,
  priceTimeframe,
  setPriceTimeframe,
  holderChartData,
  txFlowData,
  tokenTransactions,
  filteredTransactions,
  txFilter,
  setTxFilter,
  createPageUrl
}) {
  const [priceData, setPriceData] = useState(null);
  const [loadingPrice, setLoadingPrice] = useState(false);

  // Fetch price when modal opens
  useEffect(() => {
    if (token?.mint && fetchTokenPrice) {
      setLoadingPrice(true);
      fetchTokenPrice(token.mint)
        .then(data => {
          setPriceData(data);
          setLoadingPrice(false);
        })
        .catch(err => {
          console.error('Failed to fetch price:', err);
          setLoadingPrice(false);
        });
    }
  }, [token?.mint, fetchTokenPrice]);

  if (!token) return null;

  const tokenData = allTokens?.find(t => t.mint === token.mint) || token;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto" onClick={onClose}>
      <div className="min-h-screen px-4 flex items-start justify-center pt-10 pb-20">
        <div 
          className="bg-[#0d1525] rounded-xl p-6 max-w-6xl w-full relative border border-white/10 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl font-bold z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
            </div>
          ) : (
            <>
              {/* Token Header */}
              <div className="flex items-start gap-4 mb-6">
                {(tokenMetadata?.image || tokenData?.logo) && (
                  <img 
                    src={tokenMetadata?.image || tokenData?.logo} 
                    alt={tokenData?.name} 
                    className="w-20 h-20 rounded-full border-2 border-cyan-500/30"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h2 className="text-2xl font-bold text-white">
                      {tokenMetadata?.name || tokenData?.name || 'Unknown Token'}
                    </h2>
                    <Badge className="bg-blue-500/20 text-blue-400 border-0">
                      {tokenData?.symbol || 'UNKNOWN'}
                    </Badge>
                    {tokenData?.verified && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                        ✓ Verified
                      </Badge>
                    )}
                  </div>
                  
                  {/* Price Info */}
                  <div className="flex items-center gap-4 flex-wrap">
                    {loadingPrice ? (
                      <div className="text-gray-400 text-sm">Loading price...</div>
                    ) : priceData?.price ? (
                      <>
                        <div>
                          <p className="text-3xl font-bold text-white">
                            ${parseFloat(priceData.price).toFixed(6)}
                          </p>
                        </div>
                        {priceData.priceChange24h !== undefined && (
                          <div className={`flex items-center gap-1 ${
                            priceData.priceChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {priceData.priceChange24h >= 0 ? (
                              <TrendingUp className="w-5 h-5" />
                            ) : (
                              <TrendingDown className="w-5 h-5" />
                            )}
                            <span className="text-xl font-bold">
                              {priceData.priceChange24h >= 0 ? '+' : ''}
                              {priceData.priceChange24h.toFixed(2)}%
                            </span>
                          </div>
                        )}
                      </>
                    ) : tokenData?.price && parseFloat(tokenData.price) > 0 ? (
                      <>
                        <div>
                          <p className="text-3xl font-bold text-white">
                            ${tokenData.price}
                          </p>
                        </div>
                        {tokenData?.priceChange24h && (
                          <div className={`flex items-center gap-1 ${
                            parseFloat(tokenData.priceChange24h) >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {parseFloat(tokenData.priceChange24h) >= 0 ? (
                              <TrendingUp className="w-5 h-5" />
                            ) : (
                              <TrendingDown className="w-5 h-5" />
                            )}
                            <span className="text-xl font-bold">
                              {parseFloat(tokenData.priceChange24h) >= 0 ? '+' : ''}
                              {tokenData.priceChange24h}%
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-gray-500 text-sm">
                        <AlertCircle className="w-4 h-4 inline mr-1" />
                        Price data unavailable
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {tokenMetadata?.description && (
                    <p className="text-gray-400 text-sm mt-2 max-w-2xl">
                      {tokenMetadata.description}
                    </p>
                  )}

                  {/* Links */}
                  <div className="flex items-center gap-3 mt-3">
                    {token.website && (
                      <a
                        href={token.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-[#24384a] rounded-lg hover:bg-[#2a4055] transition-colors"
                      >
                        <Globe className="w-4 h-4 text-cyan-400" />
                        <span className="text-white text-sm">Website</span>
                      </a>
                    )}
                    {token.twitter && (
                      <a
                        href={token.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-[#24384a] rounded-lg hover:bg-[#2a4055] transition-colors"
                      >
                        <Twitter className="w-4 h-4 text-cyan-400" />
                        <span className="text-white text-sm">Twitter</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Price Chart */}
              {(priceData?.priceHistory?.length > 0 || tokenData?.priceHistory?.length > 0) && (
                <div className="bg-[#1d2d3a] rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-white font-medium">Price Chart</h4>
                    <div className="flex gap-2">
                      {['1D', '7D', '1M', '1Y', 'All'].map(tf => (
                        <Button
                          key={tf}
                          size="sm"
                          variant="outline"
                          onClick={() => setPriceTimeframe(tf)}
                          className={`border-white/20 h-7 text-xs ${
                            priceTimeframe === tf ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'
                          }`}
                        >
                          {tf}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="h-[300px]">
                    {(() => {
                      const history = priceData?.priceHistory || tokenData?.priceHistory || [];
                      if (history.length === 0) return (
                        <div className="h-full flex items-center justify-center text-gray-500">
                          No price history available
                        </div>
                      );

                      const daysMap = { '1D': 1, '7D': 7, '1M': 30, '1Y': 365, 'All': 999 };
                      const days = daysMap[priceTimeframe] || 7;
                      const chartData = history.slice(-days);

                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis 
                              dataKey="timestamp" 
                              tickFormatter={(ts) => new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                              stroke="#6b7280"
                              fontSize={11}
                            />
                            <YAxis stroke="#6b7280" fontSize={11} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}
                              formatter={(value) => [`$${parseFloat(value).toFixed(6)}`, 'Price']}
                              labelFormatter={(ts) => new Date(ts).toLocaleString()}
                            />
                            <Area type="monotone" dataKey="price" stroke="#06b6d4" fill="url(#priceGradient)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Token Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Mint Address</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-mono text-xs truncate">{token.mint}</p>
                    <button
                      onClick={() => copyToClipboard(token.mint)}
                      className="text-gray-500 hover:text-cyan-400 transition-colors shrink-0"
                    >
                      {copiedAddress === token.mint ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Decimals</p>
                  <p className="text-white font-mono">{tokenDetails?.decimals || token.decimals || 0}</p>
                </div>

                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Total Supply</p>
                  <p className="text-white font-mono">
                    {formatNum(tokenDetails?.totalSupply || token.totalSupply || 0)}
                  </p>
                </div>

                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Token Standard</p>
                  <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">
                    {tokenDetails?.tokenType || token.tokenType || 'SPL Token'}
                  </Badge>
                </div>

                {/* Mint Authority with Clear Explanation */}
                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Mint Authority</p>
                  {(!tokenDetails?.mintAuthority || tokenDetails.mintAuthority === 'None') ? (
                    <div>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-0 mb-1">
                        <Shield className="w-3 h-3 mr-1" />
                        Fixed Supply
                      </Badge>
                      <p className="text-xs text-gray-400 mt-1">
                        Mint disabled - No additional tokens can be created
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-0 mb-1">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Mintable
                      </Badge>
                      <p className="text-white font-mono text-xs break-all">{tokenDetails.mintAuthority}</p>
                      <p className="text-xs text-yellow-400 mt-1">
                        ⚠️ More tokens can be minted
                      </p>
                    </div>
                  )}
                </div>

                {/* Freeze Authority with Clear Explanation */}
                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Freeze Authority</p>
                  {(!tokenDetails?.freezeAuthority || tokenDetails.freezeAuthority === 'None') ? (
                    <div>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-0 mb-1">
                        <Shield className="w-3 h-3 mr-1" />
                        Freeze Disabled
                      </Badge>
                      <p className="text-xs text-gray-400 mt-1">
                        Token accounts cannot be frozen
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Badge className="bg-red-500/20 text-red-400 border-0 mb-1">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Freezable
                      </Badge>
                      <p className="text-white font-mono text-xs break-all">{tokenDetails.freezeAuthority}</p>
                      <p className="text-xs text-red-400 mt-1">
                        ⚠️ Accounts can be frozen
                      </p>
                    </div>
                  )}
                </div>

                {tokenDetails?.createdAt && (
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Created</p>
                    <p className="text-white text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(tokenDetails.createdAt)}
                    </p>
                  </div>
                )}

                {tokenDetails?.createdBy && (
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Creator</p>
                    <Link 
                      to={createPageUrl('AddressLookup') + `?address=${tokenDetails.createdBy}`}
                      className="text-cyan-400 hover:underline font-mono text-xs truncate block"
                    >
                      {tokenDetails.createdBy.substring(0, 12)}...
                    </Link>
                  </div>
                )}
              </div>

              {/* AI Health Score with Detailed Analysis */}
              <div className="mb-6">
                <TokenHealthScore 
                  tokenMint={token.mint} 
                  tokenData={tokenDetails || token}
                />
              </div>

              {/* Top Holders */}
              {tokenHolders && tokenHolders.length > 0 && (
                <div className="bg-[#1d2d3a] rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-white font-medium flex items-center gap-2">
                      <Users className="w-5 h-5 text-cyan-400" />
                      Top Token Holders
                    </h4>
                    <Badge className="bg-cyan-500/20 text-cyan-400 border-0">
                      Showing {Math.min(tokenHolders.length, 50)} of {tokenHolders.length} holders
                    </Badge>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {tokenHolders.slice(0, 50).map((holder, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-[#24384a] rounded hover:bg-[#2a4055] transition-colors">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs min-w-[2.5rem]">
                            #{i + 1}
                          </Badge>
                          <Link 
                            to={createPageUrl('AddressLookup') + `?address=${holder.address}`}
                            className="text-cyan-400 hover:underline font-mono text-xs"
                          >
                            {holder.address.substring(0, 8)}...{holder.address.substring(holder.address.length - 6)}
                          </Link>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-mono text-xs">{formatNum(holder.amount)}</p>
                          <p className="text-gray-500 text-xs">{holder.percentage}% of supply</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Holder Distribution Chart */}
              {holderChartData && holderChartData.length > 0 && (
                <div className="bg-[#1d2d3a] rounded-lg p-4 mb-6">
                  <h4 className="text-white font-medium mb-4">Holder Distribution</h4>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={holderChartData}
                          dataKey="percentage"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={(entry) => `${entry.category}: ${entry.percentage}%`}
                        >
                          {holderChartData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${value}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Transaction Flow */}
              {txFlowData && txFlowData.length > 0 && (
                <div className="bg-[#1d2d3a] rounded-lg p-4 mb-6">
                  <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-cyan-400" />
                    Transaction Flow (24h)
                  </h4>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={txFlowData}>
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={(ts) => new Date(ts).toLocaleTimeString('en', { hour: '2-digit' })}
                          stroke="#6b7280"
                          fontSize={11}
                        />
                        <YAxis stroke="#6b7280" fontSize={11} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}
                          formatter={(value, name) => [
                            name === 'count' ? `${value} txs` : `${value.toFixed(2)} tokens`,
                            name === 'count' ? 'Transactions' : 'Volume'
                          ]}
                          labelFormatter={(ts) => new Date(ts).toLocaleTimeString()}
                        />
                        <Bar dataKey="count" fill="#06b6d4" />
                        <Bar dataKey="volume" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Recent Transactions */}
              {tokenTransactions && tokenTransactions.length > 0 && (
                <div className="bg-[#1d2d3a] rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">
                    Recent Transactions ({tokenTransactions.length})
                  </h4>
                  
                  {/* Transaction Filters */}
                  <div className="bg-[#24384a] rounded-lg p-3 mb-4 flex flex-wrap gap-3">
                    <Input
                      placeholder="Search by signature..."
                      value={txFilter.searchSig}
                      onChange={(e) => setTxFilter({...txFilter, searchSig: e.target.value})}
                      className="bg-[#1d2d3a] border-0 text-white text-sm flex-1 min-w-[150px]"
                    />
                    <select
                      value={txFilter.type}
                      onChange={(e) => setTxFilter({...txFilter, type: e.target.value})}
                      className="bg-[#1d2d3a] border-0 text-white rounded-lg px-3 py-1 text-sm"
                    >
                      <option value="all">All Types</option>
                      <option value="transfer">Transfer</option>
                      <option value="approve">Approve</option>
                      <option value="mint">Mint</option>
                      <option value="burn">Burn</option>
                    </select>
                    <select
                      value={txFilter.dateRange}
                      onChange={(e) => setTxFilter({...txFilter, dateRange: e.target.value})}
                      className="bg-[#1d2d3a] border-0 text-white rounded-lg px-3 py-1 text-sm"
                    >
                      <option value="all">All Time</option>
                      <option value="1h">Last Hour</option>
                      <option value="24h">Last 24h</option>
                      <option value="7d">Last 7 Days</option>
                      <option value="30d">Last 30 Days</option>
                    </select>
                  </div>
                  
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-[#1d2d3a]">
                        <tr className="border-b border-white/10">
                          <th className="text-left text-gray-400 text-xs px-2 py-2">Signature</th>
                          <th className="text-left text-gray-400 text-xs px-2 py-2">Type</th>
                          <th className="text-right text-gray-400 text-xs px-2 py-2">Amount</th>
                          <th className="text-left text-gray-400 text-xs px-2 py-2">From</th>
                          <th className="text-left text-gray-400 text-xs px-2 py-2">To</th>
                          <th className="text-right text-gray-400 text-xs px-2 py-2">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions && filteredTransactions.map((tx, i) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <td className="px-2 py-2">
                              <Link 
                                to={createPageUrl('TransactionDetail') + `?sig=${tx.signature}`}
                                className="text-cyan-400 hover:underline font-mono text-xs"
                              >
                                {tx.signature.substring(0, 8)}...
                              </Link>
                            </td>
                            <td className="px-2 py-2">
                              <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">
                                {tx.type}
                              </Badge>
                            </td>
                            <td className="px-2 py-2 text-right text-white font-mono text-xs">
                              {tx.amount.toFixed(4)}
                            </td>
                            <td className="px-2 py-2">
                              <Link 
                                to={createPageUrl('AddressLookup') + `?address=${tx.from}`}
                                className="text-cyan-400 hover:underline font-mono text-xs"
                              >
                                {tx.from.substring(0, 8)}...
                              </Link>
                            </td>
                            <td className="px-2 py-2">
                              <Link 
                                to={createPageUrl('AddressLookup') + `?address=${tx.to}`}
                                className="text-emerald-400 hover:underline font-mono text-xs"
                              >
                                {tx.to.substring(0, 8)}...
                              </Link>
                            </td>
                            <td className="px-2 py-2 text-right text-gray-400 text-xs">
                              {formatTime(tx.blockTime)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
