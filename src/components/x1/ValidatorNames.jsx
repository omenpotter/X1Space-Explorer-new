// X1 Validator Names Service
// Fetches validator identity from on-chain config accounts dynamically

// Cache for fetched validator identities
let identityCache = {};
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// RPC endpoint
const RPC_URL = 'https://rpc.mainnet.x1.xyz';

// Fetch validator identity from on-chain config account
export async function fetchValidatorIdentity(votePubkey) {
  // Check cache
  if (identityCache[votePubkey] && Date.now() - lastFetchTime < CACHE_DURATION) {
    return identityCache[votePubkey];
  }
  
  try {
    // Try to get validator info from config program
    // Validator identities are stored in the ValidatorInfo program
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getProgramAccounts',
        params: [
          'Config1111111111111111111111111111111111111',
          {
            encoding: 'jsonParsed',
            filters: [
              { dataSize: 643 } // Validator info account size
            ]
          }
        ]
      })
    });
    
    const data = await response.json();
    if (data.result) {
      // Parse all validator info accounts
      for (const account of data.result) {
        try {
          const parsed = account.account?.data?.parsed;
          if (parsed?.info?.keys) {
            const keys = parsed.info.keys;
            const validatorPubkey = keys[1]?.pubkey;
            const configData = parsed.info.configData;
            
            if (configData?.name) {
              identityCache[validatorPubkey] = {
                name: configData.name,
                website: configData.website || null,
                icon: '🔹'
              };
            }
          }
        } catch (e) {
          continue;
        }
      }
      lastFetchTime = Date.now();
    }
  } catch (e) {
    console.error('Failed to fetch validator identities:', e);
  }
  
  return identityCache[votePubkey] || null;
}

// Hardcoded fallbacks based on known X1 validators from explorer
const KNOWN_VALIDATORS = {
  // X1 Labs validators
  'Gv5kyHCneaRKNJPgyPreoiYnBVBm2XYqt981zYykcSSU': { name: 'X1 Labs: (node9)', icon: '🔷', website: 'https://x1.xyz' },
  '8gv2Vx7Go1hUAD2TQx2HEwn8JEb9FqtguutTMQ43wT2o': { name: 'X1 Labs: (node5)', icon: '🔷', website: 'https://x1.xyz' },
  '8LWKkcxFz4kWWExAVLfUAFLvoKVrWnqRawH1T7gHHeNg': { name: 'X1 Labs: (node8)', icon: '🔷', website: 'https://x1.xyz' },
  '4V2QkkWce8bwTzvvwPiNRNQ4W433ZsGQi9aWU12Q8uBF': { name: 'X1 Labs: (node2)', icon: '🔷', website: 'https://x1.xyz' },
  'CkMwg4TM6jaSC5rJALQjvLc51XFY5pJ1H9f1Tmu5Qdxs': { name: 'X1 Labs: (node3)', icon: '🔷', website: 'https://x1.xyz' },
  '7J5wJaH55ZYjCCmCMt7Gb3QL6FGFmjz5U8b6NcbzfoTy': { name: 'X1 Labs: (node4)', icon: '🔷', website: 'https://x1.xyz' },
  '5Rzytnub9yGTFHqSmauFLsAbdXFbehMwPBLiuEgKajUN': { name: 'X1 Labs: (node1)', icon: '🔷', website: 'https://x1.xyz' },
  '73RKDYK431DFw3bJXBN9ztk5UbdkWYyWCTTm7JLM7YUr': { name: 'X1 Labs: (node6)', icon: '🔷', website: 'https://x1.xyz' },
  '7ufaUVtQKzGu5tpFtii9Cg8kR4jcpjQSXwsF3oVPSMZA': { name: 'X1 Labs: (node0)', icon: '🔷', website: 'https://x1.xyz' },
  'B9xaPxcm3qKe15EiK4j6Am5eGp3Mxkzaci6Ywbs4it7Q': { name: 'X1 Labs: (node11)', icon: '🔷', website: 'https://x1.xyz' },
  'EXDQt1T1eQ4NjttSdxn1eNS3EkHDrmZ3ZrgZmMSbfYiy': { name: 'X1 Labs: (node10)', icon: '🔷', website: 'https://x1.xyz' },
  '4Y9fnKcTJ3Kxj6744HZX8ubd89DPKibyKckGnPWGkfU3': { name: 'X1 Labs: (node7)', icon: '🔷', website: 'https://x1.xyz' },
  
  // Community validators
  '4B71UaqycZcA5yEBhGtESLzBwxsvVAYW4gL52jPNBH6c': { name: "Tang's X1 node", icon: '🌟', website: 'https://x.com/tangyujie2002' },
  '9Vhw2cWoHvustkMgj7jWTktduKXgFGZ5TSfoDeh6fig9': { name: 'xen_artist', icon: '🎨', website: 'https://x1.wiki' },
  'FTPty3gAuWC6akZVtMAGmaaE4neChW7dhTUJBnmrq6A4': { name: 'Evmoon', icon: '🌙', website: 'https://x.com/Evmoon_EVM' },
  'GA32o6A25KCGk2LpuvHomUevHX4yfNWXPzf67PfFtSPt': { name: 'MEMO', icon: '📝', website: 'https://memo.rip' },
  '9fkZtALVvBcUfY6ed6U16VXoYrcDyzij31yawXMW4WnG': { name: 'doge', icon: '🐕', website: null },
  'C9vopxShhVpf3PdsS11kABAKHRkVMavVnjgEd7rxSqCb': { name: 'cypax2', icon: '🔹', website: null },
  '2sUYt9TgC2GT48eLbL3w5dpFJNxZtN3kKc9KWX267GPh': { name: 'Marask X1 Legion', icon: '⚔️', website: 'https://x.com/marek_kogut' },
  '7JJBWFY2vkvu3yv7XZdZMv2QVtxiSng2ozJZTFRLJfby': { name: 'iBand_Africa_2', icon: '🌍', website: null },
  'puHudX7M8twvJ37dkKbn4wwPPUXbQMJC27RnGzp9U9F': { name: 'iBand_Africa_3', icon: '🌍', website: null },
  'FBJ6MvuuRFrN3V4DPqfKE8yrQE95PZydcD99mZdhRipg': { name: 'X1 LFC', icon: '⚽', website: 'https://x.com/X1_lfc' },
  '2MGKPVFxVhKUC6vjLXhtu9iDktBjkihVJGwZfS4mTUqk': { name: 'Dantey', icon: '🎭', website: 'https://x.com/marcinogebala' },
  'gMUQXTPSzjqniZQAeJwGKQxYhXHtdjPkqF5wBpheFSa': { name: 'X1 Sheikh', icon: '👑', website: 'https://x.com/KGNloverr' },
  '4yyo9aRZsNnbN7EUTzRrirRYqd2C1YJkkKj6bYbSHZPE': { name: 'XEN.PUB #1', icon: '🔥', website: 'https://xen.pub' },
  'A8k84GEGB8tmUfNsfgYg8KVxpZFeiBV5zFm68onkwbmo': { name: "Miq Leo's", icon: '🦁', website: 'https://x1val.online' },
  '2ErUnfWf29PYctJWE5gLQ5xE7TbGUZ1aRC89L3jbTbTA': { name: 'Fortiblox', icon: '🏰', website: 'https://fortiblox.com' },
  '5NfpgFCwrYzcgJkda9bRJvccycLUo3dvVQsVAK2W43Um': { name: 'OWL', icon: '🦉', website: 'https://owlnet.dev' },
  '3bNyAH8xChvnprPkfSbYYXK68HteY4CPbN5iZdMxKAL3': { name: 'Rolex23.x1.1', icon: '⌚', website: null },
};

// Get validator name - check cache, then known list, then generate from stake
export function getValidatorName(votePubkey, nodePubkey = null, activatedStake = 0) {
  // Check dynamically fetched identities first
  if (identityCache[votePubkey]) {
    return identityCache[votePubkey];
  }
  
  // Check hardcoded known validators
  if (KNOWN_VALIDATORS[votePubkey]) {
    return KNOWN_VALIDATORS[votePubkey];
  }
  if (nodePubkey && KNOWN_VALIDATORS[nodePubkey]) {
    return KNOWN_VALIDATORS[nodePubkey];
  }
  
  // Generate name based on stake tier
  const stakeXnt = activatedStake / 1e9;
  const shortId = votePubkey.substring(0, 6);
  
  if (stakeXnt > 50000000) {
    return { name: 'X1 Labs', icon: '🔷', website: 'https://x1.xyz' };
  }
  if (stakeXnt > 200000) {
    return { name: `Validator ${shortId}`, icon: '🔹', website: null };
  }
  if (stakeXnt > 100000) {
    return { name: `Node ${shortId}`, icon: '🔸', website: null };
  }
  
  return { name: `${shortId}...${votePubkey.slice(-4)}`, icon: '⚪', website: null };
}

// Get display name
export function getDisplayName(votePubkey, nodePubkey = null, activatedStake = 0) {
  const info = getValidatorName(votePubkey, nodePubkey, activatedStake);
  return info?.name || `${votePubkey.substring(0, 8)}...${votePubkey.slice(-4)}`;
}

// Get icon
export function getValidatorIcon(votePubkey, nodePubkey = null, activatedStake = 0) {
  const info = getValidatorName(votePubkey, nodePubkey, activatedStake);
  return info?.icon || '🔹';
}

// Get website
export function getValidatorWebsite(votePubkey, nodePubkey = null) {
  const info = getValidatorName(votePubkey, nodePubkey);
  return info?.website || null;
}

// Enrich validators with names
export function enrichValidators(validators) {
  return validators.map(v => {
    const stakeRaw = typeof v.activatedStake === 'number' ? v.activatedStake : 0;
    const info = getValidatorName(v.votePubkey, v.nodePubkey, stakeRaw);
    return {
      ...v,
      name: v.name || info?.name || getDisplayName(v.votePubkey, v.nodePubkey, stakeRaw),
      icon: v.icon || info?.icon || '🔹',
      website: v.website || info?.website || null
    };
  });
}

// Export
export const KNOWN_VALIDATORS_LIST = KNOWN_VALIDATORS;

export default {
  fetchValidatorIdentity,
  getValidatorName,
  getDisplayName,
  getValidatorIcon,
  getValidatorWebsite,
  enrichValidators,
  KNOWN_VALIDATORS: KNOWN_VALIDATORS_LIST
};