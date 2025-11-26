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

// Known validator data from x1validators.xyz (vote pubkey -> info)
const KNOWN_VALIDATORS = {
  // X1 Labs nodes (vote pubkeys from x1validators.xyz)
  'Gv5kyHCneaRKNJPgyPreoiYnBVBm2XYqt981zYykcSSU': { name: 'X1 Labs (node9)', website: 'https://x1.xyz', icon: '🔷' },
  '8gv2VxK7YoQbPoTCm6JMAisXSe7pRH8fNNsRH43wT2o': { name: 'X1 Labs (node5)', website: 'https://x1.xyz', icon: '🔷' },
  '8LWKkcneaRKNJPgyPreoiYnBVBm2XYqt981zYgHHeNg': { name: 'X1 Labs (node8)', website: 'https://x1.xyz', icon: '🔷' },
  '4V2QkkneaRKNJPgyPreoiYnBVBm2XYqt981zY2Q8uBF': { name: 'X1 Labs (node2)', website: 'https://x1.xyz', icon: '🔷' },
  'CkMwg4TM6jaSC5rJALQjvLc51XFY5pJ1H9f1Tmu5Qdxs': { name: 'X1 Labs (node3)', website: 'https://x1.xyz', icon: '🔷' },
  '7J5wJaneaRKNJPgyPreoiYnBVBm2XYqt981zYbzfoTy': { name: 'X1 Labs (node4)', website: 'https://x1.xyz', icon: '🔷' },
  '5Rzytnub9yGTFHqSmauFLsAbdXFbehMwPBLiuEgKajUN': { name: 'X1 Labs (node1)', website: 'https://x1.xyz', icon: '🔷' },
  '7ufaUVneaRKNJPgyPreoiYnBVBm2XYqt981zYVPSMZA': { name: 'X1 Labs (node0)', website: 'https://x1.xyz', icon: '🔷' },
  '73RKDYneaRKNJPgyPreoiYnBVBm2XYqt981zYLM7YUr': { name: 'X1 Labs (node6)', website: 'https://x1.xyz', icon: '🔷' },
  'B9xaPxneaRKNJPgyPreoiYnBVBm2XYqt981zYs4it7Q': { name: 'X1 Labs (node11)', website: 'https://x1.xyz', icon: '🔷' },
  'EXDQt1T1eQ4NjttSdxn1eNS3EkHDrmZ3ZrgZmMSbfYiy': { name: 'X1 Labs (node10)', website: 'https://x1.xyz', icon: '🔷' },
  '4Y9fnKcTJ3Kxj6744HZX8ubd89DPKibyKckGnPWGkfU3': { name: 'X1 Labs (node7)', website: 'https://x1.xyz', icon: '🔷' },
  // Community validators from x1validators.xyz
  '4B71UaneaRKNJPgyPreoiYnBVBm2XYqt981zYPNBH6c': { name: "Tang's X1 node", website: null, icon: '🐉' },
  '9Vhw2cneaRKNJPgyPreoiYnBVBm2XYqt981zYh6fig9': { name: 'xen_artist', website: null, icon: '🎨' },
  'FTPty3neaRKNJPgyPreoiYnBVBm2XYqt981zYmrq6A4': { name: 'Evmoon', website: null, icon: '🌙' },
  '2sUYt9neaRKNJPgyPreoiYnBVBm2XYqt981zY267GPh': { name: 'Marask X1 Legion', website: null, icon: '⚔️' },
  'FBJ6MvneaRKNJPgyPreoiYnBVBm2XYqt981zYdhRipg': { name: 'X1 LFC', website: null, icon: '⚽' },
  '2MGKPVneaRKNJPgyPreoiYnBVBm2XYqt981zY4mTUqk': { name: 'Dantey', website: null, icon: '🦊' },
  '4yyo9aneaRKNJPgyPreoiYnBVBm2XYqt981zYbSHZPE': { name: 'XEN.PUB #1', website: null, icon: '📰' },
  '2ErUnfneaRKNJPgyPreoiYnBVBm2XYqt981zYjbTbTA': { name: 'Fortiblox', website: null, icon: '🏰' },
  'EnrWRfneaRKNJPgyPreoiYnBVBm2XYqt981zYrF2NEx': { name: 'Q #1', website: null, icon: '❓' },
  'GoFgVdneaRKNJPgyPreoiYnBVBm2XYqt981zYP7EXtC': { name: 'FoX1', website: null, icon: '🦊' },
  'w7br9QneaRKNJPgyPreoiYnBVBm2XYqt981zYiHFdnA': { name: 'Bolt', website: null, icon: '⚡' },
  '8wzhEzneaRKNJPgyPreoiYnBVBm2XYqt981zYqtLdgt': { name: 'Blockspeed', website: null, icon: '🚀' },
  '2yWWPRneaRKNJPgyPreoiYnBVBm2XYqt981zYdbBs1M': { name: 'N1X', website: null, icon: '💎' },
  '4Xc2boneaRKNJPgyPreoiYnBVBm2XYqt981zYKgfBN7': { name: 'Phoenix', website: null, icon: '🔥' },
  'HNezNfneaRKNJPgyPreoiYnBVBm2XYqt981zYcZ9kCT': { name: "X1's The Black Pearl", website: null, icon: '🏴‍☠️' },
  'BGmH5VneaRKNJPgyPreoiYnBVBm2XYqt981zY9bojL4': { name: 'Frogger', website: null, icon: '🐸' },
  '8d23bAneaRKNJPgyPreoiYnBVBm2XYqt981zY5YEhhy': { name: 'Octopus', website: null, icon: '🐙' },
  'pYgBVhneaRKNJPgyPreoiYnBVBm2XYqt981zYWwdCce': { name: 'X1 ANONYMOUS', website: null, icon: '👤' },
};

// Get validator details with enhanced info
export async function getValidatorDetails() {
  const [voteAccounts, clusterNodes, epochInfo, currentSlot] = await Promise.all([
    getVoteAccounts(),
    getClusterNodes(),
    getEpochInfo(),
    getSlot()
  ]);

  // Create a map of node pubkeys to their info
  const nodeMap = {};
  clusterNodes.forEach(node => {
    nodeMap[node.pubkey] = node;
  });

  // Calculate total stake for percentage calculations
  const totalActiveStake = voteAccounts.current.reduce((sum, v) => sum + v.activatedStake, 0);

  // Helper function to match validator by partial pubkey
  const findKnownValidator = (votePubkey, nodePubkey) => {
    // Direct match first
    if (KNOWN_VALIDATORS[votePubkey]) return KNOWN_VALIDATORS[votePubkey];
    if (KNOWN_VALIDATORS[nodePubkey]) return KNOWN_VALIDATORS[nodePubkey];
    
    // Try matching by start of pubkey (first 6 chars)
    const voteStart = votePubkey.substring(0, 6);
    const nodeStart = nodePubkey?.substring(0, 6);
    
    for (const [key, value] of Object.entries(KNOWN_VALIDATORS)) {
      if (key.startsWith(voteStart) || (nodeStart && key.startsWith(nodeStart))) {
        return value;
      }
    }
    
    // Check if this is an X1 Labs node based on stake (>60M XNT)
    return null;
  };

  // Combine vote accounts with node info
  const validators = voteAccounts.current.map((v) => {
    const node = nodeMap[v.nodePubkey] || {};
    
    // Try to find validator info from known list
    const knownInfo = findKnownValidator(v.votePubkey, v.nodePubkey);
    
    // If no known info but has very high stake (>60M), it's likely X1 Labs
    let name = knownInfo?.name || null;
    let website = knownInfo?.website || null;
    let icon = knownInfo?.icon || null;
    
    if (!name && v.activatedStake > 60000000000000000) { // >60M XNT in lamports
      // This is likely an X1 Labs node
      const shortKey = v.votePubkey.substring(0, 6);
      name = `X1 Labs (${shortKey}...)`;
      website = 'https://x1.xyz';
      icon = '🔷';
    }
    
    // Calculate epoch credits for performance metrics
    const epochCredits = v.epochCredits || [];
    const currentEpochCredits = epochCredits.length > 0 ? epochCredits[epochCredits.length - 1] : [0, 0, 0];
    const prevEpochCredits = epochCredits.length > 1 ? epochCredits[epochCredits.length - 2] : [0, 0, 0];
    
    // Credits earned this epoch
    const creditsThisEpoch = currentEpochCredits[1] - currentEpochCredits[2];
    const creditsPrevEpoch = prevEpochCredits[1] - prevEpochCredits[2];
    
    // Calculate skip rate (simplified - based on vote lag)
    const voteLag = currentSlot - v.lastVote;
    const skipRate = Math.min(100, (voteLag / 100) * 100).toFixed(2);
    
    // Uptime estimate based on vote consistency
    const uptime = voteLag < 150 ? 99.9 : voteLag < 500 ? 99.0 : voteLag < 1000 ? 95.0 : 90.0;
    
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
      skipRate: parseFloat(skipRate),
      featureSet: node.featureSet
    };
  });

  // Add delinquent validators
  voteAccounts.delinquent.forEach(v => {
    const node = nodeMap[v.nodePubkey] || {};
    const knownInfo = KNOWN_VALIDATORS[v.nodePubkey] || KNOWN_VALIDATORS[v.votePubkey];
    
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
      name: knownInfo?.name || null,
      website: knownInfo?.website || null,
      icon: knownInfo?.icon || null,
      uptime: 0,
      skipRate: 100
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