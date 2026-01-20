// src/services/lpApi.js
// LP (Liquidity Pool) API Client for X1 Space Explorer

const LP_API_BASE = import.meta.env.VITE_LP_API_URL || 'http://localhost:3001/api/lp';

/**
 * Fetch LP statistics
 */
export const getLPStats = async () => {
  const response = await fetch(`${LP_API_BASE}/stats`);
  if (!response.ok) throw new Error('Failed to fetch LP stats');
  return response.json();
};

/**
 * Fetch all LP tokens with holder counts
 * @param {number} limit - Number of tokens to fetch (default: 100)
 */
export const getLPTokens = async (limit = 100) => {
  const response = await fetch(`${LP_API_BASE}/tokens?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch LP tokens');
  return response.json();
};

/**
 * Fetch specific LP token details with holders
 * @param {string} mint - LP token mint address
 */
export const getLPToken = async (mint) => {
  const response = await fetch(`${LP_API_BASE}/token/${mint}`);
  if (!response.ok) throw new Error('Failed to fetch LP token details');
  return response.json();
};

/**
 * Fetch top LP holders across all pools
 * @param {number} limit - Number of holders to fetch (default: 50)
 */
export const getTopLPHolders = async (limit = 50) => {
  const response = await fetch(`${LP_API_BASE}/top-holders?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch top LP holders');
  return response.json();
};

/**
 * Fetch LP positions for a specific holder
 * @param {string} address - Wallet address
 */
export const getHolderPositions = async (address) => {
  const response = await fetch(`${LP_API_BASE}/holder/${address}`);
  if (!response.ok) throw new Error('Failed to fetch holder positions');
  return response.json();
};

/**
 * Fetch LP events (add/remove liquidity)
 * @param {Object} params - Query parameters
 * @param {number} params.limit - Number of events (default: 50)
 * @param {string} params.lp_mint - Filter by LP token
 * @param {string} params.user - Filter by user address
 * @param {string} params.type - Event type: 'add_liquidity' or 'remove_liquidity'
 */
export const getLPEvents = async (params = {}) => {
  const queryParams = new URLSearchParams();
  
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.lp_mint) queryParams.append('lp_mint', params.lp_mint);
  if (params.user) queryParams.append('user', params.user);
  if (params.type) queryParams.append('type', params.type);
  
  const url = `${LP_API_BASE}/events${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch LP events');
  return response.json();
};

/**
 * Fetch events for specific LP token
 * @param {string} mint - LP token mint address
 * @param {number} limit - Number of events (default: 50)
 */
export const getLPTokenEvents = async (mint, limit = 50) => {
  const response = await fetch(`${LP_API_BASE}/events/${mint}?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch LP token events');
  return response.json();
};

/**
 * Fetch LP event statistics
 */
export const getLPEventStats = async () => {
  const response = await fetch(`${LP_API_BASE}/events/stats/summary`);
  if (!response.ok) throw new Error('Failed to fetch LP event stats');
  return response.json();
};

/**
 * Format LP amount for display
 * @param {string} amount - Raw amount string
 * @param {number} decimals - Token decimals (default: 9)
 */
export const formatLPAmount = (amount, decimals = 9) => {
  const value = Number(amount) / Math.pow(10, decimals);
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
  return value.toFixed(2);
};

/**
 * Format timestamp to readable date
 * @param {number} timestamp - Unix timestamp
 */
export const formatEventTime = (timestamp) => {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
};
