import { secrets } from 'base44:runtime';
import { entry } from '../../shared/entry.ts';
import { searchTokensHandler } from '../../shared/handlers.ts';

export default entry(() => searchTokensHandler(), (name) => secrets.get(name));
