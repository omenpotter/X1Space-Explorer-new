// RPC Response Cache for performance optimization
// Using WeakMap-like pattern with Map for better memory management
const cache = new Map();
const CACHE_DURATIONS = {
  short: 3000,      // 3 seconds - for real-time data
  medium: 45000,    // 45 seconds - for validator data
  long: 600000,     // 10 minutes - for static data like supply
};

// Limit cache size to prevent memory bloat
const MAX_CACHE_SIZE = 50;

export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key, data, duration = 'short') {
  // Prevent cache from growing too large
  if (cache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entries
    const entries = Array.from(cache.entries());
    entries.sort((a, b) => a[1].expiry - b[1].expiry);
    for (let i = 0; i < 10; i++) {
      cache.delete(entries[i][0]);
    }
  }
  
  const expiry = Date.now() + (CACHE_DURATIONS[duration] || CACHE_DURATIONS.short);
  cache.set(key, { data, expiry });
}

export function clearCache() {
  cache.clear();
}

// Debounce utility for RPC calls
const pendingCalls = new Map();

export function debounceRpc(key, fn, delay = 100) {
  if (pendingCalls.has(key)) {
    return pendingCalls.get(key);
  }
  
  const promise = new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        const result = await fn();
        pendingCalls.delete(key);
        resolve(result);
      } catch (err) {
        pendingCalls.delete(key);
        reject(err);
      }
    }, delay);
  });
  
  pendingCalls.set(key, promise);
  return promise;
}

export default { getCached, setCache, clearCache, debounceRpc };