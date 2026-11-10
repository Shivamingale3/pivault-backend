import type { RequestHandler, Router } from 'express';
import { BaseRouter } from '../../core/http/BaseRouter.js';
import type { RequestValidator } from '../../core/middlewares/RequestValidator.js';
import { registerSchema } from './register.schema.js';
import type { RegisterController } from './RegisterController.js';

export interface RegisterGuards {
  /** Rejects anything that did not come straight from localhost. Runs first. */
  localOnly: RequestHandler;
  rateLimiter: RequestHandler;
  validator: RequestValidator;
}

/** `/api/internal/register`: the `internal` prefix lets the public proxy block the whole subtree. */
export class RegisterRouter extends BaseRouter {
  readonly basePath = '/internal/register';

  constructor(
    private readonly controller: RegisterController,
    private readonly guards: RegisterGuards,
  ) {
    super();
  }

  protected registerRoutes(router: Router): void {
    const { localOnly, rateLimiter, validator } = this.guards;
    router.post(
      '/',
      localOnly,
      rateLimiter,
      validator.validate(registerSchema),
      this.controller.register,
    );
  }
}
