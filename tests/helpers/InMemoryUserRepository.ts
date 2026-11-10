import { ulid } from 'ulid';
import type { IUserRepository } from '../../src/modules/user/IUserRepository.js';
import { UserConflictError } from '../../src/modules/user/user.errors.js';
import type {
  CreateUserData,
  User,
  UserWithPasswordHash,
} from '../../src/modules/user/user.types.js';

/** In-memory `IUserRepository` honouring the same contract as the Prisma one. */
export class InMemoryUserRepository implements IUserRepository {
  readonly rows = new Map<string, UserWithPasswordHash>();

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.publicCopy(this.rows.get(id)));
  }

  findByEmail(email: string): Promise<User | null> {
    return Promise.resolve(this.publicCopy(this.byEmail(email)));
  }

  findAuthByEmail(email: string): Promise<UserWithPasswordHash | null> {
    const row = this.byEmail(email);
    return Promise.resolve(row ? { ...row } : null);
  }

  async create(data: CreateUserData): Promise<User> {
    for (const row of this.rows.values()) {
      if (row.email === data.email) throw new UserConflictError('email');
      if (row.mobile === data.mobile) throw new UserConflictError('mobile');
    }
    const now = new Date();
    const row: UserWithPasswordHash = {
      id: ulid(),
      ...data,
      passwordChangedAt: null,
      recoveryKeyConfiguredAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return this.publicCopy(row) as User;
  }

  markRecoveryKeyConfigured(id: string, at: Date): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row) return Promise.resolve(false);
    row.recoveryKeyConfiguredAt ??= at;
    return Promise.resolve(true);
  }

  private byEmail(email: string): UserWithPasswordHash | undefined {
    return [...this.rows.values()].find((row) => row.email === email);
  }

  private publicCopy(row: UserWithPasswordHash | undefined): User | null {
    if (!row) return null;
    const { passwordHash: _hidden, ...user } = row;
    return user;
  }
}
