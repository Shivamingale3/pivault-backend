import { describe, it, expect, beforeEach } from 'vitest';
import { ulid } from 'ulid';
import { CacheKeys } from '../../../../src/core/cache/cache.constants.js';
import { sha256Hex } from '../../../../src/core/crypto/hash.js';
import {
  ResetPurpose,
  RESET_TOKEN_TTL_SECONDS,
} from '../../../../src/modules/passwordReset/passwordReset.constants.js';
import { PasswordResetTokenService } from '../../../../src/modules/passwordReset/PasswordResetTokenService.js';
import { createFakeLogger } from '../../../helpers/fakes.js';
import { InMemoryCache } from '../../../helpers/InMemoryCache.js';
import { InMemoryPasswordResetRepository } from '../../../helpers/InMemoryPasswordResetRepository.js';

const NOW = new Date('2026-11-10T10:00:00Z');
let repo: InMemoryPasswordResetRepository;
let cache: InMemoryCache;
let logger: ReturnType<typeof createFakeLogger>;
let service: PasswordResetTokenService;

beforeEach(() => {
  repo = new InMemoryPasswordResetRepository();
  cache = new InMemoryCache();
  logger = createFakeLogger();
  service = new PasswordResetTokenService(repo, cache, logger, () => NOW);
});

describe('PasswordResetTokenService', () => {
  it('returns a high-entropy token and stores only its hash', async () => {
    const userId = ulid();
    const raw = await service.issue(userId, ResetPurpose.Onboarding);

    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = repo.byUser.get(userId);
    expect(stored?.tokenHash).toBe(sha256Hex(raw));
    expect(JSON.stringify([...repo.byUser.values()])).not.toContain(raw);
    expect(JSON.stringify([...cache.entries.entries()])).not.toContain(raw);
  });

  it.each([ResetPurpose.Onboarding, ResetPurpose.Reset])(
    'expires a %s token after its own lifetime, in the database and the cache',
    async (purpose) => {
      const userId = ulid();
      const raw = await service.issue(userId, purpose);
      const ttl = RESET_TOKEN_TTL_SECONDS[purpose];

      expect(repo.byUser.get(userId)?.expiresAt).toEqual(new Date(NOW.getTime() + ttl * 1000));
      const entry = cache.entries.get(CacheKeys.passwordReset(sha256Hex(raw)));
      expect(entry?.ttl).toBe(ttl);
    },
  );

  it('gives onboarding links a longer life than forgot-password links', () => {
    expect(RESET_TOKEN_TTL_SECONDS.onboarding).toBe(24 * 60 * 60);
    expect(RESET_TOKEN_TTL_SECONDS.reset).toBe(15 * 60);
  });

  it('issues unique tokens and replaces the previous one (old link dies immediately)', async () => {
    const userId = ulid();
    const first = await service.issue(userId, ResetPurpose.Onboarding);
    const second = await service.issue(userId, ResetPurpose.Reset);

    expect(second).not.toBe(first);
    expect(repo.byUser.size).toBe(1);
    expect(cache.entries.has(CacheKeys.passwordReset(sha256Hex(first)))).toBe(false);
    expect(cache.entries.has(CacheKeys.passwordReset(sha256Hex(second)))).toBe(true);
  });

  it('still issues the token when the cache is down (database is authoritative)', async () => {
    cache.failWrites = true;
    const userId = ulid();
    const raw = await service.issue(userId, ResetPurpose.Onboarding);

    expect(repo.byUser.get(userId)?.tokenHash).toBe(sha256Hex(raw));
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
