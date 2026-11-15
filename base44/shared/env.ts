// Configuration and secret access.
//
// On Base44 secrets must be read with `secrets.get()` from the platform module `base44:runtime`, inside
// the request handler. That module only exists on the platform, so only the function entry files import
// it and hand a reader to `useSecretReader()` for the duration of each request. Everywhere else just
// calls `env(name)`. Under Node (tests, the local dev server) the default reader uses process.env.
// Secrets are never logged or returned.
export type SecretReader = (name: string) => string | undefined;

function nodeReader(name: string): string | undefined {
  try {
    const g = globalThis as any;
    if (g.Deno?.env?.get) return g.Deno.env.get(name) || undefined;
    if (g.process?.env) return g.process.env[name] || undefined;
  } catch {
    // Permission denied or unavailable: treat as unset.
  }
  return undefined;
}

let reader: SecretReader = nodeReader;

export function useSecretReader(r: SecretReader | null | undefined): void {
  reader = r ?? nodeReader;
}

export function env(name: string): string | undefined {
  try {
    const v = reader(name);
    return typeof v === 'string' && v.length > 0 ? v : undefined;
  } catch {
    return undefined;
  }
}
