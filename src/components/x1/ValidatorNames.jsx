// Known X1 Validator Names mapping
// These names are fetched/mapped from the validator identity accounts

// We'll try to fetch validator info from their identity accounts
// For now, use a static mapping of known validators

export const VALIDATOR_NAMES = {
  // X1 Labs Validators (from x1val.online)
  "Gv5k...cSSU": "X1 Labs (node9)",
  "X1La...bs01": "X1 Labs (node1)",
  "X1La...bs02": "X1 Labs (node2)",
  "X1La...bs03": "X1 Labs (node3)",
  "X1La...bs04": "X1 Labs (node4)",
  "X1La...bs05": "X1 Labs (node5)",
  
  // Community validators seen on x1val.online
  "Echo...X1n1": "Echoes X1 (node)",
  "DrBe...ar01": "Dr Bear Urology",
};

// Expanded list - will be populated dynamically
let validatorCache = {};

// Function to get validator name by pubkey
export function getValidatorName(pubkey) {
  if (!pubkey) return null;
  
  // Check cache first
  if (validatorCache[pubkey]) return validatorCache[pubkey];
  
  // Check static mapping with short key
  const shortKey = `${pubkey.substring(0, 4)}...${pubkey.slice(-4)}`;
  if (VALIDATOR_NAMES[shortKey]) return VALIDATOR_NAMES[shortKey];
  
  return null;
}

// Function to generate a display name
export function getDisplayName(votePubkey, nodePubkey) {
  // Try to find a known name
  const name = getValidatorName(votePubkey) || getValidatorName(nodePubkey);
  if (name) return name;
  
  // Generate a readable identifier from pubkey
  if (votePubkey) {
    return `${votePubkey.substring(0, 4)}...${votePubkey.slice(-4)}`;
  }
  return 'Unknown';
}

// Function to set validator name in cache (for dynamic updates)
export function setValidatorName(pubkey, name) {
  validatorCache[pubkey] = name;
}

// Clear cache
export function clearValidatorCache() {
  validatorCache = {};
}

export default {
  VALIDATOR_NAMES,
  getValidatorName,
  getDisplayName,
  setValidatorName,
  clearValidatorCache
};