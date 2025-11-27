import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Search, Wallet, Copy, Check, ExternalLink, 
  ArrowUpRight, ArrowDownLeft, Clock, Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Known address labels
const KNOWN_ADDRESSES = {
  'Gv5kyHCneaRKNJPgyPreoiYnBVBm2XYqt981zYykcSSU': { label: 'X1 Labs (node9)', type: 'validator' },
  '5Rzytnub9yGTFHqSmauFLsAbdXFbehMwPBLiuEgKajUN': { label: 'X1 Labs (node1)', type: 'validator' },
  'CkMwg4TM6jaSC5rJALQjvLc51XFY5pJ1H9f1Tmu5Qdxs': { label: 'X1 Labs (node3)', type: 'validator' },
};

export default function AddressLookup() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const urlParams = new URLSearchParams(window.location.search);
  const queryAddress = urlParams.get('address');

  React.useEffect(() => {
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
      // Simulate fetching account info
      await new Promise(r => setTimeout(r, 500));
      
      const knownInfo = KNOWN_ADDRESSES[searchAddress];
      
      // Mock data for demonstration
      setResult({
        address: searchAddress,
        label: knownInfo?.label,
        type: knownInfo?.type || 'wallet',
        balance: Math.random() * 100000,
        transactions: Math.floor(Math.random() * 1000),
        firstSeen: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        recentTxs: [
          { signature: 'abc123...def', type: 'transfer', amount: 100, time: '2m ago' },
          { signature: 'xyz789...ghi', type: 'transfer', amount: -50, time: '1h ago' },
          { signature: 'mno456...pqr', type: 'stake', amount: 1000, time: '2h ago' },
        ]
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
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>

        {result && (
          <>
            {/* Account Overview */}
            <div className="bg-[#24384a] rounded-xl p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  {result.label && (
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-cyan-500/20 text-cyan-400 border-0">{result.label}</Badge>
                      <Badge className="bg-purple-500/20 text-purple-400 border-0 capitalize">{result.type}</Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <code className="text-cyan-400 font-mono text-lg">{result.address}</code>
                    <button onClick={copyAddress} className="text-gray-500 hover:text-white">
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#1d2d3a] rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">Balance</p>
                  <p className="text-xl font-bold text-cyan-400">{result.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} XNT</p>
                </div>
                <div className="bg-[#1d2d3a] rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">Transactions</p>
                  <p className="text-xl font-bold text-white">{result.transactions}</p>
                </div>
                <div className="bg-[#1d2d3a] rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-1">First Seen</p>
                  <p className="text-xl font-bold text-white">{result.firstSeen.toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-[#24384a] rounded-xl p-6">
              <h3 className="text-gray-400 text-sm mb-4">RECENT TRANSACTIONS</h3>
              <div className="space-y-3">
                {result.recentTxs.map((tx, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 bg-[#1d2d3a] rounded-lg">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                      {tx.amount > 0 ? <ArrowDownLeft className="w-5 h-5 text-emerald-400" /> : <ArrowUpRight className="w-5 h-5 text-red-400" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-mono text-sm">{tx.signature}</p>
                      <p className="text-gray-500 text-xs capitalize">{tx.type}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount} XNT
                      </p>
                      <p className="text-gray-500 text-xs flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" /> {tx.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}