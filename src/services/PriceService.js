// X1 Token Price Service
// Fetches prices from XDEX and X1.Ninja

const XDEX_API = 'https://api.xdex.xyz';  // Update with actual API endpoint
const X1NINJA_API = 'https://api.x1.ninja'; // Update with actual API endpoint

class PriceService {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 60000; // 1 minute
  }

  async fetchTokenPrice(mint) {
    // Check cache first
    const cached = this.cache.get(mint);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      // Try XDEX first
      const xdexPrice = await this.fetchFromXDEX(mint);
      if (xdexPrice) {
        this.cache.set(mint, { data: xdexPrice, timestamp: Date.now() });
        return xdexPrice;
      }

      // Fallback to X1.Ninja
      const ninjaPrice = await this.fetchFromX1Ninja(mint);
      if (ninjaPrice) {
        this.cache.set(mint, { data: ninjaPrice, timestamp: Date.now() });
        return ninjaPrice;
      }

      return null;
    } catch (error) {
      console.error('Failed to fetch price for', mint, error);
      return null;
    }
  }

  async fetchFromXDEX(mint) {
    try {
      // XDEX API call - adjust endpoint as needed
      const response = await fetch(`${XDEX_API}/token/${mint}/price`, {
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) return null;

      const data = await response.json();
      
      return {
        price: data.price || 0,
        priceChange24h: data.priceChange24h || 0,
        volume24h: data.volume24h || 0,
        marketCap: data.marketCap || 0,
        history: data.history || [],
        source: 'XDEX'
      };
    } catch (error) {
      console.warn('XDEX price fetch failed:', error.message);
      return null;
    }
  }

  async fetchFromX1Ninja(mint) {
    try {
      // X1.Ninja API call - adjust endpoint as needed
      const response = await fetch(`${X1NINJA_API}/screener/token/${mint}`, {
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) return null;

      const data = await response.json();
      
      return {
        price: data.price || 0,
        priceChange24h: data.change24h || 0,
        volume24h: data.volume || 0,
        marketCap: data.mcap || 0,
        history: data.priceHistory || [],
        source: 'X1.Ninja'
      };
    } catch (error) {
      console.warn('X1.Ninja price fetch failed:', error.message);
      return null;
    }
  }

  async fetchBatchPrices(mints) {
    const promises = mints.map(mint => this.fetchTokenPrice(mint));
    const results = await Promise.allSettled(promises);
    
    const priceMap = {};
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        priceMap[mints[index]] = result.value;
      }
    });
    
    return priceMap;
  }
}

export default new PriceService();
