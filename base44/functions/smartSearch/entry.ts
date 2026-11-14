import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { defaultDeps, smartSearchHandler } from '../../shared/handlers.ts';

// Sign-in and the per-user quota are enforced inside the handler before any model call.
Deno.serve(smartSearchHandler({ ...defaultDeps(), clientFor: (req: Request) => createClientFromRequest(req) }));
