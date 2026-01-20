import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import pg from 'npm:pg';

const { Client } = pg;

// XDEX API endpoint for all tradeable tokens with prices
const XDEX_API = 'https://devapi.xdex.xyz/api/xendex/wallet/tokens/pool';

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }

    try {
        const url = new URL(req.url);
        const network = url.searchParams.get('network') || 'X1 Mainnet';
        
        console.log('📊 Fetching token prices from XDEX...');
        console.log(`Network: ${network}`);

        // Fetch prices from XDEX API
        const xdexUrl = `${XDEX_API}?network=${encodeURIComponent(network)}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        const xdexResponse = await fetch(xdexUrl, {
            headers: { 
                'Accept': 'application/json',
                'User-Agent': 'X1Explorer/1.0'
            },
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!xdexResponse.ok) {
            throw new Error(`XDEX API returned ${xdexResponse.status}: ${xdexResponse.statusText}`);
        }

        const xdexData = await xdexResponse.json();
        const tokens = xdexData.tokens || [];
        
        console.log(`✓ Got ${tokens.length} tokens with prices from XDEX`);

        // Connect to PostgreSQL
        const client = new Client({
            user: Deno.env.get('X1_DB_USER') || 'x1user',
            password: Deno.env.get('X1_DB_PASSWORD') || 'password123',
            host: Deno.env.get('X1_DB_HOST') || '45.94.81.202',
            database: Deno.env.get('X1_DB_NAME') || 'x1_explorer',
            port: 5432,
        });

        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✓ Database connected');

        // Update prices in database
        let updated = 0;
        let skipped = 0;

        for (const token of tokens) {
            if (token.price && token.mint) {
                try {
                    // Get total_supply for market cap calculation
                    const supplyResult = await client.query(
                        'SELECT total_supply FROM verified_tokens WHERE mint = $1',
                        [token.mint]
                    );

                    if (supplyResult.rows.length > 0) {
                        const totalSupply = parseFloat(supplyResult.rows[0].total_supply) || 0;
                        const price = parseFloat(token.price);
                        const marketCap = totalSupply * price;

                        // Update price and market cap
                        await client.query(
                            `UPDATE verified_tokens 
                             SET price = $1, 
                                 market_cap = $2,
                                 price_updated_at = NOW() 
                             WHERE mint = $3`,
                            [price, marketCap, token.mint]
                        );
                        updated++;
                    } else {
                        skipped++;
                    }
                } catch (error) {
                    console.warn(`⚠️  Failed to update price for ${token.mint}:`, error.message);
                    skipped++;
                }
            }
        }

        await client.end();
        console.log('✓ Database connection closed');

        console.log(`✅ Price update complete: ${updated} updated, ${skipped} skipped`);

        return new Response(JSON.stringify({
            success: true,
            updated,
            skipped,
            total: tokens.length,
            timestamp: new Date().toISOString(),
            network
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });

    } catch (error) {
        console.error('❌ Price fetch error:', error);
        
        return new Response(JSON.stringify({
            success: false,
            error: {
                message: error.message,
                name: error.name,
                timestamp: new Date().toISOString()
            }
        }), { 
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            }
        });
    }
});
