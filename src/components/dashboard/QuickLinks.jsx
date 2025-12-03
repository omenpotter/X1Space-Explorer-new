import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Globe, Calculator, Wallet, Star, Trophy, Coins, Map, Bell, Scale, PieChart, Fish, ArrowLeftRight, LayoutGrid 
} from 'lucide-react';

const links = [
  { page: 'CustomDashboard', icon: LayoutGrid, color: 'text-pink-400', title: 'Custom Dashboard', desc: 'Build your view' },
  { page: 'NetworkHealth', icon: Globe, color: 'text-cyan-400', title: 'Network Health', desc: 'Monitor network status' },
  { page: 'TransactionFlowPage', icon: ArrowLeftRight, color: 'text-blue-400', title: 'Transaction Flow', desc: 'Visualize address flows' },
  { page: 'PortfolioTracker', icon: PieChart, color: 'text-pink-400', title: 'Portfolio', desc: 'Track your holdings' },
  { page: 'WhaleWatcher', icon: Fish, color: 'text-blue-500', title: 'Whale Watcher', desc: 'Large transactions' },
  { page: 'ValidatorCompare', icon: Scale, color: 'text-indigo-400', title: 'Compare', desc: 'Compare validators' },
  { page: 'TokenExplorer', icon: Coins, color: 'text-yellow-400', title: 'Tokens', desc: 'SPL token explorer' },
  { page: 'NetworkMap', icon: Map, color: 'text-emerald-400', title: 'Network Map', desc: 'Global node distribution' },
  { page: 'StakingCalculator', icon: Calculator, color: 'text-cyan-400', title: 'Staking Calculator', desc: 'Estimate rewards' },
  { page: 'ValidatorAlerts', icon: Bell, color: 'text-yellow-400', title: 'Alerts', desc: 'Validator notifications' },
  { page: 'Watchlist', icon: Star, color: 'text-orange-400', title: 'Watchlist', desc: 'Track validators' },
  { page: 'Leaderboard', icon: Trophy, color: 'text-amber-400', title: 'Leaderboard', desc: 'Top validators' },
  { page: 'AddressLookup', icon: Wallet, color: 'text-blue-400', title: 'Address Lookup', desc: 'Search accounts' },
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