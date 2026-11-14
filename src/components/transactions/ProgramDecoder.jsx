import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Coins, Users, Lock, Send, ArrowRight } from 'lucide-react';

// Known program IDs
const KNOWN_PROGRAMS = {
  '11111111111111111111111111111111': { name: 'System Program', icon: '⚙️', color: 'cyan' },
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': { name: 'SPL Token', icon: '🪙', color: 'yellow' },
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb': { name: 'Token-2022', icon: '🪙', color: 'amber' },
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': { name: 'Associated Token', icon: '🔗', color: 'purple' },
  'Stake11111111111111111111111111111111111111': { name: 'Stake Program', icon: '🥩', color: 'red' },
  'Vote111111111111111111111111111111111111111': { name: 'Vote Program', icon: '🗳️', color: 'blue' },
  'ComputeBudget111111111111111111111111111111': { name: 'Compute Budget', icon: '💻', color: 'gray' },
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr': { name: 'Memo', icon: '📝', color: 'green' },
};

// System Program instruction types
const SYSTEM_INSTRUCTIONS = {
  0: 'CreateAccount',
  1: 'Assign',
  2: 'Transfer',
  3: 'CreateAccountWithSeed',
  4: 'AdvanceNonceAccount',
  5: 'WithdrawNonceAccount',
  6: 'InitializeNonceAccount',
  7: 'AuthorizeNonceAccount',
  8: 'Allocate',
  9: 'AllocateWithSeed',
  10: 'AssignWithSeed',
  11: 'TransferWithSeed',
};

// SPL Token instruction types
const TOKEN_INSTRUCTIONS = {
  0: 'InitializeMint',
  1: 'InitializeAccount',
  2: 'InitializeMultisig',
  3: 'Transfer',
  4: 'Approve',
  5: 'Revoke',
  6: 'SetAuthority',
  7: 'MintTo',
  8: 'Burn',
  9: 'CloseAccount',
  10: 'FreezeAccount',
  11: 'ThawAccount',
  12: 'TransferChecked',
  13: 'ApproveChecked',
  14: 'MintToChecked',
  15: 'BurnChecked',
};

// Stake Program instruction types
const STAKE_INSTRUCTIONS = {
  0: 'Initialize',
  1: 'Authorize',
  2: 'DelegateStake',
  3: 'Split',
  4: 'Withdraw',
  5: 'Deactivate',
  6: 'SetLockup',
  7: 'Merge',
  8: 'AuthorizeWithSeed',
};

export function getProgramInfo(programId) {
  return KNOWN_PROGRAMS[programId] || { name: 'Unknown Program', icon: '❓', color: 'gray' };
}

export function decodeInstruction(programId, data) {
  if (!data || data.length === 0) return { type: 'Unknown', details: {} };
  
  const instructionType = data[0];
  
  if (programId === '11111111111111111111111111111111') {
    return {
      type: SYSTEM_INSTRUCTIONS[instructionType] || `Unknown (${instructionType})`,
      details: decodeSystemInstruction(instructionType, data)
    };
  }
  
  if (programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
    return {
      type: TOKEN_INSTRUCTIONS[instructionType] || `Unknown (${instructionType})`,
      details: decodeTokenInstruction(instructionType, data)
    };
  }
  
  if (programId === 'Stake11111111111111111111111111111111111111') {
    return {
      type: STAKE_INSTRUCTIONS[instructionType] || `Unknown (${instructionType})`,
      details: {}
    };
  }
  
  return { type: `Instruction ${instructionType}`, details: {} };
}

function decodeSystemInstruction(type, data) {
  if (type === 2 && data.length >= 12) { // Transfer
    const lamports = new DataView(new Uint8Array(data.slice(4, 12)).buffer).getBigUint64(0, true);
    return { lamports: Number(lamports) / 1e9 };
  }
  return {};
}

function decodeTokenInstruction(type, data) {
  if ((type === 3 || type === 12) && data.length >= 9) { // Transfer or TransferChecked
    const amount = new DataView(new Uint8Array(data.slice(1, 9)).buffer).getBigUint64(0, true);
    return { amount: Number(amount) };
  }
  return {};
}

export default function ProgramDecoder({ instruction, accounts }) {
  const programId = instruction?.programId || '';
  const programInfo = getProgramInfo(programId);
  const decoded = decodeInstruction(programId, instruction?.data);
  
  const colorClasses = {
    cyan: 'bg-brand/20 text-brand border-brand/30',
    yellow: 'bg-warning/20 text-warning border-warning/30',
    amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    red: 'bg-negative/20 text-negative border-negative/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    gray: 'bg-gray-500/20 text-ink-muted border-gray-500/30',
  };

  return (
    <div className="bg-surface-1 rounded-lg p-4 border border-line">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xl">{programInfo.icon}</span>
        <div>
          <p className="text-white font-medium">{programInfo.name}</p>
          <p className="text-ink-faint font-mono text-xs">{programId.substring(0, 16)}...</p>
        </div>
        <Badge className={`ml-auto border ${colorClasses[programInfo.color]}`}>
          {decoded.type}
        </Badge>
      </div>
      
      {Object.keys(decoded.details).length > 0 && (
        <div className="bg-surface-2 rounded p-3 mb-3">
          <p className="text-ink-muted text-xs mb-2">Decoded Data</p>
          {Object.entries(decoded.details).map(([key, value]) => (
            <div key={key} className="flex justify-between text-sm">
              <span className="text-ink-faint capitalize">{key}:</span>
              <span className="text-brand font-mono">
                {typeof value === 'number' ? value.toLocaleString() : value}
                {key === 'lamports' && ' XNT'}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {accounts && accounts.length > 0 && (
        <div>
          <p className="text-ink-muted text-xs mb-2">Accounts ({accounts.length})</p>
          <div className="space-y-1">
            {accounts.slice(0, 5).map((acc, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-ink-faint w-4">{i}</span>
                <code className="text-brand/70 font-mono flex-1 truncate">{acc}</code>
                {i === 0 && <Badge className="bg-positive/20 text-positive border-0 text-[10px]">Signer</Badge>}
              </div>
            ))}
            {accounts.length > 5 && (
              <p className="text-ink-faint text-xs">+{accounts.length - 5} more accounts</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}