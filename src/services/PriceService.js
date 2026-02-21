// X1 Token Price Service - XDEX API Integration
// All price data comes from XDEX API

const XDEX_API = 'https://api.xdex.xyz';
const NETWORK = 'X1%20Mainnet';

class PriceService {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 60000; // 1 minute cache
  }

  /**
   * Fetch price for a single token
   */
  async fetchTokenPrice(mint) {
    // Check cache first
    const cached = this.cache.get(mint);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log('📦 Using cached price for', mint.substring(0, 8));
      return cached.data;
    }

    try {
      const response = await fetch(
        `${XDEX_API}/api/token-price/price?network=${NETWORK}&address=${mint}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!response.ok) {
        console.warn(`XDEX price fetch failed for ${mint.substring(0, 8)}:`, response.status);
        return null;
      }

      const data = await response.json();
      
      if (!data.success || !data.data) {
        return null;
      }

      const priceData = {
        price: data.data.price || 0,
        priceChange24h: data.data.price_change_24h || 0,
        volume24h: data.data.volume_24h || 0,
        marketCap: data.data.market_cap || 0,
        liquidity: data.data.liquidity || 0,
        priceUsd: data.data.price_usd || data.data.price || 0,
        history: [],
        source: 'XDEX'
      };

      // Cache the result
      this.cache.set(mint, { 
        data: priceData, 
        timestamp: Date.now() 
      });

      return priceData;

    } catch (error) {
      console.error('Failed to fetch price from XDEX:', error.message);
      return null;
    }
  }

  /**
   * Fetch prices for multiple tokens in batch
   * XDEX supports batch requests for efficiency
   */
  async fetchBatchPrices(mints) {
    if (!mints || mints.length === 0) return {};

    try {
      // XDEX API supports comma-separated token addresses
      // Limit to 50 tokens per request
      const tokenAddresses = mints.slice(0, 50).join(',');
      
      console.log(`💰 Fetching batch prices for ${mints.length} tokens...`);

      const response = await fetch(
        `${XDEX_API}/api/token-price/prices?network=${NETWORK}&token_addresses=${tokenAddresses}`,
        { signal: AbortSignal.timeout(15000) }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.data) {
        console.warn('Batch price fetch returned no data');
        return {};
      }

      // Format and cache results
      const priceMap = {};
      let successCount = 0;

      Object.entries(data.data).forEach(([mint, priceInfo]) => {
        const formatted = {
          price: priceInfo.price || 0,
          priceChange24h: priceInfo.price_change_24h || 0,
          volume24h: priceInfo.volume_24h || 0,
          marketCap: priceInfo.market_cap || 0,
          liquidity: priceInfo.liquidity || 0,
          priceUsd: priceInfo.price_usd || priceInfo.price || 0,
          source: 'XDEX'
        };
        
        priceMap[mint] = formatted;
        
        // Cache individual price
        this.cache.set(mint, { 
          data: formatted, 
          timestamp: Date.now() 
        });
        
        successCount++;
      });

      console.log(`✓ Fetched prices for ${successCount}/${mints.length} tokens`);

      return priceMap;

    } catch (error) {
      console.error('Batch price fetch failed:', error.message);
      return {};
    }
  }

  /**
   * Fetch price history for charts
   */
  async fetchPriceHistory(mint, days = 7) {
    try {
      console.log(`📊 Fetching ${days}d price history for`, mint.substring(0, 8));

      const response = await fetch(
        `${XDEX_API}/api/xendex/chart/history?network=${NETWORK}&token=${mint}&days=${days}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!response.ok) {
        console.warn('Price history not available');
        return [];
      }

      const data = await response.json();
      
      if (!data.success || !data.data) {
        return [];
      }

      // Format history data for charts
      return data.data.map(point => ({
        timestamp: point.timestamp || point.time,
        price: point.price || 0,
        volume: point.volume || 0
      }));

    } catch (error) {
      console.warn('Price history fetch failed:', error.message);
      return [];
    }
  }

  /**
   * Clear cache (useful for manual refresh)
   */
  clearCache() {
    this.cache.clear();
    console.log('🧹 Price cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      ttl: this.CACHE_TTL,
      entries: Array.from(this.cache.keys()).map(k => ({
        mint: k.substring(0, 8) + '...',
        age: Date.now() - this.cache.get(k).timestamp
      }))
    };
  }
}

// Export singleton instance
export default new PriceService();
