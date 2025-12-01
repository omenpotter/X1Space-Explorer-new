import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Globe, Calculator, Wallet, Star, Trophy, Coins, Map, Clock, Bell, TrendingDown 
} from 'lucide-react';

const links = [
  { page: 'NetworkHealth', icon: Globe, color: 'text-cyan-400', title: 'Network Health', desc: 'Monitor network status' },
  { page: 'TokenExplorer', icon: Coins, color: 'text-yellow-400', title: 'Tokens', desc: 'SPL token explorer' },
  { page: 'NetworkMap', icon: Map, color: 'text-emerald-400', title: 'Network Map', desc: 'Global node distribution' },
  { page: 'EpochHistory', icon: Clock, color: 'text-purple-400', title: 'Epoch History', desc: 'Historical data' },
  { page: 'StakingCalculator', icon: Calculator, color: 'text-cyan-400', title: 'Staking Calculator', desc: 'Estimate rewards' },
  { page: 'ValidatorAlerts', icon: Bell, color: 'text-yellow-400', title: 'Alerts', desc: 'Validator notifications' },
  { page: 'Watchlist', icon: Star, color: 'text-orange-400', title: 'Watchlist', desc: 'Track validators' },
  { page: 'Leaderboard', icon: Trophy, color: 'text-amber-400', title: 'Leaderboard', desc: 'Top validators' },
  { page: 'AddressLookup', icon: Wallet, color: 'text-blue-400', title: 'Address Lookup', desc: 'Search accounts' },
  { page: 'PortfolioTracker', icon: TrendingDown, color: 'text-emerald-400', title: 'Portfolio', desc: 'Track holdings & rewards' },
];

const QuickLinks = memo(function QuickLinks() {
  return (
    <div className="mt-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {links.map(({ page, icon: Icon, color, title, desc }) => (
        <Link key={page} to={createPageUrl(page)} className="bg-[#24384a] rounded-xl p-4 hover:bg-[#2a4258] transition-colors">
          <Icon className={`w-6 h-6 ${color} mb-2`} />
          <p className="text-white font-medium">{title}</p>
          <p className="text-gray-500 text-xs">{desc}</p>
        </Link>
      ))}
    </div>
  );
});

export default QuickLinks;