// X1 Token Registry - Curated list of verified X1 tokens
// Add new tokens here as they launch on X1 blockchain

export const KNOWN_TOKENS = {
  // XNT - X1 Native token (the only token currently on X1)
  'XNT': {
    name: 'X1 Native Token',
    symbol: 'XNT',
    logo: null,
    decimals: 9,
    verified: true,
    description: 'The native token of X1 blockchain - $1.00 OTC',
    website: 'https://x1.xyz',
    twitter: 'https://x.com/rkbehelvi'
  }
};

// Fetch token list - returns known tokens immediately
export async function fetchTokenList() {
  return { ...KNOWN_TOKENS };
}

// Fetch token prices for X1 tokens
export async function fetchTokenPrices(mints) {
  return {
    'XNT': {
      price: 1.00,
      priceChange24h: 0,
      volume24h: 1000000,
      marketCap: 850000000
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