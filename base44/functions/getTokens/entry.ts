import { secrets } from 'base44:runtime';
import { entry } from '../../shared/entry.ts';
import { tokensHandler } from '../../shared/handlers.ts';

export default entry(() => tokensHandler(), (name) => secrets.get(name));
