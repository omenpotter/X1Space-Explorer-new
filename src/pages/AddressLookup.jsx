import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Search, Wallet, Copy, Check, ExternalLink, 
  ArrowUpRight, ArrowDownLeft, Clock, Loader2, RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';

export default function AddressLookup() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const queryAddress = urlParams.get('address');

  useEffect(() => {
    if (queryAddress) {
      setAddress(queryAddress);
      handleSearch(queryAddress);
    }
  }, [queryAddress]);

  const handleSearch = async (searchAddress = address) => {
    if (!searchAddress || searchAddress.length < 32) {
      setError('Please enter a valid address');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch real on-chain data
      const [accountInfo, balance, signatures] = await Promise.all([
        X1Rpc.getAccountInfo(searchAddress).catch(() => null),
        X1Rpc.getBalance(searchAddress).catch(() => ({ value: 0 })),
        X1Rpc.getSignaturesForAddress(searchAddress, { limit: 20 }).catch(() => [])
      ]);

      // Determine account type
      let accountType = 'wallet';
      let label = null;
      let commission = null;
      let authorizedVoter = null;
      let authorizedWithdrawer = null;
      let rootSlot = null;
      let lastTimestamp = null;

      if (accountInfo?.value?.data?.parsed) {
        const parsed = accountInfo.value.data.parsed;
        if (parsed.type === 'vote') {
          accountType = 'vote';
          label = 'Vote Account';
          commission = parsed.info?.commission;
          authorizedVoter = parsed.info?.authorizedVoter;
          authorizedWithdrawer = parsed.info?.authorizedWithdrawer;
          rootSlot = parsed.info?.rootSlot;
          lastTimestamp = parsed.info?.lastTimestamp?.timestamp;
        } else if (parsed.type === 'stake') {
          accountType = 'stake';
          label = 'Stake Account';
        }
      }

      // Get transaction details for recent transactions
      const recentTxs = await Promise.all(
        signatures.slice(0, 10).map(async (sig) => {
          try {
            const tx = await X1Rpc.getTransaction(sig.signature);
            let type = 'transaction';
            let amount = 0;

            // Parse transaction type
            if (tx?.transaction?.message) {
              const accountKeys = tx.transaction.message.accountKeys || [];
              const instructions = tx.transaction.message.instructions || [];
              
              for (const ix of instructions) {
                const programId = accountKeys[ix.programIdIndex];
                if (programId === 'Vote111111111111111111111111111111111111111') {
                  type = 'vote';
                } else if (programId === '11111111111111111111111111111111') {
                  type = 'transfer';
                  // Parse transfer amount from pre/post balances
                  const preBalances = tx.meta?.preBalances || [];
                  const postBalances = tx.meta?.postBalances || [];
                  const accountIndex = accountKeys.findIndex(k => k === searchAddress);
                  if (accountIndex >= 0) {
                    amount = (postBalances[accountIndex] - preBalances[accountIndex]) / 1e9;
                  }
                } else if (programId === 'Stake11111111111111111111111111111111111111') {
                  type = 'stake';
                } else if (programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
                  type = 'token';
                }
              }
            }

            return {
              signature: sig.signature,
              slot: sig.slot,
              blockTime: sig.blockTime,
              type,
              amount,
              status: sig.err ? 'failed' : 'success'
            };
          } catch {
            return {
              signature: sig.signature,
              slot: sig.slot,
              blockTime: sig.blockTime,
              type: 'transaction',
              amount: 0,
              status: sig.err ? 'failed' : 'success'
            };
          }
        })
      );

      // Find earliest transaction
      const earliestTx = signatures.length > 0 
        ? signatures[signatures.length - 1]
        : null;

      setResult({
        address: searchAddress,
        label,
        type: accountType,
        balance: balance.value / 1e9,
        transactions: signatures.length,
        firstSeen: earliestTx?.blockTime ? new Date(earliestTx.blockTime * 1000) : null,
        recentTxs,
        // Vote account specific
        commission,
        authorizedVoter,
        authorizedWithdrawer,
        rootSlot,
        lastTimestamp: lastTimestamp ? new Date(lastTimestamp * 1000) : null,
        // Raw account data
        owner: accountInfo?.value?.owner,
        executable: accountInfo?.value?.executable,
        rentEpoch: accountInfo?.value?.rentEpoch,
        dataSize: accountInfo?.value?.data?.length || 0
      });
    } catch (err) {
      console.error('Failed to fetch address:', err);
      setError(err.message || 'Failed to fetch address data');
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(result?.address || address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '-';
    const seconds = Math.floor((Date.now() - timestamp * 1000) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const truncateSignature = (sig) => {
    if (!sig) return '-';
    return `${sig.substring(0, 8)}...${sig.slice(-8)}`;
  };

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
              <Link to={createPageUrl('AddressLookup')}><Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg"><Wallet className="w-5 h-5" /></Button></Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
          <Wallet className="w-7 h-7 text-cyan-400" />
          Address Lookup
        </h1>

        {/* Search */}
        <div className="bg-[#24384a] rounded-xl p-6 mb-6">
          <div className="flex gap-2">
            <Input
              placeholder="Enter wallet or vote account address..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="bg-[#1d2d3a] border-0 text-white font-mono flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={() => handleSearch()} className="bg-cyan-500 hover:bg-cyan-600" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>

        {result && (
          <>
            {/* Account Overview */}
            <div className="bg-[#24384a] rounded-xl p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`border-0 ${result.type === 'vote' ? 'bg-purple-500/20 text-purple-400' : result.type === 'stake' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
                      {result.type === 'vote' ? 'Vote Account' : result.type === 'stake' ? 'Stake Account' : 'Wallet'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-cyan-400 font-mono text-sm sm:text-lg break-all">{result.address}</code>
                    <button onClick={copyAddress} className="text-gray-500 hover:text-white shrink-0">
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleSearch(result.address)}
                  className="border-white/10 text-gray-400 hover:text-white shrink-0"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-[#1d2d3a] rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">Balance (XNT)</p>
                  <p className="text-xl font-bold text-cyan-400">{result.balance.toLocaleString(undefined, { maximumFractionDigits: 9 })}</p>
                </div>
                <div className="bg-[#1d2d3a] rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">Recent Transactions</p>
                  <p className="text-xl font-bold text-white">{result.transactions}</p>
                </div>
                {result.type === 'vote' && result.commission !== null && (
                  <div className="bg-[#1d2d3a] rounded-lg p-4">
                    <p className="text-gray-400 text-xs mb-1">Commission</p>
                    <p className="text-xl font-bold text-yellow-400">{result.commission}%</p>
                  </div>
                )}
                {result.type === 'vote' && result.rootSlot && (
                  <div className="bg-[#1d2d3a] rounded-lg p-4">
                    <p className="text-gray-400 text-xs mb-1">Root Slot</p>
                    <p className="text-xl font-bold text-white">{result.rootSlot.toLocaleString()}</p>
                  </div>
                )}
              </div>

              {/* Vote Account Details */}
              {result.type === 'vote' && (
                <div className="mt-4 space-y-2">
                  {result.authorizedVoter && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400">Authorized Voter:</span>
                      <Link to={createPageUrl('AddressLookup') + `?address=${result.authorizedVoter}`} className="text-cyan-400 font-mono hover:underline">
                        {truncateSignature(result.authorizedVoter)}
                      </Link>
                    </div>
                  )}
                  {result.authorizedWithdrawer && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400">Authorized Withdrawer:</span>
                      <Link to={createPageUrl('AddressLookup') + `?address=${result.authorizedWithdrawer}`} className="text-cyan-400 font-mono hover:underline">
                        {truncateSignature(result.authorizedWithdrawer)}
                      </Link>
                    </div>
                  )}
                  {result.lastTimestamp && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400">Last Timestamp:</span>
                      <span className="text-white">{result.lastTimestamp.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Account Info */}
              {result.owner && (
                <div className="mt-4 pt-4 border-t border-white/10 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Assigned Program Id:</span>
                    <span className="text-white font-mono">{result.owner === '11111111111111111111111111111111' ? 'System Program' : truncateSignature(result.owner)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Executable:</span>
                    <span className="text-white">{result.executable ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Transaction History */}
            <div className="bg-[#24384a] rounded-xl p-6">
              <h3 className="text-gray-400 text-sm mb-4">TRANSACTION HISTORY</h3>
              {result.recentTxs.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No transactions found</p>
              ) : (
                <div className="space-y-2">
                  {result.recentTxs.map((tx, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 bg-[#1d2d3a] rounded-lg hover:bg-[#2a4258] transition-colors">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        tx.type === 'vote' ? 'bg-purple-500/20' : 
                        tx.amount > 0 ? 'bg-emerald-500/20' : 
                        tx.amount < 0 ? 'bg-red-500/20' : 'bg-gray-500/20'
                      }`}>
                        {tx.type === 'vote' ? (
                          <span className="text-purple-400 text-xs font-bold">V</span>
                        ) : tx.amount > 0 ? (
                          <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                        ) : tx.amount < 0 ? (
                          <ArrowUpRight className="w-5 h-5 text-red-400" />
                        ) : (
                          <span className="text-gray-400 text-xs">TX</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link 
                          to={createPageUrl('TransactionDetail') + `?signature=${tx.signature}`}
                          className="text-cyan-400 font-mono text-sm hover:underline block truncate"
                        >
                          {tx.signature}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="capitalize">{tx.type}</span>
                          <span>•</span>
                          <span>Block {tx.slot?.toLocaleString()}</span>
                          <Badge className={`text-xs border-0 ${tx.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {tx.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {tx.amount !== 0 && (
                          <p className={`font-mono text-sm ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(6)} XNT
                          </p>
                        )}
                        <p className="text-gray-500 text-xs flex items-center gap-1 justify-end">
                          <Clock className="w-3 h-3" /> {formatTimeAgo(tx.blockTime)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {result.recentTxs.length > 0 && (
                <div className="mt-4 text-center">
                  <a 
                    href={`https://explorer.mainnet.x1.xyz/address/${result.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 text-sm hover:underline inline-flex items-center gap-1"
                  >
                    View all on X1 Explorer <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}