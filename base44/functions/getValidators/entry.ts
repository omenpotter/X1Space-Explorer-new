import { secrets } from 'base44:runtime';
import { entry } from '../../shared/entry.ts';
import { validatorsHandler } from '../../shared/handlers.ts';

export default entry(() => validatorsHandler(), (name) => secrets.get(name));
