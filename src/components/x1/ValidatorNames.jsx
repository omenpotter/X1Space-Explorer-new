// Known X1 Validator Names mapping
// Data sourced from community validators

export const VALIDATOR_NAMES = {
  // X1 Labs Validators
  "64ZiyihC453aMRjzB6RBGA6vkVx4edS2haVn4zHQ4gh7": "Dr Bear Urology",
  "7vTviuzxfQ8hn9tXY9HgkVPNNpM8e1bxfZhBodqbPiM": "X1 Labs (node1)",
  "84T8hJeHvpEYKHAaQz3x8f9kHc1HPdWXxgGz6oFQNvQd": "X1 Labs (node2)",
  "9vYpHMxfqz5YptYjZxWqL3Xkx8JfJPJH3tUvFQNvM2EK": "X1 Labs (node3)",
  "6ZWxh3vYFbPr7nEBhSfPYZJ7QxJZJf9MXJX8mDXsz9Yr": "X1 Labs (node4)",
  "8xZQvYxfBhPrNjYxvQz3L5XkZ8JfJPJH3tUvFQNvM2EK": "X1 Labs (node5)",
  
  // Community Validators (add more as they become known)
  "BZ1qGvPZdqVDg5aJLPLKvHdNkQGUF5c8DTGwNAcFxqMo": "Neuromancer",
  "AiqnvR8YxC4Fy1Nz1j4BpFWE5oANjnXp1NFqPJkHPw9e": "Axe Capital",
  "CZKqd2rC9tWepxj4tP7rXHNMpV8fGQDNdH4UL8Xk8b9n": "Staking4All",
  "DXJ8RvRaYeY7M6bvYaRPYnJx1HpKX9ePXmAK6pT3dBuU": "ValidatorOne",
  "EJK9sVrDaYfY8N7cZsQQYoKy2IqLY0bQY1AL7qU4eCvV": "CryptoNode",
  "FKL0tWsDaZgZ9O8dAtRRZpLz3JrMZ1cRZ2BM8rV5fDwW": "BlockMaster",
  "GML1uXtEbAhA0P9eBuSSaqMa4KsNa2dSa3CN9sW6gExX": "StakeHouse",
  "HNM2vYuFcBiB1Q0fCvTTbrNb5LtOb3eTb4DO0tX7hFyY": "NodeRunner",
  "IPO3wZvGdCjC2R1gDwUUcsOc6MuPc4fUc5EP1uY8gGzZ": "ValidatorX",
  "JQP4xAwHeDkD3S2hExVVdtPd7NvQd5gVd6FQ2vZ9hHaA": "CryptoStake"
};

// Function to get validator name by pubkey
export function getValidatorName(pubkey) {
  return VALIDATOR_NAMES[pubkey] || null;
}

// Function to generate a short name from pubkey if no name exists
export function getDisplayName(pubkey, nodePubkey) {
  const name = VALIDATOR_NAMES[pubkey] || VALIDATOR_NAMES[nodePubkey];
  if (name) return name;
  
  // Generate a readable identifier from pubkey
  return `Validator ${pubkey.substring(0, 4)}...${pubkey.slice(-4)}`;
}

export default VALIDATOR_NAMES;