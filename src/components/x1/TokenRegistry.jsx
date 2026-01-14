// X1 Token Registry - Only XNT native token

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
      marketCap: 1000000000
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