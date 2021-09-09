import Redis from 'ioredis';

export type StoredRecord = Record<string, unknown>;
export interface Storage {
  readonly setItem: (key: string, value: StoredRecord, exp: number) => Promise<void>;
  readonly getItem: (key: string) => Promise<StoredRecord | null>;
}

export function buildInMemoryStorage(): Storage {
  const store = new Map<string, { data: string; exp: number }>();
  const prune = () => {
    store.forEach(({ exp }, key) => {
      if (Date.now() < exp) return;
      store.delete(key);
    });
  };
  return {
    async setItem(key, value, exp) {
      store.set(key, {
        data: JSON.stringify(value),
        exp: Date.now() + exp * 1000,
      });
    },
    async getItem(key) {
      prune();
      const record = store.get(key);
      return record ? JSON.parse(record.data) : null;
    },
  };
}

export type RedisClientLike = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiryMode?: string, time?: number): Promise<string | null>;
};
export function buildRedisStorage(client: Redis.Redis): Storage {
  return {
    async setItem(key, value, exp) {
      await client.set(key, JSON.stringify(value), 'EX', exp);
    },
    async getItem(key) {
      const record = await client.get(key);
      return record ? JSON.parse(record) : null;
    },
  };
}
