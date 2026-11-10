import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnrecoverableError } from 'bullmq';
import { ulid } from 'ulid';
import { EmailProcessor } from '../../../../src/modules/email/EmailProcessor.js';
import { EmailTemplate, type IEmailSender } from '../../../../src/modules/email/IEmailSender.js';
import { maskEmail } from '../../../../src/modules/email/LogEmailSender.js';
import { userData } from '../../../helpers/fixtures.js';
import { InMemoryUserRepository } from '../../../helpers/InMemoryUserRepository.js';

let users: InMemoryUserRepository;
let sender: IEmailSender & { send: ReturnType<typeof vi.fn> };
let processor: EmailProcessor;

beforeEach(() => {
  users = new InMemoryUserRepository();
  sender = { send: vi.fn(() => Promise.resolve()) };
  processor = new EmailProcessor(users, sender);
});

describe('EmailProcessor', () => {
  it('sends the welcome email to the user', async () => {
    const user = await users.create(userData({ email: 'jane@example.com', firstName: 'Jane' }));
    await processor.handle('welcome', { userId: user.id });
    expect(sender.send).toHaveBeenCalledWith({
      to: 'jane@example.com',
      template: EmailTemplate.Welcome,
      variables: { firstName: 'Jane' },
    });
  });

  it('fails permanently when the user no longer exists', async () => {
    await expect(processor.handle('welcome', { userId: ulid() })).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(sender.send).not.toHaveBeenCalled();
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
