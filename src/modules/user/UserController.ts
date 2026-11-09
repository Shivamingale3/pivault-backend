import type { Request, Response } from 'express';
import { BaseController } from '../../core/http/BaseController.js';
import type {
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
  UserIdParams,
} from './user.schemas.js';
import type { UserService } from './UserService.js';

/**
 * HTTP adapter for `UserService`. Inputs are already validated and coerced by
 * `RequestValidator` in `UserRouter`, so the casts below are safe.
 */
export class UserController extends BaseController {
  constructor(private readonly users: UserService) {
    super();
  }

  readonly list = async (req: Request, res: Response): Promise<void> => {
    const page = await this.users.list(req.query as unknown as ListUsersQuery);
    this.ok(res, 'Users fetched successfully', page);
  };

  readonly getById = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as UserIdParams;
    this.ok(res, 'User fetched successfully', await this.users.getById(id));
  };

  readonly create = async (req: Request, res: Response): Promise<void> => {
    const user = await this.users.create(req.body as CreateUserInput);
    this.created(res, 'User created successfully', user);
  };

  readonly update = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as UserIdParams;
    const user = await this.users.update(id, req.body as UpdateUserInput);
    this.ok(res, 'User updated successfully', user);
  };

  readonly remove = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params as UserIdParams;
    await this.users.remove(id);
    this.noContent(res);
  };
}
