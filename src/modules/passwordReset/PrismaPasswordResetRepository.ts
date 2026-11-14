import type { PrismaClient } from '@prisma/client';
import type { IPasswordResetRepository } from './IPasswordResetRepository.js';
import type {
  ConsumedResetToken,
  ConsumeResetTokenData,
  CreateResetTokenData,
  PasswordResetToken,
  ReplacedResetToken,
} from './passwordReset.types.js';

export class PrismaPasswordResetRepository implements IPasswordResetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Delete + create in one transaction, so a user never has two live tokens. */
  replaceForUser(data: CreateResetTokenData): Promise<ReplacedResetToken> {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.passwordResetToken.findUnique({
        where: { userId: data.userId },
        select: { tokenHash: true },
      });
      if (previous) await tx.passwordResetToken.delete({ where: { userId: data.userId } });
      const token = await tx.passwordResetToken.create({ data });
      return { token: token as PasswordResetToken, previousTokenHash: previous?.tokenHash ?? null };
    });
  }

  async findByHash(tokenHash: string): Promise<PasswordResetToken | null> {
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    return row as PasswordResetToken | null;
  }

  /**
   * The delete is the lock: it only matches an unexpired row, and a concurrent second delete
   * of the same row sees count 0 once the first commits. Everything else rides the same
   * transaction, so a half-applied password change is impossible.
   */
  consumeToSetPassword(data: ConsumeResetTokenData): Promise<ConsumedResetToken | null> {
    const { tokenHash, passwordHash, now } = data;
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { userId: true, purpose: true },
      });
      if (!token) return null;
      const { count } = await tx.passwordResetToken.deleteMany({
        where: { tokenHash, expiresAt: { gt: now } },
      });
      if (count !== 1) return null;
      await tx.user.update({
        where: { id: token.userId },
        data: { passwordHash, passwordChangedAt: now },
      });
      await tx.user.updateMany({
        where: { id: token.userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: now },
      });
      await tx.session.deleteMany({ where: { userId: token.userId } });
      return { userId: token.userId, purpose: token.purpose as ConsumedResetToken['purpose'] };
    });
  }

  async deleteExpired(now: Date): Promise<number> {
    const { count } = await this.prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    return count;
  }
}
