import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ExternalLink, Copy, Check, AlertTriangle, Shield, Lock, Unlock } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function TokenDetailsModal({ token, tokenDetails, tokenHolders, onClose, fetchTokenPrice }) {
  const [copiedAddress, setCopiedAddress] = useState(null);
  const [priceData, setPriceData] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);

  useEffect(() => {
    if (token && fetchTokenPrice) {
      loadPriceData();
    }
    if (token && tokenDetails) {
      generateAIAnalysis();
    }
  }, [token]);

  const loadPriceData = async () => {
    setPriceLoading(true);
    try {
      const price = await fetchTokenPrice(token.mint);
      setPriceData(price);
    } catch (err) {
      console.error('Failed to fetch price:', err);
    } finally {
      setPriceLoading(false);
    }
  };

  const generateAIAnalysis = () => {
    const analysis = {
      score: 0,
      factors: [],
      risks: [],
      strengths: []
    };

    // Mint Authority Analysis
    if (!tokenDetails.mintAuthority || tokenDetails.mintAuthority === 'None') {
      analysis.score += 25;
      analysis.strengths.push({
        title: 'Fixed Supply',
        description: 'No mint authority means no more tokens can be created. This prevents inflation and protects holder value.'
      });
    } else {
      analysis.risks.push({
        title: 'Mintable Supply',
        description: 'Tokens can still be minted by the mint authority. This could dilute existing holders.'
      });
    }

    // Freeze Authority Analysis
    if (!tokenDetails.freezeAuthority || tokenDetails.freezeAuthority === 'None') {
      analysis.score += 25;
      analysis.strengths.push({
        title: 'Cannot Be Frozen',
        description: 'No freeze authority means token accounts cannot be frozen. Holders have full control.'
      });
    } else {
      analysis.risks.push({
        title: 'Freezable Accounts',
        description: 'Token accounts can be frozen by the freeze authority. This could lock user funds.'
      });
    }

    // Holder Distribution
    if (tokenHolders && tokenHolders.length > 0) {
      const top10Percentage = tokenHolders.slice(0, 10).reduce((sum, h) => sum + (h.percentage || 0), 0);
      
      if (top10Percentage < 50) {
        analysis.score += 25;
        analysis.strengths.push({
          title: 'Well Distributed',
          description: `Top 10 holders own ${top10Percentage.toFixed(1)}% of supply. Good distribution reduces manipulation risk.`
        });
      } else if (top10Percentage > 80) {
        analysis.risks.push({
          title: 'Concentrated Ownership',
          description: `Top 10 holders own ${top10Percentage.toFixed(1)}% of supply. High concentration increases manipulation risk.`
        });
      } else {
        analysis.score += 15;
        analysis.factors.push({
          title: 'Moderate Distribution',
          description: `Top 10 holders own ${top10Percentage.toFixed(1)}% of supply.`
        });
      }

      analysis.score += 15;
      analysis.factors.push({
        title: `${tokenHolders.length} Token Holders`,
        description: `Total number of addresses holding this token.`
      });
    }

    // Metadata Quality
    if (token.website || token.twitter || token.description) {
      analysis.score += 10;
      analysis.strengths.push({
        title: 'Has Metadata',
        description: 'Token has website, social links, or description indicating active project.'
      });
    }

    setAiAnalysis(analysis);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedAddress(text);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const formatAuthority = (authority, type) => {
    if (!authority || authority === 'None') {
      return type === 'mint' 
        ? { label: 'Fixed Supply (Mint Disabled)', color: 'emerald', icon: Shield, desc: 'No more tokens can be minted' }
        : { label: 'Freeze Disabled', color: 'emerald', icon: Unlock, desc: 'Token accounts cannot be frozen' };
    }
    return type === 'mint'
      ? { label: 'Mintable Supply', color: 'yellow', icon: AlertTriangle, desc: 'More tokens can be minted' }
      : { label: 'Freezable', color: 'yellow', icon: Lock, desc: 'Accounts can be frozen' };
  };

  const mintInfo = formatAuthority(tokenDetails?.mintAuthority, 'mint');
  const freezeInfo = formatAuthority(tokenDetails?.freezeAuthority, 'freeze');

  const holderChartData = tokenHolders?.slice(0, 10).map((h, i) => ({
    name: `#${i + 1}`,
    value: h.percentage || 0
  })) || [];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#1d2d3a] rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#24384a] p-6 border-b border-white/10 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            {token.logo && (
              <img src={token.logo} alt={token.symbol} className="w-12 h-12 rounded-full" />
            )}
            <div>
              <h2 className="text-2xl font-bold text-white">{token.name}</h2>
              <p className="text-gray-400">{token.symbol}</p>
            </div>
            {token.verified && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-0">✓ Verified</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Price Chart */}
          {priceData && priceData.history && priceData.history.length > 0 && (
            <div className="bg-[#24384a] rounded-lg p-4">
              <h3 className="text-white font-medium mb-4">Price Chart (7D)</h3>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceData.history}>
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
                    />
                    <Line type="monotone" dataKey="price" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* AI Health Analysis */}
          {aiAnalysis && (
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg">AI Health Analysis</h3>
                <div className="text-right">
                  <div className="text-3xl font-bold text-cyan-400">{aiAnalysis.score}/100</div>
                  <p className="text-xs text-gray-400">Health Score</p>
                </div>
              </div>

              {/* Strengths */}
              {aiAnalysis.strengths.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-emerald-400 font-medium mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Strengths
                  </h4>
                  <div className="space-y-2">
                    {aiAnalysis.strengths.map((item, i) => (
                      <div key={i} className="bg-emerald-500/10 border border-emerald-500/20 rounded p-3">
                        <p className="text-white font-medium text-sm">{item.title}</p>
                        <p className="text-gray-400 text-xs mt-1">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risks */}
              {aiAnalysis.risks.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-yellow-400 font-medium mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Risk Factors
                  </h4>
                  <div className="space-y-2">
                    {aiAnalysis.risks.map((item, i) => (
                      <div key={i} className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3">
                        <p className="text-white font-medium text-sm">{item.title}</p>
                        <p className="text-gray-400 text-xs mt-1">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Factors */}
              {aiAnalysis.factors.length > 0 && (
                <div>
                  <h4 className="text-cyan-400 font-medium mb-2">Additional Factors</h4>
                  <div className="space-y-2">
                    {aiAnalysis.factors.map((item, i) => (
                      <div key={i} className="bg-cyan-500/10 border border-cyan-500/20 rounded p-3">
                        <p className="text-white font-medium text-sm">{item.title}</p>
                        <p className="text-gray-400 text-xs mt-1">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Token Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#24384a] rounded-lg p-4">
              <p className="text-gray-400 text-xs mb-1">Total Supply</p>
              <p className="text-white font-bold">{(tokenDetails?.supply || 0).toLocaleString()}</p>
            </div>
            <div className="bg-[#24384a] rounded-lg p-4">
              <p className="text-gray-400 text-xs mb-1">Decimals</p>
              <p className="text-white font-bold">{tokenDetails?.decimals || 9}</p>
            </div>
            <div className="bg-[#24384a] rounded-lg p-4">
              <p className="text-gray-400 text-xs mb-1">Total Holders</p>
              <p className="text-white font-bold">{tokenHolders?.length || 0}</p>
            </div>
            <div className="bg-[#24384a] rounded-lg p-4">
              <p className="text-gray-400 text-xs mb-1">Type</p>
              <Badge className="bg-blue-500/20 text-blue-400 border-0">{token.tokenType}</Badge>
            </div>
          </div>

          {/* Authority Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mint Authority */}
            <div className="bg-[#24384a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <mintInfo.icon className={`w-5 h-5 text-${mintInfo.color}-400`} />
                <h4 className="text-white font-medium">Mint Authority</h4>
              </div>
              <Badge className={`bg-${mintInfo.color}-500/20 text-${mintInfo.color}-400 border-0 mb-2`}>
                {mintInfo.label}
              </Badge>
              <p className="text-gray-400 text-sm mb-2">{mintInfo.desc}</p>
              {tokenDetails?.mintAuthority && tokenDetails.mintAuthority !== 'None' && (
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs text-cyan-400 font-mono bg-black/30 px-2 py-1 rounded flex-1 truncate">
                    {tokenDetails.mintAuthority}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(tokenDetails.mintAuthority)}
                    className="p-1 h-auto"
                  >
                    {copiedAddress === tokenDetails.mintAuthority ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Freeze Authority */}
            <div className="bg-[#24384a] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <freezeInfo.icon className={`w-5 h-5 text-${freezeInfo.color}-400`} />
                <h4 className="text-white font-medium">Freeze Authority</h4>
              </div>
              <Badge className={`bg-${freezeInfo.color}-500/20 text-${freezeInfo.color}-400 border-0 mb-2`}>
                {freezeInfo.label}
              </Badge>
              <p className="text-gray-400 text-sm mb-2">{freezeInfo.desc}</p>
              {tokenDetails?.freezeAuthority && tokenDetails.freezeAuthority !== 'None' && (
                <div className="flex items-center gap-2 mt-2">
                  <code className="text-xs text-cyan-400 font-mono bg-black/30 px-2 py-1 rounded flex-1 truncate">
                    {tokenDetails.freezeAuthority}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(tokenDetails.freezeAuthority)}
                    className="p-1 h-auto"
                  >
                    {copiedAddress === tokenDetails.freezeAuthority ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Holder Distribution */}
          {holderChartData.length > 0 && (
            <div className="bg-[#24384a] rounded-lg p-4">
              <h3 className="text-white font-medium mb-4">Top 10 Holder Distribution</h3>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={holderChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {holderChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(${(index * 360) / holderChartData.length}, 70%, 50%)`} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top 50 Holders Table */}
          <div className="bg-[#24384a] rounded-lg p-4">
            <h3 className="text-white font-medium mb-4">Top 50 Token Holders</h3>
            {tokenHolders && tokenHolders.length > 0 ? (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-[#24384a]">
                    <tr className="border-b border-white/10">
                      <th className="text-left text-gray-400 text-xs px-3 py-2">#</th>
                      <th className="text-left text-gray-400 text-xs px-3 py-2">Address</th>
                      <th className="text-right text-gray-400 text-xs px-3 py-2">Balance</th>
                      <th className="text-right text-gray-400 text-xs px-3 py-2">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokenHolders.slice(0, 50).map((holder, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2">
                          <Link 
                            to={createPageUrl('AddressLookup') + `?address=${holder.address}`} 
                            className="text-cyan-400 hover:underline font-mono text-xs flex items-center gap-2"
                          >
                            {holder.address.substring(0, 16)}...{holder.address.slice(-8)}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right text-white font-mono text-sm">
                          {holder.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Badge className="bg-purple-500/20 text-purple-400 border-0">
                            {holder.percentage.toFixed(2)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No holder data available</p>
            )}
          </div>

          {/* Links */}
          {(token.website || token.twitter) && (
            <div className="flex gap-3">
              {token.website && (
                
                  href={token.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[#24384a] rounded-lg hover:bg-[#2a4055] transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-cyan-400" />
                  <span className="text-white text-sm">Website</span>
                </a>
              )}
              {token.twitter && (
                
                  href={token.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[#24384a] rounded-lg hover:bg-[#2a4055] transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-cyan-400" />
                  <span className="text-white text-sm">Twitter</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
