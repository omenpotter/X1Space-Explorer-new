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
  }
};

// Fetch token list from multiple sources
export async function fetchTokenList() {
  const tokens = { ...KNOWN_TOKENS };
  
  // Try fetching from Jupiter (Solana token list)
  try {
    const res = await fetch('https://token.jup.ag/all', {
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      data.slice(0, 100).forEach(token => {
        if (!tokens[token.address]) {
          tokens[token.address] = {
            name: token.name,
            symbol: token.symbol,
            logo: token.logoURI,
            decimals: token.decimals || 9,
            verified: token.verified || false
          };
        }
      });
    }
  } catch (e) {
    console.warn('Jupiter token list failed:', e.message);
  }
  
  return tokens;
}

// Fetch token prices from CoinGecko or similar
export async function fetchTokenPrices(mints) {
  const prices = {};
  
  // XNT always $1.00 OTC
  prices['So11111111111111111111111111111111111111112'] = {
    price: 1.00,
    priceChange24h: 0,
    volume24h: 1000000,
    marketCap: 850000000
  };
  
  // Try fetching other token prices
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true', {
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      // Map Solana tokens to their prices
      // This is a placeholder - adjust for actual X1 tokens
    }
  } catch (e) {
    console.warn('Price fetch failed:', e.message);
  }
  
  return prices;
}

// Cache for token data
const TOKEN_CACHE = {
  data: null,
  timestamp: 0,
  ttl: 300000 // 5 minutes
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