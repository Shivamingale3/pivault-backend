import type { CreateUserData, RecoveryKeyCheck, User, UserWithPasswordHash } from './user.types.js';

/**
 * Persistence contract for users (Repository pattern). The service depends on
 * this interface only, so it can run against Prisma or an in-memory fake.
 *
 * Implementations MUST:
 * - throw `UserConflictError` naming the field when the email or the (countryCode, mobile) pair is taken;
 * - return `null` / `false` (not throw) when the target row does not exist;
 * - never include `passwordHash` except from `findAuthByEmail` and `findAuthById`.
 */
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAuthByEmail(email: string): Promise<UserWithPasswordHash | null>;
  /** For checking the current password of a signed-in user. */
  findAuthById(id: string): Promise<UserWithPasswordHash | null>;
  /** Sets a new password hash and `passwordChangedAt`. Returns false when the user doesn't exist. */
  updatePassword(id: string, passwordHash: string, at: Date): Promise<boolean>;
  create(data: CreateUserData): Promise<User>;
  /** Idempotent: keeps the first timestamp. Returns false when the user doesn't exist. */
  markRecoveryKeyConfigured(id: string, at: Date): Promise<boolean>;
  /** Keeps the first check ever stored (a later one is ignored). No-op for an unknown user. */
  saveRecoveryKeyCheck(id: string, check: RecoveryKeyCheck): Promise<void>;
  /** Overwrites the check (a new recovery key replaced the old one). Returns false for an unknown user. */
  replaceRecoveryKeyCheck(id: string, check: RecoveryKeyCheck): Promise<boolean>;
  /** The stored check, or null when there is none (or no such user). */
  findRecoveryKeyCheck(id: string): Promise<RecoveryKeyCheck | null>;
  /** Removes the user (sessions and reset tokens cascade). Returns false when the user doesn't exist. */
  delete(id: string): Promise<boolean>;
}
