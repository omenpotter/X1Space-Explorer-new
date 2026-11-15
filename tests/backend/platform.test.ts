// Base44 runtime compatibility: entry pattern, secrets, persistent quota store, and token-endpoint weight.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { entry, resolveSecrets, SECRET_NAMES } from '../../base44/shared/entry.ts';
import { env } from '../../base44/shared/env.ts';
import { EntityStore, FallbackStore, type EntityApi } from '../../base44/shared/entityStore.ts';
import { MemoryStore } from '../../base44/shared/store.ts';
import * as H from '../../base44/shared/handlers.ts';
import { makeDeps, makeWorld, MINT_B } from './helpers.ts';

const FN_DIR = path.resolve('base44/functions');
const entries = fs.readdirSync(FN_DIR).map((n) => ({ name: n, src: fs.readFileSync(path.join(FN_DIR, n, 'entry.ts'), 'utf8') }));

describe('entry files follow the Base44 Workers pattern', () => {
  it('has 16 functions', () => expect(entries).toHaveLength(16));
  it.each(entries.map((e) => [e.name, e.src]))('%s: default export, no Deno.serve, secrets only inside a call', (_n, src) => {
    expect(src).toMatch(/export default /);
    expect(src).not.toMatch(/Deno\./);
    expect(src).toMatch(/import \{ secrets \} from 'base44:runtime'/);
    // secrets.get must appear only inside an arrow function, never at module top level
    expect(src).toMatch(/\(name\) => secrets\.get\(name\)/);
    expect(src.split('\n').filter((l) => /^\s*(const|let)\s.*secrets\.get/.test(l))).toEqual([]);
  });
  it('shared code never imports the platform module or Deno', () => {
    for (const f of fs.readdirSync('base44/shared')) {
      const s = fs.readFileSync(path.join('base44/shared', f), 'utf8');
      const code = s.replace(/\/\/.*$/gm, '');
      expect(code, f).not.toMatch(/base44:runtime/);
      expect(code, f).not.toMatch(/Deno\.serve/);
    }
  });
});

describe('secrets', () => {
  it('resolves sync and async getters and ignores missing ones', async () => {
    const r = await resolveSecrets(async (n) => (n === 'X1_NINJA_API_KEY' ? 'k' : n === 'AI_DAILY_QUOTA' ? 5 : undefined));
    expect(r('X1_NINJA_API_KEY')).toBe('k');
    expect(r('AI_DAILY_QUOTA')).toBeUndefined(); // non-strings are ignored
    expect(r('OTHER')).toBeUndefined();
    expect(SECRET_NAMES).toContain('X1_NINJA_API_KEY');
  });
  it('a throwing getter does not fail the request and a handler sees per-request values', async () => {
    let seen: string | undefined;
    const h = entry(() => async () => { seen = env('X1_NINJA_API_KEY'); return new Response('ok'); }, (n) => { if (n === 'GEOLOCATION_DISABLED') throw new Error('x'); return n === 'X1_NINJA_API_KEY' ? 'abc' : undefined; });
    expect((await h(new Request('https://x/'))).status).toBe(200);
    expect(seen).toBe('abc');
    const h2 = entry(() => async () => { seen = env('X1_NINJA_API_KEY'); return new Response('ok'); }, () => undefined);
    await h2(new Request('https://x/'));
    expect(seen).toBeUndefined();
  });
  it('factory and handler failures become a generic 500', async () => {
    const r = await entry(() => { throw new Error('secret-detail'); }, null)(new Request('https://x/'));
    expect(r.status).toBe(500);
    expect(await r.text()).not.toContain('secret-detail');
  });
});

function fakeEntity(): EntityApi & { rows: any[] } {
  const rows: any[] = [];
  let id = 0;
  return {
    rows,
    async filter(q: any) { return rows.filter((r) => r.key === q.key); },
    async create(d: any) { rows.push({ id: String(++id), ...d }); },
    async update(i: string, d: any) { Object.assign(rows.find((r) => r.id === i), d); },
  };
}

describe('persistent quota store', () => {
  it('counts across separate instances (cold starts) and resets after expiry', async () => {
    const api = fakeEntity();
    let t = 1000;
    const a = new EntityStore(api, () => t, () => 1);
    const b = new EntityStore(api, () => t, () => 1);
    expect(await a.incr('q', 60_000)).toBe(1);
    expect(await b.incr('q', 60_000)).toBe(2);
    expect(await a.incr('q', 60_000)).toBe(3);
    t += 61_000;
    expect(await b.incr('q', 60_000)).toBe(1);
  });
  it('falls back to memory once the entity fails, without throwing', async () => {
    const bad = { filter: async () => { throw new Error('down'); }, create: async () => {}, update: async () => {} };
    let warned = 0;
    const s = new FallbackStore(new EntityStore(bad as any), new MemoryStore(), () => warned++);
    expect(await s.incr('k', 1000)).toBe(1);
    expect(await s.incr('k', 1000)).toBe(2);
    expect(warned).toBe(1);
  });
  it('AI quota uses the persistent store when the client exposes the entity', async () => {
    const api = fakeEntity();
    const w = makeWorld();
    const mk = () => ({ ...makeDeps(w), quotaStore: H.defaultDeps().quotaStore, clientFor: () => ({ auth: { me: async () => ({ id: 'u1', email: 'u@x' }) }, asServiceRole: { entities: { RateLimit: api } }, integrations: { Core: { InvokeLLM: async () => ({ ok: 1 }) } } }) });
    await H.smartSearchHandler(mk() as any)(new Request('https://x/smartSearch', { method: 'POST', body: JSON.stringify({ query: 'abc' }), headers: { 'content-type': 'application/json' } }));
    expect(api.rows.length).toBeGreaterThan(0);
  });
});

describe('token endpoints stay light', () => {
  it('getTokenByMint does not scan every program for mints', async () => {
    const w = makeWorld();
    const r = await H.tokenByMintHandler(makeDeps(w))(new Request('https://x/getTokenByMint?mint=' + MINT_B));
    expect(r.status).toBe(200);
    expect(w.rpcCalls.filter((c) => c.method === 'getProgramAccounts')).toHaveLength(0);
  });
});
