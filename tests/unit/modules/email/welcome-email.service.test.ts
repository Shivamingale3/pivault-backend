import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailTemplate } from '../../../../src/modules/email/IEmailSender.js';
import { WelcomeEmailService } from '../../../../src/modules/email/WelcomeEmailService.js';
import { ResetPurpose } from '../../../../src/modules/passwordReset/passwordReset.constants.js';

const user = { id: '01JXXXXXXXXXXXXXXXXXXXXXXX', email: 'jane@example.com', firstName: 'Jane' };
const APP_URL = 'https://vault.example.com';

let sender: { send: ReturnType<typeof vi.fn> };
let tokens: { issue: ReturnType<typeof vi.fn> };
let service: WelcomeEmailService;

beforeEach(() => {
  sender = { send: vi.fn(() => Promise.resolve()) };
  tokens = { issue: vi.fn(() => Promise.resolve('raw-token_123')) };
  service = new WelcomeEmailService(sender, tokens, APP_URL);
});

describe('WelcomeEmailService', () => {
  it('issues an onboarding token and emails a set-password link carrying it', async () => {
    await service.send(user);

    expect(tokens.issue).toHaveBeenCalledWith(user.id, ResetPurpose.Onboarding);
    expect(sender.send).toHaveBeenCalledWith({
      to: user.email,
      template: EmailTemplate.Welcome,
      variables: {
        firstName: 'Jane',
        resetUrl: 'https://vault.example.com/reset-password?key=raw-token_123',
      },
    });
  });

  it('url-encodes the token in the link', async () => {
    tokens.issue.mockResolvedValueOnce('a b&c');
    await service.send(user);
    const { variables } = sender.send.mock.calls[0]?.[0] as { variables: { resetUrl: string } };
    expect(new URL(variables.resetUrl).searchParams.get('key')).toBe('a b&c');
  });

  it('propagates sender failures so the caller can roll back', async () => {
    sender.send.mockRejectedValueOnce(new Error('smtp down'));
    await expect(service.send(user)).rejects.toThrow('smtp down');
  });

  it('does not send anything when the token cannot be issued', async () => {
    tokens.issue.mockRejectedValueOnce(new Error('db down'));
    await expect(service.send(user)).rejects.toThrow('db down');
    expect(sender.send).not.toHaveBeenCalled();
  });
});
