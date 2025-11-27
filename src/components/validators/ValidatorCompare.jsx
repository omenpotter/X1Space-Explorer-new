import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ExternalLink, TrendingUp, TrendingDown, Activity } from 'lucide-react';

export default function ValidatorCompare({ validators, onRemove }) {
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
      getValue: (v) => (v.uptime?.toFixed(1) || '0') + '%',
      getSubValue: () => null,
      isBest: (v) => v.uptime === bestUptime,
      getValueClass: (v) => getUptimeColor(v.uptime)
    },
    { 
      label: 'Skip Rate', 
      getValue: (v) => (v.skipRate?.toFixed(2) || '0') + '%',
      getSubValue: () => null,
      isBest: (v) => v.skipRate === lowestSkipRate,
      getIcon: (v) => getPerformanceIcon(v.skipRate)
    },
    { 
      label: 'Last Vote', 
      getValue: (v) => v.lastVote?.toLocaleString() || '-',
      getSubValue: (v) => `Lag: ${v.voteLag || 0}`,
      isBest: () => false
    },
    { 
      label: 'Credits (Epoch)', 
      getValue: (v) => v.creditsThisEpoch?.toLocaleString() || '0',
      getSubValue: (v) => `Prev: ${v.creditsPrevEpoch?.toLocaleString() || '0'}`,
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
    <div className="bg-[#24384a] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-gray-400 text-sm font-medium px-4 py-4 min-w-[120px] bg-[#1d2d3a] sticky left-0">
                Metric
              </th>
              {validators.map((v) => (
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
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center text-lg">
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
  );
}