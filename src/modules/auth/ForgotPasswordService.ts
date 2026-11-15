import { NotFoundError } from '../../core/errors/HttpErrors.js';
import type { ILogger } from '../../core/logger/ILogger.js';
import type { PasswordResetEmailService } from '../email/PasswordResetEmailService.js';
import type { IUserRepository } from '../user/IUserRepository.js';
import { ACCOUNT_NOT_FOUND_MESSAGE } from './auth.constants.js';

/**
 * Starts a password reset. FEATURES.md asks for an error when the email is unknown (a private
 * vault for a handful of known users), so this deliberately reveals whether an account exists.
 * The email is sent in the request itself; there is no queue.
 */
export class ForgotPasswordService {
  constructor(
    private readonly users: IUserRepository,
    private readonly email: PasswordResetEmailService,
    private readonly logger: ILogger,
  ) {}

  async request(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) throw new NotFoundError(ACCOUNT_NOT_FOUND_MESSAGE);
    await this.email.send(user);
    this.logger.info(`Password reset email sent to user ${user.id}.`);
  }
}
