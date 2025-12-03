import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Search, Wallet, Copy, Check, ExternalLink, 
  ArrowUpRight, ArrowDownLeft, Clock, Loader2, AlertCircle
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
      // Fetch real account info from RPC
      const [accountInfo, balance, signatures] = await Promise.all([
        X1Rpc.getAccountInfo(searchAddress).catch(() => null),
        X1Rpc.getBalance(searchAddress).catch(() => ({ value: 0 })),
        X1Rpc.getSignaturesForAddress(searchAddress, { limit: 20 }).catch(() => [])
      ]);
      
      // Determine account type
      let accountType = 'wallet';
      let label = null;
      let voteAccountData = null;
      
      if (accountInfo?.value) {
        const owner = accountInfo.value.owner;
        if (owner === 'Vote111111111111111111111111111111111111111') {
          accountType = 'vote';
          // Parse vote account data
          const parsed = accountInfo.value.data?.parsed;
          if (parsed?.info) {
            voteAccountData = {
              authorizedVoter: parsed.info.authorizedVoters?.[0]?.authorizedVoter,
              authorizedWithdrawer: parsed.info.authorizedWithdrawer,
              commission: parsed.info.commission,
              rootSlot: parsed.info.rootSlot,
              lastTimestamp: parsed.info.lastTimestamp?.timestamp
            };
          }
        } else if (owner === 'Stake11111111111111111111111111111111111111') {
          accountType = 'stake';
        } else if (owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
          accountType = 'token';
        }
      }
      
      // Fetch transaction details for recent transactions
      const recentTxs = [];
      for (const sig of signatures.slice(0, 10)) {
        try {
          const tx = await X1Rpc.getTransaction(sig.signature);
          if (tx) {
            const message = tx.transaction?.message;
            const accountKeys = message?.accountKeys || [];
            const instructions = message?.instructions || [];
            const preBalances = tx.meta?.preBalances || [];
            const postBalances = tx.meta?.postBalances || [];
            
            // Determine type and amount
            let type = 'other';
            let amount = 0;
            
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
            
            // Calculate balance change for this address
            for (let i = 0; i < accountKeys.length; i++) {
              if (accountKeys[i] === searchAddress) {
                amount = (postBalances[i] - preBalances[i]) / 1e9;
                break;
              }
            }
            
            recentTxs.push({
              signature: sig.signature,
              type,
              amount,
              slot: sig.slot,
              blockTime: sig.blockTime,
              status: tx.meta?.err ? 'failed' : 'success'
            });
          }
        } catch (e) {
          // Skip failed tx fetch
        }
      }
      
      setResult({
        address: searchAddress,
        label,
        type: accountType,
        balance: (balance?.value || 0) / 1e9,
        transactions: signatures.length,
        firstSeen: signatures.length > 0 ? new Date(signatures[signatures.length - 1]?.blockTime * 1000) : null,
        recentTxs,
        voteAccountData
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(result?.address || address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (blockTime) => {
    if (!blockTime) return '-';
    const date = new Date(blockTime * 1000);
    const now = new Date();
    const diff = (now - date) / 1000;
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
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
                <span className="text-white font-bold hidden sm:inline">X1</span>
                <span className="text-cyan-400 font-bold hidden sm:inline">.space</span>
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
              placeholder="Enter wallet address..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="bg-[#1d2d3a] border-0 text-white font-mono flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={() => handleSearch()} className="bg-cyan-500 hover:bg-cyan-600" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          {error && (
            <div className="flex items-center gap-2 mt-3 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {result && (
          <>
            {/* Account Overview */}
            <div className="bg-[#24384a] rounded-xl p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-purple-500/20 text-purple-400 border-0 capitalize">{result.type} Account</Badge>
                    {result.type === 'vote' && result.voteAccountData?.commission !== undefined && (
                      <Badge className="bg-cyan-500/20 text-cyan-400 border-0">
                        {result.voteAccountData.commission}% Commission
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-cyan-400 font-mono text-sm md:text-lg break-all">{result.address}</code>
                    <button onClick={copyAddress} className="text-gray-500 hover:text-white shrink-0">
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <a 
                      href={`https://explorer.mainnet.x1.xyz/address/${result.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-cyan-400 shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-[#1d2d3a] rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">Balance</p>
                  <p className="text-xl font-bold text-cyan-400">{result.balance.toLocaleString(undefined, { maximumFractionDigits: 9 })} XNT</p>
                </div>
                <div className="bg-[#1d2d3a] rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">Recent Transactions</p>
                  <p className="text-xl font-bold text-white">{result.transactions}</p>
                </div>
                {result.firstSeen && (
                  <div className="bg-[#1d2d3a] rounded-lg p-4">
                    <p className="text-gray-400 text-xs mb-1">First Activity</p>
                    <p className="text-xl font-bold text-white">{result.firstSeen.toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {/* Vote Account Details */}
              {result.type === 'vote' && result.voteAccountData && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <h4 className="text-gray-400 text-sm mb-3">VOTE ACCOUNT DETAILS</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {result.voteAccountData.authorizedVoter && (
                      <div>
                        <span className="text-gray-500">Authorized Voter:</span>
                        <p className="text-cyan-400 font-mono text-xs truncate">{result.voteAccountData.authorizedVoter}</p>
                      </div>
                    )}
                    {result.voteAccountData.authorizedWithdrawer && (
                      <div>
                        <span className="text-gray-500">Authorized Withdrawer:</span>
                        <p className="text-cyan-400 font-mono text-xs truncate">{result.voteAccountData.authorizedWithdrawer}</p>
                      </div>
                    )}
                    {result.voteAccountData.rootSlot && (
                      <div>
                        <span className="text-gray-500">Root Slot:</span>
                        <p className="text-white font-mono">{result.voteAccountData.rootSlot.toLocaleString()}</p>
                      </div>
                    )}
                    {result.voteAccountData.lastTimestamp && (
                      <div>
                        <span className="text-gray-500">Last Timestamp:</span>
                        <p className="text-white">{new Date(result.voteAccountData.lastTimestamp * 1000).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Recent Transactions */}
            <div className="bg-[#24384a] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-400 text-sm">RECENT TRANSACTIONS</h3>
                <Link to={createPageUrl('TransactionFlowPage') + `?address=${result.address}`}>
                  <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300">
                    View Flow →
                  </Button>
                </Link>
              </div>
              {result.recentTxs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No recent transactions found</p>
              ) : (
                <div className="space-y-3">
                  {result.recentTxs.map((tx, i) => (
                    <Link 
                      key={i} 
                      to={createPageUrl('TransactionDetail') + `?sig=${tx.signature}`}
                      className="flex items-center gap-4 p-3 bg-[#1d2d3a] rounded-lg hover:bg-[#2a4055] transition-colors"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        tx.amount > 0 ? 'bg-emerald-500/20' : tx.amount < 0 ? 'bg-red-500/20' : 'bg-gray-500/20'
                      }`}>
                        {tx.amount > 0 ? (
                          <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                        ) : tx.amount < 0 ? (
                          <ArrowUpRight className="w-5 h-5 text-red-400" />
                        ) : (
                          <Clock className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-cyan-400 font-mono text-sm truncate">{tx.signature}</p>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs border-0 ${
                            tx.type === 'vote' ? 'bg-purple-500/20 text-purple-400' :
                            tx.type === 'transfer' ? 'bg-blue-500/20 text-blue-400' :
                            tx.type === 'stake' ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {tx.type}
                          </Badge>
                          <span className="text-gray-500 text-xs">Slot {tx.slot?.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {tx.amount !== 0 && (
                          <p className={`font-mono ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(6)} XNT
                          </p>
                        )}
                        <p className="text-gray-500 text-xs flex items-center gap-1 justify-end">
                          <Clock className="w-3 h-3" /> {formatTime(tx.blockTime)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}