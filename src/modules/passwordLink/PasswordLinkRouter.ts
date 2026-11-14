import type { RequestHandler, Router } from 'express';
import { BaseRouter } from '../../core/http/BaseRouter.js';
import { noStore } from '../../core/middlewares/noStore.js';
import type { RequestValidator } from '../../core/middlewares/RequestValidator.js';
import { completeLinkSchema, validateLinkSchema } from './passwordLink.schema.js';
import type { PasswordLinkController } from './PasswordLinkController.js';

export interface PasswordLinkGuards {
  validateLimiter: RequestHandler;
  completeLimiter: RequestHandler;
  validator: RequestValidator;
}

/**
 * `/api/auth/password-links`: public (the user is not signed in). The token travels in the
 * body, never the URL, so it stays out of access logs.
 */
export class PasswordLinkRouter extends BaseRouter {
  readonly basePath = '/auth/password-links';

  constructor(
    private readonly controller: PasswordLinkController,
    private readonly guards: PasswordLinkGuards,
  ) {
    super();
  }

  protected registerRoutes(router: Router): void {
    const { validateLimiter, completeLimiter, validator } = this.guards;
    router.use(noStore);
    router.post(
      '/validate',
      validateLimiter,
      validator.validate(validateLinkSchema),
      this.controller.validate,
    );
    router.post(
      '/complete',
      completeLimiter,
      validator.validate(completeLinkSchema),
      this.controller.complete,
    );
  }
}
