import { NotFoundError } from '../../core/errors/HttpErrors.js';
import {
  buildPage,
  toSkipTake,
  type Paginated,
  type PaginationParams,
} from '../../core/http/Pagination.js';
import type { IUserRepository } from './IUserRepository.js';
import type { CreateUserData, UpdateUserData, User } from './user.types.js';

const USER_NOT_FOUND = 'User not found';

/** Business rules for users. Knows nothing about HTTP or the database. */
export class UserService {
  constructor(private readonly users: IUserRepository) {}

  async list(params: PaginationParams): Promise<Paginated<User>> {
    const { skip, take } = toSkipTake(params);
    const [items, total] = await Promise.all([this.users.findPage(skip, take), this.users.count()]);
    return buildPage(items, total, params);
  }

  async getById(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError(USER_NOT_FOUND);
    return user;
  }

  create(data: CreateUserData): Promise<User> {
    return this.users.create(data);
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    const user = await this.users.update(id, data);
    if (!user) throw new NotFoundError(USER_NOT_FOUND);
    return user;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.users.delete(id);
    if (!deleted) throw new NotFoundError(USER_NOT_FOUND);
  }
}
