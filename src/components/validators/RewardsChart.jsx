import React from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip, XAxis } from 'recharts';
import { Badge } from "@/components/ui/badge";

export default function RewardsChart({ rewardHistory, validator }) {
  if (!rewardHistory || rewardHistory.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        No reward data available
      </div>
    );
  }

  const totalRewards = rewardHistory.reduce((sum, r) => sum + r.rewards, 0);
  const avgRewards = totalRewards / rewardHistory.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1d2d3a] rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">Total Rewards ({rewardHistory.length} epochs)</p>
          <p className="text-emerald-400 font-bold text-lg">{totalRewards.toFixed(2)} XNT</p>
        </div>
        <div className="bg-[#1d2d3a] rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">Avg per Epoch</p>
          <p className="text-cyan-400 font-bold text-lg">{avgRewards.toFixed(2)} XNT</p>
        </div>
        <div className="bg-[#1d2d3a] rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">Est. APY</p>
          <p className="text-yellow-400 font-bold text-lg">7.2%</p>
        </div>
      </div>

      <div className="bg-[#1d2d3a] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-medium">Rewards History</h4>
          <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">
            {validator?.commission || 0}% commission
          </Badge>
        </div>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rewardHistory}>
              <XAxis 
                dataKey="epoch" 
                stroke="#6b7280" 
                fontSize={11}
                tickFormatter={(epoch) => `E${epoch}`}
              />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0d1525', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                formatter={(value) => [value.toFixed(2) + ' XNT', 'Rewards']}
                labelFormatter={(epoch) => `Epoch ${epoch}`}
              />
              <Line 
                type="monotone" 
                dataKey="rewards" 
                stroke="#10b981" 
                strokeWidth={2} 
                dot={{ fill: '#10b981', r: 3 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}