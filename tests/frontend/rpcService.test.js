import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Every `X1Rpc.<name>` the UI calls must exist on the service's default export. A missing name only fails at
// runtime ("X is not a function") and shows up as an error panel on the page, which a render check can miss.
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(jsx?|tsx?)$/.test(e.name) ? [path.join(dir, e.name)] : []));
}

describe('X1Rpc usage', () => {
  it('every method used in src is on the default export of the service', () => {
    const used = new Map();
    for (const f of walk('src')) {
      for (const m of fs.readFileSync(f, 'utf8').matchAll(/\bX1Rpc\.(\w+)/g)) used.set(m[1], f);
    }
    expect(used.size).toBeGreaterThan(5);
    const svc = fs.readFileSync('src/components/x1/X1RpcService.jsx', 'utf8');
    const body = svc.match(/export default \{([\s\S]*?)\};/)[1];
    const exported = new Set([...body.matchAll(/\b(\w+)\b/g)].map((m) => m[1]));
    const missing = [...used].filter(([name]) => !exported.has(name)).map(([name, f]) => `${name} (${f})`);
    expect(missing).toEqual([]);
  });
});
