import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Search, 
  Users, 
  ArrowUpDown,
  ExternalLink,
  Globe,
  Server,
  Activity,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Shield,
  Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const mockValidators = [
  { 
    id: 'Gv5k..cS5U', 
    name: 'X1 Labs (node9)', 
    stake: 61543564, 
    stakePercent: 6.4,
    commission: 0,
    credits: 3245461,
    version: '2.2.17',
    country: 'FR',
    countryName: 'France',
    isp: 'OVH SAS',
    epochProduced: 13040,
    epochSkipped: 0,
    skipRate: 0,
    delinquent: false
  },
  { 
    id: '7J5w..foTy', 
    name: 'X1 Labs (node4)', 
    stake: 58234891, 
    stakePercent: 6.1,
    commission: 0,
    credits: 3198234,
    version: '2.2.17',
    country: 'DE',
    countryName: 'Germany',
    isp: 'Hetzner Online',
    epochProduced: 12890,
    epochSkipped: 2,
    skipRate: 0.02,
    delinquent: false
  },
  { 
    id: '8xN8..Nhtn', 
    name: 'X1 Labs (node11)', 
    stake: 55123456, 
    stakePercent: 5.7,
    commission: 0,
    credits: 3156789,
    version: '2.2.17',
    country: 'US',
    countryName: 'United States',
    isp: 'AWS',
    epochProduced: 12756,
    epochSkipped: 5,
    skipRate: 0.04,
    delinquent: false
  },
  { 
    id: '73RK..7YUr', 
    name: 'StakeSquid', 
    stake: 42567890, 
    stakePercent: 4.4,
    commission: 5,
    credits: 3089234,
    version: '2.2.16',
    country: 'NL',
    countryName: 'Netherlands',
    isp: 'Leaseweb',
    epochProduced: 11890,
    epochSkipped: 12,
    skipRate: 0.10,
    delinquent: false
  },
  { 
    id: '9FgH..kL2m', 
    name: 'Chorus One', 
    stake: 38901234, 
    stakePercent: 4.0,
    commission: 8,
    credits: 2987654,
    version: '2.2.17',
    country: 'CH',
    countryName: 'Switzerland',
    isp: 'Digital Ocean',
    epochProduced: 11234,
    epochSkipped: 8,
    skipRate: 0.07,
    delinquent: false
  },
  { 
    id: 'Bv4x..pQ9n', 
    name: 'Everstake', 
    stake: 35678901, 
    stakePercent: 3.7,
    commission: 7,
    credits: 2876543,
    version: '2.2.17',
    country: 'UA',
    countryName: 'Ukraine',
    isp: 'Hetzner Online',
    epochProduced: 10987,
    epochSkipped: 15,
    skipRate: 0.14,
    delinquent: false
  },
  { 
    id: 'Cx5y..rS0o', 
    name: 'Staking Facilities', 
    stake: 32456789, 
    stakePercent: 3.4,
    commission: 10,
    credits: 2765432,
    version: '2.2.16',
    country: 'DE',
    countryName: 'Germany',
    isp: 'OVH SAS',
    epochProduced: 10654,
    epochSkipped: 20,
    skipRate: 0.19,
    delinquent: false
  },
  { 
    id: 'Dw6z..sT1p', 
    name: 'Figment', 
    stake: 29234567, 
    stakePercent: 3.0,
    commission: 8,
    credits: 2654321,
    version: '2.2.17',
    country: 'CA',
    countryName: 'Canada',
    isp: 'AWS',
    epochProduced: 10321,
    epochSkipped: 25,
    skipRate: 0.24,
    delinquent: false
  },
  { 
    id: 'Ex7a..tU2q', 
    name: 'P2P Validator', 
    stake: 26012345, 
    stakePercent: 2.7,
    commission: 7,
    credits: 2543210,
    version: '2.2.17',
    country: 'FI',
    countryName: 'Finland',
    isp: 'Equinix',
    epochProduced: 9987,
    epochSkipped: 18,
    skipRate: 0.18,
    delinquent: false
  },
  { 
    id: 'Fy8b..uV3r', 
    name: 'Blockdaemon', 
    stake: 22890123, 
    stakePercent: 2.4,
    commission: 10,
    credits: 2432109,
    version: '2.2.16',
    country: 'US',
    countryName: 'United States',
    isp: 'Google Cloud',
    epochProduced: 9654,
    epochSkipped: 30,
    skipRate: 0.31,
    delinquent: false
  },
];

const getFlagEmoji = (countryCode) => {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
};

export default function Validators() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('stake');
  const [sortOrder, setSortOrder] = useState('desc');

  const filteredValidators = mockValidators
    .filter(v => 
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.id.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const order = sortOrder === 'desc' ? -1 : 1;
      return (a[sortBy] - b[sortBy]) * order;
    });

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
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
              <Link to={createPageUrl('Validators')} className="text-white font-medium">
                Validators
              </Link>
              <Link to={createPageUrl('Blocks')} className="text-gray-400 hover:text-white transition-colors">
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
        {/* Page Title & Stats */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="w-8 h-8 text-cyan-400" />
              Validators
            </h1>
            <p className="text-gray-400 mt-1">Active validators securing the X1 network</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-[#111827]/80 rounded-xl px-4 py-2 border border-white/5">
              <p className="text-gray-400 text-xs">Total Validators</p>
              <p className="text-xl font-bold text-white">961</p>
            </div>
            <div className="bg-[#111827]/80 rounded-xl px-4 py-2 border border-white/5">
              <p className="text-gray-400 text-xs">Active Stake</p>
              <p className="text-xl font-bold text-cyan-400">961.9M</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <Card className="bg-[#111827]/80 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by validator name or identity..."
                className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-gray-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Validators Table */}
        <Card className="bg-gradient-to-br from-[#111827] to-[#0d1320] border-white/5">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-gray-400 text-xs font-medium px-4 py-3 uppercase tracking-wider">Identity</th>
                    <th className="text-left text-gray-400 text-xs font-medium px-4 py-3 uppercase tracking-wider">Node</th>
                    <th 
                      className="text-right text-gray-400 text-xs font-medium px-4 py-3 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => toggleSort('stake')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Active Stake
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th 
                      className="text-right text-gray-400 text-xs font-medium px-4 py-3 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => toggleSort('commission')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Comm.
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="text-left text-gray-400 text-xs font-medium px-4 py-3 uppercase tracking-wider">Version</th>
                    <th className="text-left text-gray-400 text-xs font-medium px-4 py-3 uppercase tracking-wider">Country</th>
                    <th 
                      className="text-right text-gray-400 text-xs font-medium px-4 py-3 uppercase tracking-wider cursor-pointer hover:text-white"
                      onClick={() => toggleSort('skipRate')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Skip Rate
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="text-right text-gray-400 text-xs font-medium px-4 py-3 uppercase tracking-wider">Epoch Stats</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredValidators.map((validator, index) => (
                    <tr 
                      key={validator.id}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-xs font-bold text-black">
                            X1
                          </div>
                          <div>
                            <p className="font-medium text-white">{validator.name}</p>
                            <p className="text-gray-500 text-xs font-mono">{validator.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                          <Server className="w-4 h-4" />
                          {validator.isp}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <p className="text-white font-mono">{(validator.stake / 1000000).toFixed(1)}M</p>
                        <p className="text-gray-500 text-xs">{validator.stakePercent}%</p>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Badge variant="outline" className={`${validator.commission === 0 ? 'border-emerald-500/30 text-emerald-400' : 'border-gray-500/30 text-gray-400'}`}>
                          {validator.commission}%
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className="border-blue-500/30 text-blue-400 font-mono text-xs">
                          {validator.version}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getFlagEmoji(validator.country)}</span>
                          <span className="text-gray-400 text-sm">{validator.countryName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`font-mono ${validator.skipRate < 0.1 ? 'text-emerald-400' : validator.skipRate < 0.25 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {validator.skipRate.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-4">
                          <div>
                            <p className="text-gray-400 text-xs">Produced</p>
                            <p className="text-emerald-400 font-mono text-sm">{validator.epochProduced.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs">Skipped</p>
                            <p className="text-red-400 font-mono text-sm">{validator.epochSkipped}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-sm">
            Showing <span className="text-white">1-10</span> of <span className="text-white">961</span> validators
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" className="border-white/10 bg-cyan-500/10 text-cyan-400">1</Button>
            <Button variant="outline" className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5">2</Button>
            <Button variant="outline" className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5">3</Button>
            <span className="text-gray-500">...</span>
            <Button variant="outline" className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5">97</Button>
            <Button variant="outline" size="icon" className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}