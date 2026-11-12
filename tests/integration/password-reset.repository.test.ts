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
});
