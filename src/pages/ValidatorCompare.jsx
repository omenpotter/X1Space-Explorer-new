import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Zap,
  Plus,
  X,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Scale
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';
import ValidatorCompare from '../components/validators/ValidatorCompare';

export default function ValidatorComparePage() {
  const [validators, setValidators] = useState([]);
  const [selectedValidators, setSelectedValidators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSelector, setShowSelector] = useState(true);
  const [blockProduction, setBlockProduction] = useState(null);

  useEffect(() => {
    const fetchValidators = async () => {
      try {
        const [data, blockProd] = await Promise.all([
          X1Rpc.getValidatorDetails(),
          X1Rpc.getBlockProduction().catch(() => null)
        ]);
        setValidators(data);
        setBlockProduction(blockProd);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch validators:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchValidators();
  }, []);

  const addValidator = (validator) => {
    if (selectedValidators.length >= 5) return;
    if (selectedValidators.find(v => v.votePubkey === validator.votePubkey)) return;
    setSelectedValidators([...selectedValidators, validator]);
  };

  const removeValidator = (votePubkey) => {
    setSelectedValidators(selectedValidators.filter(v => v.votePubkey !== votePubkey));
  };

  const filteredValidators = validators.filter(v => {
    const query = searchQuery.toLowerCase();
    const isSelected = selectedValidators.find(s => s.votePubkey === v.votePubkey);
    if (isSelected) return false;
    return v.votePubkey.toLowerCase().includes(query) || 
           v.nodePubkey.toLowerCase().includes(query) ||
           (v.name && v.name.toLowerCase().includes(query));
  });

  const formatStake = (stake) => {
    if (stake >= 1e6) return (stake / 1e6).toFixed(1) + 'M';
    if (stake >= 1e3) return (stake / 1e3).toFixed(1) + 'K';
    return stake.toFixed(0);
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
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-black font-black text-sm">X1</span>
                </div>
                <span className="font-bold hidden sm:inline"><span className="text-cyan-400">X1</span><span className="text-white">Space</span></span>
              </Link>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">Mainnet</Badge>
            </div>
            
            <nav className="hidden md:flex items-center gap-1">
              <Link to={createPageUrl('Dashboard')}><Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg"><Zap className="w-5 h-5" /></Button></Link>
              <Link to={createPageUrl('Blocks')}><Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg></Button></Link>
              <Link to={createPageUrl('Validators')}><Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg></Button></Link>
              <Link to={createPageUrl('ValidatorCompare')}><Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg"><Scale className="w-5 h-5" /></Button></Link>
            </nav>

            <Link to={createPageUrl('Validators')}>
              <Button variant="outline" size="sm" className="border-white/10 text-gray-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Validators
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2">
          <div className="max-w-[1800px] mx-auto flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" /><span>{error}</span>
          </div>
        </div>
      )}

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Scale className="w-7 h-7 text-cyan-400" />
              Compare Validators
            </h1>
            <p className="text-gray-400 text-sm mt-1">Select up to 5 validators to compare side-by-side</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-cyan-500/20 text-cyan-400 border-0">
              {selectedValidators.length}/5 selected
            </Badge>
            {selectedValidators.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => setSelectedValidators([])}
              >
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Selected validators chips */}
        {selectedValidators.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedValidators.map((v) => (
              <div 
                key={v.votePubkey}
                className="flex items-center gap-2 bg-cyan-500/20 text-cyan-400 px-3 py-1.5 rounded-full text-sm"
              >
                <span>{v.icon || '🔷'}</span>
                <span>{v.name || v.votePubkey.substring(0, 8) + '...'}</span>
                <button 
                  onClick={() => removeValidator(v.votePubkey)}
                  className="hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Validator selector */}
        <div className="mb-6">
          <div 
            className="flex items-center justify-between bg-[#24384a] rounded-lg px-4 py-3 cursor-pointer hover:bg-[#2a4258] transition-colors"
            onClick={() => setShowSelector(!showSelector)}
          >
            <span className="text-gray-400 text-sm">
              {showSelector ? 'Hide validator selector' : 'Show validator selector'}
            </span>
            <Plus className={`w-5 h-5 text-gray-400 transition-transform ${showSelector ? 'rotate-45' : ''}`} />
          </div>
          
          {showSelector && (
            <div className="bg-[#24384a] rounded-b-lg border-t border-white/5 p-4">
              <div className="relative mb-4">
                <Input
                  placeholder="Search validators by name or pubkey..."
                  className="w-full bg-[#1d2d3a] border-0 text-white placeholder:text-gray-500 pr-10 rounded-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
                {filteredValidators.slice(0, 20).map((v) => (
                  <button
                    key={v.votePubkey}
                    onClick={() => addValidator(v)}
                    disabled={selectedValidators.length >= 5}
                    className="flex items-center gap-3 p-3 bg-[#1d2d3a] rounded-lg hover:bg-[#263d50] transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center text-sm shrink-0">
                      {v.icon || '🔷'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium truncate">
                        {v.name || `${v.votePubkey.substring(0, 6)}...${v.votePubkey.slice(-4)}`}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {formatStake(v.activatedStake)} XNT • {v.commission}% comm
                      </p>
                    </div>
                    <Plus className="w-4 h-4 text-cyan-400 shrink-0" />
                  </button>
                ))}
              </div>
              
              {filteredValidators.length > 20 && (
                <p className="text-gray-500 text-xs text-center mt-3">
                  Showing 20 of {filteredValidators.length} validators. Use search to find more.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Comparison table */}
        <ValidatorCompare 
          validators={selectedValidators} 
          onRemove={removeValidator}
          blockProduction={blockProduction}
        />
      </main>
    </div>
  );
}