// X1 Blockchain RPC Service
// Uses Solana-compatible JSON-RPC API

const X1_RPC_ENDPOINT = 'https://rpc.mainnet.x1.xyz';

// Helper to make RPC calls
async function rpcCall(method, params = []) {
  const response = await fetch(X1_RPC_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    })
  });
  
  const data = await response.json();
  if (data.error) {
    console.error('RPC Error:', data.error);
    throw new Error(data.error.message);
  }
  return data.result;
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
      transactionDetails: options.transactionDetails || 'signatures',
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

// Get vote accounts (validators)
export async function getVoteAccounts() {
  return await rpcCall('getVoteAccounts');
}

// Get cluster nodes
export async function getClusterNodes() {
  return await rpcCall('getClusterNodes');
}

// Get supply info
export async function getSupply() {
  return await rpcCall('getSupply');
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

// Get version
export async function getVersion() {
  return await rpcCall('getVersion');
}

// Aggregate function to get dashboard data
export async function getDashboardData() {
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

  return {
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
      totalStake: voteAccounts.current.reduce((sum, v) => sum + v.activatedStake, 0) / 1e9
    },
    version: version['solana-core'] || version.version
  };
}

// Get recent blocks with details
export async function getRecentBlocks(count = 10) {
  const currentSlot = await getSlot();
  const blocks = [];
  
  // Fetch blocks in parallel - use 'signatures' mode for faster response
  const blockPromises = [];
  for (let i = 0; i < count; i++) {
    const slot = currentSlot - i;
    blockPromises.push(
      rpcCall('getBlock', [slot, { 
        encoding: 'json',
        transactionDetails: 'signatures',
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
      // When using 'signatures' mode, block.signatures contains the transaction signatures
      const txCount = block.signatures?.length || 0;
      blocks.push({
        slot,
        parentSlot: block.parentSlot,
        blockhash: block.blockhash,
        previousBlockhash: block.previousBlockhash,
        blockTime: block.blockTime,
        blockHeight: block.blockHeight,
        txCount,
        rewards: []
      });
    }
  }
  
  // Sort by slot descending
  blocks.sort((a, b) => b.slot - a.slot);
  
  return blocks;
}

// Fetch validator identity info to get names
async function getValidatorIdentity(pubkey) {
  try {
    const accountInfo = await rpcCall('getAccountInfo', [
      pubkey,
      { encoding: 'jsonParsed' }
    ]);
    return accountInfo;
  } catch (e) {
    return null;
  }
}

// Get validator details
export async function getValidatorDetails() {
  const [voteAccounts, clusterNodes] = await Promise.all([
    getVoteAccounts(),
    getClusterNodes()
  ]);

  // Create a map of node pubkeys to their info
  const nodeMap = {};
  clusterNodes.forEach(node => {
    nodeMap[node.pubkey] = node;
  });

  // Known validator names (expanded list based on x1val.online)
  const knownNames = {
    // Add known validator identity pubkeys -> names here
    // This can be expanded as we discover more
  };

  // Combine vote accounts with node info
  const validators = voteAccounts.current.map((v, index) => {
    const node = nodeMap[v.nodePubkey] || {};
    
    // Try to determine name from various sources
    let name = knownNames[v.votePubkey] || knownNames[v.nodePubkey];
    
    // If no known name, check if it looks like an X1 Labs node based on stake
    if (!name && v.activatedStake > 50000000000000) { // High stake = likely X1 Labs
      name = `X1 Labs (node${index + 1})`;
    }
    
    return {
      votePubkey: v.votePubkey,
      nodePubkey: v.nodePubkey,
      activatedStake: v.activatedStake / 1e9,
      commission: v.commission,
      lastVote: v.lastVote,
      rootSlot: v.rootSlot,
      credits: v.epochCredits?.[v.epochCredits.length - 1]?.[1] || 0,
      version: node.version || 'unknown',
      gossip: node.gossip,
      tpu: node.tpu,
      rpc: node.rpc,
      delinquent: false,
      name: name
    };
  });

  // Add delinquent validators
  voteAccounts.delinquent.forEach(v => {
    const node = nodeMap[v.nodePubkey] || {};
    validators.push({
      votePubkey: v.votePubkey,
      nodePubkey: v.nodePubkey,
      activatedStake: v.activatedStake / 1e9,
      commission: v.commission,
      lastVote: v.lastVote,
      rootSlot: v.rootSlot,
      credits: 0,
      version: node.version || 'unknown',
      delinquent: true,
      name: null
    });
  });

  // Sort by stake
  validators.sort((a, b) => b.activatedStake - a.activatedStake);

  return validators;
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
  getValidatorDetails
};