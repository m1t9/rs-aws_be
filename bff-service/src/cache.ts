export type CachedResponse = {
  status: number;
  data: unknown;
};

type CacheEntry = {
  expiresAt: number;
  value: CachedResponse;
};

export const TWO_MINUTES_MS = 2 * 60 * 1000;

export class TtlCache {
  private readonly store = new Map<string, CacheEntry>();

  constructor(private readonly ttlMs: number = TWO_MINUTES_MS) {}

  get(key: string): CachedResponse | undefined {
    const entry = this.store.get(key);

    if (!entry) {
      return undefined;
    }

    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: CachedResponse): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.store.clear();
  }
}
