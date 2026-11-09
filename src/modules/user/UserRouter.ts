import type { Router } from 'express';
import type { RateLimitKey } from '../../core/constants/ratelimits.constants.js';
import { BaseRouter } from '../../core/http/BaseRouter.js';
import type { RateLimiterFactory } from '../../core/middlewares/RateLimiterFactory.js';
import type { RequestValidator } from '../../core/middlewares/RequestValidator.js';
import type { UserController } from './UserController.js';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamsSchema,
} from './user.schemas.js';

/**
 * PLACEHOLDER MODULE — these routes are intentionally unauthenticated.
 * Add authentication/authorisation middleware before using them for real.
 */
export class UserRouter extends BaseRouter {
  readonly basePath = '/users';

  constructor(
    private readonly controller: UserController,
    private readonly validator: RequestValidator,
    private readonly rateLimiterFactory: RateLimiterFactory<RateLimitKey>,
  ) {
    super();
  }

  protected registerRoutes(router: Router): void {
    const { controller, validator } = this;
    const writeLimiter = this.rateLimiterFactory.create('USER_WRITE');
    const validId = validator.validate(userIdParamsSchema, 'params');

    router.get('/', validator.validate(listUsersQuerySchema, 'query'), controller.list);
    router.get('/:id', validId, controller.getById);
    router.post('/', writeLimiter, validator.validate(createUserSchema), controller.create);
    router.patch(
      '/:id',
      writeLimiter,
      validId,
      validator.validate(updateUserSchema),
      controller.update,
    );
    router.delete('/:id', writeLimiter, validId, controller.remove);
  }
}
