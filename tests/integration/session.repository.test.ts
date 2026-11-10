import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PrismaSessionRepository } from '../../src/modules/session/PrismaSessionRepository.js';
import { SESSION_KEY_ALGORITHM } from '../../src/modules/session/session.types.js';
import { PrismaUserRepository } from '../../src/modules/user/PrismaUserRepository.js';
import { database, db, truncateUsers } from '../helpers/db.js';
import { userData } from '../helpers/fixtures.js';

const users = new PrismaUserRepository(db);
const sessions = new PrismaSessionRepository(db);
const DAY_MS = 24 * 60 * 60 * 1000;

const sessionFor = (
  userId: string,
  tokenHash: string,
  expiresAt = new Date(Date.now() + DAY_MS),
) => ({
  userId,
  tokenHash,
  publicKey: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE-test',
  expiresAt,
  userAgent: 'vitest',
  ipAddress: '127.0.0.1',
});

beforeEach(truncateUsers);
afterAll(() => database.disconnect());

describe('PrismaSessionRepository', () => {
  it('creates the first session with the device key algorithm', async () => {
    const user = await users.create(userData());
    const { session, previousTokenHash } = await sessions.replaceForUser(
      sessionFor(user.id, 'a'.repeat(64)),
    );
    expect(previousTokenHash).toBeNull();
    expect(session.keyAlgorithm).toBe(SESSION_KEY_ALGORITHM);
  });

  it('keeps one session per user: a new login replaces the old one', async () => {
    const user = await users.create(userData());
    await sessions.replaceForUser(sessionFor(user.id, 'a'.repeat(64)));
    const { previousTokenHash } = await sessions.replaceForUser(
      sessionFor(user.id, 'b'.repeat(64)),
    );

    expect(previousTokenHash).toBe('a'.repeat(64));
    expect(await sessions.findByTokenHash('a'.repeat(64))).toBeNull();
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
  });

  it('cascades when the user is deleted', async () => {
    const user = await users.create(userData());
    await sessions.replaceForUser(sessionFor(user.id, 'c'.repeat(64)));
    await db.user.delete({ where: { id: user.id } });
    expect(await sessions.findByTokenHash('c'.repeat(64))).toBeNull();
  });

  it('deleteByUserId returns the removed token hash', async () => {
    const user = await users.create(userData());
    await sessions.replaceForUser(sessionFor(user.id, 'd'.repeat(64)));
    expect(await sessions.deleteByUserId(user.id)).toBe('d'.repeat(64));
    expect(await sessions.deleteByUserId(user.id)).toBeNull();
  });

  it('deleteExpired removes only expired sessions', async () => {
    const [live, dead] = await Promise.all([users.create(userData()), users.create(userData())]);
    await sessions.replaceForUser(sessionFor(live.id, 'e'.repeat(64)));
    await sessions.replaceForUser(sessionFor(dead.id, 'f'.repeat(64), new Date(Date.now() - 1000)));
    expect(await sessions.deleteExpired(new Date())).toBe(1);
    expect(await sessions.findByTokenHash('e'.repeat(64))).not.toBeNull();
  });

  it('touch() updates lastSeenAt', async () => {
    const user = await users.create(userData());
    const { session } = await sessions.replaceForUser(sessionFor(user.id, '1'.repeat(64)));
    const later = new Date(session.lastSeenAt.getTime() + 60_000);
    await sessions.touch(session.id, later);
    expect((await sessions.findByTokenHash('1'.repeat(64)))?.lastSeenAt).toEqual(later);
  });
});
