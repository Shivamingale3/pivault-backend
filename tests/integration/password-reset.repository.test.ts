import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaPasswordResetRepository } from '../../src/modules/passwordReset/PrismaPasswordResetRepository.js';
import { ResetPurpose } from '../../src/modules/passwordReset/passwordReset.constants.js';
import { PrismaUserRepository } from '../../src/modules/user/PrismaUserRepository.js';
import { database, db, truncateUsers } from '../helpers/db.js';
import { userData } from '../helpers/fixtures.js';

const users = new PrismaUserRepository(db);
const tokens = new PrismaPasswordResetRepository(db);
const HOUR_MS = 60 * 60 * 1000;

const tokenFor = (
  userId: string,
  tokenHash: string,
  purpose: ResetPurpose = ResetPurpose.Reset,
) => ({
  userId,
  tokenHash,
  purpose,
  expiresAt: new Date(Date.now() + HOUR_MS),
});

beforeEach(truncateUsers);
afterAll(() => database.disconnect());

describe('PrismaPasswordResetRepository', () => {
  it('creates the first token', async () => {
    const user = await users.create(userData());
    const { token, previousTokenHash } = await tokens.replaceForUser(
      tokenFor(user.id, 'a'.repeat(64), ResetPurpose.Onboarding),
    );
    expect(previousTokenHash).toBeNull();
    expect(token).toMatchObject({ userId: user.id, purpose: 'onboarding' });
  });

  it('keeps one token per user: a new one replaces the old', async () => {
    const user = await users.create(userData());
    await tokens.replaceForUser(tokenFor(user.id, 'a'.repeat(64)));
    const { previousTokenHash } = await tokens.replaceForUser(tokenFor(user.id, 'b'.repeat(64)));

    expect(previousTokenHash).toBe('a'.repeat(64));
    const rows = await db.passwordResetToken.findMany({ where: { userId: user.id } });
    expect(rows.map((row) => row.tokenHash)).toEqual(['b'.repeat(64)]);
  });

  it('is removed with its user', async () => {
    const user = await users.create(userData());
    await tokens.replaceForUser(tokenFor(user.id, 'a'.repeat(64)));
    await db.user.delete({ where: { id: user.id } });
    expect(await db.passwordResetToken.count()).toBe(0);
  });

  describe('findByHash', () => {
    it('finds a token by its hash and returns null for an unknown one', async () => {
      const user = await users.create(userData());
      await tokens.replaceForUser(tokenFor(user.id, 'a'.repeat(64)));
      expect(await tokens.findByHash('a'.repeat(64))).toMatchObject({ userId: user.id });
      expect(await tokens.findByHash('b'.repeat(64))).toBeNull();
    });
  });

  describe('consumeToSetPassword', () => {
    const spend = (tokenHash: string, now = new Date()) =>
      tokens.consumeToSetPassword({ tokenHash, passwordHash: '$argon2id$new', now });

    it('sets the password, verifies the email, drops the token and the session', async () => {
      const user = await users.create(userData());
      await tokens.replaceForUser(tokenFor(user.id, 'a'.repeat(64), ResetPurpose.Onboarding));
      await db.session.create({
        data: {
          userId: user.id,
          tokenHash: 's'.repeat(64),
          publicKey: 'pk',
          expiresAt: new Date(Date.now() + HOUR_MS),
        },
      });
      const now = new Date();

      expect(await spend('a'.repeat(64), now)).toEqual({ userId: user.id, purpose: 'onboarding' });

      const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.passwordHash).toBe('$argon2id$new');
      expect(row.passwordChangedAt).toEqual(now);
      expect(row.emailVerifiedAt).toEqual(now);
      expect(await db.passwordResetToken.count()).toBe(0);
      expect(await db.session.count()).toBe(0);
    });

    it('keeps the first verification time', async () => {
      const user = await users.create(userData());
      const first = new Date('2026-01-01T00:00:00Z');
      await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: first } });
      await tokens.replaceForUser(tokenFor(user.id, 'a'.repeat(64)));

      await spend('a'.repeat(64));

      expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).toEqual(
        first,
      );
    });

    it('changes nothing for an expired token', async () => {
      const user = await users.create(userData());
      await tokens.replaceForUser({
        ...tokenFor(user.id, 'a'.repeat(64)),
        expiresAt: new Date(Date.now() - 1000),
      });

      expect(await spend('a'.repeat(64))).toBeNull();

      const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.passwordHash).not.toBe('$argon2id$new');
      expect(row.emailVerifiedAt).toBeNull();
      expect(await db.passwordResetToken.count()).toBe(1);
    });

    it('returns null for an unknown token', async () => {
      expect(await spend('z'.repeat(64))).toBeNull();
    });

    it('spends a token once even when two requests race', async () => {
      const user = await users.create(userData());
      await tokens.replaceForUser(tokenFor(user.id, 'a'.repeat(64)));

      const results = await Promise.all([spend('a'.repeat(64)), spend('a'.repeat(64))]);

      expect(results.filter((result) => result !== null)).toHaveLength(1);
    });
  });

  describe('deleteExpired', () => {
    it('removes only expired tokens', async () => {
      const [a, b] = await Promise.all([users.create(userData()), users.create(userData())]);
      await tokens.replaceForUser({
        ...tokenFor(a.id, 'a'.repeat(64)),
        expiresAt: new Date(Date.now() - 1000),
      });
      await tokens.replaceForUser(tokenFor(b.id, 'b'.repeat(64)));

      expect(await tokens.deleteExpired(new Date())).toBe(1);
      expect((await db.passwordResetToken.findMany()).map((t) => t.userId)).toEqual([b.id]);
    });
  });
});
