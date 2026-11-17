// QuotaCounter: atomic counters for billable AI quotas and X1 Ninja request limits.
//
// Backend functions call it as `client.asServiceRole.actors.QuotaCounter(<shard>).reserve({...})`. The actor is a
// Durable Object: one instance per shard, one event at a time, state in `this.storage` (survives hibernation).
//
// SECURITY: any client can call any callable method on any session it can name. Every method therefore refuses
// every caller except the service role (the app's own backend functions), and WebSocket connections are refused
// outright. The counters hold no secrets, but an anonymous caller must not be able to reset or exhaust them.
import { Actor, ActorError } from 'base44:runtime/actors';
import { BookError, CounterBook } from '../../shared/quotaCounter.ts';

const requireService = (context: any) => {
  if (context?.identity?.type !== 'service') throw new ActorError(403, 'forbidden');
};

const run = async <T>(f: () => Promise<T>): Promise<T> => {
  try {
    return await f();
  } catch (e) {
    if (e instanceof BookError) throw new ActorError(e.status === 507 ? 500 : e.status, e.message);
    throw e;
  }
};

export default class QuotaCounter extends Actor {
  static callable = ['reserve', 'release', 'used', 'set'];

  book = new CounterBook({
    load: () => this.storage.get('book'),
    save: (state) => this.storage.put('book', state),
  });

  async handleStart() {
    await this.book.ensure();
  }

  // This actor is only ever called, never connected to.
  async handleConnect(conn: any) {
    conn.reject(4003, 'not available');
  }

  reserve(args: unknown, context: unknown) {
    requireService(context);
    return run(() => this.book.reserve(args));
  }

  release(args: unknown, context: unknown) {
    requireService(context);
    return run(() => this.book.release(args));
  }

  used(args: unknown, context: unknown) {
    requireService(context);
    return run(() => this.book.used(args));
  }

  set(args: unknown, context: unknown) {
    requireService(context);
    return run(() => this.book.set(args));
  }
}
