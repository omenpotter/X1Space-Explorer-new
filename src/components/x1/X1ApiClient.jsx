// X1 Blockchain Explorer API Client
// Base URL: http://45.94.81.202:3001
// WebSocket: ws://45.94.81.202:3001

const API_BASE_URL = 'http://45.94.81.202:3001';
const WS_URL = 'ws://45.94.81.202:3001';

// Cache for API responses
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

function getCacheKey(endpoint, params) {
  return `${endpoint}:${JSON.stringify(params || {})}`;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

function getCache(key) {
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
    const response = await fetch(`${API_BASE_URL}/health`);
    return await response.json();
  } catch (error) {
    console.error('Health check failed:', error);
    return { status: 'offline' };
  }
}

// List all tokens
export async function listTokens(params = {}) {
  const { limit = 100, offset = 0, verified = true } = params;
  const cacheKey = getCacheKey('tokens', params);
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/tokens?limit=${limit}&offset=${offset}&verified=${verified}`
    );
    const data = await response.json();
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('List tokens failed:', error);
    return { success: false, data: { tokens: [], total: 0 } };
  }
}

// Search tokens
export async function searchTokens(query, params = {}) {
  const { limit = 50, offset = 0 } = params;
  if (!query) return { success: false, data: { tokens: [], total: 0 } };

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/tokens/search?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`
    );
    return await response.json();
  } catch (error) {
    console.error('Search tokens failed:', error);
    return { success: false, data: { tokens: [], total: 0 } };
  }
}

// Get token details
export async function getTokenDetails(mint) {
  const cacheKey = getCacheKey(`token/${mint}`);
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${API_BASE_URL}/api/tokens/${mint}`);
    const data = await response.json();
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Get token details failed:', error);
    return { success: false };
  }
}

// Verify token (X1Space)
export async function verifyToken(tokenData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenData)
    });
    return await response.json();
  } catch (error) {
    console.error('Verify token failed:', error);
    return { success: false };
  }
}

// Get liquidity pools for a token
export async function getLiquidityPools(mint) {
  const cacheKey = getCacheKey(`pools/${mint}`);
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${API_BASE_URL}/api/pools?token=${mint}`);
    const data = await response.json();
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Get liquidity pools failed:', error);
    return { success: false, data: { pools: [] } };
  }
}

// Get creator/deployer profile
export async function getCreatorProfile(address) {
  const cacheKey = getCacheKey(`creator/${address}`);
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(`${API_BASE_URL}/api/creator/${address}`);
    const data = await response.json();
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Get creator profile failed:', error);
    return { success: false };
  }
}

// Get token holders
export async function getTokenHolders(mint, params = {}) {
  const { limit = 50, offset = 0 } = params;
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/tokens/${mint}/holders?limit=${limit}&offset=${offset}`
    );
    return await response.json();
  } catch (error) {
    console.error('Get token holders failed:', error);
    return { success: false, data: { holders: [], total: 0 } };
  }
}

// Get token transactions
export async function getTokenTransactions(mint, params = {}) {
  const { limit = 50, offset = 0 } = params;
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/tokens/${mint}/transactions?limit=${limit}&offset=${offset}`
    );
    return await response.json();
  } catch (error) {
    console.error('Get token transactions failed:', error);
    return { success: false, data: { transactions: [], total: 0 } };
  }
}

// Get token price history
export async function getTokenPriceHistory(mint, params = {}) {
  const { period = '7d' } = params;
  const cacheKey = getCacheKey(`price/${mint}`, { period });
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/tokens/${mint}/price-history?period=${period}`
    );
    const data = await response.json();
    setCache(cacheKey, data);
    return data;
  } catch (error) {
    console.error('Get price history failed:', error);
    return { success: false, data: { history: [] } };
  }
}

// WebSocket connection for real-time updates
let ws = null;
let reconnectTimer = null;
const subscribers = new Set();
let isConnecting = false;

export function subscribeToTokenUpdates(callback) {
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
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
      console.log('✓ WebSocket connected to X1 API');
      isConnecting = false;
      ws.send(JSON.stringify({
        action: 'subscribe',
        channel: 'tokens'
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data);
        subscribers.forEach(callback => callback(update));
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      isConnecting = false;
    };
    
    ws.onclose = () => {
      console.log('WebSocket closed');
      isConnecting = false;
      if (subscribers.size > 0) {
        reconnectTimer = setTimeout(() => {
          console.log('Attempting WebSocket reconnection...');
          connectWebSocket();
        }, 5000);
      }
    };
  } catch (error) {
    console.error('WebSocket connection failed:', error);
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