import type { PrismaClient } from '@prisma/client';
import { isPrismaError, PrismaErrorCode } from '../../core/database/prismaErrors.js';
import type { ISessionRepository } from './ISessionRepository.js';
import {
  SESSION_KEY_ALGORITHM,
  type CreateSessionData,
  type ReplacedSession,
  type Session,
} from './session.types.js';

export class PrismaSessionRepository implements ISessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Delete + create in one transaction, so a user never has two live sessions. */
  replaceForUser(data: CreateSessionData): Promise<ReplacedSession> {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.session.findUnique({
        where: { userId: data.userId },
        select: { tokenHash: true },
      });
      if (previous) await tx.session.delete({ where: { userId: data.userId } });

      const session = await tx.session.create({
        data: {
          userId: data.userId,
          tokenHash: data.tokenHash,
          publicKey: data.publicKey,
          keyAlgorithm: SESSION_KEY_ALGORITHM,
          expiresAt: data.expiresAt,
          userAgent: data.userAgent ?? null,
          ipAddress: data.ipAddress ?? null,
        },
      });
      return { session, previousTokenHash: previous?.tokenHash ?? null };
    });
  }

  findByTokenHash(tokenHash: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { tokenHash } });
  }

  async touch(id: string, at: Date): Promise<void> {
    await this.prisma.session.updateMany({ where: { id }, data: { lastSeenAt: at } });
  }

  async deleteByUserId(userId: string): Promise<string | null> {
    try {
      const removed = await this.prisma.session.delete({
        where: { userId },
        select: { tokenHash: true },
      });
      return removed.tokenHash;
    } catch (error) {
      if (isPrismaError(error, PrismaErrorCode.RecordNotFound)) return null;
      throw error;
    }
  }

  async deleteExpired(now: Date): Promise<number> {
    const { count } = await this.prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
    return count;
  }
}
