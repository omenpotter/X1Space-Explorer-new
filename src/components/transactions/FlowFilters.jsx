import React, { memo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Filter, Search, Calendar, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

const FlowFilters = memo(function FlowFilters({ 
  filterType, 
  setFilterType, 
  dateRange, 
  setDateRange,
  amountRange,
  setAmountRange,
  searchSignature,
  setSearchSignature,
  onClearFilters
}) {
  const [showFilters, setShowFilters] = useState(false);
  
  const txTypes = ['all', 'transfer', 'stake', 'token', 'vote', 'other'];
  
  const hasActiveFilters = filterType !== 'all' || 
    dateRange.from || dateRange.to || 
    amountRange.min || amountRange.max ||
    searchSignature;

  return (
    <div className="bg-surface-2 rounded-xl p-4 mb-6">
      {/* Search Bar */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <Input
            placeholder="Search by signature or address..."
            value={searchSignature}
            onChange={(e) => setSearchSignature(e.target.value)}
            className="pl-10 bg-surface-1 border-0 text-white"
          />
        </div>
        <Button 
          variant="outline" 
          onClick={() => setShowFilters(!showFilters)}
          className={`border-line ${showFilters ? 'bg-brand/20 text-brand' : 'text-ink-muted'}`}
        >
          <Filter className="w-4 h-4 mr-2" /> Filters
          {hasActiveFilters && <Badge className="ml-2 bg-brand text-black text-xs px-1">!</Badge>}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={onClearFilters} className="text-ink-muted hover:text-white">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="space-y-4 pt-4 border-t border-line">
          {/* Type Filter */}
          <div>
            <label className="text-ink-muted text-xs mb-2 block">Transaction Type</label>
            <div className="flex flex-wrap gap-2">
              {txTypes.map((type) => (
                <Button 
                  key={type} 
                  variant="outline" 
                  size="sm"
                  onClick={() => setFilterType(type)}
                  className={`border-line ${filterType === type ? 'bg-brand/20 text-brand' : 'text-ink-muted'}`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-ink-muted text-xs mb-2 block">From Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start border-line text-ink-muted hover:text-white">
                    <Calendar className="w-4 h-4 mr-2" />
                    {dateRange.from ? dateRange.from.toLocaleDateString() : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-surface-2 border-line">
                  <CalendarComponent
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                    className="bg-surface-2"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-ink-muted text-xs mb-2 block">To Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start border-line text-ink-muted hover:text-white">
                    <Calendar className="w-4 h-4 mr-2" />
                    {dateRange.to ? dateRange.to.toLocaleDateString() : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-surface-2 border-line">
                  <CalendarComponent
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                    className="bg-surface-2"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Amount Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-ink-muted text-xs mb-2 block">Min Amount (XNT)</label>
              <Input
                type="number"
                placeholder="0"
                value={amountRange.min}
                onChange={(e) => setAmountRange(prev => ({ ...prev, min: e.target.value }))}
                className="bg-surface-1 border-0 text-white"
              />
            </div>
            <div>
              <label className="text-ink-muted text-xs mb-2 block">Max Amount (XNT)</label>
              <Input
                type="number"
                placeholder="∞"
                value={amountRange.max}
                onChange={(e) => setAmountRange(prev => ({ ...prev, max: e.target.value }))}
                className="bg-surface-1 border-0 text-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default FlowFilters;