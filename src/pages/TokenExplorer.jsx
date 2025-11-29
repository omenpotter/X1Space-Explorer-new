import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Coins, Search, Loader2, TrendingUp, TrendingDown,
  ExternalLink, Copy, Check, RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';

export default function TokenExplorer() {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(null);
  const [supply, setSupply] = useState({ total: 0, circulating: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supplyData = await X1Rpc.getSupply();
        setSupply({
          total: supplyData.value.total / 1e9,
          circulating: supplyData.value.circulating / 1e9
        });
      } catch (err) {
        console.error('Failed to fetch supply:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const copyAddress = (address) => {
    navigator.clipboard.writeText(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatSupply = (num) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    return num.toLocaleString();
  };

  // XNT is the only native token, priced at $1.00 OTC
  const xntToken = {
    mint: 'Native XNT (SOL-compatible)',
    name: 'X1 Native Token',
    symbol: 'XNT',
    decimals: 9,
    supply: supply.total,
    circulating: supply.circulating,
    price: 1.00, // OTC price
    isNative: true
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

        {/* XNT Token Card */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <span className="text-black font-black text-xl">X1</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-white">{xntToken.name}</h2>
                <Badge className="bg-cyan-500/20 text-cyan-400 border-0">Native</Badge>
              </div>
              <p className="text-gray-400">{xntToken.symbol}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-3xl font-bold text-emerald-400">${xntToken.price.toFixed(2)}</p>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-0">OTC Price</Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Total Supply</p>
              <p className="text-xl font-bold text-white">{formatSupply(xntToken.supply)} XNT</p>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Circulating</p>
              <p className="text-xl font-bold text-cyan-400">{formatSupply(xntToken.circulating)} XNT</p>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Market Cap (OTC)</p>
              <p className="text-xl font-bold text-white">${formatSupply(xntToken.circulating * xntToken.price)}</p>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Decimals</p>
              <p className="text-xl font-bold text-white">{xntToken.decimals}</p>
            </div>
          </div>
        </div>

        {/* OTC Notice */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
          <p className="text-yellow-400 text-sm font-medium mb-2">
            ⚠️ Trading Status
          </p>
          <p className="text-yellow-400/80 text-sm">
            XNT is currently trading <strong>Over The Counter (OTC)</strong> at $1.00. 
            Not yet listed on exchanges. This page will automatically update when exchange listings go live.
          </p>
        </div>

        {/* SPL Tokens Coming Soon */}
        <div className="bg-[#24384a] rounded-xl p-8 text-center">
          <Coins className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">SPL Token Ecosystem</h3>
          <p className="text-gray-400 mb-4">
            Additional tokens will appear here as the X1 ecosystem grows. 
            Token values will be displayed when market trading begins.
          </p>
          <Badge className="bg-purple-500/20 text-purple-400 border-0">Coming Soon</Badge>
        </div>

        {/* Info */}
        <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-blue-400 text-sm">
            ℹ️ Token data is fetched live from the X1 blockchain. Supply information updates in real-time.
          </p>
        </div>
      </main>
    </div>
  );
}