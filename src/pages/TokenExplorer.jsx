import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Coins, Search, Loader2, TrendingUp, TrendingDown,
  ExternalLink, Copy, Check
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// X1 Native Token - XNT is the only token currently on mainnet
// Price is $1.00 OTC (Over The Counter) - not on exchanges yet
const X1_TOKENS = [
  { 
    mint: 'So11111111111111111111111111111111111111112', // Native SOL-compatible address
    name: 'X1 Native Token', 
    symbol: 'XNT', 
    decimals: 9, 
    supply: 1000000000, // 1B total supply
    price: 1.00, // OTC price
    change24h: 0, 
    holders: 15420, 
    isNative: true,
    description: 'Native token of the X1 blockchain. Currently trading OTC at $1.00.'
  },
];

export default function TokenExplorer() {
  const [tokens, setTokens] = useState(X1_TOKENS);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(null);

  const copyAddress = (address) => {
    navigator.clipboard.writeText(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 2000);
  };

  const filteredTokens = tokens.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.mint.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatSupply = (supply) => {
    if (supply >= 1e12) return (supply / 1e12).toFixed(2) + 'T';
    if (supply >= 1e9) return (supply / 1e9).toFixed(2) + 'B';
    if (supply >= 1e6) return (supply / 1e6).toFixed(2) + 'M';
    return supply.toLocaleString();
  };

  const formatPrice = (price) => {
    if (price < 0.0001) return price.toExponential(2);
    if (price < 1) return price.toFixed(6);
    return price.toFixed(2);
  };

  // Calculate total market cap
  const totalMarketCap = tokens.reduce((sum, t) => sum + (t.supply * t.price), 0);

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
              <Link to={createPageUrl('TokenExplorer')}><Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg"><Coins className="w-5 h-5" /></Button></Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Coins className="w-7 h-7 text-cyan-400" />
            Token Explorer
          </h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Native Token</p>
            <p className="text-2xl font-bold text-white">XNT</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">XNT Price (OTC)</p>
            <p className="text-2xl font-bold text-cyan-400">$1.00</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Total Supply</p>
            <p className="text-2xl font-bold text-white">1B XNT</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Market Cap</p>
            <p className="text-2xl font-bold text-emerald-400">$1B</p>
          </div>
        </div>

        {/* OTC Notice */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
          <p className="text-yellow-400 text-sm">
            ⚠️ XNT is currently trading Over The Counter (OTC) at $1.00. Not yet listed on exchanges. SPL token ecosystem coming soon.
          </p>
        </div>

        {/* Search */}
        <div className="bg-[#24384a] rounded-xl p-4 mb-6">
          <div className="relative">
            <Input
              placeholder="Search by name, symbol, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#1d2d3a] border-0 text-white pl-10"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          </div>
        </div>

        {/* Token List */}
        <div className="bg-[#24384a] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">#</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Token</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Price</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">24h</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Supply</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Market Cap</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Holders</th>
                </tr>
              </thead>
              <tbody>
                {filteredTokens.map((token, i) => (
                  <tr key={token.mint} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-4 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center text-sm font-bold">
                          {token.symbol.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{token.name}</span>
                            {token.isNative && <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-[10px]">Native</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-sm">{token.symbol}</span>
                            <button onClick={() => copyAddress(token.mint)} className="text-gray-600 hover:text-gray-400">
                              {copied === token.mint ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-white font-mono">${formatPrice(token.price)}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className={`flex items-center justify-end gap-1 ${token.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {token.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(token.change24h).toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-gray-400 font-mono">
                      {formatSupply(token.supply)}
                    </td>
                    <td className="px-4 py-4 text-right text-cyan-400 font-mono">
                      ${formatSupply(token.supply * token.price)}
                    </td>
                    <td className="px-4 py-4 text-right text-gray-400">
                      {token.holders.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}