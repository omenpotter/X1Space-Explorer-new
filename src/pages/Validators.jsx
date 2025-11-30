import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Zap,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  Scale,
  Star,
  Trophy
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';
import ValidatorCard from '../components/validators/ValidatorCard';
import StakeDistribution from '../components/validators/StakeDistribution';
import ExportButton from '../components/common/ExportButton';

export default function Validators() {
  const [validators, setValidators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('activatedStake');
  const [sortOrder, setSortOrder] = useState('desc');
  const [stats, setStats] = useState({ total: 0, active: 0, delinquent: 0, totalStake: 0, avgUptime: 0 });
  const [page, setPage] = useState(1);
  const perPage = 25;

  const fetchValidators = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const data = await X1Rpc.getValidatorDetails();
      setValidators(data);
      
      const active = data.filter(v => !v.delinquent).length;
      const totalStake = data.reduce((sum, v) => sum + v.activatedStake, 0);
      const avgUptime = data.reduce((sum, v) => sum + (v.uptime || 0), 0) / data.length;
      
      setStats({
        total: data.length,
        active,
        delinquent: data.length - active,
        totalStake,
        avgUptime: avgUptime.toFixed(1)
      });
      setError(null);
    } catch (err) {
      console.error('Failed to fetch validators:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchValidators();
    const interval = setInterval(fetchValidators, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const filteredValidators = validators
    .filter(v => {
      const query = searchQuery.toLowerCase();
      return v.votePubkey.toLowerCase().includes(query) || 
             v.nodePubkey.toLowerCase().includes(query) ||
             (v.name && v.name.toLowerCase().includes(query));
    })
    .sort((a, b) => {
      const order = sortOrder === 'desc' ? -1 : 1;
      if (sortBy === 'name') {
        return ((a.name || 'zzz').localeCompare(b.name || 'zzz')) * order;
      }
      return (a[sortBy] - b[sortBy]) * order;
    });

  const paginatedValidators = filteredValidators.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(filteredValidators.length / perPage);

  const formatStake = (stake) => {
    if (stake >= 1e6) return (stake / 1e6).toFixed(2) + 'M';
    if (stake >= 1e3) return (stake / 1e3).toFixed(2) + 'K';
    return stake.toFixed(2);
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
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2 hover:opacity-80">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
                <span className="font-bold"><span className="text-cyan-400">X1</span><span className="text-white">Space</span></span>
              </Link>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">Mainnet</Badge>
            </div>
            
            <nav className="hidden md:flex items-center gap-1">
              <Link to={createPageUrl('Dashboard')}><Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg"><Zap className="w-5 h-5" /></Button></Link>
              <Link to={createPageUrl('Blocks')}><Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg></Button></Link>
              <Link to={createPageUrl('Validators')}><Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg></Button></Link>
              <Link to={createPageUrl('Transactions')}><Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg></Button></Link>
            </nav>
            
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Input placeholder="Search validators..." className="w-full bg-[#24384a] border-0 text-white placeholder:text-gray-500 pr-10 rounded-lg" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                <Button size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 bg-cyan-500 hover:bg-cyan-600 h-7 w-7 rounded"><Search className="w-4 h-4 text-black" /></Button>
              </div>
            </div>
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
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Total Validators</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Active</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.active}</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Delinquent</p>
            <p className="text-2xl font-bold text-red-400">{stats.delinquent}</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Total Stake</p>
            <p className="text-2xl font-bold text-cyan-400">{formatStake(stats.totalStake)} XNT</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Avg Uptime</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.avgUptime}%</p>
          </div>
        </div>

        {/* Stake Distribution Chart */}
        {validators.length > 0 && (
          <StakeDistribution validators={validators} totalStake={stats.totalStake} />
        )}

        {/* Refresh Button */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">All Validators</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={createPageUrl('Leaderboard')}>
              <Button variant="outline" size="sm" className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10">
                <Trophy className="w-4 h-4 mr-2" />
                Leaderboard
              </Button>
            </Link>
            <Link to={createPageUrl('Watchlist')}>
              <Button variant="outline" size="sm" className="border-white/10 text-gray-400 hover:text-white">
                <Star className="w-4 h-4 mr-2" />
                Watchlist
              </Button>
            </Link>
            <Link to={createPageUrl('ValidatorCompare')}>
              <Button variant="outline" size="sm" className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
                <Scale className="w-4 h-4 mr-2" />
                Compare
              </Button>
            </Link>
            <ExportButton 
              data={validators.map(v => ({
                name: v.name || '',
                votePubkey: v.votePubkey,
                stake: v.activatedStake,
                commission: v.commission,
                uptime: v.uptime,
                skipRate: v.skipRate,
                version: v.version,
                status: v.delinquent ? 'delinquent' : 'active'
              }))}
              filename="x1_validators"
            />
            <Button 
              onClick={() => fetchValidators(true)} 
              variant="outline" 
              size="sm" 
              className="border-white/10 text-gray-400 hover:text-white"
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="bg-[#24384a] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">#</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3 cursor-pointer hover:text-white" onClick={() => toggleSort('name')}>
                    <div className="flex items-center gap-1">Validator <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3 cursor-pointer hover:text-white" onClick={() => toggleSort('activatedStake')}>
                    <div className="flex items-center justify-end gap-1">Stake <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="text-center text-gray-400 text-xs font-medium px-4 py-3 cursor-pointer hover:text-white" onClick={() => toggleSort('commission')}>
                    <div className="flex items-center justify-center gap-1">Commission <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="text-center text-gray-400 text-xs font-medium px-4 py-3 cursor-pointer hover:text-white" onClick={() => toggleSort('uptime')}>
                    <div className="flex items-center justify-center gap-1">Performance <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="text-center text-gray-400 text-xs font-medium px-4 py-3">Version</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3 cursor-pointer hover:text-white" onClick={() => toggleSort('lastVote')}>
                    <div className="flex items-center justify-end gap-1">Last Vote <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="text-center text-gray-400 text-xs font-medium px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedValidators.map((v, i) => (
                  <ValidatorCard 
                    key={v.votePubkey} 
                    validator={v} 
                    rank={(page - 1) * perPage + i + 1}
                    totalStake={stats.totalStake}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <p className="text-gray-400 text-sm">
            Showing <span className="text-white">{(page - 1) * perPage + 1}-{Math.min(page * perPage, filteredValidators.length)}</span> of <span className="text-white">{filteredValidators.length}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="border-white/10 text-gray-400 disabled:opacity-30"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <Button 
                  key={pageNum}
                  variant="outline" 
                  size="sm" 
                  className={`border-white/10 ${page === pageNum ? 'bg-cyan-500/10 text-cyan-400' : 'text-gray-400'}`}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            <Button 
              variant="outline" 
              size="sm" 
              className="border-white/10 text-gray-400 disabled:opacity-30"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}