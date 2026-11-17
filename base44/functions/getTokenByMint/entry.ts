import { secrets } from 'base44:runtime';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { entry } from '../../shared/entry.ts';
import { depsWithClient, tokenByMintHandler } from '../../shared/handlers.ts';

// The client is used only to store X1 Ninja quota counters (service role). No sign-in is required to call this function.
export default entry(() => tokenByMintHandler(depsWithClient((req: Request) => createClientFromRequest(req))), (name) => secrets.get(name));
