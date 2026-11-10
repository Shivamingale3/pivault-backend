import { describe, it, expect, beforeEach } from 'vitest';
import { ulid } from 'ulid';
import { CACHE_TTL_SECONDS, CacheKeys } from '../../../../src/core/cache/cache.constants.js';
import { SessionStore } from '../../../../src/modules/session/SessionStore.js';
import { createFakeLogger } from '../../../helpers/fakes.js';
import { InMemoryCache } from '../../../helpers/InMemoryCache.js';
import { InMemorySessionRepository } from '../../../helpers/InMemorySessionRepository.js';

const HOUR_MS = 60 * 60 * 1000;
let clock = Date.parse('2026-11-09T12:00:00Z');
let repo: InMemorySessionRepository;
let cache: InMemoryCache;
let logger: ReturnType<typeof createFakeLogger>;
let store: SessionStore;

const newSession = (userId: string, tokenHash: string, ttlMs = 30 * 24 * HOUR_MS) => ({
  userId,
  tokenHash,
  publicKey: 'spki-base64url',
  expiresAt: new Date(clock + ttlMs),
});

beforeEach(() => {
  clock = Date.parse('2026-11-09T12:00:00Z');
  repo = new InMemorySessionRepository();
  cache = new InMemoryCache(() => clock);
  logger = createFakeLogger();
  store = new SessionStore(repo, cache, logger, () => new Date(clock));
});

describe('SessionStore', () => {
  it('caches a new session for at most 15 minutes', async () => {
    await store.replace(newSession(ulid(), 'a'.repeat(64)));
    expect(cache.entries.get(CacheKeys.session('a'.repeat(64)))?.ttl).toBe(
      CACHE_TTL_SECONDS.SESSION,
    );
  });

  it('clamps the cache TTL to the time the session has left', async () => {
    await store.replace(newSession(ulid(), 'b'.repeat(64), 90_000));
    expect(cache.entries.get(CacheKeys.session('b'.repeat(64)))?.ttl).toBe(90);
  });

  it('serves hits from the cache with real Date objects', async () => {
    await store.replace(newSession(ulid(), 'c'.repeat(64)));
    const found = await store.findActive('c'.repeat(64));
    expect(found?.expiresAt).toBeInstanceOf(Date);
    expect(repo.lookups).toBe(0);
  });

  it('falls back to the database on a miss and re-caches', async () => {
    await repo.replaceForUser(newSession(ulid(), 'd'.repeat(64)));
    expect(await store.findActive('d'.repeat(64))).not.toBeNull();
    expect(repo.lookups).toBe(1);
    expect(cache.entries.has(CacheKeys.session('d'.repeat(64)))).toBe(true);
  });

  it('evicts the previous token when the user logs in elsewhere', async () => {
    const userId = ulid();
    await store.replace(newSession(userId, 'e'.repeat(64)));
    await store.replace(newSession(userId, 'f'.repeat(64)));
    expect(await store.findActive('e'.repeat(64))).toBeNull();
    expect(await store.findActive('f'.repeat(64))).not.toBeNull();
  });

  it('rejects and evicts expired sessions', async () => {
    await store.replace(newSession(ulid(), '1'.repeat(64), 2 * HOUR_MS));
    clock += 3 * HOUR_MS;
    expect(await store.findActive('1'.repeat(64))).toBeNull();
  });

  it('revokes a user session from both stores', async () => {
    const userId = ulid();
    await store.replace(newSession(userId, '2'.repeat(64)));
    await store.revokeForUser(userId);
    expect(await store.findActive('2'.repeat(64))).toBeNull();
    expect(repo.byUser.size).toBe(0);
  });

  it('still logs in when caching fails, but fails loudly if eviction fails', async () => {
    const userId = ulid();
    cache.failWrites = true;
    await expect(store.replace(newSession(userId, '3'.repeat(64)))).resolves.toBeDefined();
    expect(logger.warn).toHaveBeenCalled();
    await expect(store.replace(newSession(userId, '4'.repeat(64)))).rejects.toThrow('cache down');
    expect(logger.error).toHaveBeenCalled();
  });
});
