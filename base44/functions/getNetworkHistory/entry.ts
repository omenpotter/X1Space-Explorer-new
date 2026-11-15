import { secrets } from 'base44:runtime';
import { entry } from '../../shared/entry.ts';
import { networkHistoryHandler } from '../../shared/handlers.ts';

export default entry(() => networkHistoryHandler(), (name) => secrets.get(name));
