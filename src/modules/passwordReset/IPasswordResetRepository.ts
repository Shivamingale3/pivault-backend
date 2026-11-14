import type {
  ConsumedResetToken,
  ConsumeResetTokenData,
  CreateResetTokenData,
  PasswordResetToken,
  ReplacedResetToken,
} from './passwordReset.types.js';

/** A user has at most one live reset token; issuing a new one replaces the old. */
export interface IPasswordResetRepository {
  replaceForUser(data: CreateResetTokenData): Promise<ReplacedResetToken>;
  /** Returns the token for a hash, expired or not (the caller decides), or null. */
  findByHash(tokenHash: string): Promise<PasswordResetToken | null>;
  /**
   * Spends a token and applies it, atomically and exactly once:
   * deletes the token only if it is unexpired, then sets the user's password hash and
   * `passwordChangedAt`, sets `emailVerifiedAt` if still empty, and removes the user's session.
   * Returns null (changing nothing) when the token is unknown, expired or already spent,
   * so of two concurrent calls with the same token only one succeeds.
   */
  consumeToSetPassword(data: ConsumeResetTokenData): Promise<ConsumedResetToken | null>;
  /** Removes tokens that expired before `now`; returns how many. */
  deleteExpired(now: Date): Promise<number>;
}
