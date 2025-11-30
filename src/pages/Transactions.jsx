import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Zap,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLive, setIsLive] = useState(true);
  const [stats, setStats] = useState({ total: 0, tps: 0 });
  const [currentSlot, setCurrentSlot] = useState(null);

  const fetchTransactions = async () => {
    try {
      const [slot, dashData] = await Promise.all([
        X1Rpc.getSlot(),
        X1Rpc.getDashboardData().catch(() => null)
      ]);
      
      setCurrentSlot(slot);
      if (dashData) {
        setStats({ total: dashData.transactionCount, tps: dashData.tps });
      }

      // Fetch transactions from recent blocks
      const block = await X1Rpc.getBlock(slot, { transactionDetails: 'full' });
      
      if (block?.transactions) {
        const txs = block.transactions.slice(0, 30).map((tx, i) => ({
          signature: tx.transaction?.signatures?.[0] || `tx-${slot}-${i}`,
          slot,
          status: tx.meta?.err ? 'Failed' : 'Success',
          fee: (tx.meta?.fee || 0) / 1e9,
          blockTime: block.blockTime,
          accounts: tx.transaction?.message?.accountKeys?.length || 0
        }));
        setTransactions(txs);
      }
      
      setError(null);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    if (isLive) {
      const interval = setInterval(fetchTransactions, 3000);
      return () => clearInterval(interval);
    }
  }, [isLive]);

  const formatTime = (blockTime) => {
    if (!blockTime) return '-';
    const diff = (Date.now() / 1000) - blockTime;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const formatNumber = (num) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    return num?.toLocaleString() || '0';
  };

  if (loading && transactions.length === 0) {
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
              <Link to={createPageUrl('Validators')}><Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg></Button></Link>
              <Link to={createPageUrl('Transactions')}><Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg></Button></Link>
            </nav>
            
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Input placeholder="Search by signature..." className="w-full bg-[#24384a] border-0 text-white placeholder:text-gray-500 pr-10 rounded-lg" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Total Transactions</p>
            <p className="text-2xl font-bold text-white">{formatNumber(stats.total)}</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Current TPS</p>
            <p className="text-2xl font-bold text-cyan-400">{stats.tps?.toLocaleString()}</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Current Slot</p>
            <p className="text-2xl font-bold text-white">{currentSlot?.toLocaleString()}</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Shown TXs</p>
            <p className="text-2xl font-bold text-white">{transactions.length}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
          <Button onClick={() => setIsLive(!isLive)} variant="outline" size="sm" className={`border-white/10 ${isLive ? 'text-emerald-400' : 'text-gray-400'}`}>
            {isLive ? <><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-2" /><Pause className="w-3 h-3 mr-1" /> Live</> : <><Play className="w-3 h-3 mr-1" /> Paused</>}
          </Button>
        </div>

        <div className="bg-[#24384a] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Signature</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Slot</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Fee</th>
                  <th className="text-center text-gray-400 text-xs font-medium px-4 py-3">Accounts</th>
                  <th className="text-center text-gray-400 text-xs font-medium px-4 py-3">Status</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Age</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, index) => (
                  <tr key={tx.signature + index} className={`border-b border-white/5 hover:bg-white/[0.02] ${index === 0 && isLive ? 'bg-cyan-500/5' : ''}`}>
                    <td className="px-4 py-3">
                      <Link to={createPageUrl('TransactionDetail') + `?sig=${tx.signature}`} className="text-cyan-400 hover:underline font-mono text-sm">
                        {tx.signature.substring(0, 16)}...{tx.signature.slice(-8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={createPageUrl('BlockDetail') + `?slot=${tx.slot}`} className="text-gray-400 hover:text-cyan-400 font-mono text-sm">
                        {tx.slot?.toLocaleString()}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-gray-400 font-mono text-xs">{tx.fee.toFixed(6)} XNT</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className="bg-white/5 text-gray-400 border-0 text-xs">{tx.accounts}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {tx.status === 'Success' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-gray-500 text-xs flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(tx.blockTime)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 mt-6">
          <Button variant="outline" className="border-white/10 text-gray-400 hover:text-white">
            <ChevronLeft className="w-4 h-4 mr-1" /> Older
          </Button>
          <Button variant="outline" className="border-white/10 text-gray-400 hover:text-white">
            Newer <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </main>
    </div>
  );
}