import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calculator, TrendingUp, DollarSign } from 'lucide-react';

export default function StakingCalculator({ validator }) {
  const [mode, setMode] = useState('simple'); // simple or compound
  const [stakeAmount, setStakeAmount] = useState('');
  const [timePeriod, setTimePeriod] = useState('1');
  const [compoundFreq, setCompoundFreq] = useState('monthly');
  const [xntPrice, setXntPrice] = useState('1.00');

  const apy = 7.2; // X1 network APY
  const commission = validator?.commission || 0;
  const effectiveAPY = apy * (1 - commission / 100);

  const calculateSimple = () => {
    const stake = parseFloat(stakeAmount) || 0;
    const years = parseFloat(timePeriod) || 1;
    const annualRewards = stake * (effectiveAPY / 100);
    const totalRewards = annualRewards * years;
    const price = parseFloat(xntPrice) || 1;

    return {
      annual: annualRewards,
      total: totalRewards,
      monthly: annualRewards / 12,
      daily: annualRewards / 365,
      usdValue: totalRewards * price
    };
  };

  const calculateCompound = () => {
    const stake = parseFloat(stakeAmount) || 0;
    const rate = effectiveAPY / 100;
    const years = parseFloat(timePeriod) || 1;
    
    const frequencies = {
      daily: 365,
      weekly: 52,
      monthly: 12,
      quarterly: 4,
      yearly: 1
    };
    
    const n = frequencies[compoundFreq] || 12;
    const amount = stake * Math.pow(1 + rate / n, n * years);
    const gain = amount - stake;
    const price = parseFloat(xntPrice) || 1;

    return {
      finalAmount: amount,
      totalGain: gain,
      principal: stake,
      usdValue: amount * price
    };
  };

  const simple = calculateSimple();
  const compound = calculateCompound();

  return (
    <div className="bg-[#24384a] rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Calculator className="w-5 h-5 text-cyan-400" />
          Staking Calculator
        </h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === 'simple' ? 'default' : 'outline'}
            onClick={() => setMode('simple')}
            className={mode === 'simple' ? 'bg-cyan-500' : 'border-white/20 text-gray-400'}
          >
            <DollarSign className="w-4 h-4 mr-1" />
            Simple
          </Button>
          <Button
            size="sm"
            variant={mode === 'compound' ? 'default' : 'outline'}
            onClick={() => setMode('compound')}
            className={mode === 'compound' ? 'bg-cyan-500' : 'border-white/20 text-gray-400'}
          >
            <TrendingUp className="w-4 h-4 mr-1" />
            Compound
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-gray-400 text-sm mb-2 block">Stake Amount (XNT)</label>
          <Input
            type="number"
            placeholder="10000"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            className="bg-[#1d2d3a] border-0 text-white"
          />
        </div>
        <div>
          <label className="text-gray-400 text-sm mb-2 block">Time Period</label>
          <select 
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
            className="w-full bg-[#1d2d3a] border-0 text-white rounded-lg px-3 py-2"
          >
            <option value="1">1 year</option>
            <option value="2">2 years</option>
            <option value="3">3 years</option>
            <option value="5">5 years</option>
            <option value="10">10 years</option>
          </select>
        </div>
        {mode === 'compound' && (
          <div className="md:col-span-2">
            <label className="text-gray-400 text-sm mb-2 block">Compound Frequency</label>
            <div className="flex flex-wrap gap-2">
              {['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].map(freq => (
                <Button
                  key={freq}
                  size="sm"
                  variant="outline"
                  onClick={() => setCompoundFreq(freq)}
                  className={`border-white/20 ${compoundFreq === freq ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}
                >
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="md:col-span-2">
          <label className="text-gray-400 text-sm mb-2 block">XNT Price (USD)</label>
          <Input
            type="number"
            placeholder="1.00"
            value={xntPrice}
            onChange={(e) => setXntPrice(e.target.value)}
            className="bg-[#1d2d3a] border-0 text-white"
          />
        </div>
      </div>

      <div className="bg-[#1d2d3a] rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-medium">Estimated Returns</h4>
          <div className="flex gap-2">
            <Badge className="bg-yellow-500/20 text-yellow-400 border-0 text-xs">
              {effectiveAPY.toFixed(2)}% APY
            </Badge>
            <Badge className="bg-purple-500/20 text-purple-400 border-0 text-xs">
              {commission}% commission
            </Badge>
          </div>
        </div>

        {mode === 'simple' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-400 text-xs mb-1">Annual</p>
              <p className="text-emerald-400 font-bold">{simple.annual.toFixed(2)} XNT</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Monthly</p>
              <p className="text-cyan-400 font-bold">{simple.monthly.toFixed(2)} XNT</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Total ({timePeriod}y)</p>
              <p className="text-yellow-400 font-bold">{simple.total.toFixed(2)} XNT</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">USD Value</p>
              <p className="text-white font-bold">${simple.usdValue.toFixed(2)}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-400 text-xs mb-1">Principal</p>
              <p className="text-white font-bold">{compound.principal.toLocaleString()} XNT</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Final Amount</p>
              <p className="text-emerald-400 font-bold">{compound.finalAmount.toFixed(0)} XNT</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Total Gain</p>
              <p className="text-cyan-400 font-bold">+{compound.totalGain.toFixed(0)} XNT</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">USD Value</p>
              <p className="text-yellow-400 font-bold">${compound.usdValue.toFixed(2)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}