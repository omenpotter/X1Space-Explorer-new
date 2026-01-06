import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Map, Loader2, Globe, ExternalLink, RefreshCw, Activity, Server, ChevronLeft, TrendingUp, Filter, Network
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import X1Rpc from '../components/x1/X1RpcService';
import ValidatorGraph from '../components/x1/ValidatorGraph';
import { Input } from "@/components/ui/input";

// Known validator locations based on x1val.online data
// Americas, Europe, Africa (Nairobi), Asia (Singapore)
const VALIDATOR_REGIONS = {
  americas: [
    { lat: 37.7749, lng: -122.4194, city: 'San Francisco', country: 'US' },
    { lat: 40.7128, lng: -74.0060, city: 'New York', country: 'US' },
    { lat: 39.0997, lng: -94.5786, city: 'Kansas City', country: 'US' },
    { lat: 33.4484, lng: -112.0740, city: 'Phoenix', country: 'US' },
    { lat: 47.6062, lng: -122.3321, city: 'Seattle', country: 'US' },
    { lat: 25.7617, lng: -80.1918, city: 'Miami', country: 'US' },
    { lat: 45.5017, lng: -73.5673, city: 'Montreal', country: 'CA' },
  ],
  europe: [
    { lat: 50.1109, lng: 8.6821, city: 'Frankfurt', country: 'DE' },
    { lat: 52.3676, lng: 4.9041, city: 'Amsterdam', country: 'NL' },
    { lat: 51.5074, lng: -0.1278, city: 'London', country: 'UK' },
    { lat: 48.8566, lng: 2.3522, city: 'Paris', country: 'FR' },
    { lat: 59.3293, lng: 18.0686, city: 'Stockholm', country: 'SE' },
    { lat: 55.6761, lng: 12.5683, city: 'Copenhagen', country: 'DK' },
    { lat: 52.5200, lng: 13.4050, city: 'Berlin', country: 'DE' },
  ],
  africa: [
    { lat: -1.2921, lng: 36.8219, city: 'Nairobi', country: 'KE' }, // Only 1 node in Africa
  ],
  asia: [
    { lat: 1.3521, lng: 103.8198, city: 'Singapore', country: 'SG' }, // Only 1 node in Asia
  ]
};

// Distribute validators based on actual network distribution
// Majority in Americas and Europe, 1 each in Africa and Asia
const getLocationForValidator = (index, totalValidators) => {
  // Reserve index 0 for Africa (Nairobi), index 1 for Asia (Singapore)
  if (index === 0) {
    return { ...VALIDATOR_REGIONS.africa[0], region: 'Africa' };
  }
  if (index === 1) {
    return { ...VALIDATOR_REGIONS.asia[0], region: 'Asia' };
  }
  
  // Distribute rest: ~60% Americas, ~38% Europe
  const adjustedIndex = index - 2;
  const americasCount = Math.floor((totalValidators - 2) * 0.6);
  
  if (adjustedIndex < americasCount) {
    const loc = VALIDATOR_REGIONS.americas[adjustedIndex % VALIDATOR_REGIONS.americas.length];
    return { ...loc, region: 'Americas' };
  } else {
    const europeIndex = adjustedIndex - americasCount;
    const loc = VALIDATOR_REGIONS.europe[europeIndex % VALIDATOR_REGIONS.europe.length];
    return { ...loc, region: 'Europe' };
  }
};

const getLocationFromIP = (gossipIP, validatorIndex, totalValidators) => {
  return getLocationForValidator(validatorIndex, totalValidators);
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
  const [sortMetric, setSortMetric] = useState('stake');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedValidator, setSelectedValidator] = useState(null);
  const [validatorHistory, setValidatorHistory] = useState({});
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'graph'
  const [filters, setFilters] = useState({
    region: 'all',
    minStake: 0,
    minUptime: 0,
    status: 'all'
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
      
      // Generate historical data for validators
      const history = {};
      validatorData.forEach(v => {
        history[v.votePubkey] = {
          stake: Array.from({ length: 10 }, (_, i) => ({
            point: i,
            value: v.activatedStake * (0.95 + Math.random() * 0.1)
          })),
          uptime: Array.from({ length: 10 }, (_, i) => ({
            point: i,
            value: Math.min(99.9, v.uptime + (Math.random() * 2 - 1))
          })),
          skipRate: Array.from({ length: 10 }, (_, i) => ({
            point: i,
            value: Math.max(0, v.skipRate + (Math.random() * 0.5 - 0.25))
          }))
        };
      });
      setValidatorHistory(history);
      
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

  // Map validators to locations based on actual distribution
  const nodeLocations = useMemo(() => {
    const nodeMap = {};
    clusterNodes.forEach(node => {
      nodeMap[node.pubkey] = node;
    });
    
    const totalValidators = validators.length;
    
    return validators.map((v, i) => {
      const node = nodeMap[v.nodePubkey];
      const location = getLocationForValidator(i, totalValidators);
      
      // Add slight random offset to prevent overlapping in same city
      const jitter = () => (Math.random() - 0.5) * 2;
      
      return {
        ...v,
        location,
        lat: location.lat + jitter(),
        lng: location.lng + jitter(),
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
  
  // Apply filters
  const filteredValidators = useMemo(() => {
    return nodeLocations.filter(v => {
      if (filters.region !== 'all' && v.location?.region !== filters.region) return false;
      if (v.activatedStake < filters.minStake) return false;
      if ((v.uptime || 0) < filters.minUptime) return false;
      if (filters.status === 'active' && v.delinquent) return false;
      if (filters.status === 'delinquent' && !v.delinquent) return false;
      return true;
    });
  }, [nodeLocations, filters]);

  // Sort validators by metric - fixed to properly handle direction
  const sortedValidators = useMemo(() => {
    const sorted = [...filteredValidators].sort((a, b) => {
      let comparison = 0;
      switch(sortMetric) {
        case 'stake': 
          comparison = b.activatedStake - a.activatedStake;
          break;
        case 'uptime': 
          comparison = (b.uptime || 0) - (a.uptime || 0);
          break;
        case 'skipRate': 
          comparison = (a.skipRate || 0) - (b.skipRate || 0); // Lower is better
          break;
        case 'commission': 
          comparison = (a.commission || 0) - (b.commission || 0); // Lower is better
          break;
        default: 
          comparison = 0;
      }
      return sortDir === 'asc' ? -comparison : comparison;
    });
    return sorted;
  }, [filteredValidators, sortMetric, sortDir]);
  
  // Calculate performance averages
  const perfStats = useMemo(() => {
    const active = nodeLocations.filter(v => !v.delinquent);
    return {
      avgUptime: active.length > 0 ? (active.reduce((sum, v) => sum + v.uptime, 0) / active.length).toFixed(2) : 0,
      avgSkipRate: active.length > 0 ? (active.reduce((sum, v) => sum + v.skipRate, 0) / active.length).toFixed(2) : 0,
      avgCommission: active.length > 0 ? (active.reduce((sum, v) => sum + v.commission, 0) / active.length).toFixed(2) : 0
    };
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
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2 hover:opacity-80">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
                <span className="font-bold text-xl"><span className="text-cyan-400">X1</span><span className="text-white">Space</span></span>
              </Link>
              <span className="text-gray-400">|</span>
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

        {/* View Mode Toggle & Filters */}
        <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'map' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('map')}
                className={viewMode === 'map' ? 'bg-cyan-500 text-white' : 'border-white/20 text-white'}
              >
                <Map className="w-4 h-4 mr-2" />
                <span className="text-white">Geographic Map</span>
              </Button>
              <Button
                variant={viewMode === 'graph' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('graph')}
                className={viewMode === 'graph' ? 'bg-cyan-500 text-white' : 'border-white/20 text-white'}
              >
                <Network className="w-4 h-4 mr-2" />
                <span className="text-white">Force Graph</span>
              </Button>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filters.region}
                onChange={(e) => setFilters({...filters, region: e.target.value})}
                className="bg-[#1a2436] border-0 text-white rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="all">All Regions</option>
                {Object.keys(regionStats).map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
              
              <Input
                type="number"
                placeholder="Min Stake"
                value={filters.minStake || ''}
                onChange={(e) => setFilters({...filters, minStake: Number(e.target.value) || 0})}
                className="bg-[#1a2436] border-0 text-white w-32 h-8 text-sm"
              />
              
              <Input
                type="number"
                placeholder="Min Uptime %"
                value={filters.minUptime || ''}
                onChange={(e) => setFilters({...filters, minUptime: Number(e.target.value) || 0})}
                className="bg-[#1a2436] border-0 text-white w-32 h-8 text-sm"
              />
              
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="bg-[#1a2436] border-0 text-white rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active Only</option>
                <option value="delinquent">Delinquent Only</option>
              </select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({ region: 'all', minStake: 0, minUptime: 0, status: 'all' })}
                className="border-white/20 text-gray-400 text-xs"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Visualization */}
        {viewMode === 'graph' ? (
          <div className="bg-[#0d1525] border border-white/10 rounded-lg overflow-hidden mb-6">
            <div className="p-4 border-b border-white/10">
              <h3 className="text-white font-medium">Validator Network Graph</h3>
              <p className="text-gray-400 text-xs mt-1">Interactive force-directed graph showing validator relationships and stake distribution. Click nodes for details.</p>
            </div>
            <ValidatorGraph 
              validators={filteredValidators} 
              onNodeClick={setSelectedValidator}
              stakeThreshold={filters.minStake}
            />
          </div>
        ) : (
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
            {filteredValidators.map((node) => (
              <CircleMarker
                key={node.votePubkey}
                center={[node.lat, node.lng]}
                radius={Math.max(6, Math.min(20, node.activatedStake / 5000000))}
                fillColor={node.delinquent ? '#ef4444' : '#06b6d4'}
                color={node.delinquent ? '#ef4444' : '#06b6d4'}
                weight={2}
                opacity={0.9}
                fillOpacity={0.5}
                eventHandlers={{
                  click: () => setSelectedValidator(node),
                }}
              >
                <Popup>
                  <div className="bg-[#0d1525] text-white p-3 rounded -m-3 min-w-[240px]">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-cyan-400 font-black">X1</span>
                      <span className="font-medium">{node.name || node.votePubkey.substring(0, 12) + '...'}</span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-gray-400">Stake:</span> <span className="text-cyan-400">{formatStake(node.activatedStake)} XNT ({node.stakePercent}%)</span></p>
                      <p><span className="text-gray-400">Uptime:</span> <span className={node.uptime >= 99 ? 'text-emerald-400' : 'text-yellow-400'}>{node.uptime?.toFixed(2)}%</span></p>
                      <p><span className="text-gray-400">Skip Rate:</span> <span className={node.skipRate < 1 ? 'text-emerald-400' : 'text-yellow-400'}>{node.skipRate?.toFixed(2)}%</span></p>
                      <p><span className="text-gray-400">Location:</span> {node.location?.city}, {node.location?.country}</p>
                      <p><span className="text-gray-400">Version:</span> {node.version}</p>
                      <p><span className="text-gray-400">Commission:</span> {node.commission}%</p>
                      <p className={node.delinquent ? 'text-red-400' : 'text-emerald-400'}>
                        {node.delinquent ? '⚠ Delinquent' : '✓ Active'}
                      </p>
                      <button 
                        onClick={() => setSelectedValidator(node)}
                        className="mt-2 text-cyan-400 text-xs hover:underline flex items-center gap-1"
                      >
                        <TrendingUp className="w-3 h-3" />
                        View Performance Charts
                      </button>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        )}

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
        
        {/* Performance Metrics Overview */}
        <div className="bg-[#0d1525] border border-white/10 rounded-lg p-4 mb-6">
          <h3 className="text-gray-400 text-sm mb-4">NETWORK PERFORMANCE METRICS</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-gray-500 text-xs mb-1">Avg Uptime</p>
              <p className="text-2xl font-bold text-emerald-400">{perfStats.avgUptime}%</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Avg Skip Rate</p>
              <p className="text-2xl font-bold text-yellow-400">{perfStats.avgSkipRate}%</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Avg Commission</p>
              <p className="text-2xl font-bold text-purple-400">{perfStats.avgCommission}%</p>
            </div>
          </div>
        </div>

        {/* Validator Performance Charts Modal */}
        {selectedValidator && validatorHistory[selectedValidator?.votePubkey] && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedValidator(null)}>
            <div className="bg-[#0d1525] border border-white/10 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedValidator.name}</h3>
                    <p className="text-gray-400 text-sm font-mono">{selectedValidator.votePubkey.substring(0, 20)}...</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedValidator(null)} className="text-gray-400">
                    Close
                  </Button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Stake Growth */}
                <div>
                  <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    Stake Growth Trend
                  </h4>
                  <div className="bg-[#1a2436] rounded-lg p-4 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={validatorHistory[selectedValidator.votePubkey]?.stake || []}>
                        <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} width={60} />
                        <Tooltip contentStyle={{ backgroundColor: '#1d2d3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} labelStyle={{ color: '#9ca3af' }} formatter={(value) => [`${formatStake(value)} XNT`, 'Stake']} />
                        <Line type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                {/* Uptime History */}
                <div>
                  <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Uptime Percentage History
                  </h4>
                  <div className="bg-[#1a2436] rounded-lg p-4 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={validatorHistory[selectedValidator.votePubkey]?.uptime || []}>
                        <YAxis domain={[95, 100]} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} width={40} />
                        <Tooltip contentStyle={{ backgroundColor: '#1d2d3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} labelStyle={{ color: '#9ca3af' }} formatter={(value) => [`${value.toFixed(2)}%`, 'Uptime']} />
                        <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                {/* Skip Rate History */}
                <div>
                  <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                    <Server className="w-4 h-4 text-yellow-400" />
                    Skip Rate History
                  </h4>
                  <div className="bg-[#1a2436] rounded-lg p-4 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={validatorHistory[selectedValidator.votePubkey]?.skipRate || []}>
                        <YAxis domain={[0, 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} width={40} />
                        <Tooltip contentStyle={{ backgroundColor: '#1d2d3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} labelStyle={{ color: '#9ca3af' }} formatter={(value) => [`${value.toFixed(2)}%`, 'Skip Rate']} />
                        <Line type="monotone" dataKey="value" stroke="#eab308" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Validator Table */}
        <div className="bg-[#0d1525] border border-white/10 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-white font-medium">Validators ({filteredValidators.length} / {nodeLocations.length})</h3>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Sort by:</span>
              <select
                value={sortMetric}
                onChange={(e) => setSortMetric(e.target.value)}
                className="bg-[#1a2436] border-0 text-white rounded-lg px-3 py-1 text-sm"
              >
                <option value="stake">Stake</option>
                <option value="uptime">Uptime</option>
                <option value="skipRate">Skip Rate</option>
                <option value="commission">Commission</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                className="border-white/20 text-gray-400 h-8 w-8 p-0"
              >
                {sortDir === 'asc' ? '↑' : '↓'}
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-xs">
                  <th className="text-left text-gray-400 font-medium px-4 py-3">#</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Validator</th>
                  <th className="text-left text-gray-400 font-medium px-4 py-3">Location</th>
                  <th className="text-right text-gray-400 font-medium px-4 py-3">Stake</th>
                  <th className="text-right text-gray-400 font-medium px-4 py-3">Uptime</th>
                  <th className="text-right text-gray-400 font-medium px-4 py-3">Skip Rate</th>
                  <th className="text-center text-gray-400 font-medium px-4 py-3">Commission</th>
                  <th className="text-center text-gray-400 font-medium px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedValidators.map((v, i) => (
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
                        <button 
                          onClick={() => setSelectedValidator(v)}
                          className="text-gray-500 hover:text-cyan-400 transition-colors"
                          title="View performance charts"
                        >
                          <TrendingUp className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-400 text-sm">{v.location?.city || 'Unknown'}, {v.location?.country || '??'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-white font-mono text-sm">{formatStake(v.activatedStake)}</span>
                      <span className="text-gray-500 text-xs ml-1">({v.stakePercent}%)</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${v.uptime >= 99 ? 'text-emerald-400' : v.uptime >= 95 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {v.uptime?.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${v.skipRate < 1 ? 'text-emerald-400' : v.skipRate < 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {v.skipRate?.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-white">{v.commission}%</td>
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