// Local stand-in for the hosted backend functions, for development and browser tests.
// It serves the same handlers the platform runs, at http://127.0.0.1:8787/functions/<name>.
//
//   NODE_USE_ENV_PROXY=1 npx vite-node scripts/dev-functions-server.ts
//
// Uses live public data sources. Set X1_NINJA_API_KEY in the environment to exercise the
// X1 Ninja integration; without it that source reports "not_configured".
import http from 'node:http';
import * as H from '../base44/shared/handlers.ts';
import { entry } from '../base44/shared/entry.ts';

// Same wrapper the deployed entries use, with process.env standing in for the platform's secrets.
const env = (name: string) => process.env[name];
const wrap = (factory: () => (req: Request) => Promise<Response>) => entry(factory, env);

const routes: Record<string, (req: Request) => Promise<Response>> = {
  getTokens: wrap(() => H.tokensHandler()),
  searchTokens: wrap(() => H.searchTokensHandler()),
  getTokenByMint: wrap(() => H.tokenByMintHandler()),
  analyzeToken: wrap(() => H.analyzeTokenHandler()),
  getTokenPrices: wrap(() => H.tokenPricesHandler()),
  getLiquidityPools: wrap(() => H.liquidityPoolsHandler()),
  getLPTokens: wrap(() => H.lpTokensHandler()),
  getLPStats: wrap(() => H.lpStatsHandler()),
  getLPPoolDetail: wrap(() => H.lpPoolDetailHandler()),
  getNetworkStats: wrap(() => H.networkStatsHandler()),
  getNetworkHistory: wrap(() => H.networkHistoryHandler()),
  detectAnomalies: wrap(() => H.detectAnomaliesHandler()),
  getValidators: wrap(() => H.validatorsHandler()),
  getImage: wrap(() => H.imageHandler()),
  // The model-backed functions need the platform client; locally they answer 503 by design.
  smartSearch: wrap(() => H.smartSearchHandler()),
  tokenVerificationAssistant: wrap(() => H.tokenVerificationHandler()),
};

const port = Number(process.env.PORT || 8787);

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    const name = url.pathname.replace(/^\/(api\/)?functions\//, '').split('/')[0];
    const handler = routes[name];
    if (!handler) {
      res.writeHead(404, { 'content-type': 'application/json' }).end('{"success":false,"error":{"status":404,"code":"unknown_function"}}');
      return;
    }
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const method = req.method || 'GET';
    const out = await handler(new Request(url.toString(), { method, headers, body: method === 'GET' || method === 'HEAD' || method === 'OPTIONS' ? undefined : Buffer.concat(chunks) }));
    const body = Buffer.from(await out.arrayBuffer());
    res.writeHead(out.status, Object.fromEntries(out.headers.entries())).end(body);
  } catch {
    res.writeHead(500, { 'content-type': 'application/json' }).end('{"success":false,"error":{"status":500,"code":"internal_error"}}');
  }
}).listen(port, '127.0.0.1', () => console.log(`functions server on http://127.0.0.1:${port}`));
