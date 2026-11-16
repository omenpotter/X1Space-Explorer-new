// Number and text formatting shared by every page.
// A missing value (null / undefined / NaN) always renders as an em dash, never as 0.

export const DASH = '—';

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

/** 1234567 -> "1.23M". */
export function compact(n, digits = 2) {
  if (!isNum(n)) return DASH;
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(digits) + 'T';
  if (abs >= 1e9) return (n / 1e9).toFixed(digits) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(digits) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(digits) + 'K';
  if (abs >= 1 || abs === 0) return n.toFixed(abs >= 100 || abs === 0 ? 0 : digits);
  return n.toPrecision(3);
}

export function integer(n) {
  return isNum(n) ? Math.round(n).toLocaleString('en-US') : DASH;
}

/** USD with sensible precision from sub-cent prices to billions. */
export function usd(n, { compactAbove = 1e6 } = {}) {
  if (!isNum(n)) return DASH;
  const abs = Math.abs(n);
  if (abs >= compactAbove) return '$' + compact(n);
  if (abs >= 1) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (abs >= 0.01) return '$' + n.toFixed(4);
  if (abs === 0) return '$0.00';
  // Very small prices: show four significant digits instead of rounding to zero.
  return '$' + n.toFixed(Math.min(12, Math.max(4, 3 - Math.floor(Math.log10(abs)))));
}

export function percent(n, digits = 2, { sign = false } = {}) {
  if (!isNum(n)) return DASH;
  return (sign && n > 0 ? '+' : '') + n.toFixed(digits) + '%';
}

export function shortAddress(address, head = 4, tail = 4) {
  if (!address || typeof address !== 'string') return DASH;
  return address.length > head + tail + 1 ? `${address.slice(0, head)}…${address.slice(-tail)}` : address;
}

/** "12s ago", "4m ago", "3h ago". Accepts a Date, ISO string or epoch ms. */
export function timeAgo(value, now = Date.now()) {
  if (!value) return DASH;
  const t = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(t)) return DASH;
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Stable hue (0-359) from any string, for generated avatars. */
export function hashHue(seed) {
  let h = 2166136261;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 360;
}

/** Up to two initials from a name or symbol; falls back to the first address characters. */
export function initials(name, fallback = '') {
  const clean = String(name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  if (!clean) return String(fallback).slice(0, 2).toUpperCase();
  const parts = clean.split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : clean.slice(0, 2)).toUpperCase();
}
