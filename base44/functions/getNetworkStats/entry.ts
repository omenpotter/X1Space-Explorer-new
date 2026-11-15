import { secrets } from 'base44:runtime';
import { entry } from '../../shared/entry.ts';
import { networkStatsHandler } from '../../shared/handlers.ts';

export default entry(() => networkStatsHandler(), (name) => secrets.get(name));
