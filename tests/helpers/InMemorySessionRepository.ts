import { ulid } from 'ulid';
import type { ISessionRepository } from '../../src/modules/session/ISessionRepository.js';
import {
  SESSION_KEY_ALGORITHM,
  type CreateSessionData,
  type ReplacedSession,
  type Session,
} from '../../src/modules/session/session.types.js';

/** In-memory `ISessionRepository`: one session per user, keyed by userId. */
export class InMemorySessionRepository implements ISessionRepository {
  readonly byUser = new Map<string, Session>();
  lookups = 0;

  replaceForUser(data: CreateSessionData): Promise<ReplacedSession> {
    const previous = this.byUser.get(data.userId);
    const now = new Date();
    const session: Session = {
      id: ulid(),
      userId: data.userId,
      tokenHash: data.tokenHash,
      publicKey: data.publicKey,
      keyAlgorithm: SESSION_KEY_ALGORITHM,
      userAgent: data.userAgent ?? null,
      ipAddress: data.ipAddress ?? null,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: data.expiresAt,
    };
    this.byUser.set(data.userId, session);
    return Promise.resolve({ session, previousTokenHash: previous?.tokenHash ?? null });
  }

  findByTokenHash(tokenHash: string): Promise<Session | null> {
    this.lookups += 1;
    const found = [...this.byUser.values()].find((s) => s.tokenHash === tokenHash);
    return Promise.resolve(found ? { ...found } : null);
  }

  touch(id: string, at: Date): Promise<void> {
    for (const session of this.byUser.values()) if (session.id === id) session.lastSeenAt = at;
    return Promise.resolve();
  }

  deleteByUserId(userId: string): Promise<string | null> {
    const session = this.byUser.get(userId);
    this.byUser.delete(userId);
    return Promise.resolve(session?.tokenHash ?? null);
  }

  deleteExpired(now: Date): Promise<number> {
    let removed = 0;
    for (const [userId, session] of this.byUser) {
      if (session.expiresAt < now) {
        this.byUser.delete(userId);
        removed += 1;
      }
    }
    return Promise.resolve(removed);
  }
}
