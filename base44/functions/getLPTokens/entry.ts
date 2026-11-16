import { secrets } from 'base44:runtime';
import { entry } from '../../shared/entry.ts';
import { lpTokensHandler } from '../../shared/handlers.ts';

export default entry(() => lpTokensHandler(), (name) => secrets.get(name));
