import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Trophy, Medal, Crown, TrendingUp, Loader2, ArrowUp, ArrowDown
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';

export default function Leaderboard() {
  const [validators, setValidators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('stake');

  useEffect(() => {
    const fetchValidators = async () => {
      try {
        const data = await X1Rpc.getValidatorDetails();
        setValidators(data.filter(v => !v.delinquent));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchValidators();
  }, []);

  const sortedValidators = [...validators].sort((a, b) => {
    switch (sortBy) {
      case 'stake': return b.activatedStake - a.activatedStake;
      case 'uptime': return (b.uptime || 0) - (a.uptime || 0);
      case 'performance': return (a.skipRate || 100) - (b.skipRate || 100);
      case 'credits': return (b.creditsThisEpoch || 0) - (a.creditsThisEpoch || 0);
      default: return 0;
    }
  });

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
                <span className="text-white font-bold hidden sm:inline">X1</span>
                <span className="text-cyan-400 font-bold hidden sm:inline">.space</span>
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

        {/* Sort Options */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'stake', label: 'By Stake' },
            { key: 'uptime', label: 'By Uptime' },
            { key: 'performance', label: 'By Performance' },
            { key: 'credits', label: 'By Credits' }
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

        {/* Leaderboard */}
        <div className="space-y-2">
          {sortedValidators.slice(0, 50).map((v, i) => {
            const rank = i + 1;
            return (
              <Link key={v.votePubkey} to={createPageUrl('ValidatorDetail') + `?id=${v.votePubkey}`}>
                <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all hover:scale-[1.01] ${getRankBg(rank)}`}>
                  <div className="w-10 flex items-center justify-center">
                    {getRankIcon(rank)}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center text-lg">
                    {v.icon || '🔷'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">
                      {v.name || `${v.votePubkey.substring(0, 8)}...${v.votePubkey.slice(-4)}`}
                    </p>
                    <p className="text-gray-500 text-xs font-mono truncate">{v.votePubkey}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div className="text-right">
                      <p className="text-cyan-400 font-mono">{formatStake(v.activatedStake)}</p>
                      <p className="text-gray-600 text-xs">XNT</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono ${v.uptime >= 99 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {v.uptime?.toFixed(1)}%
                      </p>
                      <p className="text-gray-600 text-xs">uptime</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-mono">{v.skipRate?.toFixed(2)}%</p>
                      <p className="text-gray-600 text-xs">skip</p>
                    </div>
                    <div className="text-right">
                      <p className="text-purple-400 font-mono">{(v.creditsThisEpoch || 0).toLocaleString()}</p>
                      <p className="text-gray-600 text-xs">credits</p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}