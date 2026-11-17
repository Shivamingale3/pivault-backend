import { ulid } from 'ulid';
import type { IUserRepository } from '../../src/modules/user/IUserRepository.js';
import { UserConflictError } from '../../src/modules/user/user.errors.js';
import type {
  CreateUserData,
  RecoveryKeyCheck,
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

  findAuthById(id: string): Promise<UserWithPasswordHash | null> {
    const row = this.rows.get(id);
    return Promise.resolve(row ? { ...row } : null);
  }

  updatePassword(id: string, passwordHash: string, at: Date): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row) return Promise.resolve(false);
    row.passwordHash = passwordHash;
    row.passwordChangedAt = at;
    return Promise.resolve(true);
  }

  async create(data: CreateUserData): Promise<User> {
    for (const row of this.rows.values()) {
      if (row.email === data.email) throw new UserConflictError('email');
      if (row.countryCode === data.countryCode && row.mobile === data.mobile)
        throw new UserConflictError('mobile');
    }
    const now = new Date();
    const row: UserWithPasswordHash = {
      id: ulid(),
      ...data,
      passwordChangedAt: null,
      emailVerifiedAt: null,
      recoveryKeyConfiguredAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return this.publicCopy(row) as User;
  }

  delete(id: string): Promise<boolean> {
    return Promise.resolve(this.rows.delete(id));
  }

  markRecoveryKeyConfigured(id: string, at: Date): Promise<boolean> {
    const row = this.rows.get(id);
    if (!row) return Promise.resolve(false);
    row.recoveryKeyConfiguredAt ??= at;
    return Promise.resolve(true);
  }

  readonly keyChecks = new Map<string, RecoveryKeyCheck>();

  saveRecoveryKeyCheck(id: string, check: RecoveryKeyCheck): Promise<void> {
    if (this.rows.has(id) && !this.keyChecks.has(id)) this.keyChecks.set(id, check);
    return Promise.resolve();
  }

  replaceRecoveryKeyCheck(id: string, check: RecoveryKeyCheck): Promise<boolean> {
    if (!this.rows.has(id)) return Promise.resolve(false);
    this.keyChecks.set(id, check);
    return Promise.resolve(true);
  }

  findRecoveryKeyCheck(id: string): Promise<RecoveryKeyCheck | null> {
    return Promise.resolve(this.keyChecks.get(id) ?? null);
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
