import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, ChevronLeft, RefreshCw, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import X1Rpc from '../components/x1/X1RpcService';

export default function EpochHistory() {
  const [currentEpoch, setCurrentEpoch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [epochHistory, setEpochHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      setError(null);
      setLoadingProgress(5);
      
      const epochInfo = await X1Rpc.getEpochInfo();
      if (!epochInfo) throw new Error('Failed to fetch epoch info');
      
      setCurrentEpoch(epochInfo);
      setLoadingProgress(15);
      
      const slotsPerEpoch = epochInfo.slotsInEpoch || 216000;
      const history = [];
      
      // Current epoch - get from getBlockProduction (most accurate for current)
      try {
        const currentBlockProd = await X1Rpc.getBlockProduction();
        if (currentBlockProd?.value?.byIdentity) {
          const totals = Object.values(currentBlockProd.value.byIdentity).reduce((acc, [leader, produced]) => {
            acc.leader += leader;
            acc.produced += produced;
            return acc;
          }, { leader: 0, produced: 0 });
          
          history.push({
            epoch: epochInfo.epoch,
            produced: totals.produced,
            skipped: totals.leader - totals.produced,
            skipRate: totals.leader > 0 ? (((totals.leader - totals.produced) / totals.leader) * 100).toFixed(4) : '0',
            isCurrent: true,
            dataSource: 'live'
          });
        }
      } catch (e) {
        console.error('Current epoch fetch failed:', e);
      }
      
      setLoadingProgress(25);
      
      // Fetch historical epochs using getBlockProduction with slot range
      // This is the most reliable way to get historical epoch data
      const epochsToFetch = Math.min(epochInfo.epoch, 50); // Fetch up to 50 past epochs
      
      for (let i = 1; i <= epochsToFetch; i++) {
        const epoch = epochInfo.epoch - i;
        if (epoch < 0) break;
        
        const firstSlot = epoch * slotsPerEpoch;
        const lastSlot = (epoch + 1) * slotsPerEpoch - 1;
        
        try {
          // Try getBlockProduction with slot range first
          const epochProd = await X1Rpc.getBlockProduction(firstSlot, lastSlot);
          
          if (epochProd?.value?.byIdentity && Object.keys(epochProd.value.byIdentity).length > 0) {
            const totals = Object.values(epochProd.value.byIdentity).reduce((acc, [leader, prod]) => {
              acc.leader += leader;
              acc.produced += prod;
              return acc;
            }, { leader: 0, produced: 0 });
            
            if (totals.leader > 0) {
              history.push({
                epoch,
                produced: totals.produced,
                skipped: totals.leader - totals.produced,
                skipRate: (((totals.leader - totals.produced) / totals.leader) * 100).toFixed(4),
                isCurrent: false,
                dataSource: 'onchain'
              });
            } else {
              history.push({
                epoch,
                produced: 0,
                skipped: 0,
                skipRate: 'N/A',
                isCurrent: false,
                dataSource: 'unavailable'
              });
            }
          } else {
            // No data from getBlockProduction - try getBlocks
            try {
              const blocks = await X1Rpc.getBlocks(firstSlot, Math.min(lastSlot, firstSlot + 10000));
              if (blocks && blocks.length > 0) {
                // Estimate based on sample (not full epoch data)
                const sampleSize = 10000;
                const estimatedProduced = Math.round((blocks.length / sampleSize) * slotsPerEpoch);
                const estimatedSkipped = slotsPerEpoch - estimatedProduced;
                
                history.push({
                  epoch,
                  produced: estimatedProduced,
                  skipped: estimatedSkipped,
                  skipRate: ((estimatedSkipped / slotsPerEpoch) * 100).toFixed(4),
                  isCurrent: false,
                  dataSource: 'estimated'
                });
              } else {
                history.push({
                  epoch,
                  produced: 0,
                  skipped: 0,
                  skipRate: 'N/A',
                  isCurrent: false,
                  dataSource: 'unavailable'
                });
              }
            } catch {
              history.push({
                epoch,
                produced: 0,
                skipped: 0,
                skipRate: 'N/A',
                isCurrent: false,
                dataSource: 'unavailable'
              });
            }
          }
        } catch (e) {
          history.push({
            epoch,
            produced: 0,
            skipped: 0,
            skipRate: 'N/A',
            isCurrent: false,
            dataSource: 'unavailable'
          });
        }
        
        setLoadingProgress(25 + Math.round((i / epochsToFetch) * 70));
        
        // Small delay to prevent rate limiting
        if (i % 3 === 0) {
          await new Promise(r => setTimeout(r, 50));
        }
      }
      
      // Sort by epoch descending
      history.sort((a, b) => b.epoch - a.epoch);
      setEpochHistory(history);
      setLoadingProgress(100);
    } catch (err) {
      console.error('Epoch fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 120000);
    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num) => {
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num?.toLocaleString() || '0';
  };

  const formatDuration = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const chartData = epochHistory
    .filter(e => e.dataSource !== 'unavailable' && e.produced > 0)
    .slice(0, 30)
    .reverse()
    .map(e => ({
      epoch: e.epoch,
      produced: e.produced,
      skipped: e.skipped,
      skipRate: parseFloat(e.skipRate) || 0
    }));

  const slotsPerEpoch = currentEpoch?.slotsInEpoch || 216000;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">Loading Epoch History...</p>
          <div className="w-48 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 transition-all duration-300" style={{ width: `${loadingProgress}%` }} />
          </div>
          <p className="text-gray-500 text-xs mt-2">Fetching on-chain data... {loadingProgress}%</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 mb-4">Error: {error}</p>
          <Button onClick={() => fetchData()} className="bg-cyan-500">Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1d2d3a] text-white">
      <header className="border-b border-white/10">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2 hover:opacity-80">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
                <span className="font-bold text-xl"><span className="text-cyan-400">X1</span><span className="text-white">Space</span></span>
              </Link>
              <span className="text-gray-400">|</span>
              <span className="text-white text-xl font-light">Epoch History</span>
              <Badge className="bg-transparent border border-white/20 text-gray-400">Mainnet</Badge>
            </div>
            
            <Button onClick={() => fetchData(true)} variant="outline" size="sm" className="border-white/20 text-gray-400" disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Info Notice */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-6">
          <p className="text-blue-400 text-sm">
            ℹ️ Epoch data fetched using <strong>getBlockProduction</strong> RPC. Data availability depends on RPC node retention policy.
          </p>
        </div>

        {/* Current Epoch */}
        {currentEpoch && (
          <div className="bg-[#24384a] border border-white/10 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
              <div>
                <p className="text-gray-400 text-sm">Current Epoch</p>
                <p className="text-4xl font-bold text-white">{currentEpoch.epoch}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Slots per Epoch</p>
                <p className="text-xl font-bold text-white">{slotsPerEpoch.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Current Slot</p>
                <p className="text-xl font-bold text-cyan-400">{currentEpoch.absoluteSlot?.toLocaleString()}</p>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-0 px-4 py-2">In Progress</Badge>
            </div>
            <div className="h-4 bg-[#1d2d3a] rounded-full overflow-hidden mb-3">
              <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all" style={{ width: `${(currentEpoch.slotIndex / currentEpoch.slotsInEpoch) * 100}%` }} />
            </div>
            <div className="flex justify-between text-sm flex-wrap gap-2">
              <span className="text-gray-400">Slot {currentEpoch.slotIndex.toLocaleString()} / {currentEpoch.slotsInEpoch.toLocaleString()}</span>
              <span className="text-white font-medium">{((currentEpoch.slotIndex / currentEpoch.slotsInEpoch) * 100).toFixed(2)}% complete</span>
              <span className="text-gray-400">~{formatDuration((currentEpoch.slotsInEpoch - currentEpoch.slotIndex) * 0.4)} remaining</span>
            </div>
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="bg-[#24384a] border border-white/10 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 text-sm">BLOCK PRODUCTION BY EPOCH</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-emerald-500/70 rounded-sm" />
                  <span className="text-gray-400 text-xs">Produced</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500/70 rounded-sm" />
                  <span className="text-gray-400 text-xs">Skipped</span>
                </div>
              </div>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="epoch" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#24384a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} formatter={(value, name) => [value.toLocaleString(), name === 'produced' ? 'Produced' : 'Skipped']} />
                  <Bar dataKey="produced" fill="#10b981" stackId="a" />
                  <Bar dataKey="skipped" fill="#ef4444" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-[#24384a] border border-white/10 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-white font-medium">Epoch Block Production</h3>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full" /><span className="text-gray-400">On-chain</span></span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full" /><span className="text-gray-400">Estimated</span></span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-yellow-500 rounded-full" /><span className="text-gray-400">Unavailable</span></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Epoch</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Slot Range</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Produced</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Skipped</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Skip Rate</th>
                  <th className="text-center text-gray-400 text-xs font-medium px-4 py-3">Data Source</th>
                  <th className="text-center text-gray-400 text-xs font-medium px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {epochHistory.map((epoch) => {
                  const firstSlot = epoch.epoch * slotsPerEpoch;
                  const lastSlot = (epoch.epoch + 1) * slotsPerEpoch - 1;
                  return (
                    <tr key={epoch.epoch} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3"><span className="text-cyan-400 font-mono font-medium">{epoch.epoch}</span></td>
                      <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">{formatNumber(firstSlot)} - {formatNumber(lastSlot)}</td>
                      <td className="px-4 py-3 text-right">
                        {epoch.dataSource === 'unavailable' ? <span className="text-gray-500">N/A</span> : <span className="text-emerald-400 font-mono">{epoch.produced.toLocaleString()}</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {epoch.dataSource === 'unavailable' ? <span className="text-gray-500">N/A</span> : <span className="text-red-400 font-mono">{epoch.skipped.toLocaleString()}</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {epoch.skipRate === 'N/A' ? <span className="text-gray-500">N/A</span> : <span className={`font-mono ${parseFloat(epoch.skipRate) > 5 ? 'text-red-400' : 'text-gray-400'}`}>{epoch.skipRate}%</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {epoch.dataSource === 'live' && <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">Live</Badge>}
                        {epoch.dataSource === 'onchain' && <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">On-chain</Badge>}
                        {epoch.dataSource === 'estimated' && <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">Estimated</Badge>}
                        {epoch.dataSource === 'unavailable' && <Badge className="bg-yellow-500/20 text-yellow-400 border-0 text-xs">Unavailable</Badge>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {epoch.isCurrent ? <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">Current</Badge> : <Badge className="bg-gray-500/20 text-gray-400 border-0 text-xs">Completed</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}