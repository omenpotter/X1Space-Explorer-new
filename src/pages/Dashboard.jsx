import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Zap, AlertCircle, Globe, Calculator, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

import MobileNav from '../components/layout/MobileNav';
import MempoolViz, { MempoolLegend } from '../components/x1/MempoolViz';
import QuickLinks from '../components/dashboard/QuickLinks';
import RecentBlocksTable from '@/components/dashboard/RecentBlocksTable';

import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  YAxis
} from 'recharts';

import X1Rpc from '../components/x1/X1RpcService';

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tpsInterval, setTpsInterval] = useState('1m');
  const [mempoolInterval, setMempoolInterval] = useState('1m');

  const dashboardRef = useRef(null);
  const recentBlocksRef = useRef([]);
  const performanceDataRef = useRef([]);
  const pendingTxCountRef = useRef(0);
  const [, forceRender] = useState(0);

  const dashboardData = dashboardRef.current;
  const recentBlocks = recentBlocksRef.current;
  const performanceData = performanceDataRef.current;
  const pendingTxCount = pendingTxCountRef.current;

  const aggregatedTpsData = useMemo(() => {
    if (!dashboardData?.tpsHistory?.length) return [];
    if (tpsInterval === '1m') return dashboardData.tpsHistory;

    const out = [];
    for (let i = 0; i < dashboardData.tpsHistory.length; i += 10) {
      const chunk = dashboardData.tpsHistory.slice(i, i + 10);
      out.push({
        time: `${i}m`,
        tps: Math.round(chunk.reduce((s, d) => s + d.tps, 0) / chunk.length)
      });
    }
    return out;
  }, [dashboardData?.tpsHistory, tpsInterval]);

  const initDashboard = async () => {
    const data = await X1Rpc.getDashboardData();
    dashboardRef.current = data;

    const [blocks, perf, pending] = await Promise.all([
      X1Rpc.getRecentBlocks(10).catch(() => []),
      X1Rpc.getPerformanceHistory(60).catch(() => []),
      X1Rpc.getPendingTransactions().catch(() => [])
    ]);

    recentBlocksRef.current = blocks;
    performanceDataRef.current = perf;
    pendingTxCountRef.current = pending.length;

    setLastUpdate(new Date());
    forceRender(x => x + 1);
  };

  const pollDashboard = async () => {
    if (!dashboardRef.current) return;

    const data = await X1Rpc.getDashboardData();

    Object.assign(dashboardRef.current, {
      slot: data.slot,
      tps: data.tps,
      epochProgress: data.epochProgress,
      slotsRemaining: data.slotsRemaining,
      timeRemaining: data.timeRemaining,
      tpsHistory: data.tpsHistory,
      transactionCount: data.transactionCount,
      supply: data.supply,
      validators: data.validators
    });

    const [blocks, perf, pending] = await Promise.all([
      X1Rpc.getRecentBlocks(10).catch(() => []),
      X1Rpc.getPerformanceHistory(60).catch(() => []),
      X1Rpc.getPendingTransactions().catch(() => [])
    ]);

    recentBlocksRef.current = blocks;
    performanceDataRef.current = perf;
    pendingTxCountRef.current = pending.length;

    setLastUpdate(new Date());
    forceRender(x => x + 1);
  };

  useEffect(() => {
    initDashboard();
    const id = setInterval(pollDashboard, 3000);
    return () => clearInterval(id);
  }, []);

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-[#1d2d3a] text-white flex items-center justify-center">
        Connecting…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1d2d3a] text-white">
      <header className="border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center gap-4">
          <MobileNav />
          <span className="font-bold text-cyan-400">X1Space</span>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 px-4 py-2 text-red-400">
          <AlertCircle className="inline w-4 h-4 mr-1" />
          {error}
          <Button onClick={pollDashboard} variant="ghost" size="sm" className="ml-4">
            Retry
          </Button>
        </div>
      )}

      <main className="max-w-[1800px] mx-auto px-4 py-6">
        <div className="bg-[#24384a] rounded-xl p-4 mb-6">
          <MempoolLegend />
          <MempoolViz
            mempoolInterval={mempoolInterval}
            recentBlocks={recentBlocks}
            aggregatedBlocks={performanceData}
            dashboardSlot={dashboardData.slot}
            showPending
            pendingCount={pendingTxCount}
          />
        </div>

        <div className="bg-[#24384a] rounded-xl p-4">
          <h3 className="text-cyan-400 text-sm mb-2">TPS HISTORY</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={aggregatedTpsData}>
                <YAxis />
                <Tooltip />
                <Line dataKey="tps" stroke="#22d3ee" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <QuickLinks />
        <RecentBlocksTable blocks={recentBlocks} />
      </main>
    </div>
  );
}
