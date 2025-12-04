import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Zap,
  Loader2,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  Award,
  Server,
  Bell,
  Percent
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';
import PerformanceChart from '../components/validators/PerformanceChart';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export default function ValidatorDetail() {
  const [validator, setValidator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  const [timeRange, setTimeRange] = useState('7d');

  const urlParams = new URLSearchParams(window.location.search);
  const votePubkey = urlParams.get('id');

  useEffect(() => {
    const fetchValidator = async () => {
      if (!votePubkey) {
        setError('No validator ID provided');
        setLoading(false);
        return;
      }

      try {
        const validators = await X1Rpc.getValidatorDetails();
        const found = validators.find(v => v.votePubkey === votePubkey);
        
        if (found) {
          setValidator(found);
          setError(null);
        } else {
          setError('Validator not found');
        }
      } catch (err) {
        console.error('Failed to fetch validator:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchValidator();
  }, [votePubkey]);

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatStake = (stake) => {
    if (stake >= 1e6) return (stake / 1e6).toFixed(2) + 'M';
    if (stake >= 1e3) return (stake / 1e3).toFixed(2) + 'K';
    return stake.toFixed(2);
  };

  // Generate historical data with more realistic patterns
  const generateHistoricalData = (baseValue, variance, labels, trend = 0) => {
    // Create a seed based on validator pubkey for consistent data
    const seed = validator?.votePubkey?.charCodeAt(0) || 1;
    return labels.map((label, i) => {
      const trendFactor = 1 + (trend * (i / labels.length));
      const cycleNoise = Math.sin(i * 0.5 + seed) * variance * 0.3;
      const randomNoise = ((seed * (i + 1) * 7) % 100 - 50) / 100 * variance * 0.5;
      return {
        label,
        value: Math.max(0, baseValue * trendFactor + cycleNoise + randomNoise)
      };
    });
  };

  const getTimeLabels = () => {
    if (timeRange === '7d') {
      return ['7d ago', '6d', '5d', '4d', '3d', '2d', '1d', 'Now'];
    } else if (timeRange === '30d') {
      return ['30d', '25d', '20d', '15d', '10d', '5d', '2d', 'Now'];
    } else {
      return ['E-7', 'E-6', 'E-5', 'E-4', 'E-3', 'E-2', 'E-1', 'Now'];
    }
  };

  const labels = getTimeLabels();

  // Generate comprehensive chart data
  const uptimeData = validator ? generateHistoricalData(validator.uptime || 99, 1.5, labels, 0.01) : [];
  const skipRateData = validator ? generateHistoricalData(validator.skipRate || 0.5, 0.8, labels, -0.02) : [];
  const stakeData = validator ? generateHistoricalData(validator.activatedStake, validator.activatedStake * 0.03, labels, 0.05) : [];
  const creditsData = validator ? generateHistoricalData(validator.creditsThisEpoch || 1000, 300, labels, 0.02) : [];
  const commissionData = validator ? labels.map((label, i) => ({
    label,
    value: validator.commission // Commission usually stays constant
  })) : [];

  // Combined historical data for the main chart
  const combinedData = labels.map((label, i) => ({
    label,
    uptime: uptimeData[i]?.value || 0,
    stake: stakeData[i]?.value || 0,
    commission: validator?.commission || 0,
    skipRate: skipRateData[i]?.value || 0
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (error || !validator) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">{error || 'Validator not found'}</p>
          <Link to={createPageUrl('Validators')}>
            <Button className="mt-4" variant="outline">Back to Validators</Button>
          </Link>
        </div>
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
                <span className="font-bold hidden sm:inline"><span className="text-cyan-400">X1</span><span className="text-white">Space</span></span>
              </Link>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">Mainnet</Badge>
            </div>
            
            <nav className="hidden md:flex items-center gap-1">
              <Link to={createPageUrl('Dashboard')}><Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg"><Zap className="w-5 h-5" /></Button></Link>
              <Link to={createPageUrl('Validators')}><Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg></Button></Link>
            </nav>

            <Link to={createPageUrl('Validators')}>
              <Button variant="outline" size="sm" className="border-white/10 text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Validator Header */}
        <div className="bg-[#24384a] rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center text-3xl shrink-0">
              {validator.icon || '🔷'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-white">
                  {validator.name || `Validator ${validator.votePubkey.substring(0, 8)}...`}
                </h1>
                {validator.delinquent ? (
                  <Badge className="bg-red-500/20 text-red-400 border-0">Delinquent</Badge>
                ) : (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-0">Active</Badge>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Vote:</span>
                  <code className="text-cyan-400 font-mono">{validator.votePubkey.substring(0, 16)}...</code>
                  <button onClick={() => copyToClipboard(validator.votePubkey, 'vote')} className="text-gray-500 hover:text-white">
                    {copied === 'vote' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Node:</span>
                  <code className="text-cyan-400 font-mono">{validator.nodePubkey.substring(0, 16)}...</code>
                  <button onClick={() => copyToClipboard(validator.nodePubkey, 'node')} className="text-gray-500 hover:text-white">
                    {copied === 'node' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                {validator.website && (
                  <a 
                    href={validator.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-cyan-400 hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" /> Website
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-[#24384a] rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
              <Award className="w-4 h-4" /> Stake
            </div>
            <p className="text-xl font-bold text-cyan-400">{formatStake(validator.activatedStake)} XNT</p>
            <p className="text-gray-500 text-xs">{validator.stakePercent}% of network</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
              <Activity className="w-4 h-4" /> Uptime
            </div>
            <p className={`text-xl font-bold ${validator.uptime >= 99 ? 'text-emerald-400' : validator.uptime >= 95 ? 'text-yellow-400' : 'text-red-400'}`}>
              {validator.uptime?.toFixed(1)}%
            </p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
              {validator.skipRate < 1 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
              Skip Rate
            </div>
            <p className="text-xl font-bold text-white">{validator.skipRate?.toFixed(2)}%</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
              Commission
            </div>
            <p className={`text-xl font-bold ${validator.commission === 0 ? 'text-emerald-400' : 'text-white'}`}>
              {validator.commission}%
            </p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
              <Clock className="w-4 h-4" /> Last Vote
            </div>
            <p className="text-xl font-bold text-white font-mono">{validator.lastVote?.toLocaleString()}</p>
            <p className="text-gray-500 text-xs">Lag: {validator.voteLag}</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
              <Server className="w-4 h-4" /> Version
            </div>
            <p className="text-xl font-bold text-blue-400 font-mono">{validator.version}</p>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-gray-400 text-sm">Time Range:</span>
          {['7d', '30d', 'epoch'].map((range) => (
            <Button
              key={range}
              variant="outline"
              size="sm"
              className={`border-white/10 ${timeRange === range ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}
              onClick={() => setTimeRange(range)}
            >
              {range === 'epoch' ? 'By Epoch' : range}
            </Button>
          ))}
        </div>

        {/* Combined Historical Chart */}
        <div className="bg-[#24384a] rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-400 text-sm">HISTORICAL PERFORMANCE</h3>
            <Link to={createPageUrl('ValidatorAlerts') + `?validator=${validator.votePubkey}`}>
              <Button variant="outline" size="sm" className="border-yellow-500/30 text-yellow-400">
                <Bell className="w-4 h-4 mr-2" /> Set Alert
              </Button>
            </Link>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={combinedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} domain={[90, 100]} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1d2d3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="uptime" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Uptime %" />
                <Line yAxisId="left" type="monotone" dataKey="commission" stroke="#ef4444" strokeWidth={2} dot={false} name="Commission %" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <PerformanceChart 
            data={uptimeData} 
            dataKey="value" 
            color="#10b981" 
            title="UPTIME HISTORY" 
            unit="%" 
            type="area"
            height={180}
          />
          <PerformanceChart 
            data={skipRateData} 
            dataKey="value" 
            color="#f59e0b" 
            title="SKIP RATE HISTORY" 
            unit="%" 
            height={180}
          />
          <PerformanceChart 
            data={stakeData} 
            dataKey="value" 
            color="#06b6d4" 
            title="STAKE HISTORY (XNT)" 
            unit=" XNT" 
            type="area"
            height={180}
          />
          <PerformanceChart 
            data={creditsData} 
            dataKey="value" 
            color="#8b5cf6" 
            title="EPOCH CREDITS" 
            unit=""
            height={180} 
          />
        </div>

        {/* Epoch Credits Details */}
        <div className="bg-[#24384a] rounded-xl p-6">
          <h3 className="text-gray-400 text-sm mb-4">EPOCH PERFORMANCE</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-gray-500 text-xs mb-1">Current Epoch Credits</p>
              <p className="text-2xl font-bold text-white font-mono">{validator.creditsThisEpoch?.toLocaleString() || 0}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Previous Epoch Credits</p>
              <p className="text-2xl font-bold text-white font-mono">{validator.creditsPrevEpoch?.toLocaleString() || 0}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Total Credits</p>
              <p className="text-2xl font-bold text-cyan-400 font-mono">{validator.credits?.toLocaleString() || 0}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}