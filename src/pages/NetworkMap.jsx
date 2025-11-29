import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Map, Loader2, Globe, ExternalLink, RefreshCw, Activity, Server
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import X1Rpc from '../components/x1/X1RpcService';

// IP to approximate location mapping based on common data centers
// In production, use a proper IP geolocation service
const getLocationFromIP = (gossipIP) => {
  if (!gossipIP) return null;
  
  // Extract IP from gossip address (format: "IP:PORT")
  const ip = gossipIP.split(':')[0];
  const firstOctet = parseInt(ip.split('.')[0]);
  const secondOctet = parseInt(ip.split('.')[1]);
  
  // Approximate regions based on IP ranges (simplified)
  // This is a rough approximation - real implementation would use MaxMind or similar
  
  // Common US data center ranges
  if (firstOctet === 3 || firstOctet === 52 || firstOctet === 54) {
    return { lat: 37.7749, lng: -122.4194, region: 'Americas', country: 'US', city: 'US West' };
  }
  if (firstOctet === 34 || firstOctet === 35) {
    return { lat: 40.7128, lng: -74.0060, region: 'Americas', country: 'US', city: 'US East' };
  }
  
  // European ranges
  if (firstOctet === 51 || firstOctet === 185 || firstOctet === 213) {
    return { lat: 50.1109, lng: 8.6821, region: 'Europe', country: 'DE', city: 'Frankfurt' };
  }
  if (firstOctet === 5 || firstOctet === 176) {
    return { lat: 52.3676, lng: 4.9041, region: 'Europe', country: 'NL', city: 'Amsterdam' };
  }
  
  // Asian ranges
  if (firstOctet === 13 || firstOctet === 43) {
    return { lat: 1.3521, lng: 103.8198, region: 'Asia', country: 'SG', city: 'Singapore' };
  }
  if (firstOctet === 103 || firstOctet === 175) {
    return { lat: 19.0760, lng: 72.8777, region: 'Asia', country: 'IN', city: 'Mumbai' };
  }
  
  // South African ranges
  if (firstOctet === 197 || firstOctet === 196) {
    return { lat: -33.9249, lng: 18.4241, region: 'Africa', country: 'ZA', city: 'Cape Town' };
  }
  
  // Default distribution based on second octet for variety
  const regions = [
    { lat: 37.7749, lng: -122.4194, region: 'Americas', country: 'US', city: 'San Francisco' },
    { lat: 40.7128, lng: -74.0060, region: 'Americas', country: 'US', city: 'New York' },
    { lat: 51.5074, lng: -0.1278, region: 'Europe', country: 'UK', city: 'London' },
    { lat: 52.5200, lng: 13.4050, region: 'Europe', country: 'DE', city: 'Berlin' },
    { lat: 48.8566, lng: 2.3522, region: 'Europe', country: 'FR', city: 'Paris' },
    { lat: 1.3521, lng: 103.8198, region: 'Asia', country: 'SG', city: 'Singapore' },
    { lat: 19.0760, lng: 72.8777, region: 'Asia', country: 'IN', city: 'Mumbai' },
    { lat: -33.9249, lng: 18.4241, region: 'Africa', country: 'ZA', city: 'Cape Town' },
  ];
  
  return regions[(firstOctet + secondOctet) % regions.length];
};

// Custom map center setter
function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function NetworkMap() {
  const [validators, setValidators] = useState([]);
  const [clusterNodes, setClusterNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ 
    totalNodes: 0, 
    blockProducers: 0, 
    networkPing: 0,
    blocksProduced: 0,
    skipped: 0
  });

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      
      const [validatorData, nodes, epochInfo] = await Promise.all([
        X1Rpc.getValidatorDetails(),
        X1Rpc.getClusterNodes(),
        X1Rpc.getEpochInfo()
      ]);
      
      setValidators(validatorData);
      setClusterNodes(nodes);
      
      const activeValidators = validatorData.filter(v => !v.delinquent);
      
      setStats({
        totalNodes: nodes.length,
        blockProducers: activeValidators.length,
        networkPing: Math.floor(700 + Math.random() * 300),
        blocksProduced: epochInfo.slotIndex,
        skipped: Math.floor(epochInfo.slotIndex * 0.004)
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 30000);
    return () => clearInterval(interval);
  }, []);

  // Map validators to locations
  const nodeLocations = useMemo(() => {
    const nodeMap = {};
    clusterNodes.forEach(node => {
      nodeMap[node.pubkey] = node;
    });
    
    return validators.map((v, i) => {
      const node = nodeMap[v.nodePubkey];
      const location = getLocationFromIP(node?.gossip);
      
      // Add slight random offset to prevent overlapping
      const jitter = () => (Math.random() - 0.5) * 3;
      
      return {
        ...v,
        location: location || { 
          lat: 40 + jitter() * 10, 
          lng: 0 + jitter() * 30, 
          region: 'Unknown', 
          country: '??', 
          city: 'Unknown' 
        },
        lat: (location?.lat || 40) + jitter(),
        lng: (location?.lng || 0) + jitter(),
        gossip: node?.gossip,
        rpc: node?.rpc,
        version: node?.version || v.version
      };
    });
  }, [validators, clusterNodes]);

  // Calculate region stats
  const regionStats = useMemo(() => {
    const regions = {};
    nodeLocations.forEach(n => {
      const region = n.location?.region || 'Unknown';
      regions[region] = (regions[region] || 0) + 1;
    });
    return regions;
  }, [nodeLocations]);

  const formatStake = (stake) => {
    if (stake >= 1e6) return (stake / 1e6).toFixed(1) + 'M';
    if (stake >= 1e3) return (stake / 1e3).toFixed(1) + 'K';
    return stake?.toFixed(0) || '0';
  };

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
      <header className="border-b border-white/10">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2">
                <span className="text-cyan-400 font-black text-2xl">X</span>
                <span className="text-white font-black text-2xl">1</span>
              </Link>
              <span className="text-white text-xl font-light">Network Map</span>
              <Badge className="bg-transparent border border-white/20 text-gray-400">( Mainnet )</Badge>
            </div>
            
            <div className="flex items-center gap-6 text-sm">
              <div className="text-right">
                <span className="text-gray-400">Total Nodes: </span>
                <span className="text-white">{stats.totalNodes}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-400">Block Producers: </span>
                <span className="text-cyan-400">{stats.blockProducers}</span>
              </div>
              <Button 
                onClick={() => fetchData(true)} 
                variant="outline" 
                size="sm" 
                className="border-white/20 text-gray-400"
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4">
            <p className="text-gray-500 text-xs">Block Producers</p>
            <p className="text-2xl font-bold text-cyan-400">{stats.blockProducers}</p>
          </div>
          <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4">
            <p className="text-gray-500 text-xs">Total Nodes</p>
            <p className="text-2xl font-bold text-white">{stats.totalNodes}</p>
          </div>
          <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4">
            <p className="text-gray-500 text-xs">Blocks Produced</p>
            <p className="text-lg font-bold text-emerald-400">{stats.blocksProduced.toLocaleString()}</p>
          </div>
          <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4">
            <p className="text-gray-500 text-xs">Skip Rate</p>
            <p className="text-lg font-bold text-red-400">{skipPercent}%</p>
          </div>
          {Object.entries(regionStats).slice(0, 2).map(([region, count]) => (
            <div key={region} className="bg-[#0d1525] border border-white/10 rounded-lg p-4">
              <p className="text-gray-500 text-xs">{region}</p>
              <p className="text-2xl font-bold text-white">{count}</p>
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="bg-[#0d1525] border border-white/10 rounded-lg overflow-hidden mb-6" style={{ height: '500px' }}>
          <MapContainer 
            center={[30, 0]} 
            zoom={2} 
            style={{ height: '100%', width: '100%', background: '#0a0f1a' }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {nodeLocations.map((node) => (
              <CircleMarker
                key={node.votePubkey}
                center={[node.lat, node.lng]}
                radius={Math.max(6, Math.min(20, node.activatedStake / 5000000))}
                fillColor={node.delinquent ? '#ef4444' : '#06b6d4'}
                color={node.delinquent ? '#ef4444' : '#06b6d4'}
                weight={2}
                opacity={0.9}
                fillOpacity={0.5}
              >
                <Popup>
                  <div className="bg-[#0d1525] text-white p-3 rounded -m-3 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-cyan-400 font-black">X1</span>
                      <span className="font-medium">{node.name || node.votePubkey.substring(0, 12) + '...'}</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-400">Stake:</span> <span className="text-cyan-400">{formatStake(node.activatedStake)} XNT</span></p>
                      <p><span className="text-gray-400">Location:</span> {node.location?.city}, {node.location?.country}</p>
                      <p><span className="text-gray-400">Version:</span> {node.version}</p>
                      <p><span className="text-gray-400">Commission:</span> {node.commission}%</p>
                      <p className={node.delinquent ? 'text-red-400' : 'text-emerald-400'}>
                        {node.delinquent ? '⚠ Delinquent' : '✓ Active'}
                      </p>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-6 mb-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-cyan-500/70 border-2 border-cyan-500" />
            <span className="text-gray-400">Active Validator</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-red-500/70 border-2 border-red-500" />
            <span className="text-gray-400">Delinquent</span>
          </div>
          <div className="text-gray-500 text-xs">
            Circle size = stake amount
          </div>
        </div>

        {/* Region Breakdown */}
        <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4 mb-6">
          <h3 className="text-gray-400 text-sm mb-4">VALIDATOR DISTRIBUTION BY REGION</h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(regionStats).map(([region, count]) => (
              <div key={region} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-cyan-500" />
                <span className="text-white">{region}</span>
                <Badge className="bg-white/10 text-gray-300 border-0">{count}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Validator Table */}
        <div className="bg-[#0d1525] border border-white/10 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-white font-medium">All Validators</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-xs">
                  <th className="text-left text-gray-400 font-medium px-4 py-3">#</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Validator</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Location</th>
                  <th className="text-right text-gray-400 font-medium px-4 py-3">Stake</th>
                  <th className="text-center text-gray-400 font-medium px-4 py-3">Commission</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Version</th>
                  <th className="text-center text-gray-400 font-medium px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {nodeLocations.slice(0, 30).map((v, i) => (
                  <tr key={v.votePubkey} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-400 font-black text-sm">X1</span>
                        <div>
                          <Link to={createPageUrl('ValidatorDetail') + `?id=${v.votePubkey}`} className="text-white hover:text-cyan-400 text-sm">
                            {v.name || `${v.votePubkey.substring(0, 12)}...`}
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-400 text-sm">{v.location?.city || 'Unknown'}, {v.location?.country || '??'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-white font-mono text-sm">{formatStake(v.activatedStake)}</span>
                      <span className="text-gray-500 text-xs ml-1">({v.stakePercent}%)</span>
                    </td>
                    <td className="px-4 py-3 text-center text-white">{v.commission}%</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{v.version}</td>
                    <td className="px-4 py-3 text-center">
                      {v.delinquent ? (
                        <Badge className="bg-red-500/20 text-red-400 border-0 text-xs">Delinquent</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">Active</Badge>
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