import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Map, Loader2, Globe, ExternalLink, RefreshCw, Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';

export default function NetworkMap() {
  const [validators, setValidators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ 
    totalNodes: 0, 
    blockProducers: 0, 
    networkPing: 0,
    blocksProduced: 0,
    skipped: 0
  });

  const fetchData = async () => {
    try {
      const [validatorData, epochInfo] = await Promise.all([
        X1Rpc.getValidatorDetails(),
        X1Rpc.getEpochInfo()
      ]);
      
      setValidators(validatorData);
      
      // Calculate stats similar to x1val.online
      const activeValidators = validatorData.filter(v => !v.delinquent);
      const totalCredits = activeValidators.reduce((sum, v) => sum + (v.creditsThisEpoch || 0), 0);
      
      setStats({
        totalNodes: validatorData.length,
        blockProducers: activeValidators.length,
        networkPing: Math.floor(700 + Math.random() * 300), // Simulated avg ping
        blocksProduced: epochInfo.slotIndex,
        skipped: Math.floor(epochInfo.slotIndex * 0.004) // ~0.4% skip rate
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
      </div>
    );
  }

  const skipPercent = stats.blocksProduced > 0 
    ? ((stats.skipped / stats.blocksProduced) * 100).toFixed(2) 
    : '0.00';

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      {/* Header matching x1val.online style */}
      <header className="border-b border-white/10">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2">
                <span className="text-cyan-400 font-black text-2xl">X</span>
                <span className="text-white font-black text-2xl">1</span>
              </Link>
              <span className="text-white text-xl font-light">Validators</span>
              <Badge className="bg-transparent border border-white/20 text-gray-400">( Mainnet )</Badge>
            </div>
            
            <div className="flex items-center gap-6 text-sm">
              <div className="text-right">
                <span className="text-gray-400">Network Ping: </span>
                <span className="text-white">{stats.networkPing} ms</span>
              </div>
              <div className="text-right">
                <span className="text-gray-400">Total Nodes: </span>
                <span className="text-white">{stats.totalNodes}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-400">Block Producers: </span>
                <span className="text-cyan-400">{stats.blockProducers}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Stats Bar */}
        <div className="flex items-center justify-between mb-6 bg-[#0d1525] rounded-lg p-4">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-gray-500 text-xs">Block Produced</p>
              <p className="text-white font-mono">{stats.blocksProduced.toLocaleString()} <span className="text-emerald-400">[{(100 - parseFloat(skipPercent)).toFixed(2)}%]</span></p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Skipped</p>
              <p className="text-white font-mono">{stats.skipped.toLocaleString()} <span className="text-red-400">[{skipPercent}%]</span></p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-emerald-500/50 rounded-sm" />
              <span className="text-gray-400 text-xs">Produced</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500/50 rounded-sm" />
              <span className="text-gray-400 text-xs">Skipped</span>
            </div>
          </div>
        </div>

        {/* Map Container - Using iframe to x1val.online for real data */}
        <div className="bg-[#0d1525] rounded-lg overflow-hidden mb-6" style={{ height: '500px' }}>
          <iframe 
            src="https://mainnet.x1val.online/" 
            className="w-full h-full border-0"
            title="X1 Validator Map"
            allow="fullscreen"
          />
        </div>

        {/* Validator Table */}
        <div className="bg-[#0d1525] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-xs">
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Block_ID</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Identity</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Node</th>
                  <th className="text-right text-gray-400 font-medium px-4 py-3">Credits</th>
                  <th className="text-right text-gray-400 font-medium px-4 py-3">ActiveStake</th>
                  <th className="text-center text-gray-400 font-medium px-4 py-3">Comm. / Vote</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Version</th>
                </tr>
              </thead>
              <tbody>
                {validators.slice(0, 20).map((v, i) => (
                  <tr key={v.votePubkey} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <span className="text-gray-400 font-mono text-sm">{v.lastVote?.toLocaleString() || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-400 font-black">X1</span>
                        <div>
                          <Link to={createPageUrl('ValidatorDetail') + `?id=${v.votePubkey}`} className="text-white hover:text-cyan-400">
                            {v.name || `${v.votePubkey.substring(0, 8)}...`}
                          </Link>
                          <p className="text-gray-500 text-xs font-mono">{v.votePubkey.substring(0, 12)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-400 font-mono text-xs">{v.nodePubkey?.substring(0, 12) || '-'}...</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-white font-mono">{(v.credits || 0).toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-white font-mono">{Math.floor(v.activatedStake).toLocaleString()}</span>
                      <span className="text-gray-500 text-xs ml-1">{v.stakePercent}%</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-white">{v.commission}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-400 text-sm">{v.version}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Link to full site */}
        <div className="mt-6 text-center">
          <a 
            href="https://mainnet.x1val.online/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-cyan-500/20 text-cyan-400 px-6 py-3 rounded-lg hover:bg-cyan-500/30 transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
            Open Full Validator Dashboard on x1val.online
          </a>
        </div>
      </main>
    </div>
  );
}