// X1 Blockchain Explorer API Client - Base44 Version (Real Data Only)

const API_CONFIG = {
  baseURL: 'http://localhost:3001',
  wsURL: 'ws://localhost:3001',
  timeout: 15000,
  cache: {
    enabled: true,
    ttl: 30000
  },
  endpoints: {
    tokens: '/api/tokens',
    tokenDetail: '/api/tokens/detail',
    search: '/api/tokens/search',
    pools: '/api/pools',
    health: '/health'
  },
  features: {
    websocket: false
  }
};

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
    const response = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) return await response.json();
    return { status: 'offline' };
  } catch (error) {
    return { status: 'offline' };
  }
}

// Generic API request handler with retry
async function apiRequest(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}

// List all tokens
export async function listTokens(params = {}) {
  const { limit = 100, offset = 0, verified = true } = params;
  const cacheKey = getCacheKey('tokens', params);
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE_URL}${API_CONFIG.endpoints.tokens}?limit=${limit}&offset=${offset}&verified_only=${verified}`;
    const data = await apiRequest(url);
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
    return { success: false, error: error.message, data: { tokens: [], total: 0, verified: 0, discovered: 0 } };
  }
}

// Search tokens
export async function searchTokens(query, params = {}) {
  const { limit = 50, offset = 0 } = params;
  if (!query) return { success: false, data: { tokens: [], total: 0 } };

  try {
    const url = `${API_BASE_URL}${API_CONFIG.endpoints.search}?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`;
    const data = await apiRequest(url);
    return { success: true, data: { tokens: data.tokens || [], total: data.total || 0 } };
  } catch (error) {
    return { success: false, error: error.message, data: { tokens: [], total: 0 } };
  }
}

// Get token details
export async function getTokenDetails(mint) {
  const cacheKey = getCacheKey(`token/${mint}`);
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE_URL}${API_CONFIG.endpoints.tokenDetail}?mint=${mint}`;
    const data = await apiRequest(url);
    const result = { success: true, data: data.token || null };
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    return { success: false, error: error.message, data: null };
  }
}

// Verify token
export async function verifyToken(tokenData) {
  try {
    const url = `${API_BASE_URL}/functions/verify-token`;
    const data = await apiRequest(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tokenData) });
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get token holders
export async function getTokenHolders(mint, params = {}) {
  const { limit = 50, offset = 0 } = params;
  try {
    const url = `${API_BASE_URL}/functions/tokens/${mint}/holders?limit=${limit}&offset=${offset}`;
    const data = await apiRequest(url);
    return { success: true, data: { holders: data.holders || [], total: data.total || 0 } };
  } catch (error) {
    return { success: false, error: error.message, data: { holders: [], total: 0 } };
  }
}

// Get token transactions
export async function getTokenTransactions(mint, params = {}) {
  const { limit = 50, offset = 0 } = params;
  try {
    const url = `${API_BASE_URL}/functions/tokens/${mint}/transactions?limit=${limit}&offset=${offset}`;
    const data = await apiRequest(url);
    return { success: true, data: { transactions: data.transactions || [], total: data.total || 0 } };
  } catch (error) {
    return { success: false, error: error.message, data: { transactions: [], total: 0 } };
  }
}

// Get liquidity pools
export async function getLiquidityPools(mint) {
  const cacheKey = getCacheKey(`pools/${mint}`);
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE_URL}/functions/pools?token=${mint}`;
    const data = await apiRequest(url);
    const result = { success: true, data: { pools: data.pools || [] } };
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    return { success: false, error: error.message, data: { pools: [] } };
  }
}

// Get creator profile
export async function getCreatorProfile(address) {
  const cacheKey = getCacheKey(`creator/${address}`);
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const url = `${API_BASE_URL}/functions/creator/${address}`;
    const data = await apiRequest(url);
    const result = { success: true, data };
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
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
    const data = await apiRequest(url);
    const result = { success: true, data: { history: data.history || [] } };
    setCache(cacheKey, result);
    return result;
  } catch (error) {
    return { success: false, error: error.message, data: { history: [] } };
  }
}

// WebSocket
let ws = null;
let reconnectTimer = null;
const subscribers = new Set();
let isConnecting = false;

export function subscribeToTokenUpdates(callback) {
  if (!API_CONFIG.features.websocket) return () => {};
  subscribers.add(callback);
  if ((!ws || ws.readyState === WebSocket.CLOSED) && !isConnecting) connectWebSocket();
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && ws) { ws.close(); ws = null; }
  };
}

function connectWebSocket() {
  if (isConnecting) return;
  try {
    isConnecting = true;
    ws = new WebSocket(WS_URL);
    ws.onopen = () => { isConnecting = false; ws.send(JSON.stringify({ action: 'subscribe', channel: 'tokens' })); };
    ws.onmessage = (event) => { try { const update = JSON.parse(event.data); subscribers.forEach(cb => cb(update)); } catch (e) {} };
    ws.onerror = () => { isConnecting = false; };
    ws.onclose = () => { isConnecting = false; ws = null; if (subscribers.size > 0) { reconnectTimer = setTimeout(connectWebSocket, 5000); } };
  } catch (error) { isConnecting = false; }
}

export function disconnectWebSocket() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { ws.close(); ws = null; }
  subscribers.clear();
}

export default {
  checkHealth, listTokens, searchTokens, getTokenDetails, verifyToken,
  getLiquidityPools, getCreatorProfile, getTokenHolders, getTokenTransactions,
  getTokenPriceHistory, subscribeToTokenUpdates, disconnectWebSocket
};