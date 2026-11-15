import type { Request, Response } from 'express';
import { BaseController } from '../../core/http/BaseController.js';
import { authOf } from '../session/SessionAuthGuard.js';
import { IP_MAX_LENGTH, USER_AGENT_MAX_LENGTH } from './auth.constants.js';
import type { ForgotPasswordInput, LoginInput } from './auth.schema.js';
import type { AuthService } from './AuthService.js';
import type { ForgotPasswordService } from './ForgotPasswordService.js';

export class AuthController extends BaseController {
  constructor(
    private readonly auth: AuthService,
    private readonly forgotPassword: ForgotPasswordService,
  ) {
    super();
  }

  /** Body was already validated by the router's validator. */
  readonly login = async (req: Request, res: Response): Promise<void> => {
    const { email, password, publicKey } = req.body as LoginInput;
    const result = await this.auth.login({
      email,
      password,
      publicKey,
      userAgent: req.get('user-agent')?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
      ipAddress: req.ip?.slice(0, IP_MAX_LENGTH) ?? null,
    });
    this.ok(res, 'Signed in', result);
  };

  readonly logout = async (_req: Request, res: Response): Promise<void> => {
    const { userId } = authOf(res);
    await this.auth.logout(userId);
    this.ok(res, 'Signed out');
  };

  readonly recoveryKeyConfigured = async (_req: Request, res: Response): Promise<void> => {
    await this.auth.markRecoveryKeyConfigured(authOf(res).userId);
    this.ok(res, 'Recovery key recorded');
  };

  readonly requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body as ForgotPasswordInput;
    await this.forgotPassword.request(email);
    this.ok(res, 'Password reset email sent');
  };
}
