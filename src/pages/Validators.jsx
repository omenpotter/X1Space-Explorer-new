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
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';

export default function Validators() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('activatedStake');
  const [sortOrder, setSortOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [validators, setValidators] = useState([]);
  const [stats, setStats] = useState({ total: 0, delinquent: 0, totalStake: 0 });
  const [page, setPage] = useState(1);
  const perPage = 20;

  const fetchValidators = async () => {
    try {
      setLoading(true);
      const data = await X1Rpc.getValidatorDetails();
      
      const active = data.filter(v => !v.delinquent);
      const delinquent = data.filter(v => v.delinquent);
      const totalStake = data.reduce((sum, v) => sum + v.activatedStake, 0);
      
      setValidators(data);
      setStats({
        total: data.length,
        active: active.length,
        delinquent: delinquent.length,
        totalStake
      });
      setError(null);
    } catch (err) {
      console.error('Failed to fetch validators:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchValidators();
    const interval = setInterval(fetchValidators, 30000); // Refresh every 30 seconds
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
    .filter(v => 
      v.votePubkey.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.nodePubkey.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const order = sortOrder === 'desc' ? -1 : 1;
      return (a[sortBy] - b[sortBy]) * order;
    });

  const totalPages = Math.ceil(filteredValidators.length / perPage);
  const paginatedValidators = filteredValidators.slice((page - 1) * perPage, page * perPage);

  const formatStake = (stake) => {
    if (stake >= 1e9) return (stake / 1e9).toFixed(2) + 'B';
    if (stake >= 1e6) return (stake / 1e6).toFixed(2) + 'M';
    if (stake >= 1e3) return (stake / 1e3).toFixed(2) + 'K';
    return stake.toFixed(2);
  };

  const shortenPubkey = (pubkey) => {
    if (!pubkey) return '-';
    return `${pubkey.substring(0, 4)}...${pubkey.substring(pubkey.length - 4)}`;
  };

  if (loading && validators.length === 0) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading validators from X1 Network...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1d2d3a] text-white">
      {/* Header */}
      <header className="bg-[#1d2d3a] border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-black font-black text-sm">X1</span>
                </div>
                <div className="hidden sm:block">
                  <span className="text-white font-bold">X1</span>
                  <span className="text-cyan-400 font-bold">.space</span>
                </div>
              </Link>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">Mainnet</Badge>
            </div>
            
            <nav className="hidden md:flex items-center gap-1">
              <Link to={createPageUrl('Dashboard')}>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                  <Zap className="w-5 h-5" />
                </Button>
              </Link>
              <Link to={createPageUrl('Blocks')}>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                  </svg>
                </Button>
              </Link>
              <Link to={createPageUrl('Validators')}>
                <Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3v18h18" />
                    <path d="M18 17V9" />
                    <path d="M13 17V5" />
                    <path d="M8 17v-3" />
                  </svg>
                </Button>
              </Link>
              <Link to={createPageUrl('Transactions')}>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </Button>
              </Link>
            </nav>
            
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Input
                  placeholder="Search validators by pubkey..."
                  className="w-full bg-[#24384a] border-0 text-white placeholder:text-gray-500 pr-10 rounded-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button 
                  size="icon" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 bg-cyan-500 hover:bg-cyan-600 h-7 w-7 rounded"
                >
                  <Search className="w-4 h-4 text-black" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2">
          <div className="max-w-[1800px] mx-auto flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Error: {error}</span>
            <Button variant="ghost" size="sm" onClick={fetchValidators} className="ml-auto text-red-400">
              Retry
            </Button>
          </div>
        </div>
      )}

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Total Validators</p>
            <p className="text-2xl font-bold text-white">{stats.total.toLocaleString()}</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Active</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.active?.toLocaleString() || '-'}</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Delinquent</p>
            <p className="text-2xl font-bold text-red-400">{stats.delinquent}</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Total Stake</p>
            <p className="text-2xl font-bold text-cyan-400">{formatStake(stats.totalStake)} XNT</p>
          </div>
        </div>

        {/* Validators Table */}
        <div className="bg-[#24384a] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">#</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Vote Account</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Node</th>
                  <th 
                    className="text-right text-gray-400 text-xs font-medium px-4 py-3 cursor-pointer hover:text-white"
                    onClick={() => toggleSort('activatedStake')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Stake <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th 
                    className="text-right text-gray-400 text-xs font-medium px-4 py-3 cursor-pointer hover:text-white"
                    onClick={() => toggleSort('commission')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Commission <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="text-center text-gray-400 text-xs font-medium px-4 py-3">Version</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Last Vote</th>
                  <th className="text-center text-gray-400 text-xs font-medium px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedValidators.map((validator, index) => {
                  const rank = (page - 1) * perPage + index + 1;
                  const stakePercent = ((validator.activatedStake / stats.totalStake) * 100).toFixed(2);
                  
                  return (
                    <tr 
                      key={validator.votePubkey}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-4 text-gray-500 text-sm">{rank}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center text-xs font-bold text-cyan-400">
                            V{rank}
                          </div>
                          <div>
                            <p className="font-mono text-cyan-400 text-sm hover:underline cursor-pointer">
                              {shortenPubkey(validator.votePubkey)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-mono text-gray-400 text-xs">
                          {shortenPubkey(validator.nodePubkey)}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="text-white font-mono text-sm">{formatStake(validator.activatedStake)}</p>
                        <p className="text-gray-500 text-xs">{stakePercent}%</p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Badge className={`${validator.commission === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-400'} border-0`}>
                          {validator.commission}%
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge className="bg-blue-500/20 text-blue-400 border-0 font-mono text-xs">
                          {validator.version || 'unknown'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-gray-400 font-mono text-xs">
                          {validator.lastVote?.toLocaleString() || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {validator.delinquent ? (
                          <Badge className="bg-red-500/20 text-red-400 border-0">Delinquent</Badge>
                        ) : (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-0">Active</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <p className="text-gray-400 text-sm">
            Showing <span className="text-white">{(page - 1) * perPage + 1}-{Math.min(page * perPage, filteredValidators.length)}</span> of <span className="text-white">{filteredValidators.length}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="border-white/10 text-gray-400"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-gray-400 text-sm px-2">
              Page {page} of {totalPages}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              className="border-white/10 text-gray-400"
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