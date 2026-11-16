import { secrets } from 'base44:runtime';
import { entry } from '../../shared/entry.ts';
import { liquidityPoolsHandler } from '../../shared/handlers.ts';

export default entry(() => liquidityPoolsHandler(), (name) => secrets.get(name));
