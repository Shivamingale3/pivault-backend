import { ulid } from 'ulid';
import type { IPasswordResetRepository } from '../../src/modules/passwordReset/IPasswordResetRepository.js';
import type {
  ConsumedResetToken,
  ConsumeResetTokenData,
  CreateResetTokenData,
  PasswordResetToken,
  ReplacedResetToken,
} from '../../src/modules/passwordReset/passwordReset.types.js';
import type { InMemorySessionRepository } from './InMemorySessionRepository.js';
import type { InMemoryUserRepository } from './InMemoryUserRepository.js';

/**
 * In-memory `IPasswordResetRepository`: one token per user, keyed by userId.
 * Pass the user/session fakes to let `consumeToSetPassword` apply its side effects.
 */
export class InMemoryPasswordResetRepository implements IPasswordResetRepository {
  readonly byUser = new Map<string, PasswordResetToken>();

  constructor(
    private readonly users?: InMemoryUserRepository,
    private readonly sessions?: InMemorySessionRepository,
  ) {}

  replaceForUser(data: CreateResetTokenData): Promise<ReplacedResetToken> {
    const previous = this.byUser.get(data.userId);
    const token: PasswordResetToken = { id: ulid(), createdAt: new Date(), ...data };
    this.byUser.set(data.userId, token);
    return Promise.resolve({ token, previousTokenHash: previous?.tokenHash ?? null });
  }

  findByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const found = [...this.byUser.values()].find((token) => token.tokenHash === tokenHash);
    return Promise.resolve(found ? { ...found } : null);
  }

  consumeToSetPassword(data: ConsumeResetTokenData): Promise<ConsumedResetToken | null> {
    const token = [...this.byUser.values()].find((t) => t.tokenHash === data.tokenHash);
    if (!token || token.expiresAt <= data.now) return Promise.resolve(null);
    this.byUser.delete(token.userId);
    const user = this.users?.rows.get(token.userId);
    if (user) {
      user.passwordHash = data.passwordHash;
      user.passwordChangedAt = data.now;
      user.emailVerifiedAt ??= data.now;
    }
    this.sessions?.byUser.delete(token.userId);
    return Promise.resolve({ userId: token.userId, purpose: token.purpose });
  }

  deleteExpired(now: Date): Promise<number> {
    let removed = 0;
    for (const [userId, token] of this.byUser) {
      if (token.expiresAt <= now) {
        this.byUser.delete(userId);
        removed += 1;
      }
    }
    return Promise.resolve(removed);
  }
}
