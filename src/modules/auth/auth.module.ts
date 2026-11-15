import type { IRouteModule } from '../../core/http/IRouteModule.js';
import { AuthController } from './AuthController.js';
import { AuthRouter, type AuthGuards } from './AuthRouter.js';
import type { AuthService } from './AuthService.js';
import type { ForgotPasswordService } from './ForgotPasswordService.js';

export function createAuthModule(
  auth: AuthService,
  forgotPassword: ForgotPasswordService,
  guards: AuthGuards,
): IRouteModule {
  return new AuthRouter(new AuthController(auth, forgotPassword), guards);
}
