import type { RequestHandler, Router } from 'express';
import { BaseRouter } from '../../core/http/BaseRouter.js';
import { noStore } from '../../core/middlewares/noStore.js';
import type { RequestValidator } from '../../core/middlewares/RequestValidator.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  recoveryKeyConfiguredSchema,
} from './auth.schema.js';
import type { AuthController } from './AuthController.js';

export interface AuthGuards {
  loginLimiter: RequestHandler;
  forgotPasswordLimiter: RequestHandler;
  changePasswordLimiter: RequestHandler;
  /** Requires a signed request (signature and body) from the session's device (see `SessionAuthGuard`). */
  requireSession: RequestHandler[];
  validator: RequestValidator;
}

/** `/api/auth`: login and forgot-password are public; the rest need a signed session. */
export class AuthRouter extends BaseRouter {
  readonly basePath = '/auth';

  constructor(
    private readonly controller: AuthController,
    private readonly guards: AuthGuards,
  ) {
    super();
  }

  protected registerRoutes(router: Router): void {
    const {
      loginLimiter,
      forgotPasswordLimiter,
      changePasswordLimiter,
      requireSession,
      validator,
    } = this.guards;
    router.use(noStore);
    router.post('/login', loginLimiter, validator.validate(loginSchema), this.controller.login);
    router.post(
      '/forgot-password',
      forgotPasswordLimiter,
      validator.validate(forgotPasswordSchema),
      this.controller.requestPasswordReset,
    );
    router.post('/logout', requireSession, this.controller.logout);
    router.post(
      '/recovery-key-configured',
      requireSession,
      validator.validate(recoveryKeyConfiguredSchema),
      this.controller.recoveryKeyConfigured,
    );
    router.post(
      '/change-password',
      changePasswordLimiter,
      requireSession,
      validator.validate(changePasswordSchema),
      this.controller.changePassword,
    );
    router.post('/recovery-key-check', requireSession, this.controller.recoveryKeyCheck);
  }
}
