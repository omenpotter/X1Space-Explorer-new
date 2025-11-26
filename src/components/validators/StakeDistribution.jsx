import React from 'react';

export default function StakeDistribution({ validators, totalStake }) {
  // Get top 10 validators for visualization
  const topValidators = validators.slice(0, 10);
  const othersStake = validators.slice(10).reduce((sum, v) => sum + v.activatedStake, 0);
  
  const colors = [
    'bg-cyan-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-rose-500',
    'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500', 'bg-emerald-500'
  ];

  const formatStake = (stake) => {
    if (stake >= 1e6) return (stake / 1e6).toFixed(1) + 'M';
    if (stake >= 1e3) return (stake / 1e3).toFixed(1) + 'K';
    return stake.toFixed(0);
  };

  return (
    <div className="bg-[#24384a] rounded-xl p-4 mb-6">
      <h3 className="text-gray-400 text-sm mb-4">STAKE DISTRIBUTION (Top 10)</h3>
      
      {/* Bar visualization */}
      <div className="h-8 rounded-lg overflow-hidden flex mb-4">
        {topValidators.map((v, i) => {
          const percent = (v.activatedStake / totalStake) * 100;
          return (
            <div
              key={v.votePubkey}
              className={`${colors[i]} transition-all hover:opacity-80`}
              style={{ width: `${percent}%` }}
              title={`${v.name || v.votePubkey.substring(0, 8)}: ${percent.toFixed(1)}%`}
            />
          );
        })}
        {othersStake > 0 && (
          <div
            className="bg-gray-600"
            style={{ width: `${(othersStake / totalStake) * 100}%` }}
            title={`Others: ${((othersStake / totalStake) * 100).toFixed(1)}%`}
          />
        )}
      </div>
      
      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {topValidators.map((v, i) => (
          <div key={v.votePubkey} className="flex items-center gap-2 text-xs">
            <div className={`w-3 h-3 rounded ${colors[i]}`} />
            <span className="text-gray-400 truncate">
              {v.name || `${v.votePubkey.substring(0, 6)}...`}
            </span>
            <span className="text-white ml-auto">{((v.activatedStake / totalStake) * 100).toFixed(1)}%</span>
          </div>
        ))}
        {othersStake > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-gray-600" />
            <span className="text-gray-400">Others</span>
            <span className="text-white ml-auto">{((othersStake / totalStake) * 100).toFixed(1)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}