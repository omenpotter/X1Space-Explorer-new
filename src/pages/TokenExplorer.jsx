import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Coins, Search, Loader2, TrendingUp, TrendingDown, Star, ChevronLeft, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';

export default function TokenExplorer() {
  const [loading, setLoading] = useState(true);
  const [supply, setSupply] = useState({ total: 1000000000, circulating: 850000000 }); // Hardcoded fallback
  const [validators, setValidators] = useState({ totalStake: 650000000 });
  const [allTokens, setAllTokens] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [tokenDetails, setTokenDetails] = useState(null);
  const [tokenTransactions, setTokenTransactions] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [tokenHolders, setTokenHolders] = useState([]);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [simulatedPrices, setSimulatedPrices] = useState({});
  const [tokenMetadata, setTokenMetadata] = useState(null);
  const [approveAmount, setApproveAmount] = useState('');
  const [approveSpender, setApproveSpender] = useState('');

  useEffect(() => {
    loadWatchlist();
    fetchData();
  }, []);

  const loadWatchlist = () => {
    const saved = localStorage.getItem('x1_token_watchlist');
    if (saved) setWatchlist(JSON.parse(saved));
  };

  const toggleWatchlist = (mint) => {
    const updated = watchlist.includes(mint) 
      ? watchlist.filter(m => m !== mint)
      : [...watchlist, mint];
    setWatchlist(updated);
    localStorage.setItem('x1_token_watchlist', JSON.stringify(updated));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch supply with fallback
      const supplyRes = await fetch('https://nexus.fortiblox.com/rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'pb_live_7d62cd095391ffd14daca14f2f739b06cac5fd182ca48aed9e2b106ba920c6b0',
          'Authorization': 'Bearer fbx_d4a25e545366fed1ea1582884e62874d6b9fdf94d1f6c4b9889fefa951300dff'
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSupply', params: [] })
      });
      const supplyData = await supplyRes.json();
      
      if (supplyData?.result?.value) {
        const val = supplyData.result.value;
        setSupply({
          total: Number(val.total) / 1e9,
          circulating: Number(val.circulating) / 1e9
        });
      }

      // Fetch validators for stake
      const voteRes = await fetch('https://nexus.fortiblox.com/rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'pb_live_7d62cd095391ffd14daca14f2f739b06cac5fd182ca48aed9e2b106ba920c6b0'
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getVoteAccounts', params: [] })
      });
      const voteData = await voteRes.json();
      if (voteData?.result) {
        const totalStake = voteData.result.current.reduce((sum, v) => sum + v.activatedStake, 0) / 1e9;
        setValidators({ totalStake });
      }

      // Fetch tokens
      const tokensRes = await fetch('https://nexus.fortiblox.com/rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'pb_live_7d62cd095391ffd14daca14f2f739b06cac5fd182ca48aed9e2b106ba920c6b0'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getProgramAccounts',
          params: ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', { encoding: 'jsonParsed' }]
        })
      });
      const tokensData = await tokensRes.json();
      
      if (tokensData?.result) {
        const mints = new Map();
        tokensData.result.forEach(acc => {
          if (acc.account?.data?.parsed?.type === 'mint') {
            const info = acc.account.data.parsed.info;
            const mint = acc.pubkey;
            const decimals = info.decimals || 9;
            const supply = Number(info.supply || 0) / Math.pow(10, decimals);

            if (supply > 0) {
              mints.set(mint, {
                mint,
                name: `SPL ${mint.substring(0, 6)}`,
                symbol: mint.substring(0, 4).toUpperCase(),
                decimals,
                totalSupply: supply,
                price: 0, // No price data available yet
                marketCap: 0,
                priceChange24h: 0,
                volume24h: 0,
                mintAuthority: info.mintAuthority || null,
                freezeAuthority: info.freezeAuthority || null,
                priceHistory: []
              });
            }
          }
        });
        const tokenList = Array.from(mints.values()).slice(0, 50);
        setAllTokens(tokenList);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTokenDetails = async (mint) => {
    setLoadingDetails(true);
    setSelectedToken(mint);
    setTokenTransactions([]);
    setTokenHolders([]);
    setTokenMetadata(null);
    
    try {
      // Import X1Rpc
      const X1Rpc = (await import('../components/x1/X1RpcService')).default;
      
      // Fetch token metadata from common standards (Metaplex)
      try {
        const metadataRes = await fetch('https://nexus.fortiblox.com/rpc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'pb_live_7d62cd095391ffd14daca14f2f739b06cac5fd182ca48aed9e2b106ba920c6b0'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getAccountInfo',
            params: [mint, { encoding: 'jsonParsed' }]
          })
        });
        const metadataData = await metadataRes.json();
        if (metadataData?.result?.value?.data?.parsed?.info?.uri) {
          const uri = metadataData.result.value.data.parsed.info.uri;
          const metaRes = await fetch(uri);
          const meta = await metaRes.json();
          setTokenMetadata({
            name: meta.name || null,
            symbol: meta.symbol || null,
            image: meta.image || null,
            description: meta.description || null,
            website: meta.external_url || null,
            twitter: meta.twitter || null
          });
        }
      } catch (e) {
        // Metadata not available
      }
      
      // Fetch token account info
      const accountInfo = await X1Rpc.getAccountInfo(mint);
      if (accountInfo?.value) {
        const parsed = accountInfo.value.data?.parsed?.info;
        setTokenDetails({
          mint,
          decimals: parsed?.decimals || 9,
          supply: Number(parsed?.supply || 0) / Math.pow(10, parsed?.decimals || 9),
          mintAuthority: parsed?.mintAuthority || 'None',
          freezeAuthority: parsed?.freezeAuthority || 'None',
          isInitialized: parsed?.isInitialized || false,
          supplyType: parsed?.mintAuthority ? 'Mintable' : 'Fixed Supply'
        });
      }
      
      // Fetch token holders
      const holdersRes = await fetch('https://nexus.fortiblox.com/rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'pb_live_7d62cd095391ffd14daca14f2f739b06cac5fd182ca48aed9e2b106ba920c6b0'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getProgramAccounts',
          params: [
            'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            {
              encoding: 'jsonParsed',
              filters: [
                { dataSize: 165 },
                { memcmp: { offset: 0, bytes: mint } }
              ]
            }
          ]
        })
      });
      const holdersData = await holdersRes.json();
      
      if (holdersData?.result) {
        const holders = holdersData.result
          .map(acc => {
            const info = acc.account?.data?.parsed?.info;
            return {
              address: info?.owner || '',
              balance: Number(info?.tokenAmount?.amount || 0) / Math.pow(10, info?.tokenAmount?.decimals || 9),
              percentage: 0
            };
          })
          .filter(h => h.balance > 0)
          .sort((a, b) => b.balance - a.balance)
          .slice(0, 20);
        
        const totalSupply = holders.reduce((sum, h) => sum + h.balance, 0);
        holders.forEach(h => {
          h.percentage = (h.balance / totalSupply) * 100;
        });
        
        setTokenHolders(holders);
      }

      // Fetch token transactions
      const signatures = await X1Rpc.getSignaturesForAddress(mint, { limit: 50 });
      const txDetails = [];
      
      for (const sig of signatures.slice(0, 50)) {
        try {
          const tx = await X1Rpc.getTransaction(sig.signature);
          if (tx) {
            const message = tx.transaction?.message;
            const meta = tx.meta;
            const accountKeys = message?.accountKeys || [];
            
            // Determine transaction type and details
            let type = 'transfer';
            let amount = 0;
            let from = accountKeys[0] || '';
            let to = accountKeys[1] || '';
            
            // Parse pre/post token balances for amount
            const preTokenBalances = meta?.preTokenBalances || [];
            const postTokenBalances = meta?.postTokenBalances || [];
            
            if (preTokenBalances.length > 0 && postTokenBalances.length > 0) {
              const preAmount = preTokenBalances[0]?.uiTokenAmount?.uiAmount || 0;
              const postAmount = postTokenBalances[0]?.uiTokenAmount?.uiAmount || 0;
              amount = Math.abs(postAmount - preAmount);
            }
            
            txDetails.push({
              signature: sig.signature,
              blockTime: sig.blockTime,
              type,
              amount,
              from,
              to,
              status: meta?.err ? 'failed' : 'success'
            });
          }
        } catch (e) {
          // Skip failed tx fetches
        }
      }
      
      setTokenTransactions(txDetails);
    } catch (err) {
      console.error('Failed to fetch token details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatNum = (num) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Recently';
    const diff = (Date.now() / 1000 - timestamp);
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const handleTransfer = async () => {
    if (!transferTo || !transferAmount || !selectedToken) return;
    alert(`Transfer functionality requires wallet integration. Would transfer ${transferAmount} tokens to ${transferTo}`);
  };

  const handleApprove = async () => {
    if (!approveSpender || !approveAmount || !selectedToken) return;
    alert(`Approve functionality requires wallet integration. Would approve ${approveAmount} tokens for spender ${approveSpender}`);
  };

  const xntHistory = Array.from({ length: 30 }, (_, i) => ({ day: i, price: 1.00 }));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
      </div>
    );
  }

  const topTokens = allTokens.slice(0, 10);
  const totalMarketCap = supply.circulating * 1.0;

  return (
    <div className="min-h-screen bg-[#1d2d3a] text-white">
      <header className="bg-[#1d2d3a] border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2 hover:opacity-80">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
                <span className="font-bold"><span className="text-cyan-400">X1</span>Space</span>
              </Link>
            </div>
            <Button onClick={fetchData} variant="outline" size="sm" className="border-white/20 text-cyan-400">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <Coins className="w-7 h-7 text-cyan-400" />
          Token Explorer
        </h1>

        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#24384a] rounded-lg p-4">
            <p className="text-gray-400 text-xs">Total Market Cap</p>
            <p className="text-2xl font-bold text-cyan-400">${formatNum(totalMarketCap)}</p>
          </div>
          <div className="bg-[#24384a] rounded-lg p-4">
            <p className="text-gray-400 text-xs">XNT Supply</p>
            <p className="text-2xl font-bold text-white">{formatNum(supply.total)} XNT</p>
          </div>
          <div className="bg-[#24384a] rounded-lg p-4">
            <p className="text-gray-400 text-xs">Circulating</p>
            <p className="text-2xl font-bold text-emerald-400">{formatNum(supply.circulating)} XNT</p>
          </div>
          <div className="bg-[#24384a] rounded-lg p-4">
            <p className="text-gray-400 text-xs">Total Staked</p>
            <p className="text-2xl font-bold text-purple-400">{formatNum(validators.totalStake)} XNT</p>
          </div>
        </div>

        {/* XNT Featured */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                <span className="text-black font-black text-lg">X1</span>
              </div>
              <div>
                <h2 className="text-xl font-bold">X1 Native Token (XNT)</h2>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-0 mt-1">$1.00 OTC</Badge>
              </div>
            </div>
            <div className="h-16 w-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={xntHistory}>
                  <Line type="monotone" dataKey="price" stroke="#06b6d4" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top Tokens */}
        <div className="bg-[#24384a] rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="text-white font-medium">Top Tokens by Market Cap</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 text-xs px-4 py-3">Token</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3">Supply</th>
                  <th className="text-center text-gray-400 text-xs px-4 py-3">Status</th>
                  <th className="text-center text-gray-400 text-xs px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {topTokens.map((token, i) => (
                  <tr key={token.mint} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <Coins className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{token.name}</p>
                          <p className="text-gray-500 text-xs">{token.symbol}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">{formatNum(token.totalSupply)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge className="bg-gray-500/20 text-gray-400 border-0">Not Trading</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => fetchTokenDetails(token.mint)}
                          className="border-white/20 text-cyan-400 hover:bg-cyan-500/10 text-xs"
                        >
                         View
                        </Button>
                        <button onClick={() => toggleWatchlist(token.mint)} className={watchlist.includes(token.mint) ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'}>
                         <Star className="w-4 h-4" fill={watchlist.includes(token.mint) ? 'currentColor' : 'none'} />
                        </button>
                        </div>
                        </td>
                        </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Token Details Modal */}
        {selectedToken && (
          <div className="bg-[#24384a] rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium text-lg">Token Details</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedToken(null)} className="text-gray-400">Close</Button>
            </div>
            
            {loadingDetails ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              </div>
            ) : tokenDetails ? (
              <>
                {/* Token Metadata */}
                {tokenMetadata && (
                  <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-4">
                      {tokenMetadata.image && (
                        <img src={tokenMetadata.image} alt={tokenMetadata.name} className="w-16 h-16 rounded-full" />
                      )}
                      <div className="flex-1">
                        <h4 className="text-white font-bold text-lg">{tokenMetadata.name || 'Unknown Token'}</h4>
                        <p className="text-gray-400 text-sm">{tokenMetadata.description || 'No description available'}</p>
                        <div className="flex gap-3 mt-2">
                          {tokenMetadata.website && (
                            <a href={tokenMetadata.website} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-xs hover:underline">
                              🌐 Website
                            </a>
                          )}
                          {tokenMetadata.twitter && (
                            <a href={tokenMetadata.twitter} target="_blank" rel="noopener noreferrer" className="text-cyan-400 text-xs hover:underline">
                              🐦 Twitter
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Mint Address</p>
                    <p className="text-cyan-400 font-mono text-xs break-all">{tokenDetails.mint}</p>
                  </div>
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Total Supply</p>
                    <p className="text-white font-bold">{formatNum(tokenDetails.supply)}</p>
                  </div>
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Decimals</p>
                    <p className="text-white font-bold">{tokenDetails.decimals}</p>
                  </div>
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Mint Authority</p>
                    <p className="text-white font-mono text-xs break-all">{tokenDetails.mintAuthority}</p>
                  </div>
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Freeze Authority</p>
                    <p className="text-white font-mono text-xs break-all">{tokenDetails.freezeAuthority}</p>
                  </div>
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Supply Type</p>
                    <Badge className="bg-purple-500/20 text-purple-400 border-0">{tokenDetails.supplyType}</Badge>
                  </div>
                </div>

                {/* Token Interactions */}
                <div className="bg-[#1d2d3a] rounded-lg p-4 mb-6">
                  <h4 className="text-white font-medium mb-3">Token Actions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Transfer To</label>
                      <Input
                        placeholder="Recipient address..."
                        value={transferTo}
                        onChange={(e) => setTransferTo(e.target.value)}
                        className="bg-[#24384a] border-0 text-white font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Amount</label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="0.0"
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                          className="bg-[#24384a] border-0 text-white font-mono"
                        />
                        <Button onClick={handleTransfer} className="bg-cyan-500 hover:bg-cyan-600">
                          Transfer
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Approve Spender</label>
                      <Input
                        placeholder="Spender address..."
                        value={approveSpender}
                        onChange={(e) => setApproveSpender(e.target.value)}
                        className="bg-[#24384a] border-0 text-white font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Allowance</label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="0.0"
                          value={approveAmount}
                          onChange={(e) => setApproveAmount(e.target.value)}
                          className="bg-[#24384a] border-0 text-white font-mono"
                        />
                        <Button onClick={handleApprove} className="bg-purple-500 hover:bg-purple-600">
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">⚠️ Wallet connection required for token interactions</p>
                </div>

                {/* Contract ABI */}
                <div className="bg-[#1d2d3a] rounded-lg p-4 mb-6">
                  <h4 className="text-white font-medium mb-2">Contract Interface (SPL Token Standard)</h4>
                  <div className="bg-[#0a0f1a] rounded p-3 overflow-x-auto">
                    <pre className="text-xs text-gray-400 font-mono">
{`interface SPLToken {
  function transfer(address recipient, uint256 amount) public;
  function approve(address spender, uint256 amount) public;
  function transferFrom(address sender, address recipient, uint256 amount) public;
  function balanceOf(address account) public view returns (uint256);
  function allowance(address owner, address spender) public view returns (uint256);
}`}
                    </pre>
                  </div>
                </div>

                {/* Token Holders */}
                <h4 className="text-white font-medium mb-3">Top Token Holders ({tokenHolders.length})</h4>
                {tokenHolders.length > 0 ? (
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left text-gray-400 text-xs px-2 py-2">#</th>
                          <th className="text-left text-gray-400 text-xs px-2 py-2">Address</th>
                          <th className="text-right text-gray-400 text-xs px-2 py-2">Balance</th>
                          <th className="text-right text-gray-400 text-xs px-2 py-2">Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tokenHolders.map((holder, i) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <td className="px-2 py-2 text-gray-400">{i + 1}</td>
                            <td className="px-2 py-2">
                              <Link to={createPageUrl('AddressLookup') + `?address=${holder.address}`} className="text-cyan-400 hover:underline font-mono text-xs">
                                {holder.address.substring(0, 12)}...{holder.address.slice(-4)}
                              </Link>
                            </td>
                            <td className="px-2 py-2 text-right text-white font-mono text-sm">{holder.balance.toFixed(4)}</td>
                            <td className="px-2 py-2 text-right">
                              <Badge className="bg-purple-500/20 text-purple-400 border-0">{holder.percentage.toFixed(2)}%</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4 mb-6">No holders found</p>
                )}

                <h4 className="text-white font-medium mb-3">Recent Transactions ({tokenTransactions.length})</h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left text-gray-400 text-xs px-2 py-2">Signature</th>
                        <th className="text-left text-gray-400 text-xs px-2 py-2">Type</th>
                        <th className="text-right text-gray-400 text-xs px-2 py-2">Amount</th>
                        <th className="text-left text-gray-400 text-xs px-2 py-2">From</th>
                        <th className="text-left text-gray-400 text-xs px-2 py-2">To</th>
                        <th className="text-right text-gray-400 text-xs px-2 py-2">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenTransactions.map((tx, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="px-2 py-2">
                            <Link to={createPageUrl('TransactionDetail') + `?sig=${tx.signature}`} className="text-cyan-400 hover:underline font-mono text-xs">
                              {tx.signature.substring(0, 8)}...
                            </Link>
                          </td>
                          <td className="px-2 py-2">
                            <Badge className="bg-blue-500/20 text-blue-400 border-0 text-xs">{tx.type}</Badge>
                          </td>
                          <td className="px-2 py-2 text-right text-white font-mono text-xs">{tx.amount.toFixed(4)}</td>
                          <td className="px-2 py-2">
                            <Link to={createPageUrl('AddressLookup') + `?address=${tx.from}`} className="text-cyan-400 hover:underline font-mono text-xs">
                              {tx.from.substring(0, 8)}...
                            </Link>
                          </td>
                          <td className="px-2 py-2">
                            <Link to={createPageUrl('AddressLookup') + `?address=${tx.to}`} className="text-emerald-400 hover:underline font-mono text-xs">
                              {tx.to.substring(0, 8)}...
                            </Link>
                          </td>
                          <td className="px-2 py-2 text-right text-gray-400 text-xs">{formatTime(tx.blockTime)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-gray-400 text-center py-8">No details available</p>
            )}
          </div>
        )}

        {/* All Tokens */}
        <div className="bg-[#24384a] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5">
            <h3 className="text-white font-medium">All Tokens ({allTokens.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 text-xs px-4 py-3">#</th>
                  <th className="text-left text-gray-400 text-xs px-4 py-3">Token</th>
                  <th className="text-right text-gray-400 text-xs px-4 py-3">Supply</th>
                  <th className="text-center text-gray-400 text-xs px-4 py-3">Status</th>
                  <th className="text-center text-gray-400 text-xs px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {allTokens.map((token, i) => (
                  <tr key={token.mint} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Coins className="w-6 h-6 text-purple-400" />
                        <div>
                          <p className="text-white text-sm">{token.symbol}</p>
                          <p className="text-gray-500 text-xs font-mono">{token.mint.substring(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">{formatNum(token.totalSupply)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge className="bg-gray-500/20 text-gray-400 border-0">Not Trading</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => toggleWatchlist(token.mint)} className={watchlist.includes(token.mint) ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'}>
                          <Star className="w-4 h-4" fill={watchlist.includes(token.mint) ? 'currentColor' : 'none'} />
                        </button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => fetchTokenDetails(token.mint)}
                          className="text-cyan-400 hover:bg-cyan-500/10 text-xs h-7"
                        >
                          Details
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}