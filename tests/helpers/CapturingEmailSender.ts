import type { EmailMessage, IEmailSender } from '../../src/modules/email/IEmailSender.js';

/** `IEmailSender` that records messages, and can be told to fail, for end-to-end tests. */
export class CapturingEmailSender implements IEmailSender {
  readonly sent: EmailMessage[] = [];
  failWith: Error | null = null;

  send(message: EmailMessage): Promise<void> {
    if (this.failWith) return Promise.reject(this.failWith);
    this.sent.push(message);
    return Promise.resolve();
  }
}
