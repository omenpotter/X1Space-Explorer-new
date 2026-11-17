import { secrets } from 'base44:runtime';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.62';
import { entry } from '../../shared/entry.ts';
import { depsWithClient, smartSearchHandler } from '../../shared/handlers.ts';

// Sign-in and the quota reservation are enforced inside the handler before any model call.
export default entry(() => smartSearchHandler(depsWithClient((req: Request) => createClientFromRequest(req))), (name) => secrets.get(name));
