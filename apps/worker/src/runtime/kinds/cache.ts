export interface CacheEntry<T> {
  readonly value: T;
  readonly storedAtMs: number;
  readonly expiresAtMs: number;
}

export type CacheLookupResult<T> =
  | { readonly hit: true; readonly value: T; readonly isStale: false }
  | { readonly hit: false; readonly value: T; readonly isStale: true }
  | { readonly hit: false; readonly value: undefined; readonly isStale: false };

export class InProcessCache<T = unknown> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string, nowMs: number): CacheLookupResult<T> {
    const entry = this.entries.get(key);
    if (!entry) {
      return { hit: false, value: undefined, isStale: false };
    }

    if (nowMs < entry.expiresAtMs) {
      return { hit: true, value: entry.value, isStale: false };
    }

    return { hit: false, value: entry.value, isStale: true };
  }

  set(key: string, value: T, nowMs: number): void {
    this.entries.set(key, {
      value,
      storedAtMs: nowMs,
      expiresAtMs: nowMs + this.ttlMs,
    });
  }

  clear(): void {
    this.entries.clear();
  }
}
