import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Layers,
  Clock,
  ChevronLeft,
  ChevronRight,
  Zap,
  Hash,
  User,
  ArrowLeft,
  Copy,
  CheckCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function BlockDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const slot = urlParams.get('slot') || '11265950';
  
  const [copied, setCopied] = React.useState(false);
  
  // Mock block data
  const block = {
    slot: parseInt(slot),
    blockhash: '5X8vBJ2aK9Lm4nH7wQ3rT6yU8iO0pA1sD2fG5hJ6kL7m',
    previousBlockhash: '4W7uAH1bJ8Kl3mG6vP2qS5xT7yU9iN0oM1nB4cV5dE6f',
    parent: parseInt(slot) - 1,
    leader: 'X1 Labs (node4)',
    leaderPubkey: '7J5wJaH55ZYjCCmCMt7Gb3QL6FGFmjz5U8b6NcbzfoTy',
    time: 358,
    txCount: 2847,
    successTx: 2831,
    failedTx: 16,
    timestamp: new Date().toISOString(),
    rewards: 0.0025,
    fees: 0.847
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0d1320]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link to={createPageUrl('Dashboard')} className="text-3xl font-black tracking-tight">
                <span className="text-white">X</span>
                <span className="text-cyan-400">1</span>
              </Link>
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-xs">
                Mainnet
              </Badge>
            </div>
            
            <nav className="hidden md:flex items-center gap-6">
              <Link to={createPageUrl('Dashboard')} className="text-gray-400 hover:text-white transition-colors">
                Cluster Stats
              </Link>
              <Link to={createPageUrl('Validators')} className="text-gray-400 hover:text-white transition-colors">
                Validators
              </Link>
              <Link to={createPageUrl('Blocks')} className="text-white font-medium">
                Blocks
              </Link>
              <Link to={createPageUrl('Transactions')} className="text-gray-400 hover:text-white transition-colors">
                Transactions
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Back & Navigation */}
        <div className="flex items-center justify-between">
          <Link to={createPageUrl('Blocks')}>
            <Button variant="ghost" className="text-gray-400 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Blocks
            </Button>
          </Link>
          
          <div className="flex items-center gap-2">
            <Link to={createPageUrl('BlockDetail') + `?slot=${block.parent}`}>
              <Button variant="outline" size="icon" className="border-white/10 text-gray-400 hover:text-white">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </Link>
            <span className="text-gray-400 text-sm">Block #{slot}</span>
            <Link to={createPageUrl('BlockDetail') + `?slot=${block.slot + 1}`}>
              <Button variant="outline" size="icon" className="border-white/10 text-gray-400 hover:text-white">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Block Header */}
        <div className="flex items-start gap-4">
          <div className="p-4 bg-purple-500/10 rounded-2xl">
            <Layers className="w-10 h-10 text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Block #{block.slot.toLocaleString()}</h1>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                Confirmed
              </Badge>
            </div>
            <p className="text-gray-400 mt-1">
              Produced {new Date(block.timestamp).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-[#111827]/80 border-white/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Zap className="w-4 h-4" />
                Transactions
              </div>
              <p className="text-2xl font-bold text-white">{block.txCount.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-[#111827]/80 border-white/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <CheckCircle className="w-4 h-4" />
                Success Rate
              </div>
              <p className="text-2xl font-bold text-emerald-400">
                {((block.successTx / block.txCount) * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card className="bg-[#111827]/80 border-white/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Clock className="w-4 h-4" />
                Block Time
              </div>
              <p className="text-2xl font-bold text-white">{block.time}ms</p>
            </CardContent>
          </Card>
          <Card className="bg-[#111827]/80 border-white/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <Hash className="w-4 h-4" />
                Total Fees
              </div>
              <p className="text-2xl font-bold text-cyan-400">{block.fees} X1</p>
            </CardContent>
          </Card>
        </div>

        {/* Block Details */}
        <Card className="bg-gradient-to-br from-[#111827] to-[#0d1320] border-white/5">
          <CardHeader className="border-b border-white/5">
            <CardTitle className="text-lg">Block Overview</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/5">
              <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 gap-2">
                <span className="text-gray-400">Slot</span>
                <span className="text-white font-mono">{block.slot.toLocaleString()}</span>
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 gap-2">
                <span className="text-gray-400">Blockhash</span>
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 font-mono text-sm break-all">{block.blockhash}</span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="shrink-0 h-8 w-8"
                    onClick={() => handleCopy(block.blockhash)}
                  >
                    {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 gap-2">
                <span className="text-gray-400">Previous Blockhash</span>
                <span className="text-gray-300 font-mono text-sm break-all">{block.previousBlockhash}</span>
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 gap-2">
                <span className="text-gray-400">Parent Slot</span>
                <Link 
                  to={createPageUrl('BlockDetail') + `?slot=${block.parent}`}
                  className="text-cyan-400 hover:underline font-mono"
                >
                  {block.parent.toLocaleString()}
                </Link>
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 gap-2">
                <span className="text-gray-400">Block Leader</span>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-xs font-bold text-black">
                    X1
                  </div>
                  <span className="text-white">{block.leader}</span>
                </div>
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 gap-2">
                <span className="text-gray-400">Leader Pubkey</span>
                <span className="text-gray-300 font-mono text-sm break-all">{block.leaderPubkey}</span>
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 gap-2">
                <span className="text-gray-400">Successful Transactions</span>
                <span className="text-emerald-400 font-mono">{block.successTx.toLocaleString()}</span>
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 gap-2">
                <span className="text-gray-400">Failed Transactions</span>
                <span className="text-red-400 font-mono">{block.failedTx}</span>
              </div>
              <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-4 gap-2">
                <span className="text-gray-400">Block Rewards</span>
                <span className="text-white font-mono">{block.rewards} X1</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* View Transactions Button */}
        <div className="flex justify-center">
          <Link to={createPageUrl('Transactions') + `?block=${slot}`}>
            <Button className="bg-cyan-500 hover:bg-cyan-600 text-black font-semibold px-8">
              View Block Transactions
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}