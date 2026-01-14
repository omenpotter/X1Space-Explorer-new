// X1 Real-Time Price Feed Service
import X1Rpc from './X1RpcService';

const PRICE_CACHE = {
  prices: {},
  lastUpdate: 0,
  updateInterval: 60000
};

let priceUpdateCallback = null;

export async function fetchRealtimePrices() {
  console.log('💰 Fetching real-time token prices...');
  
  const prices = {};
  
  try {
    // XNT is always $1.00 (OTC fixed price)
    prices['XNT'] = {
      price: 1.00,
      priceChange24h: 0,
      marketCap: 1000000000,
      lastUpdate: Date.now()
    };
    
    PRICE_CACHE.prices = prices;
    PRICE_CACHE.lastUpdate = Date.now();
    
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

export function getCachedPrices() {
  return PRICE_CACHE.prices;
}

export function subscribeToPriceUpdates(callback) {
  priceUpdateCallback = callback;
}

export function unsubscribeFromPriceUpdates() {
  priceUpdateCallback = null;
}

let priceFeedInterval = null;
export function startPriceFeed() {
  if (priceFeedInterval) return;
  
  console.log('🚀 Starting real-time price feed...');
  fetchRealtimePrices();
  
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

export function getTokenPrice(tokenMint) {
  return PRICE_CACHE.prices[tokenMint] || null;
}

export function arePricesStale() {
  return Date.now() - PRICE_CACHE.lastUpdate > PRICE_CACHE.updateInterval;
}