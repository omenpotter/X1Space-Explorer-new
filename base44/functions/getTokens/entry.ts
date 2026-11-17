import { secrets } from 'base44:runtime';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.62';
import { entry } from '../../shared/entry.ts';
import { depsWithClient, tokensHandler } from '../../shared/handlers.ts';

// The client is used only to store X1 Ninja quota counters (service role). No sign-in is required to call this function.
export default entry(() => tokensHandler(depsWithClient((req: Request) => createClientFromRequest(req))), (name) => secrets.get(name));
