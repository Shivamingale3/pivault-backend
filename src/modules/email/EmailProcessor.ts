import { UnrecoverableError } from 'bullmq';
import type { z } from 'zod';
import { QueueName } from '../../core/queue/queue.constants.js';
import type { IJobProcessor } from '../../core/queue/queue.types.js';
import type { IUserRepository } from '../user/IUserRepository.js';
import { EMAIL_JOB_SCHEMAS, type EmailJobName, type EmailJobSchemas } from './email.jobs.js';
import { EmailTemplate, type IEmailSender } from './IEmailSender.js';

/**
 * Consumes the email queue. `password-reset` fails permanently until the
 * forgot-password step adds token creation: a reset email without a link is useless.
 */
export class EmailProcessor implements IJobProcessor<EmailJobSchemas> {
  readonly queueName = QueueName.Email;
  readonly schemas = EMAIL_JOB_SCHEMAS;

  constructor(
    private readonly users: IUserRepository,
    private readonly sender: IEmailSender,
  ) {}

  async handle<K extends EmailJobName>(
    name: K,
    payload: z.output<EmailJobSchemas[K]>,
  ): Promise<void> {
    const user = await this.users.findById(payload.userId);
    // The user may have been deleted after enqueueing: retrying can't help.
    if (!user) throw new UnrecoverableError(`User for "${name}" job no longer exists`);

    if (name !== 'welcome') {
      throw new UnrecoverableError(`"${name}" emails are not implemented yet`);
    }
    await this.sender.send({
      to: user.email,
      template: EmailTemplate.Welcome,
      variables: { firstName: user.firstName },
    });
  }
}
