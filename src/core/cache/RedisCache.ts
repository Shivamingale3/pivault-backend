import type { Redis } from 'ioredis';
import type { ILogger } from '../logger/ILogger.js';
import type { ICache } from './ICache.js';

/**
 * `ICache` over ioredis. The client carries the key prefix (see `RedisConnection`).
 * Read failures and corrupt JSON are logged and treated as misses; write failures
 * propagate so callers can decide (e.g. reset tokens must not silently fail to store).
 */
export class RedisCache implements ICache {
  constructor(
    private readonly redis: Pick<Redis, 'get' | 'set' | 'del'>,
    private readonly logger: ILogger,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    let raw: string | null;
    try {
      raw = await this.redis.get(key);
    } catch (error) {
      this.logger.warn(`Cache read failed for "${key}"; treating as a miss.`, error);
      return null;
    }
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`Cache value for "${key}" is not valid JSON; dropping it.`);
      await this.delete(key).catch(() => undefined);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new RangeError(`Cache TTL must be a positive integer, got ${ttlSeconds}`);
    }
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async delete(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.redis.del(...keys);
  }
}
