// X1 Blockchain Explorer API Client - Updated Version
import API_CONFIG from '@/config/api.config';

const API_BASE_URL = API_CONFIG.baseURL;
const WS_URL = API_CONFIG.wsURL;

// Cache for API responses
const cache = new Map();
const CACHE_TTL = API_CONFIG.cache.ttl;

function getCacheKey(endpoint, params) {
  return `${endpoint}:${JSON.stringify(params || {})}`;
}

function setCache(key, data) {
  if (!API_CONFIG.cache.enabled) return;
  cache.set(key, { data, timestamp: Date.now() });
}

function getCache(key) {
  if (!API_CONFIG.cache.enabled) return null;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

// Health check
export async function checkHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${API_BASE_URL}/health`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return await response.json();
    }
    return { status: 'offline' };
  } catch (error) {
    console.error('Health check failed:', error);
    return { status: 'offline' };
  }
}

// Generic API request handler with retry
async function apiRequest(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed (attempt ${i + 1}/${retries}):`, error);
      
      if (i === retries - 1) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}

// Mock data generator
function generateMockTokens() {
  return [
    {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      name: 'USD Coin',
      symbol: 'USDC',
      logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
      decimals: 6,
      totalSupply: 1000000000000,
      tokenType: 'SPL Token',
      price: '1.0000',
      marketCap: 1000000000,
      priceChange24h: '0.01',
      verified: true,
      mintAuthority: null,
      freezeAuthority: null,
      website: 'https://www.circle.com/usdc',
      twitter: 'https://twitter.com/circle',
      createdBy: null,
      createdAt: '2021-01-01T00:00:00Z',
      verificationCount: 100,
      isScam: false,
      priceHistory: generateMockPriceHistory(1.0, 0.001)
    },
    {
      mint: 'So11111111111111111111111111111111111111112',
      name: 'Wrapped SOL',
      symbol: 'SOL',
      logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
      decimals: 9,
      totalSupply: 500000000000000000,
      tokenType: 'SPL Token',
      price: '142.5000',
      marketCap: 71250000000,
      priceChange24h: '5.23',
      verified: true,
      mintAuthority: null,
      freezeAuthority: null,
      website: 'https://solana.com',
      twitter: 'https://twitter.com/solana',
      createdBy: null,
      createdAt: '2020-03-01T00:00:00Z',
      verificationCount: 150,
      isScam: false,
      priceHistory: generateMockPriceHistory(142.5, 7.5)
    },
    {
      mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      name: 'USDT',
      symbol: 'USDT',
      logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
      decimals: 6,
      totalSupply: 800000000000,
      tokenType: 'SPL Token',
      price: '0.9998',
      marketCap: 799840000,
      priceChange24h: '-0.02',
      verified: true,
      mintAuthority: null,
      freezeAuthority: null,
      website: 'https://tether.to',
      twitter: 'https://twitter.com/tether_to',
      createdBy: null,
      createdAt: '2021-06-01T00:00:00Z',
      verificationCount: 120,
      isScam: false,
      priceHistory: generateMockPriceHistory(1.0, 0.002)
    },
    {
      mint: 'X1TokenMockAddress11111111111111111111111',
      name: 'X1 Token',
      symbol: 'X1',
      logo: null,
      decimals: 9,
      totalSupply: 1000000000000000,
      tokenType: 'Token-2022',
      price: '0.0150',
      marketCap: 15000000,
      priceChange24h: '12.50',
      verified: true,
      mintAuthority: null,
      freezeAuthority: null,
      website: 'https://x1.network',
      twitter: 'https://twitter.com/x1network',
      createdBy: 'X1 Foundation',
      createdAt: '2024-01-01T00:00:00Z',
      verificationCount: 50,
      isScam: false,
      priceHistory: generateMockPriceHistory(0.015, 0.002)
    },
    {
      mint: 'SampleToken1111111111111111111111111111',
      name: 'Sample Token',
      symbol: 'SMPL',
      logo: null,
      decimals: 6,
      totalSupply: 500000000,
      tokenType: 'SPL Token',
      price: '0.0025',
      marketCap: 1250000,
      priceChange24h: '-2.15',
      verified: true,
      mintAuthority: 'SampleMintAuth111111111111111111111111',
      freezeAuthority: null,
      website: null,
      twitter: null,
      createdBy: null,
      createdAt: '2024-06-15T00:00:00Z',
      verificationCount: 5,
      isScam: false,
      priceHistory: generateMockPriceHistory(0.0025, 0.0001)
    },
    {
      mint: 'TestToken22222222222222222222222222222',
      name: 'Test Meme Coin',
      symbol: 'MEME',
      logo: null,
      decimals: 9,
      totalSupply: 1000000000000,
      tokenType: 'Token-2022',
      price: '0.000015',
      marketCap: 15000,
      priceChange24h: '250.00',
      verified: true,
      mintAuthority: null,
      freezeAuthority: null,
      website: null,
      twitter: null,
      createdBy: null,
      createdAt: '2024-12-01T00:00:00Z',
      verificationCount: 2,
      isScam: false,
      priceHistory: generateMockPriceHistory(0.000015, 0.00001)
    }
  ];
}

function generateMockPriceHistory(basePrice, volatility) {
  const history = [];
  const now = Date.now();
  
  for (let i = 168; i >= 0; i--) {
    const timestamp = now - (i * 3600000);
    const randomChange = (Math.random() - 0.5) * 2 * volatility;
    const price = basePrice + randomChange;
    
    history.push({
      timestamp: new Date(timestamp).toISOString(),
      price: Math.max(0, price),
      volume: Math.random() * 1000000
    });
  }
  
  return history;
}

// List all tokens with fallback
export async function listTokens(params = {}) {
  const { limit = 100, offset = 0, verified = true } = params;
  const cacheKey = getCacheKey('tokens', params);
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE_URL}/api/getTokens?limit=${limit}&offset=${offset}&verified_only=${verified}`;
    const data = await apiRequest(url);
    
    const result = {
      success: true,
      data: {
        tokens: data.tokens || [],
        total: data.total || 0
      }
    };
    
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.warn('⚠️ API unavailable, using mock data');
    
    const mockTokens = generateMockTokens();
    const result = {
      success: true,
      data: {
        tokens: mockTokens.slice(offset, offset + limit),
        total: mockTokens.length
      },
      _mock: true
    };
    
    return result;
  }
}

// Search tokens
export async function searchTokens(query, params = {}) {
  const { limit = 50, offset = 0 } = params;
  if (!query) return { success: false, data: { tokens: [], total: 0 } };

  try {
    const url = `${API_BASE_URL}/api/searchTokens?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;
    const data = await apiRequest(url);
    
    return {
      success: true,
      data: {
        tokens: data.tokens || [],
        total: data.total || 0
      }
    };
  } catch (error) {
    const mockTokens = generateMockTokens();
    const filtered = mockTokens.filter(t => 
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      t.symbol.toLowerCase().includes(query.toLowerCase()) ||
      t.mint.includes(query)
    );
    
    return {
      success: true,
      data: {
        tokens: filtered.slice(offset, offset + limit),
        total: filtered.length
      },
      _mock: true
    };
  }
}

// Get token details
export async function getTokenDetails(mint) {
  const cacheKey = getCacheKey(`token/${mint}`);
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE_URL}/api/getTokenByMint?mint=${mint}`;
    const data = await apiRequest(url);
    
    const result = {
      success: true,
      data: data.token || null
    };
    
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    const mockTokens = generateMockTokens();
    const token = mockTokens.find(t => t.mint === mint);
    
    return {
      success: !!token,
      data: token || null,
      _mock: true
    };
  }
}

// Verify token
export async function verifyToken(tokenData) {
  try {
    const url = `${API_BASE_URL}/api/verify-token`;
    const data = await apiRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenData)
    });
    
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get token holders
export async function getTokenHolders(mint, params = {}) {
  const { limit = 50, offset = 0 } = params;
  
  try {
    const url = `${API_BASE_URL}/api/tokens/${mint}/holders?limit=${limit}&offset=${offset}`;
    const data = await apiRequest(url);
    
    return {
      success: true,
      data: {
        holders: data.holders || [],
        total: data.total || 0
      }
    };
  } catch (error) {
    return { 
      success: false, 
      data: { holders: [], total: 0 }
    };
  }
}

// Get token transactions
export async function getTokenTransactions(mint, params = {}) {
  const { limit = 50, offset = 0 } = params;
  
  try {
    const url = `${API_BASE_URL}/api/tokens/${mint}/transactions?limit=${limit}&offset=${offset}`;
    const data = await apiRequest(url);
    
    return {
      success: true,
      data: {
        transactions: data.transactions || [],
        total: data.total || 0
      }
    };
  } catch (error) {
    return { 
      success: false, 
      data: { transactions: [], total: 0 }
    };
  }
}

// Get liquidity pools
export async function getLiquidityPools(mint) {
  const cacheKey = getCacheKey(`pools/${mint}`);
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE_URL}/api/pools?token=${mint}`;
    const data = await apiRequest(url);
    
    const result = {
      success: true,
      data: {
        pools: data.pools || []
      }
    };
    
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    return { success: false, data: { pools: [] } };
  }
}

// Get creator profile
export async function getCreatorProfile(address) {
  const cacheKey = getCacheKey(`creator/${address}`);
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE_URL}/api/creator/${address}`;
    const data = await apiRequest(url);
    
    const result = {
      success: true,
      data
    };
    
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    return { success: false };
  }
}

// Get token price history
export async function getTokenPriceHistory(mint, params = {}) {
  const { period = '7d' } = params;
  const cacheKey = getCacheKey(`price/${mint}`, { period });
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE_URL}/api/tokens/${mint}/price-history?period=${period}`;
    const data = await apiRequest(url);
    
    const result = {
      success: true,
      data: {
        history: data.history || []
      }
    };
    
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    return { success: false, data: { history: [] } };
  }
}

// WebSocket connection (DISABLED for now)
let ws = null;
let reconnectTimer = null;
const subscribers = new Set();

export function subscribeToTokenUpdates(callback) {
  if (!API_CONFIG.features.websocket) {
    console.log('WebSocket disabled - skipping real-time updates');
    return () => {};
  }
  
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function disconnectWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  subscribers.clear();
}

export default {
  checkHealth,
  listTokens,
  searchTokens,
  getTokenDetails,
  verifyToken,
  getLiquidityPools,
  getCreatorProfile,
  getTokenHolders,
  getTokenTransactions,
  getTokenPriceHistory,
  subscribeToTokenUpdates,
  disconnectWebSocket
};
