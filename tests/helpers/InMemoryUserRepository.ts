import { ulid } from 'ulid';
import { ConflictError } from '../../src/core/errors/HttpErrors.js';
import type { IUserRepository } from '../../src/modules/user/IUserRepository.js';
import type { CreateUserData, UpdateUserData, User } from '../../src/modules/user/user.types.js';

/**
 * In-memory `IUserRepository` honouring the same contract as the Prisma one
 * (ConflictError on duplicate email, null/false on missing rows). Lets
 * `UserService` be tested without a database — the payoff of depending on
 * the interface rather than Prisma. Mutating methods are `async` so contract
 * violations surface as rejected promises, exactly like the real repository.
 */
export class InMemoryUserRepository implements IUserRepository {
  readonly rows = new Map<string, User>();

  findPage(skip: number, take: number): Promise<User[]> {
    const sorted = [...this.rows.values()].sort((a, b) => b.id.localeCompare(a.id));
    return Promise.resolve(sorted.slice(skip, skip + take));
  }

  count(): Promise<number> {
    return Promise.resolve(this.rows.size);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  async create(data: CreateUserData): Promise<User> {
    this.assertEmailFree(data.email);
    const now = new Date();
    const user: User = {
      id: ulid(),
      email: data.email,
      name: data.name ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(user.id, user);
    return user;
  }

  async update(id: string, data: UpdateUserData): Promise<User | null> {
    const existing = this.rows.get(id);
    if (!existing) return null;
    if (data.email !== undefined) this.assertEmailFree(data.email, id);
    const updated: User = {
      ...existing,
      ...(data.email !== undefined && { email: data.email }),
      ...(data.name !== undefined && { name: data.name }),
      updatedAt: new Date(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  delete(id: string): Promise<boolean> {
    return Promise.resolve(this.rows.delete(id));
  }

  private assertEmailFree(email: string, exceptId?: string): void {
    for (const user of this.rows.values()) {
      if (user.email === email && user.id !== exceptId) {
        throw new ConflictError('Email already in use');
      }
    }
  }
}
