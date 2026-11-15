import { secrets } from 'base44:runtime';
import { entry } from '../../shared/entry.ts';
import { lpStatsHandler } from '../../shared/handlers.ts';

export default entry(() => lpStatsHandler(), (name) => secrets.get(name));
