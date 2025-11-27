import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Loader2, AlertCircle, ArrowLeft, Copy, Check,
  CheckCircle, XCircle, Clock, Coins, FileCode, GitBranch
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';
import ProgramDecoder, { getProgramInfo, decodeInstruction } from '../components/transactions/ProgramDecoder';
import TransactionFlow from '../components/transactions/TransactionFlow';

export default function TransactionDetail() {
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const urlParams = new URLSearchParams(window.location.search);
  const signature = urlParams.get('sig');

  useEffect(() => {
    const fetchTransaction = async () => {
      if (!signature) {
        setError('No transaction signature provided');
        setLoading(false);
        return;
      }

      try {
        const tx = await X1Rpc.getTransaction(signature);
        
        if (tx) {
          // Process transaction data
          const accounts = tx.transaction?.message?.accountKeys?.map(k => 
            typeof k === 'string' ? k : k.pubkey
          ) || [];
          
          const instructions = tx.transaction?.message?.instructions?.map(ix => ({
            programId: accounts[ix.programIdIndex],
            accounts: ix.accounts?.map(i => accounts[i]) || [],
            data: ix.data ? Array.from(atob(ix.data), c => c.charCodeAt(0)) : []
          })) || [];

          // Simulate state changes based on balance changes
          const stateChanges = [];
          if (tx.meta?.preBalances && tx.meta?.postBalances) {
            tx.meta.preBalances.forEach((pre, i) => {
              const post = tx.meta.postBalances[i];
              const diff = (post - pre) / 1e9;
              if (diff !== 0) {
                stateChanges.push({
                  account: accounts[i],
                  type: diff > 0 ? 'credit' : 'debit',
                  amount: Math.abs(diff).toFixed(6)
                });
              }
            });
          }

          setTransaction({
            signature,
            slot: tx.slot,
            blockTime: tx.blockTime,
            success: !tx.meta?.err,
            fee: (tx.meta?.fee || 0) / 1e9,
            accounts,
            instructions,
            stateChanges,
            logs: tx.meta?.logMessages || [],
            computeUnits: tx.meta?.computeUnitsConsumed || 0
          });
          setError(null);
        } else {
          setError('Transaction not found');
        }
      } catch (err) {
        console.error('Failed to fetch transaction:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchTransaction();
  }, [signature]);

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">{error || 'Transaction not found'}</p>
          <Link to={createPageUrl('Transactions')}>
            <Button className="mt-4" variant="outline">Back to Transactions</Button>
          </Link>
        </div>
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
            <Link to={createPageUrl('Transactions')}>
              <Button variant="outline" size="sm" className="border-white/10 text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Transaction Header */}
        <div className="bg-[#24384a] rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {transaction.success ? (
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-400" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-white">Transaction Details</h1>
                <Badge className={transaction.success ? 'bg-emerald-500/20 text-emerald-400 border-0' : 'bg-red-500/20 text-red-400 border-0'}>
                  {transaction.success ? 'Success' : 'Failed'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <code className="text-cyan-400 font-mono text-sm bg-[#1d2d3a] px-3 py-2 rounded flex-1 truncate">
              {transaction.signature}
            </code>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyToClipboard(transaction.signature, 'sig')}
              className="text-gray-400 hover:text-white"
            >
              {copied === 'sig' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#1d2d3a] rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Slot</p>
              <p className="text-white font-mono">{transaction.slot?.toLocaleString()}</p>
            </div>
            <div className="bg-[#1d2d3a] rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Timestamp</p>
              <p className="text-white text-sm">
                {transaction.blockTime ? new Date(transaction.blockTime * 1000).toLocaleString() : '-'}
              </p>
            </div>
            <div className="bg-[#1d2d3a] rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Fee</p>
              <p className="text-white font-mono">{transaction.fee.toFixed(6)} XNT</p>
            </div>
            <div className="bg-[#1d2d3a] rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Compute Units</p>
              <p className="text-white font-mono">{transaction.computeUnits?.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'overview', label: 'Overview', icon: FileCode },
            { key: 'flow', label: 'Flow', icon: GitBranch },
            { key: 'logs', label: 'Logs', icon: FileCode }
          ].map((tab) => (
            <Button
              key={tab.key}
              variant="outline"
              size="sm"
              className={`border-white/10 ${activeTab === tab.key ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </Button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Instructions */}
            <div className="bg-[#24384a] rounded-xl p-6">
              <h3 className="text-gray-400 text-sm mb-4">INSTRUCTIONS ({transaction.instructions.length})</h3>
              <div className="space-y-4">
                {transaction.instructions.map((ix, i) => (
                  <ProgramDecoder 
                    key={i} 
                    instruction={ix} 
                    accounts={ix.accounts}
                  />
                ))}
              </div>
            </div>

            {/* Accounts */}
            <div className="bg-[#24384a] rounded-xl p-6">
              <h3 className="text-gray-400 text-sm mb-4">ACCOUNTS ({transaction.accounts.length})</h3>
              <div className="space-y-2">
                {transaction.accounts.map((acc, i) => {
                  const change = transaction.stateChanges.find(c => c.account === acc);
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 bg-[#1d2d3a] rounded-lg">
                      <span className="text-gray-500 font-mono w-6">{i}</span>
                      <code className="text-cyan-400 font-mono text-sm flex-1 truncate">{acc}</code>
                      {i === 0 && <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">Signer</Badge>}
                      {change && (
                        <span className={`font-mono text-sm ${change.type === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {change.type === 'credit' ? '+' : '-'}{change.amount} XNT
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(acc, `acc-${i}`)}
                        className="text-gray-500 hover:text-white h-6 w-6"
                      >
                        {copied === `acc-${i}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'flow' && (
          <TransactionFlow transaction={transaction} />
        )}

        {activeTab === 'logs' && (
          <div className="bg-[#24384a] rounded-xl p-6">
            <h3 className="text-gray-400 text-sm mb-4">PROGRAM LOGS</h3>
            {transaction.logs.length > 0 ? (
              <div className="bg-[#1d2d3a] rounded-lg p-4 font-mono text-xs space-y-1 max-h-[500px] overflow-y-auto">
                {transaction.logs.map((log, i) => (
                  <p key={i} className={`${log.includes('success') ? 'text-emerald-400' : log.includes('failed') || log.includes('error') ? 'text-red-400' : 'text-gray-400'}`}>
                    {log}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No logs available</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}