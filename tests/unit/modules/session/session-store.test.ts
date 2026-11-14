import { describe, it, expect, beforeEach } from 'vitest';
import { ulid } from 'ulid';
import { SessionStore } from '../../../../src/modules/session/SessionStore.js';
import { InMemorySessionRepository } from '../../../helpers/InMemorySessionRepository.js';

const HOUR_MS = 60 * 60 * 1000;
let clock = Date.parse('2026-11-09T12:00:00Z');
let repo: InMemorySessionRepository;
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
  store = new SessionStore(repo, () => new Date(clock));
});

describe('SessionStore', () => {
  it('creates a session and finds it by token hash', async () => {
    const userId = ulid();
    const created = await store.replace(newSession(userId, 'a'.repeat(64)));
    const found = await store.findActive('a'.repeat(64));
    expect(found).toMatchObject({ id: created.id, userId });
    expect(found?.expiresAt).toBeInstanceOf(Date);
  });

  it('returns null for an unknown token', async () => {
    expect(await store.findActive('0'.repeat(64))).toBeNull();
  });

  it('rejects the previous token as soon as the user logs in elsewhere', async () => {
    const userId = ulid();
    await store.replace(newSession(userId, 'e'.repeat(64)));
    await store.replace(newSession(userId, 'f'.repeat(64)));
    expect(await store.findActive('e'.repeat(64))).toBeNull();
    expect(await store.findActive('f'.repeat(64))).not.toBeNull();
    expect(repo.byUser.size).toBe(1);
  });

  it('rejects and removes expired sessions', async () => {
    await store.replace(newSession(ulid(), '1'.repeat(64), 2 * HOUR_MS));
    clock += 3 * HOUR_MS;
    expect(await store.findActive('1'.repeat(64))).toBeNull();
    expect(repo.byUser.size).toBe(0);
  });

  it('revokes the session of a user, and is a no-op when there is none', async () => {
    const userId = ulid();
    await store.replace(newSession(userId, '2'.repeat(64)));
    await store.revokeForUser(userId);
    expect(await store.findActive('2'.repeat(64))).toBeNull();
    await expect(store.revokeForUser(userId)).resolves.toBeUndefined();
  });

  it('propagates repository failures instead of treating them as "no session"', async () => {
    repo.findByTokenHash = () => Promise.reject(new Error('db down'));
    await expect(store.findActive('3'.repeat(64))).rejects.toThrow('db down');
  });
});
