import type { CreateUserData, User, UserWithPasswordHash } from './user.types.js';

/**
 * Persistence contract for users (Repository pattern). The service depends on
 * this interface only, so it can run against Prisma or an in-memory fake.
 *
 * Implementations MUST:
 * - throw `UserConflictError` naming the field when the email or the (countryCode, mobile) pair is taken;
 * - return `null` / `false` (not throw) when the target row does not exist;
 * - never include `passwordHash` except from `findAuthByEmail`.
 */
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAuthByEmail(email: string): Promise<UserWithPasswordHash | null>;
  create(data: CreateUserData): Promise<User>;
  /** Idempotent: keeps the first timestamp. Returns false when the user doesn't exist. */
  markRecoveryKeyConfigured(id: string, at: Date): Promise<boolean>;
}
