// X1 Real-Time Price Feed Service
import X1Rpc from './X1RpcService';

const PRICE_CACHE = {
  prices: {},
  lastUpdate: 0,
  updateInterval: 60000 // 1 minute
};

// Real-time price update callback
let priceUpdateCallback = null;

// Fetch real-time prices from on-chain sources
export async function fetchRealtimePrices() {
  console.log('💰 Fetching real-time token prices...');
  
  const prices = {};
  
  try {
    // XNT is always $1.00 (OTC fixed price)
    prices['XNT'] = {
      price: 1.00,
      priceChange24h: 0,
      volume24h: await estimateVolume('XNT'),
      marketCap: 850000000,
      lastUpdate: Date.now()
    };
    
    // For other tokens, fetch from on-chain DEX pools
    // Example: Query Orca/Raydium-like X1 DEX pools
    const dexPools = await fetchDexPools();
    
    for (const [token, poolData] of Object.entries(dexPools)) {
      prices[token] = {
        price: poolData.price,
        priceChange24h: poolData.priceChange24h,
        volume24h: poolData.volume24h,
        marketCap: poolData.marketCap,
        lastUpdate: Date.now()
      };
    }
    
    PRICE_CACHE.prices = prices;
    PRICE_CACHE.lastUpdate = Date.now();
    
    // Trigger callback if set
    if (priceUpdateCallback) {
      priceUpdateCallback(prices);
    }
    
    console.log(`✓ Updated prices for ${Object.keys(prices).length} tokens`);
    return prices;
    
  } catch (err) {
    console.error('Price fetch failed:', err);
    return PRICE_CACHE.prices;
  }
}

// Fetch DEX pool data for price discovery
async function fetchDexPools() {
  try {
    // Query X1 DEX programs for pool accounts
    // This is a placeholder - actual implementation depends on X1 DEX protocol
    
    // For now, simulate fetching from a hypothetical X1 DEX aggregator
    const response = await fetch('https://api.x1dex.io/v1/prices', {
      signal: AbortSignal.timeout(5000)
    }).catch(() => null);
    
    if (response?.ok) {
      const data = await response.json();
      return data.pools || {};
    }
    
    // Fallback: Query on-chain pools directly
    const pools = await queryOnChainPools();
    return pools;
    
  } catch (e) {
    console.warn('DEX pool fetch failed:', e.message);
    return {};
  }
}

// Query on-chain liquidity pools
async function queryOnChainPools() {
  const pools = {};
  
  try {
    // Example: Query Serum-like DEX program for markets
    // Adjust program ID based on actual X1 DEX
    const markets = await X1Rpc.rpcCall('getProgramAccounts', [
      '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin', // Example DEX program
      {
        encoding: 'jsonParsed',
        filters: []
      }
    ]).catch(() => []);
    
    // Parse market data to extract prices
    for (const market of markets) {
      // Parse pool reserves and calculate price
      // This is simplified - actual parsing depends on DEX format
    }
    
  } catch (e) {
    console.warn('On-chain pool query failed:', e);
  }
  
  return pools;
}

// Estimate 24h volume from recent transactions
async function estimateVolume(token) {
  try {
    // Query recent transactions for this token
    const recentTxs = await X1Rpc.getRecentTransactions(100);
    
    // Filter token transfers and sum amounts
    let volume = 0;
    for (const tx of recentTxs) {
      // Parse tx for token transfers
      // Sum up transfer amounts
      volume += Math.random() * 50000; // Placeholder
    }
    
    return volume;
  } catch (e) {
    return 1000000; // Default estimate
  }
}

// Get cached prices
export function getCachedPrices() {
  return PRICE_CACHE.prices;
}

// Subscribe to price updates
export function subscribeToPriceUpdates(callback) {
  priceUpdateCallback = callback;
}

export function unsubscribeFromPriceUpdates() {
  priceUpdateCallback = null;
}

// Start live price feed
let priceFeedInterval = null;
export function startPriceFeed() {
  if (priceFeedInterval) return;
  
  console.log('🚀 Starting real-time price feed...');
  fetchRealtimePrices(); // Initial fetch
  
  priceFeedInterval = setInterval(() => {
    fetchRealtimePrices();
  }, PRICE_CACHE.updateInterval);
}

export function stopPriceFeed() {
  if (priceFeedInterval) {
    clearInterval(priceFeedInterval);
    priceFeedInterval = null;
    console.log('⏸️ Price feed stopped');
  }
}

// Get price for specific token
export function getTokenPrice(tokenMint) {
  return PRICE_CACHE.prices[tokenMint] || null;
}

// Check if prices are stale
export function arePricesStale() {
  return Date.now() - PRICE_CACHE.lastUpdate > PRICE_CACHE.updateInterval;
}