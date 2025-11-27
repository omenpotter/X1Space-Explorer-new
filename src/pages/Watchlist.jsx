import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Star, Plus, Trash2, Bell, BellOff, ExternalLink,
  TrendingUp, TrendingDown, Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';

export default function Watchlist() {
  const [validators, setValidators] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    // Load watchlist from localStorage
    const saved = localStorage.getItem('x1_watchlist');
    if (saved) {
      setWatchlist(JSON.parse(saved));
    }

    const fetchValidators = async () => {
      try {
        const data = await X1Rpc.getValidatorDetails();
        setValidators(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchValidators();
  }, []);

  const addToWatchlist = (validator) => {
    if (watchlist.find(w => w.votePubkey === validator.votePubkey)) return;
    const newList = [...watchlist, { 
      votePubkey: validator.votePubkey, 
      name: validator.name,
      icon: validator.icon,
      alerts: true,
      addedAt: new Date().toISOString()
    }];
    setWatchlist(newList);
    localStorage.setItem('x1_watchlist', JSON.stringify(newList));
    setShowAdd(false);
  };

  const removeFromWatchlist = (votePubkey) => {
    const newList = watchlist.filter(w => w.votePubkey !== votePubkey);
    setWatchlist(newList);
    localStorage.setItem('x1_watchlist', JSON.stringify(newList));
  };

  const toggleAlerts = (votePubkey) => {
    const newList = watchlist.map(w => 
      w.votePubkey === votePubkey ? { ...w, alerts: !w.alerts } : w
    );
    setWatchlist(newList);
    localStorage.setItem('x1_watchlist', JSON.stringify(newList));
  };

  const getValidatorData = (votePubkey) => {
    return validators.find(v => v.votePubkey === votePubkey);
  };

  const filteredValidators = validators.filter(v => {
    const query = searchQuery.toLowerCase();
    const inWatchlist = watchlist.find(w => w.votePubkey === v.votePubkey);
    if (inWatchlist) return false;
    return v.votePubkey.toLowerCase().includes(query) || 
           (v.name && v.name.toLowerCase().includes(query));
  });

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
            <nav className="hidden md:flex items-center gap-1">
              <Link to={createPageUrl('Dashboard')}><Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg"><Zap className="w-5 h-5" /></Button></Link>
              <Link to={createPageUrl('Watchlist')}><Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg"><Star className="w-5 h-5" /></Button></Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Star className="w-7 h-7 text-yellow-400" />
            Watchlist
          </h1>
          <Button 
            onClick={() => setShowAdd(!showAdd)} 
            className="bg-cyan-500 hover:bg-cyan-600"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Validator
          </Button>
        </div>

        {/* Add Validator Panel */}
        {showAdd && (
          <div className="bg-[#24384a] rounded-xl p-4 mb-6">
            <Input
              placeholder="Search validators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#1d2d3a] border-0 text-white mb-4"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
              {filteredValidators.slice(0, 20).map((v) => (
                <button
                  key={v.votePubkey}
                  onClick={() => addToWatchlist(v)}
                  className="flex items-center gap-3 p-3 bg-[#1d2d3a] rounded-lg hover:bg-[#263d50] transition-colors text-left"
                >
                  <span>{v.icon || '🔷'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{v.name || v.votePubkey.substring(0, 12) + '...'}</p>
                    <p className="text-gray-500 text-xs">{formatStake(v.activatedStake)} XNT</p>
                  </div>
                  <Plus className="w-4 h-4 text-cyan-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Watchlist */}
        {watchlist.length === 0 ? (
          <div className="bg-[#24384a] rounded-xl p-8 text-center">
            <Star className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Your watchlist is empty</p>
            <p className="text-gray-500 text-sm mt-2">Add validators to track their performance</p>
          </div>
        ) : (
          <div className="space-y-3">
            {watchlist.map((item) => {
              const data = getValidatorData(item.votePubkey);
              return (
                <div key={item.votePubkey} className="bg-[#24384a] rounded-xl p-4">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{item.icon || '🔷'}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium">{item.name || item.votePubkey.substring(0, 12) + '...'}</p>
                        {data?.delinquent && (
                          <Badge className="bg-red-500/20 text-red-400 border-0 text-xs">Delinquent</Badge>
                        )}
                      </div>
                      {data && (
                        <div className="flex items-center gap-4 mt-1 text-sm">
                          <span className="text-cyan-400">{formatStake(data.activatedStake)} XNT</span>
                          <span className={`flex items-center gap-1 ${data.uptime >= 99 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                            {data.uptime >= 99 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {data.uptime?.toFixed(1)}% uptime
                          </span>
                          <span className="text-gray-500">{data.commission}% comm</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleAlerts(item.votePubkey)}
                        className={item.alerts ? 'text-yellow-400' : 'text-gray-500'}
                      >
                        {item.alerts ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                      </Button>
                      <Link to={createPageUrl('ValidatorDetail') + `?id=${item.votePubkey}`}>
                        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-cyan-400">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFromWatchlist(item.votePubkey)}
                        className="text-gray-500 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}