// API Configuration for X1 Space Explorer
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

export const API_CONFIG = {
  // Base URLs - Point to Deno Deploy backend
  baseURL: isDevelopment 
    ? 'http://localhost:3000'
    : 'https://x1space-backend-88hebcbpabbf.omenpotter.deno.net',  // ✅ YOUR DENO DEPLOY URL
  
  wsURL: isDevelopment
    ? 'ws://localhost:3000'
    : `wss://${window.location.host}`,
  
  // API Endpoints
  endpoints: {
    tokens: '/api/getTokens',
    tokenDetail: '/api/getTokenByMint',
    search: '/api/searchTokens',
    validators: '/api/getValidators',
    networkStats: '/api/getNetworkStats',
    networkHistory: '/api/getNetworkHistory',
    smartSearch: '/api/smartSearch',
    analyzeToken: '/api/analyzeToken',
    detectAnomalies: '/api/detectAnomalies'
  },
  
  // X1 Blockchain RPC
  rpcEndpoint: 'https://xolana.xen.network',
  
  // Cache settings
  cache: {
    enabled: true,
    ttl: 30000,
  },
  
  // Request settings
  timeout: 10000,
  retries: 3,
  
  // Feature flags
  features: {
    websocket: false,
    aiSearch: true,
    realTimePrices: true,
    portfolioTracking: true
  }
};
