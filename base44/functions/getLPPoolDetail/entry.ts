import { secrets } from 'base44:runtime';
import { entry } from '../../shared/entry.ts';
import { lpPoolDetailHandler } from '../../shared/handlers.ts';

export default entry(() => lpPoolDetailHandler(), (name) => secrets.get(name));
