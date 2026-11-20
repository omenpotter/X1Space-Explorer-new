import {
  Activity, ArrowLeftRight, BookOpen, BarChart3, Bell, Blocks as BlocksIcon, Calculator, Code2, Coins, Droplets, Fish, GitCompare,
  Globe2, LayoutDashboard, LayoutGrid, Search, ShieldCheck, Star, Trophy, Wallet, Waypoints,
} from 'lucide-react';

// One navigation definition for the sidebar, the mobile drawer and page titles.
export const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { page: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { page: 'NetworkHealth', label: 'Network Health', icon: Activity },
      { page: 'NetworkMap', label: 'Network Map', icon: Globe2 },
    ],
  },
  {
    label: 'Chain',
    items: [
      { page: 'Blocks', label: 'Blocks', icon: BlocksIcon },
      { page: 'Transactions', label: 'Transactions', icon: ArrowLeftRight },
      { page: 'TransactionFlowPage', label: 'Transaction Flow', icon: Waypoints },
      { page: 'AddressLookup', label: 'Address Lookup', icon: Search },
    ],
  },
  {
    label: 'Validators',
    items: [
      { page: 'Validators', label: 'Validators', icon: ShieldCheck },
      { page: 'Leaderboard', label: 'Leaderboard', icon: Trophy },
      { page: 'ValidatorCompare', label: 'Compare', icon: GitCompare },
      { page: 'ValidatorAlerts', label: 'Alerts', icon: Bell },
      { page: 'StakingCalculator', label: 'Staking Calculator', icon: Calculator },
    ],
  },
  {
    label: 'Markets',
    items: [
      { page: 'TokenExplorer', label: 'Tokens', icon: Coins },
      { page: 'LPExplorer', label: 'Liquidity Pools', icon: Droplets },
      { page: 'WhaleWatcher', label: 'Whale Watcher', icon: Fish },
    ],
  },
  {
    label: 'Tools',
    items: [
      { page: 'PortfolioTracker', label: 'Portfolio', icon: Wallet },
      { page: 'Watchlist', label: 'Watchlist', icon: Star },
      { page: 'CustomDashboard', label: 'Custom Dashboard', icon: LayoutGrid },
      { page: 'ApiDocs', label: 'API Docs', icon: Code2 },
      { page: 'Learn', label: 'Explorer Guide', icon: BookOpen },
    ],
  },
];

// Detail pages highlight their parent section in the navigation.
export const PARENT_PAGE = {
  BlockDetail: 'Blocks',
  TransactionDetail: 'Transactions',
  ValidatorDetail: 'Validators',
  Search: null,
  Home: 'Dashboard',
};

export const PAGE_TITLES = {
  ...Object.fromEntries(NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.page, i.label]))),
  BlockDetail: 'Block',
  TransactionDetail: 'Transaction',
  ValidatorDetail: 'Validator',
  Search: 'Search',
  Home: 'Dashboard',
};

export const FALLBACK_ICON = BarChart3;
