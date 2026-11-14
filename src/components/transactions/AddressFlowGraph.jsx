import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowRight, Wallet, Send, Download } from 'lucide-react';

export default function AddressFlowGraph({ flowData }) {
  const { nodes, edges, centerAddress } = flowData;
  
  // Separate incoming and outgoing connections
  const { incomingNodes, outgoingNodes, centerNode } = useMemo(() => {
    const center = nodes.find(n => n.id === centerAddress);
    const incoming = [];
    const outgoing = [];
    
    edges.forEach(edge => {
      if (edge.to === centerAddress) {
        const node = nodes.find(n => n.id === edge.from);
        if (node) incoming.push({ ...node, edgeAmount: edge.amount, edgeType: edge.type });
      } else if (edge.from === centerAddress) {
        const node = nodes.find(n => n.id === edge.to);
        if (node) outgoing.push({ ...node, edgeAmount: edge.amount, edgeType: edge.type });
      }
    });
    
    // Aggregate by address
    const aggregateNodes = (list) => {
      const map = new Map();
      list.forEach(n => {
        if (map.has(n.id)) {
          const existing = map.get(n.id);
          existing.totalAmount += n.edgeAmount;
          existing.txCount++;
        } else {
          map.set(n.id, { ...n, totalAmount: n.edgeAmount, txCount: 1 });
        }
      });
      return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 8);
    };
    
    return {
      incomingNodes: aggregateNodes(incoming),
      outgoingNodes: aggregateNodes(outgoing),
      centerNode: center
    };
  }, [nodes, edges, centerAddress]);

  const formatAmount = (amt) => {
    if (!amt) return '0';
    if (amt >= 1e6) return (amt / 1e6).toFixed(2) + 'M';
    if (amt >= 1e3) return (amt / 1e3).toFixed(2) + 'K';
    return amt.toFixed(2);
  };

  const getTypeColor = (type) => {
    const colors = {
      transfer: 'border-blue-500/50 bg-blue-500/10',
      stake: 'border-positive/50 bg-positive/10',
      token: 'border-warning/50 bg-warning/10',
      center: 'border-brand bg-brand/20',
      other: 'border-gray-500/50 bg-gray-500/10'
    };
    return colors[type] || colors.other;
  };

  const NodeCard = ({ node, isCenter = false }) => (
    <Link 
      to={isCenter ? '#' : createPageUrl('AddressLookup') + `?address=${node.id}`}
      className={`block p-3 rounded-lg border-2 ${getTypeColor(node.type)} transition-all ${!isCenter && 'hover:scale-105 cursor-pointer'}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Wallet className={`w-4 h-4 ${isCenter ? 'text-brand' : 'text-ink-muted'}`} />
        <span className={`font-mono text-xs ${isCenter ? 'text-brand' : 'text-ink-soft'}`}>
          {node.id.substring(0, 8)}...{node.id.slice(-4)}
        </span>
      </div>
      {isCenter ? (
        <div className="flex gap-4 text-xs mt-2">
          <span className="text-positive">↓ {formatAmount(node.inflow)} XNT</span>
          <span className="text-negative">↑ {formatAmount(node.outflow)} XNT</span>
        </div>
      ) : (
        <div className="text-xs mt-1">
          <span className="text-white font-bold">{formatAmount(node.totalAmount)} XNT</span>
          <span className="text-ink-faint ml-2">({node.txCount} txs)</span>
        </div>
      )}
    </Link>
  );

  const FlowArrow = ({ direction, amount }) => (
    <div className="flex items-center gap-1 px-2">
      {direction === 'in' ? (
        <>
          <div className="h-[2px] w-8 bg-gradient-to-r from-emerald-500/50 to-emerald-500" />
          <ArrowRight className="w-4 h-4 text-positive" />
        </>
      ) : (
        <>
          <ArrowRight className="w-4 h-4 text-negative" />
          <div className="h-[2px] w-8 bg-gradient-to-r from-red-400 to-red-400/50" />
        </>
      )}
    </div>
  );

  if (!centerNode) return null;

  return (
    <div className="min-h-[400px] p-4">
      <div className="flex items-center justify-center gap-4">
        {/* Incoming Nodes */}
        <div className="flex flex-col gap-3 items-end">
          <div className="flex items-center gap-2 mb-2">
            <Download className="w-4 h-4 text-positive" />
            <span className="text-positive text-sm font-medium">Incoming ({incomingNodes.length})</span>
          </div>
          {incomingNodes.length === 0 ? (
            <div className="text-ink-faint text-sm p-4">No incoming transactions</div>
          ) : (
            incomingNodes.map(node => (
              <div key={node.id} className="flex items-center gap-2">
                <NodeCard node={node} />
                <FlowArrow direction="in" amount={node.totalAmount} />
              </div>
            ))
          )}
        </div>

        {/* Center Node */}
        <div className="mx-8">
          <div className="text-center mb-2">
            <span className="text-brand text-sm font-medium">Analyzed Address</span>
          </div>
          <div className="transform scale-110">
            <NodeCard node={centerNode} isCenter />
          </div>
          <div className="text-center mt-3 text-ink-faint text-xs">
            {centerNode.txCount} total transactions
          </div>
        </div>

        {/* Outgoing Nodes */}
        <div className="flex flex-col gap-3 items-start">
          <div className="flex items-center gap-2 mb-2">
            <Send className="w-4 h-4 text-negative" />
            <span className="text-negative text-sm font-medium">Outgoing ({outgoingNodes.length})</span>
          </div>
          {outgoingNodes.length === 0 ? (
            <div className="text-ink-faint text-sm p-4">No outgoing transactions</div>
          ) : (
            outgoingNodes.map(node => (
              <div key={node.id} className="flex items-center gap-2">
                <FlowArrow direction="out" amount={node.totalAmount} />
                <NodeCard node={node} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-8 pt-4 border-t border-line">
        <div className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 rounded border-2 border-blue-500/50 bg-blue-500/10" />
          <span className="text-ink-muted">Transfer</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 rounded border-2 border-positive/50 bg-positive/10" />
          <span className="text-ink-muted">Stake</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 rounded border-2 border-warning/50 bg-warning/10" />
          <span className="text-ink-muted">Token</span>
        </div>
      </div>
    </div>
  );
}