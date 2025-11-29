import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Map, Loader2, Globe, ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';

// Note: For accurate validator locations, we would need IP geolocation data
// This is a placeholder - in production, integrate with x1val.online API or similar
// Currently showing approximate regions based on known validator distribution

export default function NetworkMap() {
  const [validators, setValidators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nodeLocations, setNodeLocations] = useState([]);
  const [stats, setStats] = useState({ countries: 0, continents: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await X1Rpc.getValidatorDetails();
        setValidators(data);
        setStats({ 
          countries: 'N/A', 
          continents: 4 // Americas, Europe, Africa, South Asia per x1val.online
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatStake = (stake) => {
    if (stake >= 1e6) return (stake / 1e6).toFixed(1) + 'M';
    if (stake >= 1e3) return (stake / 1e3).toFixed(1) + 'K';
    return stake?.toFixed(0) || '0';
  };

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
          <Map className="w-7 h-7 text-emerald-400" />
          Network Map
        </h1>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Total Nodes</p>
            <p className="text-2xl font-bold text-white">{validators.length}</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Countries</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.countries}</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Continents</p>
            <p className="text-2xl font-bold text-cyan-400">{stats.continents}</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Active</p>
            <p className="text-2xl font-bold text-emerald-400">{validators.filter(v => !v.delinquent).length}</p>
          </div>
        </div>

        {/* Map Notice */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
          <p className="text-blue-400 text-sm">
            ℹ️ For accurate real-time validator map, visit <a href="https://mainnet.x1val.online/" target="_blank" rel="noopener noreferrer" className="underline font-medium">mainnet.x1val.online</a>
          </p>
        </div>

        {/* Embedded Map or Placeholder */}
        <div className="bg-[#24384a] rounded-xl overflow-hidden" style={{ height: '500px' }}>
          <iframe 
            src="https://mainnet.x1val.online/" 
            className="w-full h-full border-0"
            title="X1 Validator Map"
            style={{ filter: 'hue-rotate(0deg)' }}
          />
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-6 text-sm">
          <div className="text-gray-400">
            Regions: Americas • Europe • Africa • South Asia
          </div>
          <a 
            href="https://mainnet.x1val.online/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-cyan-400 hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-4 h-4" /> Open Full Map
          </a>
        </div>
      </main>
    </div>
  );
}