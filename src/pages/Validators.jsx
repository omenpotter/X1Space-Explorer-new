import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  Zap,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Globe,
  Server,
  TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const mockValidators = [
  { id: 'Gv5k..cS5U', name: 'X1 Labs (node9)', stake: 61543564, commission: 0, version: '2.2.17', country: 'FR', skip: 0, produced: 13040 },
  { id: '7J5w..foTy', name: 'X1 Labs (node4)', stake: 58234891, commission: 0, version: '2.2.17', country: 'DE', skip: 0.02, produced: 12890 },
  { id: '8xN8..Nhtn', name: 'X1 Labs (node11)', stake: 55123456, commission: 0, version: '2.2.17', country: 'US', skip: 0.04, produced: 12756 },
  { id: '73RK..7YUr', name: 'StakeSquid', stake: 42567890, commission: 5, version: '2.2.16', country: 'NL', skip: 0.10, produced: 11890 },
  { id: '9FgH..kL2m', name: 'Chorus One', stake: 38901234, commission: 8, version: '2.2.17', country: 'CH', skip: 0.07, produced: 11234 },
  { id: 'Bv4x..pQ9n', name: 'Everstake', stake: 35678901, commission: 7, version: '2.2.17', country: 'UA', skip: 0.14, produced: 10987 },
  { id: 'Cx5y..rS0o', name: 'Staking Facilities', stake: 32456789, commission: 10, version: '2.2.16', country: 'DE', skip: 0.19, produced: 10654 },
  { id: 'Dw6z..sT1p', name: 'Figment', stake: 29234567, commission: 8, version: '2.2.17', country: 'CA', skip: 0.24, produced: 10321 },
  { id: 'Ex7a..tU2q', name: 'P2P Validator', stake: 26012345, commission: 7, version: '2.2.17', country: 'FI', skip: 0.18, produced: 9987 },
  { id: 'Fy8b..uV3r', name: 'Blockdaemon', stake: 22890123, commission: 10, version: '2.2.16', country: 'US', skip: 0.31, produced: 9654 },
];

const getFlagEmoji = (code) => {
  return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
};

export default function Validators() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('stake');

  const totalStake = mockValidators.reduce((sum, v) => sum + v.stake, 0);

  return (
    <div className="min-h-screen bg-[#1d2d3a] text-white">
      {/* Header */}
      <header className="bg-[#1d2d3a] border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-black font-black text-sm">X1</span>
                </div>
                <div className="hidden sm:block">
                  <span className="text-white font-bold">X1</span>
                  <span className="text-cyan-400 font-bold">.space</span>
                </div>
              </Link>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">Mainnet</Badge>
            </div>
            
            <nav className="hidden md:flex items-center gap-1">
              <Link to={createPageUrl('Dashboard')}>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                  <Zap className="w-5 h-5" />
                </Button>
              </Link>
              <Link to={createPageUrl('Blocks')}>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                  </svg>
                </Button>
              </Link>
              <Link to={createPageUrl('Validators')}>
                <Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 3v18h18" />
                    <path d="M18 17V9" />
                    <path d="M13 17V5" />
                    <path d="M8 17v-3" />
                  </svg>
                </Button>
              </Link>
              <Link to={createPageUrl('Transactions')}>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </Button>
              </Link>
            </nav>
            
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Input
                  placeholder="Search validators..."
                  className="w-full bg-[#24384a] border-0 text-white placeholder:text-gray-500 pr-10 rounded-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button 
                  size="icon" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 bg-cyan-500 hover:bg-cyan-600 h-7 w-7 rounded"
                >
                  <Search className="w-4 h-4 text-black" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Total Validators</p>
            <p className="text-2xl font-bold text-white">961</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Active Stake</p>
            <p className="text-2xl font-bold text-cyan-400">961.9M XNT</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Block Producers</p>
            <p className="text-2xl font-bold text-white">935</p>
          </div>
          <div className="bg-[#24384a] rounded-xl p-4">
            <p className="text-gray-400 text-xs mb-1">Skip Rate</p>
            <p className="text-2xl font-bold text-emerald-400">0.45%</p>
          </div>
        </div>

        {/* Validators Table */}
        <div className="bg-[#24384a] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">#</th>
                  <th className="text-left text-gray-400 text-xs font-medium px-4 py-3">Validator</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3 cursor-pointer hover:text-white" onClick={() => setSortBy('stake')}>
                    <div className="flex items-center justify-end gap-1">
                      Stake <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Share</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Commission</th>
                  <th className="text-center text-gray-400 text-xs font-medium px-4 py-3">Version</th>
                  <th className="text-center text-gray-400 text-xs font-medium px-4 py-3">Country</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Skip Rate</th>
                  <th className="text-right text-gray-400 text-xs font-medium px-4 py-3">Produced</th>
                </tr>
              </thead>
              <tbody>
                {mockValidators.map((validator, index) => {
                  const stakePercent = ((validator.stake / totalStake) * 100).toFixed(1);
                  return (
                    <tr 
                      key={validator.id}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-4 text-gray-500 text-sm">{index + 1}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center text-xs font-bold text-cyan-400">
                            {validator.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-white text-sm">{validator.name}</p>
                            <p className="text-gray-500 text-xs font-mono">{validator.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="text-white font-mono text-sm">{(validator.stake / 1000000).toFixed(1)}M</p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-cyan-500 rounded-full"
                              style={{ width: `${parseFloat(stakePercent) * 10}%` }}
                            />
                          </div>
                          <span className="text-gray-400 text-xs w-12 text-right">{stakePercent}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Badge className={`${validator.commission === 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-400'} border-0`}>
                          {validator.commission}%
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <Badge className="bg-blue-500/20 text-blue-400 border-0 font-mono text-xs">
                          {validator.version}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-lg">{getFlagEmoji(validator.country)}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`font-mono text-sm ${
                          validator.skip < 0.1 ? 'text-emerald-400' : 
                          validator.skip < 0.2 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {validator.skip.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-white font-mono text-sm">{validator.produced.toLocaleString()}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <p className="text-gray-400 text-sm">
            Showing <span className="text-white">1-10</span> of <span className="text-white">961</span>
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-white/10 text-gray-400">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="border-white/10 bg-cyan-500/10 text-cyan-400">1</Button>
            <Button variant="outline" size="sm" className="border-white/10 text-gray-400">2</Button>
            <Button variant="outline" size="sm" className="border-white/10 text-gray-400">3</Button>
            <span className="text-gray-500">...</span>
            <Button variant="outline" size="sm" className="border-white/10 text-gray-400">97</Button>
            <Button variant="outline" size="sm" className="border-white/10 text-gray-400">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}