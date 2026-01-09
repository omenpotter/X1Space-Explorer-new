import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Loader2, TrendingUp, Calculator, DollarSign, Percent } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import X1Rpc from '../components/x1/X1RpcService';

export default function ValidatorRewards() {
  const [loading, setLoading] = useState(false);
  const [voteAddress, setVoteAddress] = useState('');
  const [validator, setValidator] = useState(null);
  const [rewardData, setRewardData] = useState(null);
  const [calculatorMode, setCalculatorMode] = useState('rewards'); // rewards, compound, unstake
  
  // Calculator state
  const [selfStake, setSelfStake] = useState('');
  const [delegatedStake, setDelegatedStake] = useState('');
  const [commission, setCommission] = useState('');
  const [apy, setApy] = useState('7.2'); // Default X1 APY
  const [compoundFreq, setCompoundFreq] = useState('monthly');
  const [timePeriod, setTimePeriod] = useState('1');
  
  const fetchValidatorRewards = async () => {
    if (!voteAddress.trim()) return;
    
    setLoading(true);
    try {
      const validators = await X1Rpc.getValidatorDetails();
      const found = validators.find(v => v.votePubkey === voteAddress.trim());
      
      if (found) {
        setValidator(found);
        
        // Fetch actual on-chain inflation rewards using proper RPC method
        const epochInfo = await X1Rpc.getEpochInfo();
        const currentEpoch = epochInfo.epoch;
        
        console.log(`Fetching rewards for ${voteAddress.trim()} from epoch ${currentEpoch - 97} to ${currentEpoch - 1}`);
        
        const rewardHistory = [];
        let totalRewards = 0;
        
        // Fetch rewards for last 97 epochs to match x1rewards.xyz data
        const fetchPromises = [];
        for (let i = 1; i <= 97; i++) {
          const epoch = currentEpoch - i;
          if (epoch < 0) break;
          
          fetchPromises.push(
            X1Rpc.getInflationReward([voteAddress.trim()], epoch)
              .then(rewards => ({ epoch, rewards }))
              .catch(() => ({ epoch, rewards: null }))
          );
        }
        
        const results = await Promise.all(fetchPromises);
        
        for (const { epoch, rewards } of results.reverse()) {
          if (rewards && rewards[0]) {
            // Handle both lamports (number) and null amounts
            const rewardLamports = rewards[0].amount || 0;
            const rewardXNT = rewardLamports / 1e9;
            
            // Only add if there's actual reward data
            if (rewardXNT > 0) {
              totalRewards += rewardXNT;
              
              rewardHistory.push({
                epoch,
                rewards: rewardXNT,
                postBalance: (rewards[0].postBalance || 0) / 1e9,
                commission: rewards[0].commission !== undefined ? rewards[0].commission : found.commission
              });
            }
          }
        }
        
        console.log(`✓ Fetched ${rewardHistory.length} epochs of reward data. Total: ${totalRewards.toFixed(2)} XNT`);
        
        if (rewardHistory.length > 0) {
          setRewardData({
            totalRewards,
            lastEpochRewards: rewardHistory[rewardHistory.length - 1]?.rewards || 0,
            avgPerEpoch: totalRewards / rewardHistory.length,
            history: rewardHistory,
            estimatedAPY: 7.2
          });
        } else {
          console.warn('No reward data found - validator may be too new or data not available');
          setRewardData({
            totalRewards: 0,
            lastEpochRewards: 0,
            avgPerEpoch: 0,
            history: [],
            estimatedAPY: 0
          });
        }
      } else {
        setValidator(null);
        setRewardData(null);
      }
    } catch (err) {
      console.error('Failed to fetch validator rewards:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const calculateRewards = () => {
    const self = parseFloat(selfStake) || 0;
    const delegated = parseFloat(delegatedStake) || 0;
    const comm = parseFloat(commission) || 0;
    const apyVal = parseFloat(apy) || 7.2;
    
    const selfRewards = self * (apyVal / 100);
    const delegatedRewards = delegated * (apyVal / 100) * (comm / 100);
    const totalRewards = selfRewards + delegatedRewards;
    
    return {
      selfRewards,
      delegatedRewards,
      totalRewards,
      monthly: totalRewards / 12,
      daily: totalRewards / 365
    };
  };
  
  const calculateCompound = () => {
    const principal = parseFloat(selfStake) || 0;
    const rate = (parseFloat(apy) || 7.2) / 100;
    const years = parseFloat(timePeriod) || 1;
    
    const frequencies = {
      daily: 365,
      weekly: 52,
      monthly: 12,
      quarterly: 4,
      yearly: 1
    };
    
    const n = frequencies[compoundFreq] || 12;
    const amount = principal * Math.pow(1 + rate / n, n * years);
    const gain = amount - principal;
    
    return { amount, gain, principal };
  };
  
  const rewards = calculateRewards();
  const compound = calculateCompound();
  
  return (
    <>
      <title>Validator Rewards Calculator | X1Space</title>
      <meta name="description" content="Calculate X1 validator staking rewards, APY, and compound growth. Track validator performance and earnings." />
      
      <div className="min-h-screen bg-[#1d2d3a] text-white">
        <header className="bg-[#1d2d3a] border-b border-white/5">
          <div className="max-w-[1800px] mx-auto px-4 py-3">
            <div className="flex items-center gap-2">
              <Link to={createPageUrl('Validators')} className="flex items-center gap-2 hover:opacity-80">
                <ChevronLeft className="w-5 h-5 text-gray-400" />
                <span className="font-bold"><span className="text-cyan-400">X1</span> Validator Rewards</span>
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-[1200px] mx-auto px-4 py-6">
          {/* Validator Search */}
          <div className="bg-[#24384a] rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Track Validator Rewards</h2>
            <div className="flex gap-3">
              <Input
                placeholder="Enter Vote Account Address..."
                value={voteAddress}
                onChange={(e) => setVoteAddress(e.target.value)}
                className="flex-1 bg-[#1d2d3a] border-0 text-white"
                onKeyDown={(e) => e.key === 'Enter' && fetchValidatorRewards()}
              />
              <Button 
                onClick={fetchValidatorRewards}
                disabled={loading || !voteAddress.trim()}
                className="bg-cyan-500 hover:bg-cyan-600"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </Button>
            </div>
            
            {validator && rewardData && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{validator.icon}</span>
                  <div>
                    <h3 className="text-xl font-bold text-white">{validator.name}</h3>
                    <p className="text-gray-400 text-sm font-mono">{validator.votePubkey.substring(0, 20)}...</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Total Rewards ({rewardData.history.length} epochs)</p>
                    <p className="text-emerald-400 font-bold text-lg">{rewardData.totalRewards.toFixed(2)} XNT</p>
                  </div>
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Average per Epoch</p>
                    <p className="text-cyan-400 font-bold text-lg">{rewardData.avgPerEpoch.toFixed(2)} XNT</p>
                  </div>
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Last Epoch</p>
                    <p className="text-yellow-400 font-bold text-lg">{rewardData.lastEpochRewards.toFixed(2)} XNT</p>
                  </div>
                  <div className="bg-[#1d2d3a] rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Commission</p>
                    <p className="text-white font-bold text-lg">{validator.commission}%</p>
                  </div>
                </div>
                
                {/* Rewards Chart */}
                <div className="bg-[#1d2d3a] rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">Rewards History</h4>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={rewardData.history}>
                        <YAxis stroke="#6b7280" fontSize={11} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0d1525', border: '1px solid rgba(255,255,255,0.1)' }}
                          formatter={(value) => [value.toFixed(2) + ' XNT', 'Rewards']}
                          labelFormatter={(epoch) => `Epoch ${epoch}`}
                        />
                        <Line type="monotone" dataKey="rewards" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Calculators */}
          <div className="bg-[#24384a] rounded-xl p-6">
            <div className="flex gap-2 mb-6">
              <Button
                variant={calculatorMode === 'rewards' ? 'default' : 'outline'}
                onClick={() => setCalculatorMode('rewards')}
                className={calculatorMode === 'rewards' ? 'bg-cyan-500' : 'border-white/20'}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Rewards
              </Button>
              <Button
                variant={calculatorMode === 'compound' ? 'default' : 'outline'}
                onClick={() => setCalculatorMode('compound')}
                className={calculatorMode === 'compound' ? 'bg-cyan-500 hover:bg-cyan-600' : 'border-white/20'}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Compound
              </Button>
            </div>

            {calculatorMode === 'rewards' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-cyan-400" />
                  Staking Rewards Calculator
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">Self-Stake (XNT)</label>
                    <Input
                      type="number"
                      placeholder="100000"
                      value={selfStake}
                      onChange={(e) => setSelfStake(e.target.value)}
                      className="bg-[#1d2d3a] border-0 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">Delegated Stake (XNT)</label>
                    <Input
                      type="number"
                      placeholder="500000"
                      value={delegatedStake}
                      onChange={(e) => setDelegatedStake(e.target.value)}
                      className="bg-[#1d2d3a] border-0 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">Commission (%)</label>
                    <Input
                      type="number"
                      placeholder="10"
                      value={commission}
                      onChange={(e) => setCommission(e.target.value)}
                      className="bg-[#1d2d3a] border-0 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">Estimated APY (%)</label>
                    <Input
                      type="number"
                      placeholder="7.2"
                      value={apy}
                      onChange={(e) => setApy(e.target.value)}
                      className="bg-[#1d2d3a] border-0 text-white"
                    />
                  </div>
                </div>
                
                <div className="bg-[#1d2d3a] rounded-lg p-4 space-y-3">
                  <h4 className="text-white font-medium">Estimated Annual Rewards</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-gray-400 text-xs">Self-Stake Rewards</p>
                      <p className="text-emerald-400 font-bold text-xl">{rewards.selfRewards.toFixed(2)} XNT</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Commission Earnings</p>
                      <p className="text-cyan-400 font-bold text-xl">{rewards.delegatedRewards.toFixed(2)} XNT</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Total Annual</p>
                      <p className="text-yellow-400 font-bold text-xl">{rewards.totalRewards.toFixed(2)} XNT</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Monthly</p>
                      <p className="text-white font-bold text-xl">{rewards.monthly.toFixed(2)} XNT</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {calculatorMode === 'compound' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  Compound Growth Calculator
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">Initial Stake (XNT)</label>
                    <Input
                      type="number"
                      placeholder="100000"
                      value={selfStake}
                      onChange={(e) => setSelfStake(e.target.value)}
                      className="bg-[#1d2d3a] border-0 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">Annual APY (%)</label>
                    <Input
                      type="number"
                      placeholder="7.2"
                      value={apy}
                      onChange={(e) => setApy(e.target.value)}
                      className="bg-[#1d2d3a] border-0 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm mb-2 block">Time Period (years)</label>
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
                  <div className="md:col-span-3">
                    <label className="text-gray-400 text-sm mb-2 block">Compounding Frequency</label>
                    <div className="flex flex-wrap gap-2">
                      {['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].map(freq => (
                        <Button
                          key={freq}
                          variant="outline"
                          size="sm"
                          onClick={() => setCompoundFreq(freq)}
                          className={`border-white/20 ${compoundFreq === freq ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400'}`}
                        >
                          {freq.charAt(0).toUpperCase() + freq.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#1d2d3a] rounded-lg p-4 space-y-3">
                  <h4 className="text-white font-medium">Growth Projection</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-gray-400 text-xs">Initial</p>
                      <p className="text-white font-bold text-xl">{compound.principal.toLocaleString()} XNT</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Final Amount</p>
                      <p className="text-emerald-400 font-bold text-xl">{compound.amount.toLocaleString(undefined, {maximumFractionDigits: 0})} XNT</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Total Gain</p>
                      <p className="text-cyan-400 font-bold text-xl">+{compound.gain.toLocaleString(undefined, {maximumFractionDigits: 0})} XNT</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}