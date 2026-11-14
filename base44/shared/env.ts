// Environment access that works in Deno (production) and Node (tests).
// Secrets are only ever read here and are never logged or returned.
export function env(name: string): string | undefined {
  try {
    const g = globalThis as any;
    if (g.Deno?.env?.get) return g.Deno.env.get(name) || undefined;
    if (g.process?.env) return g.process.env[name] || undefined;
  } catch {
    // Permission denied or unavailable: treat as unset.
  }
  return undefined;
}
