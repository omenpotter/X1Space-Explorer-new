import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Clock, Loader2, ChevronLeft, ChevronRight, TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import X1Rpc from '../components/x1/X1RpcService';

export default function EpochHistory() {
  const [currentEpoch, setCurrentEpoch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [epochHistory, setEpochHistory] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const epochInfo = await X1Rpc.getEpochInfo();
        setCurrentEpoch(epochInfo);
        
        // Generate mock historical data for past epochs
        const history = [];
        for (let i = 0; i < 30; i++) {
          const epoch = epochInfo.epoch - i;
          history.push({
            epoch,
            validators: 45 + Math.floor(Math.random() * 10),
            totalStake: 800 + Math.random() * 200,
            avgTps: 2500 + Math.floor(Math.random() * 1000),
            transactions: 150000000 + Math.floor(Math.random() * 50000000),
            rewards: 50000 + Math.floor(Math.random() * 10000),
            duration: 172800 + Math.floor(Math.random() * 3600), // ~2 days in seconds
            startSlot: epoch * 432000,
            endSlot: (epoch + 1) * 432000 - 1
          });
        }
        setEpochHistory(history);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatDuration = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  const formatNumber = (num) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num?.toLocaleString() || '0';
  };

  // Chart data (last 20 epochs)
  const chartData = epochHistory.slice(0, 20).reverse().map(e => ({
    epoch: e.epoch,
    stake: e.totalStake,
    tps: e.avgTps,
    validators: e.validators
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1d2d3a] text-white">
      <header className="bg-[#1d2d3a] border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-black font-black text-sm">X1</span>
                </div>
                <span className="text-white font-bold hidden sm:inline">X1</span>
                <span className="text-cyan-400 font-bold hidden sm:inline">.space</span>
              </Link>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">Mainnet</Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
          <Clock className="w-7 h-7 text-purple-400" />
          Epoch History
        </h1>

        {/* Current Epoch */}
        {currentEpoch && (
          <div className="bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-gray-400 text-sm">Current Epoch</p>
                <p className="text-3xl font-bold text-white">{currentEpoch.epoch}</p>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-0">In Progress</Badge>
            </div>
            <div className="h-3 bg-[#1d2d3a] rounded-full overflow-hidden mb-3">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full" 
                style={{ width: `${(currentEpoch.slotIndex / currentEpoch.slotsInEpoch) * 100}%` }} 
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Slot {currentEpoch.slotIndex.toLocaleString()} / {currentEpoch.slotsInEpoch.toLocaleString()}</span>
              <span className="text-white">{((currentEpoch.slotIndex / currentEpoch.slotsInEpoch) * 100).toFixed(1)}% complete</span>
            </div>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-[#24384a] rounded-xl p-4">
            <h3 className="text-gray-400 text-sm mb-4">STAKE OVER EPOCHS (M XNT)</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <XAxis dataKey="epoch" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1d2d3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="stake" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <h3 className="text-gray-400 text-sm mb-4">AVERAGE TPS PER EPOCH</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <XAxis dataKey="epoch" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1d2d3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="tps" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Epoch Table */}
        <div className="bg-[#24384a] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Epoch</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Validators</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Total Stake</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Avg TPS</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Transactions</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Duration</th>
                  <th className="text-center text-gray-400 text-xs font-medium px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {epochHistory.slice(0, 20).map((epoch, i) => (
                  <tr key={epoch.epoch} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <span className="text-cyan-400 font-mono font-medium">{epoch.epoch}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-white">{epoch.validators}</td>
                    <td className="px-4 py-3 text-right text-white font-mono">{epoch.totalStake.toFixed(1)}M</td>
                    <td className="px-4 py-3 text-right text-cyan-400 font-mono">{epoch.avgTps.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-gray-400 font-mono">{formatNumber(epoch.transactions)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">{formatDuration(epoch.duration)}</td>
                    <td className="px-4 py-3 text-center">
                      {i === 0 ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">Current</Badge>
                      ) : (
                        <Badge className="bg-gray-500/20 text-gray-400 border-0 text-xs">Completed</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}