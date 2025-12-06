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
      // Get balance and signatures in parallel
      const [balanceResult, signatures] = await Promise.all([
        X1Rpc.getBalance(address).catch(() => ({ value: 0 })),
        X1Rpc.getSignaturesForAddress(address, { limit: 50 }).catch(() => [])
      ]);
      
      const balance = (balanceResult?.value || 0) / 1e9;
      
      if (!signatures || signatures.length === 0) {
        if (balance > 0) {
          setError(`Address has ${balance.toFixed(4)} XNT but no transaction history available.`);
        } else {
          setError('No transactions found. Address may be new or inactive.');
        }
        setTransactions([]);
        buildFlowData([], address);
        setLoading(false);
        return;
      }
      
      console.log(`Fetching ${signatures.length} transactions for ${address.substring(0, 8)}...`);
      
      const txDetails = [];
      // Parallel fetch with Promise.all for speed
      const txPromises = signatures.slice(0, 30).map(sig => 
        X1Rpc.getTransaction(sig.signature)
          .then(tx => ({ sig, tx }))
          .catch(() => null)
      );
      
      const results = await Promise.all(txPromises);
      
      results.forEach(result => {
        if (!result?.tx) return;
        
        const { sig, tx } = result;
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
        
        // Calculate amount and direction - analyze ALL balance changes
        let amount = 0, from = '', to = '';
        
        // Build array of all balance changes
        const allChanges = [];
        for (let i = 0; i < accountKeys.length; i++) {
          const change = (postBalances[i] - preBalances[i]) / 1e9;
          if (Math.abs(change) > 0.00001) { // Ignore dust
            allChanges.push({ 
              address: accountKeys[i], 
              change, 
              index: i,
              isSearchedAddress: accountKeys[i] === address
            });
          }
        }
        
        // Find the searched address change
        const searchedChange = allChanges.find(c => c.isSearchedAddress);
        
        if (searchedChange) {
          amount = Math.abs(searchedChange.change);
          
          if (searchedChange.change > 0) {
            // Address received funds
            to = address;
            // Find sender (largest negative change)
            const senders = allChanges.filter(c => !c.isSearchedAddress && c.change < 0).sort((a, b) => a.change - b.change);
            from = senders.length > 0 ? senders[0].address : accountKeys[0] || '';
          } else if (searchedChange.change < 0) {
            // Address sent funds
            from = address;
            // Find receiver (largest positive change)
            const receivers = allChanges.filter(c => !c.isSearchedAddress && c.change > 0).sort((a, b) => b.change - a.change);
            to = receivers.length > 0 ? receivers[0].address : accountKeys[1] || '';
          }
        } else {
          // Address not in transaction accounts (might be program/contract)
          if (allChanges.length >= 2) {
            const negChanges = allChanges.filter(c => c.change < 0).sort((a, b) => a.change - b.change);
            const posChanges = allChanges.filter(c => c.change > 0).sort((a, b) => b.change - a.change);
            
            if (negChanges.length > 0 && posChanges.length > 0) {
              amount = Math.min(Math.abs(negChanges[0].change), Math.abs(posChanges[0].change));
              from = negChanges[0].address;
              to = posChanges[0].address;
            }
          }
        }
        
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
      });
      
      console.log(`Transaction Flow: Loaded ${txDetails.length} transactions for ${address.substring(0, 8)}...`);
      console.log('Sample transaction:', txDetails[0]);
      
      if (txDetails.length === 0) {
        setError(`Found ${signatures.length} signatures but couldn't fetch details from RPC.`);
      }
      
      setTransactions(txDetails);
      buildFlowData(txDetails, address);
    } catch (err) {
      console.error('Transaction flow error:', err);
      setError('RPC error: ' + err.message);
      setTransactions([]);
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
      // Skip vote transactions and zero-amount transactions
      if (tx.type === 'vote' || !tx.amount || tx.amount < 0.00001) return;
      
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
    
    const flowResult = {
      nodes: Array.from(nodes.values()),
      edges,
      centerAddress
    };
    
    console.log(`Flow built: ${flowResult.nodes.length} nodes (${flowResult.nodes.length - 1} connected), ${flowResult.edges.length} edges`);
    setFlowData(flowResult);
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