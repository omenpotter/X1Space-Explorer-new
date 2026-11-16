import { secrets } from 'base44:runtime';
import { entry } from '../../shared/entry.ts';
import { imageHandler } from '../../shared/handlers.ts';

export default entry(() => imageHandler(), (name) => secrets.get(name));
