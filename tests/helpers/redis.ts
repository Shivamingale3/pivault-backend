import { RedisConnection } from '../../src/core/cache/RedisConnection.js';
import { AppConfig } from '../../src/core/config/AppConfig.js';

/** A connection to the throwaway test Redis (REDIS_URL set by tests/setup-env.ts). */
export function createTestRedis(): RedisConnection {
  const config = AppConfig.fromEnvironment();
  return new RedisConnection({ url: config.redisUrl, keyPrefix: config.redisKeyPrefix });
}

/** Wipes the test Redis database between tests. */
export async function flushTestRedis(redis: RedisConnection): Promise<void> {
  await redis.cache.flushdb();
}
