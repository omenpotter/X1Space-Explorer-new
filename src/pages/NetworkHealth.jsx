import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Loader2, AlertCircle, Globe, Server, Activity, 
  CheckCircle, XCircle, Clock, Wifi, ChevronLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import X1Rpc from '../components/x1/X1RpcService';

export default function NetworkHealth() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [validators, setValidators] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashData, validatorData] = await Promise.all([
          X1Rpc.getDashboardData(),
          X1Rpc.getValidatorDetails()
        ]);
        setData(dashData);
        setValidators(validatorData);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
      </div>
    );
  }

  // Version distribution
  const versionCounts = {};
  validators.forEach(v => {
    const ver = v.version || 'unknown';
    versionCounts[ver] = (versionCounts[ver] || 0) + 1;
  });
  const versionData = Object.entries(versionCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Status distribution
  const activeCount = validators.filter(v => !v.delinquent).length;
  const delinquentCount = validators.filter(v => v.delinquent).length;
  const statusData = [
    { name: 'Active', value: activeCount, color: '#10b981' },
    { name: 'Delinquent', value: delinquentCount, color: '#ef4444' }
  ];

  // Stake distribution by commission
  const commissionBuckets = { '0%': 0, '1-5%': 0, '6-10%': 0, '>10%': 0 };
  validators.forEach(v => {
    if (v.commission === 0) commissionBuckets['0%'] += v.activatedStake;
    else if (v.commission <= 5) commissionBuckets['1-5%'] += v.activatedStake;
    else if (v.commission <= 10) commissionBuckets['6-10%'] += v.activatedStake;
    else commissionBuckets['>10%'] += v.activatedStake;
  });
  const commissionData = Object.entries(commissionBuckets).map(([name, value]) => ({
    name,
    value: value / 1e6
  }));

  const COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981'];

  return (
    <div className="min-h-screen bg-[#1d2d3a] text-white">
      <header className="bg-[#1d2d3a] border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2 hover:opacity-80">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
                <span className="font-bold"><span className="text-cyan-400">X1</span><span className="text-white">Space</span></span>
              </Link>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">Mainnet</Badge>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              <Link to={createPageUrl('Dashboard')}><Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg"><Zap className="w-5 h-5" /></Button></Link>
              <Link to={createPageUrl('NetworkHealth')}><Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg"><Globe className="w-5 h-5" /></Button></Link>
              <Link to={createPageUrl('Validators')}><Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg"><Server className="w-5 h-5" /></Button></Link>
            </nav>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2">
          <div className="max-w-[1800px] mx-auto flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" /><span>{error}</span>
          </div>
        </div>
      )}

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
          <Globe className="w-7 h-7 text-cyan-400" />
          Network Health
        </h1>

        {/* Health Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#24384a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wifi className="w-4 h-4 text-emerald-400" />
              <span className="text-gray-400 text-xs">Network Status</span>
            </div>
            <p className="text-xl font-bold text-emerald-400">Healthy</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-gray-400 text-xs">Current TPS</span>
            </div>
            <p className="text-xl font-bold text-cyan-400">{data?.tps?.toLocaleString() || 0}</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-gray-400 text-xs">Active Validators</span>
            </div>
            <p className="text-xl font-bold text-white">{activeCount}</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-gray-400 text-xs">Delinquent</span>
            </div>
            <p className="text-xl font-bold text-red-400">{delinquentCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Version Distribution */}
          <div className="bg-[#24384a] rounded-xl p-4">
            <h3 className="text-gray-400 text-sm mb-4">VERSION DISTRIBUTION</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={versionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                    {versionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1d2d3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Validator Status */}
          <div className="bg-[#24384a] rounded-xl p-4">
            <h3 className="text-gray-400 text-sm mb-4">VALIDATOR STATUS</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1d2d3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Commission Distribution */}
          <div className="bg-[#24384a] rounded-xl p-4">
            <h3 className="text-gray-400 text-sm mb-4">STAKE BY COMMISSION</h3>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={commissionData}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1d2d3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} formatter={(value) => `${value.toFixed(1)}M XNT`} />
                  <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}