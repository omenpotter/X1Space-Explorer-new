// Classifies a search query into explorer destinations. It only decides where a query
// could lead; the destination pages load and verify the real data.
import { createPageUrl } from '@/utils';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function classifyQuery(raw) {
  const q = String(raw || '').trim();
  const out = [];
  if (!q) return out;
  if (/^\d{1,12}$/.test(q)) {
    out.push({ type: 'block', label: `Block at slot ${Number(q).toLocaleString('en-US')}`, to: `${createPageUrl('BlockDetail')}?slot=${q}` });
  }
  if (BASE58.test(q)) {
    if (q.length >= 80 && q.length <= 90) {
      out.push({ type: 'transaction', label: 'Transaction signature', to: `${createPageUrl('TransactionDetail')}?sig=${q}` });
    }
    if (q.length >= 32 && q.length <= 44) {
      out.push({ type: 'address', label: 'Account or wallet address', to: `${createPageUrl('AddressLookup')}?address=${q}` });
      out.push({ type: 'token', label: 'Token mint', to: `${createPageUrl('TokenExplorer')}?mint=${q}` });
      out.push({ type: 'validator', label: 'Validator vote account', to: `${createPageUrl('ValidatorDetail')}?id=${q}` });
    }
  }
  if (q.length >= 2 && q.length <= 64 && out.length === 0) {
    out.push({ type: 'token-search', label: `Tokens matching "${q}"`, to: `${createPageUrl('TokenExplorer')}?q=${encodeURIComponent(q)}` });
    out.push({ type: 'validator-search', label: `Validators matching "${q}"`, to: `${createPageUrl('Validators')}?search=${encodeURIComponent(q)}` });
  }
  return out;
}
