import { networkStatsHandler } from '../../shared/handlers.ts';

Deno.serve(networkStatsHandler());
