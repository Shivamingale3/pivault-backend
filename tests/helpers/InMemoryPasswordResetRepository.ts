import { ulid } from 'ulid';
import type { IPasswordResetRepository } from '../../src/modules/passwordReset/IPasswordResetRepository.js';
import type {
  CreateResetTokenData,
  PasswordResetToken,
  ReplacedResetToken,
} from '../../src/modules/passwordReset/passwordReset.types.js';

/** In-memory `IPasswordResetRepository`: one token per user, keyed by userId. */
export class InMemoryPasswordResetRepository implements IPasswordResetRepository {
  readonly byUser = new Map<string, PasswordResetToken>();

  replaceForUser(data: CreateResetTokenData): Promise<ReplacedResetToken> {
    const previous = this.byUser.get(data.userId);
    const token: PasswordResetToken = { id: ulid(), createdAt: new Date(), ...data };
    this.byUser.set(data.userId, token);
    return Promise.resolve({ token, previousTokenHash: previous?.tokenHash ?? null });
  }
}
