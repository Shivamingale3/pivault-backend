import type { CreateSessionData, ReplacedSession, Session } from './session.types.js';

/**
 * Persistence contract for sessions. One user has at most one session:
 * `replaceForUser` atomically removes the previous one.
 */
export interface ISessionRepository {
  replaceForUser(data: CreateSessionData): Promise<ReplacedSession>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  touch(id: string, at: Date): Promise<void>;
  /** Returns the removed session's token hash, or null if there was none. */
  deleteByUserId(userId: string): Promise<string | null>;
  /** Removes sessions that expired before `now`; returns how many. */
  deleteExpired(now: Date): Promise<number>;
}
