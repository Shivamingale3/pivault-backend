import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { RedisCache } from '../../src/core/cache/RedisCache.js';
import { NoopLogger } from '../../src/core/logger/NoopLogger.js';
import { createRawCacheClient, createTestRedis, flushTestRedis } from '../helpers/redis.js';

const redis = createTestRedis();
const cache = new RedisCache(redis.cache, new NoopLogger());

beforeAll(() => redis.connect());
beforeEach(() => flushTestRedis());
afterAll(() => redis.disconnect());

describe('RedisCache (real Redis)', () => {
  it('round-trips JSON and applies the TTL', async () => {
    await cache.set('session:abc', { userId: 'u1' }, 120);
    expect(await cache.get('session:abc')).toEqual({ userId: 'u1' });
    const ttl = await redis.cache.ttl('session:abc');
    expect(ttl).toBeGreaterThan(110);
    expect(ttl).toBeLessThanOrEqual(120);
  });

  it('namespaces keys under <prefix>:cache:', async () => {
    await cache.set('k', 1, 60);
    const raw = createRawCacheClient();
    try {
      expect(await raw.exists('pivault-test:cache:k')).toBe(1);
    } finally {
      raw.disconnect();
    }
  });

  it('deletes keys', async () => {
    await cache.set('k', 1, 60);
    await cache.delete('k');
    expect(await cache.get('k')).toBeNull();
  });

  it('ping() reports health', async () => {
    expect(await redis.ping()).toBe(true);
  });
});
