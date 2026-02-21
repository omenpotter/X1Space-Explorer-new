// src/config/api.config.js
// API Configuration for X1 Space Explorer

// Detect environment - if on base44.app domain, we're in production
const isBase44Production = window.location.hostname.includes('base44.app');

const API_CONFIG = {
  // Base URLs
  baseURL: isBase44Production 
    ? window.location.origin  // Use Base44's domain
    : 'http://localhost:3000', // Local development
  
  wsURL: isBase44Production
    ? `wss://${window.location.host}`
    : 'ws://localhost:3000',
  
  // API Endpoints - Using /functions/ path for Base44
  endpoints: {
    tokens: '/functions/getTokens',
    tokenDetail: '/functions/getTokenByMint',
    tokenPrice: '/functions/getTokenPrice',
    pools: '/functions/getLiquidityPools',
    search: '/functions/searchTokens',
    validators: '/functions/getValidators',
    networkStats: '/functions/getNetworkStats',
    networkHistory: '/functions/getNetworkHistory',
    smartSearch: '/functions/smartSearch',
    analyzeToken: '/functions/analyzeToken',
    detectAnomalies: '/functions/detectAnomalies',
    lpStats: '/functions/getLPStats',
    lpTokens: '/functions/getLPTokens'
  },
  
  // XDEX API Configuration
  xdex: {
    apiUrl: 'https://api.xdex.xyz',
    network: 'X1%20Mainnet',
    swapUrl: 'https://app.xdex.xyz/swap'
  },
  
  // X1 Blockchain RPC
  rpcEndpoint: 'https://xolana.xen.network',
  
  // Cache settings
  cache: {
    enabled: true,
    ttl: 30000, // 30 seconds
  },
  
  // Request settings
  timeout: 15000,
  retries: 3,
  
  // Feature flags
  features: {
    websocket: false,
    aiSearch: true,
    realTimePrices: true,
    portfolioTracking: true,
    xdexIntegration: true
  }
};

// Debug log to verify correct URL is being used
console.log('🔧 API CONFIG:', {
  isBase44Production,
  baseURL: API_CONFIG.baseURL,
  hostname: window.location.hostname
});

export default API_CONFIG;
