import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnrecoverableError } from 'bullmq';
import { ulid } from 'ulid';
import { EmailProcessor } from '../../../../src/modules/email/EmailProcessor.js';
import { EmailTemplate, type IEmailSender } from '../../../../src/modules/email/IEmailSender.js';
import { maskEmail } from '../../../../src/modules/email/LogEmailSender.js';
import { userData } from '../../../helpers/fixtures.js';
import { InMemoryUserRepository } from '../../../helpers/InMemoryUserRepository.js';
import { ResetPurpose } from '../../../../src/modules/passwordReset/passwordReset.constants.js';

let users: InMemoryUserRepository;
let sender: IEmailSender & { send: ReturnType<typeof vi.fn> };
let tokens: {
  issue: ReturnType<typeof vi.fn<(userId: string, purpose: ResetPurpose) => Promise<string>>>;
};
let processor: EmailProcessor;

beforeEach(() => {
  users = new InMemoryUserRepository();
  sender = { send: vi.fn(() => Promise.resolve()) };
  tokens = { issue: vi.fn(() => Promise.resolve('raw-token')) };
  processor = new EmailProcessor(users, sender, tokens, 'https://vault.example.com');
});

describe('EmailProcessor', () => {
  it('sends the welcome email with an onboarding set-password link', async () => {
    const user = await users.create(userData({ email: 'jane@example.com', firstName: 'Jane' }));
    await processor.handle('welcome', { userId: user.id });
    expect(tokens.issue).toHaveBeenCalledWith(user.id, ResetPurpose.Onboarding);
    expect(sender.send).toHaveBeenCalledWith({
      to: 'jane@example.com',
      template: EmailTemplate.Welcome,
      variables: {
        firstName: 'Jane',
        resetUrl: 'https://vault.example.com/reset-password?key=raw-token',
      },
    });
  });

  it('url-encodes the token in the link', async () => {
    tokens.issue.mockResolvedValueOnce('a b&c');
    const user = await users.create(userData());
    await processor.handle('welcome', { userId: user.id });
    const sent = sender.send.mock.calls[0]?.[0] as { variables: { resetUrl: string } };
    expect(new URL(sent.variables.resetUrl).searchParams.get('key')).toBe('a b&c');
  });

  it('fails permanently when the user no longer exists', async () => {
    await expect(processor.handle('welcome', { userId: ulid() })).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(sender.send).not.toHaveBeenCalled();
    expect(tokens.issue).not.toHaveBeenCalled();
  });

  it('refuses password-reset until the forgot-password step exists', async () => {
    const user = await users.create(userData());
    await expect(processor.handle('password-reset', { userId: user.id })).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it('only accepts id payloads', () => {
    const schema = processor.schemas.welcome;
    expect(schema.safeParse({ userId: ulid() }).success).toBe(true);
    expect(schema.safeParse({ userId: 'nope' }).success).toBe(false);
    expect(schema.safeParse({ userId: ulid(), token: 'secret' }).success).toBe(false);
  });
});

describe('maskEmail', () => {
  it('keeps the first letter and domain only', () => {
    expect(maskEmail('jane.doe@example.com')).toBe('j***@example.com');
    expect(maskEmail('broken')).toBe('***');
  });
});
