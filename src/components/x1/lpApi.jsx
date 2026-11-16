// Liquidity pool API client (XDEX data through the backend).
import { api } from '@/lib/x1/api';

export const getLPStats = () => api.poolStats();
export const getLPTokens = (limit = 500, offset = 0) => api.pools({ limit, offset });
export const getLPPool = (address, opts) => api.pool(address, opts);

export default { getLPStats, getLPTokens, getLPPool };
