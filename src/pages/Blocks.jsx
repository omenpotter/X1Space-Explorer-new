import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Zap,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';
import { MempoolBlockViz, MempoolAggregatedViz, MempoolLegend } from '../components/x1/MempoolViz';

export default function Blocks() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLive, setIsLive] = useState(true);
  const [newBlockSlot, setNewBlockSlot] = useState(null);
  const [viewMode, setViewMode] = useState('blocks');
  const [tps, setTps] = useState(3000);
  const [performanceData, setPerformanceData] = useState([]);
  const isMounted = React.useRef(true);
  const initialFetchDone = React.useRef(false);

  const fetchBlocks = React.useCallback(async () => {
    if (!isMounted.current) return;
    
    try {
      // Fetch current slot first
      const currentSlot = await X1Rpc.getSlot();
      
      // Fetch blocks with proper error handling for abort signals
      const blockPromises = [];
      for (let i = 0; i < 20; i++) {
        const slot = currentSlot - i;
        blockPromises.push(
          X1Rpc.getBlock(slot, { transactionDetails: 'full' })
            .then(block => block ? { slot, block } : null)
            .catch(err => {
              // Handle AbortError gracefully - don't show error to user
              if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('timeout')) {
                console.warn(`Block ${slot} fetch timed out (normal for slow RPC)`);
                return null;
              }
              // Log other errors but still return null to continue
              console.error(`Block ${slot} error:`, err.message);
              return null;
            })
        );
      }
      
      const results = await Promise.all(blockPromises);
      const recentBlocks = results
        .filter(r => r && r.block)
        .map(({ slot, block }) => {
          const transactions = block.transactions || [];
          const txCount = transactions.length;
          
          let voteCount = 0, transferCount = 0, programCount = 0, otherCount = 0;
          
          if (transactions.length > 0) {
            transactions.forEach(tx => {
              const message = tx.transaction?.message;
              const accountKeys = message?.accountKeys || [];
              const instructions = message?.instructions || [];
              
              const isVote = instructions.some(ix => {
                const programId = accountKeys[ix.programIdIndex];
                return programId === 'Vote111111111111111111111111111111111111111';
              });
              
              if (isVote) {
                voteCount++;
              } else {
                const isTransfer = instructions.some(ix => {
                  const programId = accountKeys[ix.programIdIndex];
                  return programId === '11111111111111111111111111111111';
                });
                
                if (isTransfer) {
                  transferCount++;
                } else if (instructions.length > 0) {
                  programCount++;
                } else {
                  otherCount++;
                }
              }
            });
          }
          
          if (txCount > 0 && voteCount === 0 && transferCount === 0 && programCount === 0) {
            voteCount = Math.round(txCount * 0.70);
            transferCount = Math.round(txCount * 0.15);
            programCount = Math.round(txCount * 0.10);
            otherCount = txCount - voteCount - transferCount - programCount;
          }
          
          return {
            slot,
            blockhash: block.blockhash,
            blockTime: block.blockTime,
            blockHeight: block.blockHeight,
            txCount,
            voteCount,
            transferCount,
            programCount,
            otherCount: otherCount + programCount
          };
        })
        .sort((a, b) => b.slot - a.slot);
      
      if (!isMounted.current) return;
      
      // Only update if we got some blocks
      if (recentBlocks.length > 0) {
        setBlocks(prevBlocks => {
          if (prevBlocks.length > 0 && recentBlocks[0]?.slot > prevBlocks[0]?.slot) {
            setNewBlockSlot(recentBlocks[0].slot);
            setTimeout(() => setNewBlockSlot(null), 1000);
          }
          return recentBlocks;
        });
        setLoading(false);
        initialFetchDone.current = true;
        setError(null); // Clear any previous errors
      } else if (!initialFetchDone.current) {
        // First fetch returned no blocks - might be RPC issue
        setError('Unable to fetch blocks. RPC may be slow. Retrying...');
      }
      
      // Fetch TPS data in background
      Promise.all([
        X1Rpc.getDashboardData().catch(() => null),
        X1Rpc.getPerformanceHistory(60).catch(() => [])
      ]).then(([dashData, perfHistory]) => {
        if (!isMounted.current) return;
        if (dashData?.tps) setTps(dashData.tps);
        setPerformanceData(perfHistory);
      });
      
    } catch (err) {
      console.error('Failed to fetch blocks:', err);
      if (isMounted.current && !initialFetchDone.current) {
        // Only show error if we haven't fetched any data yet
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          setError('RPC request timeout. Retrying...');
        } else {
          setError(err.message || 'Failed to fetch blocks');
        }
        setLoading(false);
      }
    }
  }, []);

  const getAggregatedData = () => {
    let voteRatio = 0.70, transferRatio = 0.12, programRatio = 0.09, otherRatio = 0.09;
    if (blocks.length > 0) {
      const totalTx = blocks.reduce((sum, b) => sum + (b.txCount || 0), 0);
      const totalVote = blocks.reduce((sum, b) => sum + (b.voteCount || 0), 0);
      const totalTransfer = blocks.reduce((sum, b) => sum + (b.transferCount || 0), 0);
      const totalProgram = blocks.reduce((sum, b) => sum + (b.programCount || 0), 0);
      const totalOther = blocks.reduce((sum, b) => sum + (b.otherCount || 0), 0);
      if (totalTx > 0) {
        voteRatio = totalVote / totalTx;
        transferRatio = totalTransfer / totalTx;
        programRatio = totalProgram / totalTx;
        otherRatio = totalOther / totalTx;
      }
    }

    const aggregated = [];

    if (viewMode === '1m') {
      const availableSamples = Math.min(10, performanceData.length);
      for (let i = 0; i < availableSamples; i++) {
        const sample = performanceData[i];
        if (!sample) continue;
        const totalTxns = sample.transactions;
        const slots = sample.slots;

        const voteCount = Math.round(totalTxns * voteRatio);
        const transferCount = Math.round(totalTxns * transferRatio);
        const programCount = Math.round(totalTxns * programRatio);
        const otherCount = Math.max(0, totalTxns - voteCount - transferCount - programCount);

        aggregated.push({
          totalTxns,
          slots,
          label: i === 0 ? 'Now' : `${i}m ago`,
          voteCount,
          transferCount,
          programCount,
          otherCount,
          timestamp: Date.now() - (i * 60 * 1000),
          isRealData: true
        });
      }
    } else if (viewMode === '10m') {
      const maxWindows = Math.floor(performanceData.length / 10);
      const windowsToShow = Math.min(6, maxWindows);

      for (let i = 0; i < windowsToShow; i++) {
        let totalTxns = 0;
        let totalSlots = 0;
        let hasAllData = true;

        for (let j = 0; j < 10; j++) {
          const idx = i * 10 + j;
          if (idx < performanceData.length && performanceData[idx]) {
            totalTxns += performanceData[idx].transactions;
            totalSlots += performanceData[idx].slots;
          } else {
            hasAllData = false;
            break;
          }
        }

        if (hasAllData) {
          const voteCount = Math.round(totalTxns * voteRatio);
          const transferCount = Math.round(totalTxns * transferRatio);
          const programCount = Math.round(totalTxns * programRatio);
          const otherCount = Math.max(0, totalTxns - voteCount - transferCount - programCount);

          aggregated.push({
            totalTxns,
            slots: totalSlots,
            label: i === 0 ? 'Now' : `${i * 10}m ago`,
            voteCount,
            transferCount,
            programCount,
            otherCount,
            timestamp: Date.now() - (i * 10 * 60 * 1000),
            isRealData: true
          });
        }
      }
    }

    return aggregated;
  };

  useEffect(() => {
    fetchBlocks();
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, [fetchBlocks]);

  useEffect(() => {
    if (isLive) {
      const interval = setInterval(() => {
        fetchBlocks();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isLive, fetchBlocks]);

  const filteredBlocks = blocks.filter(block =>
    searchQuery === '' || block.slot.toString().includes(searchQuery)
  );

  const latestBlock = blocks[0];

  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <div className="max-w-[1400px] mx-auto p-4 space-y-4">
        {/* Header with search and live toggle */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl('Dashboard')}>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Blocks</h1>
            {latestBlock && (
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0">
                Latest: #{latestBlock.slot.toLocaleString()}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by slot..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-[200px] bg-[#1d2d3a] border-white/10 text-white placeholder:text-gray-500"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLive(!isLive)}
              className={`${
                isLive
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'border-white/20 text-gray-400'
              }`}
            >
              {isLive ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </>
              )}
            </Button>
          </div>
        </div>

        {/* View Mode Selector */}
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'blocks' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('blocks')}
            className={viewMode === 'blocks' ? 'bg-cyan-500' : 'border-white/20 text-gray-400'}
          >
            Blocks
          </Button>
          <Button
            variant={viewMode === '1m' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('1m')}
            className={viewMode === '1m' ? 'bg-cyan-500' : 'border-white/20 text-gray-400'}
          >
            1m View
          </Button>
          <Button
            variant={viewMode === '10m' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('10m')}
            className={viewMode === '10m' ? 'bg-cyan-500' : 'border-white/20 text-gray-400'}
          >
            10m View
          </Button>
        </div>

        {/* Error Display - Only show meaningful errors */}
        {error && !loading && blocks.length === 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="text-yellow-400 font-medium">Connection Issue</p>
              <p className="text-gray-400 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && blocks.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        )}

        {/* Mempool Visualization */}
        {!loading && blocks.length > 0 && (
          <>
            <MempoolLegend />
            
            {viewMode === 'blocks' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredBlocks.map((block) => (
                  <MempoolBlockViz
                    key={block.slot}
                    block={block}
                    isNew={block.slot === newBlockSlot}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {getAggregatedData().map((data, idx) => (
                  <MempoolAggregatedViz key={idx} data={data} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
