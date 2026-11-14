import React from 'react';
import { ArrowRight, ArrowDown, Coins, User, Server } from 'lucide-react';

export default function TransactionFlow({ transaction }) {
  if (!transaction) return null;

  // Extract flow data from transaction
  const accounts = transaction.accounts || [];
  const instructions = transaction.instructions || [];
  
  // Build flow nodes
  const nodes = [];
  const edges = [];
  
  // Add signer as first node
  if (accounts.length > 0) {
    nodes.push({
      id: 'signer',
      label: 'Signer',
      address: accounts[0],
      type: 'wallet',
      x: 0,
      y: 0
    });
  }

  // Add program nodes
  const programs = [...new Set(instructions.map(ix => ix.programId).filter(Boolean))];
  programs.forEach((prog, i) => {
    nodes.push({
      id: `prog-${i}`,
      label: getShortProgramName(prog),
      address: prog,
      type: 'program',
      x: 1,
      y: i
    });
    
    edges.push({
      from: 'signer',
      to: `prog-${i}`,
      label: 'invoke'
    });
  });

  // Add destination accounts
  const destinations = accounts.slice(1, 4).filter(a => !programs.includes(a));
  destinations.forEach((dest, i) => {
    const nodeId = `dest-${i}`;
    nodes.push({
      id: nodeId,
      label: `Account ${i + 1}`,
      address: dest,
      type: 'account',
      x: 2,
      y: i
    });
    
    if (programs.length > 0) {
      edges.push({
        from: `prog-0`,
        to: nodeId,
        label: 'modify'
      });
    }
  });

  const getNodeColor = (type) => {
    switch (type) {
      case 'wallet': return 'from-emerald-500/30 to-emerald-600/20 border-positive/50';
      case 'program': return 'from-purple-500/30 to-purple-600/20 border-purple-500/50';
      case 'account': return 'from-brand/30 to-cyan-600/20 border-brand/50';
      default: return 'from-gray-500/30 to-gray-600/20 border-gray-500/50';
    }
  };

  const getNodeIcon = (type) => {
    switch (type) {
      case 'wallet': return <User className="w-4 h-4" />;
      case 'program': return <Server className="w-4 h-4" />;
      case 'account': return <Coins className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="bg-surface-2 rounded-xl p-6">
      <h3 className="text-ink-muted text-sm mb-4">TRANSACTION FLOW</h3>
      
      <div className="flex items-start justify-between gap-4 overflow-x-auto pb-4">
        {/* Signer Column */}
        <div className="flex flex-col items-center gap-4 min-w-[150px]">
          <p className="text-ink-faint text-xs uppercase">Signer</p>
          {nodes.filter(n => n.type === 'wallet').map(node => (
            <div 
              key={node.id}
              className={`bg-gradient-to-b ${getNodeColor(node.type)} border rounded-xl p-4 text-center`}
            >
              <div className="w-10 h-10 rounded-full bg-positive/20 flex items-center justify-center mx-auto mb-2">
                {getNodeIcon(node.type)}
              </div>
              <p className="text-white text-sm font-medium">{node.label}</p>
              <p className="text-ink-faint font-mono text-[10px] truncate max-w-[120px]">
                {node.address?.substring(0, 8)}...
              </p>
            </div>
          ))}
        </div>

        {/* Arrow */}
        <div className="flex items-center pt-12">
          <ArrowRight className="w-6 h-6 text-ink-faint" />
        </div>

        {/* Programs Column */}
        <div className="flex flex-col items-center gap-4 min-w-[150px]">
          <p className="text-ink-faint text-xs uppercase">Programs</p>
          {nodes.filter(n => n.type === 'program').map(node => (
            <div 
              key={node.id}
              className={`bg-gradient-to-b ${getNodeColor(node.type)} border rounded-xl p-4 text-center`}
            >
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-2">
                {getNodeIcon(node.type)}
              </div>
              <p className="text-white text-sm font-medium">{node.label}</p>
              <p className="text-ink-faint font-mono text-[10px] truncate max-w-[120px]">
                {node.address?.substring(0, 8)}...
              </p>
            </div>
          ))}
          {nodes.filter(n => n.type === 'program').length === 0 && (
            <div className="text-ink-faint text-sm">No programs</div>
          )}
        </div>

        {/* Arrow */}
        <div className="flex items-center pt-12">
          <ArrowRight className="w-6 h-6 text-ink-faint" />
        </div>

        {/* Accounts Column */}
        <div className="flex flex-col items-center gap-4 min-w-[150px]">
          <p className="text-ink-faint text-xs uppercase">Accounts</p>
          {nodes.filter(n => n.type === 'account').map(node => (
            <div 
              key={node.id}
              className={`bg-gradient-to-b ${getNodeColor(node.type)} border rounded-xl p-4 text-center`}
            >
              <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center mx-auto mb-2">
                {getNodeIcon(node.type)}
              </div>
              <p className="text-white text-sm font-medium">{node.label}</p>
              <p className="text-ink-faint font-mono text-[10px] truncate max-w-[120px]">
                {node.address?.substring(0, 8)}...
              </p>
            </div>
          ))}
          {nodes.filter(n => n.type === 'account').length === 0 && (
            <div className="text-ink-faint text-sm">No accounts</div>
          )}
        </div>
      </div>

      {/* State Changes */}
      {transaction.stateChanges && transaction.stateChanges.length > 0 && (
        <div className="mt-4 pt-4 border-t border-line">
          <p className="text-ink-muted text-xs mb-3">SIMULATED STATE CHANGES</p>
          <div className="space-y-2">
            {transaction.stateChanges.map((change, i) => (
              <div key={i} className="flex items-center gap-3 text-sm bg-surface-1 rounded-lg p-3">
                <span className={`w-2 h-2 rounded-full ${change.type === 'credit' ? 'bg-positive' : 'bg-negative'}`} />
                <code className="text-brand/70 font-mono text-xs">{change.account?.substring(0, 12)}...</code>
                <span className="text-ink-faint">→</span>
                <span className={change.type === 'credit' ? 'text-positive' : 'text-negative'}>
                  {change.type === 'credit' ? '+' : '-'}{change.amount} XNT
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getShortProgramName(programId) {
  const names = {
    '11111111111111111111111111111111': 'System',
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': 'Token',
    'Stake11111111111111111111111111111111111111': 'Stake',
    'Vote111111111111111111111111111111111111111': 'Vote',
    'ComputeBudget111111111111111111111111111111': 'Compute',
  };
  return names[programId] || 'Program';
}