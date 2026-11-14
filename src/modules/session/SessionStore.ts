import type { ISessionRepository } from './ISessionRepository.js';
import type { CreateSessionData, Session } from './session.types.js';

/**
 * Sessions live in Postgres only, so a session replaced or revoked elsewhere
 * is rejected on its very next request.
 */
export class SessionStore {
  constructor(
    private readonly sessions: ISessionRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Creates the user's only session, replacing the previous one. */
  async replace(data: CreateSessionData): Promise<Session> {
    const { session } = await this.sessions.replaceForUser(data);
    return session;
  }

  /** Returns a live (unexpired) session for the token hash, or null. */
  async findActive(tokenHash: string): Promise<Session | null> {
    const session = await this.sessions.findByTokenHash(tokenHash);
    if (!session) return null;
    if (session.expiresAt <= this.now()) {
      await this.sessions.deleteByUserId(session.userId);
      return null;
    }
    return session;
  }

  async revokeForUser(userId: string): Promise<void> {
    await this.sessions.deleteByUserId(userId);
  }
}
