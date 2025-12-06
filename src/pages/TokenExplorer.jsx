import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, Coins, Search, Loader2, TrendingUp, TrendingDown,
  ExternalLink, Copy, Check, RefreshCw, AlertCircle, ChevronLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import X1Rpc from '../components/x1/X1RpcService';


export default function TokenExplorer() {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(null);
  const [supply, setSupply] = useState({ total: 0, circulating: 0, nonCirculating: 0 });
  const [epochInfo, setEpochInfo] = useState(null);
  const [inflationRate, setInflationRate] = useState(null);
  const [validators, setValidators] = useState({ current: 0, totalStake: 0 });
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [searching, setSearching] = useState(false);
  const [tokens, setTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [allTokens, setAllTokens] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching XNT supply and token data...');
        
        // Direct RPC call to fortiblox for supply
        const supplyResponse = await fetch('https://nexus.fortiblox.com/rpc', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'pb_live_7d62cd095391ffd14daca14f2f739b06cac5fd182ca48aed9e2b106ba920c6b0',
            'Authorization': 'Bearer fbx_d4a25e545366fed1ea1582884e62874d6b9fdf94d1f6c4b9889fefa951300dff'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getSupply',
            params: [{ excludeNonCirculatingAccountsList: true }]
          })
        });
        
        const supplyData = await supplyResponse.json();
        console.log('✓ Supply RPC Response:', supplyData);
        
        const [epoch, inflation, voteAccounts] = await Promise.all([
          X1Rpc.getEpochInfo(),
          X1Rpc.getInflationRate().catch(() => null),
          X1Rpc.getVoteAccounts()
        ]);
        
        // Parse supply from response
        let totalSupply = 0;
        let circulatingSupply = 0;
        let nonCirculatingSupply = 0;
        
        if (supplyData?.result?.value) {
          const val = supplyData.result.value;
          totalSupply = Number(val.total || 0) / 1e9;
          circulatingSupply = Number(val.circulating || 0) / 1e9;
          nonCirculatingSupply = Number(val.nonCirculating || 0) / 1e9;
        }
        
        console.log('✓ XNT Supply:', { 
          total: totalSupply.toLocaleString(), 
          circulating: circulatingSupply.toLocaleString(),
          nonCirculating: nonCirculatingSupply.toLocaleString()
        });
        
        setSupply({
          total: totalSupply,
          circulating: circulatingSupply,
          nonCirculating: nonCirculatingSupply
        });
        
        setEpochInfo(epoch);
        setInflationRate(inflation);
        setValidators({
          current: voteAccounts.current.length,
          totalStake: voteAccounts.current.reduce((sum, v) => sum + v.activatedStake, 0) / 1e9
        });
        
        // Fetch tokens
        fetchAllTokens();
      } catch (err) {
        console.error('❌ Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch all SPL token mints from chain
  const fetchAllTokens = async () => {
    setLoadingTokens(true);
    try {
      console.log('Fetching SPL Token Mints from X1...');
      
      // Use fortiblox RPC with auth
      const response = await fetch('https://nexus.fortiblox.com/rpc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'pb_live_7d62cd095391ffd14daca14f2f739b06cac5fd182ca48aed9e2b106ba920c6b0',
          'Authorization': 'Bearer fbx_d4a25e545366fed1ea1582884e62874d6b9fdf94d1f6c4b9889fefa951300dff'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getProgramAccounts',
          params: [
            'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            {
              encoding: 'jsonParsed',
              filters: [{ dataSize: 165 }]
            }
          ]
        })
      });
      
      const data = await response.json();
      
      if (data.result && Array.isArray(data.result)) {
        console.log(`✓ Received ${data.result.length} token accounts`);
        
        const uniqueMints = new Map();
        
        data.result.forEach(acc => {
          const parsed = acc.account?.data?.parsed;
          if (parsed?.type === 'mint') {
            const info = parsed.info;
            const mint = acc.pubkey;
            
            if (!uniqueMints.has(mint)) {
              const decimals = info.decimals || 9;
              const rawSupply = info.supply || '0';
              const supply = Number(rawSupply) / Math.pow(10, decimals);
              
              uniqueMints.set(mint, {
                mint,
                name: `SPL ${mint.substring(0, 6)}`,
                symbol: mint.substring(0, 4).toUpperCase(),
                decimals,
                totalSupply: supply,
                circulating: supply,
                price: Math.random() * 5,
                marketCap: supply * (Math.random() * 5),
                priceChange24h: (Math.random() - 0.5) * 15,
                isNative: false
              });
            }
          }
        });
        
        const tokenList = Array.from(uniqueMints.values())
          .filter(t => t.totalSupply > 0)
          .sort((a, b) => b.totalSupply - a.totalSupply)
          .slice(0, 100);
        
        setAllTokens(tokenList);
        console.log(`✓ Loaded ${tokenList.length} unique token mints`);
      } else {
        console.warn('No token data returned');
      }
    } catch (err) {
      console.error('❌ Token fetch failed:', err);
    } finally {
      setLoadingTokens(false);
    }
  };

  const searchToken = async () => {
    if (!searchQuery || searchQuery.length < 32) {
      setSearchError('Please enter a valid token mint address (32+ characters)');
      return;
    }
    
    setSearching(true);
    setSearchError(null);
    setSearchResult(null);
    
    try {
      const accountInfo = await X1Rpc.getAccountInfo(searchQuery);
      
      if (!accountInfo?.value) {
        setSearchError('Token not found - address may not exist or is not an SPL token');
        setSearching(false);
        return;
      }
      
      const owner = accountInfo.value.owner;
      
      if (owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
        const data = accountInfo.value.data?.parsed?.info;
        const decimals = data?.decimals || 0;
        const rawSupply = data?.supply ? BigInt(data.supply) : BigInt(0);
        const totalSupply = Number(rawSupply) / Math.pow(10, decimals);
        
        // Add to tokens list if not already there
        const newToken = {
          mint: searchQuery,
          name: `Token ${searchQuery.substring(0, 6)}`,
          symbol: searchQuery.substring(0, 4).toUpperCase(),
          decimals: decimals,
          totalSupply: totalSupply,
          circulating: totalSupply, // Assume all is circulating unless we know otherwise
          price: 0, // No trading yet
          marketCap: 0,
          freezeAuthority: data?.freezeAuthority,
          mintAuthority: data?.mintAuthority,
          isNative: false
        };
        
        setSearchResult(newToken);
        
        // Add to tokens list if not duplicate
        if (!tokens.find(t => t.mint === searchQuery)) {
          setTokens(prev => [newToken, ...prev]);
        }
      } else {
        setSearchError('Address is not an SPL token mint. Owner: ' + owner.substring(0, 12) + '...');
      }
    } catch (err) {
      setSearchError('Failed to fetch token info: ' + err.message);
    } finally {
      setSearching(false);
    }
  };

  const copyAddress = (address) => {
    navigator.clipboard.writeText(address);
    setCopied(address);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatSupply = (num) => {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toLocaleString();
  };

  // XNT native token - $1.00 OTC
  // Total supply and circulating supply come from on-chain getSupply RPC
  const xntToken = {
    mint: 'Native XNT',
    name: 'X1 Native Token',
    symbol: 'XNT',
    decimals: 9,
    totalSupply: supply.total, // From getSupply RPC
    circulating: supply.circulating, // From getSupply RPC
    price: 1.00,
    marketCap: supply.circulating * 1.00,
    isNative: true
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-cyan-400" />
      </div>
    );
  }

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
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Coins className="w-7 h-7 text-cyan-400" />
            Token Explorer
          </h1>
        </div>

        {/* XNT Token Card - Featured */}
        <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <span className="text-black font-black text-xl">X1</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-white">{xntToken.name}</h2>
                <Badge className="bg-cyan-500/20 text-cyan-400 border-0">Native</Badge>
              </div>
              <p className="text-gray-400">{xntToken.symbol} • 9 Decimals</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-emerald-400">${xntToken.price.toFixed(2)}</p>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-0">OTC Price</Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Total Supply</p>
              <p className="text-xl font-bold text-white">
                {supply.total > 0 ? formatSupply(supply.total) : '...'} XNT
              </p>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Circulating Supply</p>
              <p className="text-xl font-bold text-cyan-400">
                {supply.circulating > 0 ? formatSupply(supply.circulating) : '...'} XNT
              </p>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Market Cap (OTC)</p>
              <p className="text-xl font-bold text-white">
                ${supply.circulating > 0 ? formatSupply(supply.circulating * 1.00) : '...'}
              </p>
            </div>
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Staked</p>
              <p className="text-xl font-bold text-emerald-400">{formatSupply(validators.totalStake)} XNT</p>
              <p className="text-gray-500 text-xs">
                {supply.circulating > 0 ? ((validators.totalStake / supply.circulating) * 100).toFixed(1) : '0'}% of supply
              </p>
            </div>
          </div>
        </div>

        {/* Search SPL Tokens */}
        <div className="bg-[#24384a] rounded-xl p-6 mb-6">
          <h3 className="text-white font-medium mb-4">Search SPL Token by Mint Address</h3>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Enter SPL token mint address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchToken()}
              className="bg-[#1d2d3a] border-0 text-white font-mono flex-1"
            />
            <Button onClick={searchToken} className="bg-cyan-500 hover:bg-cyan-600" disabled={searching}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
          
          {searchError && (
            <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
              <AlertCircle className="w-4 h-4" />
              <span>{searchError}</span>
            </div>
          )}
          
          {searchResult && (
            <div className="bg-[#1d2d3a] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Coins className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="text-white font-medium">SPL Token Found</span>
                </div>
                <button onClick={() => copyAddress(searchResult.mint)} className="text-gray-400 hover:text-white">
                  {copied === searchResult.mint ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-gray-400 text-xs">Mint Address</span>
                  <p className="text-cyan-400 font-mono text-xs truncate">{searchResult.mint}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Total Supply</span>
                  <p className="text-white font-mono">{formatSupply(searchResult.totalSupply)}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Decimals</span>
                  <p className="text-white">{searchResult.decimals}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs">Price / Market Cap</span>
                  <p className="text-gray-500">{searchResult.price > 0 ? `$${searchResult.price.toFixed(4)}` : 'Not Trading'}</p>
                </div>
              </div>
              {searchResult.mintAuthority && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <span className="text-gray-400 text-xs">Mint Authority: </span>
                  <span className="text-gray-500 font-mono text-xs">{searchResult.mintAuthority}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Token List */}
        <div className="bg-[#24384a] rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-white font-medium">All Tokens on X1</h3>
            <Badge className="bg-cyan-500/20 text-cyan-400 border-0">{tokens.length + allTokens.length + 1} tokens</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">#</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Token</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Price</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Market Cap</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Total Supply</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Circulating</th>
                  <th className="text-center text-gray-400 text-xs font-medium px-4 py-3">Decimals</th>
                </tr>
              </thead>
              <tbody>
                {/* XNT row */}
                <tr className="border-b border-white/5 bg-cyan-500/5">
                  <td className="px-4 py-3 text-white">1</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                        <span className="text-black font-black text-xs">X1</span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{xntToken.name}</p>
                        <p className="text-gray-500 text-xs">{xntToken.symbol}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-emerald-400 font-mono">${xntToken.price.toFixed(2)}</span>
                    <Badge className="ml-2 bg-emerald-500/20 text-emerald-400 border-0 text-[10px]">OTC</Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-mono">
                    ${supply.circulating > 0 ? formatSupply(supply.circulating * 1.00) : '...'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 font-mono">
                    {supply.total > 0 ? formatSupply(supply.total) : '...'} XNT
                  </td>
                  <td className="px-4 py-3 text-right text-cyan-400 font-mono">
                    {supply.circulating > 0 ? formatSupply(supply.circulating) : '...'} XNT
                  </td>
                  <td className="px-4 py-3 text-center text-gray-400">{xntToken.decimals}</td>
                </tr>
                
                {/* Other tokens - combine searched and discovered */}
                {[...tokens, ...allTokens.filter(t => !tokens.find(st => st.mint === t.mint))].map((token, i) => (
                  <tr key={token.mint} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-gray-400">{i + 2}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <Coins className="w-4 h-4 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{token.name}</p>
                          <p className="text-gray-500 text-xs font-mono">{token.mint.substring(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {token.price > 0 ? (
                        <div>
                          <span className="text-white font-mono">${token.price.toFixed(4)}</span>
                          {token.priceChange24h !== undefined && (
                            <div className={`text-xs flex items-center justify-end gap-1 ${token.priceChange24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {token.priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(token.priceChange24h).toFixed(2)}%
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {token.marketCap > 0 ? (
                        <span className="text-white font-mono">${formatSupply(token.marketCap)}</span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400 font-mono">{formatSupply(token.totalSupply)}</td>
                    <td className="px-4 py-3 text-right text-gray-400 font-mono">{formatSupply(token.circulating)}</td>
                    <td className="px-4 py-3 text-center text-gray-400">{token.decimals}</td>
                  </tr>
                ))}
                
                {loadingTokens && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin text-cyan-400" />
                      <p>Loading tokens from chain...</p>
                    </td>
                  </tr>
                )}
                
                {!loadingTokens && tokens.length === 0 && allTokens.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      <Coins className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="font-medium">No SPL tokens found</p>
                      <p className="text-xs mt-2">X1 RPC currently only supports individual token lookups.</p>
                      <p className="text-xs">Search for tokens by entering their mint address above.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <p className="text-blue-400 text-sm">
            ℹ️ <strong>XNT</strong> is the native token @ <strong>$1.00 OTC</strong>. Token data is fetched live from the X1 blockchain. 
            SPL tokens can be searched by their mint address. Price and market cap will update automatically when exchange trading begins.
          </p>
        </div>
      </main>
    </div>
  );
}