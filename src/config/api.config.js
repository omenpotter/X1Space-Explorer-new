// API Configuration for X1 Space Explorer
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

export const API_CONFIG = {
  // Base URLs - CHANGE THIS AFTER VERCEL DEPLOYMENT
  baseURL: isDevelopment 
    ? 'http://localhost:3000'
    : 'https://x1space-explorer.vercel.app',  // UPDATE WITH YOUR VERCEL URL
  
  wsURL: isDevelopment
    ? 'ws://localhost:3000'
    : 'wss://x1space-explorer.vercel.app',  // UPDATE WITH YOUR VERCEL URL
  
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
    websocket: false,  // Disable WebSocket for now
    aiSearch: true,
    realTimePrices: false,  // Disable until backend is ready
    portfolioTracking: true
  }
};

export default API_CONFIG;
