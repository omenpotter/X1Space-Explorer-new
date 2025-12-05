import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronLeft, Loader2, Search, ArrowRight, ArrowLeftRight,
  Filter, RefreshCw, Wallet, ExternalLink, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';
import AddressFlowGraph from '../components/transactions/AddressFlowGraph';
import FlowFilters from '../components/transactions/FlowFilters';
import FlowExport from '../components/transactions/FlowExport';

export default function TransactionFlowPage() {
  const [address, setAddress] = useState('');
  const [inputAddress, setInputAddress] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [flowData, setFlowData] = useState({ nodes: [], edges: [] });
  const [dateRange, setDateRange] = useState({ from: null, to: null });
  const [amountRange, setAmountRange] = useState({ min: '', max: '' });
  const [searchSignature, setSearchSignature] = useState('');
  const graphRef = useRef(null);

  // Parse URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addr = params.get('address');
    if (addr) {
      setAddress(addr);
      setInputAddress(addr);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    if (!address || address.length < 32) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // First check if address exists and get balance
      const balanceResult = await X1Rpc.getBalance(address);
      const balance = (balanceResult?.value || 0) / 1e9;
      
      // Get signatures for address
      const signatures = await X1Rpc.getSignaturesForAddress(address, { limit: 100 });
      
      if (!signatures || signatures.length === 0) {
        // Address exists but no transactions - show balance only
        if (balance > 0) {
          setError(`Address has ${balance.toFixed(4)} XNT but no recent transaction history found.`);
        } else {
          setError('No transactions found for this address. The address may be new or have no activity.');
        }
        setTransactions([]);
        buildFlowData([], address);
        setLoading(false);
        return;
      }
      
      const txDetails = [];
      // Fetch transactions in parallel batches
      const batchSize = 5;
      for (let i = 0; i < Math.min(signatures.length, 30); i += batchSize) {
        const batch = signatures.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(sig => X1Rpc.getTransaction(sig.signature))
        );
        
        batchResults.forEach((result, idx) => {
          if (result.status === 'fulfilled' && result.value) {
            const tx = result.value;
            const sig = batch[idx];
            const message = tx.transaction?.message;
            const accountKeys = message?.accountKeys || [];
            const instructions = message?.instructions || [];
            const preBalances = tx.meta?.preBalances || [];
            const postBalances = tx.meta?.postBalances || [];
            
            // Determine type
            let type = 'other';
            
            for (const ix of instructions) {
              const programId = accountKeys[ix.programIdIndex];
              if (programId === 'Vote111111111111111111111111111111111111111') {
                type = 'vote';
                break;
              } else if (programId === '11111111111111111111111111111111') {
                type = 'transfer';
              } else if (programId === 'Stake11111111111111111111111111111111111111') {
                type = 'stake';
              } else if (programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
                type = 'token';
              }
            }
            
            // Find the searched address in account keys and calculate its balance change
            let amount = 0;
            let from = '';
            let to = '';
            let addressIdx = -1;
            
            for (let i = 0; i < accountKeys.length; i++) {
              if (accountKeys[i] === address) {
                addressIdx = i;
                const change = (postBalances[i] - preBalances[i]) / 1e9;
                amount = Math.abs(change);
                
                if (change > 0) {
                  // Incoming - address received funds
                  to = address;
                  // Find who sent (largest outgoing balance change)
                  let maxOut = 0;
                  for (let j = 0; j < accountKeys.length; j++) {
                    if (j !== i) {
                      const outChange = (preBalances[j] - postBalances[j]) / 1e9;
                      if (outChange > maxOut) {
                        maxOut = outChange;
                        from = accountKeys[j];
                      }
                    }
                  }
                } else if (change < 0) {
                  // Outgoing - address sent funds
                  from = address;
                  // Find who received (largest incoming balance change)
                  let maxIn = 0;
                  for (let j = 0; j < accountKeys.length; j++) {
                    if (j !== i) {
                      const inChange = (postBalances[j] - preBalances[j]) / 1e9;
                      if (inChange > maxIn) {
                        maxIn = inChange;
                        to = accountKeys[j];
                      }
                    }
                  }
                }
                break;
              }
            }
            
            // Include all transactions, even vote transactions for completeness
            txDetails.push({
              signature: sig.signature,
              slot: sig.slot,
              blockTime: sig.blockTime || tx.blockTime,
              type,
              amount,
              from: from || accountKeys[0] || '',
              to: to || accountKeys[1] || '',
              status: tx.meta?.err ? 'failed' : 'success',
              fee: (tx.meta?.fee || 0) / 1e9,
              accountKeys
            });
          }
        });
      }
      
      if (txDetails.length === 0 && signatures.length > 0) {
        setError('Found ' + signatures.length + ' signatures but could not fetch transaction details from RPC.');
      }
      
      setTransactions(txDetails);
      buildFlowData(txDetails, address);
    } catch (err) {
      console.error('Transaction flow fetch error:', err);
      setError('Failed to fetch transactions: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  const buildFlowData = (txs, centerAddress) => {
    const nodes = new Map();
    const edges = [];
    
    // Center node (searched address)
    nodes.set(centerAddress, {
      id: centerAddress,
      label: centerAddress.substring(0, 6) + '...',
      type: 'center',
      txCount: txs.length,
      totalAmount: 0
    });
    
    let centerInflow = 0;
    let centerOutflow = 0;
    
    txs.forEach(tx => {
      if (tx.type === 'vote') return; // Skip vote transactions for clarity
      
      // Determine flow direction
      const isOutgoing = tx.from === centerAddress;
      const otherAddress = isOutgoing ? tx.to : tx.from;
      
      if (!otherAddress || otherAddress === centerAddress) return;
      
      // Add/update other node
      if (!nodes.has(otherAddress)) {
        nodes.set(otherAddress, {
          id: otherAddress,
          label: otherAddress.substring(0, 6) + '...',
          type: tx.type,
          txCount: 0,
          totalAmount: 0
        });
      }
      const node = nodes.get(otherAddress);
      node.txCount++;
      node.totalAmount += tx.amount;
      
      // Track inflow/outflow
      if (isOutgoing) {
        centerOutflow += tx.amount;
      } else {
        centerInflow += tx.amount;
      }
      
      // Add edge
      edges.push({
        from: isOutgoing ? centerAddress : otherAddress,
        to: isOutgoing ? otherAddress : centerAddress,
        amount: tx.amount,
        type: tx.type,
        signature: tx.signature
      });
    });
    
    // Update center node with totals
    const centerNode = nodes.get(centerAddress);
    centerNode.inflow = centerInflow;
    centerNode.outflow = centerOutflow;
    
    setFlowData({
      nodes: Array.from(nodes.values()),
      edges,
      centerAddress
    });
  };

  useEffect(() => {
    if (address && address.length >= 32) {
      fetchTransactions();
    }
  }, [address]);

  const handleSearch = () => {
    if (inputAddress && inputAddress.length >= 32) {
      setAddress(inputAddress);
      window.history.pushState({}, '', `${window.location.pathname}?address=${inputAddress}`);
    }
  };

  // Advanced filtering with memoization
  const filteredTxs = useMemo(() => {
    return transactions.filter(tx => {
      // Type filter
      if (filterType !== 'all' && tx.type !== filterType) return false;
      
      // Signature/address search
      if (searchSignature) {
        const search = searchSignature.toLowerCase();
        const matchSig = tx.signature?.toLowerCase().includes(search);
        const matchFrom = tx.from?.toLowerCase().includes(search);
        const matchTo = tx.to?.toLowerCase().includes(search);
        if (!matchSig && !matchFrom && !matchTo) return false;
      }
      
      // Date range filter
      if (dateRange.from && tx.blockTime) {
        const txDate = new Date(tx.blockTime * 1000);
        if (txDate < dateRange.from) return false;
      }
      if (dateRange.to && tx.blockTime) {
        const txDate = new Date(tx.blockTime * 1000);
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        if (txDate > endOfDay) return false;
      }
      
      // Amount range filter
      if (amountRange.min && tx.amount < parseFloat(amountRange.min)) return false;
      if (amountRange.max && tx.amount > parseFloat(amountRange.max)) return false;
      
      return true;
    });
  }, [transactions, filterType, searchSignature, dateRange, amountRange]);

  const clearFilters = useCallback(() => {
    setFilterType('all');
    setDateRange({ from: null, to: null });
    setAmountRange({ min: '', max: '' });
    setSearchSignature('');
  }, []);

  const formatAmount = (amt) => {
    if (amt >= 1e6) return (amt / 1e6).toFixed(2) + 'M';
    if (amt >= 1e3) return (amt / 1e3).toFixed(2) + 'K';
    return amt.toFixed(4);
  };

  const getTypeColor = (type) => {
    const colors = {
      transfer: 'bg-blue-500/20 text-blue-400',
      stake: 'bg-emerald-500/20 text-emerald-400',
      token: 'bg-yellow-500/20 text-yellow-400',
      vote: 'bg-purple-500/20 text-purple-400',
      other: 'bg-gray-500/20 text-gray-400'
    };
    return colors[type] || colors.other;
  };

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
              <Link to={createPageUrl('TransactionFlowPage')}><Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg"><ArrowLeftRight className="w-5 h-5" /></Button></Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
          <ArrowLeftRight className="w-7 h-7 text-cyan-400" />
          Transaction Flow
        </h1>

        {/* Search */}
        <div className="bg-[#24384a] rounded-xl p-4 mb-6">
          <div className="flex gap-2">
            <Input
              placeholder="Enter X1 address to visualize transaction flow..."
              value={inputAddress}
              onChange={(e) => setInputAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="bg-[#1d2d3a] border-0 text-white flex-1 font-mono"
            />
            <Button onClick={handleSearch} className="bg-cyan-500 hover:bg-cyan-600">
              <Search className="w-4 h-4 mr-2" /> Analyze
            </Button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {!loading && address && flowData.nodes.length > 0 && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#24384a] rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">Total Transactions</p>
                <p className="text-2xl font-bold text-white">{transactions.length}</p>
              </div>
              <div className="bg-[#24384a] rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">Connected Addresses</p>
                <p className="text-2xl font-bold text-cyan-400">{flowData.nodes.length - 1}</p>
              </div>
              <div className="bg-[#24384a] rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">Total Inflow</p>
                <p className="text-2xl font-bold text-emerald-400">+{formatAmount(flowData.nodes[0]?.inflow || 0)} XNT</p>
              </div>
              <div className="bg-[#24384a] rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">Total Outflow</p>
                <p className="text-2xl font-bold text-red-400">-{formatAmount(flowData.nodes[0]?.outflow || 0)} XNT</p>
              </div>
            </div>

            {/* Flow Graph */}
            <div className="bg-[#24384a] rounded-xl p-4 mb-6" ref={graphRef}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-400 text-sm">TRANSACTION FLOW VISUALIZATION</h3>
                <div className="flex items-center gap-2">
                  <FlowExport flowData={flowData} transactions={transactions} graphRef={graphRef} />
                  <Button variant="ghost" size="sm" onClick={fetchTransactions} className="text-gray-400">
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                  </Button>
                </div>
              </div>
              <AddressFlowGraph flowData={flowData} />
            </div>

            {/* Advanced Filters */}
            <FlowFilters
              filterType={filterType}
              setFilterType={setFilterType}
              dateRange={dateRange}
              setDateRange={setDateRange}
              amountRange={amountRange}
              setAmountRange={setAmountRange}
              searchSignature={searchSignature}
              setSearchSignature={setSearchSignature}
              onClearFilters={clearFilters}
            />

            {/* Filter results count */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm">
                Showing {filteredTxs.length} of {transactions.length} transactions
              </span>
            </div>

            {/* Transaction List */}
            <div className="bg-[#24384a] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Type</th>
                      <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Signature</th>
                      <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Amount</th>
                      <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Counterparty</th>
                      <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTxs.slice(0, 20).map((tx) => (
                      <tr key={tx.signature} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <Badge className={`${getTypeColor(tx.type)} border-0`}>
                            {tx.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Link 
                            to={createPageUrl('TransactionDetail') + `?sig=${tx.signature}`}
                            className="text-cyan-400 hover:underline font-mono text-sm"
                          >
                            {tx.signature.substring(0, 16)}...
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={tx.from === address ? 'text-red-400' : 'text-emerald-400'}>
                            {tx.from === address ? '-' : '+'}{formatAmount(tx.amount)} XNT
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link 
                            to={createPageUrl('AddressLookup') + `?address=${tx.from === address ? tx.to : tx.from}`}
                            className="text-gray-400 hover:text-cyan-400 font-mono text-sm"
                          >
                            {(tx.from === address ? tx.to : tx.from)?.substring(0, 12)}...
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400 text-sm">
                          {tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!loading && !address && (
          <div className="bg-[#24384a] rounded-xl p-12 text-center">
            <Wallet className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl text-gray-400 mb-2">Enter an address to visualize</h2>
            <p className="text-gray-500">See the flow of transactions to and from any X1 address</p>
          </div>
        )}
      </main>
    </div>
  );
}