// X1 Token Registry - Curated list of verified X1 tokens

export const KNOWN_TOKENS = {
  'XNT': {
    name: 'X1 Native Token',
    symbol: 'XNT',
    logo: null,
    decimals: 9,
    verified: true,
    description: 'The native token of X1 blockchain - $1.00 OTC',
    website: 'https://x1.xyz',
    twitter: 'https://x.com/rkbehelvi'
  },
  '81LkybSBLvXYMTF6azXohUWyBvDGUXznm4yiXPkYkDTJ': {
    name: 'Wrapped SOL',
    symbol: 'WSOL',
    logo: null,
    decimals: 9,
    verified: true,
    description: 'Wrapped Solana token on X1',
    website: null,
    twitter: null
  },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    name: 'USD Coin',
    symbol: 'USDC',
    logo: null,
    decimals: 6,
    verified: true,
    description: 'USDC stablecoin',
    website: null,
    twitter: null
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    name: 'Tether USD',
    symbol: 'USDT',
    logo: null,
    decimals: 6,
    verified: true,
    description: 'USDT stablecoin',
    website: null,
    twitter: null
  }
};

export async function fetchTokenList() {
  return { ...KNOWN_TOKENS };
}

export async function fetchTokenPrices() {
  return {
    'XNT': {
      price: 1.00,
      priceChange24h: 0,
      volume24h: 12500000,
      marketCap: 1000000000
    },
    '81LkybSBLvXYMTF6azXohUWyBvDGUXznm4yiXPkYkDTJ': {
      price: 135.42,
      priceChange24h: 2.34,
      volume24h: 8750000,
      marketCap: 45000000000
    },
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
      price: 1.0,
      priceChange24h: 0.01,
      volume24h: 15600000,
      marketCap: 35000000000
    },
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
      price: 1.0,
      priceChange24h: -0.02,
      volume24h: 18200000,
      marketCap: 98000000000
    }
  };
}

const TOKEN_CACHE = {
  data: null,
  timestamp: 0,
  ttl: 600000
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