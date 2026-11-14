import { randomBytes } from 'node:crypto';
import { sha256Hex } from '../../core/crypto/hash.js';
import { RESET_TOKEN_TTL_SECONDS, type ResetPurpose } from './passwordReset.constants.js';
import type { IPasswordResetRepository } from './IPasswordResetRepository.js';

const TOKEN_BYTES = 32;

/** The slice of the service the welcome email needs. */
export interface IResetTokenIssuer {
  /** Creates a fresh single-use token and returns the RAW value (for the emailed link only). */
  issue(userId: string, purpose: ResetPurpose): Promise<string>;
}

/**
 * Issues password-reset tokens: 256 random bits, stored only as a SHA-256 hash in Postgres.
 * One live token per user.
 */
export class PasswordResetTokenService implements IResetTokenIssuer {
  constructor(
    private readonly tokens: IPasswordResetRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async issue(userId: string, purpose: ResetPurpose): Promise<string> {
    const now = this.now();
    // Housekeeping rides along with issuing: no scheduler or queue needed at this scale.
    await this.tokens.deleteExpired(now);
    const raw = randomBytes(TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_SECONDS[purpose] * 1000);
    await this.tokens.replaceForUser({ userId, tokenHash: sha256Hex(raw), purpose, expiresAt });
    return raw;
  }
}
