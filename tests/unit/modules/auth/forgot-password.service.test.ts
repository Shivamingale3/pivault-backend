import { describe, it, expect, vi } from 'vitest';
import { ACCOUNT_NOT_FOUND_MESSAGE } from '../../../../src/modules/auth/auth.constants.js';
import { ForgotPasswordService } from '../../../../src/modules/auth/ForgotPasswordService.js';
import { EmailTemplate } from '../../../../src/modules/email/IEmailSender.js';
import { PasswordResetEmailService } from '../../../../src/modules/email/PasswordResetEmailService.js';
import { ResetPurpose } from '../../../../src/modules/passwordReset/passwordReset.constants.js';
import { createFakeLogger } from '../../../helpers/fakes.js';
import { InMemoryUserRepository } from '../../../helpers/InMemoryUserRepository.js';

const setup = async () => {
  const users = new InMemoryUserRepository();
  const user = await users.create({
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    countryCode: '91',
    mobile: '9876543210',
    passwordHash: 'x',
  });
  const sender = { send: vi.fn((_message: unknown) => Promise.resolve()) };
  const tokens = { issue: vi.fn((..._args: unknown[]) => Promise.resolve('raw-token')) };
  const service = new ForgotPasswordService(
    users,
    new PasswordResetEmailService(sender, tokens, 'https://vault.example.com'),
    createFakeLogger(),
  );
  return { user, sender, tokens, service };
};

describe('ForgotPasswordService', () => {
  it('issues a 15 minute reset token and emails the link', async () => {
    const { user, sender, tokens, service } = await setup();
    await service.request('jane@example.com');

    expect(tokens.issue).toHaveBeenCalledWith(user.id, ResetPurpose.Reset);
    expect(sender.send).toHaveBeenCalledWith({
      to: 'jane@example.com',
      template: EmailTemplate.PasswordReset,
      variables: {
        firstName: 'Jane',
        resetUrl: 'https://vault.example.com/reset-password?key=raw-token',
      },
    });
  });

  it('throws not found for an unknown email and sends nothing', async () => {
    const { sender, tokens, service } = await setup();
    await expect(service.request('ghost@example.com')).rejects.toMatchObject({
      statusCode: 404,
      message: ACCOUNT_NOT_FOUND_MESSAGE,
    });
    expect(tokens.issue).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('surfaces an email failure', async () => {
    const { sender, service } = await setup();
    sender.send.mockRejectedValueOnce(new Error('smtp down'));
    await expect(service.request('jane@example.com')).rejects.toThrow('smtp down');
  });
});
