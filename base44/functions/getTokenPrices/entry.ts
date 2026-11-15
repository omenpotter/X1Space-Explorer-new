import { secrets } from 'base44:runtime';
import { entry } from '../../shared/entry.ts';
import { tokenPricesHandler } from '../../shared/handlers.ts';

export default entry(() => tokenPricesHandler(), (name) => secrets.get(name));
