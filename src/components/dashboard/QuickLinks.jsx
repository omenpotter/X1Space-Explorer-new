import { memo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Activity, ArrowLeftRight, Bell, Boxes, Calculator, Coins, Droplet, Fish, LayoutGrid, Map, PieChart, Scale, Server, Star, Trophy, Wallet,
} from 'lucide-react';

const links = [
  { page: 'Blocks', icon: Boxes, title: 'Blocks', desc: 'Latest confirmed blocks' },
  { page: 'Validators', icon: Server, title: 'Validators', desc: 'Stake, commission, vote rate' },
  { page: 'NetworkHealth', icon: Activity, title: 'Network Health', desc: 'Live checks and throughput' },
  { page: 'NetworkMap', icon: Map, title: 'Network Map', desc: 'Where validators run' },
  { page: 'TokenExplorer', icon: Coins, title: 'Tokens', desc: 'Token explorer' },
  { page: 'LPExplorer', icon: Droplet, title: 'Liquidity Pools', desc: 'XDEX pools' },
  { page: 'AddressLookup', icon: Wallet, title: 'Address Lookup', desc: 'Accounts and balances' },
  { page: 'TransactionFlowPage', icon: ArrowLeftRight, title: 'Transaction Flow', desc: 'Follow funds between addresses' },
  { page: 'WhaleWatcher', icon: Fish, title: 'Whale Watcher', desc: 'Large transfers' },
  { page: 'Leaderboard', icon: Trophy, title: 'Leaderboard', desc: 'Validator rankings' },
  { page: 'ValidatorCompare', icon: Scale, title: 'Compare', desc: 'Validators side by side' },
  { page: 'StakingCalculator', icon: Calculator, title: 'Staking Calculator', desc: 'Reward estimates' },
  { page: 'PortfolioTracker', icon: PieChart, title: 'Portfolio', desc: 'Track holdings' },
  { page: 'Watchlist', icon: Star, title: 'Watchlist', desc: 'Saved validators' },
  { page: 'ValidatorAlerts', icon: Bell, title: 'Alerts', desc: 'Validator notifications' },
  { page: 'CustomDashboard', icon: LayoutGrid, title: 'Custom Dashboard', desc: 'Build your own view' },
];

const QuickLinks = memo(/** @param {{ className?: any, [key: string]: any }} props */ function QuickLinks({ className }) {
  return (
    <nav aria-labelledby="quick-links-heading" className={className}>
      <h2 id="quick-links-heading" className="mb-3 text-sm font-medium text-ink">Explore</h2>
      <ul className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {links.map(({ page, icon: Icon, title, desc }) => (
          <li key={page}>
            <Link to={createPageUrl(page)} className="panel group flex h-full items-start gap-3 p-4 transition-colors hover:border-line-strong hover:bg-surface-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-muted transition-colors group-hover:border-brand/30 group-hover:text-brand">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{title}</span>
                <span className="block text-xs text-ink-muted">{desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
});

export default QuickLinks;
