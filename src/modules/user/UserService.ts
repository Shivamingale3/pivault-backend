import { NotFoundError } from '../../core/errors/HttpErrors.js';
import type { IUserRepository } from './IUserRepository.js';
import type { CreateUserData, User } from './user.types.js';

const USER_NOT_FOUND = 'User not found';

/** Business rules for users. Knows nothing about HTTP or the database. */
export class UserService {
  constructor(private readonly users: IUserRepository) {}

  async getById(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError(USER_NOT_FOUND);
    return user;
  }

  /** Expects normalised input and an already-hashed password (register flow does both). */
  create(data: CreateUserData): Promise<User> {
    return this.users.create(data);
  }

  /** Removes a user, e.g. to undo a registration that could not be completed. */
  async delete(id: string): Promise<void> {
    await this.users.delete(id);
  }

  async markRecoveryKeyConfigured(id: string, at: Date = new Date()): Promise<void> {
    const found = await this.users.markRecoveryKeyConfigured(id, at);
    if (!found) throw new NotFoundError(USER_NOT_FOUND);
  }
}
