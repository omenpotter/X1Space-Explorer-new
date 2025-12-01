import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";
import { ExternalLink } from 'lucide-react';

const RecentBlocksTable = memo(function RecentBlocksTable({ blocks }) {
  if (!blocks?.length) return null;
  
  return (
    <div className="mt-8 bg-[#24384a] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-400 text-sm flex items-center gap-2">
          Recent Blocks
          <ExternalLink className="w-3 h-3" />
        </h3>
        <Link to={createPageUrl('Blocks')}>
          <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300">
            View All
          </Button>
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left text-gray-400 text-xs font-medium px-4 py-2">Slot</th>
              <th className="text-left text-gray-400 text-xs font-medium px-4 py-2">Block Hash</th>
              <th className="text-right text-gray-400 text-xs font-medium px-4 py-2">Transactions</th>
              <th className="text-right text-gray-400 text-xs font-medium px-4 py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {blocks.slice(0, 5).map((block) => (
              <tr key={block.slot} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link to={createPageUrl('BlockDetail') + `?slot=${block.slot}`} className="text-cyan-400 hover:underline font-mono">
                    {block.slot.toLocaleString()}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="text-gray-400 font-mono text-sm">{block.blockhash?.substring(0, 20)}...</span>
                </td>
                <td className="px-4 py-3 text-right text-white font-mono">{block.txCount.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-gray-400 text-sm">
                  {block.blockTime ? new Date(block.blockTime * 1000).toLocaleTimeString() : block.timeAgo}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default RecentBlocksTable;