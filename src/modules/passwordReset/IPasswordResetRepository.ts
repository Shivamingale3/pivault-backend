import type { CreateResetTokenData, ReplacedResetToken } from './passwordReset.types.js';

/** A user has at most one live reset token; issuing a new one replaces the old. */
export interface IPasswordResetRepository {
  replaceForUser(data: CreateResetTokenData): Promise<ReplacedResetToken>;
}
