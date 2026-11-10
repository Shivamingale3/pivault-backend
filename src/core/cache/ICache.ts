/**
 * Key/value cache with mandatory expiry. Values are JSON-serialisable.
 * Implementations never throw on reads: a failed or corrupt read is a miss,
 * so callers always fall back to the source of truth.
 */
export interface ICache {
  get<T>(key: string): Promise<T | null>;
  /** `ttlSeconds` is required and must be a positive integer: nothing is cached forever. */
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  delete(...keys: string[]): Promise<void>;
}
