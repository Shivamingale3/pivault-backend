import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaUserRepository } from '../../src/modules/user/PrismaUserRepository.js';
import { UserConflictError } from '../../src/modules/user/user.errors.js';
import { database, db, truncateUsers } from '../helpers/db.js';
import { userData } from '../helpers/fixtures.js';

const repo = new PrismaUserRepository(db);

beforeEach(truncateUsers);
afterAll(() => database.disconnect());

describe('PrismaUserRepository', () => {
  it('creates a user and never returns the password hash by default', async () => {
    const user = await repo.create(userData());
    expect(user).not.toHaveProperty('passwordHash');
    expect(await repo.findByEmail(user.email)).toEqual(user);
  });

  it('creates users unverified', async () => {
    const user = await repo.create(userData());
    expect(user.emailVerifiedAt).toBeNull();
  });

  it('returns the hash only from findAuthByEmail', async () => {
    const data = userData();
    await repo.create(data);
    expect((await repo.findAuthByEmail(data.email))?.passwordHash).toBe(data.passwordHash);
  });

  it.each(['email', 'mobile'] as const)('names the clashing field: %s', async (field) => {
    const first = userData();
    await repo.create(first);
    const clash = repo.create(userData({ [field]: first[field] }));
    await expect(clash).rejects.toBeInstanceOf(UserConflictError);
    await expect(clash).rejects.toMatchObject({ field });
  });

  it('marks the recovery key configured once', async () => {
    const user = await repo.create(userData());
    const first = new Date('2026-11-01T00:00:00Z');
    expect(await repo.markRecoveryKeyConfigured(user.id, first)).toBe(true);
    expect(await repo.markRecoveryKeyConfigured(user.id, new Date())).toBe(true);
    expect((await repo.findById(user.id))?.recoveryKeyConfiguredAt).toEqual(first);
    expect(await repo.markRecoveryKeyConfigured('01J00000000000000000000000', first)).toBe(false);
  });

  it('deletes a user (sessions and reset tokens cascade) and reports whether one existed', async () => {
    const user = await repo.create(userData());
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: 'a'.repeat(64),
        purpose: 'onboarding',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    expect(await repo.delete(user.id)).toBe(true);
    expect(await repo.findById(user.id)).toBeNull();
    expect(await db.passwordResetToken.count()).toBe(0);
    expect(await repo.delete(user.id)).toBe(false);
  });
});
