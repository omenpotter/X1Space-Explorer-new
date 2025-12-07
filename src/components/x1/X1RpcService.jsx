// X1 Blockchain RPC Service
// Uses Solana-compatible JSON-RPC API with fallback endpoints
// Ultra-optimized with caching, connection pooling, and request batching

import { getCached, setCache, debounceRpc } from './RpcCache';

const RPC_ENDPOINTS = [
  'https://rpc.mainnet.x1.xyz',
  'https://nexus.fortiblox.com/rpc',
  'https://rpc.owlnet.dev/?api-key=3a792cc7c3df79f2e7bc929757b47c38',
  'https://rpc.x1galaxy.io/'
];

// API keys for authenticated endpoints
const RPC_AUTH = {
  'https://nexus.fortiblox.com/rpc': {
    headers: {
      'X-API-Key': 'pb_live_7d62cd095391ffd14daca14f2f739b06cac5fd182ca48aed9e2b106ba920c6b0',
      'Authorization': 'Bearer fbx_d4a25e545366fed1ea1582884e62874d6b9fdf94d1f6c4b9889fefa951300dff'
    }
  }
};

// Test all RPCs and log status
export async function testAllRPCs() {
  const results = {};
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const authConfig = RPC_AUTH[endpoint] || {};
      const headers = { 'Content-Type': 'application/json', ...(authConfig.headers || {}) };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSlot', params: [] })
      });
      const data = await response.json();
      results[endpoint] = data.result ? 'OK - Slot: ' + data.result : 'Error: ' + (data.error?.message || 'Unknown');
    } catch (err) {
      results[endpoint] = 'Failed: ' + err.message;
    }
  }
  console.log('RPC Status:', results);
  return results;
}

let currentEndpointIndex = 0;
let lastSuccessfulEndpoint = 0;

// Preconnect to RPC endpoints on module load
if (typeof window !== 'undefined') {
  RPC_ENDPOINTS.forEach(endpoint => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = new URL(endpoint).origin;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
  
  // DNS prefetch for faster resolution
  RPC_ENDPOINTS.forEach(endpoint => {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = new URL(endpoint).origin;
    document.head.appendChild(link);
  });
}

// Helper to make RPC calls with fallback and caching - ULTRA OPTIMIZED
async function rpcCall(method, params = [], cacheKey = null, cacheDuration = 'short') {
  // Check cache first
  if (cacheKey) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }
  
  let lastError = null;
  
  // Start with last successful endpoint for faster response
  const startIndex = lastSuccessfulEndpoint;
  
  for (let i = 0; i < RPC_ENDPOINTS.length; i++) {
    const endpointIndex = (startIndex + i) % RPC_ENDPOINTS.length;
    const endpoint = RPC_ENDPOINTS[endpointIndex];
    
    try {
      const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

              // Get auth headers if this endpoint requires them
              const authConfig = RPC_AUTH[endpoint] || {};
              const headers = {
                'Content-Type': 'application/json',
                ...(authConfig.headers || {})
              };

              const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: Date.now(),
                  method,
                  params
                }),
                signal: controller.signal
              });
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      if (data.error) {
        lastError = new Error(data.error.message);
        continue;
      }
      
      // Success - update preferred endpoint and cache
      currentEndpointIndex = endpointIndex;
      lastSuccessfulEndpoint = endpointIndex;
      if (cacheKey) {
        setCache(cacheKey, data.result, cacheDuration);
      }
      return data.result;
    } catch (err) {
      lastError = err;
      continue;
    }
  }
  
  console.error('All RPC endpoints failed:', lastError);
  throw lastError || new Error('All RPC endpoints failed');
}

// Get current slot (block height)
export async function getSlot() {
  return await rpcCall('getSlot');
}

// Get block height
export async function getBlockHeight() {
  return await rpcCall('getBlockHeight');
}

// Get epoch info
export async function getEpochInfo() {
  return await rpcCall('getEpochInfo');
}

// Get recent performance samples (TPS data)
export async function getRecentPerformanceSamples(limit = 60) {
  return await rpcCall('getRecentPerformanceSamples', [limit]);
}

// Get block details
export async function getBlock(slot, options = {}) {
  const result = await rpcCall('getBlock', [
    slot,
    {
      encoding: 'json',
      transactionDetails: options.transactionDetails || 'full',
      rewards: true,
      maxSupportedTransactionVersion: 0
    }
  ]);
  return result;
}

// Get confirmed blocks in range
export async function getBlocks(startSlot, endSlot) {
  return await rpcCall('getBlocks', [startSlot, endSlot]);
}

// Get recent blockhash
export async function getLatestBlockhash() {
  return await rpcCall('getLatestBlockhash');
}

// Get account balance
export async function getBalance(address) {
  return await rpcCall('getBalance', [address]);
}

// Get account info
export async function getAccountInfo(address) {
  return await rpcCall('getAccountInfo', [address, { encoding: 'jsonParsed' }]);
}

// Get stake accounts for address
export async function getStakeAccounts(address) {
  return await rpcCall('getProgramAccounts', [
    'Stake11111111111111111111111111111111111111',
    {
      encoding: 'jsonParsed',
      filters: [
        { memcmp: { offset: 12, bytes: address } }
      ]
    }
  ]);
}

// Get inflation reward for epoch
export async function getInflationReward(addresses, epoch) {
  return await rpcCall('getInflationReward', [addresses, { epoch }]);
}

// Get multiple accounts
export async function getMultipleAccounts(addresses) {
  return await rpcCall('getMultipleAccounts', [addresses, { encoding: 'jsonParsed' }]);
}

// Get recent block production stats - for accurate skip rate
export async function getBlockProduction(firstSlot, lastSlot) {
  return await rpcCall('getBlockProduction', firstSlot && lastSlot ? [{ range: { firstSlot, lastSlot } }] : []);
}

// Get block production for a specific epoch
export async function getBlockProductionForEpoch(epoch, slotsPerEpoch = 216000) {
  const firstSlot = epoch * slotsPerEpoch;
  const lastSlot = (epoch + 1) * slotsPerEpoch - 1;
  return await rpcCall('getBlockProduction', [{ range: { firstSlot, lastSlot } }]);
}

// Get vote accounts (validators) - cached for 30 seconds
export async function getVoteAccounts() {
  return await rpcCall('getVoteAccounts', [], 'voteAccounts', 'medium');
}

// Get cluster nodes - cached for 30 seconds
export async function getClusterNodes() {
  return await rpcCall('getClusterNodes', [], 'clusterNodes', 'medium');
}

// Get supply info (cached for 5 minutes)
export async function getSupply() {
  const result = await rpcCall('getSupply', [{ excludeNonCirculatingAccountsList: true }], 'supply', 'long');
  console.log('getSupply RAW response:', JSON.stringify(result, null, 2));
  return result;
}

// Get transaction count
export async function getTransactionCount() {
  return await rpcCall('getTransactionCount');
}

// Get signatures for address (recent transactions)
export async function getSignaturesForAddress(address, options = {}) {
  return await rpcCall('getSignaturesForAddress', [
    address,
    { limit: options.limit || 20, ...options }
  ]);
}

// Get transaction details
export async function getTransaction(signature) {
  return await rpcCall('getTransaction', [
    signature,
    { encoding: 'json', maxSupportedTransactionVersion: 0 }
  ]);
}

// Get confirmed signatures (recent transactions globally)
export async function getRecentTransactions(limit = 20) {
  // Get recent block and its transactions
  const slot = await getSlot();
  const block = await getBlock(slot);
  return block?.transactions?.slice(0, limit) || [];
}

// Get leader schedule
export async function getLeaderSchedule(slot = null) {
  return await rpcCall('getLeaderSchedule', slot ? [slot] : []);
}

// Get slot leader
export async function getSlotLeader() {
  return await rpcCall('getSlotLeader');
}

// Get minimum balance for rent exemption
export async function getMinimumBalanceForRentExemption(dataSize) {
  return await rpcCall('getMinimumBalanceForRentExemption', [dataSize]);
}

// Get health status
export async function getHealth() {
  try {
    await rpcCall('getHealth');
    return 'ok';
  } catch (e) {
    return 'error';
  }
}

// Get version (cached for 5 minutes)
export async function getVersion() {
  return await rpcCall('getVersion', [], 'version', 'long');
}

// Aggregate function to get dashboard data - ULTRA OPTIMIZED
export async function getDashboardData() {
  // Check cache first - dashboard data cached for 2 seconds for fast slots
  const cached = getCached('dashboardData');
  if (cached) return cached;
  
  // Fetch all data in parallel for maximum speed
  const [
    slot,
    blockHeight,
    epochInfo,
    performanceSamples,
    supply,
    transactionCount,
    voteAccounts,
    version
  ] = await Promise.all([
    getSlot(),
    getBlockHeight(),
    getEpochInfo(),
    getRecentPerformanceSamples(30),
    getSupply(),
    getTransactionCount(),
    getVoteAccounts(),
    getVersion()
  ]);

  // Calculate TPS from performance samples
  const avgTps = performanceSamples.length > 0
    ? Math.round(performanceSamples.reduce((sum, s) => sum + (s.numTransactions / s.samplePeriodSecs), 0) / performanceSamples.length)
    : 0;

  // Calculate epoch progress
  const epochProgress = ((epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100).toFixed(1);
  const slotsRemaining = epochInfo.slotsInEpoch - epochInfo.slotIndex;
  const timeRemaining = Math.round(slotsRemaining * 0.4); // ~400ms per slot

  const result = {
    slot,
    blockHeight,
    epoch: epochInfo.epoch,
    epochProgress: parseFloat(epochProgress),
    slotsRemaining,
    timeRemaining,
    transactionCount,
    tps: avgTps,
    tpsHistory: performanceSamples.map((s, i) => ({
      time: `${performanceSamples.length - i}m`,
      tps: Math.round(s.numTransactions / s.samplePeriodSecs)
    })).reverse(),
    supply: {
      total: supply.value.total / 1e9,
      circulating: supply.value.circulating / 1e9,
      nonCirculating: supply.value.nonCirculating / 1e9
    },
    validators: {
      current: voteAccounts.current.length,
      delinquent: voteAccounts.delinquent.length,
      totalStake: (voteAccounts.current.reduce((sum, v) => sum + v.activatedStake, 0) + voteAccounts.delinquent.reduce((sum, v) => sum + v.activatedStake, 0)) / 1e9
    },
    version: version['solana-core'] || version.version
  };
  
  // Cache dashboard data for 3 seconds
  setCache('dashboardData', result, 'short');
  return result;
}

// Prefetch common data for faster page navigation
export async function prefetchCommonData() {
  // Fire and forget - prefetch in background
  Promise.all([
    getDashboardData().catch(() => null),
    getVoteAccounts().catch(() => null),
    getRecentBlocks(10).catch(() => null)
  ]);
}

// Get recent blocks with details including transaction type breakdown
export async function getRecentBlocks(count = 10) {
  // Check cache first - use very short cache for fast-moving slots
  const cacheKey = 'recentBlocks';
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  const currentSlot = await getSlot();
  const blocks = [];
  
  // Fetch blocks in parallel with full transaction details
  const blockPromises = [];
  for (let i = 0; i < count; i++) {
    const slot = currentSlot - i;
    blockPromises.push(
      rpcCall('getBlock', [slot, { 
        encoding: 'json',
        transactionDetails: 'full',
        rewards: false,
        maxSupportedTransactionVersion: 0
      }])
        .then(block => block ? { slot, block } : null)
        .catch(() => null)
    );
  }
  
  const results = await Promise.all(blockPromises);
  
  for (const result of results) {
    if (result && result.block) {
      const { slot, block } = result;
      const transactions = block.transactions || [];
      const txCount = transactions.length;
      
      // Categorize transactions by type
      let voteCount = 0;
      let transferCount = 0;
      let programCount = 0;
      let otherCount = 0;
      
      transactions.forEach(tx => {
        const message = tx.transaction?.message;
        const instructions = message?.instructions || [];
        const accountKeys = message?.accountKeys || [];
        
        // Check if it's a vote transaction
        const isVote = instructions.some(ix => {
          const programId = accountKeys[ix.programIdIndex];
          return programId === 'Vote111111111111111111111111111111111111111';
        });
        
        if (isVote) {
          voteCount++;
        } else {
          // Check for system transfers
          const isTransfer = instructions.some(ix => {
            const programId = accountKeys[ix.programIdIndex];
            return programId === '11111111111111111111111111111111';
          });
          
          if (isTransfer) {
            transferCount++;
          } else if (instructions.length > 0) {
            programCount++;
          } else {
            otherCount++;
          }
        }
      });
      
      blocks.push({
        slot,
        parentSlot: block.parentSlot,
        blockhash: block.blockhash,
        previousBlockhash: block.previousBlockhash,
        blockTime: block.blockTime,
        blockHeight: block.blockHeight,
        txCount,
        voteCount,
        transferCount,
        programCount,
        otherCount: otherCount + programCount, // Combine program and other for simplicity
        rewards: []
      });
    }
  }
  
  // Sort by slot descending
  blocks.sort((a, b) => b.slot - a.slot);
  
  // Cache for 3 seconds
  setCache('recentBlocks', blocks, 'short');
  return blocks;
}

// Get epoch schedule and history
export async function getEpochSchedule() {
  return await rpcCall('getEpochSchedule');
}

// Get inflation rate
export async function getInflationRate() {
  return await rpcCall('getInflationRate');
}

// Get first available block
export async function getFirstAvailableBlock() {
  return await rpcCall('getFirstAvailableBlock');
}

import { getValidatorName as getNameFromService, getDisplayName, getValidatorIcon, fetchAllValidatorIdentities } from './ValidatorNames';

// Generate validator names - uses ValidatorNames service
function generateValidatorName(votePubkey, nodePubkey, activatedStake) {
  const info = getNameFromService(votePubkey, nodePubkey, activatedStake);
  return info || { name: `${votePubkey.substring(0, 6)}...${votePubkey.slice(-4)}`, icon: '⚪', website: null };
}

// Get validator details with enhanced info
export async function getValidatorDetails() {
  // Fetch validator identities first for best name resolution
  await fetchAllValidatorIdentities().catch(() => {});
  
  const [voteAccounts, clusterNodes, epochInfo, currentSlot, blockProduction] = await Promise.all([
    getVoteAccounts(),
    getClusterNodes(),
    getEpochInfo(),
    getSlot(),
    getBlockProduction().catch(() => null)
  ]);

  // Create a map of node pubkeys to their info
  const nodeMap = {};
  clusterNodes.forEach(node => {
    nodeMap[node.pubkey] = node;
  });

  // Calculate total stake for percentage calculations
  const totalActiveStake = voteAccounts.current.reduce((sum, v) => sum + v.activatedStake, 0);

  // Build skip rate map from block production data
  const skipRateMap = {};
  if (blockProduction?.value?.byIdentity) {
    Object.entries(blockProduction.value.byIdentity).forEach(([identity, [leaderSlots, blocksProduced]]) => {
      const skipRate = leaderSlots > 0 ? ((leaderSlots - blocksProduced) / leaderSlots) * 100 : 0;
      skipRateMap[identity] = skipRate;
    });
  }

  // Combine vote accounts with node info
  const validators = voteAccounts.current.map((v) => {
    const node = nodeMap[v.nodePubkey] || {};
    
    // Generate validator name based on stake amount
    const validatorInfo = generateValidatorName(v.votePubkey, v.nodePubkey, v.activatedStake);
    
    let name = validatorInfo.name;
    let website = validatorInfo.website;
    let icon = validatorInfo.icon;
    
    // Calculate epoch credits for performance metrics
    const epochCredits = v.epochCredits || [];
    const currentEpochCredits = epochCredits.length > 0 ? epochCredits[epochCredits.length - 1] : [0, 0, 0];
    const prevEpochCredits = epochCredits.length > 1 ? epochCredits[epochCredits.length - 2] : [0, 0, 0];
    
    // Credits earned this epoch
    const creditsThisEpoch = currentEpochCredits[1] - currentEpochCredits[2];
    const creditsPrevEpoch = prevEpochCredits[1] - prevEpochCredits[2];
    
    // Calculate vote lag
    const voteLag = currentSlot - v.lastVote;
    
    // Use real skip rate from block production, fallback to 0
    const skipRate = skipRateMap[v.nodePubkey] !== undefined ? skipRateMap[v.nodePubkey] : 0;
    
    // Calculate uptime from epoch credits
    const expectedCredits = epochInfo.slotIndex;
    const uptime = expectedCredits > 0 ? Math.min(99.9, (creditsThisEpoch / expectedCredits) * 100) : 99.9;
    
    return {
      votePubkey: v.votePubkey,
      nodePubkey: v.nodePubkey,
      activatedStake: v.activatedStake / 1e9,
      stakePercent: ((v.activatedStake / totalActiveStake) * 100).toFixed(2),
      commission: v.commission,
      lastVote: v.lastVote,
      voteLag,
      rootSlot: v.rootSlot,
      credits: currentEpochCredits[1] || 0,
      creditsThisEpoch,
      creditsPrevEpoch,
      version: node.version || 'unknown',
      gossip: node.gossip,
      tpu: node.tpu,
      rpc: node.rpc,
      delinquent: false,
      name,
      website,
      icon,
      uptime,
      skipRate,
      featureSet: node.featureSet
    };
  });

  // Add delinquent validators
  voteAccounts.delinquent.forEach(v => {
    const node = nodeMap[v.nodePubkey] || {};
    const validatorInfo = generateValidatorName(v.votePubkey, v.nodePubkey, v.activatedStake);
    const skipRate = skipRateMap[v.nodePubkey] !== undefined ? skipRateMap[v.nodePubkey] : 100;
    
    validators.push({
      votePubkey: v.votePubkey,
      nodePubkey: v.nodePubkey,
      activatedStake: v.activatedStake / 1e9,
      stakePercent: ((v.activatedStake / totalActiveStake) * 100).toFixed(2),
      commission: v.commission,
      lastVote: v.lastVote,
      voteLag: currentSlot - v.lastVote,
      rootSlot: v.rootSlot,
      credits: 0,
      creditsThisEpoch: 0,
      creditsPrevEpoch: 0,
      version: node.version || 'unknown',
      delinquent: true,
      name: validatorInfo.name,
      website: validatorInfo.website,
      icon: validatorInfo.icon,
      uptime: 0,
      skipRate
    });
  });

  // Sort by stake
  validators.sort((a, b) => b.activatedStake - a.activatedStake);

  return validators;
}

// Get real-time transaction stream from recent blocks with categorization
export async function getRealtimeTransactions(limit = 50) {
  const currentSlot = await getSlot();
  const transactions = [];
  
  // Fetch last few blocks to get recent transactions
  for (let i = 0; i < 3 && transactions.length < limit; i++) {
    try {
      const block = await rpcCall('getBlock', [currentSlot - i, {
        encoding: 'json',
        transactionDetails: 'full',
        rewards: false,
        maxSupportedTransactionVersion: 0
      }]);
      
      if (block?.transactions) {
        for (const tx of block.transactions) {
          if (transactions.length >= limit) break;
          
          const message = tx.transaction?.message;
          const accountKeys = message?.accountKeys || [];
          const instructions = message?.instructions || [];
          const signature = tx.transaction?.signatures?.[0];
          
          // Categorize transaction
          let type = 'other';
          let fromAddress = accountKeys[0] || '';
          let toAddress = '';
          
          for (const ix of instructions) {
            const programId = accountKeys[ix.programIdIndex];
            if (programId === 'Vote111111111111111111111111111111111111111') {
              type = 'vote';
              break;
            } else if (programId === '11111111111111111111111111111111') {
              type = 'transfer';
              // For system program, destination is usually account index 1
              toAddress = accountKeys[1] || '';
            } else if (programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
              type = 'token';
            }
          }
          
          transactions.push({
            signature,
            slot: currentSlot - i,
            blockTime: block.blockTime,
            type,
            status: tx.meta?.err ? 'failed' : 'success',
            fee: (tx.meta?.fee || 0) / 1e9,
            from: fromAddress,
            to: toAddress
          });
        }
      }
    } catch (e) {
      continue;
    }
  }
  
  return transactions;
}

// Get accurate epoch history with real skip rate from block production
export async function getEpochHistoryData() {
  const [epochInfo, blockProduction, performanceSamples] = await Promise.all([
    getEpochInfo(),
    getBlockProduction().catch(() => null),
    getRecentPerformanceSamples(60)
  ]);
  
  // Calculate actual skip rate from block production data
  let skipRate = 0;
  let producedSlots = epochInfo.slotIndex;
  let skippedSlots = 0;
  
  if (blockProduction?.value?.byIdentity) {
    const totals = Object.values(blockProduction.value.byIdentity).reduce((acc, [leader, produced]) => {
      acc.leader += leader;
      acc.produced += produced;
      return acc;
    }, { leader: 0, produced: 0 });
    
    skippedSlots = totals.leader - totals.produced;
    producedSlots = totals.produced;
    skipRate = totals.leader > 0 ? (skippedSlots / totals.leader) * 100 : 0;
  }
  
  // Calculate average TPS from performance samples
  const avgTps = performanceSamples.length > 0
    ? Math.round(performanceSamples.reduce((sum, s) => sum + (s.numTransactions / s.samplePeriodSecs), 0) / performanceSamples.length)
    : 0;
  
  return {
    epoch: epochInfo.epoch,
    slotIndex: epochInfo.slotIndex,
    slotsInEpoch: epochInfo.slotsInEpoch,
    producedSlots,
    skippedSlots,
    skipRate: skipRate.toFixed(4),
    avgTps,
    absoluteSlot: epochInfo.absoluteSlot
  };
}

// Get performance samples for specific time windows (actual on-chain data)
export async function getPerformanceHistory(minutes = 60) {
  const samples = await getRecentPerformanceSamples(minutes);
  return samples.map((s, i) => ({
    minutesAgo: minutes - i - 1,
    tps: Math.round(s.numTransactions / s.samplePeriodSecs),
    transactions: s.numTransactions,
    slots: s.numSlots,
    samplePeriod: s.samplePeriodSecs
  }));
}

// Get pending/recent transactions from mempool-like view (unconfirmed recent txs)
export async function getPendingTransactions() {
  try {
    const currentSlot = await getSlot();
    // Get the latest block which may have very recent transactions
    const block = await rpcCall('getBlock', [currentSlot, {
      encoding: 'json',
      transactionDetails: 'full',
      rewards: false,
      maxSupportedTransactionVersion: 0
    }]).catch(() => null);
    
    if (!block?.transactions) return [];
    
    // Return the most recent transactions as "pending-like" (just confirmed)
    return block.transactions.slice(0, 20).map(tx => {
      const message = tx.transaction?.message;
      const accountKeys = message?.accountKeys || [];
      const instructions = message?.instructions || [];
      const signature = tx.transaction?.signatures?.[0];
      
      let type = 'other';
      for (const ix of instructions) {
        const programId = accountKeys[ix.programIdIndex];
        if (programId === 'Vote111111111111111111111111111111111111111') {
          type = 'vote';
          break;
        } else if (programId === '11111111111111111111111111111111') {
          type = 'transfer';
        } else if (programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
          type = 'token';
        }
      }
      
      return {
        signature,
        slot: currentSlot,
        type,
        status: tx.meta?.err ? 'failed' : 'pending',
        fee: (tx.meta?.fee || 0) / 1e9,
        from: accountKeys[0] || '',
        timestamp: Date.now()
      };
    });
  } catch (e) {
    return [];
  }
}

export default {
  getSlot,
  getBlockHeight,
  getEpochInfo,
  getRecentPerformanceSamples,
  getBlock,
  getBlocks,
  getLatestBlockhash,
  getVoteAccounts,
  getClusterNodes,
  getSupply,
  getTransactionCount,
  getSignaturesForAddress,
  getTransaction,
  getRecentTransactions,
  getLeaderSchedule,
  getSlotLeader,
  getHealth,
  getVersion,
  getDashboardData,
  getRecentBlocks,
  getValidatorDetails,
  getBalance,
  getAccountInfo,
  getStakeAccounts,
  getInflationReward,
  getMultipleAccounts,
  getBlockProduction,
  getBlockProductionForEpoch,
  getRealtimeTransactions,
  getEpochHistoryData,
  getPerformanceHistory,
  getPendingTransactions
};