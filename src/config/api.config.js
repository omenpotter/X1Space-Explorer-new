// API Configuration for X1 Space Explorer on Base44
const isDevelopment = import.meta.env.DEV;

export const API_CONFIG = {
  // Base44 deployment URLs
  baseURL: isDevelopment 
    ? 'http://localhost:3000'
    : window.location.origin,  // Use same origin on Base44
  
  wsURL: isDevelopment
    ? 'ws://localhost:3000'
    : `wss://${window.location.host}`,
  
 // API Endpoints - Using /functions/ for Base44
endpoints: {
  tokens: '/functions/getTokens',
  tokenDetail: '/functions/getTokenByMint',
  search: '/functions/searchTokens',
  validators: '/functions/getValidators',
  networkStats: '/functions/getNetworkStats',
  networkHistory: '/functions/getNetworkHistory',
  smartSearch: '/functions/smartSearch',
  analyzeToken: '/functions/analyzeToken',
  detectAnomalies: '/functions/detectAnomalies'
},
  
  // X1 Blockchain RPC - YOUR VALIDATOR RPC
  rpcEndpoint: 'https://xolana.xen.network',  // or your validator IP
  
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
    websocket: false,  // Disable for now
    aiSearch: true,
    realTimePrices: true,
    portfolioTracking: true
  }
};

export default API_CONFIG;
