import { describe, it, expect, vi } from 'vitest';
import { RedisCache } from '../../../../src/core/cache/RedisCache.js';
import { createFakeLogger } from '../../../helpers/fakes.js';

function setup(stored: string | null = null) {
  const redis = {
    get: vi.fn(() => Promise.resolve(stored)),
    set: vi.fn(() => Promise.resolve('OK' as const)),
    del: vi.fn(() => Promise.resolve(1)),
  };
  const logger = createFakeLogger();
  return { redis, logger, cache: new RedisCache(redis as never, logger) };
}

describe('RedisCache', () => {
  it('stores JSON with a mandatory expiry', async () => {
    const { redis, cache } = setup();
    await cache.set('k', { a: 1 }, 60);
    expect(redis.set).toHaveBeenCalledWith('k', '{"a":1}', 'EX', 60);
  });

  it.each([0, -5, 1.5, Number.NaN])('rejects TTL %s', async (ttl) => {
    const { cache } = setup();
    await expect(cache.set('k', 1, ttl)).rejects.toThrow(RangeError);
  });

  it('parses stored JSON and returns null for misses', async () => {
    expect(await setup('{"a":1}').cache.get('k')).toEqual({ a: 1 });
    expect(await setup(null).cache.get('k')).toBeNull();
  });

  it('treats corrupt JSON as a miss and drops the key', async () => {
    const { redis, cache, logger } = setup('{not json');
    expect(await cache.get('k')).toBeNull();
    expect(redis.del).toHaveBeenCalledWith('k');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('treats a failed read as a miss instead of throwing', async () => {
    const { redis, cache, logger } = setup();
    redis.get.mockRejectedValueOnce(new Error('connection lost'));
    expect(await cache.get('k')).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('propagates write failures', async () => {
    const { redis, cache } = setup();
    redis.set.mockRejectedValueOnce(new Error('OOM'));
    await expect(cache.set('k', 1, 10)).rejects.toThrow('OOM');
  });

  it('skips DEL when given no keys', async () => {
    const { redis, cache } = setup();
    await cache.delete();
    expect(redis.del).not.toHaveBeenCalled();
  });
});
