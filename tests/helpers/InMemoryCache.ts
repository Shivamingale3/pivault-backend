import type { ICache } from '../../src/core/cache/ICache.js';

/** `ICache` fake that round-trips through JSON like Redis does, with a controllable clock. */
export class InMemoryCache implements ICache {
  readonly entries = new Map<string, { json: string; expiresAt: number; ttl: number }>();
  failWrites = false;

  constructor(private readonly now: () => number = () => Date.now()) {}

  get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= this.now()) return Promise.resolve(null);
    return Promise.resolve(JSON.parse(entry.json) as T);
  }

  set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (this.failWrites) return Promise.reject(new Error('cache down'));
    this.entries.set(key, {
      json: JSON.stringify(value),
      expiresAt: this.now() + ttlSeconds * 1000,
      ttl: ttlSeconds,
    });
    return Promise.resolve();
  }

  delete(...keys: string[]): Promise<void> {
    if (this.failWrites) return Promise.reject(new Error('cache down'));
    keys.forEach((key) => this.entries.delete(key));
    return Promise.resolve();
  }
}
