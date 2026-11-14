import { describe, it, expect, beforeEach } from 'vitest';
import { ulid } from 'ulid';
import { sha256Hex } from '../../../../src/core/crypto/hash.js';
import {
  ResetPurpose,
  RESET_TOKEN_TTL_SECONDS,
} from '../../../../src/modules/passwordReset/passwordReset.constants.js';
import { PasswordResetTokenService } from '../../../../src/modules/passwordReset/PasswordResetTokenService.js';
import { InMemoryPasswordResetRepository } from '../../../helpers/InMemoryPasswordResetRepository.js';

const NOW = new Date('2026-11-10T10:00:00Z');
let repo: InMemoryPasswordResetRepository;
let service: PasswordResetTokenService;

beforeEach(() => {
  repo = new InMemoryPasswordResetRepository();
  service = new PasswordResetTokenService(repo, () => NOW);
});

describe('PasswordResetTokenService', () => {
  it('returns a high-entropy token and stores only its hash', async () => {
    const userId = ulid();
    const raw = await service.issue(userId, ResetPurpose.Onboarding);

    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = repo.byUser.get(userId);
    expect(stored?.tokenHash).toBe(sha256Hex(raw));
    expect(JSON.stringify([...repo.byUser.values()])).not.toContain(raw);
  });

  it.each([ResetPurpose.Onboarding, ResetPurpose.Reset])(
    'expires a %s token after its own lifetime',
    async (purpose) => {
      const userId = ulid();
      await service.issue(userId, purpose);
      const ttl = RESET_TOKEN_TTL_SECONDS[purpose];

      expect(repo.byUser.get(userId)).toMatchObject({
        purpose,
        expiresAt: new Date(NOW.getTime() + ttl * 1000),
      });
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
    expect(repo.byUser.get(userId)?.tokenHash).toBe(sha256Hex(second));
  });
});
