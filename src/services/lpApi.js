// src/services/lpApi.js
// Frontend API client - calls Base44 backend functions (NOT direct XDEX)

import API_CONFIG from '@/config/api.config';

const API_BASE_URL = API_CONFIG.baseURL;

/**
 * Get LP statistics from backend
 */
export const getLPStats = async () => {
  try {
    console.log('📊 Fetching LP stats from backend...');
    
    const res = await fetch(`${API_BASE_URL}/functions/getLPStats`, {
      signal: AbortSignal.timeout(15000)
    });
    
    if (!res.ok) {
      throw new Error(`Backend error: ${res.status}`);
    }

    const data = await res.json();
    
    console.log('✅ Stats loaded:', data);
    
    return data;
  } catch (err) {
    console.error('❌ getLPStats error:', err);
    return { 
      success: true,
      stats: { 
        total_pools: 0, 
        total_holders: 0, 
        total_lp_supply: '0' 
      } 
    };
  }
};

/**
 * Get LP tokens from backend
 */
export const getLPTokens = async (limit = 500) => {
  try {
    console.log(`📊 Fetching ${limit} pools from backend...`);
    
    const res = await fetch(`${API_BASE_URL}/functions/getLPTokens?limit=${limit}`, {
      signal: AbortSignal.timeout(15000)
    });
    
    if (!res.ok) {
      throw new Error(`Backend error: ${res.status}`);
    }

    const data = await res.json();
    
    console.log('✅ Pools loaded:', data.tokens?.length || 0);
    console.log('Sample pool:', data.tokens?.[0]);
    
    return { 
      success: true,
      tokens: data.tokens || [] 
    };
  } catch (err) {
    console.error('❌ getLPTokens error:', err);
    return { 
      success: true,
      tokens: [] 
    };
  }
};

/**
 * Stubs for features not supported
 */
export const getTopLPHolders = async () => ({ 
  success: true,
  holders: [] 
});

export const getLPEvents = async () => ({ 
  success: true,
  events: [] 
});

export const getLPEventStats = async () => ({
  success: true,
  stats: { 
    total_events: 0, 
    add_count: 0, 
    remove_count: 0 
  }
});

/**
 * Format LP amount - handles hex lpSupply from XDEX
 */
export const formatLPAmount = (rawAmount, decimals = 9) => {
  if (!rawAmount || rawAmount === '0' || rawAmount === '0x0') return '0';

  try {
    // Handle hex format
    let hexStr = rawAmount.toString();
    if (!hexStr.startsWith('0x')) {
      hexStr = '0x' + hexStr;
    }
    
    let amount = BigInt(hexStr);
    const divisor = BigInt(10) ** BigInt(decimals);
    const integerPart = amount / divisor;
    let fractionalPart = amount % divisor;

    let fracStr = '';
    if (fractionalPart > 0n) {
      fracStr = fractionalPart.toString().padStart(Number(decimals), '0').replace(/0+$/, '');
    }

    let value = integerPart.toString();
    if (fracStr) value += '.' + fracStr;

    const num = Number(value);
    if (isNaN(num)) return '0';

    // Format large numbers
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch (e) {
    console.warn('formatLPAmount error:', e);
    return '0';
  }
};

/**
 * Format event timestamp
 */
export const formatEventTime = (timestamp) => {
  if (!timestamp) return '—';
  
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
    return date.toLocaleDateString();
  } catch (e) {
    return '—';
  }
};
