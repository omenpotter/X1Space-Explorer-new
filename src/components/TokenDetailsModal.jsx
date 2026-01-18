import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  X, Copy, Check, Clock, Globe, Twitter, TrendingUp, 
  TrendingDown, AlertCircle, Shield, Users, Activity, Info
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  PieChart, Pie, Cell, ResponsiveContainer, XAxis, 
  YAxis, Tooltip 
} from 'recharts';

export default function TokenDetailsModal({
  token,
  tokenDetails,
  tokenHolders,
  loadingDetails,
  onClose,
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
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  if (!token) return null;

  const tokenData = allTokens?.find(t => t.mint === token.mint) || token;
  const details = tokenDetails || tokenData;

  // Calculate AI Health Score locally (no API call)
  useEffect(() => {
    if (!details) return;

    const calculateHealthScore = () => {
      let score = 100;
      const risks = [];
      const positives = [];

      // Check Mint Authority
      if (details.mintAuthority && details.mintAuthority !== 'None') {
        score -= 20;
        risks.push('Token can still be minted - supply not fixed');
      } else {
        positives.push('Fixed supply - no more tokens can be minted');
      }

      // Check Freeze Authority
      if (details.freezeAuthority && details.freezeAuthority !== 'None') {
        score -= 15;
        risks.push('Freeze authority enabled - accounts can be frozen');
      } else {
        positives.push('Freeze disabled - accounts cannot be frozen');
      }

      // Check holder distribution
      if (tokenHolders && tokenHolders.length > 0) {
        const topHolderPercent = parseFloat(tokenHolders[0]?.percentage || 0);
        if (topHolderPercent > 50) {
          score -= 25;
          risks.push(`Top holder owns ${topHolderPercent}% - high centralization risk`);
        } else if (topHolderPercent > 25) {
          score -= 10;
          risks.push(`Top holder owns ${topHolderPercent}% - moderate concentration`);
        } else {
          positives.push('Good token distribution - no single dominant holder');
        }
      }

      // Check if verified
      if (tokenData.verified) {
        positives.push('Community verified token');
      } else {
        score -= 10;
        risks.push('Token not yet verified by community');
      }

      // Check age (if available)
      if (details.createdAt) {
        const ageInDays = (Date.now() / 1000 - details.createdAt) / 86400;
        if (ageInDays < 7) {
          score -= 15;
          risks.push('Token is very new (< 7 days old)');
        } else if (ageInDays > 30) {
          positives.push(`Token has been active for ${Math.floor(ageInDays)} days`);
        }
      }

      score = Math.max(0, Math.min(100, score));

      setAiAnalysis({
        score,
        risks,
        positives,
        supplyAnalysis: details.mintAuthority === 'None' ? 
          'Fixed supply provides price stability and prevents dilution' : 
          'Mintable supply could lead to inflation',
        distributionAnalysis: tokenHolders && tokenHolders.length > 0 ?
          `Token distributed among ${tokenHolders.length} holders` :
          'Holder information not available',
        authorityAnalysis: `Mint: ${details.mintAuthority === 'None' ? 'Disabled ✓' : 'Enabled ⚠'}, Freeze: ${details.freezeAuthority === 'None' ? 'Disabled ✓' : 'Enabled ⚠'}`,
        recommendation: score >= 80 ? 'Strong fundamentals - Low risk' :
                       score >= 60 ? 'Moderate risk - DYOR recommended' :
                       score >= 40 ? 'High risk - Exercise caution' :
                       'Very high risk - Not recommended'
      });
    };

    calculateHealthScore();
  }, [details, tokenHolders, tokenData]);

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
                      <div className="relative group">
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-0 cursor-help">
                          ✓ Verified
                        </Badge>
                        <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-[#1d2d3a] border border-emerald-500/30 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          <p className="text-emerald-400 font-medium text-xs mb-1">Community Verified</p>
                          <p className="text-gray-300 text-xs">
                            This token has been verified by the X1Space community. 
                            Verification count: {tokenData.verificationCount || 1}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Price Info */}
                  <div className="flex items-center gap-4 flex-wrap">
                    {tokenData?.price && parseFloat(tokenData.price) > 0 ? (
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
                        Price data unavailable - Trade on XDEX or X1.Ninja
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
                    {tokenData.website && (
                      <a
                        href={tokenData.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-[#24384a] rounded-lg hover:bg-[#2a4055] transition-colors"
                      >
                        <Globe className="w-4 h-4 text-cyan-400" />
                        <span className="text-white text-sm">Website</span>
                      </a>
                    )}
                    {tokenData.twitter && (
                      <a
                        href={tokenData.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-[#24384a] rounded-lg hover:bg-[#2a4055] transition-colors"
                      >
                        <Twitter className="w-4 h-4 text-cyan-400" />
                        <span className="text-white text-sm">Twitter</span>
                      </a>
                    )}
                    <a
                      href={`https://app.xdex.xyz/swap?inputMint=XNTgPNZTY9XHCT79JBmSJy7ZLdYvNgmNspGSUT8sFMF&outputMint=${token.mint}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 rounded-lg hover:bg-cyan-500/30 transition-colors"
                    >
                      <Activity className="w-4 h-4 text-cyan-400" />
                      <span className="text-cyan-400 text-sm font-medium">Trade on XDEX</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Price Chart - Only show if history exists */}
              {tokenData?.priceHistory?.length > 0 && (
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
                      const history = tokenData.priceHistory || [];
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
                  <p className="text-gray-400 text-xs mb-1">Total Supply</p>
                  <p className="text-white font-mono text-sm font-bold">
                    {formatNum(details?.totalSupply || tokenData.totalSupply || 0)}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">{tokenData.symbol || 'tokens'}</p>
                </div>

                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Decimals</p>
                  <p className="text-white font-mono">{details?.decimals || tokenData.decimals || 0}</p>
                </div>

                <div className="bg-[#1d2d3a] rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-1">Token Standard</p>
                  <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">
                    {details?.tokenType || tokenData.tokenType || 'SPL Token'}
                  </Badge>
                </div>

                {/* Mint Authority with Clear Explanation */}
                <div className="bg-[#1d2d3a] rounded-lg p-3 col-span-2">
                  <p className="text-gray-400 text-xs mb-2">Mint Authority</p>
                  {(!details?.mintAuthority || details.mintAuthority === 'None') ? (
                    <div>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-0 mb-2">
                        <Shield className="w-3 h-3 mr-1" />
                        Fixed Supply (Mint Disabled)
                      </Badge>
                      <p className="text-xs text-gray-300">
                        ✓ No more tokens can be minted - supply is permanently fixed
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-0 mb-2">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Mintable
                      </Badge>
                      <p className="text-white font-mono text-xs break-all mb-1">{details.mintAuthority}</p>
                      <p className="text-xs text-yellow-300">
                        ⚠️ Warning: More tokens can be minted by this authority, potentially diluting value
                      </p>
                    </div>
                  )}
                </div>

                {/* Freeze Authority with Clear Explanation */}
                <div className="bg-[#1d2d3a] rounded-lg p-3 col-span-2">
                  <p className="text-gray-400 text-xs mb-2">Freeze Authority</p>
                  {(!details?.freezeAuthority || details.freezeAuthority === 'None') ? (
                    <div>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-0 mb-2">
                        <Shield className="w-3 h-3 mr-1" />
                        Freeze Disabled
                      </Badge>
                      <p className="text-xs text-gray-300">
                        ✓ Token accounts cannot be frozen - full user control
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Badge className="bg-red-500/20 text-red-400 border-0 mb-2">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Freezable
                      </Badge>
                      <p className="text-white font-mono text-xs break-all mb-1">{details.freezeAuthority}</p>
                      <p className="text-xs text-red-300">
                        ⚠️ Warning: This authority can freeze token accounts, preventing transfers
                      </p>
                    </div>
                  )}
                </div>

                {details?.createdAt && (
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Created</p>
                    <p className="text-white text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(details.createdAt)}
                    </p>
                  </div>
                )}

                {details?.createdBy && (
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Creator</p>
                    <Link 
                      to={createPageUrl('AddressLookup') + `?address=${details.createdBy}`}
                      className="text-cyan-400 hover:underline font-mono text-xs truncate block"
                    >
                      {details.createdBy.substring(0, 12)}...
                    </Link>
                  </div>
                )}
              </div>

              {/* AI Health Score - LOCAL CALCULATION */}
              {aiAnalysis && (
                <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-white font-medium text-lg flex items-center gap-2">
                      <Activity className="w-5 h-5 text-purple-400" />
                      AI Health Analysis
                    </h4>
                    <div className={`text-4xl font-bold ${
                      aiAnalysis.score >= 80 ? 'text-emerald-400' :
                      aiAnalysis.score >= 60 ? 'text-yellow-400' :
                      aiAnalysis.score >= 40 ? 'text-orange-400' : 'text-red-400'
                    }`}>
                      {aiAnalysis.score}/100
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Positive Factors */}
                    {aiAnalysis.positives.length > 0 && (
                      <div className="bg-[#1d2d3a] rounded-lg p-4">
                        <p className="text-emerald-400 font-medium text-sm mb-3">✓ Positive Factors</p>
                        <ul className="space-y-2">
                          {aiAnalysis.positives.map((positive, i) => (
                            <li key={i} className="text-gray-300 text-xs flex items-start gap-2">
                              <span className="text-emerald-400 mt-0.5">•</span>
                              <span>{positive}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Risk Factors */}
                    {aiAnalysis.risks.length > 0 && (
                      <div className="bg-[#1d2d3a] rounded-lg p-4">
                        <p className="text-red-400 font-medium text-sm mb-3">⚠ Risk Factors</p>
                        <ul className="space-y-2">
                          {aiAnalysis.risks.map((risk, i) => (
                            <li key={i} className="text-gray-300 text-xs flex items-start gap-2">
                              <span className="text-red-400 mt-0.5">•</span>
                              <span>{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="bg-[#1d2d3a] rounded-lg p-3">
                      <p className="text-cyan-400 text-xs font-medium mb-1">Supply Analysis</p>
                      <p className="text-gray-300 text-xs">{aiAnalysis.supplyAnalysis}</p>
                    </div>
                    <div className="bg-[#1d2d3a] rounded-lg p-3">
                      <p className="text-cyan-400 text-xs font-medium mb-1">Distribution Analysis</p>
                      <p className="text-gray-300 text-xs">{aiAnalysis.distributionAnalysis}</p>
                    </div>
                    <div className="bg-[#1d2d3a] rounded-lg p-3">
                      <p className="text-cyan-400 text-xs font-medium mb-1">Authority Status</p>
                      <p className="text-gray-300 text-xs">{aiAnalysis.authorityAnalysis}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-purple-400 font-medium text-sm mb-1">Recommendation</p>
                    <p className="text-white text-sm font-medium">{aiAnalysis.recommendation}</p>
                  </div>
                </div>
              )}

              {/* Top Holders */}
              {tokenHolders && tokenHolders.length > 0 ? (
                <div className="bg-[#1d2d3a] rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-white font-medium flex items-center gap-2">
                      <Users className="w-5 h-5 text-cyan-400" />
                      Top Token Holders
                    </h4>
                    <Badge className="bg-cyan-500/20 text-cyan-400 border-0">
                      Showing {Math.min(tokenHolders.length, 50)} of {tokenHolders.length} total holders
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
              ) : (
                <div className="bg-[#1d2d3a] rounded-lg p-6 mb-6 text-center">
                  <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">
                    No holder data available for this token yet
                  </p>
                </div>
              )}

              {/* Holder Distribution Chart - Only show if data exists */}
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

              {/* Transaction Flow - Only show if data exists */}
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

              {/* Recent Transactions - Only show if data exists */}
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
