import type { ResetPurpose } from './passwordReset.constants.js';

export interface PasswordResetToken {
  id: string;
  userId: string;
  /** SHA-256 hex of the raw token. The raw token only ever exists in the emailed link. */
  tokenHash: string;
  purpose: ResetPurpose;
  expiresAt: Date;
  createdAt: Date;
}

export interface CreateResetTokenData {
  userId: string;
  tokenHash: string;
  purpose: ResetPurpose;
  expiresAt: Date;
}

export interface ReplacedResetToken {
  token: PasswordResetToken;
  /** Hash of the token this one replaced, if any. */
  previousTokenHash: string | null;
}
