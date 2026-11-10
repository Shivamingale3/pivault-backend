import { CACHE_TTL_SECONDS, CacheKeys } from '../../core/cache/cache.constants.js';
import type { ICache } from '../../core/cache/ICache.js';
import type { ILogger } from '../../core/logger/ILogger.js';
import type { ISessionRepository } from './ISessionRepository.js';
import type { CreateSessionData, Session } from './session.types.js';

/** Sessions round-trip through JSON in the cache, so dates come back as strings. */
type CachedSession = Omit<Session, 'createdAt' | 'lastSeenAt' | 'expiresAt'> & {
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

const revive = (cached: CachedSession): Session => ({
  ...cached,
  createdAt: new Date(cached.createdAt),
  lastSeenAt: new Date(cached.lastSeenAt),
  expiresAt: new Date(cached.expiresAt),
});

/**
 * Cache-aside access to sessions: Redis first, Postgres as the source of truth.
 * Cache entries never outlive the session, and replacing or deleting a session
 * evicts the old token immediately, so a device that was logged out elsewhere
 * is rejected on its very next request.
 */
export class SessionStore {
  constructor(
    private readonly sessions: ISessionRepository,
    private readonly cache: ICache,
    private readonly logger: ILogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Creates the user's only session, evicting the one it replaces. */
  async replace(data: CreateSessionData): Promise<Session> {
    const { session, previousTokenHash } = await this.sessions.replaceForUser(data);
    if (previousTokenHash) await this.evict(previousTokenHash);
    await this.remember(session);
    return session;
  }

  /** Returns a live (unexpired) session for the token hash, or null. */
  async findActive(tokenHash: string): Promise<Session | null> {
    const cached = await this.cache.get<CachedSession>(CacheKeys.session(tokenHash));
    const session = cached ? revive(cached) : await this.sessions.findByTokenHash(tokenHash);
    if (!session) return null;

    if (session.expiresAt <= this.now()) {
      await this.evict(tokenHash);
      return null;
    }
    if (!cached) await this.remember(session);
    return session;
  }

  async revokeForUser(userId: string): Promise<void> {
    const tokenHash = await this.sessions.deleteByUserId(userId);
    if (tokenHash) await this.evict(tokenHash);
  }

  private async remember(session: Session): Promise<void> {
    const secondsLeft = Math.floor((session.expiresAt.getTime() - this.now().getTime()) / 1000);
    const ttl = Math.min(CACHE_TTL_SECONDS.SESSION, secondsLeft);
    if (ttl <= 0) return;
    try {
      await this.cache.set(CacheKeys.session(session.tokenHash), session, ttl);
    } catch (error) {
      // Caching is an optimisation; the database stays authoritative.
      this.logger.warn('Could not cache session; continuing without cache.', error);
    }
  }

  /** Eviction failures are logged loudly: a stale entry could outlive a revoked session. */
  private async evict(tokenHash: string): Promise<void> {
    try {
      await this.cache.delete(CacheKeys.session(tokenHash));
    } catch (error) {
      this.logger.error('Could not evict a revoked session from the cache.', error);
      throw error;
    }
  }
}
