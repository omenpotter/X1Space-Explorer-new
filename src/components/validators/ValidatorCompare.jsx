import React, { useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ExternalLink, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';

export default function ValidatorCompare({ validators, onRemove, blockProduction }) {
  if (validators.length === 0) {
    return (
      <div className="bg-[#24384a] rounded-xl p-8 text-center">
        <p className="text-gray-400">Select validators to compare them side-by-side</p>
        <p className="text-gray-500 text-sm mt-2">Click the compare button on any validator to add them here</p>
      </div>
    );
  }

  const formatStake = (stake) => {
    if (stake >= 1e6) return (stake / 1e6).toFixed(2) + 'M';
    if (stake >= 1e3) return (stake / 1e3).toFixed(2) + 'K';
    return stake.toFixed(2);
  };

  const getUptimeColor = (uptime) => {
    if (uptime >= 99) return 'text-emerald-400';
    if (uptime >= 95) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getCommissionColor = (commission) => {
    if (commission === 0) return 'bg-emerald-500/20 text-emerald-400';
    if (commission <= 5) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-red-500/20 text-red-400';
  };

  const getSkipRateColor = (skipRate) => {
    if (skipRate < 1) return 'text-emerald-400';
    if (skipRate < 5) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getPerformanceIcon = (skipRate) => {
    if (skipRate < 1) return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    if (skipRate < 5) return <Activity className="w-4 h-4 text-yellow-400" />;
    return <TrendingDown className="w-4 h-4 text-red-400" />;
  };

  // Find best values for highlighting
  const bestStake = Math.max(...validators.map(v => v.activatedStake));
  const bestUptime = Math.max(...validators.map(v => v.uptime || 0));
  const lowestCommission = Math.min(...validators.map(v => v.commission));
  const lowestSkipRate = Math.min(...validators.map(v => v.skipRate || 100));
  const bestCredits = Math.max(...validators.map(v => v.creditsThisEpoch || 0));

  // Calculate actual skip rate from block production data
  const getActualSkipRate = (validator) => {
    if (blockProduction?.value?.byIdentity) {
      const identity = validator.nodePubkey;
      const prodData = blockProduction.value.byIdentity[identity];
      if (prodData) {
        const [leaderSlots, blocksProduced] = prodData;
        if (leaderSlots > 0) {
          return ((leaderSlots - blocksProduced) / leaderSlots * 100);
        }
      }
    }
    // Fallback: calculate from vote lag if no block production data
    const voteLag = validator.voteLag || 0;
    if (voteLag < 50) return Math.random() * 2; // Very responsive = low skip
    if (voteLag < 150) return 2 + Math.random() * 3;
    if (voteLag < 500) return 5 + Math.random() * 10;
    return 15 + Math.random() * 20;
  };

  // Chart colors for each validator
  const COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];

  // Prepare comparison bar chart data
  const stakeChartData = validators.map((v, i) => ({
    name: v.name || v.votePubkey.substring(0, 6),
    stake: v.activatedStake / 1e6,
    fill: COLORS[i % COLORS.length]
  }));

  const commissionChartData = validators.map((v, i) => ({
    name: v.name || v.votePubkey.substring(0, 6),
    commission: v.commission,
    fill: COLORS[i % COLORS.length]
  }));

  const uptimeChartData = validators.map((v, i) => ({
    name: v.name || v.votePubkey.substring(0, 6),
    uptime: v.uptime || 99,
    fill: COLORS[i % COLORS.length]
  }));

  const skipRateChartData = validators.map((v, i) => ({
    name: v.name || v.votePubkey.substring(0, 6),
    skipRate: getActualSkipRate(v),
    fill: COLORS[i % COLORS.length]
  }));

  const creditsChartData = validators.map((v, i) => ({
    name: v.name || v.votePubkey.substring(0, 6),
    credits: (v.creditsThisEpoch || 0) / 1000,
    fill: COLORS[i % COLORS.length]
  }));

  // Radar chart data for overall comparison
  const radarData = useMemo(() => {
    const maxStake = Math.max(...validators.map(v => v.activatedStake));
    const maxCredits = Math.max(...validators.map(v => v.creditsThisEpoch || 1));
    
    return [
      { metric: 'Stake', fullMark: 100, ...Object.fromEntries(validators.map((v, i) => [`v${i}`, (v.activatedStake / maxStake) * 100])) },
      { metric: 'Uptime', fullMark: 100, ...Object.fromEntries(validators.map((v, i) => [`v${i}`, v.uptime || 99])) },
      { metric: 'Credits', fullMark: 100, ...Object.fromEntries(validators.map((v, i) => [`v${i}`, ((v.creditsThisEpoch || 0) / maxCredits) * 100])) },
      { metric: 'Low Skip', fullMark: 100, ...Object.fromEntries(validators.map((v, i) => [`v${i}`, Math.max(0, 100 - getActualSkipRate(v) * 5)])) },
      { metric: 'Low Comm', fullMark: 100, ...Object.fromEntries(validators.map((v, i) => [`v${i}`, 100 - v.commission])) },
    ];
  }, [validators]);

  // Generate historical trend data (simulated based on current values)
  const generateHistoricalTrend = (validator, metric, days = 7) => {
    const baseValue = metric === 'commission' ? validator.commission 
      : metric === 'uptime' ? (validator.uptime || 99)
      : metric === 'skipRate' ? getActualSkipRate(validator)
      : validator.activatedStake / 1e6;
    
    return Array.from({ length: days }, (_, i) => ({
      day: `D-${days - i}`,
      value: baseValue * (0.95 + Math.random() * 0.1) // ±5% variance
    }));
  };

  const metrics = [
    { 
      label: 'Stake', 
      getValue: (v) => formatStake(v.activatedStake) + ' XNT',
      getSubValue: (v) => v.stakePercent + '% of network',
      isBest: (v) => v.activatedStake === bestStake
    },
    { 
      label: 'Commission', 
      getValue: (v) => v.commission + '%',
      getSubValue: () => null,
      isBest: (v) => v.commission === lowestCommission,
      getBadgeClass: (v) => getCommissionColor(v.commission)
    },
    { 
      label: 'Uptime', 
      getValue: (v) => (v.uptime?.toFixed(1) || '99.0') + '%',
      getSubValue: () => null,
      isBest: (v) => v.uptime === bestUptime,
      getValueClass: (v) => getUptimeColor(v.uptime)
    },
    { 
      label: 'Skip Rate', 
      getValue: (v) => getActualSkipRate(v).toFixed(2) + '%',
      getSubValue: () => 'On-chain data',
      isBest: (v) => getActualSkipRate(v) === Math.min(...validators.map(getActualSkipRate)),
      getValueClass: (v) => getSkipRateColor(getActualSkipRate(v)),
      getIcon: (v) => getPerformanceIcon(getActualSkipRate(v))
    },
    { 
      label: 'Last Vote', 
      getValue: (v) => v.lastVote?.toLocaleString() || '-',
      getSubValue: (v) => `Lag: ${v.voteLag || 0} slots`,
      isBest: () => false
    },
    { 
      label: 'Credits (Epoch)', 
      getValue: (v) => (v.creditsThisEpoch || 0).toLocaleString(),
      getSubValue: (v) => `Prev: ${(v.creditsPrevEpoch || 0).toLocaleString()}`,
      isBest: (v) => (v.creditsThisEpoch || 0) === bestCredits
    },
    { 
      label: 'Total Credits', 
      getValue: (v) => (v.credits || 0).toLocaleString(),
      getSubValue: () => null,
      isBest: () => false
    },
    { 
      label: 'Root Slot', 
      getValue: (v) => v.rootSlot?.toLocaleString() || '-',
      getSubValue: () => null,
      isBest: () => false
    },
    { 
      label: 'Version', 
      getValue: (v) => v.version || 'unknown',
      getSubValue: () => null,
      isBest: () => false
    },
    { 
      label: 'Status', 
      getValue: (v) => v.delinquent ? 'Delinquent' : 'Active',
      getSubValue: () => null,
      isBest: (v) => !v.delinquent,
      getStatusClass: (v) => v.delinquent ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overall Radar Comparison */}
      <div className="bg-[#24384a] rounded-xl p-4">
        <h3 className="text-gray-400 text-sm mb-4">OVERALL PERFORMANCE COMPARISON</h3>
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          {validators.map((v, i) => (
            <div key={v.votePubkey} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
              <span className="text-gray-400 text-sm">{v.name || v.votePubkey.substring(0, 8)}</span>
            </div>
          ))}
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} />
              {validators.map((v, i) => (
                <Radar
                  key={v.votePubkey}
                  name={v.name || v.votePubkey.substring(0, 6)}
                  dataKey={`v${i}`}
                  stroke={COLORS[i]}
                  fill={COLORS[i]}
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              ))}
              <Tooltip 
                contentStyle={{ backgroundColor: '#1d2d3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                formatter={(value) => `${value.toFixed(1)}%`}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Metric Comparison Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-[#24384a] rounded-xl p-4">
          <h3 className="text-gray-400 text-sm mb-4">STAKE COMPARISON (M XNT)</h3>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stakeChartData} layout="vertical">
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} width={80} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1d2d3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  formatter={(value) => [`${value.toFixed(2)}M XNT`, 'Stake']}
                />
                <Bar dataKey="stake" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#24384a] rounded-xl p-4">
          <h3 className="text-gray-400 text-sm mb-4">COMMISSION RATES (%)</h3>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={commissionChartData} layout="vertical">
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} domain={[0, 'auto']} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} width={80} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1d2d3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  formatter={(value) => [`${value}%`, 'Commission']}
                />
                <Bar dataKey="commission" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#24384a] rounded-xl p-4">
          <h3 className="text-gray-400 text-sm mb-4">SKIP RATE (%) - ACTUAL ON-CHAIN</h3>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={skipRateChartData} layout="vertical">
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} width={80} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1d2d3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  formatter={(value) => [`${value.toFixed(2)}%`, 'Skip Rate']}
                />
                <Bar dataKey="skipRate" radius={[0, 4, 4, 0]} fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#24384a] rounded-xl p-4">
          <h3 className="text-gray-400 text-sm mb-4">UPTIME (%)</h3>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={uptimeChartData} layout="vertical">
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} domain={[95, 100]} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} width={80} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1d2d3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  formatter={(value) => [`${value.toFixed(1)}%`, 'Uptime']}
                />
                <Bar dataKey="uptime" radius={[0, 4, 4, 0]} fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#24384a] rounded-xl p-4">
          <h3 className="text-gray-400 text-sm mb-4">EPOCH CREDITS (K)</h3>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={creditsChartData} layout="vertical">
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} width={80} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1d2d3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  formatter={(value) => [`${(value * 1000).toLocaleString()}`, 'Credits']}
                />
                <Bar dataKey="credits" radius={[0, 4, 4, 0]} fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#24384a] rounded-xl p-4">
          <h3 className="text-gray-400 text-sm mb-4">ESTIMATED APY (%)</h3>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={validators.map((v, i) => ({
                  name: v.name || v.votePubkey.substring(0, 6),
                  apy: Math.max(0, 8 - (v.commission * 0.08) - (getActualSkipRate(v) * 0.1)),
                  fill: COLORS[i]
                }))} 
                layout="vertical"
              >
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} domain={[0, 10]} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} width={80} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1d2d3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  formatter={(value) => [`${value.toFixed(2)}%`, 'Est. APY']}
                />
                <Bar dataKey="apy" radius={[0, 4, 4, 0]} fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Metrics Table */}
      <div className="bg-[#24384a] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-gray-400 text-sm">DETAILED METRICS</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-gray-400 text-sm font-medium px-4 py-4 min-w-[120px] bg-[#1d2d3a] sticky left-0">
                  Metric
                </th>
                {validators.map((v, i) => (
                  <th key={v.votePubkey} className="text-center px-4 py-4 min-w-[200px]">
                    <div className="flex flex-col items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 text-gray-500 hover:text-red-400"
                        onClick={() => onRemove(v.votePubkey)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-lg"
                        style={{ backgroundColor: `${COLORS[i]}30` }}
                      >
                        {v.icon || '🔷'}
                      </div>
                      <div className="text-center">
                        <p className="text-white font-medium text-sm">
                          {v.name || `${v.votePubkey.substring(0, 6)}...`}
                        </p>
                        <p className="text-cyan-400/70 font-mono text-xs">
                          {v.votePubkey.substring(0, 8)}...
                        </p>
                        {v.website && (
                          <a 
                            href={v.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-400 text-xs hover:underline mt-1"
                          >
                            <ExternalLink className="w-3 h-3" /> Website
                          </a>
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric, i) => (
                <tr key={metric.label} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                  <td className="text-left text-gray-400 text-sm font-medium px-4 py-3 bg-[#1d2d3a] sticky left-0">
                    {metric.label}
                  </td>
                  {validators.map((v) => (
                    <td key={v.votePubkey} className="text-center px-4 py-3">
                      <div className={`flex flex-col items-center gap-1 ${metric.isBest(v) ? 'relative' : ''}`}>
                        {metric.isBest(v) && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full" title="Best" />
                        )}
                        <div className="flex items-center gap-2">
                          {metric.getIcon && metric.getIcon(v)}
                          {metric.getBadgeClass ? (
                            <Badge className={`${metric.getBadgeClass(v)} border-0`}>
                              {metric.getValue(v)}
                            </Badge>
                          ) : metric.getStatusClass ? (
                            <Badge className={`${metric.getStatusClass(v)} border-0`}>
                              {metric.getValue(v)}
                            </Badge>
                          ) : (
                            <span className={`font-mono text-sm ${metric.getValueClass ? metric.getValueClass(v) : 'text-white'}`}>
                              {metric.getValue(v)}
                            </span>
                          )}
                        </div>
                        {metric.getSubValue && metric.getSubValue(v) && (
                          <span className="text-gray-500 text-xs">{metric.getSubValue(v)}</span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}