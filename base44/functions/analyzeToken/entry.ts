import { secrets } from 'base44:runtime';
import { entry } from '../../shared/entry.ts';
import { analyzeTokenHandler } from '../../shared/handlers.ts';

export default entry(() => analyzeTokenHandler(), (name) => secrets.get(name));
