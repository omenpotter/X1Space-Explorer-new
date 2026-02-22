// src/config/api.config.js
// API Configuration for X1 Space Explorer

// Detect environment - support both base44.app and x1space.xyz
const isProduction = window.location.hostname.includes('base44.app') || 
                     window.location.hostname.includes('x1space.xyz');

const API_CONFIG = {
  // Base URLs - works for both domains
  baseURL: isProduction 
    ? window.location.origin  // Use current domain (base44.app or x1space.xyz)
    : 'http://localhost:3000', // Local development
  
  wsURL: isProduction
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
  isProduction,
  hostname: window.location.hostname,
  baseURL: API_CONFIG.baseURL
});

export default API_CONFIG;
