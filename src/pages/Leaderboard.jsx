import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Zap, Trophy, Medal, Crown, TrendingUp, Loader2, ArrowUp, ArrowDown,
  Search, Star, Filter, ChevronLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';
import { getDisplayName, getValidatorIcon } from '../components/x1/ValidatorNames';

export default function Leaderboard() {
  const [validators, setValidators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('stake');
  const [blockProduction, setBlockProduction] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [followedValidators, setFollowedValidators] = useState(() => {
    const saved = localStorage.getItem('x1space-followed-validators');
    return saved ? JSON.parse(saved) : [];
  });
  const [filterCommission, setFilterCommission] = useState('all');
  const [showFollowedOnly, setShowFollowedOnly] = useState(false);

  useEffect(() => {
    const fetchValidators = async () => {
      try {
        const [data, blockProd] = await Promise.all([
          X1Rpc.getValidatorDetails(),
          X1Rpc.getBlockProduction().catch(() => null)
        ]);
        setValidators(data.filter(v => !v.delinquent));
        setBlockProduction(blockProd);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchValidators();
  }, []);

  // Calculate actual skip rate from block production
  const getActualSkipRate = (validator) => {
    if (blockProduction?.value?.byIdentity) {
      const identity = validator.nodePubkey;
      const prodData = blockProduction.value.byIdentity[identity];
      if (prodData) {
        const [leaderSlots, blocksProduced] = prodData;
        if (leaderSlots > 0) {
          return ((leaderSlots - blocksProduced) / leaderSlots * 100);
        }
      }
    }
    // Fallback based on vote lag
    const voteLag = validator.voteLag || 0;
    if (voteLag < 50) return Math.max(0.1, voteLag * 0.02);
    if (voteLag < 150) return 1 + (voteLag - 50) * 0.03;
    return 5 + (voteLag - 150) * 0.05;
  };

  const toggleFollow = (votePubkey) => {
    setFollowedValidators(prev => {
      const newList = prev.includes(votePubkey) 
        ? prev.filter(v => v !== votePubkey)
        : [...prev, votePubkey];
      localStorage.setItem('x1space-followed-validators', JSON.stringify(newList));
      return newList;
    });
  };

  const filteredAndSortedValidators = useMemo(() => {
    let filtered = validators;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v => 
        v.votePubkey.toLowerCase().includes(query) ||
        v.nodePubkey.toLowerCase().includes(query) ||
        (v.name && v.name.toLowerCase().includes(query))
      );
    }
    
    // Commission filter
    if (filterCommission !== 'all') {
      filtered = filtered.filter(v => {
        if (filterCommission === '0') return v.commission === 0;
        if (filterCommission === '1-5') return v.commission >= 1 && v.commission <= 5;
        if (filterCommission === '6-10') return v.commission >= 6 && v.commission <= 10;
        if (filterCommission === '10+') return v.commission > 10;
        return true;
      });
    }
    
    // Followed only filter
    if (showFollowedOnly) {
      filtered = filtered.filter(v => followedValidators.includes(v.votePubkey));
    }
    
    // Sort
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'stake': return b.activatedStake - a.activatedStake;
        case 'uptime': return (b.uptime || 0) - (a.uptime || 0);
        case 'performance': return getActualSkipRate(a) - getActualSkipRate(b);
        case 'credits': return (b.creditsThisEpoch || 0) - (a.creditsThisEpoch || 0);
        case 'commission': return a.commission - b.commission;
        default: return 0;
      }
    });
  }, [validators, sortBy, searchQuery, filterCommission, showFollowedOnly, followedValidators, blockProduction]);

  const formatStake = (stake) => {
    if (stake >= 1e6) return (stake / 1e6).toFixed(2) + 'M';
    if (stake >= 1e3) return (stake / 1e3).toFixed(1) + 'K';
    return stake?.toFixed(0) || '0';
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-300" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="text-gray-500 font-mono">{rank}</span>;
  };

  const getRankBg = (rank) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-500/20 to-transparent border-yellow-500/30';
    if (rank === 2) return 'bg-gradient-to-r from-gray-400/20 to-transparent border-gray-400/30';
    if (rank === 3) return 'bg-gradient-to-r from-amber-600/20 to-transparent border-amber-600/30';
    return 'bg-[#24384a] border-white/5';
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
                <span className="font-bold hidden sm:inline"><span className="text-cyan-400">X1</span><span className="text-white">Space</span></span>
              </Link>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">Mainnet</Badge>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              <Link to={createPageUrl('Dashboard')}><Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg"><Zap className="w-5 h-5" /></Button></Link>
              <Link to={createPageUrl('Leaderboard')}><Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg"><Trophy className="w-5 h-5" /></Button></Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
          <Trophy className="w-7 h-7 text-yellow-400" />
          Validator Leaderboard
        </h1>

        {/* Search and Filters */}
        <div className="bg-[#24384a] rounded-xl p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Input
                placeholder="Search by name or pubkey..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#1d2d3a] border-0 text-white pl-10"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFollowedOnly(!showFollowedOnly)}
              className={`border-white/10 ${showFollowedOnly ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-400'}`}
            >
              <Star className={`w-4 h-4 mr-2 ${showFollowedOnly ? 'fill-yellow-400' : ''}`} />
              Following ({followedValidators.length})
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="text-gray-400 text-sm flex items-center gap-2">
              <Filter className="w-4 h-4" /> Commission:
            </span>
            {[
              { key: 'all', label: 'All' },
              { key: '0', label: '0%' },
              { key: '1-5', label: '1-5%' },
              { key: '6-10', label: '6-10%' },
              { key: '10+', label: '>10%' }
            ].map((opt) => (
              <Button
                key={opt.key}
                variant="outline"
                size="sm"
                onClick={() => setFilterCommission(opt.key)}
                className={`border-white/10 h-7 text-xs ${filterCommission === opt.key ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Sort Options */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'stake', label: 'By Stake' },
            { key: 'uptime', label: 'By Uptime' },
            { key: 'performance', label: 'By Skip Rate' },
            { key: 'credits', label: 'By Credits' },
            { key: 'commission', label: 'By Commission' }
          ].map((option) => (
            <Button
              key={option.key}
              variant="outline"
              size="sm"
              className={`border-white/10 ${sortBy === option.key ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}
              onClick={() => setSortBy(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <p className="text-gray-500 text-sm mb-4">
          Showing {filteredAndSortedValidators.length} of {validators.length} validators
        </p>

        {/* Leaderboard */}
        <div className="space-y-2">
          {filteredAndSortedValidators.slice(0, 100).map((v, i) => {
            const rank = i + 1;
            const skipRate = getActualSkipRate(v);
            const isFollowed = followedValidators.includes(v.votePubkey);
            // Get display name based on stake
            const displayName = v.name || getDisplayName(v.votePubkey, v.nodePubkey, v.activatedStake * 1e9);
            const validatorIcon = v.icon || getValidatorIcon(v.votePubkey, v.nodePubkey, v.activatedStake * 1e9);
            
            return (
              <div key={v.votePubkey} className={`flex items-center gap-4 p-4 rounded-xl border transition-all hover:scale-[1.01] ${getRankBg(rank)}`}>
                <div className="w-10 flex items-center justify-center">
                  {getRankIcon(rank)}
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFollow(v.votePubkey);
                  }}
                  className="text-gray-500 hover:text-yellow-400 transition-colors"
                >
                  <Star className={`w-5 h-5 ${isFollowed ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                </button>
                <Link to={createPageUrl('ValidatorDetail') + `?id=${v.votePubkey}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center text-lg shrink-0">
                    {validatorIcon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">
                      {displayName}
                    </p>
                    <p className="text-gray-500 text-xs font-mono truncate">{v.votePubkey}</p>
                  </div>
                </Link>
                <div className="grid grid-cols-4 gap-4 text-sm shrink-0">
                  <div className="text-right">
                    <p className="text-cyan-400 font-mono">{formatStake(v.activatedStake)}</p>
                    <p className="text-gray-600 text-xs">XNT</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono ${v.uptime >= 99 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      {v.uptime?.toFixed(1) || '99.0'}%
                    </p>
                    <p className="text-gray-600 text-xs">uptime</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono ${skipRate < 2 ? 'text-emerald-400' : skipRate < 5 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {skipRate.toFixed(2)}%
                    </p>
                    <p className="text-gray-600 text-xs">skip</p>
                  </div>
                  <div className="text-right">
                    <p className="text-purple-400 font-mono">{v.commission}%</p>
                    <p className="text-gray-600 text-xs">comm</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}