import { secrets } from 'base44:runtime';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { entry } from '../../shared/entry.ts';
import { defaultDeps, smartSearchHandler } from '../../shared/handlers.ts';

// Sign-in and the per-user quota are enforced inside the handler before any model call.
export default entry(
  () => smartSearchHandler({ ...defaultDeps(), clientFor: (req: Request) => createClientFromRequest(req) }),
  (name) => secrets.get(name),
);
