import type { IPasswordHasher } from '../../core/crypto/IPasswordHasher.js';
import { HttpError } from '../../core/errors/HttpErrors.js';
import type { ILogger } from '../../core/logger/ILogger.js';
import type { WelcomeEmailService } from '../email/WelcomeEmailService.js';
import type { User } from '../user/user.types.js';
import type { UserService } from '../user/UserService.js';
import type { RegisterInput } from './register.schema.js';

export interface RegisterResult {
  user: User;
}

/**
 * Register flow: hash the password → store the user (DB enforces uniqueness) → send the
 * welcome email. If the email cannot be sent the user is deleted again, so a failed
 * registration can simply be retried.
 */
export class RegisterService {
  constructor(
    private readonly users: UserService,
    private readonly hasher: IPasswordHasher,
    private readonly welcomeEmail: WelcomeEmailService,
    private readonly logger: ILogger,
  ) {}

  async register(input: RegisterInput): Promise<RegisterResult> {
    const { password, ...profile } = input;
    const passwordHash = await this.hasher.hash(password);
    const user = await this.users.create({ ...profile, passwordHash });
    try {
      await this.welcomeEmail.send(user);
    } catch (error) {
      this.logger.error(`Could not send the welcome email for user ${user.id}.`, error);
      await this.rollback(user.id);
      throw new HttpError(502, 'Could not send the welcome email, registration was cancelled', {
        cause: error,
      });
    }
    return { user };
  }

  private async rollback(userId: string): Promise<void> {
    try {
      await this.users.delete(userId);
    } catch (error) {
      this.logger.error(`Could not roll back user ${userId} after a failed registration.`, error);
    }
  }
}
