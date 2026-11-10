import type { PrismaClient } from '@prisma/client';
import { uniqueViolationFields } from '../../core/database/prismaErrors.js';
import type { IUserRepository } from './IUserRepository.js';
import { UserConflictError } from './user.errors.js';
import type { CreateUserData, User, UserWithPasswordHash } from './user.types.js';

/** Only public fields leave the repository by default (no password hash). */
const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  countryCode: true,
  mobile: true,
  passwordChangedAt: true,
  recoveryKeyConfiguredAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email }, select: USER_SELECT });
  }

  findAuthByEmail(email: string): Promise<UserWithPasswordHash | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { ...USER_SELECT, passwordHash: true },
    });
  }

  /** Uniqueness is enforced by the DB constraints — no racy check-then-insert. */
  async create(data: CreateUserData): Promise<User> {
    try {
      return await this.prisma.user.create({ data, select: USER_SELECT });
    } catch (error) {
      const fields = uniqueViolationFields(error);
      if (fields?.includes('mobile')) throw new UserConflictError('mobile', { cause: error });
      if (fields) throw new UserConflictError('email', { cause: error });
      throw error;
    }
  }

  async markRecoveryKeyConfigured(id: string, at: Date): Promise<boolean> {
    const { count } = await this.prisma.user.updateMany({
      where: { id, recoveryKeyConfiguredAt: null },
      data: { recoveryKeyConfiguredAt: at },
    });
    if (count > 0) return true;
    return (await this.prisma.user.count({ where: { id } })) > 0;
  }
}
