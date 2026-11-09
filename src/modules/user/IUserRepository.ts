import type { CreateUserData, UpdateUserData, User } from './user.types.js';

/**
 * Persistence contract for users (Repository pattern). The service depends on
 * this interface only, so it can run against Prisma, another ORM, or an
 * in-memory fake in tests.
 *
 * Implementations MUST:
 * - throw `ConflictError` when an email is already taken (create/update);
 * - return `null` / `false` (not throw) when the target row does not exist.
 */
export interface IUserRepository {
  /** Newest first. */
  findPage(skip: number, take: number): Promise<User[]>;
  count(): Promise<number>;
  findById(id: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User | null>;
  delete(id: string): Promise<boolean>;
}
