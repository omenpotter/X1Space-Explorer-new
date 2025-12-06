import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import X1Rpc from '../x1/X1RpcService';

export default function RPCDebugger() {
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting] = useState(false);

  const runTests = async () => {
    setTesting(true);
    const results = {};

    try {
      // Test 1: Get current slot
      const slot = await X1Rpc.getSlot();
      results.slot = { success: true, data: slot };

      // Test 2: Get supply
      const supply = await X1Rpc.getSupply();
      results.supply = { success: true, data: supply };

      // Test 3: Get recent block with transactions
      const block = await X1Rpc.getBlock(slot, { transactionDetails: 'full' });
      results.block = {
        success: true,
        slot,
        txCount: block?.transactions?.length || 0,
        sampleTx: block?.transactions?.[0] || null
      };

      // Test 4: Analyze first transaction
      if (block?.transactions?.[0]) {
        const tx = block.transactions[0];
        const message = tx.transaction?.message;
        const accountKeys = message?.accountKeys || [];
        const preBalances = tx.meta?.preBalances || [];
        const postBalances = tx.meta?.postBalances || [];

        const balanceChanges = [];
        for (let i = 0; i < accountKeys.length; i++) {
          const change = (postBalances[i] - preBalances[i]) / 1e9;
          if (Math.abs(change) > 0) {
            balanceChanges.push({
              account: accountKeys[i],
              change: change.toFixed(6),
              pre: (preBalances[i] / 1e9).toFixed(6),
              post: (postBalances[i] / 1e9).toFixed(6)
            });
          }
        }

        results.txAnalysis = {
          signature: tx.transaction.signatures[0],
          accountCount: accountKeys.length,
          balanceChanges,
          instructions: message?.instructions?.length || 0
        };
      }

    } catch (err) {
      results.error = { success: false, message: err.message };
    }

    setTestResults(results);
    setTesting(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-[#0d1525] border border-cyan-500/30 rounded-lg shadow-2xl p-4 max-w-xl max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold">RPC Debugger</h3>
          <Button onClick={runTests} disabled={testing} size="sm" className="bg-cyan-500">
            {testing ? 'Testing...' : 'Run Tests'}
          </Button>
        </div>

        {Object.keys(testResults).length > 0 && (
          <div className="space-y-3 text-xs">
            {testResults.slot && (
              <div>
                <Badge className="bg-emerald-500/20 text-emerald-400 mb-1">Current Slot</Badge>
                <pre className="bg-black/40 p-2 rounded text-white overflow-x-auto">
                  {JSON.stringify(testResults.slot.data, null, 2)}
                </pre>
              </div>
            )}

            {testResults.supply && (
              <div>
                <Badge className="bg-blue-500/20 text-blue-400 mb-1">Supply Data</Badge>
                <pre className="bg-black/40 p-2 rounded text-white overflow-x-auto">
                  {JSON.stringify(testResults.supply.data, null, 2)}
                </pre>
              </div>
            )}

            {testResults.block && (
              <div>
                <Badge className="bg-purple-500/20 text-purple-400 mb-1">Block Data</Badge>
                <pre className="bg-black/40 p-2 rounded text-white overflow-x-auto">
                  Slot: {testResults.block.slot}
                  Transactions: {testResults.block.txCount}
                </pre>
              </div>
            )}

            {testResults.txAnalysis && (
              <div>
                <Badge className="bg-yellow-500/20 text-yellow-400 mb-1">TX Analysis</Badge>
                <pre className="bg-black/40 p-2 rounded text-white overflow-x-auto max-h-[300px]">
                  {JSON.stringify(testResults.txAnalysis, null, 2)}
                </pre>
              </div>
            )}

            {testResults.error && (
              <div>
                <Badge className="bg-red-500/20 text-red-400 mb-1">Error</Badge>
                <pre className="bg-black/40 p-2 rounded text-red-400 overflow-x-auto">
                  {testResults.error.message}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}