import React, { useState, useEffect } from 'react';
import { Search, X, TrendingUp, Wallet, Hash, Activity } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    // Detect search type and show suggestions
    const newSuggestions = [];
    
    // Check if it's an address (32-88 chars)
    if (query.length >= 32 && query.length <= 88) {
      newSuggestions.push({
        type: 'address',
        label: 'Search Address',
        value: query,
        icon: Wallet,
        action: () => navigate(createPageUrl('AddressLookup') + `?address=${query}`)
      });
    }
    
    // Check if it's a transaction signature (88 chars)
    if (query.length === 88) {
      newSuggestions.push({
        type: 'transaction',
        label: 'View Transaction',
        value: query,
        icon: Activity,
        action: () => navigate(createPageUrl('TransactionDetail') + `?sig=${query}`)
      });
    }
    
    // Check if it's a block slot (numeric)
    if (/^\d+$/.test(query)) {
      newSuggestions.push({
        type: 'block',
        label: 'View Block',
        value: `Slot #${query}`,
        icon: Hash,
        action: () => navigate(createPageUrl('BlockDetail') + `?slot=${query}`)
      });
    }
    
    // Always show option to search validators by name
    newSuggestions.push({
      type: 'validator',
      label: 'Search Validators',
      value: query,
      icon: TrendingUp,
      action: () => navigate(createPageUrl('Validators') + `?search=${query}`)
    });

    setSuggestions(newSuggestions);
  }, [query, navigate]);

  const handleSelect = (suggestion) => {
    suggestion.action();
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      handleSelect(suggestions[0]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search address, transaction, block..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="bg-[#1d2d3a] border-white/10 text-white pl-10 pr-10"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setSuggestions([]);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full mt-2 w-full bg-[#24384a] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
            {suggestions.map((suggestion, i) => {
              const Icon = suggestion.icon;
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(suggestion)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#1d2d3a] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">{suggestion.label}</p>
                    <p className="text-gray-400 text-xs truncate">{suggestion.value}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}