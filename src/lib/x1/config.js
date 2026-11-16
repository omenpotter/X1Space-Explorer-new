// Single source of truth for network endpoints and client-side timing.
// Nothing here is secret: private keys live only in backend function settings.

export const X1_CONFIG = {
  network: 'X1 Mainnet',
  // Public RPC endpoints, in priority order. The first is authoritative.
  rpcEndpoints: ['https://rpc.mainnet.x1.xyz', 'https://rpc.x1galaxy.io/'],
  rpcTimeoutMs: 8000,
  explorerUrl: 'https://explorer.mainnet.x1.xyz',
  xdexSwapUrl: 'https://app.xdex.xyz/swap',
  nativeMint: 'So11111111111111111111111111111111111111112',
  // Maximum vote credits a validator can earn per slot (timely vote credits).
  maxVoteCreditsPerSlot: 16,
  polling: {
    // Each block is ~400 KB of JSON (full transaction details are needed to classify transactions) and every poll reads
    // 10-20 new blocks, so a 4 s interval cost about 60 MB per minute per open tab. 15 s keeps the data current
    // enough (slots are 0.4 s, the UI shows its age) at a quarter of that.
    blocksMs: 15000,
    transactionsMs: 15000,
    dashboardMs: 5000,
    validatorsMs: 60000,
    // Backend-function polling is deliberately slow: each function run costs workspace credits.
    priceMs: 120000,
    anomaliesMs: 600000,
    tokensMs: 120000,
    networkMapMs: 120000,
  },
  // Hosts the browser may load token logos from directly. Everything else goes through the image proxy.
  directImageHosts: ['app.xdex.xyz', 'raw.githubusercontent.com'],
};

export default X1_CONFIG;
