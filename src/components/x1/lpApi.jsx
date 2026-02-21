// LP API client - calls Base44 backend functions
import { base44 } from '@/api/base44Client';

export async function getLPStats() {
  const response = await base44.functions.invoke('getLPStats', {});
  return response.data;
}

export async function getLPTokens(limit = 100) {
  const response = await base44.functions.invoke('getLPTokens', { limit });
  return response.data;
}

export async function getTopLPHolders(limit = 100) {
  // No dedicated function yet - return empty
  return { holders: [] };
}

export async function getLPEvents(params = {}) {
  // No dedicated function yet - return empty
  return { events: [] };
}

export async function getLPEventStats() {
  // No dedicated function yet - return empty
  return { stats: { total_events: 0, add_count: 0, remove_count: 0 } };
}

export function formatLPAmount(amount, decimals = 2) {
  if (!amount) return '0';
  const num = Number(amount);
  if (isNaN(num)) return '0';
  if (num >= 1e9) return (num / 1e9).toFixed(decimals) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(decimals) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(decimals) + 'K';
  return num.toFixed(decimals);
}

export function formatEventTime(blockTime) {
  if (!blockTime) return 'unknown';
  const diff = Math.floor((Date.now() / 1000) - blockTime);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}