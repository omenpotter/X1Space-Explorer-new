// API Configuration for X1 Blockchain Explorer
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

export default API_CONFIG;