import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search as SearchIcon, 
  Zap,
  Layers,
  User,
  FileCode,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Search() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('q') || '';
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(!!initialQuery);
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, []);

  const performSearch = async (query) => {
    setIsSearching(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const isSlot = /^\d+$/.test(query);
    const isShortAddress = query.length > 30 && query.length < 50;
    const isSignature = query.length >= 80;
    
    if (isSlot) {
      setResults({
        type: 'block',
        data: { slot: parseInt(query), txCount: 2847, leader: 'X1 Labs (node4)' }
      });
    } else if (isSignature) {
      setResults({
        type: 'transaction',
        data: { signature: query, status: 'Success', slot: 11265890 }
      });
    } else if (isShortAddress) {
      setResults({
        type: 'account',
        data: { address: query, balance: 125.45, type: 'Wallet' }
      });
    } else {
      setResults({
        type: 'suggestions',
        data: [
          { type: 'block', label: 'Block #11265950', slot: 11265950 },
          { type: 'account', label: 'X1 Labs Validator', address: '7J5wJaH55ZYjCCmCMt7Gb3QL6FGFmjz5U8b6NcbzfoTy' },
        ]
      });
    }
    
    setIsSearching(false);
  };

  const handleSearch = () => {
    if (searchQuery) performSearch(searchQuery);
  };

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
                  <span className="font-bold"><span className="text-cyan-400">X1</span><span className="text-white">Space</span></span>
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
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
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
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Search Hero */}
        <div className="text-center space-y-6 mb-12">
          <h1 className="text-4xl font-bold">
            <span className="text-white">X</span>
            <span className="text-cyan-400">1</span>
            <span className="text-gray-400 ml-3">Explorer</span>
          </h1>
          <p className="text-gray-400">Search for blocks, transactions, accounts, or programs</p>
          
          <div className="relative max-w-2xl mx-auto">
            <Input
              placeholder="Enter slot, signature, or address..."
              className="w-full bg-[#24384a] border-0 text-white placeholder:text-gray-500 pr-24 py-6 text-lg rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button 
              onClick={handleSearch}
              disabled={isSearching}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-cyan-500 hover:bg-cyan-600 text-black font-semibold rounded-lg px-6"
            >
              {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
            </Button>
          </div>
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-4">
            {results.type === 'block' && (
              <div className="bg-[#24384a] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Layers className="w-6 h-6 text-purple-400" />
                  </div>
                  <span className="text-gray-400">Block Found</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-white">Block #{results.data.slot.toLocaleString()}</p>
                    <p className="text-gray-400 mt-1">{results.data.txCount} transactions • {results.data.leader}</p>
                  </div>
                  <Link to={createPageUrl('BlockDetail') + `?slot=${results.data.slot}`}>
                    <Button className="bg-cyan-500 hover:bg-cyan-600 text-black">
                      View Block <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {results.type === 'transaction' && (
              <div className="bg-[#24384a] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Zap className="w-6 h-6 text-yellow-400" />
                  </div>
                  <span className="text-gray-400">Transaction Found</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-cyan-400 text-sm break-all">{results.data.signature}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-0">{results.data.status}</Badge>
                      <span className="text-gray-400 text-sm">Slot: {results.data.slot}</span>
                    </div>
                  </div>
                  <Button className="bg-cyan-500 hover:bg-cyan-600 text-black shrink-0 ml-4">
                    View TX <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {results.type === 'account' && (
              <div className="bg-[#24384a] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <User className="w-6 h-6 text-blue-400" />
                  </div>
                  <span className="text-gray-400">Account Found</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-gray-300 text-sm break-all">{results.data.address}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-white font-bold">{results.data.balance} XNT</span>
                      <Badge className="bg-blue-500/20 text-blue-400 border-0">{results.data.type}</Badge>
                    </div>
                  </div>
                  <Button className="bg-cyan-500 hover:bg-cyan-600 text-black shrink-0 ml-4">
                    View Account <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {results.type === 'suggestions' && (
              <div className="space-y-4">
                <p className="text-gray-400 text-center">No exact match found. Try these:</p>
                {results.data.map((item, index) => (
                  <div key={index} className="bg-[#24384a] rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${item.type === 'block' ? 'bg-purple-500/20' : 'bg-blue-500/20'}`}>
                        {item.type === 'block' ? (
                          <Layers className="w-4 h-4 text-purple-400" />
                        ) : (
                          <User className="w-4 h-4 text-blue-400" />
                        )}
                      </div>
                      <span className="text-white">{item.label}</span>
                    </div>
                    <Link to={item.type === 'block' 
                      ? createPageUrl('BlockDetail') + `?slot=${item.slot}`
                      : createPageUrl('Search') + `?q=${item.address}`
                    }>
                      <Button variant="ghost" className="text-cyan-400 hover:text-cyan-300">
                        View <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Links */}
        {!results && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to={createPageUrl('Blocks')}>
              <div className="bg-[#24384a] rounded-xl p-6 text-center hover:bg-[#2a4055] transition-colors cursor-pointer group">
                <div className="mx-auto w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-purple-500/20 transition-colors">
                  <Layers className="w-6 h-6 text-purple-400" />
                </div>
                <p className="font-medium text-white">Blocks</p>
                <p className="text-gray-500 text-sm mt-1">Browse blocks</p>
              </div>
            </Link>
            <Link to={createPageUrl('Transactions')}>
              <div className="bg-[#24384a] rounded-xl p-6 text-center hover:bg-[#2a4055] transition-colors cursor-pointer group">
                <div className="mx-auto w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-yellow-500/20 transition-colors">
                  <Zap className="w-6 h-6 text-yellow-400" />
                </div>
                <p className="font-medium text-white">Transactions</p>
                <p className="text-gray-500 text-sm mt-1">Live feed</p>
              </div>
            </Link>
            <Link to={createPageUrl('Validators')}>
              <div className="bg-[#24384a] rounded-xl p-6 text-center hover:bg-[#2a4055] transition-colors cursor-pointer group">
                <div className="mx-auto w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-500/20 transition-colors">
                  <User className="w-6 h-6 text-blue-400" />
                </div>
                <p className="font-medium text-white">Validators</p>
                <p className="text-gray-500 text-sm mt-1">Network nodes</p>
              </div>
            </Link>
            <div className="bg-[#24384a] rounded-xl p-6 text-center hover:bg-[#2a4055] transition-colors cursor-pointer group">
              <div className="mx-auto w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-green-500/20 transition-colors">
                <FileCode className="w-6 h-6 text-green-400" />
              </div>
              <p className="font-medium text-white">Programs</p>
              <p className="text-gray-500 text-sm mt-1">Smart contracts</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}