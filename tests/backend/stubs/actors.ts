// Test double for the platform module `base44:runtime/actors`, which exists only inside Base44.
export class ActorError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export class Actor {
  storageMap = new Map<string, unknown>();
  storage = {
    get: async (k: string) => this.storageMap.get(k),
    put: async (k: string, v: unknown) => { this.storageMap.set(k, JSON.parse(JSON.stringify(v))); },
    delete: async (k: string) => { this.storageMap.delete(k); },
    deleteAll: async () => { this.storageMap.clear(); },
  };
}
