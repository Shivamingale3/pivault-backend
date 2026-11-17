import type { ISessionRepository } from './ISessionRepository.js';
import type { CreateSessionData, Session } from './session.types.js';

/**
 * Sessions live in Postgres only, so a session replaced or revoked elsewhere
 * is rejected on its very next request. They are never ended by the clock.
 */
export class SessionStore {
  constructor(private readonly sessions: ISessionRepository) {}

  /** Creates the user's only session, replacing the previous one. */
  async replace(data: CreateSessionData): Promise<Session> {
    const { session } = await this.sessions.replaceForUser(data);
    return session;
  }

  /**
   * The session for the token hash, or null. Sessions never expire by time (see
   * `SESSION_NEVER_EXPIRES_AT`): `expiresAt` is deliberately not checked, so sessions created
   * before that rule keep working too.
   */
  findActive(tokenHash: string): Promise<Session | null> {
    return this.sessions.findByTokenHash(tokenHash);
  }

  async revokeForUser(userId: string): Promise<void> {
    await this.sessions.deleteByUserId(userId);
  }
}
