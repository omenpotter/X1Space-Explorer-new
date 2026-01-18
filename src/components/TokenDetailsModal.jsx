import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  X, Copy, Check, Clock, Globe, Twitter, TrendingUp, 
  TrendingDown, AlertCircle, Shield, Users, Activity, 
  ExternalLink, Search
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { 
  AreaChart, Area, BarChart, Bar, 
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
  const [actualHolders, setActualHolders] = useState([]);
  const [loadingHolders, setLoadingHolders] = useState(false);

  if (!token) return null;

  const tokenData = allTokens?.find(t => t.mint === token.mint) || token;
  const details = tokenDetails || tokenData;

  // Fetch actual token holders from RPC
  useEffect(() => {
    const fetchHolders = async () => {
      if (!token?.mint) return;
      
      setLoadingHolders(true);
      try {
        // Import X1 RPC service
        const X1Rpc = (await import('../components/x1/X1RpcService')).default;
        
        // Get largest accounts for this token
        const response = await X1Rpc.connection.getTokenLargestAccounts(
          new (await import('@solana/web3.js')).PublicKey(token.mint)
        );
        
        if (response?.value) {
          const totalSupply = details?.totalSupply || tokenData.totalSupply || 1;
          
          const holders = response.value.map((holder, index) => ({
            address: holder.address.toBase58(),
            amount: holder.uiAmount || 0,
            percentage: ((holder.uiAmount || 0) / totalSupply * 100).toFixed(2)
          }));
          
          setActualHolders(holders);
        }
      } catch (error) {
        console.error('Error fetching holders:', error);
        setActualHolders([]);
      } finally {
        setLoadingHolders(false);
      }
    };

    fetchHolders();
  }, [token?.mint, details?.totalSupply, tokenData.totalSupply]);

  // Calculate AI Health Score locally
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
      if (actualHolders.length > 0) {
        const topHolderPercent = parseFloat(actualHolders[0]?.percentage || 0);
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
        positives.push('AI-verified token based on on-chain data');
      } else {
        score -= 10;
        risks.push('Token not yet AI-verified - perform your own research (DYOR)');
      }

      // Check age
      if (details.createdAt) {
        const ageInDays = (Date.now() / 1000 - details.createdAt) / 86400;
        if (ageInDays < 7) {
          score -= 15;
          risks.push('Token is very new (< 7 days old) - higher risk');
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
          'Mintable supply could lead to inflation and value dilution',
        distributionAnalysis: actualHolders.length > 0 ?
          `Token distributed among ${actualHolders.length} holders` :
          'Holder information loading...',
        authorityAnalysis: `Mint: ${details.mintAuthority === 'None' ? 'Disabled ✓' : 'Enabled ⚠'}, Freeze: ${details.freezeAuthority === 'None' ? 'Disabled ✓' : 'Enabled ⚠'}`,
        recommendation: score >= 80 ? 'Strong fundamentals - Low risk (Always DYOR)' :
                       score >= 60 ? 'Moderate risk - DYOR highly recommended' :
                       score >= 40 ? 'High risk - Exercise extreme caution & DYOR' :
                       'Very high risk - Not recommended without thorough DYOR'
      });
    };

    calculateHealthScore();
  }, [details, actualHolders, tokenData]);

  return (
    <div className="bg-[#24384a] rounded-xl p-6 mb-6">
      {/* Close Button */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium text-lg">Token Details</h3>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {loadingDetails ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
        </div>
      ) : (
        <>
          {/* Token Header */}
          <div className="flex items-start gap-4 mb-6 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg p-4">
            {/* Token Logo */}
            {(tokenMetadata?.image || tokenData?.logo || details?.logo_uri) ? (
              <img 
                src={tokenMetadata?.image || tokenData?.logo || details?.logo_uri} 
                alt={tokenData?.name} 
                className="w-16 h-16 rounded-full border-2 border-cyan-500/50"
                onError={(e) => {
                  console.log('Image failed to load:', e.target.src);
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl">
                {tokenData?.symbol?.substring(0, 2) || '??'}
              </div>
            )}
            
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h2 className="text-xl font-bold text-white">
                  {tokenMetadata?.name || tokenData?.name || 'Unknown Token'}
                </h2>
                <Badge className="bg-blue-500/20 text-blue-400 border-0">
                  {tokenData?.symbol || 'UNKNOWN'}
                </Badge>
                {tokenData?.verified && (
                  <div className="relative group">
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-0 cursor-help">
                      ✓ AI Verified
                    </Badge>
                    <div className="absolute left-0 top-full mt-2 w-72 p-3 bg-[#1d2d3a] border border-emerald-500/30 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <p className="text-emerald-400 font-medium text-xs mb-2">AI-Verified Token</p>
                      <p className="text-gray-300 text-xs mb-2">
                        This token has been automatically verified by AI analysis of on-chain data including:
                      </p>
                      <ul className="text-gray-300 text-xs space-y-1 mb-2">
                        <li>• Token metadata validation</li>
                        <li>• Authority configurations</li>
                        <li>• Supply mechanics</li>
                        <li>• Holder distribution</li>
                      </ul>
                      <p className="text-yellow-400 text-xs font-medium">
                        ⚠️ Always DYOR (Do Your Own Research) before trading
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Price & Trade Buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                {tokenData?.price && parseFloat(tokenData.price) > 0 ? (
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-2xl font-bold text-white">
                        ${tokenData.price}
                      </p>
                    </div>
                    {tokenData?.priceChange24h && (
                      <div className={`flex items-center gap-1 ${
                        parseFloat(tokenData.priceChange24h) >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {parseFloat(tokenData.priceChange24h) >= 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        <span className="text-lg font-bold">
                          {parseFloat(tokenData.priceChange24h) >= 0 ? '+' : ''}
                          {tokenData.priceChange24h}%
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-400 text-sm">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    Price unavailable - Check XDEX or X1.Ninja
                  </div>
                )}
                
                {/* Trade on XDEX Button */}
                <a
                  href={`https://app.xdex.xyz/swap?inputMint=XNTgPNZTY9XHCT79JBmSJy7ZLdYvNgmNspGSUT8sFMF&outputMint=${token.mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors"
                >
                  <Activity className="w-4 h-4 text-white" />
                  <span className="text-white text-sm font-medium">Trade on XDEX</span>
                  <ExternalLink className="w-3 h-3 text-white" />
                </a>
                
                {/* View on X1.Ninja */}
                <a
                  href={`https://x1.ninja/token/${token.mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg transition-colors border border-purple-500/30"
                >
                  <Search className="w-4 h-4 text-purple-400" />
                  <span className="text-purple-400 text-sm font-medium">View on X1.Ninja</span>
                  <ExternalLink className="w-3 h-3 text-purple-400" />
                </a>
              </div>

              {/* Links */}
              {(tokenData.website || tokenData.twitter) && (
                <div className="flex items-center gap-3 mt-3">
                  {tokenData.website && (
                    <a
                      href={tokenData.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 bg-[#1d2d3a] rounded-lg hover:bg-[#24384a] transition-colors text-sm"
                    >
                      <Globe className="w-3 h-3 text-cyan-400" />
                      <span className="text-white">Website</span>
                    </a>
                  )}
                  {tokenData.twitter && (
                    <a
                      href={tokenData.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-1.5 bg-[#1d2d3a] rounded-lg hover:bg-[#24384a] transition-colors text-sm"
                    >
                      <Twitter className="w-3 h-3 text-cyan-400" />
                      <span className="text-white">Twitter</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

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

            <div className="bg-[#1d2d3a] rounded-lg p-3 border-2 border-cyan-500/30">
              <p className="text-gray-400 text-xs mb-1">Total Supply</p>
              <p className="text-white font-mono text-lg font-bold">
                {formatNum(details?.totalSupply || tokenData.totalSupply || 0)}
              </p>
              <p className="text-gray-400 text-xs mt-1">{tokenData.symbol || 'tokens'}</p>
            </div>

            <div className="bg-[#1d2d3a] rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Decimals</p>
              <p className="text-white font-mono text-lg">{details?.decimals || tokenData.decimals || 0}</p>
            </div>

            <div className="bg-[#1d2d3a] rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Token Standard</p>
              <Badge className="bg-blue-500/20 text-blue-400 border-0">
                {details?.tokenType || tokenData.tokenType || 'SPL Token'}
              </Badge>
            </div>

            {/* Mint Authority */}
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
                    ⚠️ Warning: More tokens can be minted, potentially diluting value
                  </p>
                </div>
              )}
            </div>

            {/* Freeze Authority */}
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
                    ⚠️ Warning: Accounts can be frozen, preventing transfers
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* AI Health Score */}
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

              <div className="grid md:grid-cols-2 gap-4 mb-4">
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

              <div className="space-y-3">
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

          {/* Top 50 Holders */}
          <div className="bg-[#1d2d3a] rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-medium flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                Top Token Holders
              </h4>
              {actualHolders.length > 0 && (
                <Badge className="bg-cyan-500/20 text-cyan-400 border-0">
                  Showing {Math.min(actualHolders.length, 50)} of {actualHolders.length} holders
                </Badge>
              )}
            </div>
            
            {loadingHolders ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
                <p className="text-gray-400 text-sm ml-3">Loading holder data...</p>
              </div>
            ) : actualHolders.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {actualHolders.slice(0, 50).map((holder, i) => (
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
                      <p className="text-white font-mono text-xs font-bold">{formatNum(holder.amount)}</p>
                      <p className="text-gray-500 text-xs">{holder.percentage}% of supply</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">
                  No holder data available. This may be a new token or data is still indexing.
                </p>
              </div>
            )}
          </div>

          {/* Recent Transactions */}
          {tokenTransactions && tokenTransactions.length > 0 && (
            <div className="bg-[#1d2d3a] rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">
                Recent Transactions ({tokenTransactions.length})
              </h4>
              
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
              </div>
              
              <div className="overflow-x-auto max-h-96">
                <table className="w-full">
                  <thead className="sticky top-0 bg-[#1d2d3a]">
                    <tr className="border-b border-white/10">
                      <th className="text-left text-gray-400 text-xs px-2 py-2">Signature</th>
                      <th className="text-left text-gray-400 text-xs px-2 py-2">Type</th>
                      <th className="text-right text-gray-400 text-xs px-2 py-2">Amount</th>
                      <th className="text-right text-gray-400 text-xs px-2 py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions && filteredTransactions.slice(0, 50).map((tx, i) => (
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
  );
}
