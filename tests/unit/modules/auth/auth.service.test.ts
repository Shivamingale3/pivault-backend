import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { sha256Hex } from '../../../../src/core/crypto/hash.js';
import {
  EMAIL_NOT_VERIFIED_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  LOGIN_ATTEMPTS_PER_ROUND,
  SESSION_NEVER_EXPIRES_AT,
} from '../../../../src/modules/auth/auth.constants.js';
import { AuthService } from '../../../../src/modules/auth/AuthService.js';
import { LoginThrottle } from '../../../../src/modules/auth/LoginThrottle.js';
import { SessionStore } from '../../../../src/modules/session/SessionStore.js';
import { fakePassword } from '../../../helpers/passwords.js';
import { createFakeLogger } from '../../../helpers/fakes.js';
import { InMemorySessionRepository } from '../../../helpers/InMemorySessionRepository.js';
import { InMemoryUserRepository } from '../../../helpers/InMemoryUserRepository.js';

const PASSWORD = fakePassword();
const WRONG_PASSWORD = fakePassword();
const NOW = new Date('2026-11-15T10:00:00Z');
const request = (overrides = {}) => ({
  email: 'jane@example.com',
  password: PASSWORD,
  publicKey: 'device-key',
  userAgent: 'test-agent',
  ipAddress: '203.0.113.7',
  ...overrides,
});

let users: InMemoryUserRepository;
let sessionRepo: InMemorySessionRepository;
let hasher: {
  hash: Mock<(value: string) => Promise<string>>;
  verify: Mock<(hash: string, value: string) => Promise<boolean>>;
};
let logger: ReturnType<typeof createFakeLogger>;
let service: AuthService;
let userId: string;

beforeEach(async () => {
  users = new InMemoryUserRepository();
  sessionRepo = new InMemorySessionRepository();
  logger = createFakeLogger();
  hasher = {
    hash: vi.fn((value: string) => Promise.resolve(`hash:${value}`)),
    verify: vi.fn((hash: string, value: string) => Promise.resolve(hash === `hash:${value}`)),
  };
  service = new AuthService(
    users,
    hasher,
    new SessionStore(sessionRepo),
    new LoginThrottle(() => NOW.getTime()),
    logger,
    () => NOW,
  );
  const user = await users.create({
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    countryCode: '91',
    mobile: '9876543210',
    passwordHash: `hash:${PASSWORD}`,
  });
  userId = user.id;
  const row = users.rows.get(userId);
  if (row) row.emailVerifiedAt = NOW;
});

describe('AuthService.login', () => {
  it('creates the only session, stores just the token hash and the device key', async () => {
    const result = await service.login(request());

    expect(result.user).toEqual({
      id: userId,
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(result.recoveryKeyConfigured).toBe(false);
    expect(result.expiresAt).toEqual(SESSION_NEVER_EXPIRES_AT);
    const stored = sessionRepo.byUser.get(userId);
    expect(stored?.tokenHash).toBe(sha256Hex(result.token));
    expect(stored?.publicKey).toBe('device-key');
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(result.token);
  });

  it('reports a configured recovery key', async () => {
    const row = users.rows.get(userId);
    if (row) row.recoveryKeyConfiguredAt = NOW;
    expect((await service.login(request())).recoveryKeyConfigured).toBe(true);
  });

  it('replaces the previous session on a second login', async () => {
    const first = await service.login(request());
    const second = await service.login(request());
    expect(sessionRepo.byUser.size).toBe(1);
    expect(sessionRepo.byUser.get(userId)?.tokenHash).toBe(sha256Hex(second.token));
    expect(first.token).not.toBe(second.token);
  });

  it('answers a wrong password and an unknown email identically, and verifies in both cases', async () => {
    const wrong = await service
      .login(request({ password: WRONG_PASSWORD }))
      .catch((e: unknown) => e);
    const unknown = await service
      .login(request({ email: 'ghost@example.com' }))
      .catch((e: unknown) => e);
    for (const error of [wrong, unknown]) {
      expect(error).toMatchObject({ statusCode: 401, message: INVALID_CREDENTIALS_MESSAGE });
    }
    expect(hasher.verify).toHaveBeenCalledTimes(2);
    expect(sessionRepo.byUser.size).toBe(0);
  });

  it('refuses an unverified email, after the password is right', async () => {
    const row = users.rows.get(userId);
    if (row) row.emailVerifiedAt = null;
    await expect(service.login(request())).rejects.toMatchObject({
      statusCode: 403,
      message: EMAIL_NOT_VERIFIED_MESSAGE,
    });
    await expect(service.login(request({ password: WRONG_PASSWORD }))).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(sessionRepo.byUser.size).toBe(0);
  });

  it('answers the 5th wrong password with the lockout itself, and refuses even the right one after', async () => {
    for (let i = 0; i < LOGIN_ATTEMPTS_PER_ROUND - 1; i += 1) {
      await expect(service.login(request({ password: WRONG_PASSWORD }))).rejects.toMatchObject({
        statusCode: 401,
      });
    }
    const fifth = await service
      .login(request({ password: WRONG_PASSWORD }))
      .catch((e: unknown) => e);
    expect(fifth).toMatchObject({
      statusCode: 429,
      data: { retryAfterSeconds: 30, attempt: 5, attemptsPerRound: 5, nextWaitSeconds: 300 },
    });
    await expect(service.login(request())).rejects.toMatchObject({
      statusCode: 429,
      data: { attempt: 5 },
    });
    expect(sessionRepo.byUser.size).toBe(0);
  });

  it('counts a burst of parallel guesses one at a time: only five reach the password check', async () => {
    const burst = Array.from({ length: 20 }, (_, index) =>
      service
        .login(request({ password: index === 19 ? PASSWORD : WRONG_PASSWORD }))
        .catch((e: unknown) => e),
    );
    const results = (await Promise.all(burst)) as { statusCode: number }[];
    expect(hasher.verify).toHaveBeenCalledTimes(LOGIN_ATTEMPTS_PER_ROUND);
    expect(results.filter((result) => result.statusCode === 401)).toHaveLength(
      LOGIN_ATTEMPTS_PER_ROUND - 1,
    );
    expect(results.filter((result) => result.statusCode === 429)).toHaveLength(
      20 - (LOGIN_ATTEMPTS_PER_ROUND - 1),
    );
    // The right password at the end of the burst is refused too: the lock was already on.
    expect(sessionRepo.byUser.size).toBe(0);
  });

  it('keeps accounts independent: a queue on one does not hold up another', async () => {
    await users.create({
      firstName: 'Sam',
      lastName: 'Roe',
      email: 'sam@example.com',
      countryCode: '91',
      mobile: '9876543211',
      passwordHash: `hash:${PASSWORD}`,
    });
    const [jane, ghost] = await Promise.all([
      service.login(request()),
      service.login(request({ email: 'ghost@example.com' })).catch((e: unknown) => e),
    ]);
    expect(jane.token).toBeTruthy();
    expect(ghost).toMatchObject({ statusCode: 401 });
  });

  it('lets the account in again once the wait is over', async () => {
    let now = NOW.getTime();
    const clocked = new AuthService(
      users,
      hasher,
      new SessionStore(sessionRepo),
      new LoginThrottle(() => now),
      logger,
      () => NOW,
    );
    for (let i = 0; i < LOGIN_ATTEMPTS_PER_ROUND; i += 1) {
      await clocked.login(request({ password: WRONG_PASSWORD })).catch(() => undefined);
    }
    await expect(clocked.login(request())).rejects.toMatchObject({ statusCode: 429 });
    now += 31_000;
    await expect(clocked.login(request())).resolves.toBeDefined();
  });

  it('a success resets the failure count', async () => {
    for (let i = 0; i < LOGIN_ATTEMPTS_PER_ROUND - 1; i += 1) {
      await service.login(request({ password: WRONG_PASSWORD })).catch(() => undefined);
    }
    await service.login(request());
    for (let i = 0; i < LOGIN_ATTEMPTS_PER_ROUND - 1; i += 1) {
      await service.login(request({ password: WRONG_PASSWORD })).catch(() => undefined);
    }
    await expect(service.login(request())).resolves.toBeDefined();
  });
});

describe('AuthService.changePassword', () => {
  const NEXT = fakePassword();

  it('stores the new hash after checking the current password', async () => {
    await service.changePassword(userId, PASSWORD, NEXT);
    expect(users.rows.get(userId)?.passwordHash).toBe(`hash:${NEXT}`);
    expect(users.rows.get(userId)?.passwordChangedAt).toEqual(NOW);
  });

  it('refuses a wrong current password and changes nothing', async () => {
    await expect(service.changePassword(userId, WRONG_PASSWORD, NEXT)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(users.rows.get(userId)?.passwordHash).toBe(`hash:${PASSWORD}`);
    expect(hasher.hash).not.toHaveBeenCalled();
  });

  it('shares the lockout with login: five wrong tries lock the account, even for the right one', async () => {
    for (let i = 0; i < LOGIN_ATTEMPTS_PER_ROUND - 1; i += 1) {
      await expect(service.changePassword(userId, WRONG_PASSWORD, NEXT)).rejects.toMatchObject({
        statusCode: 400,
      });
    }
    await expect(service.changePassword(userId, WRONG_PASSWORD, NEXT)).rejects.toMatchObject({
      statusCode: 429,
    });
    await expect(service.changePassword(userId, PASSWORD, NEXT)).rejects.toMatchObject({
      statusCode: 429,
    });
    expect(users.rows.get(userId)?.passwordHash).toBe(`hash:${PASSWORD}`);
  });

  it('is refused for a user that no longer exists', async () => {
    await expect(service.changePassword('missing', PASSWORD, NEXT)).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});

describe('AuthService.logout', () => {
  it('removes the session', async () => {
    await service.login(request());
    await service.logout(userId);
    expect(sessionRepo.byUser.size).toBe(0);
  });

  it('is fine when there is no session', async () => {
    await expect(service.logout(userId)).resolves.toBeUndefined();
  });
});

describe('AuthService.markRecoveryKeyConfigured', () => {
  it('records the time once and keeps the first one on repeats', async () => {
    await service.markRecoveryKeyConfigured(userId);
    const first = users.rows.get(userId)?.recoveryKeyConfiguredAt;
    expect(first).toEqual(NOW);
    await service.markRecoveryKeyConfigured(userId);
    expect(users.rows.get(userId)?.recoveryKeyConfiguredAt).toEqual(first);
  });

  it('refuses a user that no longer exists', async () => {
    await expect(service.markRecoveryKeyConfigured('gone')).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});
