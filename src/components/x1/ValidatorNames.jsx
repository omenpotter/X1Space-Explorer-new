// X1 Validator Names Service
// Based on actual validator data from https://explorer.mainnet.x1.xyz/validators

// Hardcoded validator names from official X1 explorer
const VALIDATOR_NAMES = {
  // X1 Labs validators (node0-node11)
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
  
  // Community validators from explorer
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

// Cache for validator names
let validatorNameCache = { ...VALIDATOR_NAMES };

// Get validator name from cache or known list
export function getValidatorName(votePubkey, nodePubkey = null, activatedStake = 0) {
  // Check hardcoded names first
  if (VALIDATOR_NAMES[votePubkey]) {
    return VALIDATOR_NAMES[votePubkey];
  }
  if (nodePubkey && VALIDATOR_NAMES[nodePubkey]) {
    return VALIDATOR_NAMES[nodePubkey];
  }
  
  // Check cache
  if (validatorNameCache[votePubkey]) {
    return validatorNameCache[votePubkey];
  }
  
  // Generate name based on stake for unknown validators
  const stakeXnt = activatedStake / 1e9;
  
  // X1 Labs validators have >50M XNT stake
  if (stakeXnt > 50000000) {
    return { name: 'X1 Labs', icon: '🔷', website: 'https://x1.xyz' };
  }
  
  // Community validators typically have 200K-300K stake
  if (stakeXnt > 200000) {
    const shortId = votePubkey.substring(0, 6);
    return { name: `Validator ${shortId}`, icon: '🔹', website: null };
  }
  
  // Smaller validators
  if (stakeXnt > 100000) {
    const shortId = votePubkey.substring(0, 6);
    return { name: `Node ${shortId}`, icon: '🔸', website: null };
  }
  
  return null;
}

// Get display name with fallback
export function getDisplayName(votePubkey, nodePubkey = null, activatedStake = 0) {
  const info = getValidatorName(votePubkey, nodePubkey, activatedStake);
  if (info?.name) return info.name;
  
  // Truncate pubkey for display
  if (votePubkey) {
    return `${votePubkey.substring(0, 8)}...${votePubkey.slice(-4)}`;
  }
  return 'Unknown';
}

// Get icon for validator
export function getValidatorIcon(votePubkey, nodePubkey = null, activatedStake = 0) {
  const info = getValidatorName(votePubkey, nodePubkey, activatedStake);
  return info?.icon || '🔹';
}

// Get website for validator
export function getValidatorWebsite(votePubkey, nodePubkey = null) {
  const info = getValidatorName(votePubkey, nodePubkey);
  return info?.website || null;
}

// Set validator name in cache
export function setValidatorName(pubkey, name, icon = null, website = null) {
  validatorNameCache[pubkey] = { name, icon, website };
}

// Clear cache
export function clearValidatorCache() {
  validatorNameCache = { ...VALIDATOR_NAMES };
}

// Enrich validator list with names
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

// Export known validators for reference
export const KNOWN_VALIDATORS = VALIDATOR_NAMES;

export default {
  getValidatorName,
  getDisplayName,
  getValidatorIcon,
  getValidatorWebsite,
  setValidatorName,
  clearValidatorCache,
  enrichValidators,
  KNOWN_VALIDATORS
};