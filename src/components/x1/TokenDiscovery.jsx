// X1 Token Discovery Service - Scans blockchain for new token mints
import X1Rpc from './X1RpcService';

const DISCOVERY_CACHE = {
  tokens: [],
  lastScan: 0,
  scanInterval: 300000 // 5 minutes
};

// Scan blockchain for SPL Token mints
export async function scanForTokens() {
  console.log('🔍 Scanning X1 blockchain for tokens...');
  
  try {
    // Get all token program accounts (SPL Token mints)
    const tokenMints = await X1Rpc.rpcCall('getProgramAccounts', [
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token program
      {
        encoding: 'jsonParsed',
        filters: [
          { dataSize: 82 } // Mint account size
        ]
      }
    ]).catch(() => []);
    
    console.log(`✓ Found ${tokenMints.length} token mints on-chain`);
    
    const discoveredTokens = [];
    
    for (const account of tokenMints.slice(0, 100)) { // Limit to 100 for performance
      try {
        const mint = account.pubkey;
        const parsed = account.account?.data?.parsed?.info;
        
        if (!parsed) continue;
        
        // Fetch token accounts to get supply and holder info
        const tokenAccounts = await X1Rpc.rpcCall('getProgramAccounts', [
          'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
          {
            encoding: 'jsonParsed',
            filters: [
              { dataSize: 165 },
              { memcmp: { offset: 0, bytes: mint } }
            ]
          }
        ]).catch(() => []);
        
        const holders = tokenAccounts.filter(acc => {
          const amount = acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0;
          return amount > 0;
        });
        
        const totalSupply = Number(parsed.supply) / Math.pow(10, parsed.decimals);
        
        // Try to fetch metadata (Metaplex standard)
        let metadata = null;
        try {
          const metadataPDA = await deriveMetadataPDA(mint);
          const metadataAccount = await X1Rpc.getAccountInfo(metadataPDA);
          if (metadataAccount?.value) {
            metadata = parseMetadata(metadataAccount.value.data);
          }
        } catch (e) {}
        
        discoveredTokens.push({
          mint,
          name: metadata?.name || `Token ${mint.substring(0, 8)}`,
          symbol: metadata?.symbol || 'UNKNOWN',
          logo: metadata?.image || null,
          decimals: parsed.decimals,
          totalSupply,
          holders: holders.length,
          mintAuthority: parsed.mintAuthority,
          freezeAuthority: parsed.freezeAuthority,
          isInitialized: parsed.isInitialized,
          discovered: Date.now(),
          verified: false,
          website: metadata?.website || null,
          twitter: metadata?.twitter || null
        });
        
      } catch (e) {
        continue;
      }
    }
    
    DISCOVERY_CACHE.tokens = discoveredTokens;
    DISCOVERY_CACHE.lastScan = Date.now();
    
    console.log(`✓ Discovered ${discoveredTokens.length} tokens`);
    return discoveredTokens;
    
  } catch (err) {
    console.error('Token discovery failed:', err);
    return DISCOVERY_CACHE.tokens;
  }
}

// Get cached discovered tokens
export function getDiscoveredTokens() {
  const needsScan = Date.now() - DISCOVERY_CACHE.lastScan > DISCOVERY_CACHE.scanInterval;
  
  if (needsScan && DISCOVERY_CACHE.tokens.length === 0) {
    // Initial scan
    scanForTokens();
  }
  
  return DISCOVERY_CACHE.tokens;
}

// Start background scanner
let scannerInterval = null;
export function startTokenScanner() {
  if (scannerInterval) return;
  
  console.log('🚀 Starting token discovery scanner...');
  scanForTokens(); // Initial scan
  
  scannerInterval = setInterval(() => {
    scanForTokens();
  }, DISCOVERY_CACHE.scanInterval);
}

export function stopTokenScanner() {
  if (scannerInterval) {
    clearInterval(scannerInterval);
    scannerInterval = null;
    console.log('⏸️ Token scanner stopped');
  }
}

// Helper: Derive Metaplex metadata PDA
async function deriveMetadataPDA(mint) {
  // Simplified - in production use proper PDA derivation
  return mint;
}

// Helper: Parse metadata from account
function parseMetadata(data) {
  try {
    // Simplified metadata parser
    // In production, properly decode Metaplex metadata format
    return {
      name: 'Unknown Token',
      symbol: 'UNK',
      image: null,
      website: null,
      twitter: null
    };
  } catch (e) {
    return null;
  }
}