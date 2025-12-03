import React, { useState, memo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  Menu, Zap, Globe, Calculator, Wallet, Star, Trophy, 
  Code, BarChart3, Coins, Bell, Map
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Memoized nav items to prevent recreation
const navItems = [
  { name: 'Dashboard', icon: Zap, page: 'Dashboard' },
  { name: 'Blocks', icon: BarChart3, page: 'Blocks' },
  { name: 'Validators', icon: BarChart3, page: 'Validators' },
  { name: 'Transactions', icon: BarChart3, page: 'Transactions' },
  { name: 'Tokens', icon: Coins, page: 'TokenExplorer' },
  { name: 'Network Health', icon: Globe, page: 'NetworkHealth' },
  { name: 'Network Map', icon: Map, page: 'NetworkMap' },
  { name: 'Staking Calculator', icon: Calculator, page: 'StakingCalculator' },
  { name: 'Address Lookup', icon: Wallet, page: 'AddressLookup' },
  { name: 'Watchlist', icon: Star, page: 'Watchlist' },
  { name: 'Alerts', icon: Bell, page: 'ValidatorAlerts' },
  { name: 'Leaderboard', icon: Trophy, page: 'Leaderboard' },
  { name: 'API Docs', icon: Code, page: 'ApiDocs' },
];

const MobileNav = memo(function MobileNav() {
  const [open, setOpen] = useState(false);
  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden text-gray-400">
          <Menu className="w-6 h-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-[#1d2d3a] border-white/10 w-64 p-0">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-black font-black text-sm">X1</span>
            </div>
            <span className="text-white font-bold">X1</span>
            <span className="text-cyan-400 font-bold">.space</span>
          </div>
        </div>
        <nav className="p-2">
          {navItems.map((item) => (
            <Link 
              key={item.page} 
              to={createPageUrl(item.page)}
              onClick={handleClose}
            >
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                <item.icon className="w-5 h-5" />
                <span className="text-sm">{item.name}</span>
              </div>
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
});

export default MobileNav;