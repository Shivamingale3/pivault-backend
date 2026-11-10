import type { IPasswordHasher } from '../../core/crypto/IPasswordHasher.js';
import type { ILogger } from '../../core/logger/ILogger.js';
import type { IJobQueue } from '../../core/queue/queue.types.js';
import type { EmailJobSchemas } from '../email/email.jobs.js';
import type { User } from '../user/user.types.js';
import type { UserService } from '../user/UserService.js';
import type { RegisterInput } from './register.schema.js';

export interface RegisterResult {
  user: User;
  /** False when the welcome email could not be queued; the account still exists. */
  welcomeEmailQueued: boolean;
}

/** Register flow: hash the password → store the user (DB enforces uniqueness) → queue welcome email. */
export class RegisterService {
  constructor(
    private readonly users: UserService,
    private readonly hasher: IPasswordHasher,
    private readonly emailQueue: IJobQueue<EmailJobSchemas>,
    private readonly logger: ILogger,
  ) {}

  async register(input: RegisterInput): Promise<RegisterResult> {
    const { password, ...profile } = input;
    const passwordHash = await this.hasher.hash(password);
    const user = await this.users.create({ ...profile, passwordHash });
    return { user, welcomeEmailQueued: await this.queueWelcomeEmail(user.id) };
  }

  /** A queue outage must not undo a successful registration. */
  private async queueWelcomeEmail(userId: string): Promise<boolean> {
    try {
      await this.emailQueue.enqueue('welcome', { userId }, { jobId: `welcome-${userId}` });
      return true;
    } catch (error) {
      this.logger.error(`Could not queue the welcome email for user ${userId}.`, error);
      return false;
    }
  }
}
