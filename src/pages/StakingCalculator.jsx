import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { 
  Zap, Loader2, Calculator, TrendingUp, Coins, Clock, Award
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import X1Rpc from '../components/x1/X1RpcService';

export default function StakingCalculator() {
  const [loading, setLoading] = useState(true);
  const [validators, setValidators] = useState([]);
  const [stakeAmount, setStakeAmount] = useState(10000);
  const [selectedValidator, setSelectedValidator] = useState(null);
  const [timeframe, setTimeframe] = useState('year');

  useEffect(() => {
    const fetchValidators = async () => {
      try {
        const data = await X1Rpc.getValidatorDetails();
        setValidators(data.filter(v => !v.delinquent).slice(0, 50));
        if (data.length > 0) setSelectedValidator(data[0]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchValidators();
  }, []);

  // X1 Network Staking APY
  // Based on network inflation and stake distribution
  // Current estimated APY is ~5-7% depending on validator performance
  // Formula: Base inflation rate * (1 - commission) * uptime factor
  const networkInflationRate = 0.08; // 8% annual inflation
  const totalStaked = 800000000; // ~800M XNT staked (estimate)
  const baseAPY = (networkInflationRate * 1000000000 / totalStaked) * 100; // ~10% base
  const adjustedBaseAPY = Math.min(8, Math.max(5, baseAPY)); // Capped between 5-8%
  
  const validatorAPY = selectedValidator 
    ? adjustedBaseAPY * (1 - selectedValidator.commission / 100) * (selectedValidator.uptime / 100)
    : adjustedBaseAPY;

  const calculateRewards = () => {
    const multiplier = timeframe === 'day' ? 1/365 : timeframe === 'month' ? 1/12 : timeframe === 'year' ? 1 : 5;
    const rewards = stakeAmount * (validatorAPY / 100) * multiplier;
    return rewards;
  };

  const rewards = calculateRewards();

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
                <span className="text-white font-bold hidden sm:inline">X1</span>
                <span className="text-cyan-400 font-bold hidden sm:inline">.space</span>
              </Link>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-0 text-xs">Mainnet</Badge>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              <Link to={createPageUrl('Dashboard')}><Button variant="ghost" size="icon" className="text-gray-400 hover:text-white rounded-lg"><Zap className="w-5 h-5" /></Button></Link>
              <Link to={createPageUrl('StakingCalculator')}><Button variant="ghost" size="icon" className="text-cyan-400 bg-cyan-500/10 rounded-lg"><Calculator className="w-5 h-5" /></Button></Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3 mb-6">
          <Calculator className="w-7 h-7 text-cyan-400" />
          Staking Calculator
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="bg-[#24384a] rounded-xl p-6">
            <h3 className="text-gray-400 text-sm mb-4">STAKE AMOUNT</h3>
            <div className="mb-6">
              <Input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(Number(e.target.value))}
                className="bg-[#1d2d3a] border-0 text-white text-2xl font-bold h-14"
              />
              <p className="text-gray-500 text-sm mt-2">XNT tokens to stake</p>
            </div>

            <div className="mb-6">
              <Slider
                value={[stakeAmount]}
                onValueChange={(v) => setStakeAmount(v[0])}
                max={1000000}
                step={1000}
                className="mt-4"
              />
              <div className="flex justify-between text-gray-500 text-xs mt-2">
                <span>0</span>
                <span>1M XNT</span>
              </div>
            </div>

            <h3 className="text-gray-400 text-sm mb-4">TIMEFRAME</h3>
            <div className="flex gap-2 mb-6">
              {['day', 'month', 'year', '5years'].map((tf) => (
                <Button
                  key={tf}
                  variant="outline"
                  size="sm"
                  className={`border-white/10 flex-1 ${timeframe === tf ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}
                  onClick={() => setTimeframe(tf)}
                >
                  {tf === '5years' ? '5 Years' : tf.charAt(0).toUpperCase() + tf.slice(1)}
                </Button>
              ))}
            </div>

            <h3 className="text-gray-400 text-sm mb-4">SELECT VALIDATOR</h3>
            <div className="max-h-[200px] overflow-y-auto space-y-2">
              {validators.slice(0, 20).map((v) => (
                <button
                  key={v.votePubkey}
                  onClick={() => setSelectedValidator(v)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${selectedValidator?.votePubkey === v.votePubkey ? 'bg-cyan-500/20 border border-cyan-500/50' : 'bg-[#1d2d3a] hover:bg-[#263d50]'}`}
                >
                  <span>{v.icon || '🔷'}</span>
                  <div className="flex-1 text-left">
                    <p className="text-white text-sm truncate">{v.name || v.votePubkey.substring(0, 12) + '...'}</p>
                    <p className="text-gray-500 text-xs">{v.commission}% commission</p>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-xs">
                    {(baseAPY * (1 - v.commission / 100)).toFixed(1)}% APY
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl p-6 border border-cyan-500/30">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
                <TrendingUp className="w-4 h-4" /> Estimated Rewards
              </div>
              <p className="text-4xl font-bold text-cyan-400">
                {rewards.toLocaleString(undefined, { maximumFractionDigits: 2 })} XNT
              </p>
              <p className="text-gray-500 text-sm mt-1">
                per {timeframe === '5years' ? '5 years' : timeframe}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#24384a] rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                  <Award className="w-4 h-4" /> APY
                </div>
                <p className="text-2xl font-bold text-white">{validatorAPY.toFixed(2)}%</p>
              </div>
              <div className="bg-[#24384a] rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                  <Coins className="w-4 h-4" /> Total Value
                </div>
                <p className="text-2xl font-bold text-emerald-400">
                  {(stakeAmount + rewards).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>

            {selectedValidator && (
              <div className="bg-[#24384a] rounded-xl p-4">
                <h3 className="text-gray-400 text-sm mb-3">SELECTED VALIDATOR</h3>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{selectedValidator.icon || '🔷'}</span>
                  <div>
                    <p className="text-white font-medium">{selectedValidator.name || selectedValidator.votePubkey.substring(0, 16) + '...'}</p>
                    <p className="text-gray-500 text-sm">
                      Commission: {selectedValidator.commission}% • Uptime: {selectedValidator.uptime?.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <p className="text-yellow-400 text-sm">
                ⚠️ <strong>Estimates only.</strong> Actual APY varies based on:
              </p>
              <ul className="text-yellow-400/80 text-xs mt-2 list-disc list-inside space-y-1">
                <li>Network inflation rate (~8% annual)</li>
                <li>Total stake in network (~800M XNT)</li>
                <li>Validator commission and uptime</li>
                <li>Your stake duration and timing</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}