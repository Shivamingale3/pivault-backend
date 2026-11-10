import { Redis } from 'ioredis';
import { RedisConnection } from '../../src/core/cache/RedisConnection.js';
import { AppConfig } from '../../src/core/config/AppConfig.js';

const SCAN_BATCH = 200;

/**
 * A connection to the configured Redis servers. Tests share them with dev; every key
 * is namespaced by the `pivault-test` prefix that vitest.config.ts forces.
 */
export function createTestRedis(): RedisConnection {
  const config = AppConfig.fromEnvironment();
  return new RedisConnection({
    cacheUrl: config.redisCacheUrl,
    queueUrl: config.redisQueueUrl,
    keyPrefix: config.redisKeyPrefix,
  });
}

/** An un-prefixed client on the cache server, for asserting on raw key names. */
export function createRawCacheClient(): Redis {
  return new Redis(AppConfig.fromEnvironment().redisCacheUrl);
}

async function deleteByPrefix(url: string, prefix: string): Promise<void> {
  const client = new Redis(url);
  try {
    let cursor = '0';
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', `${prefix}:*`, 'COUNT', SCAN_BATCH);
      cursor = next;
      if (keys.length > 0) await client.unlink(...keys);
    } while (cursor !== '0');
  } finally {
    client.disconnect();
  }
}

/**
 * Deletes ONLY this suite's keys (`<prefix>:*`) on the cache and queue servers.
 * Never FLUSHDB: those servers also hold real dev data. Refuses to run unless the
 * prefix is clearly a test prefix.
 */
export async function flushTestRedis(): Promise<void> {
  const config = AppConfig.fromEnvironment();
  const prefix = config.redisKeyPrefix;
  if (!prefix.includes('test')) {
    throw new Error(`Refusing to clean Redis: key prefix "${prefix}" is not a test prefix.`);
  }
  const urls = new Set([config.redisCacheUrl, config.redisQueueUrl]);
  await Promise.all([...urls].map((url) => deleteByPrefix(url, prefix)));
}
