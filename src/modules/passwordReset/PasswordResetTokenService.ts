import { randomBytes } from 'node:crypto';
import { CacheKeys } from '../../core/cache/cache.constants.js';
import type { ICache } from '../../core/cache/ICache.js';
import { sha256Hex } from '../../core/crypto/hash.js';
import type { ILogger } from '../../core/logger/ILogger.js';
import { RESET_TOKEN_TTL_SECONDS, type ResetPurpose } from './passwordReset.constants.js';
import type { IPasswordResetRepository } from './IPasswordResetRepository.js';

const TOKEN_BYTES = 32;

/** The slice of the service the email worker needs. */
export interface IResetTokenIssuer {
  /** Creates a fresh single-use token and returns the RAW value (for the emailed link only). */
  issue(userId: string, purpose: ResetPurpose): Promise<string>;
}

/**
 * Issues password-reset tokens: 256 random bits, stored only as a SHA-256 hash in Postgres
 * (source of truth) and in the cache with the same expiry. One live token per user.
 */
export class PasswordResetTokenService implements IResetTokenIssuer {
  constructor(
    private readonly tokens: IPasswordResetRepository,
    private readonly cache: ICache,
    private readonly logger: ILogger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async issue(userId: string, purpose: ResetPurpose): Promise<string> {
    const raw = randomBytes(TOKEN_BYTES).toString('base64url');
    const tokenHash = sha256Hex(raw);
    const ttl = RESET_TOKEN_TTL_SECONDS[purpose];
    const expiresAt = new Date(this.now().getTime() + ttl * 1000);

    const { previousTokenHash } = await this.tokens.replaceForUser({
      userId,
      tokenHash,
      purpose,
      expiresAt,
    });
    await this.cacheToken(tokenHash, { userId, purpose, expiresAt }, ttl, previousTokenHash);
    return raw;
  }

  /** Caching is an optimisation: the database stays authoritative, so failures only warn. */
  private async cacheToken(
    tokenHash: string,
    value: { userId: string; purpose: ResetPurpose; expiresAt: Date },
    ttl: number,
    previousTokenHash: string | null,
  ): Promise<void> {
    try {
      if (previousTokenHash) await this.cache.delete(CacheKeys.passwordReset(previousTokenHash));
      await this.cache.set(CacheKeys.passwordReset(tokenHash), value, ttl);
    } catch (error) {
      this.logger.warn('Could not cache a password-reset token; continuing without cache.', error);
    }
  }
}
