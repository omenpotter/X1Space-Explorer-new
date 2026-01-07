// X1 Token Registry - Curated list of verified tokens
// Add new tokens here as they launch on X1

export const KNOWN_TOKENS = {
  // XNT - Native token
  'So11111111111111111111111111111111111111112': {
    name: 'X1 Native Token',
    symbol: 'XNT',
    logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    decimals: 9,
    verified: true,
    description: 'The native token of X1 blockchain',
    website: 'https://x1.xyz',
    twitter: 'https://x.com/rkbehelvi'
  },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    name: 'USD Coin',
    symbol: 'USDC',
    logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    decimals: 6,
    verified: true
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    name: 'Tether USD',
    symbol: 'USDT',
    logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
    decimals: 6,
    verified: true
  },
  '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': {
    name: 'Wrapped Ethereum',
    symbol: 'WETH',
    logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs/logo.png',
    decimals: 8,
    verified: true
  },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {
    name: 'Bonk',
    symbol: 'BONK',
    logo: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
    decimals: 5,
    verified: true
  },
  'iotEVVZLEywoTn1QdwNPddxPWszn3zFhEot3MfL9fns': {
    name: 'Helium IOT',
    symbol: 'IOT',
    logo: 'https://shdw-drive.genesysgo.net/CsDkETHRRR1EcueeN346MJoqzymkkr7RFjMqGpZMzAib/iot.png',
    decimals: 6,
    verified: true
  },
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': {
    name: 'Pyth Network',
    symbol: 'PYTH',
    logo: 'https://pyth.network/token.svg',
    decimals: 6,
    verified: true
  },
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': {
    name: 'Jupiter',
    symbol: 'JUP',
    logo: 'https://static.jup.ag/jup/icon.png',
    decimals: 6,
    verified: true
  }
};

// Fetch token list - returns known tokens immediately
export async function fetchTokenList() {
  return { ...KNOWN_TOKENS };
}

// Fetch token prices - demo data for fast loading
export async function fetchTokenPrices(mints) {
  return {
    'So11111111111111111111111111111111111111112': {
      price: 1.00,
      priceChange24h: 0,
      volume24h: 1000000,
      marketCap: 850000000
    },
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
      price: 1.00,
      priceChange24h: 0.02,
      volume24h: 5000000,
      marketCap: 2000000000
    },
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
      price: 1.00,
      priceChange24h: -0.01,
      volume24h: 4800000,
      marketCap: 1900000000
    },
    '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs': {
      price: 2450.50,
      priceChange24h: 3.5,
      volume24h: 8500000,
      marketCap: 295000000000
    },
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {
      price: 0.000025,
      priceChange24h: 12.8,
      volume24h: 2500000,
      marketCap: 180000000
    },
    'iotEVVZLEywoTn1QdwNPddxPWszn3zFhEot3MfL9fns': {
      price: 0.85,
      priceChange24h: -2.1,
      volume24h: 350000,
      marketCap: 42000000
    },
    'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': {
      price: 0.45,
      priceChange24h: 5.3,
      volume24h: 1200000,
      marketCap: 180000000
    },
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': {
      price: 0.92,
      priceChange24h: 7.2,
      volume24h: 3200000,
      marketCap: 920000000
    }
  };
}

// Cache for token data
const TOKEN_CACHE = {
  data: null,
  timestamp: 0,
  ttl: 600000 // 10 minutes - longer cache for faster loads
};

export function getCachedTokens() {
  if (TOKEN_CACHE.data && Date.now() - TOKEN_CACHE.timestamp < TOKEN_CACHE.ttl) {
    return TOKEN_CACHE.data;
  }
  return null;
}

export function setCachedTokens(data) {
  TOKEN_CACHE.data = data;
  TOKEN_CACHE.timestamp = Date.now();
}