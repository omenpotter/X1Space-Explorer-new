import { secrets } from 'base44:runtime';
import { entry } from '../../shared/entry.ts';
import { tokenByMintHandler } from '../../shared/handlers.ts';

export default entry(() => tokenByMintHandler(), (name) => secrets.get(name));
