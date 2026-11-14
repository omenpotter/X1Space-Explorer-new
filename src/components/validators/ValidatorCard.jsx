import React, { memo, useMemo } from 'react';
import { Badge } from "@/components/ui/badge";
import { ExternalLink, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { safeUrl } from '@/lib/safeUrl';

const ValidatorCard = memo(function ValidatorCard({ validator, rank, totalStake }) {
  const stakePercent = useMemo(() => 
    ((validator.activatedStake / totalStake) * 100).toFixed(2),
    [validator.activatedStake, totalStake]
  );
  
  const formatStake = (stake) => {
    if (stake >= 1e6) return (stake / 1e6).toFixed(2) + 'M';
    if (stake >= 1e3) return (stake / 1e3).toFixed(2) + 'K';
    return stake.toFixed(2);
  };

  const getUptimeColor = (uptime) => {
    if (uptime >= 99) return 'text-positive';
    if (uptime >= 95) return 'text-warning';
    return 'text-negative';
  };

  const getPerformanceIcon = (skipRate) => {
    if (skipRate < 1) return <TrendingUp className="w-3 h-3 text-positive" />;
    if (skipRate < 5) return <Activity className="w-3 h-3 text-warning" />;
    return <TrendingDown className="w-3 h-3 text-negative" />;
  };

  return (
    <tr className="border-b border-line hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-4 text-ink-faint text-sm font-mono">{rank}</td>
      <td className="px-4 py-4">
        <Link to={createPageUrl('ValidatorDetail') + `?id=${validator.votePubkey}`} className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand/30 to-blue-500/30 flex items-center justify-center text-sm shrink-0">
            {validator.icon || (
              <span className="font-bold text-brand">{rank}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white font-medium truncate group-hover:text-brand transition-colors">
                {validator.name || `Validator ${validator.votePubkey.substring(0, 4)}...${validator.votePubkey.slice(-4)}`}
              </p>
              {validator.website && (
                <a 
                  href={safeUrl(validator.website)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-faint hover:text-brand transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <p className="text-brand/70 font-mono text-xs truncate">
              {validator.votePubkey.substring(0, 12)}...{validator.votePubkey.slice(-4)}
            </p>
          </div>
        </Link>
      </td>
      <td className="px-4 py-4">
        <div className="text-right">
          <p className="text-white font-mono text-sm">{formatStake(validator.activatedStake)} XNT</p>
          <div className="flex items-center justify-end gap-2 mt-1">
            <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-brand to-blue-500 rounded-full"
                style={{ width: `${Math.min(100, stakePercent * 10)}%` }}
              />
            </div>
            <span className="text-ink-faint text-xs">{stakePercent}%</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <Badge className={`${validator.commission === 0 ? 'bg-positive/20 text-positive' : validator.commission <= 5 ? 'bg-warning/20 text-warning' : 'bg-negative/20 text-negative'} border-0`}>
          {validator.commission}%
        </Badge>
      </td>
      <td className="px-4 py-4 text-center">
        <div className="flex flex-col items-center">
          <span className={`font-mono text-sm ${getUptimeColor(validator.uptime)}`}>
            {validator.uptime?.toFixed(1)}%
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            {getPerformanceIcon(validator.skipRate)}
            <span className="text-ink-faint text-xs">{validator.skipRate?.toFixed(1)}% skip</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <Badge className="bg-blue-500/20 text-blue-400 border-0 font-mono text-xs">
          {validator.version}
        </Badge>
      </td>
      <td className="px-4 py-4 text-right">
        <div>
          <span className="text-ink-muted font-mono text-sm">{validator.lastVote?.toLocaleString()}</span>
          <p className="text-ink-faint text-xs">lag: {validator.voteLag}</p>
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        {validator.delinquent ? (
          <Badge className="bg-negative/20 text-negative border-0">Delinquent</Badge>
        ) : (
          <Badge className="bg-positive/20 text-positive border-0">Active</Badge>
        )}
      </td>
    </tr>
  );
});

export default ValidatorCard;