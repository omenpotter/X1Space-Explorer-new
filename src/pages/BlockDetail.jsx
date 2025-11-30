import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Zap,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  CheckCircle,
  Clock,
  Layers,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';

export default function BlockDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const slot = parseInt(urlParams.get('slot')) || null;
  
  const [block, setBlock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);

  const fetchBlock = async () => {
    if (!slot) {
      setError('No slot specified');
      setLoading(false);
      return;
    }
    
    try {
      const blockData = await X1Rpc.getBlock(slot, { transactionDetails: 'full' });
      if (blockData) {
        const successTx = blockData.transactions?.filter(tx => !tx.meta?.err).length || 0;
        const failedTx = (blockData.transactions?.length || 0) - successTx;
        const totalFees = blockData.transactions?.reduce((sum, tx) => sum + (tx.meta?.fee || 0), 0) / 1e9 || 0;
        
        setBlock({
          slot,
          blockhash: blockData.blockhash,
          previousBlockhash: blockData.previousBlockhash,
          parentSlot: blockData.parentSlot,
          blockTime: blockData.blockTime,
          blockHeight: blockData.blockHeight,
          txCount: blockData.transactions?.length || 0,
          successTx,
          failedTx,
          totalFees,
          rewards: blockData.rewards || []
        });
        setError(null);
      } else {
        setError('Block not found');
      }
    } catch (err) {
      console.error('Failed to fetch block:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlock();
  }, [slot]);

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const squares = Array.from({ length: 200 }, (_, i) => ({ id: i, opacity: 0.3 + Math.random() * 0.7 }));

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
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2 hover:opacity-80">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
                <span className="font-bold"><span className="text-cyan-400">X1</span><span className="text-white">Space</span></span>
              </Link>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">Mainnet</Badge>
            </div>
            
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Input placeholder="Search..." className="w-full bg-[#24384a] border-0 text-white placeholder:text-gray-500 pr-10 rounded-lg" />
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
        <div className="flex items-center justify-between mb-6">
          <Link to={createPageUrl('Blocks')}>
            <Button variant="ghost" className="text-gray-400 hover:text-white"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Blocks</Button>
          </Link>
          
          <div className="flex items-center gap-2">
            <Link to={createPageUrl('BlockDetail') + `?slot=${slot - 1}`}>
              <Button variant="outline" size="icon" className="border-white/10 text-gray-400 hover:text-white h-8 w-8"><ChevronLeft className="w-4 h-4" /></Button>
            </Link>
            <span className="text-gray-400 text-sm px-2">Block #{slot?.toLocaleString()}</span>
            <Link to={createPageUrl('BlockDetail') + `?slot=${slot + 1}`}>
              <Button variant="outline" size="icon" className="border-white/10 text-gray-400 hover:text-white h-8 w-8"><ChevronRight className="w-4 h-4" /></Button>
            </Link>
          </div>
        </div>

        {block && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="bg-[#24384a] rounded-xl p-4">
                <div className="relative w-full h-[300px] bg-gradient-to-b from-purple-500/30 to-purple-600/10 rounded-lg overflow-hidden">
                  <div className="absolute inset-2 grid grid-cols-14 gap-[2px]">
                    {squares.map((sq) => (<div key={sq.id} className="bg-[#9ACD32] rounded-[1px]" style={{ opacity: sq.opacity * 0.7 }} />))}
                  </div>
                  <div className="absolute top-3 left-3 right-3">
                    <p className="text-cyan-400 font-mono font-bold text-2xl">#{block.slot?.toLocaleString()}</p>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/40 p-4">
                    <p className="text-white font-bold">{block.totalFees?.toFixed(6)} XNT fees</p>
                    <p className="text-sm text-gray-400">{block.txCount?.toLocaleString()} transactions</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs">Success</p>
                    <p className="text-emerald-400 font-bold">{block.successTx?.toLocaleString()}</p>
                  </div>
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs">Failed</p>
                    <p className="text-red-400 font-bold">{block.failedTx}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-[#24384a] rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/5">
                  <h2 className="text-lg font-semibold flex items-center gap-2"><Layers className="w-5 h-5 text-purple-400" /> Block Overview</h2>
                </div>
                
                <div className="divide-y divide-white/5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2">
                    <span className="text-gray-400 text-sm">Slot</span>
                    <span className="text-white font-mono">{block.slot?.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2">
                    <span className="text-gray-400 text-sm">Blockhash</span>
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-400 font-mono text-xs truncate max-w-[300px]">{block.blockhash}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleCopy(block.blockhash, 'hash')}>
                        {copied === 'hash' ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2">
                    <span className="text-gray-400 text-sm">Parent Slot</span>
                    <Link to={createPageUrl('BlockDetail') + `?slot=${block.parentSlot}`} className="text-cyan-400 hover:underline font-mono">
                      {block.parentSlot?.toLocaleString()}
                    </Link>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2">
                    <span className="text-gray-400 text-sm">Block Height</span>
                    <span className="text-white font-mono">{block.blockHeight?.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2">
                    <span className="text-gray-400 text-sm">Timestamp</span>
                    <div className="flex items-center gap-2 text-gray-300">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">{block.blockTime ? new Date(block.blockTime * 1000).toLocaleString() : '-'}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2">
                    <span className="text-gray-400 text-sm">Transactions</span>
                    <div className="flex items-center gap-4">
                      <span className="text-emerald-400"><CheckCircle className="w-4 h-4 inline mr-1" />{block.successTx} success</span>
                      <span className="text-red-400">{block.failedTx} failed</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2">
                    <span className="text-gray-400 text-sm">Total Fees</span>
                    <span className="text-cyan-400 font-bold">{block.totalFees?.toFixed(6)} XNT</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <Link to={createPageUrl('Transactions') + `?slot=${slot}`}>
                  <Button className="w-full bg-cyan-500 hover:bg-cyan-600 text-black font-semibold">
                    View All {block.txCount?.toLocaleString()} Transactions <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}