// Validator identity service.
// Names, websites and icons come from the on-chain validator-info accounts that
// operators publish themselves. Nothing is hard-coded: a validator without a
// published identity is shown by its address.
import { api } from '@/lib/x1/api';
import { rpcCall } from '@/lib/x1/rpcClient';
import { safeUrl } from '@/lib/safeUrl';

const CACHE_MS = 5 * 60 * 1000;

let directory = null; // { validators, locations, providers, nodes, sources, fetchedAt }
let loadedAt = 0;
let loading = null;

function cleanText(value, max) {
  if (typeof value !== 'string') return null;
   
  const s = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  return s || null;
}

// Fallback when the backend directory is unreachable: read identities straight from chain.
// This path has no icons or locations (those need the server-side proxy and lookup).
async function loadFromChain() {
  const accounts = await rpcCall('getProgramAccounts', [
    'Config1111111111111111111111111111111111111',
    { encoding: 'jsonParsed' },
  ], 'validator-info-chain', 'long', { timeoutMs: 20000 });
  const validators = {};
  for (const a of accounts || []) {
    const parsed = a?.account?.data?.parsed;
    if (parsed?.type !== 'validatorInfo') continue;
    const id = parsed.info?.keys?.[1];
    if (!id?.signer || !id.pubkey) continue;
    const cd = parsed.info.configData || {};
    const website = safeUrl(cd.website);
    validators[id.pubkey] = {
      name: cleanText(cd.name, 60),
      website: website && website !== '#' && /^https:\/\//i.test(website) ? website : null,
      details: cleanText(cd.details, 300),
      hasIcon: false,
    };
  }
  return {
    validators,
    locations: {},
    providers: [],
    nodes: null,
    sources: { identity: { status: 'ok', fetchedAt: new Date().toISOString() }, geolocation: { status: 'error', fetchedAt: null } },
    fetchedAt: new Date().toISOString(),
    fallback: true,
  };
}

/** Load (or reuse) the validator directory. Never throws: resolves to an empty directory on failure. */
export async function fetchValidatorDirectory(force = false) {
  if (!force && directory && Date.now() - loadedAt < CACHE_MS) return directory;
  if (loading) return loading;
  loading = (async () => {
    try {
      directory = await api.validatorDirectory();
    } catch {
      try {
        directory = await loadFromChain();
      } catch {
        directory = directory || { validators: {}, locations: {}, providers: [], nodes: null, sources: {}, fetchedAt: null, unavailable: true };
      }
    }
    loadedAt = Date.now();
    loading = null;
    return directory;
  })();
  return loading;
}

// Kept for existing callers.
export async function fetchAllValidatorIdentities() {
  const d = await fetchValidatorDirectory();
  return d.validators;
}

export function shortAddress(address, head = 6, tail = 4) {
  if (!address) return '';
  return address.length > head + tail + 1 ? `${address.slice(0, head)}…${address.slice(-tail)}` : address;
}

/** Identity for a validator. `nodePubkey` (the identity account) is what operators sign with. */
export function getValidatorName(votePubkey, nodePubkey = null) {
  const info = (nodePubkey && directory?.validators?.[nodePubkey]) || null;
  return {
    name: info?.name || shortAddress(votePubkey),
    hasIdentity: !!info?.name,
    website: info?.website || null,
    details: info?.details || null,
    hasIcon: !!info?.hasIcon,
    icon: null, // legacy field: emoji icons were removed
  };
}

export function getDisplayName(votePubkey, nodePubkey = null) {
  return getValidatorName(votePubkey, nodePubkey).name;
}

export function getValidatorIcon() {
  return null;
}

export function getValidatorWebsite(votePubkey, nodePubkey = null) {
  return getValidatorName(votePubkey, nodePubkey).website;
}

export function getValidatorLocation(nodePubkey) {
  return (nodePubkey && directory?.locations?.[nodePubkey]) || null;
}

export function getDirectoryMeta() {
  return directory
    ? { providers: directory.providers || [], nodes: directory.nodes || null, sources: directory.sources || {}, fetchedAt: directory.fetchedAt, fallback: !!directory.fallback, unavailable: !!directory.unavailable }
    : null;
}

export function enrichValidators(validators) {
  return validators.map((v) => {
    const info = getValidatorName(v.votePubkey, v.nodePubkey);
    return {
      ...v,
      name: info.name,
      hasIdentity: info.hasIdentity,
      website: info.website,
      details: info.details,
      hasIcon: info.hasIcon,
      icon: null,
      location: getValidatorLocation(v.nodePubkey),
    };
  });
}

export async function enrichValidatorsAsync(validators) {
  await fetchValidatorDirectory();
  return enrichValidators(validators);
}

export function getIdentityCache() {
  return { ...(directory?.validators || {}) };
}

export async function refreshCache() {
  return (await fetchValidatorDirectory(true)).validators;
}

// Legacy export: the hard-coded list was removed in favour of on-chain data.
export const KNOWN_VALIDATORS_LIST = {};

export default {
  fetchValidatorDirectory,
  fetchAllValidatorIdentities,
  getValidatorName,
  getDisplayName,
  getValidatorIcon,
  getValidatorWebsite,
  getValidatorLocation,
  getDirectoryMeta,
  enrichValidators,
  enrichValidatorsAsync,
  refreshCache,
  getIdentityCache,
  shortAddress,
  KNOWN_VALIDATORS: KNOWN_VALIDATORS_LIST,
};
