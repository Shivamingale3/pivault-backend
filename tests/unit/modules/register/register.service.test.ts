import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserConflictError } from '../../../../src/modules/user/user.errors.js';
import { WelcomeEmailService } from '../../../../src/modules/email/WelcomeEmailService.js';
import { UserService } from '../../../../src/modules/user/UserService.js';
import type { RegisterInput } from '../../../../src/modules/register/register.schema.js';
import { RegisterService } from '../../../../src/modules/register/RegisterService.js';
import { createFakeLogger } from '../../../helpers/fakes.js';
import { InMemoryUserRepository } from '../../../helpers/InMemoryUserRepository.js';

const input: RegisterInput = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  countryCode: '91',
  mobile: '9876543210',
  password: 'Passw0rd!',
};

let repo: InMemoryUserRepository;
const makeHasher = () => ({
  hash: vi.fn((_password: string) => Promise.resolve('hashed')),
  verify: vi.fn((_hash: string, _password: string) => Promise.resolve(true)),
});
const makeSender = () => ({ send: vi.fn((_message: unknown) => Promise.resolve()) });
const makeTokens = () => ({ issue: vi.fn((..._args: unknown[]) => Promise.resolve('raw-token')) });

let hasher: ReturnType<typeof makeHasher>;
let sender: ReturnType<typeof makeSender>;
let logger: ReturnType<typeof createFakeLogger>;
let service: RegisterService;

beforeEach(() => {
  repo = new InMemoryUserRepository();
  hasher = makeHasher();
  sender = makeSender();
  logger = createFakeLogger();
  service = new RegisterService(
    new UserService(repo),
    hasher,
    new WelcomeEmailService(sender, makeTokens(), 'https://vault.example.com'),
    logger,
  );
});

describe('RegisterService', () => {
  it('stores the hash (never the password), splits the mobile and sends the welcome email', async () => {
    const { user } = await service.register(input);

    const stored = repo.rows.get(user.id);
    expect(stored?.passwordHash).toBe('hashed');
    expect(JSON.stringify(stored)).not.toContain('Passw0rd!');
    expect(stored).toMatchObject({ countryCode: '91', mobile: '9876543210' });
    expect(user).not.toHaveProperty('passwordHash');
    expect(hasher.hash).toHaveBeenCalledWith('Passw0rd!');
    expect(sender.send).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ to: 'jane@example.com' }),
    );
  });

  it.each([
    ['email', { email: 'jane@example.com', mobile: '9000000001' }],
    ['mobile', { email: 'other@example.com' }],
  ])('rejects a duplicate %s and sends nothing', async (field, override) => {
    await service.register(input);
    sender.send.mockClear();
    const duplicate = service.register({ ...input, ...override });
    await expect(duplicate).rejects.toBeInstanceOf(UserConflictError);
    await expect(duplicate).rejects.toMatchObject({ field });
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('allows the same national number under a different country code', async () => {
    await service.register(input);
    await expect(
      service.register({ ...input, email: 'b@example.com', countryCode: '44' }),
    ).resolves.toBeDefined();
  });

  it('deletes the user and throws a 502 when the welcome email cannot be sent', async () => {
    sender.send.mockRejectedValueOnce(new Error('smtp down'));
    await expect(service.register(input)).rejects.toMatchObject({ statusCode: 502 });
    expect(repo.rows.size).toBe(0);
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('allows registering again after a failed email', async () => {
    sender.send.mockRejectedValueOnce(new Error('smtp down'));
    await expect(service.register(input)).rejects.toBeDefined();
    await expect(service.register(input)).resolves.toBeDefined();
    expect(repo.rows.size).toBe(1);
  });

  it('still reports the email failure when the rollback itself fails', async () => {
    sender.send.mockRejectedValueOnce(new Error('smtp down'));
    repo.delete = () => Promise.reject(new Error('db down'));
    await expect(service.register(input)).rejects.toMatchObject({ statusCode: 502 });
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});
