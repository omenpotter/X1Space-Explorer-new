import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search as SearchIcon, 
  Layers,
  User,
  Zap,
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
    
    // Simulate search delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Determine result type based on query
    const isSlot = /^\d+$/.test(query);
    const isShortAddress = query.length > 30 && query.length < 50;
    const isSignature = query.length >= 80;
    
    if (isSlot) {
      setResults({
        type: 'block',
        data: {
          slot: parseInt(query),
          txCount: 2847,
          leader: 'X1 Labs (node4)'
        }
      });
    } else if (isSignature) {
      setResults({
        type: 'transaction',
        data: {
          signature: query,
          status: 'Success',
          slot: 11265890
        }
      });
    } else if (isShortAddress) {
      setResults({
        type: 'account',
        data: {
          address: query,
          balance: 125.45,
          type: 'Wallet'
        }
      });
    } else {
      // Try to find something
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
    if (searchQuery) {
      performSearch(searchQuery);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0d1320]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link to={createPageUrl('Dashboard')} className="text-3xl font-black tracking-tight">
                <span className="text-white">X</span>
                <span className="text-cyan-400">1</span>
              </Link>
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-xs">
                Mainnet
              </Badge>
            </div>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link to={createPageUrl('Dashboard')} className="text-gray-400 hover:text-white transition-colors">
                Cluster Stats
              </Link>
              <Link to={createPageUrl('Validators')} className="text-gray-400 hover:text-white transition-colors">
                Validators
              </Link>
              <Link to={createPageUrl('Blocks')} className="text-gray-400 hover:text-white transition-colors">
                Blocks
              </Link>
              <Link to={createPageUrl('Transactions')} className="text-gray-400 hover:text-white transition-colors">
                Transactions
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        {/* Search Box */}
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold">Search X1 Blockchain</h1>
          <p className="text-gray-400">Search for blocks, transactions, accounts, or programs</p>
          
          <div className="relative max-w-2xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl blur-xl" />
            <div className="relative bg-[#111827]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-1">
              <div className="flex items-center gap-2">
                <SearchIcon className="w-5 h-5 text-gray-400 ml-4" />
                <Input
                  placeholder="Enter slot, signature, or address..."
                  className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-gray-500 text-lg py-6"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button 
                  onClick={handleSearch}
                  className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold rounded-xl px-6"
                  disabled={isSearching}
                >
                  {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-4">
            {results.type === 'block' && (
              <Card className="bg-gradient-to-br from-[#111827] to-[#0d1320] border-white/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Layers className="w-5 h-5 text-purple-400" />
                    </div>
                    Block Found
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-white">Block #{results.data.slot.toLocaleString()}</p>
                      <p className="text-gray-400 mt-1">{results.data.txCount} transactions • Leader: {results.data.leader}</p>
                    </div>
                    <Link to={createPageUrl('BlockDetail') + `?slot=${results.data.slot}`}>
                      <Button className="bg-cyan-500 hover:bg-cyan-600 text-black">
                        View Block
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {results.type === 'transaction' && (
              <Card className="bg-gradient-to-br from-[#111827] to-[#0d1320] border-white/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                      <Zap className="w-5 h-5 text-yellow-400" />
                    </div>
                    Transaction Found
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-mono text-cyan-400 break-all">{results.data.signature}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-emerald-500/20 text-emerald-400">{results.data.status}</Badge>
                        <span className="text-gray-400">Slot: {results.data.slot}</span>
                      </div>
                    </div>
                    <Link to={createPageUrl('TransactionDetail') + `?sig=${results.data.signature}`}>
                      <Button className="bg-cyan-500 hover:bg-cyan-600 text-black shrink-0">
                        View Transaction
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {results.type === 'account' && (
              <Card className="bg-gradient-to-br from-[#111827] to-[#0d1320] border-white/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <User className="w-5 h-5 text-blue-400" />
                    </div>
                    Account Found
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-mono text-gray-300 break-all">{results.data.address}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-white font-bold">{results.data.balance} X1</span>
                        <Badge variant="outline" className="border-blue-500/30 text-blue-400">{results.data.type}</Badge>
                      </div>
                    </div>
                    <Button className="bg-cyan-500 hover:bg-cyan-600 text-black shrink-0">
                      View Account
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {results.type === 'suggestions' && (
              <div className="space-y-4">
                <p className="text-gray-400 text-center">No exact match found. Try these:</p>
                {results.data.map((item, index) => (
                  <Card key={index} className="bg-[#111827]/50 border-white/5 hover:border-white/10 transition-colors">
                    <CardContent className="p-4 flex items-center justify-between">
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Links */}
        {!results && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8">
            <Link to={createPageUrl('Blocks')}>
              <Card className="bg-[#111827]/50 border-white/5 hover:border-purple-500/30 transition-colors cursor-pointer group">
                <CardContent className="p-6 text-center">
                  <div className="mx-auto w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-purple-500/20 transition-colors">
                    <Layers className="w-6 h-6 text-purple-400" />
                  </div>
                  <p className="font-medium text-white">Blocks</p>
                  <p className="text-gray-500 text-sm mt-1">Browse blocks</p>
                </CardContent>
              </Card>
            </Link>
            <Link to={createPageUrl('Transactions')}>
              <Card className="bg-[#111827]/50 border-white/5 hover:border-yellow-500/30 transition-colors cursor-pointer group">
                <CardContent className="p-6 text-center">
                  <div className="mx-auto w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-yellow-500/20 transition-colors">
                    <Zap className="w-6 h-6 text-yellow-400" />
                  </div>
                  <p className="font-medium text-white">Transactions</p>
                  <p className="text-gray-500 text-sm mt-1">Live tx feed</p>
                </CardContent>
              </Card>
            </Link>
            <Link to={createPageUrl('Validators')}>
              <Card className="bg-[#111827]/50 border-white/5 hover:border-blue-500/30 transition-colors cursor-pointer group">
                <CardContent className="p-6 text-center">
                  <div className="mx-auto w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-500/20 transition-colors">
                    <User className="w-6 h-6 text-blue-400" />
                  </div>
                  <p className="font-medium text-white">Validators</p>
                  <p className="text-gray-500 text-sm mt-1">Network nodes</p>
                </CardContent>
              </Card>
            </Link>
            <Card className="bg-[#111827]/50 border-white/5 hover:border-green-500/30 transition-colors cursor-pointer group">
              <CardContent className="p-6 text-center">
                <div className="mx-auto w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-3 group-hover:bg-green-500/20 transition-colors">
                  <FileCode className="w-6 h-6 text-green-400" />
                </div>
                <p className="font-medium text-white">Programs</p>
                <p className="text-gray-500 text-sm mt-1">Smart contracts</p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}