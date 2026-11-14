import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sha256Hex } from '../../../../src/core/crypto/hash.js';
import { INVALID_LINK_MESSAGE } from '../../../../src/modules/passwordLink/passwordLink.constants.js';
import { InvalidLinkError } from '../../../../src/modules/passwordLink/passwordLink.errors.js';
import { PasswordLinkService } from '../../../../src/modules/passwordLink/PasswordLinkService.js';
import { ResetPurpose } from '../../../../src/modules/passwordReset/passwordReset.constants.js';
import { PasswordResetTokenService } from '../../../../src/modules/passwordReset/PasswordResetTokenService.js';
import { UserService } from '../../../../src/modules/user/UserService.js';
import { createFakeLogger } from '../../../helpers/fakes.js';
import { InMemoryPasswordResetRepository } from '../../../helpers/InMemoryPasswordResetRepository.js';
import { InMemorySessionRepository } from '../../../helpers/InMemorySessionRepository.js';
import { InMemoryUserRepository } from '../../../helpers/InMemoryUserRepository.js';
import { userData } from '../../../helpers/fixtures.js';

const NOW = new Date('2026-11-14T10:00:00Z');
let users: InMemoryUserRepository;
let sessions: InMemorySessionRepository;
let tokens: InMemoryPasswordResetRepository;
let hasher: { hash: ReturnType<typeof vi.fn>; verify: ReturnType<typeof vi.fn> };
let logger: ReturnType<typeof createFakeLogger>;
let service: PasswordLinkService;
let userId: string;

const issue = (purpose: ResetPurpose = ResetPurpose.Onboarding) =>
  new PasswordResetTokenService(tokens, () => NOW).issue(userId, purpose);

beforeEach(async () => {
  users = new InMemoryUserRepository();
  sessions = new InMemorySessionRepository();
  tokens = new InMemoryPasswordResetRepository(users, sessions);
  hasher = {
    hash: vi.fn(() => Promise.resolve('new-hash')),
    verify: vi.fn(() => Promise.resolve(true)),
  };
  logger = createFakeLogger();
  service = new PasswordLinkService(tokens, hasher, logger, () => NOW);
  userId = (await new UserService(users).create(userData())).id;
});

describe('PasswordLinkService.validate', () => {
  it('reports the purpose and expiry of a live token', async () => {
    const token = await issue();
    const status = await service.validate(token);
    expect(status.purpose).toBe('onboarding');
    expect(status.expiresAt.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('does not consume the token', async () => {
    const token = await issue();
    await service.validate(token);
    await expect(service.validate(token)).resolves.toBeDefined();
  });

  it('rejects an unknown token with the generic message', async () => {
    const error = await service.validate('x'.repeat(43)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvalidLinkError);
    expect((error as Error).message).toBe(INVALID_LINK_MESSAGE);
  });

  it('rejects an expired token the same way', async () => {
    const token = await issue(ResetPurpose.Reset);
    const later = new PasswordLinkService(
      tokens,
      hasher,
      logger,
      () => new Date(NOW.getTime() + 16 * 60_000),
    );
    await expect(later.validate(token)).rejects.toBeInstanceOf(InvalidLinkError);
  });
});

describe('PasswordLinkService.complete', () => {
  it('sets the hashed password, verifies the email and burns the token', async () => {
    const token = await issue();
    await service.complete(token, 'Passw0rd!');

    expect(hasher.hash).toHaveBeenCalledWith('Passw0rd!');
    const row = users.rows.get(userId);
    expect(row).toMatchObject({
      passwordHash: 'new-hash',
      passwordChangedAt: NOW,
      emailVerifiedAt: NOW,
    });
    expect(tokens.byUser.size).toBe(0);
    await expect(service.validate(token)).rejects.toBeInstanceOf(InvalidLinkError);
  });

  it('cannot be replayed', async () => {
    const token = await issue();
    await service.complete(token, 'Passw0rd!');
    await expect(service.complete(token, 'Other0ne!')).rejects.toBeInstanceOf(InvalidLinkError);
    expect(users.rows.get(userId)?.passwordHash).toBe('new-hash');
  });

  it('ends the existing session', async () => {
    sessions.byUser.set(userId, { userId } as never);
    await service.complete(await issue(), 'Passw0rd!');
    expect(sessions.byUser.has(userId)).toBe(false);
  });

  it('keeps an earlier verification time', async () => {
    const first = new Date('2026-01-01T00:00:00Z');
    const row = users.rows.get(userId);
    if (row) row.emailVerifiedAt = first;
    await service.complete(await issue(ResetPurpose.Reset), 'Passw0rd!');
    expect(users.rows.get(userId)?.emailVerifiedAt).toEqual(first);
  });

  it('never hashes a password for a bad token', async () => {
    await expect(service.complete('x'.repeat(43), 'Passw0rd!')).rejects.toBeInstanceOf(
      InvalidLinkError,
    );
    expect(hasher.hash).not.toHaveBeenCalled();
  });

  it('rejects when the token is spent between the check and the write', async () => {
    const token = await issue();
    vi.spyOn(tokens, 'consumeToSetPassword').mockResolvedValueOnce(null);
    await expect(service.complete(token, 'Passw0rd!')).rejects.toBeInstanceOf(InvalidLinkError);
    expect(users.rows.get(userId)?.emailVerifiedAt).toBeNull();
  });

  it('logs the user but never the token or the password', async () => {
    const token = await issue();
    await service.complete(token, 'Passw0rd!');
    const logged = JSON.stringify(logger.info.mock.calls);
    expect(logged).toContain(userId);
    expect(logged).not.toContain(token);
    expect(logged).not.toContain(sha256Hex(token));
    expect(logged).not.toContain('Passw0rd!');
  });
});
