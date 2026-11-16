import { secrets } from 'base44:runtime';
import { entry } from '../../shared/entry.ts';
import { detectAnomaliesHandler } from '../../shared/handlers.ts';

export default entry(() => detectAnomaliesHandler(), (name) => secrets.get(name));
