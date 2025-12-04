import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Zap, Star, Plus, Trash2, Bell, BellOff, ExternalLink,
  TrendingUp, TrendingDown, Loader2, Wallet, History, RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';
import { getDisplayName, getValidatorIcon } from '../components/x1/ValidatorNames';

export default function Watchlist() {
  const [validators, setValidators] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [addressWatchlist, setAddressWatchlist] = useState([]);
  const [addressData, setAddressData] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [activeTab, setActiveTab] = useState('validators');
  const [refreshingAddresses, setRefreshingAddresses] = useState(false);

  useEffect(() => {
    // Load watchlists from localStorage
    const saved = localStorage.getItem('x1_watchlist');
    const savedAddresses = localStorage.getItem('x1_address_watchlist');
    if (saved) {
      setWatchlist(JSON.parse(saved));
    }
    if (savedAddresses) {
      setAddressWatchlist(JSON.parse(savedAddresses));
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

  // Fetch address data for watchlist
  useEffect(() => {
    const fetchAddressData = async () => {
      if (addressWatchlist.length === 0) return;
      
      const newData = {};
      for (const addr of addressWatchlist) {
        try {
          const [balance, signatures] = await Promise.all([
            X1Rpc.getBalance(addr.address),
            X1Rpc.getSignaturesForAddress(addr.address, { limit: 5 })
          ]);
          newData[addr.address] = {
            balance: (balance?.value || 0) / 1e9,
            recentTxCount: signatures?.length || 0,
            lastTx: signatures?.[0]?.blockTime ? new Date(signatures[0].blockTime * 1000) : null
          };
        } catch (e) {
          newData[addr.address] = { balance: 0, recentTxCount: 0, lastTx: null };
        }
      }
      setAddressData(newData);
    };
    
    fetchAddressData();
  }, [addressWatchlist]);

  const refreshAddressData = async () => {
    setRefreshingAddresses(true);
    const newData = {};
    for (const addr of addressWatchlist) {
      try {
        const [balance, signatures] = await Promise.all([
          X1Rpc.getBalance(addr.address),
          X1Rpc.getSignaturesForAddress(addr.address, { limit: 5 })
        ]);
        newData[addr.address] = {
          balance: (balance?.value || 0) / 1e9,
          recentTxCount: signatures?.length || 0,
          lastTx: signatures?.[0]?.blockTime ? new Date(signatures[0].blockTime * 1000) : null
        };
      } catch (e) {
        newData[addr.address] = { balance: 0, recentTxCount: 0, lastTx: null };
      }
    }
    setAddressData(newData);
    setRefreshingAddresses(false);
  };

  const addAddress = () => {
    if (!addressInput || addressInput.length < 32) return;
    if (addressWatchlist.find(a => a.address === addressInput)) return;
    
    const newList = [...addressWatchlist, {
      address: addressInput,
      label: '',
      alerts: true,
      addedAt: new Date().toISOString()
    }];
    setAddressWatchlist(newList);
    localStorage.setItem('x1_address_watchlist', JSON.stringify(newList));
    setAddressInput('');
  };

  const removeAddress = (address) => {
    const newList = addressWatchlist.filter(a => a.address !== address);
    setAddressWatchlist(newList);
    localStorage.setItem('x1_address_watchlist', JSON.stringify(newList));
  };

  const updateAddressLabel = (address, label) => {
    const newList = addressWatchlist.map(a => 
      a.address === address ? { ...a, label } : a
    );
    setAddressWatchlist(newList);
    localStorage.setItem('x1_address_watchlist', JSON.stringify(newList));
  };

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
           v.nodePubkey.toLowerCase().includes(query) ||
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
                <span className="font-bold hidden sm:inline"><span className="text-cyan-400">X1</span><span className="text-white">Space</span></span>
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
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="bg-[#24384a] border-0">
            <TabsTrigger value="validators" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              Validators ({watchlist.length})
            </TabsTrigger>
            <TabsTrigger value="addresses" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              Addresses ({addressWatchlist.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="validators" className="mt-4">
            <div className="flex justify-end mb-4">
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
              {filteredValidators.slice(0, 20).map((v) => {
                const displayName = v.name || getDisplayName(v.votePubkey, v.nodePubkey, v.activatedStake * 1e9);
                const icon = v.icon || getValidatorIcon(v.votePubkey, v.nodePubkey, v.activatedStake * 1e9);
                return (
                  <button
                    key={v.votePubkey}
                    onClick={() => addToWatchlist({...v, name: displayName, icon})}
                    className="flex items-center gap-3 p-3 bg-[#1d2d3a] rounded-lg hover:bg-[#263d50] transition-colors text-left"
                  >
                    <span>{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm truncate">{displayName}</p>
                      <p className="text-gray-500 text-xs">{formatStake(v.activatedStake)} XNT</p>
                    </div>
                    <Plus className="w-4 h-4 text-cyan-400" />
                  </button>
                );
              })}
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
          </TabsContent>

          <TabsContent value="addresses" className="mt-4">
            {/* Add Address */}
            <div className="bg-[#24384a] rounded-xl p-4 mb-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter X1 address to watch..."
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  className="bg-[#1d2d3a] border-0 text-white flex-1 font-mono text-sm"
                />
                <Button onClick={addAddress} className="bg-cyan-500 hover:bg-cyan-600">
                  <Plus className="w-4 h-4 mr-2" /> Add
                </Button>
                {addressWatchlist.length > 0 && (
                  <Button 
                    onClick={refreshAddressData} 
                    variant="outline" 
                    className="border-white/10"
                    disabled={refreshingAddresses}
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshingAddresses ? 'animate-spin' : ''}`} />
                  </Button>
                )}
              </div>
            </div>

            {/* Address Watchlist */}
            {addressWatchlist.length === 0 ? (
              <div className="bg-[#24384a] rounded-xl p-8 text-center">
                <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No addresses tracked</p>
                <p className="text-gray-500 text-sm mt-2">Add X1 addresses to monitor their balance and activity</p>
              </div>
            ) : (
              <div className="space-y-3">
                {addressWatchlist.map((item) => {
                  const data = addressData[item.address] || {};
                  return (
                    <div key={item.address} className="bg-[#24384a] rounded-xl p-4">
                      <div className="flex items-center gap-4">
                        <Wallet className="w-8 h-8 text-cyan-400" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Add label..."
                              value={item.label}
                              onChange={(e) => updateAddressLabel(item.address, e.target.value)}
                              className="bg-transparent border-0 text-white font-medium p-0 h-auto w-40"
                            />
                            <p className="text-gray-500 font-mono text-xs">
                              {item.address.substring(0, 8)}...{item.address.substring(item.address.length - 6)}
                            </p>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm">
                            <span className="text-cyan-400 font-bold">{data.balance?.toFixed(4) || '...'} XNT</span>
                            <span className="text-gray-500 flex items-center gap-1">
                              <History className="w-3 h-3" />
                              {data.recentTxCount || 0} recent txs
                            </span>
                            {data.lastTx && (
                              <span className="text-gray-500 text-xs">
                                Last: {data.lastTx.toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link to={createPageUrl('AddressLookup') + `?address=${item.address}`}>
                            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-cyan-400">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeAddress(item.address)}
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
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}