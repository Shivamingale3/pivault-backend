import { describe, it, expect, vi } from 'vitest';
import { EmailTemplate } from '../../../../src/modules/email/IEmailSender.js';
import { SmtpEmailSender } from '../../../../src/modules/email/SmtpEmailSender.js';
import { createFakeLogger } from '../../../helpers/fakes.js';

const message = {
  to: 'jane@example.com',
  template: EmailTemplate.Welcome,
  variables: { firstName: 'Jane', resetUrl: 'https://vault.example.com/reset-password?key=abc' },
};

describe('SmtpEmailSender', () => {
  it('sends the rendered email from the configured sender', async () => {
    const transport = { sendMail: vi.fn((_mail: unknown) => Promise.resolve({})) };
    const logger = createFakeLogger();
    await new SmtpEmailSender(transport, 'PiVault <no-reply@example.com>', logger).send(message);

    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'PiVault <no-reply@example.com>',
        to: 'jane@example.com',
        subject: 'Welcome to PiVault: set your password',
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(expect.not.stringContaining('jane@example.com'));
  });

  it('throws a sanitised error and keeps the cause', async () => {
    const cause = new Error('535 auth failed for jane@example.com');
    const transport = { sendMail: vi.fn((_mail: unknown) => Promise.reject(cause)) };
    const sending = new SmtpEmailSender(transport, 'a@b.co', createFakeLogger()).send(message);

    await expect(sending).rejects.toThrow('Could not send "welcome" email');
    await expect(sending).rejects.toMatchObject({ cause });
    await expect(sending).rejects.not.toThrow(/jane@example\.com/);
  });
});
