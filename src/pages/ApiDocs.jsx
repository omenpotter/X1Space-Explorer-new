import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Zap, Code, Copy, Check, Play, Loader2, ChevronDown, ChevronRight,
  Activity, Users, Coins, Clock, BarChart3, Server
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';

const API_BASE = 'https://rpc.mainnet.x1.xyz';

const ENDPOINTS = [
  {
    id: 'tps',
    name: 'Current TPS',
    description: 'Get the current transactions per second',
    method: 'POST',
    icon: Activity,
    color: 'cyan',
    rpcMethod: 'getRecentPerformanceSamples',
    params: [1],
    example: {
      request: {
        jsonrpc: '2.0',
        id: 1,
        method: 'getRecentPerformanceSamples',
        params: [1]
      },
      response: {
        tps: 3245,
        samplePeriod: 60
      }
    }
  },
  {
    id: 'validators',
    name: 'Active Validators',
    description: 'Get list of active and delinquent validators with stake info',
    method: 'POST',
    icon: Users,
    color: 'emerald',
    rpcMethod: 'getVoteAccounts',
    params: [],
    example: {
      request: {
        jsonrpc: '2.0',
        id: 1,
        method: 'getVoteAccounts',
        params: []
      },
      response: {
        current: [{ votePubkey: '...', activatedStake: 1000000, commission: 5 }],
        delinquent: []
      }
    }
  },
  {
    id: 'supply',
    name: 'Total Supply & Staked',
    description: 'Get circulating supply and total staked amount',
    method: 'POST',
    icon: Coins,
    color: 'yellow',
    rpcMethod: 'getSupply',
    params: [],
    example: {
      request: {
        jsonrpc: '2.0',
        id: 1,
        method: 'getSupply',
        params: []
      },
      response: {
        total: 1000000000,
        circulating: 800000000,
        nonCirculating: 200000000
      }
    }
  },
  {
    id: 'epoch',
    name: 'Epoch Information',
    description: 'Get current epoch, progress, and time remaining',
    method: 'POST',
    icon: Clock,
    color: 'purple',
    rpcMethod: 'getEpochInfo',
    params: [],
    example: {
      request: {
        jsonrpc: '2.0',
        id: 1,
        method: 'getEpochInfo',
        params: []
      },
      response: {
        epoch: 245,
        slotIndex: 150000,
        slotsInEpoch: 432000,
        absoluteSlot: 105000000
      }
    }
  },
  {
    id: 'performance',
    name: 'TPS History',
    description: 'Get historical TPS data for charts (up to 720 samples)',
    method: 'POST',
    icon: BarChart3,
    color: 'orange',
    rpcMethod: 'getRecentPerformanceSamples',
    params: [60],
    example: {
      request: {
        jsonrpc: '2.0',
        id: 1,
        method: 'getRecentPerformanceSamples',
        params: [60]
      },
      response: [
        { numTransactions: 195000, samplePeriodSecs: 60 },
        { numTransactions: 188000, samplePeriodSecs: 60 }
      ]
    }
  },
  {
    id: 'cluster',
    name: 'Cluster Nodes',
    description: 'Get all cluster nodes with version and network info',
    method: 'POST',
    icon: Server,
    color: 'blue',
    rpcMethod: 'getClusterNodes',
    params: [],
    example: {
      request: {
        jsonrpc: '2.0',
        id: 1,
        method: 'getClusterNodes',
        params: []
      },
      response: [
        { pubkey: '...', gossip: '1.2.3.4:8001', version: '1.18.0' }
      ]
    }
  }
];

export default function ApiDocs() {
  const [copied, setCopied] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [liveData, setLiveData] = useState({});
  const [loading, setLoading] = useState({});

  const copyCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const tryEndpoint = async (endpoint) => {
    setLoading(prev => ({ ...prev, [endpoint.id]: true }));
    try {
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: endpoint.rpcMethod,
          params: endpoint.params
        })
      });
      const data = await response.json();
      setLiveData(prev => ({ ...prev, [endpoint.id]: data.result }));
    } catch (err) {
      setLiveData(prev => ({ ...prev, [endpoint.id]: { error: err.message } }));
    } finally {
      setLoading(prev => ({ ...prev, [endpoint.id]: false }));
    }
  };

  const colorClasses = {
    cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
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
              <Link to={createPageUrl('ApiDocs')}><Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg"><Code className="w-5 h-5" /></Button></Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
            <Code className="w-8 h-8 text-cyan-400" />
            API Documentation
          </h1>
          <p className="text-gray-400">
            Access X1 network statistics via JSON-RPC. All endpoints use POST method.
          </p>
        </div>

        {/* Base URL */}
        <div className="bg-[#24384a] rounded-xl p-4 mb-6">
          <p className="text-gray-400 text-sm mb-2">Base URL</p>
          <div className="flex items-center gap-2">
            <code className="text-cyan-400 font-mono bg-[#1d2d3a] px-4 py-2 rounded flex-1">
              {API_BASE}
            </code>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyCode(API_BASE, 'base')}
              className="text-gray-400 hover:text-white"
            >
              {copied === 'base' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Quick Start */}
        <div className="bg-[#24384a] rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Start</h2>
          <div className="bg-[#1d2d3a] rounded-lg p-4 relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyCode(`curl -X POST ${API_BASE} \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"getEpochInfo","params":[]}'`, 'curl')}
              className="absolute top-2 right-2 text-gray-400 hover:text-white"
            >
              {copied === 'curl' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </Button>
            <pre className="text-sm text-gray-300 overflow-x-auto">
{`curl -X POST ${API_BASE} \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"getEpochInfo","params":[]}'`}
            </pre>
          </div>
        </div>

        {/* Endpoints */}
        <h2 className="text-lg font-semibold text-white mb-4">Endpoints</h2>
        <div className="space-y-4">
          {ENDPOINTS.map((endpoint) => (
            <div key={endpoint.id} className="bg-[#24384a] rounded-xl overflow-hidden">
              <button
                onClick={() => toggleExpand(endpoint.id)}
                className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[endpoint.color]}`}>
                  <endpoint.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{endpoint.name}</span>
                    <Badge className="bg-purple-500/20 text-purple-400 border-0 text-xs">{endpoint.method}</Badge>
                  </div>
                  <p className="text-gray-500 text-sm">{endpoint.description}</p>
                </div>
                <code className="text-cyan-400/70 font-mono text-sm hidden md:block">{endpoint.rpcMethod}</code>
                {expanded[endpoint.id] ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
              </button>

              {expanded[endpoint.id] && (
                <div className="border-t border-white/5 p-4 space-y-4">
                  {/* Request Example */}
                  <div>
                    <p className="text-gray-400 text-xs mb-2">REQUEST</p>
                    <div className="bg-[#1d2d3a] rounded-lg p-3 relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyCode(JSON.stringify(endpoint.example.request, null, 2), `req-${endpoint.id}`)}
                        className="absolute top-2 right-2 text-gray-500 hover:text-white h-6 w-6"
                      >
                        {copied === `req-${endpoint.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </Button>
                      <pre className="text-xs text-gray-300 overflow-x-auto">
                        {JSON.stringify(endpoint.example.request, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* Response Example */}
                  <div>
                    <p className="text-gray-400 text-xs mb-2">RESPONSE EXAMPLE</p>
                    <div className="bg-[#1d2d3a] rounded-lg p-3">
                      <pre className="text-xs text-emerald-400/80 overflow-x-auto">
                        {JSON.stringify(endpoint.example.response, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* Try It */}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => tryEndpoint(endpoint)}
                      size="sm"
                      className="bg-cyan-500 hover:bg-cyan-600"
                      disabled={loading[endpoint.id]}
                    >
                      {loading[endpoint.id] ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Try It
                    </Button>
                    <span className="text-gray-500 text-xs">Execute this request live</span>
                  </div>

                  {/* Live Response */}
                  {liveData[endpoint.id] && (
                    <div>
                      <p className="text-gray-400 text-xs mb-2">LIVE RESPONSE</p>
                      <div className="bg-[#1d2d3a] rounded-lg p-3 max-h-[300px] overflow-auto">
                        <pre className="text-xs text-cyan-400 overflow-x-auto">
                          {JSON.stringify(liveData[endpoint.id], null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Code Examples */}
        <div className="mt-8 bg-[#24384a] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Code Examples</h2>
          
          <div className="space-y-4">
            {/* JavaScript */}
            <div>
              <p className="text-gray-400 text-xs mb-2">JAVASCRIPT</p>
              <div className="bg-[#1d2d3a] rounded-lg p-4 relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyCode(`const response = await fetch('${API_BASE}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getEpochInfo',
    params: []
  })
});
const data = await response.json();
console.log(data.result);`, 'js')}
                  className="absolute top-2 right-2 text-gray-500 hover:text-white"
                >
                  {copied === 'js' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
                <pre className="text-xs text-gray-300 overflow-x-auto">
{`const response = await fetch('${API_BASE}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getEpochInfo',
    params: []
  })
});
const data = await response.json();
console.log(data.result);`}
                </pre>
              </div>
            </div>

            {/* Python */}
            <div>
              <p className="text-gray-400 text-xs mb-2">PYTHON</p>
              <div className="bg-[#1d2d3a] rounded-lg p-4 relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyCode(`import requests

response = requests.post('${API_BASE}', json={
    'jsonrpc': '2.0',
    'id': 1,
    'method': 'getEpochInfo',
    'params': []
})
print(response.json()['result'])`, 'py')}
                  className="absolute top-2 right-2 text-gray-500 hover:text-white"
                >
                  {copied === 'py' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </Button>
                <pre className="text-xs text-gray-300 overflow-x-auto">
{`import requests

response = requests.post('${API_BASE}', json={
    'jsonrpc': '2.0',
    'id': 1,
    'method': 'getEpochInfo',
    'params': []
})
print(response.json()['result'])`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Rate Limits */}
        <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <p className="text-yellow-400 text-sm font-medium mb-1">Rate Limits</p>
          <p className="text-gray-400 text-sm">
            The public RPC endpoint has rate limits. For production use, consider running your own node or using a dedicated RPC provider.
          </p>
        </div>
      </main>
    </div>
  );
}