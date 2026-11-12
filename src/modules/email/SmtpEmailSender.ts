import type { ILogger } from '../../core/logger/ILogger.js';
import { renderEmail } from './emailTemplates.js';
import type { EmailMessage, IEmailSender } from './IEmailSender.js';
import { maskEmail } from './LogEmailSender.js';

/** The one nodemailer method used, so tests can pass a fake. */
export interface IMailTransport {
  sendMail(mail: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
}

/** Delivers rendered emails over SMTP. Failures throw so the queue retries with backoff. */
export class SmtpEmailSender implements IEmailSender {
  constructor(
    private readonly transport: IMailTransport,
    private readonly from: string,
    private readonly logger: ILogger,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const { subject, text, html } = renderEmail(message);
    try {
      await this.transport.sendMail({ from: this.from, to: message.to, subject, text, html });
    } catch (error) {
      // Never put the recipient or SMTP response (may echo credentials/addresses) in the thrown message.
      throw new Error(`Could not send "${message.template}" email`, { cause: error });
    }
    this.logger.info(`[email] "${message.template}" sent → ${maskEmail(message.to)}`);
  }
}
