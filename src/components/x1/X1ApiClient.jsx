// X1 Blockchain Explorer API Client - Base44 Version (Real Data Only)
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
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}

// List all tokens - REAL DATA ONLY
export async function listTokens(params = {}) {
  const { limit = 100, offset = 0, verified = true } = params;
  const cacheKey = getCacheKey('tokens', params);
  const cached = getCache(cacheKey);
  if (cached) {
    console.log('📦 Using cached data');
    return cached;
  }

  try {
    const url = `${API_BASE_URL}${API_CONFIG.endpoints.tokens}?limit=${limit}&offset=${offset}&verified_only=${verified}`;
    console.log('📡 Fetching tokens from:', url);
    
    const data = await apiRequest(url);
    
    console.log('✓ Received data:', {
      success: data.success,
      tokenCount: data.tokens?.length || 0,
      total: data.total,
      verified: data.verified,
      discovered: data.discovered
    });
    
    const result = {
      success: data.success !== false,
      data: {
        tokens: data.tokens || [],
        total: data.total || 0,
        verified: data.verified || 0,
        discovered: data.discovered || 0
      }
    };
    
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('❌ Failed to fetch tokens:', error);
    
    // Return error, don't fallback to mock data
    return {
      success: false,
      error: error.message,
      data: {
        tokens: [],
        total: 0,
        verified: 0,
        discovered: 0
      }
    };
  }  // ← ADD THIS CLOSING BRACE
}    // ← ADD THIS CLOSING BRACE (closes the listTokens function)

// Search tokens - REAL DATA ONLY
export async function searchTokens(query, params = {}) {
  const { limit = 50, offset = 0 } = params;
  if (!query) return { success: false, data: { tokens: [], total: 0 } };

  try {
    const url = `${API_BASE_URL}${API_CONFIG.endpoints.search}?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;
    console.log('🔍 Searching tokens:', url);
    
    const data = await apiRequest(url);
    
    return {
      success: true,
      data: {
        tokens: data.tokens || [],
        total: data.total || 0
      }
    };
  } catch (error) {
    console.error('❌ Search failed:', error);
    return { 
      success: false, 
      error: error.message,
      data: { tokens: [], total: 0 } 
    };
  }
}

// Get token details - REAL DATA ONLY
export async function getTokenDetails(mint) {
  const cacheKey = getCacheKey(`token/${mint}`);
  const cached = getCache(cacheKey);
  if (cached) {
    console.log('📦 Using cached token details');
    return cached;
  }

  try {
    const url = `${API_BASE_URL}${API_CONFIG.endpoints.tokenDetail}?mint=${mint}`;
    console.log('📡 Fetching token details:', url);
    
    const data = await apiRequest(url);
    
    const result = {
      success: true,
      data: data.token || null
    };
    
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('❌ Failed to fetch token details:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
}

// Verify token (X1Space)
export async function verifyToken(tokenData) {
  try {
    const url = `${API_BASE_URL}/functions/verify-token`;
    console.log('✅ Verifying token:', tokenData.mint);
    
    const data = await apiRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenData)
    });
    
    return { 
      success: true, 
      data 
    };
  } catch (error) {
    console.error('❌ Token verification failed:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Get token holders
export async function getTokenHolders(mint, params = {}) {
  const { limit = 50, offset = 0 } = params;
  
  try {
    const url = `${API_BASE_URL}/functions/tokens/${mint}/holders?limit=${limit}&offset=${offset}`;
    console.log('📡 Fetching token holders:', url);
    
    const data = await apiRequest(url);
    
    return {
      success: true,
      data: {
        holders: data.holders || [],
        total: data.total || 0
      }
    };
  } catch (error) {
    console.error('❌ Failed to fetch holders:', error);
    return { 
      success: false,
      error: error.message,
      data: { holders: [], total: 0 }
    };
  }
}

// Get token transactions
export async function getTokenTransactions(mint, params = {}) {
  const { limit = 50, offset = 0 } = params;
  
  try {
    const url = `${API_BASE_URL}/functions/tokens/${mint}/transactions?limit=${limit}&offset=${offset}`;
    console.log('📡 Fetching token transactions:', url);
    
    const data = await apiRequest(url);
    
    return {
      success: true,
      data: {
        transactions: data.transactions || [],
        total: data.total || 0
      }
    };
  } catch (error) {
    console.error('❌ Failed to fetch transactions:', error);
    return { 
      success: false,
      error: error.message,
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
    const url = `${API_BASE_URL}/functions/pools?token=${mint}`;
    console.log('📡 Fetching liquidity pools:', url);
    
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
    console.error('❌ Failed to fetch pools:', error);
    return { 
      success: false,
      error: error.message,
      data: { pools: [] } 
    };
  }
}

// Get creator profile
export async function getCreatorProfile(address) {
  const cacheKey = getCacheKey(`creator/${address}`);
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE_URL}/functions/creator/${address}`;
    console.log('📡 Fetching creator profile:', url);
    
    const data = await apiRequest(url);
    
    const result = {
      success: true,
      data
    };
    
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('❌ Failed to fetch creator profile:', error);
    return { 
      success: false,
      error: error.message
    };
  }
}

// Get token price history
export async function getTokenPriceHistory(mint, params = {}) {
  const { period = '7d' } = params;
  const cacheKey = getCacheKey(`price/${mint}`, { period });
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE_URL}/functions/tokens/${mint}/price-history?period=${period}`;
    console.log('📡 Fetching price history:', url);
    
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
    console.error('❌ Failed to fetch price history:', error);
    return { 
      success: false,
      error: error.message,
      data: { history: [] } 
    };
  }
}

// WebSocket connection for real-time updates
let ws = null;
let reconnectTimer = null;
const subscribers = new Set();
let isConnecting = false;

export function subscribeToTokenUpdates(callback) {
  if (!API_CONFIG.features.websocket) {
    console.log('ℹ️ WebSocket disabled in config');
    return () => {};
  }
  
  subscribers.add(callback);
  
  if ((!ws || ws.readyState === WebSocket.CLOSED) && !isConnecting) {
    connectWebSocket();
  }
  
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && ws) {
      ws.close();
      ws = null;
    }
  };
}

function connectWebSocket() {
  if (isConnecting) return;
  
  try {
    isConnecting = true;
    console.log('🔌 Connecting WebSocket to:', WS_URL);
    
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
      console.log('✓ WebSocket connected');
      isConnecting = false;
      ws.send(JSON.stringify({
        action: 'subscribe',
        channel: 'tokens'
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        console.log('📨 WebSocket update:', update.type);
        subscribers.forEach(callback => callback(update));
      } catch (error) {
        console.error('❌ WebSocket message parse error:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      isConnecting = false;
    };
    
    ws.onclose = () => {
      console.log('🔌 WebSocket closed');
      isConnecting = false;
      ws = null;
      
      if (subscribers.size > 0) {
        reconnectTimer = setTimeout(() => {
          console.log('🔄 Attempting WebSocket reconnection...');
          connectWebSocket();
        }, 5000);
      }
    };
  } catch (error) {
    console.error('❌ WebSocket connection failed:', error);
    isConnecting = false;
  }
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
  console.log('🔌 WebSocket disconnected');
}

// Export default object with all functions
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
