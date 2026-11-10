import type { ILogger } from '../../core/logger/ILogger.js';
import type { EmailMessage, IEmailSender } from './IEmailSender.js';

/**
 * Development sender: logs that an email would be sent. It deliberately logs
 * only the template and a masked recipient, never variables (which can hold
 * reset links).
 */
export class LogEmailSender implements IEmailSender {
  constructor(private readonly logger: ILogger) {}

  send(message: EmailMessage): Promise<void> {
    this.logger.info(`[email] "${message.template}" → ${maskEmail(message.to)}`);
    return Promise.resolve();
  }
}

/** `jane.doe@example.com` → `j***@example.com` */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  return `${email[0] ?? ''}***${email.slice(at)}`;
}
