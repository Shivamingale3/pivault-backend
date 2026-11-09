import type { PrismaClient } from '@prisma/client';
import { isPrismaError, PrismaErrorCode } from '../../core/database/prismaErrors.js';
import { ConflictError } from '../../core/errors/HttpErrors.js';
import type { IUserRepository } from './IUserRepository.js';
import type { CreateUserData, UpdateUserData, User } from './user.types.js';

/** Only domain fields ever leave the repository (future columns stay private). */
const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const;

const EMAIL_TAKEN = 'Email already in use';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findPage(skip: number, take: number): Promise<User[]> {
    return this.prisma.user.findMany({
      skip,
      take,
      // ULIDs are time-ordered, so `id` is a stable tie-breaker.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: USER_SELECT,
    });
  }

  count(): Promise<number> {
    return this.prisma.user.count();
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  }

  async create(data: CreateUserData): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: { email: data.email, name: data.name ?? null },
        select: USER_SELECT,
      });
    } catch (error) {
      throw this.translateUniqueViolation(error);
    }
  }

  async update(id: string, data: UpdateUserData): Promise<User | null> {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...(data.email !== undefined && { email: data.email }),
          ...(data.name !== undefined && { name: data.name }),
        },
        select: USER_SELECT,
      });
    } catch (error) {
      if (isPrismaError(error, PrismaErrorCode.RecordNotFound)) return null;
      throw this.translateUniqueViolation(error);
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.user.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isPrismaError(error, PrismaErrorCode.RecordNotFound)) return false;
      throw error;
    }
  }

  /** Uniqueness is enforced by the DB constraint — no racy check-then-insert. */
  private translateUniqueViolation(error: unknown): unknown {
    return isPrismaError(error, PrismaErrorCode.UniqueConstraintViolation)
      ? new ConflictError(EMAIL_TAKEN, { cause: error })
      : error;
  }
}
