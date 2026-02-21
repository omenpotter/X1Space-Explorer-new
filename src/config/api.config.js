// API Configuration for X1 Space Explorer
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

export const API_CONFIG = {
  // Base URLs - Use Base44's own domain
  baseURL: isDevelopment 
    ? 'http://localhost:3000'
    : window.location.origin,  // https://x1space.base44.app
  
  wsURL: isDevelopment
    ? 'ws://localhost:3000'
    : `wss://${window.location.host}`,
  
  // API Endpoints - Using /functions/ path for Base44
  endpoints: {
    tokens: '/functions/getTokens',
    tokenDetail: '/functions/getTokenByMint',
    tokenPrice: '/functions/getTokenPrice',        // NEW
    pools: '/functions/getLiquidityPools',          // NEW
    search: '/functions/searchTokens',
    validators: '/functions/getValidators',
    networkStats: '/functions/getNetworkStats',
    networkHistory: '/functions/getNetworkHistory',
    smartSearch: '/functions/smartSearch',
    analyzeToken: '/functions/analyzeToken',
    detectAnomalies: '/functions/detectAnomalies'
  },
  
  // XDEX API Configuration (for direct frontend calls if needed)
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
  timeout: 10000,
  retries: 3,
  
  // Feature flags
  features: {
    websocket: false,
    aiSearch: true,
    realTimePrices: true,
    portfolioTracking: true,
    xdexIntegration: true  // NEW
  }
};

export default API_CONFIG;
