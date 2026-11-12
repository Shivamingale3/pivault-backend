import type { PrismaClient } from '@prisma/client';
import type { IPasswordResetRepository } from './IPasswordResetRepository.js';
import type {
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
}
